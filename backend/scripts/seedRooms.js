import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Room from '../models/room.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const ROOM_CATALOG = [
  {
    name: 'Serenity Standard',
    type: 'standard',
    pricePerNight: 150,
    maxGuests: 2,
    description: 'A minimalist retreat designed for peace of mind. Features natural light and organic textures.',
    imageUrl: 'https://images.unsplash.com/photo-1763419161907-1e00b2f883c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    amenities: ['Queen Bed', 'Rain Shower', 'Garden View', 'Wi-Fi'],
  },
  {
    name: 'Horizon Deluxe',
    type: 'deluxe',
    pricePerNight: 280,
    maxGuests: 2,
    description: 'Spacious elegance with panoramic windows overlooking the landscape. Includes a private workspace.',
    imageUrl: 'https://images.unsplash.com/photo-1758448511255-ac2a24a135d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    amenities: ['King Bed', 'Soaking Tub', 'Work Desk', 'Balcony', 'Minibar'],
  },
  {
    name: 'Aurora Royal Suite',
    type: 'suite',
    pricePerNight: 550,
    maxGuests: 4,
    description: 'The pinnacle of luxury. Private terrace, dedicated lounge area, and premium concierge service.',
    imageUrl: 'https://images.unsplash.com/photo-1653151248308-14baf1a224eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    amenities: ['Private Terrace', 'Lounge', 'Butler Service', 'Jacuzzi', 'Welcome Gift'],
  },
  {
    name: 'Lakeside Villa',
    type: 'villa',
    pricePerNight: 850,
    maxGuests: 6,
    description: 'Exclusive villa on the water\'s edge. Features a private dock and floor-to-ceiling glass walls.',
    imageUrl: 'https://images.unsplash.com/photo-1761240960690-4d2cd3c93911?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsYWtlc2lkZSUyMHZpbGxhJTIwYXJjaGl0ZWN0dXJlfGVufDF8fHx8MTc2ODc2MTk3M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    amenities: ['Private Dock', 'Infinity Edge', 'Full Kitchen', 'Master Suite', 'Fireplace'],
  },
  {
    name: 'Forest Cabin',
    type: 'cabin',
    pricePerNight: 320,
    maxGuests: 2,
    description: 'Secluded luxury amidst the trees. Sustainable design with a wood-burning stove and skylights.',
    imageUrl: 'https://images.unsplash.com/photo-1736796310381-d5c82ce99826?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmb3Jlc3QlMjBjYWJpbiUyMGludGVyaW9yJTIwbWluaW1hbGlzdHxlbnwxfHx8fDE3Njg3NjE5NzN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    amenities: ['Wood Stove', 'Skylights', 'Forest View', 'Outdoor Deck', 'Rain Shower'],
  },
  {
    name: 'Aurora Penthouse',
    type: 'suite',
    pricePerNight: 1200,
    maxGuests: 4,
    description: 'The ultimate urban sanctuary atop the hotel. 360-degree views, private elevator, and chef\'s kitchen.',
    imageUrl: 'https://images.unsplash.com/photo-1682662046610-fbdb3db4bd74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBwZW50aG91c2UlMjBzdWl0ZSUyMGxpdmluZyUyMHJvb218ZW58MXx8fHwxNzY4NzYxOTczfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    amenities: ['Private Elevator', 'Chef Kitchen', '360 Views', 'Grand Piano', 'Personal Spa'],
  },
];

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set in backend/.env');
  }

  await mongoose.connect(mongoUri);

  let upserted = 0;
  for (const room of ROOM_CATALOG) {
    await Room.findOneAndUpdate(
      { name: room.name },
      { $set: room },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    upserted += 1;
  }

  const totalRooms = await Room.countDocuments({});
  console.log(`Seeded/updated ${upserted} rooms. Total rooms in DB: ${totalRooms}`);

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('Room seed failed:', error.message || error);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore disconnect error
    }
    process.exit(1);
  });
