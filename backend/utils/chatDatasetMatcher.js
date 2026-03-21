import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATASET_PATH = path.resolve(__dirname, '../../data/chatbot_training.csv');

let cache = {
  mtimeMs: 0,
  rows: [],
};

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current);
  return cells;
}

function normalizeText(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokenMap = {
    pls: 'please',
    plz: 'please',
    u: 'you',
    ur: 'your',
    rm: 'room',
    rms: 'rooms',
    avail: 'available',
    wifii: 'wifi',
    wiifi: 'wifi',
    net: 'internet',
    reco: 'recommend',
  };

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((t) => tokenMap[t] || t)
    .join(' ');
}

function textTokens(text) {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((t) => t.length > 1),
  );
}

function bigrams(text) {
  const t = normalizeText(text).replace(/\s+/g, '');
  if (t.length < 2) return new Set([t]);
  const grams = new Set();
  for (let i = 0; i < t.length - 1; i += 1) {
    grams.add(t.slice(i, i + 2));
  }
  return grams;
}

function diceSimilarity(a, b) {
  const aa = bigrams(a);
  const bb = bigrams(b);
  if (!aa.size || !bb.size) return 0;

  let overlap = 0;
  for (const g of aa) {
    if (bb.has(g)) overlap += 1;
  }

  return (2 * overlap) / (aa.size + bb.size);
}

function levenshteinDistance(a, b) {
  const s = normalizeText(a);
  const t = normalizeText(b);
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

function scoreMatch(userText, patternText) {
  const userNorm = normalizeText(userText);
  const patternNorm = normalizeText(patternText);
  if (!userNorm || !patternNorm) return 0;
  if (userNorm === patternNorm) return 10;

  const userTokens = textTokens(userNorm);
  const patternTokens = textTokens(patternNorm);
  if (!userTokens.size || !patternTokens.size) return 0;

  let overlap = 0;
  for (const token of userTokens) {
    if (patternTokens.has(token)) overlap += 1;
  }

  const tokenRatio = overlap / Math.max(userTokens.size, patternTokens.size);
  const containsBonus = userNorm.includes(patternNorm) || patternNorm.includes(userNorm) ? 0.2 : 0;
  const dice = diceSimilarity(userNorm, patternNorm);

  let typoSimilarity = 0;
  const maxLen = Math.max(userNorm.length, patternNorm.length);
  if (maxLen <= 80) {
    const distance = levenshteinDistance(userNorm, patternNorm);
    typoSimilarity = 1 - distance / maxLen;
  }

  return tokenRatio + containsBonus + dice * 0.35 + Math.max(0, typoSimilarity) * 0.2;
}

function loadDatasetRows() {
  try {
    const stat = fs.statSync(DATASET_PATH);
    if (cache.rows.length && cache.mtimeMs === stat.mtimeMs) {
      return cache.rows;
    }

    const raw = fs.readFileSync(DATASET_PATH, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) {
      cache = { mtimeMs: stat.mtimeMs, rows: [] };
      return cache.rows;
    }

    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cells = parseCsvLine(lines[i]);
      if (cells.length < 3) continue;
      const userMessage = String(cells[0] || '').trim();
      const response = String(cells[2] || '').trim();
      if (!userMessage || !response) continue;
      rows.push({ userMessage, response });
    }

    cache = { mtimeMs: stat.mtimeMs, rows };
    return rows;
  } catch {
    return [];
  }
}

export function findDatasetReply(message) {
  const rows = loadDatasetRows();
  if (!rows.length) return null;

  let best = null;
  let bestScore = 0;

  for (const row of rows) {
    const score = scoreMatch(message, row.userMessage);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }

  if (!best || bestScore < 0.52) return null;
  return best.response;
}
