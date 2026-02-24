import express from 'express';
import Room from '../models/room.js';
import { protect } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = express.Router();

// Create room (admin only)
router.post('/', protect, requireAdmin, async (req, res) => {
  try {
    const { name, type, pricePerNight, maxGuests, description, imageUrl, amenities } = req.body;
    if (!name || !type || pricePerNight == null) {
      return res.status(400).json({ message: 'Name, type, and pricePerNight are required' });
    }
    const room = await Room.create({
      name,
      type,
      pricePerNight: Number(pricePerNight),
      maxGuests: Number(maxGuests) || 2,
      description,
      imageUrl,
      amenities: Array.isArray(amenities) ? amenities : [],
    });
    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// List rooms (for admin and public)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 }).lean();
    res.json(rooms);
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;

