import React from 'react';
import { motion } from 'motion/react';
import { Search, MapPin, Calendar, Sparkles } from 'lucide-react';

interface HeroProps {
  onAiRecommend: () => void;
  isAiLoading: boolean;
}

export function Hero({ onAiRecommend, isAiLoading }: HeroProps) {
  return (
    <div className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/2 w-full -translate-x-1/2 h-full z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
            Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-purple-500">Perfect Stay</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Experience the future of travel with AI-powered recommendations and secure blockchain bookings.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-4 shadow-2xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5 relative">
              <MapPin className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Where are you going?" 
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
            </div>
            <div className="md:col-span-4 relative">
              <Calendar className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Check-in - Check-out" 
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
            </div>
            <div className="md:col-span-3">
              <button 
                className="w-full h-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl py-3 transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-5 h-5" />
                Search
              </button>
            </div>
          </div>
          
          <div className="mt-4 flex justify-center">
             <button 
               onClick={onAiRecommend}
               disabled={isAiLoading}
               className="text-sm flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors disabled:opacity-50"
             >
               <Sparkles className={`w-4 h-4 ${isAiLoading ? 'animate-spin' : ''}`} />
               {isAiLoading ? 'Analyzing preferences...' : 'Ask AI for a recommendation'}
             </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
