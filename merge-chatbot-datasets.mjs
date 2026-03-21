import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const existingPath = path.resolve(__dirname, 'data/chatbot_training.csv');
const additionalPath = path.resolve(__dirname, 'data/aurora_chatbot_dataset_2000.csv');
const outputPath = existingPath;

const HEADER = ['user_message', 'intent', 'response'];

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

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseDataset(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const [headerLine, ...dataLines] = lines;
  const header = parseCsvLine(headerLine).map((cell) => cell.trim());
  const validHeader =
    header.length >= 3 &&
    header[0] === HEADER[0] &&
    header[1] === HEADER[1] &&
    header[2] === HEADER[2];

  if (!validHeader) {
    throw new Error(`Invalid CSV header. Expected: ${HEADER.join(',')}`);
  }

  return dataLines
    .map((line) => parseCsvLine(line))
    .filter((cells) => cells.length >= 3)
    .map((cells) => ({
      user_message: String(cells[0] ?? '').trim(),
      intent: String(cells[1] ?? '').trim(),
      response: String(cells[2] ?? '').trim(),
    }))
    .filter((row) => row.user_message && row.intent && row.response);
}

function dedupeByUserMessage(rows) {
  const seen = new Set();
  const uniqueRows = [];

  for (const row of rows) {
    const key = row.user_message.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  return uniqueRows;
}

function toCsv(rows) {
  const lines = [HEADER.join(',')];
  for (const row of rows) {
    lines.push([
      escapeCsv(row.user_message),
      escapeCsv(row.intent),
      escapeCsv(row.response),
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function mergeDatasets() {
  const [existingRaw, additionalRaw] = await Promise.all([
    fs.readFile(existingPath, 'utf8'),
    fs.readFile(additionalPath, 'utf8'),
  ]);

  const existingRows = parseDataset(existingRaw);
  const additionalRows = parseDataset(additionalRaw);

  // Keep the first occurrence of each user_message, prioritizing existing dataset rows.
  const mergedRows = dedupeByUserMessage([...existingRows, ...additionalRows]);
  const mergedCsv = toCsv(mergedRows);

  await fs.writeFile(outputPath, mergedCsv, 'utf8');

  console.log(`Merged rows written to ${outputPath}`);
  console.log(`Existing rows : ${existingRows.length}`);
  console.log(`Additional rows: ${additionalRows.length}`);
  console.log(`Final rows    : ${mergedRows.length}`);
}

mergeDatasets().catch((err) => {
  console.error('Failed to merge CSV datasets:', err.message);
  process.exit(1);
});
