import { useState } from 'react';
import { Search } from 'lucide-react';

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

export function ReceptionDesk() {
  const [activeTab, setActiveTab] = useState('reservations');
  const [searchQuery, setSearchQuery] = useState('');
  const [reservations] = useState<Reservation[]>([]);

  const filteredReservations = reservations.filter(
    (res) =>
      res.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            onClick={() => setActiveTab('availability')}
            className={`px-6 py-3 font-bold text-sm uppercase tracking-widest transition-colors ${
              activeTab === 'availability'
                ? 'text-[#0A2342] dark:text-[#F9F7F2] border-b-2 border-[#D4AF37]'
                : 'text-[#0A2342]/60 dark:text-[#F9F7F2]/60 hover:text-[#0A2342] dark:hover:text-[#F9F7F2]'
            }`}
          >
            Room Availability
          </button>
        </div>

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

        {/* Content */}
        {activeTab === 'reservations' && (
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
        )}

        {activeTab === 'availability' && (
          <div className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg shadow-lg p-8">
            <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 text-center">Room availability view coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReceptionDesk;
