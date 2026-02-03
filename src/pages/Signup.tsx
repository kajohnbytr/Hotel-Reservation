import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { register } from '../services/authService';
import { Eye, EyeOff } from 'lucide-react';

export function Signup({ onSignup, onNavigateToLogin }: { onSignup: (user: any) => void, onNavigateToLogin: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isTermsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTermsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTermsOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setShowTermsError(true);
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const data = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password: password
      });
      console.log('Registration successful:', data);
      onSignup(data);
      // Optionally navigate to login instead
      // onNavigateToLogin();
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-bg-signup min-h-screen overflow-hidden relative flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-[#0A2342]/50" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 w-full max-w-md bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 p-10 shadow-2xl rounded-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-[#D4AF37]" />
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-2">Join Aurora</h1>
          <p className="text-[#0A2342]/50 dark:text-[#F9F7F2]/70 text-xs uppercase tracking-widest">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">Last Name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 pr-14 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#0A2342]/50 dark:text-[#F9F7F2]/60 hover:text-[#D4AF37] transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70">
            <input
              id="terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => {
                setAcceptedTerms(e.target.checked);
                if (e.target.checked) {
                  setShowTermsError(false);
                }
              }}
              className="mt-1 h-4 w-4 rounded border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 text-[#D4AF37] focus:ring-[#D4AF37]"
              required
            />
            <div className="leading-relaxed">
              I agree to Aurora's{" "}
              <button
                type="button"
                className="text-[#D4AF37] font-semibold hover:underline"
                onClick={() => setIsTermsOpen(true)}
              >
                Terms & Conditions
              </button>{" "}
              including the cancellation policy and house rules.
            </div>
          </div>
          {showTermsError && (
            <p className="text-xs text-[#D4AF37]">
              Please accept the terms to continue.
            </p>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !acceptedTerms}
            className="w-full bg-[#0A2342] hover:bg-[#153a66] text-[#F9F7F2] dark:bg-[#F9F7F2] dark:text-[#0A2342] dark:hover:bg-[#D4AF37] font-bold py-4 transition-colors disabled:opacity-70 uppercase tracking-widest text-xs rounded-lg"
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/70 text-sm">
            Already have an account?{' '}
            <button 
              onClick={onNavigateToLogin}
              className="text-[#D4AF37] font-bold hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </motion.div>

      {isTermsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(10, 35, 66, 0.65)' }}
          onClick={() => setIsTermsOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#D4AF37]/30 dark:border-[#D4AF37]/40 p-8 shadow-2xl text-[#0A2342] dark:text-[#F9F7F2]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-6 mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                  Aurora Resort
                </p>
                <h2 className="text-2xl font-serif text-[#0A2342] dark:text-[#F9F7F2]">
                  Terms & Policies
                </h2>
                <p className="text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70 mt-1">
                  Please review the following before completing your registration.
                </p>
              </div>
              <button
                type="button"
                className="text-xs uppercase tracking-widest px-4 py-2 rounded-lg border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#0A2342] transition-colors"
                onClick={() => setIsTermsOpen(false)}
              >
                Close
              </button>
            </div>
            <div
              className="text-sm space-y-5 text-[#0A2342]/80 dark:text-[#F9F7F2]/80"
              style={{ maxHeight: '60vh', overflowY: 'auto' }}
            >
              <div>
                <p className="font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest text-xs">
                  Reservations
                </p>
                <p className="mt-2 leading-relaxed">
                  A valid email is required for all reservations. Your account
                  details are stored locally on this device for demo purposes.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest text-xs">
                  Cancellation Policy
                </p>
                <p className="mt-2 leading-relaxed">
                  Cancellations within 48 hours of check-in may incur one night's
                  charge. Modifications are subject to availability.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest text-xs">
                  Check-in / Check-out
                </p>
                <p className="mt-2 leading-relaxed">
                  Standard check-in is 3:00 PM and check-out is 11:00 AM. Early
                  check-in or late check-out requests are not guaranteed.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest text-xs">
                  House Rules
                </p>
                <p className="mt-2 leading-relaxed">
                  Please respect quiet hours after 10:00 PM. Smoking is not allowed
                  inside rooms. Damages may be charged to the guest.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest text-xs">
                  Privacy
                </p>
                <p className="mt-2 leading-relaxed">
                  This demo stores data in your browser only. No information is
                  sent to a server.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}