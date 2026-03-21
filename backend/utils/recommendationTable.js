import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATASET_PATH = path.resolve(__dirname, '../../data/room_recommendation_training.csv');

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

function loadRows() {
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
      if (cells.length < 5) continue;

      const guests = Number(cells[0]);
      const nights = Number(cells[1]);
      const budgetMin = Number(cells[2]);
      const budgetMax = Number(cells[3]);
      const roomType = String(cells[4] || '').trim().toLowerCase();

      if (!Number.isFinite(guests) || !Number.isFinite(nights) || !Number.isFinite(budgetMin) || !Number.isFinite(budgetMax)) {
        continue;
      }
      if (!roomType) continue;

      rows.push({
        guests,
        nights,
        budgetMin,
        budgetMax,
        roomType,
      });
    }

    cache = { mtimeMs: stat.mtimeMs, rows };
    return cache.rows;
  } catch {
    return [];
  }
}

function distanceToRange(value, min, max) {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

export function recommendRoomTypeFromCsv({ guests, nights, budget }) {
  const rows = loadRows();
  if (!rows.length) return null;

  const g = Number(guests);
  const n = Number(nights);
  const b = Number(budget);

  if (!Number.isFinite(g) || !Number.isFinite(b)) return null;
  const nSafe = Number.isFinite(n) ? n : 1;

  const byGuests = rows.filter((r) => r.guests === g);
  if (!byGuests.length) return null;

  const exactRange = byGuests
    .filter((r) => b >= r.budgetMin && b <= r.budgetMax)
    .sort((a, b2) => Math.abs(a.nights - nSafe) - Math.abs(b2.nights - nSafe));
  if (exactRange.length) return exactRange[0].roomType;

  const nearest = [...byGuests].sort((a, b2) => {
    const aBudgetDist = distanceToRange(b, a.budgetMin, a.budgetMax);
    const bBudgetDist = distanceToRange(b, b2.budgetMin, b2.budgetMax);
    if (aBudgetDist !== bBudgetDist) return aBudgetDist - bBudgetDist;
    return Math.abs(a.nights - nSafe) - Math.abs(b2.nights - nSafe);
  });

  return nearest[0]?.roomType || null;
}
