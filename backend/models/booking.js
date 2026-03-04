import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    guestName: { type: String, required: true },
    roomId: { type: String, required: true },
    roomName: { type: String, required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true },
    guests: { type: Number, required: true, default: 1 },
    total: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['confirmed', 'cancelled', 'pending_cancel'], default: 'confirmed' },
    txHash: String,
  },
  { timestamps: true }
);

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
