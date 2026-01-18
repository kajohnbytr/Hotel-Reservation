import React, { useState } from 'react';
import { motion } from 'motion/react';
import { loginUser } from '../lib/store';

export function Login({ onLogin, onNavigateToSignup }: { onLogin: (user: any) => void, onNavigateToSignup: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      const user = loginUser(email, email.split('@')[0]);
      onLogin(user);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-md bg-white border border-[#0A2342]/10 p-10 shadow-2xl relative rounded-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-[#D4AF37]" />
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif text-[#0A2342] dark:text-[#0A2342] mb-2">Sign In</h1>
          <p className="text-[#0A2342]/50 dark:text-[#0A2342]/50 text-xs uppercase tracking-widest">Access your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-[#0A2342] uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#F9F7F2] border border-[#0A2342]/10 py-3 px-4 text-[#0A2342] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#0A2342] uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#F9F7F2] border border-[#0A2342]/10 py-3 px-4 text-[#0A2342] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#0A2342] hover:bg-[#153a66] text-[#F9F7F2] font-bold py-4 transition-colors disabled:opacity-70 uppercase tracking-widest text-xs rounded-lg"
          >
            {isLoading ? 'Processing...' : 'Enter'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[#0A2342]/60 text-sm">
            Don't have an account?{' '}
            <button 
              onClick={onNavigateToSignup}
              className="text-[#D4AF37] font-bold hover:underline"
            >
              Sign Up
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
