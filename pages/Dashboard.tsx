import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { User, Room } from '../lib/store';
import { BarChart3, Shield } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface DashboardBooking {
  id: string;
  roomId: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: number;
  status: 'confirmed' | 'cancelled' | 'pending_cancel';
  txHash?: string;
}

export function Dashboard({ user, rooms }: { user: User | null; rooms: Room[] }) {
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const refreshAccessToken = async (): Promise<string | null> => {
      const refreshToken = localStorage.getItem('aurora_refresh_token');
      if (!refreshToken) return null;

      try {
        const refreshRes = await fetch(`${API_BASE}/api/users/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!refreshRes.ok) return null;
        const refreshData = await refreshRes.json().catch(() => ({}));
        const newToken = typeof refreshData.token === 'string' ? refreshData.token : null;
        if (newToken) {
          localStorage.setItem('aurora_token', newToken);
          return newToken;
        }
      } catch {
        return null;
      }

      return null;
    };

    const loadBookings = async () => {
      let token = localStorage.getItem('aurora_token');
      if (!token) return;

      setLoading(true);
      try {
        let res = await fetch(`${API_BASE}/api/bookings/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Access token may expire earlier than local session; refresh and retry once.
        if (res.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            token = refreshed;
            res = await fetch(`${API_BASE}/api/bookings/my`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
          }
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to load bookings.');
        }

        const data = (await res.json().catch(() => [])) as DashboardBooking[];
        setBookings((data || []).filter((b) => b.status !== 'cancelled'));
      } catch (err) {
        console.error('Dashboard bookings load error:', err);
        toast.error('Could not load your bookings. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (!user) {
      setBookings([]);
      return;
    }
    loadBookings();
  }, [user]);

  const handleCancel = async (bookingId: string) => {
    const token = localStorage.getItem('aurora_token');
    if (!token) {
      toast.error('You are not logged in.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${encodeURIComponent(bookingId)}/request-cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || 'Could not request cancellation for this booking.');
        return;
      }
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'pending_cancel' } : b))
      );
      toast.success('Cancellation requested. A staff member will review it shortly.');
    } catch (error) {
      console.error('Cancel booking error:', error);
      toast.error('Could not cancel this booking. Please try again.');
    }
  };

  const userBookings = bookings;
  return (
    <div className="bg-[#F9F7F2] dark:bg-[#0A2342] min-h-screen">
      <div className="max-w-4xl mx-auto py-16 px-6">
        <div className="mb-12">
          <h1 className="text-4xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-2">
            {user ? `Welcome, ${user.name}` : 'Welcome to the Dashboard'}
          </h1>
          <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 uppercase tracking-widest text-xs">Your Journey History</p>
        </div>
        {/* Dashboard Quick Access (Guest only) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mb-8 bg-gradient-to-r from-[#0A2342] to-[#153a66] dark:from-[#05152a] dark:to-[#0A2342] text-[#F9F7F2] p-6 rounded-lg hover:shadow-lg transition-shadow flex items-center gap-4"
        >
          <BarChart3 className="w-6 h-6 text-[#D4AF37]" />
          <div className="text-left flex-1">
            <h3 className="font-serif text-lg">Dashboard</h3>
            <p className="text-sm text-[#F9F7F2]/70">Overview of your bookings and activity</p>
          </div>
        </motion.div>
        <div>
          {user ? (
            loading ? (
              <div className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 p-12 text-center">
                <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 mb-6 font-serif text-lg">Loading your stays…</p>
              </div>
            ) : userBookings.length === 0 ? (
              <div className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 p-12 text-center">
                <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 mb-6 font-serif text-lg">You have no upcoming stays.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {userBookings.map((booking) => {
                  const room = rooms.find((r) => r.id === booking.roomId);
                  return (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#0A2342] text-[#F9F7F2] flex flex-col md:flex-row overflow-hidden shadow-lg rounded-lg"
                    >
                      <div className="md:w-64 h-48 md:h-auto relative">
                        <img
                          src={room?.image}
                          alt={room?.name}
                          className="w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-[#0A2342]/20"></div>
                      </div>
                      <div className="p-8 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-serif text-[#D4AF37]">{booking.roomName || room?.name}</h3>
                            <span className="text-sm font-bold text-[#F9F7F2]">₱{booking.total}</span>
                          </div>
                          <p className="text-sm text-[#F9F7F2]/60 uppercase tracking-wider mb-2">
                            Check-in: {formatDate(booking.checkIn)} • Check-out: {formatDate(booking.checkOut)} • {booking.nights} Night(s)
                          </p>
                          {booking.status === 'pending_cancel' && (
                            <p className="text-xs font-semibold text-yellow-300 uppercase tracking-widest">
                              Pending cancellation – awaiting staff approval
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-3 pt-4 border-t border-[#F9F7F2]/10 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <Shield className="w-4 h-4 text-[#D4AF37]" />
                            <div className="flex-1 overflow-hidden">
                              <p className="text-[10px] text-[#F9F7F2]/40 uppercase tracking-widest mb-1">Blockchain Receipt</p>
                              <code className="text-[10px] text-[#F9F7F2]/80 font-mono truncate block">
                                {booking.txHash || 'Not available'}
                              </code>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCancel(booking.id)}
                            disabled={booking.status === 'pending_cancel'}
                            className={`mt-2 inline-flex items-center justify-center rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-widest md:mt-0 ${
                              booking.status === 'pending_cancel'
                                ? 'border-yellow-500 text-yellow-100 opacity-70 cursor-not-allowed'
                                : 'border-red-400 text-red-100 hover:bg-red-500/10 hover:border-red-300'
                            }`}
                          >
                            {booking.status === 'pending_cancel' ? 'Cancellation requested' : 'Request cancellation'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 p-12 text-center">
              <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 mb-6 font-serif text-lg">Sign in to see your bookings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
