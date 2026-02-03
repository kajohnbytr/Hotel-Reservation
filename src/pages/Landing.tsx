import React from 'react';
import { motion } from 'motion/react';
import { RoomCard } from '../../components/RoomCard';
import { MissionVision } from '../../components/MissionVision';
import { Highlights } from '../../components/Highlights';
import { Room } from '../../lib/store';

interface LandingProps {
  rooms: Room[];
  onBook: (roomId: string) => void;
  onViewAllRooms: () => void;
}

export function Landing({ rooms, onBook, onViewAllRooms }: LandingProps) {
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
