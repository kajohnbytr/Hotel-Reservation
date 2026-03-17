import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import User from '../models/user.js';
import AuditLog from '../models/auditLog.js';

const router = express.Router();

// Create staff account (admin only)
router.post('/create-staff', protect, requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'firstName, lastName, email, and password are required' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create new staff user
    const staff = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'staff',
    });

    // Log the action
    try {
      const adminName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
      await AuditLog.create({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: adminName,
        role: 'admin',
        action: 'admin_created_staff',
        details: `Created staff account for ${email}`,
      });
      console.log('[Audit] admin_created_staff recorded for', req.user.email);
    } catch (err) {
      console.error('[Audit] admin_created_staff:', err.message);
    }

    res.status(201).json({
      message: 'Staff account created successfully',
      staff: {
        id: staff._id.toString(),
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        role: staff.role,
      },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

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

// Get online users (admin only) – users active in the last 15 minutes
router.get('/online-users', protect, requireAdmin, async (req, res) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const allUsers = await User.find({}, 'firstName lastName email role lastLogin lastActivity isOnline').lean();
    
    const result = allUsers.map((u) => {
      const lastActivityDate = u.lastActivity ? new Date(u.lastActivity) : null;
      const minutesAgo = lastActivityDate ? Math.floor((Date.now() - lastActivityDate) / 60000) : null;

      // A user is considered online only if explicitly marked online AND activity is recent
      const isOnline = !!u.isOnline && !!lastActivityDate && lastActivityDate >= fifteenMinutesAgo;
      
      return {
        id: u._id.toString(),
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        email: u.email,
        role: (u.role || 'guest').toUpperCase(),
        lastLogin: u.lastLogin ? new Date(u.lastLogin).toISOString() : null,
        lastActivity: u.lastActivity ? new Date(u.lastActivity).toISOString() : null,
        minutesAgo,
        isOnline,
      };
    });
    
    res.json({
      onlineCount: result.filter(u => u.isOnline).length,
      users: result.sort((a, b) => (new Date(b.lastActivity || 0).getTime() - new Date(a.lastActivity || 0).getTime())),
    });
  } catch (error) {
    console.error('Online users error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get user activity summary (admin only)
router.get('/user-activity/:userId', protect, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId, 'firstName lastName email role lastLogin lastActivity').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const now = new Date();
    const lastActivityDate = user.lastActivity ? new Date(user.lastActivity) : null;
    const minutesSinceActivity = lastActivityDate ? Math.floor((now - lastActivityDate) / 60000) : null;
    const isOnline = minutesSinceActivity !== null && minutesSinceActivity <= 15;
    
    res.json({
      id: user._id.toString(),
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      email: user.email,
      role: (user.role || 'guest').toUpperCase(),
      lastLogin: user.lastLogin ? new Date(user.lastLogin).toISOString() : null,
      lastActivity: user.lastActivity ? new Date(user.lastActivity).toISOString() : null,
      minutesSinceActivity,
      isOnline,
    });
  } catch (error) {
    console.error('User activity error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Delete user (admin only) - can only delete guest or staff, not admin
router.delete('/users/:userId', protect, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user to delete
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting admin accounts
    if (userToDelete.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin accounts' });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    // Log the action
    try {
      const adminName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
      const deletedUserName = [userToDelete.firstName, userToDelete.lastName].filter(Boolean).join(' ') || userToDelete.email;
      await AuditLog.create({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: adminName,
        role: 'admin',
        action: 'admin_deleted_user',
        details: `Deleted ${userToDelete.role} account for ${deletedUserName} (${userToDelete.email})`,
      });
      console.log('[Audit] admin_deleted_user recorded for', req.user.email);
    } catch (err) {
      console.error('[Audit] admin_deleted_user:', err.message);
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;

