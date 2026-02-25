import express from 'express';
import Booking from '../models/booking.js';
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
    const { guestName, roomId, roomName, checkIn, checkOut, nights, guests, total } = req.body;
    if (!guestName || !roomId || !roomName || !checkIn || !checkOut || nights == null || total == null) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const booking = await Booking.create({
      guestName,
      roomId,
      roomName,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      nights: Number(nights),
      guests: Number(guests) || 1,
      total: Number(total),
      userId: req.user._id,
    });

    // attempt on-chain record asynchronously and save txHash if available
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
    res.json({ occupiedRoomIds: occupied });
  } catch (error) {
    console.error('Availability error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
