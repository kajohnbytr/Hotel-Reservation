import React from 'react';
import { motion } from 'motion/react';
import { Star, MapPin, Wifi, Coffee, Award } from 'lucide-react';
import { Hotel } from '../lib/mockData';

interface HotelCardProps {
  hotel: Hotel;
  onClick: (hotel: Hotel) => void;
}

export function HotelCard({ hotel, onClick }: HotelCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-teal-500/50 transition-all cursor-pointer group shadow-lg"
      onClick={() => onClick(hotel)}
    >
      <div className="relative h-64 overflow-hidden">
        <img 
          src={hotel.image} 
          alt={hotel.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 border border-slate-700">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-medium text-sm">{hotel.rating}</span>
        </div>
        {hotel.aiTag && (
          <div className="absolute top-4 left-4 bg-purple-600/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 border border-purple-500/50 shadow-lg shadow-purple-500/20">
            <Award className="w-3 h-3 text-white" />
            <span className="text-white font-bold text-xs uppercase tracking-wide">AI Pick: {hotel.aiTag}</span>
          </div>
        )}
      </div>
      
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-white group-hover:text-teal-400 transition-colors">{hotel.name}</h3>
        </div>
        
        <div className="flex items-center gap-1 text-slate-400 mb-4 text-sm">
          <MapPin className="w-4 h-4" />
          {hotel.location}
        </div>
        
        <div className="flex gap-3 mb-6 overflow-hidden">
          {hotel.amenities.slice(0, 3).map((amenity, i) => (
            <span key={i} className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-md whitespace-nowrap">
              {amenity}
            </span>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <div className="flex flex-col">
            <span className="text-slate-400 text-xs">Price per night</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-white">${hotel.price}</span>
            </div>
          </div>
          <button className="bg-slate-700 hover:bg-teal-500 hover:text-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            View Details
          </button>
        </div>
      </div>
    </motion.div>
  );
}
