import { useState } from 'react';
import { motion } from 'motion/react';
import { Logo } from '../components/Logo';
import { getApiBaseUrl } from '../lib/api';
import { setAuthItem } from '../lib/authSession';
import { useTheme } from '../lib/theme';
import { Sun, Moon } from 'lucide-react';

const API_BASE = getApiBaseUrl();

interface AdminLoginProps {
  onLogin: (user: any) => void;
  onNavigateToHome?: () => void;
  onNavigate?: (page: string) => void;
}

export function AdminLogin({ onLogin, onNavigateToHome, onNavigate }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Invalid credentials');
        setIsLoading(false);
        return;
      }

      const isAdmin = data.role === 'admin';
      if (!isAdmin) {
        setError('This is not an admin account.');
        setIsLoading(false);
        return;
      }

      const name =
        [data.firstName, data.lastName].filter(Boolean).join(' ') ||
        data.email?.split('@')[0] ||
        'Admin';
      const user = { id: String(data._id), email: data.email, name, role: 'admin' as const };
      setAuthItem('aurora_user', JSON.stringify(user));
      if (data.token) setAuthItem('aurora_token', data.token);
      if (data.refreshToken) setAuthItem('aurora_refresh_token', data.refreshToken);
      onLogin(user);
    } catch {
      setError('Could not sign in. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] dark:bg-[#0d1929] flex flex-col">
      <header className="border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10 bg-[#F9F7F2] dark:bg-[#0A2342]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-16">
          <button
            type="button"
            onClick={() => (onNavigateToHome ? onNavigateToHome() : onNavigate?.('home'))}
            className="flex items-center gap-2"
          >
            <Logo className="text-[#0A2342] dark:text-[#F9F7F2]" />
          </button>
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => onNavigate?.('home')}
              className="text-sm font-medium text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wide hover:opacity-80"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('rooms')}
              className="text-sm font-medium text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wide hover:opacity-80"
            >
              Rooms
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="text-[#0A2342] dark:text-[#F9F7F2] p-1"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/20 rounded-xl shadow-xl p-8"
        >
          <h1 className="text-2xl font-bold text-[#0A2342] dark:text-[#F9F7F2] text-center mb-1">
            Admin Portal
          </h1>
          <p className={`text-xs uppercase tracking-widest text-center mb-8 ${theme === 'dark' ? 'text-white' : 'text-[#0A2342]/60'}`}>
            Full access control
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="admin@example.com"
                className={`w-full border py-3 px-4 rounded focus:outline-none focus:ring-2 ${theme === 'dark' ? 'bg-[#05152a] border-[#F9F7F2]/30 text-white placeholder:text-white/90 focus:ring-[#D4AF37]/30' : 'bg-[#F5F0E8] border-[#0A2342]/15 text-[#0A2342] placeholder-[#0A2342]/50 focus:ring-[#0A2342]/30'}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="••••••••"
                className={`w-full border py-3 px-4 rounded focus:outline-none focus:ring-2 ${theme === 'dark' ? 'bg-[#05152a] border-[#F9F7F2]/30 text-white placeholder:text-white/90 focus:ring-[#D4AF37]/30' : 'bg-[#F5F0E8] border-[#0A2342]/15 text-[#0A2342] placeholder-[#0A2342]/50 focus:ring-[#0A2342]/30'}`}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 text-center" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => (onNavigateToHome ? onNavigateToHome() : onNavigate?.('home'))}
                className={`text-sm font-semibold uppercase tracking-wider hover:underline ${theme === 'dark' ? 'text-white' : 'text-[#0A2342]'}`}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-3 bg-[#0A2342] dark:bg-[#153a66] text-[#F9F7F2] font-bold uppercase tracking-widest text-xs rounded hover:bg-[#153a66] dark:hover:bg-[#D4AF37] dark:hover:text-[#0A2342] transition-colors disabled:opacity-70"
              >
                {isLoading ? 'Signing in...' : 'Login'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default AdminLogin;

