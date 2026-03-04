import express from 'express';
import Booking from '../models/booking.js';
import AuditLog from '../models/auditLog.js';
import { protect } from '../middleware/auth.js';
import { recordBookingOnChain } from '../blockchain.js';

const router = express.Router();

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
          userName: staffName || req.user.email,
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
      const userEmail = (req.user.email && String(req.user.email).trim()) || 'unknown';
      const guestName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || userEmail;
      const checkInStr = checkInDate.toISOString().split('T')[0];
      const checkOutStr = checkOutDate.toISOString().split('T')[0];
      const creatorRole = (req.user.role === 'admin' || req.user.role === 'staff') ? req.user.role : 'guest';
      await AuditLog.create({
        userId: req.user._id,
        userEmail,
        userName: guestName,
        role: creatorRole,
        action: 'guest_booking',
        details: `Reservation: ${roomName}, ${checkInStr} to ${checkOutStr} (${nights} night(s))`,
      });
    } catch (err) {
      console.error('[Audit] guest_booking:', err.message, err);
    }

    // Record on-chain if the client did not already send a txHash; wait so response includes real txHash
    if (!bookingData.txHash) {
      try {
        const txHash = await recordBookingOnChain({
          guestName: booking.guestName,
          roomName: booking.roomName,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          total: booking.total,
        });
        if (txHash) {
          console.log('Booking recorded on chain, tx=', txHash);
          booking.txHash = txHash;
          await booking.save();
        }
      } catch (err) {
        console.error('Failed to record booking on chain', err);
      }
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
          userName: staffName || req.user.email,
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

export default router;
