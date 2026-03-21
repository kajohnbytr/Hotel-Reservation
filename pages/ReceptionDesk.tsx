import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Room } from '../lib/store';
import { getApiBaseUrl } from '../lib/api';
import { getAuthItem } from '../lib/authSession';
import { toast } from 'sonner';

const API_BASE = getApiBaseUrl();

interface Reservation {
  id: string;
  guestName: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  total: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'pending_cancel';
}

interface RoomStatus {
  roomId: string;
  name: string;
  type: string;
  image: string;
  status: 'available' | 'occupied';
}

export function ReceptionDesk({ rooms }: { rooms: Room[] }) {
  const [activeTab, setActiveTab] = useState<'reservations' | 'room-availability'>('reservations');
  const [searchQuery, setSearchQuery] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [occupiedRoomIds, setOccupiedRoomIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const token = getAuthItem('aurora_token');

  useEffect(() => {
    if (!token) {
      setReservations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const abort = new AbortController();
    fetch(`${API_BASE}/api/bookings?search=${encodeURIComponent(searchQuery)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: abort.signal,
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!Array.isArray(data)) {
          setReservations([]);
          return;
        }
        const mapped: Reservation[] = data.map((b: any) => ({
          id: b.id,
          guestName: b.guestName,
          room: b.roomName || b.room,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          nights: b.nights,
          guests: b.guests,
          total: b.total,
          status: b.status || 'confirmed',
        }));
        setReservations(mapped);
      })
      .catch(() => setReservations([]))
      .finally(() => setLoading(false));
    return () => abort.abort();
  }, [token, searchQuery]);

  const handleApproveCancellation = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || 'Could not confirm cancellation.');
        return;
      }
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r))
      );
      toast.success('Cancellation confirmed.');
    } catch (error) {
      console.error('Approve cancellation error:', error);
      toast.error('Could not confirm cancellation. Please try again.');
    }
  };

  const handleConfirmBooking = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${encodeURIComponent(id)}/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || 'Could not confirm booking.');
        return;
      }
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'confirmed' } : r))
      );
      toast.success('Booking confirmed.');
    } catch (error) {
      console.error('Confirm booking error:', error);
      toast.error('Could not confirm booking. Please try again.');
    }
  };

  const toLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    if (!token || activeTab !== 'room-availability') {
      setOccupiedRoomIds([]);
      return;
    }
    const dateStr = toLocalDateString(selectedDate);
    fetch(`${API_BASE}/api/bookings/availability?date=${dateStr}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setOccupiedRoomIds(data.occupiedRoomIds || []))
      .catch(() => setOccupiedRoomIds([]));
  }, [token, activeTab, selectedDate]);

  const roomStatuses: RoomStatus[] = rooms.map((room) => ({
    roomId: room.id,
    name: room.name,
    type: room.type.toUpperCase(),
    image: room.image,
    status: occupiedRoomIds.includes(room.id) ? 'occupied' : 'available',
  }));

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const monthDays = getDaysInMonth(selectedDate);
  const firstDay = getFirstDayOfMonth(selectedDate);
  const calendarDays: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: monthDays }, (_, i) => i + 1),
  ];
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];
  calendarDays.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const previousMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1));
  const nextMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1));

  const formatDateHeader = (d: Date) =>
    `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0A2342] pt-24 px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0A2342] dark:text-[#F9F7F2] mb-1">
            Reception Desk
          </h1>
          <p className="text-sm text-[#0A2342]/60 dark:text-[#F9F7F2]/70 uppercase tracking-widest">
            Manage Reservations & Guests
          </p>
        </div>

        {/* Tabs + Search row (reference: Reservations selected = dark blue, search on right) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex rounded-lg overflow-hidden border border-[#0A2342]/10 dark:border-[#F9F7F2]/10">
            <button
              type="button"
              onClick={() => setActiveTab('reservations')}
              className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
                activeTab === 'reservations'
                  ? 'bg-[#0A2342] text-[#F9F7F2] dark:bg-[#153a66]'
                  : 'bg-white dark:bg-[#05152a] text-[#0A2342] dark:text-[#F9F7F2] hover:bg-[#F5F0E8] dark:hover:bg-[#0A2342]/50'
              }`}
            >
              Reservations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('room-availability')}
              className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
                activeTab === 'room-availability'
                  ? 'bg-[#0A2342] text-[#F9F7F2] dark:bg-[#153a66]'
                  : 'bg-white dark:bg-[#05152a] text-[#0A2342] dark:text-[#F9F7F2] hover:bg-[#F5F0E8] dark:hover:bg-[#0A2342]/50'
              }`}
            >
              Room Availability
            </button>
          </div>

          {activeTab === 'reservations' && (
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0A2342]/40 dark:text-[#F9F7F2]/40" />
              <input
                type="text"
                placeholder="Search Name, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 text-[#0A2342] dark:text-[#F9F7F2] placeholder-[#0A2342]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2342]/30 dark:focus:ring-[#D4AF37]/30"
              />
            </div>
          )}
        </div>

        {activeTab === 'reservations' && (
          <div className="bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0A2342] text-[#F9F7F2]">
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest">Guest Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest">Room</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest">Check-in</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest">Check-out</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest">Nights</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest">Guests</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest">Total</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-[#0A2342]/60 dark:text-[#F9F7F2]/60">
                        Loading...
                      </td>
                    </tr>
                  ) : reservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-[#0A2342]/60 dark:text-[#F9F7F2]/60">
                        No reservations found matching your search.
                      </td>
                    </tr>
                  ) : (
                    reservations.map((res) => (
                      <tr
                        key={res.id}
                        className="border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/10 hover:bg-[#F9F7F2]/50 dark:hover:bg-[#0A2342]/30"
                      >
                        <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2] font-medium">{res.guestName}</td>
                        <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">{res.room}</td>
                        <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">{res.checkIn}</td>
                        <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">{res.checkOut}</td>
                        <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">{res.nights}</td>
                        <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">{res.guests}</td>
                      <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2] font-semibold">
                        ₱{Number(res.total).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">
                        {res.status === 'cancelled' ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            Cancelled
                          </span>
                        ) : res.status === 'pending_cancel' ? (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                            Pending cancel
                          </span>
                        ) : res.status === 'pending' ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            Pending approval
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                            Confirmed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">
                        {res.status === 'pending_cancel' ? (
                          <button
                            type="button"
                            onClick={() => handleApproveCancellation(res.id)}
                            className="inline-flex items-center rounded-md border border-red-400 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-red-700 hover:bg-red-500/10"
                          >
                            Confirm cancel
                          </button>
                        ) : res.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => handleConfirmBooking(res.id)}
                            className="inline-flex items-center rounded-md border border-emerald-500 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 hover:bg-emerald-500/10"
                          >
                            Confirm booking
                          </button>
                        ) : (
                          <span className="text-xs text-[#0A2342]/50 dark:text-[#F9F7F2]/50">—</span>
                        )}
                      </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'room-availability' && (
          <div className="flex flex-col md:flex-row md:justify-between gap-8 items-start">
            <div className="flex-shrink-0">
              <div className="w-full max-w-md bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-xl p-8">
                <h3 className="text-base font-semibold text-[#0A2342] dark:text-[#F9F7F2] mb-5">Select Date</h3>
                <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#F9F7F2]/20 bg-[#F9FBFF] dark:bg-[#0A2342] px-8 py-5 text-[#0A2342] dark:text-[#F9F7F2]">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={previousMonth}
                      className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37] p-1.5"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <span className="text-base font-semibold text-[#0A2342] dark:text-[#F9F7F2]">
                      {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                    </span>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37] p-1.5"
                    >
                      <ChevronRight size={22} />
                    </button>
                  </div>
                  <table className="w-full text-center text-sm">
                    <thead>
                      <tr>
                        {dayNames.map((day) => (
                          <th
                            key={day}
                            className="pb-2 font-semibold text-xs text-[#0A2342] dark:text-[#F9F7F2]"
                          >
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((week, wi) => (
                        <tr key={wi}>
                          {week.map((day, di) => (
                            <td key={di} className="py-1">
                              {day === null ? (
                                <span className="inline-block h-10 w-10" />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedDate(
                                      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day)
                                    )
                                  }
                                  className={`h-10 w-10 inline-flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                                    day === selectedDate.getDate()
                                      ? 'bg-[#0A2342] text-[#F9F7F2] dark:bg-[#153a66]'
                                      : 'text-[#0A2342] dark:text-[#F9F7F2] hover:bg-[#0A2342]/10 dark:hover:bg-[#F9F7F2]/10'
                                  }`}
                                >
                                  {day}
                                </button>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/10 mt-5 pt-4 flex justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500" />
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500" />
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">Occupied</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full md:max-w-lg">
              <h3 className="text-xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">
                Room Status for {formatDateHeader(selectedDate)}
              </h3>
              <div className="space-y-5">
                {roomStatuses.map((room) => (
                  <div
                    key={room.roomId}
                    className={`rounded-lg p-5 flex items-center justify-between border ${
                      room.status === 'available'
                        ? 'bg-[#E8F5E9] dark:bg-[#0A2342]/40 border-green-200 dark:border-green-900/30'
                        : 'bg-[#FFEBEE] dark:bg-[#3d1f1f]/40 border-red-200 dark:border-red-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <img src={room.image} alt={room.name} className="w-20 h-20 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-serif text-[#0A2342] dark:text-[#F9F7F2] font-semibold text-lg truncate">
                          {room.name}
                        </h4>
                        <p className="text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/60 uppercase tracking-widest">
                          {room.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-end">
                        <span
                          className={`text-sm font-bold ${
                            room.status === 'available' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {room.status === 'available' ? 'Available' : 'Occupied'}
                        </span>
                        {room.status === 'available' && (
                          <span className="text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/60">Ready for check-in</span>
                        )}
                      </div>
                      {room.status === 'available' ? (
                        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-red-500 dark:border-red-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReceptionDesk;
