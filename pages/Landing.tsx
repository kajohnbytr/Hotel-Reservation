import React from 'react';
import { motion } from 'motion/react';
import { RoomCard } from '../components/RoomCard';
import { MissionVision } from '../components/MissionVision';
import { Highlights } from '../components/Highlights';
import { Room } from '../lib/store';

interface LandingProps {
  rooms: Room[];
  onBook: (roomId: string) => void;
  onViewAllRooms: () => void;
  onNavigateToStaffLogin?: () => void;
  onNavigateToReception?: () => void;
}

export function Landing({ rooms, onBook, onViewAllRooms, onNavigateToStaffLogin, onNavigateToReception }: LandingProps) {
  return (
    <div className="pb-20">
      <div className="relative h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1768223933860-6d62bc5b2ff3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920" 
            alt="Exterior" 
            className="w-full h-full object-cover grayscale-[20%]"
          />
          <div className="absolute inset-0 bg-[#0A2342]/40 mix-blend-multiply" />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <h1 className="text-5xl md:text-8xl font-serif text-[#F9F7F2] mb-6 tracking-tight">
              Aurora
            </h1>
            <div className="w-24 h-1 bg-[#D4AF37] mx-auto mb-8"></div>
            <p className="text-xl md:text-2xl text-[#F9F7F2]/90 font-light tracking-wide mb-12">
              Minimalist Luxury. Timeless Comfort.
            </p>
            <button 
              onClick={onViewAllRooms}
              className="px-10 py-4 bg-[#F9F7F2] text-[#0A2342] hover:bg-[#D4AF37] hover:text-[#0A2342] transition-colors uppercase tracking-widest text-sm font-bold rounded-full"
            >
              View Rooms
            </button>
          </motion.div>
        </div>
      </div>

      <MissionVision />
      <Highlights />

      {/* Staff Portal Section */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24 bg-gradient-to-r from-[#0A2342] to-[#153a66] dark:from-[#05152a] dark:to-[#0A2342]">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-serif text-[#F9F7F2] mb-4">Staff Portal</h2>
          <p className="text-[#F9F7F2]/70 max-w-2xl mx-auto leading-relaxed">
            Access the administration panel to manage reservations, check room availability, and oversee guest operations.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Staff Login Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#D4AF37]/30 rounded-lg p-8 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => onNavigateToStaffLogin?.()}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔐</span>
              </div>
              <h3 className="text-2xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-3">Staff Portal</h3>
              <p className="text-[#0A2342]/70 dark:text-[#F9F7F2]/70 text-sm mb-6">
                Sign in to your staff account to access the management dashboard.
              </p>
              <button className="px-8 py-2 bg-[#0A2342] text-[#F9F7F2] hover:bg-[#D4AF37] hover:text-[#0A2342] dark:bg-[#F9F7F2] dark:text-[#0A2342] dark:hover:bg-[#D4AF37] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg">
                Staff Login
              </button>
            </div>
          </motion.div>

          {/* Reception Desk Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#D4AF37]/30 rounded-lg p-8 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => onNavigateToReception?.()}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📋</span>
              </div>
              <h3 className="text-2xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-3">Reception Desk</h3>
              <p className="text-[#0A2342]/70 dark:text-[#F9F7F2]/70 text-sm mb-6">
                View reservations and manage room availability (requires login).
              </p>
              <button className="px-8 py-2 bg-[#0A2342] text-[#F9F7F2] hover:bg-[#D4AF37] hover:text-[#0A2342] dark:bg-[#F9F7F2] dark:text-[#0A2342] dark:hover:bg-[#D4AF37] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg">
                Open Reception
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* User Dashboard Section */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">Guest Dashboard</h2>
          <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/70 max-w-2xl mx-auto leading-relaxed">
            Track your reservations, manage bookings, and access your guest information all in one place.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white dark:bg-[#0A2342] border border-[#D4AF37]/30 rounded-lg p-12 shadow-lg hover:shadow-xl transition-shadow cursor-pointer max-w-md mx-auto"
          onClick={() => onNavigateToReception?.()}
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h3 className="text-2xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-3">Your Dashboard</h3>
            <p className="text-[#0A2342]/70 dark:text-[#F9F7F2]/70 text-sm mb-6">
              View your bookings, check reservation details, and manage your account.
            </p>
            <button className="px-8 py-2 bg-[#0A2342] text-[#F9F7F2] hover:bg-[#D4AF37] hover:text-[#0A2342] dark:bg-[#F9F7F2] dark:text-[#0A2342] dark:hover:bg-[#D4AF37] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg">
              Access Dashboard
            </button>
          </div>
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24 bg-[#F9F7F2] dark:bg-[#0A2342] transition-colors duration-300">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">The Experience</h2>
          <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 max-w-2xl mx-auto leading-relaxed">
            Designed for the modern traveler, Aurora combines architectural purity with warm hospitality. Every detail is curated for your peace of mind.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {rooms.map(room => (
            <RoomCard key={room.id} room={room} onBook={onBook} />
          ))}
        </div>
      </div>
    </div>
  );
}
