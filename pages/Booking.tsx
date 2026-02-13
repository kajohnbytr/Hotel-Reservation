import { useRef, useState, useEffect, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Room } from '../lib/store';
import { wait, generateBlockchainHash } from '../lib/utils';
import { Calendar, CreditCard, Loader2, Lock, Users } from 'lucide-react';
import { toast } from 'sonner';

interface BookingPageProps {
  room: Room;
  onConfirm: (hash: string, date: string, total: number) => void;
  onCancel: () => void;
}

export function BookingPage({ room, onConfirm, onCancel }: BookingPageProps) {
  const [step, setStep] = useState<'details' | 'processing' | 'blockchain'>('details');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [cardNumber, setCardNumber] = useState('');
  const [nights, setNights] = useState(1);
  const checkInInputRef = useRef<HTMLInputElement | null>(null);
  const checkOutInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (checkIn && checkOut) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      setNights(diffDays > 0 ? diffDays : 1);
    }
  }, [checkIn, checkOut]);

  const handleBook = async (e: FormEvent) => {
    e.preventDefault();
    if (guests > room.maxGuests) {
      toast.error(`Maximum guests for this room is ${room.maxGuests}`);
      return;
    }
    setStep('processing');
    await wait(1500);
    setStep('blockchain');
    await wait(2500);
    const hash = generateBlockchainHash();
    onConfirm(hash, checkIn, room.price * nights);
  };

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

  return (
    <div className="max-w-xl mx-auto py-16 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#0A2342]/10 shadow-xl p-8 md:p-12 rounded-2xl"
      >
        <div className="text-center mb-10 border-b border-[#0A2342]/10 pb-6">
          <h2 className="text-3xl font-serif text-[#0A2342] mb-2">Reservation</h2>
          <p className="text-[#0A2342]/60 uppercase tracking-widest text-xs">Confirm your stay details</p>
        </div>

        {step === 'details' && (
          <form onSubmit={handleBook} className="space-y-8">
            <div className="bg-[#F9F7F2] p-6 border border-[#0A2342]/5">
              <h3 className="text-[#D4AF37] font-serif text-xl mb-1">{room.name}</h3>
              <p className="text-[#0A2342]/60 text-sm mb-4">Total for {nights} night(s): <span className="text-[#0A2342] font-bold">${room.price * nights}</span></p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#0A2342] uppercase tracking-wider mb-2">Check-in</label>
                <div className="relative">
                  <label
                    htmlFor="check-in-input"
                    className="absolute left-3 top-3 cursor-pointer z-10 hover:text-[#D4AF37] transition-colors text-[#0A2342]/40"
                    onClick={() => openDatePicker(checkInInputRef.current)}
                  >
                    <Calendar className="w-4 h-4" />
                  </label>
                  <input
                    id="check-in-input"
                    type="date"
                    required
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    ref={checkInInputRef}
                    className="date-input w-full bg-white border border-[#0A2342]/20 py-3 pl-10 pr-10 text-center text-[#0A2342] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg pointer-events-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#0A2342] uppercase tracking-wider mb-2">Check-out</label>
                <div className="relative">
                  <label
                    htmlFor="check-out-input"
                    className="absolute left-3 top-3 cursor-pointer z-10 hover:text-[#D4AF37] transition-colors text-[#0A2342]/40"
                    onClick={() => openDatePicker(checkOutInputRef.current)}
                  >
                    <Calendar className="w-4 h-4" />
                  </label>
                  <input
                    id="check-out-input"
                    type="date"
                    required
                    value={checkOut}
                    min={checkIn}
                    onChange={(e) => setCheckOut(e.target.value)}
                    ref={checkOutInputRef}
                    className="date-input w-full bg-white border border-[#0A2342]/20 py-3 pl-10 pr-10 text-center text-[#0A2342] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg pointer-events-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0A2342] uppercase tracking-wider mb-2">Guests</label>
              <div className="relative">
                <Users className="absolute left-3 top-3 w-4 h-4 text-[#0A2342]/40" />
                <input
                  type="number"
                  min="1"
                  max={room.maxGuests}
                  value={guests}
                  onChange={(e) => setGuests(parseInt(e.target.value))}
                  className="w-full bg-white border border-[#0A2342]/20 py-3 pl-10 pr-4 text-[#0A2342] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
                />
              </div>
              <p className="text-[10px] text-[#0A2342]/50 mt-1 uppercase tracking-wide">Max guests: {room.maxGuests}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0A2342] uppercase tracking-wider mb-2">Payment</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-3 w-4 h-4 text-[#0A2342]/40" />
                <input
                  type="text"
                  placeholder="Card Number"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-white border border-[#0A2342]/20 py-3 pl-10 pr-4 text-[#0A2342] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 text-[#0A2342]/60 hover:text-[#0A2342] transition-colors text-sm font-bold uppercase tracking-wider rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#0A2342] text-[#F9F7F2] py-4 hover:bg-[#153a66] transition-colors uppercase tracking-widest text-xs font-bold shadow-lg rounded-lg"
              >
                Confirm
              </button>
            </div>
          </form>
        )}

        {step === 'processing' && (
          <div className="text-center py-12">
            <Loader2 className="w-10 h-10 text-[#D4AF37] animate-spin mx-auto mb-6" />
            <p className="text-[#0A2342] font-medium tracking-wide">Processing Payment...</p>
          </div>
        )}

        {step === 'blockchain' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-2 border-[#D4AF37] rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h3 className="text-lg font-bold text-[#0A2342] mb-2 uppercase tracking-wide">Secure Logging</h3>
            <p className="text-[#0A2342]/60 text-sm mb-6">Recording transaction on Testnet</p>
            <div className="bg-[#0A2342] p-3 text-[#D4AF37] font-mono text-xs overflow-hidden rounded-sm">
               Mining Block...
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
