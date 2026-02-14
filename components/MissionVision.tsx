import React from 'react';
import { Target, Compass } from 'lucide-react';
import { motion } from 'motion/react';

export function MissionVision() {
  return (
    <section className="py-24 bg-[#F9F7F2] dark:bg-[#0A2342] border-b border-[#0A2342]/5 dark:border-[#F9F7F2]/5 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 lg:gap-24 relative">
          
          {/* Vertical Divider for Desktop */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-[#0A2342]/10 dark:bg-[#F9F7F2]/10 -translate-x-1/2" />

          {/* Mission */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="flex flex-col items-center text-center group"
          >
            <div className="w-16 h-16 rounded-full border border-[#D4AF37]/30 bg-[#0A2342]/5 dark:bg-[#F9F7F2]/5 flex items-center justify-center mb-6 group-hover:bg-[#D4AF37] group-hover:text-[#0A2342] transition-colors duration-500">
              <Target className="w-6 h-6 text-[#0A2342] dark:text-[#F9F7F2] group-hover:text-[#F9F7F2] dark:group-hover:text-[#0A2342] transition-colors duration-500" />
            </div>
            <h3 className="text-3xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">Our Mission</h3>
            <div className="w-12 h-0.5 bg-[#D4AF37] mb-6"></div>
            <p className="text-[#0A2342]/70 dark:text-[#F9F7F2]/70 leading-relaxed max-w-sm">
              To curate a sanctuary of serenity where the timeless beauty of nature harmonizes with transparent, cutting-edge technology, ensuring every stay is as secure as it is unforgettable.
            </p>
          </motion.div>

          {/* Vision */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex flex-col items-center text-center group"
          >
            <div className="w-16 h-16 rounded-full border border-[#D4AF37]/30 bg-[#0A2342]/5 dark:bg-[#F9F7F2]/5 flex items-center justify-center mb-6 group-hover:bg-[#D4AF37] group-hover:text-[#0A2342] transition-colors duration-500">
              <Compass className="w-6 h-6 text-[#0A2342] dark:text-[#F9F7F2] group-hover:text-[#F9F7F2] dark:group-hover:text-[#0A2342] transition-colors duration-500" />
            </div>
            <h3 className="text-3xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">Our Vision</h3>
            <div className="w-12 h-0.5 bg-[#D4AF37] mb-6"></div>
            <p className="text-[#0A2342]/70 dark:text-[#F9F7F2]/70 leading-relaxed max-w-sm">
              To be the global beacon of minimalist luxury, redefining hospitality by proving that authentic human connection and digital innovation can coexist seamlessly in the heart of the wilderness.
            </p>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
