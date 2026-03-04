import express from 'express';
import Room from '../models/room.js';
import AuditLog from '../models/auditLog.js';
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
    try {
      const adminName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
      await AuditLog.create({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: adminName,
        action: 'room_added',
        details: `Added room: ${name}`,
      });
    } catch (err) {
      console.error('[Audit] Failed to record room_added:', err.message);
    }
    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Update room (admin only)
router.put('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const { name, type, pricePerNight, maxGuests, description, imageUrl, amenities } = req.body;
    const update = {};
    if (name != null) update.name = name;
    if (type != null) update.type = type;
    if (pricePerNight != null) update.pricePerNight = Number(pricePerNight);
    if (maxGuests != null) update.maxGuests = Number(maxGuests);
    if (description != null) update.description = description;
    if (imageUrl != null) update.imageUrl = imageUrl;
    if (amenities != null) update.amenities = Array.isArray(amenities) ? amenities : [];

    const room = await Room.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    try {
      const adminName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
      await AuditLog.create({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: adminName,
        action: 'room_updated',
        details: `Updated room: ${room.name}`,
      });
    } catch (err) {
      console.error('[Audit] Failed to record room_updated:', err.message);
    }

    res.json(room);
  } catch (error) {
    console.error('Update room error:', error);
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

