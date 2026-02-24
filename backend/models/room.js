import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    pricePerNight: { type: Number, required: true },
    maxGuests: { type: Number, required: true, default: 2 },
    description: { type: String },
    imageUrl: { type: String },
    amenities: [{ type: String }],
  },
  { timestamps: true }
);

const Room = mongoose.model('Room', roomSchema);
export default Room;

