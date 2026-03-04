import express from 'express';
import Booking from '../models/booking.js';
import AuditLog from '../models/auditLog.js';
import { protect } from '../middleware/auth.js';
import { recordBookingOnChain } from '../blockchain.js';

const router = express.Router();

// Reservation limit configuration
const MAX_CONCURRENT_BOOKINGS = parseInt(process.env.MAX_CONCURRENT_BOOKINGS || '3', 10);
const MAX_BOOKINGS_PER_DAY = parseInt(process.env.MAX_BOOKINGS_PER_DAY || '2', 10);

// List bookings (for reception; optional search)
router.get('/', protect, async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim();
    const query = {};
    if (search) {
      query.$or = [
        { guestName: { $regex: search, $options: 'i' } },
        { roomName: { $regex: search, $options: 'i' } },
      ];
    }
    const bookings = await Booking.find(query)
      .sort({ checkIn: -1 })
      .lean();
    if (req.user && req.user.role === 'staff') {
      try {
        const staffName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
        await AuditLog.create({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: staffName,
          role: 'staff',
          action: 'staff_viewed_reservations',
          details: search ? `Viewed reservations (search: ${search})` : 'Viewed reservations list',
        });
      } catch (err) {
        console.error('[Audit] staff_viewed_reservations:', err.message);
      }
    }
    const list = bookings.map((b) => ({
      id: b._id.toString(),
      guestName: b.guestName,
      room: b.roomName,
      checkIn: b.checkIn.toISOString().split('T')[0],
      checkOut: b.checkOut.toISOString().split('T')[0],
      nights: b.nights,
      guests: b.guests,
      total: b.total,
      txHash: b.txHash || '',
    }));
    res.json(list);
  } catch (error) {
    console.error('List bookings error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Create booking (guest makes reservation)
router.post('/', protect, async (req, res) => {
  console.log('POST /api/bookings body', req.body, 'user', req.user && req.user._id);
  try {
    const { guestName, roomId, roomName, checkIn, checkOut, nights, guests, total, txHash: clientTxHash } = req.body;
    if (!guestName || !roomId || !roomName || !checkIn || !checkOut || nights == null || total == null) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const overlapping = await Booking.findOne({
      roomId,
      status: 'confirmed',
      checkIn: { $lt: checkOutDate },
      checkOut: { $gt: checkInDate },
    });
    if (overlapping) {
      return res.status(409).json({ message: 'This room is not available for the selected dates. Please choose different dates.' });
    }

    // Check concurrent bookings limit
    const concurrentBookings = await Booking.countDocuments({
      userId: req.user._id,
      status: 'confirmed',
      checkIn: { $lt: checkOutDate },
      checkOut: { $gt: checkInDate },
    });
    if (concurrentBookings >= MAX_CONCURRENT_BOOKINGS) {
      return res.status(429).json({ 
        message: `You can only have up to ${MAX_CONCURRENT_BOOKINGS} concurrent reservations. Please cancel an existing booking before making a new one.` 
      });
    }

    // Check daily bookings limit
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const dailyBookings = await Booking.countDocuments({
      userId: req.user._id,
      status: 'confirmed',
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    if (dailyBookings >= MAX_BOOKINGS_PER_DAY) {
      return res.status(429).json({ 
        message: `You have reached the maximum of ${MAX_BOOKINGS_PER_DAY} bookings per day. Please try again tomorrow.` 
      });
    }

    const bookingData = {
      guestName,
      roomId,
      roomName,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights: Number(nights),
      guests: Number(guests) || 1,
      total: Number(total),
      userId: req.user._id,
    };
    if (clientTxHash && typeof clientTxHash === 'string' && clientTxHash.trim()) {
      bookingData.txHash = clientTxHash.trim();
    }
    const booking = await Booking.create(bookingData);

    try {
      const guestName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
      const checkInStr = checkInDate.toISOString().split('T')[0];
      const checkOutStr = checkOutDate.toISOString().split('T')[0];
      await AuditLog.create({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: guestName,
        role: 'guest',
        action: 'guest_booking',
        details: `Reservation: ${roomName}, ${checkInStr} to ${checkOutStr} (${nights} night(s))`,
      });
      console.log('[Audit] guest_booking recorded for', req.user.email);
    } catch (err) {
      console.error('[Audit] guest_booking:', err.message);
    }

    // Only record on-chain if the client did not already send a txHash
    if (!bookingData.txHash) {
      recordBookingOnChain({
        guestName: booking.guestName,
        roomName: booking.roomName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        total: booking.total,
      }).then(async (txHash) => {
        if (txHash) {
          console.log('Booking recorded on chain, tx=', txHash);
          try {
            booking.txHash = txHash;
            await booking.save();
          } catch (err) {
            console.error('Failed to save txHash in booking record', err);
          }
        }
      }).catch((err) => {
        console.error('Failed to record booking on chain', err);
      });
    }
    res.status(201).json({
      id: booking._id.toString(),
      guestName: booking.guestName,
      room: booking.roomName,
      checkIn: booking.checkIn.toISOString().split('T')[0],
      checkOut: booking.checkOut.toISOString().split('T')[0],
      nights: booking.nights,
      guests: booking.guests,
      total: booking.total,
      txHash: booking.txHash || '',
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Occupied date ranges for a specific room (so calendar can block those dates). Public so guests can see availability.
router.get('/room/:roomId/occupied-ranges', async (req, res) => {
  try {
    const { roomId } = req.params;
    const from = req.query.from; // optional YYYY-MM-DD
    const to = req.query.to;   // optional YYYY-MM-DD
    const query = { roomId, status: 'confirmed' };
    if (from && to) {
      query.checkIn = { $lt: new Date(to) };
      query.checkOut = { $gt: new Date(from) };
    }
    const bookings = await Booking.find(query)
      .select('checkIn checkOut')
      .lean();
    const occupiedRanges = bookings.map((b) => ({
      checkIn: b.checkIn.toISOString().split('T')[0],
      checkOut: b.checkOut.toISOString().split('T')[0],
    }));
    res.json({ occupiedRanges });
  } catch (error) {
    console.error('Occupied ranges error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Room availability for a date (which roomIds are occupied)
router.get('/availability', protect, async (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr) return res.status(400).json({ message: 'Query date required' });
    const day = new Date(dateStr);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const occupied = await Booking.find({
      status: 'confirmed',
      checkIn: { $lt: nextDay },
      checkOut: { $gt: day },
    })
      .distinct('roomId')
      .lean();
    if (req.user && req.user.role === 'staff') {
      try {
        const staffName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
        await AuditLog.create({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: staffName,
          role: 'staff',
          action: 'staff_viewed_availability',
          details: `Viewed room availability for ${dateStr}`,
        });
      } catch (err) {
        console.error('[Audit] staff_viewed_availability:', err.message);
      }
    }
    res.json({ occupiedRoomIds: occupied });
  } catch (error) {
    console.error('Availability error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get user's booking limits and current usage
router.get('/user/stats', protect, async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Count concurrent bookings (overlapping with today)
    const concurrentCount = await Booking.countDocuments({
      userId: req.user._id,
      status: 'confirmed',
      checkIn: { $lt: now },
      checkOut: { $gt: now },
    });

    // Count bookings made today
    const dailyCount = await Booking.countDocuments({
      userId: req.user._id,
      status: 'confirmed',
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    res.json({
      concurrentBookings: {
        current: concurrentCount,
        limit: MAX_CONCURRENT_BOOKINGS,
        canBook: concurrentCount < MAX_CONCURRENT_BOOKINGS,
      },
      dailyBookings: {
        current: dailyCount,
        limit: MAX_BOOKINGS_PER_DAY,
        canBook: dailyCount < MAX_BOOKINGS_PER_DAY,
      },
    });
  } catch (error) {
    console.error('Booking stats error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
