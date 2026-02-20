import { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function StaffLogin({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

      // Ensure the account is a staff account
      const isStaff = data.role === 'staff' || data.isStaff || data.staff === true;
      if (!isStaff) {
        setError('This is not a staff account.');
        setIsLoading(false);
        return;
      }

      const name = [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email?.split('@')[0] || 'Staff';
      const user = { id: String(data._id), email: data.email, name };
      localStorage.setItem('aurora_user', JSON.stringify(user));
      if (data.token) localStorage.setItem('aurora_token', data.token);
      if (data.refreshToken) localStorage.setItem('aurora_refresh_token', data.refreshToken);
      onLogin(user);
    } catch {
      setError('Could not sign in. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-bg-login min-h-screen overflow-hidden relative flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-[#0A2342]/50" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 w-full max-w-md bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 p-10 shadow-2xl rounded-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-[#D4AF37]" />

        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-2">Staff Sign In</h1>
          <p className="text-[#0A2342]/50 dark:text-[#F9F7F2]/70 text-xs uppercase tracking-widest">Staff portal access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="you@hotel.com"
              className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-none"
            />
          </div>

          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm text-center font-medium" role="alert">
              {error}
            </p>
          )}

          <div>
            <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">Password</label>
            <div className="relative" style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 pr-11 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
              />
              <button
                type="button"
                tabIndex={0}
                onClick={() => setShowPassword((prev) => !prev)}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#D4AF37]/50 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5 shrink-0" /> : <Eye className="w-5 h-5 shrink-0" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#0A2342] hover:bg-[#153a66] text-[#F9F7F2] dark:bg-[#F9F7F2] dark:text-[#0A2342] dark:hover:bg-[#D4AF37] font-bold py-4 transition-colors disabled:opacity-70 uppercase tracking-widest text-xs rounded-lg"
          >
            {isLoading ? 'Signing in...' : 'Enter'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default StaffLogin;
