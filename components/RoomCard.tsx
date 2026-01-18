import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { Room } from '../lib/store';

export function RoomCard({ room, onBook }: { room: Room; onBook: (id: string) => void }) {
  const [isImageOpen, setIsImageOpen] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-[#0A2342] dark:bg-[#153a66] text-[#F9F7F2] rounded-2xl overflow-hidden shadow-xl flex flex-col h-full transition-colors duration-300"
    >
      <div className="relative h-64 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsImageOpen(true)}
          className="block w-full h-full cursor-pointer"
          aria-label={`View ${room.name} photo`}
        >
          <img
            src={room.image}
            alt={room.name}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105 opacity-90 hover:opacity-100"
          />
        </button>
        <div className="absolute top-4 right-4 z-10 bg-[#D4AF37] text-[#0A2342] px-3 py-1 text-sm font-bold tracking-wider uppercase">
          ${room.price} / Night
        </div>
      </div>
      
      <div className="p-8 flex flex-col flex-1">
        <h3 className="text-2xl font-serif mb-2 text-[#D4AF37]">{room.name}</h3>
        <p className="text-[#F9F7F2]/70 text-sm leading-relaxed mb-6">{room.description}</p>
        
        <div className="space-y-3 mb-8 flex-1">
          {room.amenities.slice(0, 4).map((amenity, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-[#F9F7F2]/90">
              <Check className="w-3 h-3 text-[#D4AF37]" />
              <span className="tracking-wide uppercase text-xs">{amenity}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => onBook(room.id)}
          className="w-full py-4 border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#0A2342] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg"
        >
          Reserve
        </button>
      </div>

      {isImageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-10"
          onClick={() => setIsImageOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsImageOpen(false)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
              aria-label="Close image"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={room.image}
              alt={room.name}
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
