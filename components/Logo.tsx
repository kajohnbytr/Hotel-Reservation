import React from 'react';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] flex items-center justify-center">
        <div className="w-4 h-4 bg-[#D4AF37] rounded-md transform rotate-45"></div>
      </div>
      <span className="text-xl font-serif tracking-widest text-[#0A2342] dark:text-[#F9F7F2] uppercase">
        Aurora
      </span>
    </div>
  );
}
