import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { DayPicker } from 'react-day-picker';
import { Room } from '../lib/store';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import 'react-day-picker/dist/style.css';
import '../styles/day-picker-dark.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface OccupiedRange {
  checkIn: string;
  checkOut: string;
}

interface BookingPageProps {
  room: Room;
  onConfirm: (hash: string, checkIn: string, checkOut: string, nights: number, guests: number, total: number) => Promise<boolean>;
  onCancel: () => void;
}

/** Format date as YYYY-MM-DD in local time (avoids UTC shift). */
function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local date (so calendar selection matches the clicked day). */
function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isInRange(date: Date, checkIn: string, checkOut: string): boolean {
  const t = date.getTime();
  const start = parseLocalDate(checkIn);
  start.setHours(0, 0, 0, 0);
  const end = parseLocalDate(checkOut);
  end.setHours(23, 59, 59, 999);
  return t >= start.getTime() && t <= end.getTime();
}

export function BookingPage({ room, onConfirm, onCancel }: BookingPageProps) {
  const [step, setStep] = useState<'details' | 'processing'>('details');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [nights, setNights] = useState(1);
  const [occupiedRanges, setOccupiedRanges] = useState<OccupiedRange[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [dailyBookingsCount, setDailyBookingsCount] = useState(0);
  const [dailyBookingsLimit, setDailyBookingsLimit] = useState(2);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [limitLoading, setLimitLoading] = useState(true);

  useEffect(() => {
    const from = new Date();
    const to = new Date();
    to.setMonth(to.getMonth() + 6);
    fetch(
      `${API_BASE}/api/bookings/room/${encodeURIComponent(room.id)}/occupied-ranges?from=${toDateOnly(from)}&to=${toDateOnly(to)}`
    )
      .then((res) => (res.ok ? res.json() : { occupiedRanges: [] }))
      .then((data: { occupiedRanges?: OccupiedRange[] }) => setOccupiedRanges(data.occupiedRanges || []))
      .catch(() => setOccupiedRanges([]))
      .finally(() => setAvailabilityLoading(false));
  }, [room.id]);

  useEffect(() => {
    const token = localStorage.getItem('aurora_token');
    if (!token) {
      setLimitLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/bookings/user/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const current = Number(data?.dailyBookings?.current ?? 0);
        const limit = Number(data?.dailyBookings?.limit ?? 2);
        const canBook = Boolean(data?.dailyBookings?.canBook ?? current < limit);
        setDailyBookingsCount(current);
        setDailyBookingsLimit(limit);
        setDailyLimitReached(!canBook);
      })
      .catch(() => {
        setDailyLimitReached(false);
      })
      .finally(() => setLimitLoading(false));
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const disabledMatcher = useMemo(() => {
    return (date: Date) => {
      const t = date.getTime();
      if (t < today.getTime()) return true;
      return occupiedRanges.some((r) => isInRange(date, r.checkIn, r.checkOut));
    };
  }, [occupiedRanges, today]);

  const range = useMemo(() => {
    if (!checkIn) return undefined;
    const from = parseLocalDate(checkIn);
    if (!checkOut) return { from };
    return { from, to: parseLocalDate(checkOut) };
  }, [checkIn, checkOut]);

  useEffect(() => {
    if (checkIn && checkOut) {
      const start = parseLocalDate(checkIn);
      const end = parseLocalDate(checkOut);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setNights(diffDays > 0 ? diffDays : 1);
    }
  }, [checkIn, checkOut]);

  const overlapsOccupied = (from: string, to: string): boolean => {
    const start = parseLocalDate(from).getTime();
    const end = parseLocalDate(to).getTime();
    return occupiedRanges.some((r) => {
      const rStart = parseLocalDate(r.checkIn).getTime();
      const rEnd = parseLocalDate(r.checkOut).getTime();
      return start < rEnd && end > rStart;
    });
  };

  const handleBook = async (e: FormEvent) => {
    e.preventDefault();
    if (dailyLimitReached) {
      toast.error(`Daily reservation limit reached (${dailyBookingsLimit}/${dailyBookingsLimit}). Please try again tomorrow.`);
      return;
    }
    if (guests > room.maxGuests) {
      toast.error(`Maximum guests for this room is ${room.maxGuests}`);
      return;
    }
    if (!checkIn || !checkOut) {
      toast.error('Please select check-in and check-out dates.');
      return;
    }
    if (overlapsOccupied(checkIn, checkOut)) {
      toast.error('This room is not available for the selected dates. Please choose different dates.');
      return;
    }
    setStep('processing');

    const total = room.price * nights;
    const success = await onConfirm('', checkIn, checkOut, nights, guests, total);
    if (!success) {
      setTimeout(() => {
        setStep('details');
      }, 3000);
    }
  };

  const handleRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from) {
      setCheckIn('');
      setCheckOut('');
      return;
    }
    setCheckIn(toDateOnly(range.from));
    if (range.to) {
      setCheckOut(toDateOnly(range.to));
    } else {
      setCheckOut('');
    }
  };

  return (
    <div className="max-w-xl mx-auto py-16 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 shadow-xl p-8 md:p-12 rounded-2xl"
      >
        <div className="text-center mb-10 border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10 pb-6">
          <h2 className="text-3xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-2">Reservation</h2>
          <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/70 uppercase tracking-widest text-xs">Confirm your stay details</p>
        </div>

        {step === 'details' && (
          <form onSubmit={handleBook} className="space-y-8">
            <div className="bg-[#F9F7F2] dark:bg-[#05152a] p-6 border border-[#0A2342]/5 dark:border-[#F9F7F2]/10">
              <h3 className="text-[#D4AF37] font-serif text-xl mb-1">{room.name}</h3>
              <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/70 text-sm mb-4">Total for {nights} night(s): <span className="text-[#0A2342] dark:text-[#F9F7F2] font-bold">₱{room.price * nights}</span></p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">
                Select dates (blocked dates are already booked)
              </label>
              {availabilityLoading ? (
                <div className="flex items-center justify-center py-8 text-[#0A2342]/60 dark:text-[#F9F7F2]/70">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading availability...
                </div>
              ) : (
                <div className="flex justify-center dark:bg-[#05152a] dark:rounded-xl dark:p-4 dark:text-[#F9F7F2] [&_.rdp]:dark:!text-[#F9F7F2] [&_.rdp_button]:dark:!text-[#F9F7F2] [&_.rdp_caption_label]:dark:!text-[#F9F7F2] [&_.rdp_head_cell]:dark:!text-[#F9F7F2]/80 [&_.rdp-day]:dark:!text-[#F9F7F2] [&_.rdp-nav]:dark:!text-[#F9F7F2] [&_.rdp-day_disabled]:opacity-40 [&_.rdp-day_disabled]:cursor-not-allowed [&_.rdp-day_disabled]:line-through [&_.rdp-day_selected]:bg-[#D4AF37] [&_.rdp-day_selected]:text-[#0A2342] [&_.rdp-day_today]:font-bold [&_.rdp-day_today]:text-[#D4AF37]">
                  <DayPicker
                    mode="range"
                    selected={range}
                    onSelect={handleRangeSelect}
                    disabled={disabledMatcher}
                    defaultMonth={today}
                    numberOfMonths={1}
                  />
                </div>
              )}
              {checkIn && (
                <p className="text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/80 mt-2 text-center">
                  Check-in: <strong>{checkIn}</strong>
                  {checkOut && (
                    <> · Check-out: <strong>{checkOut}</strong></>
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">Guests</label>
              <div className="relative">
                <Users className="absolute left-3 top-3 w-4 h-4 text-[#0A2342]/40 dark:text-[#F9F7F2]/50" />
                <input
                  type="number"
                  min="1"
                  max={room.maxGuests}
                  value={guests}
                  onChange={(e) => setGuests(parseInt(e.target.value))}
                  className="w-full bg-white dark:bg-[#05152a] border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 py-3 pl-10 pr-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
                />
              </div>
              <p className="text-[10px] text-[#0A2342]/50 dark:text-[#F9F7F2]/60 mt-1 uppercase tracking-wide">Max guests: {room.maxGuests}</p>
            </div>

            <p className="text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/70">
              Your reservation may be recorded on the blockchain for a tamper-proof record. No payment is collected here—this is reservation only.
            </p>

            {limitLoading ? (
              <p className="text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/70">
                Checking daily booking limit...
              </p>
            ) : dailyLimitReached ? (
              <p className="text-xs text-[#B42318] dark:text-[#F59E8B] font-semibold">
                You already used {dailyBookingsCount}/{dailyBookingsLimit} reservations today. Confirm reservation is locked until tomorrow.
              </p>
            ) : (
              <p className="text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/70">
                Today: {dailyBookingsCount}/{dailyBookingsLimit} reservations used.
              </p>
            )}

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 text-[#0A2342]/60 dark:text-[#F9F7F2]/70 hover:text-[#F9F7F2] dark:hover:text-[#F9F7F2] transition-colors text-sm font-bold uppercase tracking-wider rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dailyLimitReached || limitLoading}
                className="flex-1 bg-[#0A2342] dark:bg-[#D4AF37] text-[#F9F7F2] dark:text-[#F9F7F2] py-4 hover:bg-[#153a66] dark:hover:bg-[#C99E2E] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#0A2342] dark:disabled:hover:bg-[#D4AF37] transition-colors uppercase tracking-widest text-xs font-bold shadow-lg rounded-lg"
              >
                Confirm reservation
              </button>
            </div>
          </form>
        )}

        {step === 'processing' && (
          <div className="text-center py-12">
            <Loader2 className="w-10 h-10 text-[#D4AF37] animate-spin mx-auto mb-6" />
            <p className="text-[#0A2342] dark:text-[#F9F7F2] font-medium tracking-wide">Confirming reservation...</p>
          </div>
        )}

      </motion.div>
    </div>
  );
}
