import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Room } from '../lib/store';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

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
  lastActivity?: string | null;
  minutesAgo?: number | null;
  isOnline?: boolean;
}

interface AdminDashboardProps {
  rooms: Room[];
  onRoomsUpdated?: () => void;
}

function formatAuditDate(isoString: string | undefined): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const date = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  return `${date} at ${time}`;
}

function getRelativeTime(isoString: string | undefined): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`;
  return null;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  admin_login: 'Admin login',
  staff_login: 'Staff login',
  guest_login: 'Guest login',
  signup: 'Sign up',
  guest_booking: 'Made reservation',
  staff_viewed_reservations: 'Viewed reservations',
  staff_viewed_availability: 'Viewed availability',
  dashboard_view: 'Opened dashboard',
  tab_view: 'Viewed tab',
  room_added: 'Room added',
};

function getAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] || action.replace(/_/g, ' ');
}

export function AdminDashboard({ rooms, onRoomsUpdated }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'reservations' | 'availability' | 'guests' | 'add-room' | 'audit-logs'>('reservations');
  const [searchQuery, setSearchQuery] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [occupiedRoomIds, setOccupiedRoomIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestRoleFilter, setGuestRoleFilter] = useState<'all' | 'guest' | 'staff' | 'admin'>('all');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ userId: string; userName: string; userRole: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<{ _id: string; userEmail: string; userName: string; role?: string; action: string; details: string; createdAt: string }[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>('');
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
  const [staffForm, setStaffForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('aurora_token') : null;

  const recordAudit = useCallback((action: string, details: string) => {
    if (!token) return;
    fetch(`${API_BASE}/api/admin/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, details }),
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (token) recordAudit('dashboard_view', 'Opened admin dashboard');
  }, []);

  useEffect(() => {
    if (!token || activeTab !== 'audit-logs') return;
    setAuditLoading(true);
    const url = auditRoleFilter ? `${API_BASE}/api/admin/audit?role=${encodeURIComponent(auditRoleFilter)}` : `${API_BASE}/api/admin/audit`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAuditLogs(Array.isArray(data) ? data : []))
      .catch(() => setAuditLogs([]))
      .finally(() => setAuditLoading(false));
  }, [token, activeTab, auditRoleFilter]);

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

  // Fetch and auto-refresh users/online status
  const fetchGuestsWithOnlineStatus = async (token: string) => {
    try {
      const [usersData, onlineData] = await Promise.all([
        fetch(`${API_BASE}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => (res.ok ? res.json() : [])),
        fetch(`${API_BASE}/api/admin/online-users`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => (res.ok ? res.json() : { users: [] })),
      ]);
      
      const users = Array.isArray(usersData) ? usersData : [];
      const onlineUsers = (onlineData?.users || []).reduce((acc: Record<string, any>, u: any) => {
        acc[u.email] = {
          lastActivity: u.lastActivity,
          minutesAgo: typeof u.minutesAgo === 'number' ? u.minutesAgo : null,
          isOnline: !!u.isOnline,
        };
        return acc;
      }, {});
      const mergedGuests = users.map((u: any) => ({
        ...u,
        lastActivity: onlineUsers[u.email]?.lastActivity ?? null,
        minutesAgo: onlineUsers[u.email]?.minutesAgo ?? null,
        isOnline: onlineUsers[u.email]?.isOnline ?? false,
      }));
      setGuests(mergedGuests);
    } catch (err) {
      console.error('Failed to fetch guests:', err);
      setGuests([]);
    }
  };

  useEffect(() => {
    if (!token || activeTab !== 'guests') {
      return;
    }

    // Fetch immediately
    fetchGuestsWithOnlineStatus(token);

    // Set up auto-refresh every 20 seconds
    const interval = setInterval(() => {
      fetchGuestsWithOnlineStatus(token);
    }, 20000);

    return () => clearInterval(interval);
  }, [token, activeTab]);

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

  const filteredGuests = guests.filter((g) => {
    const q = guestSearch.toLowerCase();
    const matchesSearch =
      g.name.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q);
    
    const matchesRole = guestRoleFilter === 'all' || g.role.toLowerCase() === guestRoleFilter.toLowerCase();
    
    return matchesSearch && matchesRole;
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
      onRoomsUpdated?.();
      toast.success('Room added. It will now appear on Home and Rooms.');
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

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const firstName = staffForm.firstName.trim();
    const lastName = staffForm.lastName.trim();
    const email = staffForm.email.trim().toLowerCase();
    const password = staffForm.password;

    if (!firstName || !lastName || !email || !password) {
      toast.error('Please fill out first name, last name, email, and password.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setCreatingStaff(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/create-staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || 'Could not create staff account.');
        return;
      }

      toast.success('Staff account created successfully.');
      setStaffForm({ firstName: '', lastName: '', email: '', password: '' });
      setIsStaffModalOpen(false);
      if (token && activeTab === 'guests') {
        fetchGuestsWithOnlineStatus(token);
      }
    } catch {
      toast.error('Could not create staff account. Please try again.');
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token) return;

    setDeletingUserId(userId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || 'Could not delete user.');
        setDeletingUserId(null);
        setDeleteConfirmModal(null);
        return;
      }

      toast.success('User deleted successfully.');
      setDeleteConfirmModal(null);
      if (token && activeTab === 'guests') {
        fetchGuestsWithOnlineStatus(token);
      }
    } catch {
      toast.error('Could not delete user. Please try again.');
      setDeleteConfirmModal(null);
    } finally {
      setDeletingUserId(null);
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
            {['reservations', 'availability', 'guests', 'add-room', 'audit-logs'].map((tab) => {
              const tabLabel = tab === 'reservations' ? 'Reservations' : tab === 'availability' ? 'Availability' : tab === 'guests' ? 'Users' : tab === 'add-room' ? '+ Add Room' : 'Audit Logs';
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab as typeof activeTab);
                    recordAudit('tab_view', `Viewed: ${tabLabel}`);
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-full uppercase tracking-widest transition-colors ${
                    activeTab === tab
                      ? 'bg-[#0A2342] text-[#F9F7F2]'
                      : 'text-[#0A2342] dark:text-[#F9F7F2] hover:bg-white/70 dark:hover:bg-[#0A2342]/40'
                  }`}
                >
                  {tabLabel}
                </button>
              );
            })}
          </div>

          {activeTab === 'reservations' && (
            <div className="relative w-48 sm:w-52">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 text-[#0A2342] dark:text-[#F9F7F2] placeholder-[#0A2342]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2342]/30 dark:focus:ring-[#D4AF37]/30"
              />
            </div>
          )}

        </div>

        {/* Reservations tab */}
    {activeTab === 'reservations' && (
  <div className="bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg shadow overflow-hidden p-4">
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
                No reservations found.
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
    {/* Calendar */}
    <div className="flex-shrink-0">
      <div className="w-full max-w-lg bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-xl p-8">
        <h3 className="text-base font-semibold text-[#0A2342] dark:text-[#F9F7F2] mb-5">Select Date</h3>
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#F9F7F2]/20 bg-[#F9FBFF] dark:bg-[#0A2342] px-10 py-6 text-[#0A2342] dark:text-[#F9F7F2]">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={previousMonth} className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37] p-1.5 transition-colors">
              <ChevronLeft size={22} />
            </button>
            <span className="text-base font-semibold text-[#0A2342] dark:text-[#F9F7F2]">
              {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </span>
            <button type="button" onClick={nextMonth} className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37] p-1.5 transition-colors">
              <ChevronRight size={22} />
            </button>
          </div>
          <table className="w-full text-center text-base">
            <thead>
              <tr>
                {dayNames.map((day) => (
                  <th key={day} className="pb-2 font-semibold text-xs text-[#0A2342] dark:text-[#F9F7F2]">{day}</th>
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
                          onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day))}
                          className={`h-10 w-10 inline-flex items-center justify-center rounded-full text-sm font-semibold transition-all ${
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

    {/* Room Status */}
    <div className="flex-1 w-full md:max-w-lg">
      <h3 className="text-xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">
        Room Status for {formatDateHeader(selectedDate)}
      </h3>
      <div className="space-y-6">
        {roomStatuses.map((room) => (
          <div
            key={room.roomId}
            className={`rounded-xl p-5 flex items-center justify-between border shadow-md transition-all duration-300 ease-in-out hover:-translate-y-1 hover:border-[#D4AF37]`}
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <ImageWithFallback
                src={room.image}
                alt={room.name}
                className="w-32 h-20 rounded-xl object-cover shrink-0 border border-gray-200/30 dark:border-white/10"
              />
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
                  className={`text-sm font-bold transition-colors ${
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
        {/* Users tab */}
       {activeTab === 'guests' && (
    <div className="space-y-6">
  <div className="bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg shadow overflow-hidden">
    <div className="px-6 py-4 border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10 flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={() => setIsStaffModalOpen(true)}
        className="h-11 px-6 rounded-lg bg-[#0A2342] dark:bg-[#153a66] text-[#F9F7F2] text-sm font-bold uppercase tracking-widest hover:bg-[#153a66] dark:hover:bg-[#D4AF37] dark:hover:text-[#0A2342] transition-colors"
      >
        + Add Staff
      </button>

      <div className="flex items-center gap-2">
        {/* Role filter buttons */}
        <div className="flex gap-2 mr-4">
          {(['all', 'guest', 'staff', 'admin'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setGuestRoleFilter(role)}
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
                guestRoleFilter === role
                  ? 'bg-[#0A2342] dark:bg-[#D4AF37] text-[#F9F7F2] dark:text-[#0A2342]'
                  : 'bg-[#F1F5F9] dark:bg-[#0A2342] text-[#0A2342] dark:text-[#F9F7F2] hover:bg-[#E2E8F0] dark:hover:bg-[#1f3a52]'
              }`}
            >
              {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative w-56">
          <input
            type="text"
            value={guestSearch}
            onChange={(e) => setGuestSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full h-10 px-3 rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#0A2342] text-sm text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 transition"
          />
        </div>
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-[#F1F5F9] dark:bg-[#0A2342] text-[#0A2342] dark:text-[#F9F7F2]">
            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Status</th>
            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">User ID</th>
            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Name</th>
            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Email</th>
            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Role</th>
            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Last Activity</th>
            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredGuests.map((g) => (
            <tr key={g.id} className="border-t border-[#E2E8F0] dark:border-[#1f2937]">
              <td className="px-6 py-3 text-sm">
                <div className="flex items-center gap-2">
                  {g.minutesAgo != null && g.minutesAgo === 0 ? (
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#22c55e',
                        borderRadius: '50%',
                        display: 'inline-block',
                      }}
                      title="Online • active within the last minute"
                    />
                  ) : (
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#ef4444',
                        borderRadius: '50%',
                        display: 'inline-block',
                      }}
                      title={
                        g.lastActivity
                          ? `Offline • last seen ${getRelativeTime(g.lastActivity) || formatAuditDate(g.lastActivity)}`
                          : 'Offline'
                      }
                    />
                  )}
                </div>
              </td>
              <td className="px-6 py-3 text-sm text-[#0A2342]/80 dark:text-[#F9F7F2]/80">{g.id}</td>
              <td className="px-6 py-3 text-sm text-[#0A2342] dark:text-[#F9F7F2] font-medium">{g.name}</td>
              <td className="px-6 py-3 text-sm text-[#0A2342]/80 dark:text-[#F9F7F2]/80">{g.email}</td>
              <td className="px-6 py-3 text-xs font-semibold text-[#0A2342]/70 dark:text-[#F9F7F2]/70 uppercase tracking-widest">
                {g.role}
              </td>
              <td className="px-6 py-3 text-sm text-[#0A2342]/60 dark:text-[#F9F7F2]/60">
                {g.lastActivity
                  ? (() => {
                      const rel = getRelativeTime(g.lastActivity);
                      return rel || formatAuditDate(g.lastActivity);
                    })()
                  : '—'}
              </td>
              <td className="px-6 py-3 text-sm">
                {g.role.toUpperCase() !== 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmModal({ userId: g.id, userName: g.name, userRole: g.role })}
                    disabled={deletingUserId === g.id}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete user"
                  >
                    <Trash2 size={16} />
                    <span className="text-xs font-semibold">Delete</span>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>

  {isStaffModalOpen && (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setIsStaffModalOpen(false)}
    >
      <div
        className="w-full max-w-md bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/15 dark:border-[#F9F7F2]/20 rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">Create Staff Account</h3>
        <form onSubmit={handleCreateStaff} className="space-y-3">
          <input
            type="text"
            placeholder="First name"
            value={staffForm.firstName}
            onChange={(e) => setStaffForm((prev) => ({ ...prev, firstName: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] text-sm text-[#0A2342] dark:text-[#F9F7F2] placeholder-[#0A2342]/50 dark:placeholder-[#F9F7F2]/60 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
          />
          <input
            type="text"
            placeholder="Last name"
            value={staffForm.lastName}
            onChange={(e) => setStaffForm((prev) => ({ ...prev, lastName: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] text-sm text-[#0A2342] dark:text-[#F9F7F2] placeholder-[#0A2342]/50 dark:placeholder-[#F9F7F2]/60 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
          />
          <input
            type="email"
            placeholder="Email"
            value={staffForm.email}
            onChange={(e) => setStaffForm((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] text-sm text-[#0A2342] dark:text-[#F9F7F2] placeholder-[#0A2342]/50 dark:placeholder-[#F9F7F2]/60 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
          />
          <input
            type="password"
            placeholder="Password (min 8 chars)"
            value={staffForm.password}
            onChange={(e) => setStaffForm((prev) => ({ ...prev, password: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] text-sm text-[#0A2342] dark:text-[#F9F7F2] placeholder-[#0A2342]/50 dark:placeholder-[#F9F7F2]/60 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
          />
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsStaffModalOpen(false)}
              className="h-10 px-4 rounded-lg border border-[#0A2342]/25 dark:border-[#F9F7F2]/25 text-[#0A2342] dark:text-[#F9F7F2] text-xs font-bold uppercase tracking-widest hover:bg-[#0A2342]/5 dark:hover:bg-[#F9F7F2]/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingStaff}
              className="h-10 px-4 rounded-lg bg-[#0A2342] dark:bg-[#153a66] text-[#F9F7F2] text-xs font-bold uppercase tracking-widest hover:bg-[#153a66] dark:hover:bg-[#D4AF37] dark:hover:text-[#0A2342] transition-colors disabled:opacity-70"
            >
              {creatingStaff ? 'Creating...' : 'Create Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* Delete confirmation modal */}
  {deleteConfirmModal && (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setDeleteConfirmModal(null)}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#0A2342] border border-red-300 dark:border-red-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal content */}
        <div className="p-6 overflow-y-auto flex-1">
          <h3 className="text-xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">Delete User</h3>
          <p className="text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70 mb-2">
            Are you sure you want to delete this user account?
          </p>
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-6 space-y-1">
            <p className="text-sm font-semibold text-[#0A2342] dark:text-[#F9F7F2]">
              {deleteConfirmModal.userName}
            </p>
            <p className="text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70">
              {deleteConfirmModal.userRole} • {deleteConfirmModal.userId}
            </p>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400">
            This action cannot be undone. All associated data may be lost.
          </p>
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 bg-[#F9F7F2] dark:bg-[#05152a] border-t border-red-200 dark:border-red-900 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeleteConfirmModal(null)}
            disabled={deletingUserId !== null}
            className="h-10 px-4 rounded-lg border border-[#0A2342]/25 dark:border-[#F9F7F2]/25 text-[#0A2342] dark:text-[#F9F7F2] text-xs font-bold uppercase tracking-widest hover:bg-[#0A2342]/5 dark:hover:bg-[#F9F7F2]/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleDeleteUser(deleteConfirmModal.userId)}
            disabled={deletingUserId !== null}
            className="h-10 px-4 rounded-lg bg-red-600 dark:bg-red-700 border-2 border-red-700 dark:border-red-900 text-black dark:text-black text-xs font-bold uppercase tracking-widest hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-70"
          >
            {deletingUserId === deleteConfirmModal.userId ? 'Deleting...' : 'Delete User'}
          </button>
        </div>
      </div>
    </div>
  )}
  </div>
)}

        {/* Audit Logs tab */}
        {activeTab === 'audit-logs' && (
          <div className="bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-serif text-[#0A2342] dark:text-[#F9F7F2]">Audit Logs</h2>
                <p className="text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/60 mt-1">Backtrack guests, staff, and admin actions — dates in local time</p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="audit-role-filter" className="text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider">Filter by role</label>
                <select
                  id="audit-role-filter"
                  value={auditRoleFilter}
                  onChange={(e) => setAuditRoleFilter(e.target.value)}
                  className="bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/15 dark:border-[#F9F7F2]/15 py-2 px-3 rounded-lg text-sm text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                >
                  <option value="">All (Guest, Staff, Admin)</option>
                  <option value="guest">Guest only</option>
                  <option value="staff">Staff only</option>
                  <option value="admin">Admin only</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              {auditLoading ? (
                <div className="px-6 py-12 text-center text-[#0A2342]/60 dark:text-[#F9F7F2]/60">Loading audit logs...</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F1F5F9] dark:bg-[#0A2342] text-[#0A2342] dark:text-[#F9F7F2]">
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">When</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Who</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest">What happened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-[#0A2342]/60 dark:text-[#F9F7F2]/60 text-sm">
                          {auditRoleFilter ? `No audit logs for ${auditRoleFilter}. Try "All".` : 'No audit logs yet. Guests (login, signup, bookings), staff (login, view reservations/availability), and admin actions are recorded here.'}
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => {
                        const relative = getRelativeTime(log.createdAt);
                        const roleLabel = log.role ? log.role.charAt(0).toUpperCase() + log.role.slice(1) : '—';
                        return (
                          <tr key={log._id} className="border-t border-[#E2E8F0] dark:border-[#1f2937] hover:bg-[#F9F7F2]/30 dark:hover:bg-[#0A2342]/20">
                            <td className="px-6 py-3 text-sm text-[#0A2342] dark:text-[#F9F7F2]">
                              <span className="block font-medium">{formatAuditDate(log.createdAt)}</span>
                              {relative && <span className="text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/60">{relative}</span>}
                            </td>
                            <td className="px-6 py-3 text-sm text-[#0A2342] dark:text-[#F9F7F2]">
                              <span className="font-medium">{log.userName || log.userEmail}</span>
                              {log.userName && log.userEmail && <span className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 block text-xs">{log.userEmail}</span>}
                            </td>
                            <td className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#0A2342]/80 dark:text-[#F9F7F2]/80">{roleLabel}</td>
                            <td className="px-6 py-3 text-sm font-semibold text-[#0A2342] dark:text-[#F9F7F2]">{getAuditActionLabel(log.action)}</td>
                            <td className="px-6 py-3 text-sm text-[#0A2342]/90 dark:text-[#F9F7F2]/90">{log.details || '—'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
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
                  <select
                    className="w-full bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/15 dark:border-[#F9F7F2]/15 py-3 px-4 rounded-lg text-sm text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                    value={roomForm.type}
                    onChange={(e) => setRoomForm((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="">Select room type</option>
                    <option value="standard">Standard</option>
                    <option value="deluxe">Deluxe</option>
                    <option value="suite">Suite</option>
                    <option value="villa">Villa</option>
                    <option value="cabin">Cabin</option>
                  </select>
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

