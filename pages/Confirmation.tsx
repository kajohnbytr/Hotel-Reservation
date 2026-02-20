import React from 'react';
import { motion } from 'motion/react';
import { Booking, ROOMS } from '../lib/store';
import { formatDate } from '../lib/utils';
import { Check, Download } from 'lucide-react';

interface ConfirmationPageProps {
  booking: Booking;
  onDashboard: () => void;
}

export function ConfirmationPage({ booking, onDashboard }: ConfirmationPageProps) {
  const room = ROOMS.find(r => r.id === booking.roomId);

  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#0A2342] text-[#F9F7F2] p-10 md:p-14 shadow-2xl relative rounded-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-[#D4AF37]" />
        
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-[#D4AF37] text-[#0A2342] rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif text-[#F9F7F2] mb-2">Confirmed</h1>
          <p className="text-[#D4AF37] uppercase tracking-widest text-xs">Your sanctuary awaits</p>
        </div>

        <div className="border border-[#F9F7F2]/10 p-8 mb-10 rounded-xl">
          <div className="grid grid-cols-2 gap-y-6 text-sm">
            <div className="text-[#F9F7F2]/60">Confirmation ID</div>
            <div className="text-right font-mono text-[#D4AF37]">{booking.id}</div>
            
            <div className="text-[#F9F7F2]/60">Room</div>
            <div className="text-right">{room?.name}</div>
            
            <div className="text-[#F9F7F2]/60">Date</div>
            <div className="text-right">{formatDate(booking.date)}</div>
            
            <div className="text-[#F9F7F2]/60">Total</div>
            <div className="text-right text-[#D4AF37] text-lg font-serif">₱{booking.totalPrice}</div>
          </div>
        </div>

        <div className="mb-10">
          <h4 className="text-[10px] uppercase tracking-widest text-[#F9F7F2]/40 mb-3 text-center">Blockchain Verification</h4>
          <div className="bg-[#05152a] p-4 border border-[#D4AF37]/30 rounded-lg">
            <code className="text-[10px] text-[#F9F7F2]/80 font-mono break-all block text-center">
              {booking.txHash}
            </code>
          </div>
        </div>

        <button
          onClick={onDashboard}
          className="w-full py-4 bg-[#D4AF37] text-[#0A2342] font-bold uppercase tracking-widest text-xs hover:bg-white transition-colors rounded-lg"
        >
          View in Dashboard
        </button>
      </motion.div>
    </div>
  );
}
