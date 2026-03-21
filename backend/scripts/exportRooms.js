import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Room from '../models/room.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const outPath = path.resolve(backendDir, 'room-seed-check.json');

dotenv.config({ path: path.resolve(backendDir, '.env') });

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing');
    }

    await mongoose.connect(process.env.MONGO_URI);
    const rooms = await Room.find().select('name type pricePerNight maxGuests').sort({ name: 1 }).lean();

    fs.writeFileSync(
      outPath,
      JSON.stringify({ count: rooms.length, rooms }, null, 2),
      'utf8'
    );

    console.log(`Exported ${rooms.length} rooms to ${outPath}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  const errorPath = path.resolve(backendDir, 'room-seed-check.error.txt');
  fs.writeFileSync(errorPath, String(error?.stack || error?.message || error), 'utf8');
  console.error('Export failed:', error?.message || error);
  process.exit(1);
});
