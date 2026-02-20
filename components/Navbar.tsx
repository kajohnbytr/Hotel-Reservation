import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, User, Sun, Moon } from 'lucide-react';
import { Logo } from './Logo';
import { useTheme } from '../lib/theme';

interface NavbarProps {
  user: any;
  onNavigate: (page: string) => void;
  currentPage: string;
  onLogout: () => void;
}

export function Navbar({ user, onNavigate, currentPage, onLogout }: NavbarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { theme, toggleTheme } = useTheme();

  const NavLink = ({ page, label }: { page: string; label: string }) => (
    <button
      onClick={() => {
        onNavigate(page);
        setIsOpen(false);
      }}
      className={`text-sm font-medium tracking-wide transition-colors uppercase ${
        currentPage === page ? 'text-[#D4AF37]' : 'text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F9F7F2]/90 dark:bg-[#0A2342]/90 backdrop-blur-md border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <button onClick={() => onNavigate('home')}>
            <Logo className="dark:text-[#F9F7F2]" />
          </button>

          <div className="hidden md:flex items-center space-x-10">
            <NavLink page="home" label="Home" />
            <NavLink page="rooms" label="Rooms" />
            {user && <NavLink page="dashboard" label="Dashboard" />}
            
            <button 
              onClick={toggleTheme}
              className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37] transition-colors"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {user ? (
              <div className="flex items-center gap-6">
                <span className="text-xs text-[#0A2342]/70 dark:text-[#F9F7F2]/70 uppercase tracking-widest">Hi, {user.name}</span>
                <button
                  onClick={onLogout}
                  className="px-6 py-2 text-xs font-bold text-[#F9F7F2] bg-[#0A2342] hover:bg-[#D4AF37] hover:text-[#0A2342] dark:bg-[#F9F7F2] dark:text-[#0A2342] dark:hover:bg-[#D4AF37] transition-colors uppercase tracking-widest rounded-lg"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="px-6 py-2 text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] border border-[#0A2342] dark:border-[#F9F7F2] hover:bg-[#0A2342] hover:text-[#F9F7F2] dark:hover:bg-[#F9F7F2] dark:hover:text-[#0A2342] transition-colors uppercase tracking-widest rounded-lg"
              >
                Sign In
              </button>
            )}
          </div>

          <div className="md:hidden flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="text-[#0A2342] dark:text-[#F9F7F2]"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={() => setIsOpen(!isOpen)} className="text-[#0A2342] dark:text-[#F9F7F2]">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#F9F7F2] dark:bg-[#0A2342] border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10 overflow-hidden"
          >
            <div className="px-6 py-8 flex flex-col space-y-6 items-center">
              <NavLink page="home" label="Home" />
              <NavLink page="rooms" label="Rooms" />
              {user && <NavLink page="dashboard" label="Dashboard" />}
              <div className="pt-6 border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/10 w-full flex justify-center">
                {user ? (
                  <button onClick={onLogout} className="text-[#0A2342] dark:text-[#F9F7F2] uppercase text-sm tracking-widest">
                    Logout
                  </button>
                ) : (
                  <button onClick={() => { onNavigate('login'); setIsOpen(false); }} className="text-[#0A2342] dark:text-[#F9F7F2] uppercase text-sm tracking-widest">
                    Sign In
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
