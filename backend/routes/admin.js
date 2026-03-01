import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import User from '../models/user.js';
import AuditLog from '../models/auditLog.js';

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

// List audit logs (admin only) – for backtracking
router.get('/audit', protect, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const roleFilter = req.query.role; // 'guest' | 'staff' | 'admin'
    const query = roleFilter && ['guest', 'staff', 'admin'].includes(roleFilter) ? { role: roleFilter } : {};
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(logs);
  } catch (error) {
    console.error('Audit list error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Create audit log entry (admin only) – called by frontend for view/tab events
router.post('/audit', protect, requireAdmin, async (req, res) => {
  try {
    const { action, details } = req.body;
    if (!action || typeof action !== 'string') {
      return res.status(400).json({ message: 'action is required' });
    }
    const userName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
    const log = await AuditLog.create({
      userId: req.user._id,
      userEmail: req.user.email,
      userName,
      role: 'admin',
      action: action.trim().slice(0, 100),
      details: details != null ? String(details).slice(0, 500) : '',
    });
    console.log('[Audit]', action, 'recorded for', req.user.email);
    res.status(201).json(log);
  } catch (error) {
    console.error('[Audit] Create error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;

