import { useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, Users, Calendar, Home } from 'lucide-react';
import { ReceptionDesk } from './ReceptionDesk';
import { User } from '../lib/store';

interface StaffDashboardProps {
  user: User;
}

export function StaffDashboard({ user }: StaffDashboardProps) {
  const [activeView, setActiveView] = useState<'overview' | 'reception'>('reception');

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0A2342]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0A2342] to-[#153a66] dark:from-[#05152a] dark:to-[#0A2342] text-[#F9F7F2] py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-serif mb-2">Staff Dashboard</h1>
          <p className="text-[#F9F7F2]/70">Welcome back, {user.name}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-[#0A2342] border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10">
        <div className="max-w-7xl mx-auto px-6 flex gap-8">
          <button
            onClick={() => setActiveView('overview')}
            className={`py-4 px-2 font-semibold text-sm uppercase tracking-widest transition-colors border-b-2 ${
              activeView === 'overview'
                ? 'text-[#0A2342] dark:text-[#F9F7F2] border-[#D4AF37]'
                : 'text-[#0A2342]/60 dark:text-[#F9F7F2]/60 border-transparent hover:text-[#0A2342] dark:hover:text-[#F9F7F2]'
            }`}
          >
            <span className="flex items-center gap-2">
              <BarChart3 size={18} />
              Overview
            </span>
          </button>
          <button
            onClick={() => setActiveView('reception')}
            className={`py-4 px-2 font-semibold text-sm uppercase tracking-widest transition-colors border-b-2 ${
              activeView === 'reception'
                ? 'text-[#0A2342] dark:text-[#F9F7F2] border-[#D4AF37]'
                : 'text-[#0A2342]/60 dark:text-[#F9F7F2]/60 border-transparent hover:text-[#0A2342] dark:hover:text-[#F9F7F2]'
            }`}
          >
            <span className="flex items-center gap-2">
              <Home size={18} />
              Reception
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      {activeView === 'overview' && (
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-[#0A2342]/60 dark:text-[#F9F7F2]/60 uppercase tracking-widest">
                    Total Guests
                  </p>
                  <p className="text-3xl font-bold text-[#0A2342] dark:text-[#F9F7F2]">24</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-[#0A2342]/60 dark:text-[#F9F7F2]/60 uppercase tracking-widest">
                    Reservations
                  </p>
                  <p className="text-3xl font-bold text-[#0A2342] dark:text-[#F9F7F2]">12</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 rounded-lg p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <Home className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-[#0A2342]/60 dark:text-[#F9F7F2]/60 uppercase tracking-widest">
                    Available Rooms
                  </p>
                  <p className="text-3xl font-bold text-[#0A2342] dark:text-[#F9F7F2]">8</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-r from-[#0A2342] to-[#153a66] dark:from-[#05152a] dark:to-[#0A2342] text-[#F9F7F2] rounded-lg p-8"
          >
            <h2 className="text-2xl font-serif mb-2">Staff Management Portal</h2>
            <p className="text-[#F9F7F2]/70 mb-4">
              Manage all hotel operations from here. View reservations, check room availability, and manage guest check-ins and check-outs.
            </p>
            <button
              onClick={() => setActiveView('reception')}
              className="px-6 py-2 bg-[#F9F7F2] text-[#0A2342] hover:bg-[#D4AF37] font-bold uppercase tracking-widest text-xs rounded-lg transition-colors"
            >
              Go to Reception Desk
            </button>
          </motion.div>
        </div>
      )}

      {activeView === 'reception' && (
        <div className="pt-0">
          <ReceptionDesk />
        </div>
      )}
    </div>
  );
}

export default StaffDashboard;
