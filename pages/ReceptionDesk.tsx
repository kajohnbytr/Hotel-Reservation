import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { ROOMS } from '../lib/store';

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

export function ReceptionDesk() {
  const [activeTab, setActiveTab] = useState('room-availability');
  const [searchQuery, setSearchQuery] = useState('');
  const [reservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 1, 20)); // Feb 20, 2026
  
  // Mock room statuses (all available for demo)
  const roomStatuses: RoomStatus[] = ROOMS.map(room => ({
    roomId: room.id,
    name: room.name,
    type: room.type,
    image: room.image,
    status: 'available' as const,
  }));

  const filteredReservations = reservations.filter(
    (res) =>
      res.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calendar logic
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const monthDays = getDaysInMonth(selectedDate);
  const firstDay = getFirstDayOfMonth(selectedDate);
  const calendarDays: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: monthDays }, (_, i) => i + 1)
  ];

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const previousMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1));
  };

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0A2342] pt-32 px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-2">
            Reception Desk
          </h1>
          <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/70 text-sm uppercase tracking-widest">
            Manage Reservations & Guests
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10">
          <button
            onClick={() => setActiveTab('reservations')}
            className={`px-6 py-3 font-bold text-sm uppercase tracking-widest transition-colors ${
              activeTab === 'reservations'
                ? 'text-[#0A2342] dark:text-[#F9F7F2] border-b-2 border-[#D4AF37]'
                : 'text-[#0A2342]/60 dark:text-[#F9F7F2]/60 hover:text-[#0A2342] dark:hover:text-[#F9F7F2]'
            }`}
          >
            Reservations
          </button>
          <button
            onClick={() => setActiveTab('room-availability')}
            className={`px-6 py-3 font-bold text-sm uppercase tracking-widest transition-colors ${
              activeTab === 'room-availability'
                ? 'text-[#0A2342] dark:text-[#F9F7F2] border-b-2 border-[#D4AF37]'
                : 'text-[#0A2342]/60 dark:text-[#F9F7F2]/60 hover:text-[#0A2342] dark:hover:text-[#F9F7F2]'
            }`}
          >
            Room Availability
          </button>
        </div>

        {/* Reservations Tab */}
        {activeTab === 'reservations' && (
          <>
            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#0A2342]/40 dark:text-[#F9F7F2]/40" />
                <input
                  type="text"
                  placeholder="Search Name, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 text-[#0A2342] dark:text-[#F9F7F2] placeholder-[#0A2342]/50 dark:placeholder-[#F9F7F2]/50 rounded-lg focus:outline-none focus:border-[#D4AF37] transition-colors"
                />
              </div>
            </div>

            {/* Reservations Table */}
            <div className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#0A2342] text-[#F9F7F2] dark:bg-[#05152a]">
                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-widest">Guest Name</th>
                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-widest">Room</th>
                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-widest">Check-in</th>
                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-widest">Check-out</th>
                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-widest">Nights</th>
                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-widest">Guests</th>
                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReservations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-[#0A2342]/60 dark:text-[#F9F7F2]/60">
                          No reservations found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredReservations.map((reservation) => (
                        <tr
                          key={reservation.id}
                          className="border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/10 hover:bg-[#F9F7F2]/50 dark:hover:bg-[#0A2342]/50 transition-colors"
                        >
                          <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2] font-medium">{reservation.guestName}</td>
                          <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">{reservation.room}</td>
                          <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">{reservation.checkIn}</td>
                          <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">{reservation.checkOut}</td>
                          <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">{reservation.nights}</td>
                          <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2]">{reservation.guests}</td>
                          <td className="px-6 py-4 text-[#0A2342] dark:text-[#F9F7F2] font-semibold">${reservation.total.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Room Availability Tab */}
        {activeTab === 'room-availability' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-[#0A2342] dark:text-[#F9F7F2] mb-4">Select Date</h3>
                  
                  {/* Month/Year Header */}
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={previousMonth}
                      className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37]"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <p className="text-sm font-semibold text-[#0A2342] dark:text-[#F9F7F2]">
                      {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                    </p>
                    <button
                      onClick={nextMonth}
                      className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37]"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  {/* Day Names */}
                  <div className="grid grid-cols-7 gap-0 mb-2 border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10">
                    {dayNames.map((day) => (
                      <div key={day} className="text-xs font-semibold text-[#0A2342]/70 dark:text-[#F9F7F2]/70 py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-0">
                    {calendarDays.map((day, idx) => (
                      <button
                        key={idx}
                        onClick={() => day && setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day))}
                        className={`aspect-square flex items-center justify-center text-sm border border-[#0A2342]/5 dark:border-[#F9F7F2]/5 ${
                          day === null
                            ? ''
                            : day === selectedDate.getDate()
                            ? 'bg-[#0A2342] text-[#F9F7F2] dark:bg-[#F9F7F2] dark:text-[#0A2342] font-bold'
                            : 'text-[#0A2342] dark:text-[#F9F7F2] hover:bg-[#F9F7F2]/50 dark:hover:bg-[#0A2342]/50'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/10 mt-6 pt-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <p className="text-xs text-[#0A2342]/70 dark:text-[#F9F7F2]/70">Available</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <p className="text-xs text-[#0A2342]/70 dark:text-[#F9F7F2]/70">Occupied</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Room Status List */}
            <div className="lg:col-span-3">
              <h3 className="text-xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-6">
                Room Status for {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
              </h3>
              
              <div className="space-y-4">
                {roomStatuses.map((room) => (
                  <div
                    key={room.roomId}
                    className="bg-[#E8F5F0] dark:bg-[#0A2342]/50 border border-green-200 dark:border-green-900/30 rounded-lg p-4 flex items-center justify-between hover:shadow-lg transition-shadow"
                  >
                    {/* Room Image and Info */}
                    <div className="flex items-center gap-4 flex-1">
                      <img
                        src={room.image}
                        alt={room.name}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                      <div>
                        <h4 className="font-serif text-[#0A2342] dark:text-[#F9F7F2] font-semibold text-lg">
                          {room.name}
                        </h4>
                        <p className="text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/60 uppercase tracking-widest">
                          {room.type}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">
                          Available
                        </span>
                        <span className="text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/60">
                          Ready for check-in
                        </span>
                      </div>
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
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
