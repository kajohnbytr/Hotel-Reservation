import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { ROOMS } from '../lib/store';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Reservation {
  id: string;
  guestName: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  total: number;
}

interface RoomStatus {
  roomId: string;
  name: string;
  type: string;
  image: string;
  status: 'available' | 'occupied';
}

interface GuestRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'reservations' | 'availability' | 'guests' | 'add-room'>('reservations');
  const [searchQuery, setSearchQuery] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [occupiedRoomIds, setOccupiedRoomIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 1, 20));
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [roomForm, setRoomForm] = useState({
    name: '',
    type: '',
    pricePerNight: '',
    maxGuests: '',
    description: '',
    imageUrl: '',
    amenityInput: '',
    amenities: [] as string[],
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('aurora_token') : null;

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
      .then((data) => setReservations(Array.isArray(data) ? data : []))
      .catch(() => setReservations([]))
      .finally(() => setLoading(false));
    return () => abort.abort();
  }, [token, searchQuery]);

  const toLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    if (!token || activeTab !== 'availability') {
      setOccupiedRoomIds([]);
      return;
    }
    const dateStr = toLocalDateString(selectedDate);
    fetch(`${API_BASE}/api/bookings/availability?date=${dateStr}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : { occupiedRoomIds: [] }))
      .then((data: { occupiedRoomIds?: string[] }) => setOccupiedRoomIds(data.occupiedRoomIds || []))
      .catch(() => setOccupiedRoomIds([]));
  }, [token, activeTab, selectedDate]);

  useEffect(() => {
    if (!token || activeTab !== 'guests') {
      return;
    }
    fetch(`${API_BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setGuests(Array.isArray(data) ? data : []))
      .catch(() => setGuests([]));
  }, [token, activeTab]);

  const roomStatuses: RoomStatus[] = ROOMS.map((room) => ({
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

  const filteredGuests = guests.filter((g) => {
    const q = guestSearch.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q)
    );
  });

  const handleAddAmenity = () => {
    const value = roomForm.amenityInput.trim();
    if (!value) return;
    if (roomForm.amenities.includes(value)) return;
    setRoomForm((prev) => ({
      ...prev,
      amenities: [...prev.amenities, value],
      amenityInput: '',
    }));
  };

  const handleSubmitRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: roomForm.name,
          type: roomForm.type,
          pricePerNight: Number(roomForm.pricePerNight),
          maxGuests: Number(roomForm.maxGuests) || 2,
          description: roomForm.description,
          imageUrl: roomForm.imageUrl,
          amenities: roomForm.amenities,
        }),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error('Failed to create room');
        return;
      }
      // Reset form on success
      setRoomForm({
        name: '',
        type: '',
        pricePerNight: '',
        maxGuests: '',
        description: '',
        imageUrl: '',
        amenityInput: '',
        amenities: [],
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Create room error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0A2342] pt-24 px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#0A2342] dark:text-[#F9F7F2] mb-1">
              Admin Dashboard
            </h1>
            <p className="text-sm text-[#0A2342]/60 dark:text-[#F9F7F2]/70 uppercase tracking-widest">
              Full Access Control
            </p>
          </div>
        </div>

        {/* Tabs row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="inline-flex rounded-full bg-[#F1F5F9] dark:bg-[#0A2342]/60 p-1 border border-[#0A2342]/10 dark:border-[#F9F7F2]/10">
            {['reservations', 'availability', 'guests', 'add-room'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`px-4 py-2 text-xs font-semibold rounded-full uppercase tracking-widest transition-colors ${
                  activeTab === tab
                    ? 'bg-[#0A2342] text-[#F9F7F2]'
                    : 'text-[#0A2342] dark:text-[#F9F7F2] hover:bg-white/70 dark:hover:bg-[#0A2342]/40'
                }`}
              >
                {tab === 'reservations' && 'Reservations'}
                {tab === 'availability' && 'Availability'}
                {tab === 'guests' && 'Guests'}
                {tab === 'add-room' && '+ Add Room'}
              </button>
            ))}
          </div>

          {activeTab === 'reservations' && (
            <div className="relative w-full sm:w-72">
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

        {/* Reservations tab */}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Availability tab */}
        {activeTab === 'availability' && (
          <div className="flex flex-col md:flex-row md:justify-between gap-8 items-start">
            <div className="flex-shrink-0">
              <div className="w-full max-w-md bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-xl p-7">
                <h3 className="text-sm font-semibold text-[#0A2342] dark:text-[#F9F7F2] mb-4">Select Date</h3>
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F9FBFF] dark:bg-[#0A2342] px-8 py-5">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={previousMonth}
                      className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37] p-1"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-semibold text-[#0A2342] dark:text-[#F9F7F2]">
                      {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                    </span>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37] p-1"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <table className="w-full text-center text-sm">
                    <thead>
                      <tr>
                        {dayNames.map((day) => (
                          <th
                            key={day}
                            className="pb-1 font-semibold text-[11px] text-[#0A2342] dark:text-[#F9F7F2]"
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
                            <td key={di} className="py-0.5">
                              {day === null ? (
                                <span className="inline-block h-7 w-7" />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedDate(
                                      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day)
                                    )
                                  }
                                  className={`h-7 w-7 inline-flex items-center justify-center rounded-full text-xs font-semibold transition-colors ${
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
                <div className="border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/10 mt-4 pt-3 flex justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">Occupied</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full md:max-w-lg">
              <h3 className="text-xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">
                Room Status for {formatDateHeader(selectedDate)}
              </h3>
              <div className="space-y-4">
                {roomStatuses.map((room) => (
                  <div
                    key={room.roomId}
                    className={`rounded-lg p-4 flex items-center justify-between border ${
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
                            room.status === 'available'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
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

        {/* Guests tab */}
        {activeTab === 'guests' && (
          <div className="bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10 flex items-center justify-between gap-4">
              <h2 className="text-lg font-serif text-[#0A2342] dark:text-[#F9F7F2]">Registered Guests</h2>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A2342]/40 dark:text-[#F9F7F2]/40" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#0A2342]/15 dark:border-[#F9F7F2]/15 bg-[#F9F7F2] dark:bg-[#0A2342] text-sm"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F1F5F9] dark:bg-[#0A2342] text-[#0A2342] dark:text-[#F9F7F2]">
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">User ID</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGuests.map((g) => (
                    <tr key={g.id} className="border-t border-[#E2E8F0] dark:border-[#1f2937]">
                      <td className="px-6 py-3 text-sm text-[#0A2342]/80 dark:text-[#F9F7F2]/80">{g.id}</td>
                      <td className="px-6 py-3 text-sm text-[#0A2342] dark:text-[#F9F7F2] font-medium">{g.name}</td>
                      <td className="px-6 py-3 text-sm text-[#0A2342]/80 dark:text-[#F9F7F2]/80">{g.email}</td>
                      <td className="px-6 py-3 text-xs font-semibold text-[#0A2342]/70 dark:text-[#F9F7F2]/70 uppercase tracking-widest">
                        {g.role}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Room tab */}
        {activeTab === 'add-room' && (
          <div className="max-w-3xl mx-auto bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-6">Add New Accommodation</h2>
            <form className="space-y-5" onSubmit={handleSubmitRoom}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">
                    Room Name
                  </label>
                  <input
                    className="w-full bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/15 dark:border-[#F9F7F2]/15 py-3 px-4 rounded-lg text-sm"
                    placeholder="e.g. Sunset Suite"
                    value={roomForm.name}
                    onChange={(e) => setRoomForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">
                    Type
                  </label>
                  <input
                    className="w-full bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/15 dark:border-[#F9F7F2]/15 py-3 px-4 rounded-lg text-sm"
                    placeholder="Suite / Deluxe / Standard"
                    value={roomForm.type}
                    onChange={(e) => setRoomForm((prev) => ({ ...prev, type: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">
                    Price per night (₱)
                  </label>
                  <input
                    type="number"
                    className="w-full bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/15 dark:border-[#F9F7F2]/15 py-3 px-4 rounded-lg text-sm"
                    placeholder="100"
                    value={roomForm.pricePerNight}
                    onChange={(e) => setRoomForm((prev) => ({ ...prev, pricePerNight: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">
                    Max Guests
                  </label>
                  <input
                    type="number"
                    className="w-full bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/15 dark:border-[#F9F7F2]/15 py-3 px-4 rounded-lg text-sm"
                    placeholder="2"
                    value={roomForm.maxGuests}
                    onChange={(e) => setRoomForm((prev) => ({ ...prev, maxGuests: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/15 dark:border-[#F9F7F2]/15 py-3 px-4 rounded-lg text-sm"
                  placeholder="Describe the room..."
                  value={roomForm.description}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">
                  Image URL
                </label>
                <input
                  className="w-full bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/15 dark:border-[#F9F7F2]/15 py-3 px-4 rounded-lg text-sm"
                  placeholder="https://..."
                  value={roomForm.imageUrl}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">
                  Amenities
                </label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/15 dark:border-[#F9F7F2]/15 py-3 px-4 rounded-lg text-sm"
                    placeholder="Add amenity (e.g. Wi‑Fi)"
                    value={roomForm.amenityInput}
                    onChange={(e) => setRoomForm((prev) => ({ ...prev, amenityInput: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-[#0A2342] text-[#F9F7F2] text-xs font-bold uppercase tracking-widest"
                    onClick={handleAddAmenity}
                  >
                    Add
                  </button>
                </div>
                {roomForm.amenities.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {roomForm.amenities.map((a) => (
                      <span
                        key={a}
                        className="px-2 py-1 rounded-full bg-[#0A2342]/5 dark:bg-[#F9F7F2]/10 text-xs text-[#0A2342]/80 dark:text-[#F9F7F2]/80"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 rounded-lg bg-[#D4AF37] text-[#0A2342] font-bold uppercase tracking-widest text-xs"
                >
                  Add Room
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;

