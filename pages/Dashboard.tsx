import React from 'react';
import { motion } from 'motion/react';
import { getBookings, User, Room } from '../lib/store';
import { BarChart3, Shield } from 'lucide-react';
import { formatDate } from '../lib/utils';

export function Dashboard({ user, rooms }: { user: User | null; rooms: Room[] }) {
  const allBookings = getBookings();
  const userBookings = user ? allBookings.filter(b => b.userId === user.id).reverse() : [];
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
            userBookings.length === 0 ? (
              <div className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 p-12 text-center">
                <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 mb-6 font-serif text-lg">You have no upcoming stays.</p>
              </div>
            ) : (
              <div className="space-y-8">
              {userBookings.map((booking) => {
                const room = rooms.find(r => r.id === booking.roomId);
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
                          <h3 className="text-xl font-serif text-[#D4AF37]">{room?.name}</h3>
                          <span className="text-sm font-bold text-[#F9F7F2]">₱{booking.totalPrice}</span>
                        </div>
                        <p className="text-sm text-[#F9F7F2]/60 uppercase tracking-wider mb-6">
                          {formatDate(booking.date)} • {booking.nights} Night(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-3 pt-4 border-t border-[#F9F7F2]/10">
                        <Shield className="w-4 h-4 text-[#D4AF37]" />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[10px] text-[#F9F7F2]/40 uppercase tracking-widest mb-1">Blockchain Receipt</p>
                          <code className="text-[10px] text-[#F9F7F2]/80 font-mono truncate block">
                            {booking.txHash}
                          </code>
                        </div>
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
