import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Star, ShieldCheck, Cpu, Calendar, CreditCard, CheckCircle } from 'lucide-react';
import { Hotel } from '../lib/mockData';
import { wait, generateBlockchainHash } from '../lib/utils';

interface HotelDetailsProps {
  hotel: Hotel | null;
  onClose: () => void;
  user: any;
  onLoginRequest: () => void;
  onBookingComplete: (booking: any) => void;
}

export function HotelDetails({ hotel, onClose, user, onLoginRequest, onBookingComplete }: HotelDetailsProps) {
  const [bookingState, setBookingState] = useState<'idle' | 'processing' | 'blockchain' | 'confirmed'>('idle');
  const [txHash, setTxHash] = useState('');

  if (!hotel) return null;

  const handleBook = async () => {
    if (!user) {
      onLoginRequest();
      return;
    }

    setBookingState('processing');
    await wait(1500); // Simulate backend processing
    
    setBookingState('blockchain');
    await wait(2000); // Simulate blockchain mining
    
    const hash = generateBlockchainHash();
    setTxHash(hash);
    setBookingState('confirmed');
    
    onBookingComplete({
      id: Math.random().toString(36).substr(2, 9),
      hotelId: hotel.id,
      date: new Date().toISOString().split('T')[0],
      guests: 2,
      totalPrice: hotel.price,
      blockchainHash: hash,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="absolute top-4 right-4 z-10">
            <button onClick={onClose} className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-md transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 h-full overflow-y-auto md:overflow-hidden">
            <div className="h-64 md:h-full relative">
              <img src={hotel.image} alt={hotel.name} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 to-transparent p-6 pt-20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded text-xs font-bold uppercase tracking-wider">
                    Verified Stay
                  </span>
                  {hotel.aiTag && (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> AI Recommended
                    </span>
                  )}
                </div>
                <h2 className="text-3xl font-bold text-white">{hotel.name}</h2>
                <div className="flex items-center gap-2 text-slate-300 mt-1">
                  <MapPin className="w-4 h-4" /> {hotel.location}
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 flex flex-col h-full overflow-y-auto bg-slate-900">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <span className="text-xl font-bold text-white">{hotel.rating}</span>
                    <span className="text-slate-500 text-sm">(124 reviews)</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-teal-400">₱{hotel.price}</div>
                    <div className="text-slate-500 text-xs">per night</div>
                  </div>
                </div>

                <p className="text-slate-300 leading-relaxed mb-6">
                  {hotel.description}
                </p>

                <div className="mb-8">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Amenities</h4>
                  <div className="flex flex-wrap gap-2">
                    {hotel.amenities.map((amenity, i) => (
                      <span key={i} className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-sm border border-slate-700">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Booking Section */}
              <div className="mt-auto bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                {bookingState === 'idle' && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-slate-300 text-sm">Total (1 night)</span>
                      <span className="text-white font-bold">₱{hotel.price}</span>
                    </div>
                    <button 
                      onClick={handleBook}
                      className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-slate-900 font-bold py-3 rounded-xl transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-5 h-5" />
                      Book with Blockchain
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-3 flex items-center justify-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Secure Transaction via Smart Contract
                    </p>
                  </>
                )}

                {bookingState === 'processing' && (
                  <div className="text-center py-4">
                    <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-slate-300 font-medium">Processing payment...</p>
                  </div>
                )}

                {bookingState === 'blockchain' && (
                  <div className="text-center py-4">
                    <div className="animate-pulse w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <ShieldCheck className="w-6 h-6 text-purple-400" />
                    </div>
                    <p className="text-purple-300 font-medium">Mining transaction block...</p>
                    <p className="text-xs text-slate-500 mt-1 font-mono">Verifying smart contract...</p>
                  </div>
                )}

                {bookingState === 'confirmed' && (
                  <div className="text-center py-2">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    </div>
                    <h4 className="text-white font-bold text-lg mb-1">Booking Confirmed!</h4>
                    <div className="bg-slate-900 p-2 rounded border border-slate-700 mt-2 mb-2">
                      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Blockchain Hash</p>
                      <p className="text-xs font-mono text-teal-400 break-all">{txHash}</p>
                    </div>
                    <button onClick={onClose} className="text-sm text-slate-400 hover:text-white mt-2">
                      Close and View Dashboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
