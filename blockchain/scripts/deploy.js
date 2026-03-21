const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const backendEnvPath = path.resolve(__dirname, "..", "..", "backend", ".env");
dotenv.config({ path: backendEnvPath });

function syncBackendContractAddress(address) {
  try {
    if (!fs.existsSync(backendEnvPath)) return;
    const content = fs.readFileSync(backendEnvPath, "utf8");
    const line = `BOOKING_CONTRACT_ADDRESS=${address}`;

    if (/^BOOKING_CONTRACT_ADDRESS=.*$/m.test(content)) {
      const updated = content.replace(/^BOOKING_CONTRACT_ADDRESS=.*$/m, line);
      fs.writeFileSync(backendEnvPath, updated, "utf8");
    } else {
      const suffix = content.endsWith("\n") ? "" : "\n";
      fs.writeFileSync(backendEnvPath, `${content}${suffix}${line}\n`, "utf8");
    }

    console.log("Updated backend/.env BOOKING_CONTRACT_ADDRESS:", address);
  } catch (error) {
    console.warn("Could not update backend/.env automatically:", error.message || error);
  }
}

async function main() {
  const Booking = await ethers.getContractFactory("BookingContract");
  const booking = await Booking.deploy();
  await booking.deployed();
  console.log("BookingContract deployed to:", booking.address);

  syncBackendContractAddress(booking.address);

  const outputPath = path.resolve(__dirname, "..", "deploy.latest.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        address: booking.address,
        network: hre.network.name,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log("Deployment metadata written to:", outputPath);

  const recorder = process.env.BOOKING_RECORDER;
  if (recorder) {
    await booking.setRecorder(recorder, true);
    console.log("Authorized booking recorder:", recorder);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});