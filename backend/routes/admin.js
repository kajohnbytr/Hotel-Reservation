import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import User from '../models/user.js';

const router = express.Router();

// List users (admin only)
router.get('/users', protect, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'firstName lastName email role createdAt').lean();
    const result = users.map((u) => ({
      id: u._id.toString(),
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      email: u.email,
      role: (u.role || 'guest').toUpperCase(),
    }));
    res.json(result);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;

