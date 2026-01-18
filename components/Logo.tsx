import React from 'react';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/logo.png"
        alt="Aurora logo"
        className="w-8 h-8 object-contain"
      />
      <span className="text-xl font-serif tracking-widest text-[#0A2342] dark:text-[#F9F7F2] uppercase">
        Aurora
      </span>
    </div>
  );
}
