import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, Users } from 'lucide-react';
import { Room } from '../lib/store';

export function RoomCard({ room, onBook }: { room: Room; onBook: (id: string) => void }) {
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    const shouldLock = isImageOpen || isDetailsOpen;
    if (!shouldLock) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isImageOpen, isDetailsOpen]);

  return (
    <motion.div
      whileHover={isDetailsOpen || isImageOpen ? undefined : { y: -5 }}
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
          ₱{room.price} / Night
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

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setIsDetailsOpen(true)}
            className="py-4 border border-[#F9F7F2]/20 text-[#F9F7F2] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg"
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => onBook(room.id)}
            className="py-4 bg-[#D4AF37] text-[#0A2342] hover:bg-[#e6c55b] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg"
          >
            Reserve
          </button>
        </div>
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

      {isDetailsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A2342]/70 backdrop-blur-md px-6 py-10"
          onClick={() => setIsDetailsOpen(false)}
        >
          <div
            className="relative w-[900px] max-w-[90vw] h-[500px] bg-[#F9F7F2] text-[#0A2342] rounded-xl shadow-2xl border border-[#D4AF37]/30 overflow-hidden"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute top-4 right-4">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="p-2 rounded-full border border-[#0A2342]/10 text-[#0A2342]/60 hover:text-[#0A2342] hover:bg-[#0A2342]/5 transition-colors"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-0">
              <div className="h-72 md:h-full">
                <img
                  src={room.image}
                  alt={room.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <div className="p-8 border-b border-[#0A2342]/10">
                  <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                    {room.type} Collection
                  </p>
                  <h4 className="text-2xl font-serif mt-1">{room.name}</h4>
                </div>
                <div className="p-8 flex-1 space-y-6">
                  <div className="flex items-center gap-6 text-sm text-[#0A2342]/70">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#D4AF37]" />
                      {room.maxGuests} Guests
                    </div>
                    <span className="text-[#0A2342]/30">|</span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-[#D4AF37] text-[10px] text-[#D4AF37]">
                        ☐
                      </span>
                      450 sq ft
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#0A2342]/50 font-semibold">
                      About this room
                    </p>
                    <p className="text-sm mt-3 text-[#0A2342]/80 leading-relaxed">
                      {room.description}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#0A2342]/50 font-semibold mb-3">
                      Amenities
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm text-[#0A2342]/80">
                      {room.amenities.map((amenity, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
                          {amenity}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#0A2342]/10 p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#0A2342]/50 font-semibold">
                      Price per night
                    </p>
                    <p className="text-2xl font-semibold text-[#D4AF37]">₱{room.price}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onBook(room.id)}
                    className="px-6 py-3 bg-[#0A2342] text-[#F9F7F2] hover:bg-[#153a66] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg"
                  >
                    Reserve Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
