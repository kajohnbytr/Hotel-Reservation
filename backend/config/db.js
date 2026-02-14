import mongoose from "mongoose";
import dns from "dns";
import https from "https";

const applyDnsServers = () => {
    const raw = process.env.DNS_SERVERS;
    const servers = raw
        ? raw.split(",").map((server) => server.trim()).filter(Boolean)
        : ["1.1.1.1", "8.8.8.8"];

    try {
        dns.setServers(servers);
        console.log(`Using DNS servers: ${servers.join(", ")}`);
    } catch (error) {
        console.warn(`Failed to set DNS servers: ${error.message}`);
    }
};

const isDnsError = (error) => {
    const message = String(error?.message || "");
    return (
        message.includes("querySrv") ||
        message.includes("queryTxt") ||
        message.includes("ENOTFOUND") ||
        message.includes("EAI_AGAIN") ||
        message.includes("ETIMEOUT") ||
        message.includes("ECONNREFUSED")
    );
};

const dohQuery = (name, type) =>
    new Promise((resolve, reject) => {
        const url = new URL(`https://cloudflare-dns.com/dns-query?name=${name}&type=${type}`);
        const req = https.request(
            url,
            { headers: { accept: "application/dns-json" } },
            (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });
                res.on("end", () => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`DoH ${type} lookup failed: HTTP ${res.statusCode}`));
                    }
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (parseError) {
                        reject(parseError);
                    }
                });
            }
        );
        req.on("error", reject);
        req.end();
    });

const dohResolveSrv = async (host) => {
    const json = await dohQuery(`_mongodb._tcp.${host}`, "SRV");
    if (!Array.isArray(json.Answer) || json.Answer.length === 0) {
        throw new Error("DoH SRV lookup returned no answers");
    }
    const records = json.Answer.map((answer) => {
        const parts = String(answer.data || "").trim().split(/\s+/);
        const port = parts[2];
        const target = (parts[3] || "").replace(/\.$/, "");
        return { target, port };
    }).filter((record) => record.target && record.port);
    if (records.length === 0) {
        throw new Error("DoH SRV lookup returned invalid records");
    }
    return records;
};

const dohResolveTxtParams = async (host) => {
    const json = await dohQuery(`_mongodb._tcp.${host}`, "TXT");
    if (!Array.isArray(json.Answer) || json.Answer.length === 0) {
        return [];
    }
    return json.Answer.map((answer) => String(answer.data || "").replace(/^"|"$/g, "")).filter(Boolean);
};

const dohResolveA = async (host) => {
    const json = await dohQuery(host, "A");
    if (!Array.isArray(json.Answer) || json.Answer.length === 0) {
        throw new Error(`DoH A lookup returned no answers for ${host}`);
    }
    return json.Answer.map((answer) => String(answer.data || "").trim()).filter(Boolean);
};

const applyTxtParams = (txtRecords, params) => {
    txtRecords.forEach((record) => {
        record
            .split("&")
            .map((pair) => pair.trim())
            .filter(Boolean)
            .forEach((pair) => {
                const [key, value] = pair.split("=");
                if (key && value && !params.has(key)) {
                    params.set(key, value);
                }
            });
    });
};

const buildResolvedMongoUri = async (srvUri) => {
    const url = new URL(srvUri);
    const host = url.hostname;
    const records = await dohResolveSrv(host);
    const seeds = records.map((record) => `${record.target}:${record.port}`).join(",");
    const txtRecords = await dohResolveTxtParams(host);

    const username = url.username ? encodeURIComponent(decodeURIComponent(url.username)) : "";
    const password = url.password ? encodeURIComponent(decodeURIComponent(url.password)) : "";
    const auth = username ? `${username}:${password}@` : "";
    const dbName = url.pathname && url.pathname !== "/" ? url.pathname : "/";
    const params = new URLSearchParams(url.search);

    applyTxtParams(txtRecords, params);
    if (!params.has("tls") && !params.has("ssl")) {
        params.set("tls", "true");
    }
    if (!params.has("retryWrites")) {
        params.set("retryWrites", "true");
    }
    if (!params.has("w")) {
        params.set("w", "majority");
    }

    const query = params.toString();
    return `mongodb://${auth}${seeds}${dbName}${query ? `?${query}` : ""}`;
};

let resolvedSrvUriCache = null;
let resolvedIpUriCache = null;

const buildIpMongoUri = async (srvUri) => {
    const url = new URL(srvUri);
    const host = url.hostname;
    const records = await dohResolveSrv(host);
    const txtRecords = await dohResolveTxtParams(host);

    const ipSeeds = await Promise.all(
        records.map(async (record) => {
            const ips = await dohResolveA(record.target);
            return ips.map((ip) => `${ip}:${record.port}`);
        })
    );
    const seeds = ipSeeds.flat().join(",");

    const username = url.username ? encodeURIComponent(decodeURIComponent(url.username)) : "";
    const password = url.password ? encodeURIComponent(decodeURIComponent(url.password)) : "";
    const auth = username ? `${username}:${password}@` : "";
    const dbName = url.pathname && url.pathname !== "/" ? url.pathname : "/";
    const params = new URLSearchParams(url.search);

    applyTxtParams(txtRecords, params);
    if (!params.has("tls") && !params.has("ssl")) {
        params.set("tls", "true");
    }
    if (!params.has("retryWrites")) {
        params.set("retryWrites", "true");
    }
    if (!params.has("w")) {
        params.set("w", "majority");
    }

    const query = params.toString();
    return `mongodb://${auth}${seeds}${dbName}${query ? `?${query}` : ""}`;
};

const connectWithRetry = async (attempt = 1) => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("Error: MONGO_URI is not set.");
        return;
    }

    const isSrv = uri.startsWith("mongodb+srv://");
    if (isSrv) {
        applyDnsServers();
    }

    try {
        const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        if (isSrv && isDnsError(error)) {
            try {
                if (!resolvedSrvUriCache) {
                    resolvedSrvUriCache = await buildResolvedMongoUri(uri);
                }
                console.warn("Retrying MongoDB connection using DoH-resolved SRV records...");
                const conn = await mongoose.connect(resolvedSrvUriCache, { serverSelectionTimeoutMS: 10000 });
                console.log(`MongoDB Connected: ${conn.connection.host}`);
                return;
            } catch (fallbackError) {
                console.error(`DoH SRV fallback failed: ${fallbackError.message}`);
                if (isDnsError(fallbackError)) {
                    try {
                        if (!resolvedIpUriCache) {
                            resolvedIpUriCache = await buildIpMongoUri(uri);
                        }
                        console.warn("Retrying MongoDB connection using DoH-resolved IPs (TLS hostname check disabled)...");
                        const conn = await mongoose.connect(resolvedIpUriCache, {
                            serverSelectionTimeoutMS: 10000,
                            tlsAllowInvalidHostnames: true,
                        });
                        console.log(`MongoDB Connected: ${conn.connection.host}`);
                        return;
                    } catch (ipFallbackError) {
                        console.error(`DoH IP fallback failed: ${ipFallbackError.message}`);
                    }
                }
            }
        }

        const delayMs = Math.min(5000 * attempt, 30000);
        console.error(`Retrying MongoDB connection in ${delayMs / 1000}s...`);
        setTimeout(() => {
            connectWithRetry(attempt + 1);
        }, delayMs);
    }
};

export const connectDB = () => {
    connectWithRetry();
};