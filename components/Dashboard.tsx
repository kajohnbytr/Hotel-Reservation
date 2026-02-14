import React from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, Hash, Clock } from 'lucide-react';
import { Booking, HOTELS } from '../lib/mockData';

interface DashboardProps {
  bookings: Booking[];
  user: any;
}

export function Dashboard({ bookings, user }: DashboardProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <h2 className="text-3xl font-bold text-white mb-2">Welcome back, {user.email.split('@')[0]}</h2>
        <p className="text-slate-400">Manage your bookings and view your blockchain transaction history.</p>
      </motion.div>

      <div className="grid gap-6">
        {bookings.length === 0 ? (
          <div className="bg-slate-800/50 rounded-2xl p-10 text-center border border-slate-700 border-dashed">
            <p className="text-slate-400">No bookings yet. Start your journey today!</p>
          </div>
        ) : (
          bookings.map((booking) => {
            const hotel = HOTELS.find(h => h.id === booking.hotelId);
            return (
              <motion.div 
                key={booking.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800 rounded-2xl p-6 border border-slate-700 flex flex-col md:flex-row gap-6"
              >
                <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={hotel?.image} alt={hotel?.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{hotel?.name}</h3>
                      <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                        <MapPin className="w-4 h-4" /> {hotel?.location}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold uppercase tracking-wide border border-green-500/30">
                        Confirmed
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-3 text-slate-300 text-sm">
                      <div className="p-2 bg-slate-900 rounded-lg">
                        <Calendar className="w-4 h-4 text-teal-400" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Date</p>
                        <p>{booking.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-300 text-sm">
                      <div className="p-2 bg-slate-900 rounded-lg">
                        <Clock className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Booked On</p>
                        <p>{new Date(booking.timestamp).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash className="w-3 h-3 text-slate-500" />
                      <span className="text-xs text-slate-500 font-medium uppercase">Blockchain Transaction Hash</span>
                    </div>
                    <code className="text-xs font-mono text-teal-500/80 break-all">
                      {booking.blockchainHash}
                    </code>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
