import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    pricePerNight: { type: Number, required: true, min: 0.01, max: 50000 },
    maxGuests: {
      type: Number,
      required: true,
      default: 2,
      min: 1,
      max: 20,
      validate: {
        validator: Number.isInteger,
        message: 'maxGuests must be an integer',
      },
    },
    description: { type: String },
    imageUrl: { type: String },
    amenities: [{ type: String }],
  },
  { timestamps: true }
);

const Room = mongoose.model('Room', roomSchema);
export default Room;

