import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { getApiBaseUrl } from '../lib/api';
import { setAuthItem } from '../lib/authSession';

const API_BASE = getApiBaseUrl();

function parseMathCaptcha(prompt: string) {
  if (!prompt) return null;
  const strictMatch = prompt.match(/what\s+is\s+(\d+)\s*([+\-])\s*(\d+)\?/i);
  if (strictMatch) {
    return {
      left: strictMatch[1],
      operator: strictMatch[2],
      right: strictMatch[3],
    };
  }

  const looseMatch = prompt.match(/(\d+)\s*([+\-])\s*(\d+)/);
  if (looseMatch) {
    return {
      left: looseMatch[1],
      operator: looseMatch[2],
      right: looseMatch[3],
    };
  }

  return null;
}

export function Login({
  onLogin,
  onNavigateToSignup,
  onNavigateToVerify,
}: {
  onLogin: (user: any) => void;
  onNavigateToSignup: () => void;
  onNavigateToVerify?: (email: string) => void;
}) {
  const preventSpaceKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ') e.preventDefault();
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasCredentialError, setHasCredentialError] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState<number | null>(null);
  const [adminSetupRequired, setAdminSetupRequired] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaPrompt, setCaptchaPrompt] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaError, setCaptchaError] = useState('');

  // Forgot password
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  useEffect(() => {
    if (!showForgotModal) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForgotModal(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showForgotModal]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/users/admin-exists`)
      .then((res) => (res.ok ? res.json() : { adminExists: true }))
      .then((data) => {
        if (cancelled) return;
        setAdminSetupRequired(!data?.adminExists);
        setAdminCheckDone(true);
      })
      .catch(() => {
        if (!cancelled) setAdminCheckDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCaptcha = async (clearAnswer = true) => {
    setCaptchaLoading(true);
    setCaptchaError('');
    try {
      const res = await fetch(`${API_BASE}/api/users/captcha`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCaptchaError('Could not load CAPTCHA. Please refresh.');
        setCaptchaId('');
        setCaptchaPrompt('');
      } else {
        setCaptchaId(typeof data.captchaId === 'string' ? data.captchaId : '');
        setCaptchaPrompt(typeof data.prompt === 'string' ? data.prompt : '');
      }
    } catch {
      setCaptchaError('Could not load CAPTCHA. Please refresh.');
      setCaptchaId('');
      setCaptchaPrompt('');
    } finally {
      if (clearAnswer) setCaptchaAnswer('');
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    loadCaptcha(true);
  }, []);

  // Countdown when locked out
  useEffect(() => {
    if (lockoutSecondsLeft == null || lockoutSecondsLeft <= 0) return;
    const t = setInterval(() => {
      setLockoutSecondsLeft((s) => {
        if (s == null) return null;
        const next = Math.max(0, s - 1);
        if (next === 0) {
          setError('');
          setRemainingAttempts(null);
          setHasCredentialError(false);
          return null;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [lockoutSecondsLeft]);

  const clearErrors = () => {
    setError('');
    setHasCredentialError(false);
    setRemainingAttempts(null);
  };

  const parsedCaptcha = parseMathCaptcha(captchaPrompt);
  const expectedCaptchaValue = parsedCaptcha
    ? Number(parsedCaptcha.left) + (parsedCaptcha.operator === '-' ? -Number(parsedCaptcha.right) : Number(parsedCaptcha.right))
    : null;
  const normalizedCaptchaAnswer = captchaAnswer.trim();
  const isCaptchaEmpty = !captchaLoading && normalizedCaptchaAnswer.length === 0;
  const isCaptchaCorrect =
    !captchaLoading &&
    normalizedCaptchaAnswer.length > 0 &&
    expectedCaptchaValue != null &&
    Number(normalizedCaptchaAnswer) === expectedCaptchaValue;
  const isCaptchaIncorrect =
    !captchaLoading &&
    normalizedCaptchaAnswer.length > 0 &&
    expectedCaptchaValue != null &&
    Number(normalizedCaptchaAnswer) !== expectedCaptchaValue;
  const emailAtLimit = email.length >= 64;
  const passwordAtLimit = password.length >= 64;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForgotError(data.message || 'Could not send OTP.');
        setForgotLoading(false);
        return;
      }
      setForgotSuccess(data.message || 'OTP sent to your email.');
      if (data.otpForDev) {
        setDevOtp(data.otpForDev);
        setOtp(data.otpForDev);
      } else {
        setDevOtp(null);
        setOtp('');
      }
      setNewPassword('');
      setConfirmPassword('');
      setForgotStep(2);
    } catch {
      setForgotError('Could not send OTP. Try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    const { validatePassword } = await import('../lib/passwordPolicy');
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      setForgotError(pwCheck.message || 'Password does not meet requirements.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), otp: otp.trim(), newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForgotError(data.message || 'Reset failed.');
        setForgotLoading(false);
        return;
      }
      setForgotSuccess('Password reset successful. You can sign in now.');
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotEmail('');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setForgotError('');
        setForgotSuccess('');
        setDevOtp(null);
      }, 2000);
    } catch {
      setForgotError('Reset failed. Try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHasCredentialError(false);
    if (adminSetupRequired) {
      setError('System setup required: no admin account exists yet.');
      return;
    }
    if (!captchaId || !captchaPrompt) {
      setError('CAPTCHA is not ready. Please refresh and try again.');
      return;
    }
    if (!captchaAnswer.trim()) {
      setError('Please answer the CAPTCHA first.');
      return;
    }
    if (lockoutSecondsLeft != null && lockoutSecondsLeft > 0) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          captchaId,
          captchaAnswer: captchaAnswer.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await loadCaptcha(true);
        if (res.status === 400 && data.code === 'CAPTCHA_REQUIRED') {
          setIsLoading(false);
          return;
        }
        if (res.status === 403 && data.unverified) {
          onNavigateToVerify?.(email);
          return;
        }
        if (res.status === 429) {
          setLockoutSecondsLeft(typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : 10 * 60);
          setError(data.message || 'Too many failed attempts. You can try again in 10 minutes.');
          setRemainingAttempts(0);
        } else {
          setRemainingAttempts(typeof data.remainingAttempts === 'number' ? data.remainingAttempts : null);
          if (data.lockedUntil && data.retryAfterSeconds) {
            setLockoutSecondsLeft(data.retryAfterSeconds);
            setError(data.message || 'Account temporarily locked. Try again later.');
            setPassword('');
          } else {
            setHasCredentialError(true);
            setError('Incorrect Email or Password');
            setPassword('');
          }
        }
        setIsLoading(false);
        return;
      }
      setRemainingAttempts(null);
      setLockoutSecondsLeft(null);
      setHasCredentialError(false);
      const name = [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email?.split('@')[0] || 'User';
      const user = { id: String(data._id), email: data.email, name, role: (data.role === 'staff' ? 'staff' : 'guest') as 'guest' | 'staff' };
      setAuthItem('aurora_user', JSON.stringify(user));
      if (data.token) setAuthItem('aurora_token', data.token);
      if (data.refreshToken) setAuthItem('aurora_refresh_token', data.refreshToken);
      onLogin(user);
    } catch {
      setHasCredentialError(true);
      setError('Incorrect Email or Password');
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
          <h1 className="text-3xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-2">Sign In</h1>
          <p className="text-[#0A2342]/50 dark:text-[#F9F7F2]/70 text-xs uppercase tracking-widest">Access your account</p>
        </div>

        {adminSetupRequired && adminCheckDone && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            System setup required: <strong>no admin account exists yet</strong>. Please ask the administrator to create the first admin account.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              required
              maxLength={64}
              value={email}
              onKeyDown={preventSpaceKey}
              onChange={(e) => { setEmail(e.target.value.replace(/\s/g, '').slice(0, 64)); clearErrors(); }}
              placeholder="you@gmail.com"
              style={hasCredentialError ? { borderColor: '#f87171' } : undefined}
              className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-none"
            />
            {emailAtLimit && (
              <p className="mt-1.5 text-xs text-[#D4AF37]">Limit reached: maximum 64 characters.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">Password</label>
            <div className="relative" style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                maxLength={64}
                value={password}
                onKeyDown={preventSpaceKey}
                onChange={(e) => { setPassword(e.target.value.replace(/\s/g, '').slice(0, 64)); clearErrors(); }}
                placeholder="••••••••"
                style={hasCredentialError ? { borderColor: '#f87171' } : undefined}
                className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 pr-11 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] transition-colors rounded-lg"
              />
              {passwordAtLimit && (
                <p className="mt-1.5 text-xs text-[#D4AF37]">Limit reached: maximum 64 characters.</p>
              )}
              <button
                type="button"
                tabIndex={0}
                onClick={() => setShowPassword((prev) => !prev)}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                className="text-[#0A2342] dark:text-[#F9F7F2] hover:text-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#D4AF37]/50 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <Eye className="w-5 h-5 shrink-0" /> : <EyeOff className="w-5 h-5 shrink-0" />}
              </button>
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                disabled={lockoutSecondsLeft != null && lockoutSecondsLeft > 0}
                onClick={() => { setShowForgotModal(true); setForgotStep(1); setForgotEmail(email); setForgotError(''); setForgotSuccess(''); }}
                className="text-xs text-[#D4AF37] hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Forgot password?
              </button>
            </div>
            {error && (
              <div className="text-center space-y-1 mt-3" role="alert">
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
                {remainingAttempts != null && remainingAttempts > 0 && (
                  <p className="text-[#0A2342]/70 dark:text-[#F9F7F2]/70 text-xs">
                    {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} left
                  </p>
                )}
                {lockoutSecondsLeft != null && lockoutSecondsLeft > 0 && (
                  <p className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                    You can try again in {Math.floor(lockoutSecondsLeft / 60)}:{String(lockoutSecondsLeft % 60).padStart(2, '0')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#0A2342]/15 dark:border-[#F9F7F2]/20 bg-[#F9F7F2] dark:bg-[#05152a] p-4">
            <div className="flex items-center gap-3 flex-nowrap">
              <div className="h-12 min-w-[62px] shrink-0 rounded-md border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#0A2342] px-3 flex items-center justify-center text-2xl font-semibold text-[#0A2342] dark:text-[#F9F7F2]">
                {captchaLoading ? '...' : (parsedCaptcha?.left || '?')}
              </div>
              <span className="text-2xl text-[#0A2342]/70 dark:text-[#F9F7F2]/70">{parsedCaptcha?.operator || '+'}</span>
              <div className="h-12 min-w-[62px] shrink-0 rounded-md border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#0A2342] px-3 flex items-center justify-center text-2xl font-semibold text-[#0A2342] dark:text-[#F9F7F2]">
                {captchaLoading ? '...' : (parsedCaptcha?.right || '?')}
              </div>
              <span className="text-2xl text-[#0A2342]/70 dark:text-[#F9F7F2]/70">=</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={captchaAnswer}
                onChange={(e) => { setCaptchaAnswer(e.target.value.replace(/\D/g, '').slice(0, 3)); clearErrors(); }}
                placeholder="?"
                aria-label="Captcha answer"
                style={{
                  width: '76px',
                  minWidth: '76px',
                  maxWidth: '76px',
                  borderColor: isCaptchaCorrect ? '#22c55e' : (isCaptchaIncorrect ? '#ef4444' : undefined),
                  color: isCaptchaCorrect ? '#22c55e' : (isCaptchaIncorrect ? '#ef4444' : undefined),
                }}
                className={`h-12 shrink-0 rounded-md border px-3 text-center text-xl focus:outline-none focus:ring-2 ${
                  isCaptchaCorrect
                    ? 'bg-white dark:bg-[#0A2342] focus:ring-emerald-500/40'
                    : isCaptchaIncorrect
                      ? 'bg-white dark:bg-[#0A2342] focus:ring-red-500/40'
                      : 'border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#0A2342] text-[#0A2342] dark:text-[#F9F7F2] focus:ring-[#D4AF37]/50'
                }`}
              />
              <button
                type="button"
                onClick={() => loadCaptcha(true)}
                disabled={captchaLoading}
                className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-md text-[#0A2342]/60 dark:text-[#F9F7F2]/70 hover:text-[#D4AF37] hover:bg-[#0A2342]/5 dark:hover:bg-[#F9F7F2]/10 disabled:opacity-60"
                aria-label="Refresh captcha"
                title="Refresh captcha"
              >
                <RefreshCw className={`w-5 h-5 ${captchaLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {!captchaLoading && !parsedCaptcha && captchaPrompt && (
              <p className="text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/60 mt-2">{captchaPrompt}</p>
            )}
            {isCaptchaEmpty && (
              <p className="text-xs mt-2" style={{ color: '#ef4444' }}>Required field cannot be left blank</p>
            )}
            {isCaptchaIncorrect && (
              <p className="text-xs mt-2" style={{ color: '#ef4444' }}>Please fill correct value</p>
            )}
            {captchaError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">{captchaError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={adminSetupRequired || isLoading || (lockoutSecondsLeft != null && lockoutSecondsLeft > 0)}
            className="w-full bg-[#0A2342] hover:bg-[#153a66] text-[#F9F7F2] dark:bg-[#F9F7F2] dark:text-[#0A2342] dark:hover:bg-[#D4AF37] font-bold py-4 transition-colors disabled:opacity-70 uppercase tracking-widest text-xs rounded-lg"
          >
            {lockoutSecondsLeft != null && lockoutSecondsLeft > 0
              ? `Try again in ${Math.floor(lockoutSecondsLeft / 60)}:${String(lockoutSecondsLeft % 60).padStart(2, '0')}`
              : isLoading
                ? 'Processing...'
                : 'Enter'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[#0A2342]/60 dark:text-[#F9F7F2]/70 text-sm">
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

      {/* Forgot password modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(10, 35, 66, 0.7)' }}
          onClick={() => !forgotLoading && setShowForgotModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-md bg-white dark:bg-[#0A2342] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 p-8 shadow-2xl rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif text-[#0A2342] dark:text-[#F9F7F2]">
                {forgotStep === 1 ? 'Forgot password' : 'Reset password'}
              </h2>
              <button
                type="button"
                onClick={() => !forgotLoading && setShowForgotModal(false)}
                className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 hover:text-[#D4AF37] text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70">
                  Enter your email and we'll send you a one-time code to reset your password.
                </p>
                <div>
                  <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onKeyDown={preventSpaceKey}
                    onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                    placeholder="you@gmail.com"
                    className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] rounded-lg"
                  />
                </div>
                {forgotError && <p className="text-red-600 dark:text-red-400 text-sm">{forgotError}</p>}
                {forgotSuccess && <p className="text-green-600 dark:text-green-400 text-sm">{forgotSuccess}</p>}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-[#0A2342] hover:bg-[#153a66] text-[#F9F7F2] dark:bg-[#F9F7F2] dark:text-[#0A2342] font-bold py-3 rounded-lg disabled:opacity-70 uppercase tracking-widest text-xs"
                >
                  {forgotLoading ? 'Sending...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70">
                  {devOtp
                    ? 'Use the code below (email was not sent—testing mode). Enter your new password.'
                    : <>Enter the 6-digit code sent to <strong className="text-[#0A2342] dark:text-[#F9F7F2]">{forgotEmail}</strong> and your new password.</>}
                </p>
                {devOtp && (
                  <p className="text-xs text-[#D4AF37] bg-[#0A2342]/10 dark:bg-[#F9F7F2]/10 px-3 py-2 rounded-lg">
                    Your code: <strong>{devOtp}</strong> (pre-filled)
                  </p>
                )}
                <div>
                  <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">OTP code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setForgotError(''); }}
                    placeholder="000000"
                    className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] rounded-lg text-center text-lg tracking-widest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">New password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onKeyDown={preventSpaceKey}
                    onChange={(e) => { setNewPassword(e.target.value); setForgotError(''); }}
                    placeholder="••••••••"
                    className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] rounded-lg"
                  />
                  <p className="mt-1 text-xs text-[#0A2342]/60 dark:text-[#F9F7F2]/60">8+ chars, upper, lower, number, special character.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-wider mb-2">Confirm password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onKeyDown={preventSpaceKey}
                    onChange={(e) => { setConfirmPassword(e.target.value); setForgotError(''); }}
                    placeholder="••••••••"
                    className="w-full bg-[#F9F7F2] dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 py-3 px-4 text-[#0A2342] dark:text-[#F9F7F2] focus:outline-none focus:border-[#D4AF37] rounded-lg"
                  />
                </div>
                {forgotError && <p className="text-red-600 dark:text-red-400 text-sm">{forgotError}</p>}
                {forgotSuccess && <p className="text-green-600 dark:text-green-400 text-sm">{forgotSuccess}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setForgotStep(1); setForgotError(''); setForgotSuccess(''); setDevOtp(null); }}
                    disabled={forgotLoading}
                    className="flex-1 py-3 border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 text-[#0A2342] dark:text-[#F9F7F2] font-bold rounded-lg hover:bg-[#0A2342]/5 disabled:opacity-70 uppercase tracking-widest text-xs"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || otp.length !== 6 || !newPassword || !confirmPassword}
                    className="flex-1 bg-[#0A2342] hover:bg-[#153a66] text-[#F9F7F2] dark:bg-[#F9F7F2] dark:text-[#0A2342] font-bold py-3 rounded-lg disabled:opacity-70 uppercase tracking-widest text-xs"
                  >
                    {forgotLoading ? 'Resetting...' : 'Reset password'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
