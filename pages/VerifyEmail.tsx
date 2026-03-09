// src/pages/VerifyEmail.tsx
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type Status = 'verifying' | 'success' | 'error' | 'pending';

export function VerifyEmail({
  onNavigateToLogin,
  pendingEmail,
  verifyToken,
}: {
  onNavigateToLogin: () => void;
  pendingEmail?: string;
  verifyToken?: string;
}) {
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState(pendingEmail || '');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

  const token = verifyToken || new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    if (!token) {
      setStatus('pending');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/verify-email?token=${token}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully.');
        } else {
          setStatus('error');
          setMessage(data.message || 'Verification failed. The link may have expired.');
        }
      } catch {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    })();
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendStatus('sending');
    setResendMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/users/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResendStatus('sent');
        setResendMessage('A new verification email has been sent. Check your inbox.');
      } else {
        setResendStatus('error');
        setResendMessage(data.message || 'Failed to resend. Please try again.');
      }
    } catch {
      setResendStatus('error');
      setResendMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="auth-bg-signup min-h-screen overflow-hidden relative flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-[#0A2342]/50" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 p-10 shadow-2xl rounded-2xl overflow-hidden text-center"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-[#D4AF37]" />

        {status === 'verifying' && (
          <>
            <Spinner />
            <h1 className="mt-6 text-2xl font-serif text-[#0A2342] dark:text-[#F9F7F2]">Verifying…</h1>
            <p className="mt-2 text-sm text-[#0A2342]/60 dark:text-[#F9F7F2]/60">Please wait while we confirm your email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <IconCircle color="#D4AF37">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </IconCircle>
            <h1 className="mt-6 text-2xl font-serif text-[#0A2342] dark:text-[#F9F7F2]">Email Verified!</h1>
            <p className="mt-3 text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70 leading-relaxed">{message}</p>
            <button
              onClick={onNavigateToLogin}
              className="mt-8 w-full bg-[#0A2342] hover:bg-[#153a66] dark:bg-[#F9F7F2] dark:text-[#0A2342] dark:hover:bg-[#D4AF37] text-[#F9F7F2] font-bold py-4 transition-colors uppercase tracking-widest text-xs rounded-lg"
            >
              Sign In
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <IconCircle color="#f87171">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </IconCircle>
            <h1 className="mt-6 text-2xl font-serif text-[#0A2342] dark:text-[#F9F7F2]">Verification Failed</h1>
            <p className="mt-3 text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70 leading-relaxed">{message}</p>
            <div className="mt-8 space-y-3 text-left">
              <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider">Resend to</label>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
              />
              <ResendButton status={resendStatus} onClick={handleResend} disabled={!resendEmail} />
              {resendMessage && <ResendMessage status={resendStatus} message={resendMessage} />}
            </div>
            <button onClick={onNavigateToLogin} className="mt-5 text-sm text-[#D4AF37] font-bold hover:underline">Back to Sign In</button>
          </>
        )}

        {status === 'pending' && (
          <>
            <IconCircle color="#D4AF37">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="#D4AF37" strokeWidth="2" />
                <path d="M2 8l10 7 10-7" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </IconCircle>
            <h1 className="mt-6 text-2xl font-serif text-[#0A2342] dark:text-[#F9F7F2]">Check Your Inbox</h1>
            <p className="mt-3 text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70 leading-relaxed">
              We sent a verification link to{' '}
              {pendingEmail
                ? <span className="font-semibold text-[#0A2342] dark:text-[#F9F7F2]">{pendingEmail}</span>
                : 'your email address'}.{' '}
              Click the link in that email to activate your account.
            </p>
            <p className="mt-2 text-xs text-[#0A2342]/45 dark:text-[#F9F7F2]/45">
              The link expires in 24 hours. Check your spam folder if you don't see it.
            </p>
            <div className="mt-8 border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/10 pt-6 space-y-3 text-left">
              <p className="text-xs uppercase tracking-widest font-bold text-[#0A2342]/50 dark:text-[#F9F7F2]/50 text-center">Didn't receive it?</p>
              {!pendingEmail && (
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
                />
              )}
              <ResendButton status={resendStatus} onClick={handleResend} disabled={!resendEmail} />
              {resendMessage && <ResendMessage status={resendStatus} message={resendMessage} />}
            </div>
            <button onClick={onNavigateToLogin} className="mt-5 text-sm text-[#D4AF37] font-bold hover:underline">Back to Sign In</button>
          </>
        )}
      </motion.div>
    </div>
  );
}

function IconCircle({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${color}22` }}>
        {children}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center">
      <svg className="animate-spin h-14 w-14" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="#D4AF37" strokeWidth="3" />
        <path className="opacity-80" fill="#D4AF37" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );
}

function ResendButton({ status, onClick, disabled }: { status: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={status === 'sending' || status === 'sent' || disabled}
      className="w-full bg-[#0A2342] hover:bg-[#153a66] dark:bg-[#F9F7F2] dark:text-[#0A2342] dark:hover:bg-[#D4AF37] text-[#F9F7F2] font-bold py-4 transition-colors disabled:opacity-60 uppercase tracking-widest text-xs rounded-lg"
    >
      {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Email Sent ✓' : 'Resend Verification Email'}
    </button>
  );
}

function ResendMessage({ status, message }: { status: string; message: string }) {
  return (
    <p className={`text-xs text-center ${status === 'sent' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
      {message}
    </p>
  );
}