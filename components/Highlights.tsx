import React from 'react';
import { motion } from 'motion/react';
import { Waves, Dumbbell, Utensils, Wind } from 'lucide-react';

const highlights = [
  {
    id: 1,
    title: 'Sky Infinity Pool',
    description: 'Float above the horizon in our temperature-controlled rooftop pool. The perfect vantage point for sunset.',
    image: 'https://images.unsplash.com/photo-1572226372001-f4880374b677?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyb29mdG9wJTIwaW5maW5pdHklMjBwb29sJTIwbmlnaHR8ZW58MXx8fHwxNzY4NzYxOTczfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    icon: Waves,
  },
  {
    id: 2,
    title: 'Zen Wellness Studio',
    description: 'State-of-the-art equipment meets tranquil design. Private yoga sessions and personal training available.',
    image: 'https://images.unsplash.com/photo-1540558870477-e8c59bf88421?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBob3RlbCUyMGd5bSUyMHdlbGxuZXNzfGVufDF8fHx8MTc2ODc2MTk3M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    icon: Dumbbell,
  },
  {
    id: 3,
    title: 'Lumina Dining',
    description: 'Farm-to-table gastronomy in an atmospheric setting. Experience culinary art that engages all senses.',
    image: 'https://images.unsplash.com/photo-1766832255363-c9f060ade8b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmaW5lJTIwZGluaW5nJTIwcmVzdGF1cmFudCUyMGRhcmslMjBhdG1vc3BoZXJlfGVufDF8fHx8MTc2ODc2MTk3M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    icon: Utensils,
  },
];

export function Highlights() {
  return (
    <section className="py-24 bg-white dark:bg-[#05152a]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">Elevated Amenities</h2>
          <div className="w-12 h-0.5 bg-[#D4AF37] mx-auto mb-6"></div>
          <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 max-w-2xl mx-auto">
            Beyond the room, discover spaces designed to rejuvenate your spirit and awaken your senses.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {highlights.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2, duration: 0.8 }}
              viewport={{ once: true }}
              className="group relative h-[400px] overflow-hidden cursor-pointer rounded-2xl"
            >
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A2342]/90 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
              
              <div className="absolute bottom-0 left-0 p-8 w-full">
                <div className="flex items-center gap-3 mb-3 text-[#D4AF37]">
                  <item.icon className="w-6 h-6" />
                  <h3 className="text-xl font-serif text-[#F9F7F2]">{item.title}</h3>
                </div>
                <p className="text-[#F9F7F2]/80 text-sm leading-relaxed translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
