import express from 'express';
import rateLimit from 'express-rate-limit';
import User from '../models/user.js';
import AuditLog from '../models/auditLog.js';
import { protect } from '../middleware/auth.js';
import {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from '../middleware/validate.js';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/sendEmail.js';
import crypto from 'crypto';

const router = express.Router();
const VERIFICATION_TOKEN_TTL_MS = 30 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '');
}

function getPublicApiBase(req) {
  const configured = normalizeBaseUrl(process.env.PUBLIC_API_URL || process.env.SERVER_URL);
  if (configured) return configured;

  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host');
  return `${protocol}://${host}`;
}

function getClientBaseUrl() {
  return normalizeBaseUrl(process.env.CLIENT_URL || 'http://localhost:5173');
}

async function verifyEmailToken(rawToken) {
  if (!rawToken) {
    return { ok: false, status: 400, message: 'Verification token is required.' };
  }

  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const user = await User.findOne({
    verificationToken: hashedToken,
    verificationTokenExpire: { $gt: Date.now() },
  });

  if (!user) {
    return { ok: false, status: 400, message: 'Invalid or expired verification link.' };
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpire = undefined;
  await user.save();

  return { ok: true, status: 200, message: 'Email verified successfully. You can now sign in.' };
}

function renderVerificationPage({ ok, message, loginUrl }) {
  const title = ok ? 'Email Verified' : 'Verification Failed';
  const tone = ok ? '#D4AF37' : '#f87171';
  const bodyText = message || (ok ? 'Your email has been verified.' : 'Verification failed.');
  const escapedLoginUrl = loginUrl.replace(/"/g, '&quot;');
  const autoRedirect = ok
    ? `
      <p style="margin: 14px 0 0; color: #6b7280; font-size: 14px;">Redirecting to login in 2 seconds...</p>
      <script>
        setTimeout(function () {
          window.location.href = "${escapedLoginUrl}";
        }, 2000);
      </script>
    `
    : '';

  return `
    <div style="font-family: Georgia, serif; max-width: 640px; margin: 40px auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 45px rgba(0,0,0,0.08);">
      <div style="background: #0A2342; padding: 24px; text-align: center; border-bottom: 4px solid #D4AF37;">
        <h1 style="color: #D4AF37; margin: 0; letter-spacing: 3px; font-size: 22px;">AURORA RESORT</h1>
      </div>
      <div style="padding: 36px 28px; text-align: center;">
        <div style="width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 18px; background: ${tone}22; display: inline-flex; align-items: center; justify-content: center;">
          <span style="color: ${tone}; font-size: 28px; line-height: 1;">${ok ? '✓' : '!'}</span>
        </div>
        <h2 style="margin: 0; color: #0A2342; font-size: 30px;">${title}</h2>
        <p style="margin: 14px 0 0; color: #374151; font-size: 16px; line-height: 1.6;">${bodyText}</p>
        ${autoRedirect}
        <a href="${loginUrl}" style="display: inline-block; margin-top: 24px; background: #0A2342; color: #F9F7F2; text-decoration: none; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; padding: 12px 24px; border-radius: 8px; font-size: 12px;">Open Aurora</a>
      </div>
    </div>
  `;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10;
const loginAttempts = new Map();

function getLoginAttempts(email) {
  const key = (email || '').toLowerCase().trim();
  if (!key) return null;
  const entry = loginAttempts.get(key);
  if (!entry) return { count: 0, lockoutUntil: null };
  if (entry.lockoutUntil && Date.now() >= entry.lockoutUntil) {
    loginAttempts.delete(key);
    return { count: 0, lockoutUntil: null };
  }
  return entry;
}

function recordFailedAttempt(email) {
  const key = (email || '').toLowerCase().trim();
  if (!key) return { count: 0, remainingAttempts: 5, lockoutUntil: null };
  let entry = loginAttempts.get(key);
  if (!entry) {
    entry = { count: 0, lockoutUntil: null };
    loginAttempts.set(key, entry);
  }
  entry.count += 1;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockoutUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
  }
  const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - entry.count);
  return { count: entry.count, remainingAttempts, lockoutUntil: entry.lockoutUntil };
}

function clearLoginAttempts(email) {
  const key = (email || '').toLowerCase().trim();
  if (key) loginAttempts.delete(key);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '6h';

// Registration — creates unverified user (verification email is sent on explicit request)
router.post('/register', authLimiter, registerValidation, async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const requestedRole = (role || 'guest').toLowerCase();

    // First-admin policy:
    // - If no admin exists yet, only admin registration is allowed.
    // - After an admin exists, guests can self-register but additional admins are blocked.
    let userRole = 'guest';
    const adminExists = await User.findOne({ role: 'admin' });

    if (!adminExists) {
      if (requestedRole !== 'admin') {
        return res.status(403).json({
          message: 'System setup required. Please create an admin account first before registering other users.',
        });
      }
      userRole = 'admin';
    } else if (requestedRole === 'admin') {
      return res.status(403).json({
        message: 'An admin account already exists. You cannot create another admin account via public registration.',
      });
    } else if (requestedRole === 'staff') {
      userRole = 'guest';
    } else {
      userRole = 'guest';
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: userRole,
      isVerified: false,
      verificationToken: undefined,
      verificationTokenExpire: undefined,
    });

    try {
      const userEmail = (user.email && String(user.email).trim()) || 'unknown';
      const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || userEmail;
      await AuditLog.create({
        userId: user._id,
        userEmail,
        userName,
        role: userRole,
        action: 'signup',
        details: `New ${userRole} signed up`,
      });
    } catch (err) {
      console.error('[Audit] Failed to record signup:', err.message, err);
    }

    res.status(201).json({
      message: 'Registration successful. Click "Send verification email" to receive your verification link.',
      email: user.email,
    });
  } catch (error) {
    console.error('[Register] Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Verify email
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  try {
    const result = await verifyEmailToken(token);
    return res.status(result.status).json({ message: result.message });
  } catch (error) {
    console.error('[Verify Email] Error:', error);
    return res.status(500).json({ message: 'Server Error' });
  }
});

// Check verification status by email (used for cross-device verification flow).
router.get('/verification-status', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const user = await User.findOne({ email }).select('isVerified');
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email.' });
    }
    return res.status(200).json({ isVerified: Boolean(user.isVerified) });
  } catch (error) {
    console.error('[Verification Status] Error:', error);
    return res.status(500).json({ message: 'Server Error' });
  }
});

// Backend-hosted verification page for cross-device email verification.
router.get('/verify-email/confirm', async (req, res) => {
  const { token } = req.query;
  const loginUrl = `${getClientBaseUrl()}/login`;

  try {
    const result = await verifyEmailToken(token);
    return res
      .status(result.ok ? 200 : result.status)
      .type('html')
      .send(renderVerificationPage({ ok: result.ok, message: result.message, loginUrl }));
  } catch (error) {
    console.error('[Verify Email Confirm] Error:', error);
    return res
      .status(500)
      .type('html')
      .send(renderVerificationPage({
        ok: false,
        message: 'Server Error while verifying email.',
        loginUrl,
      }));
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email.' });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: 'This account is already verified.' });
    }

    const now = Date.now();
    const expiry = user.verificationTokenExpire ? new Date(user.verificationTokenExpire).getTime() : 0;
    if (user.verificationToken && expiry > now) {
      const lastSentAt = expiry - VERIFICATION_TOKEN_TTL_MS;
      const retryAfterSeconds = Math.ceil((lastSentAt + VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000);
      if (retryAfterSeconds > 0) {
        return res.status(429).json({
          message: `Verification email already sent. Please wait ${retryAfterSeconds}s before requesting another one.`,
          retryAfterSeconds,
        });
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.verificationToken = hashedToken;
    user.verificationTokenExpire = Date.now() + VERIFICATION_TOKEN_TTL_MS;
    await user.save();

    const publicApiBase = getPublicApiBase(req);
    const verifyUrl = `${publicApiBase}/api/users/verify-email/confirm?token=${rawToken}`;

    const html = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0A2342; padding: 30px; text-align: center; border-bottom: 4px solid #D4AF37;">
          <h1 style="color: #D4AF37; margin: 0; font-size: 24px; letter-spacing: 4px;">AURORA RESORT</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #0A2342; margin-top: 0;">Verify Your Email</h2>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Hello ${user.firstName},</p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Here is your new verification link.</p>
          <p style="color: #555; font-size: 14px;">This link expires in <strong>30 minutes</strong>.</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="${verifyUrl}" style="background-color: #0A2342; color: #F9F7F2; padding: 16px 40px; text-decoration: none; font-weight: bold; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; border-radius: 4px; display: inline-block;">
              VERIFY MY EMAIL
            </a>
          </div>
          <p style="color: #666; font-size: 13px;">Or copy this link into your browser:</p>
          <p style="color: #D4AF37; font-size: 13px; word-break: break-all;">${verifyUrl}</p>
        </div>
        <div style="background-color: #0A2342; padding: 20px; text-align: center;">
          <p style="color: #D4AF37; font-size: 12px; margin: 0;">© 2024 AURORA RESORT. ALL RIGHTS RESERVED.</p>
        </div>
      </div>
    `;

    await sendEmail({ email: user.email, subject: 'Verify your Aurora account', html });
    res.status(200).json({ message: 'Verification email resent. Check your inbox.' });
  } catch (error) {
    console.error('[Resend Verification] Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Login — blocks unverified users
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;

    const attempt = getLoginAttempts(email);
    if (attempt && attempt.lockoutUntil && Date.now() < attempt.lockoutUntil) {
      const retryAfterSeconds = Math.ceil((attempt.lockoutUntil - Date.now()) / 1000);
      return res.status(429).json({
        message: 'Too many failed login attempts. Please try again later.',
        retryAfterSeconds,
        lockedUntil: new Date(attempt.lockoutUntil).toISOString(),
      });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      const { remainingAttempts, lockoutUntil } = recordFailedAttempt(email);
      const payload = { message: 'Invalid email or password', remainingAttempts };
      if (lockoutUntil) {
        payload.retryAfterSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
        payload.lockedUntil = new Date(lockoutUntil).toISOString();
      }
      return res.status(401).json(payload);
    }

    // Block unverified users
    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before signing in.',
        unverified: true,
      });
    }

    clearLoginAttempts(email);

    // Update last login/activity and mark user online
    const now = new Date();
    user.lastLogin = now;
    user.lastActivity = now;
    user.isOnline = true;
    await user.save();

    const token = generateToken(user._id, ACCESS_TOKEN_EXPIRY);
    const refreshToken = generateToken(user._id, REFRESH_TOKEN_EXPIRY);

    try {
      const userEmail = (user.email && String(user.email).trim()) || 'unknown';
      const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || userEmail;
      const role = (user.role === 'admin' || user.role === 'staff') ? user.role : 'guest';
      const action = role === 'admin' ? 'admin_login' : role === 'staff' ? 'staff_login' : 'guest_login';
      await AuditLog.create({
        userId: user._id,
        userEmail,
        userName,
        role,
        action,
        details: `${role === 'admin' ? 'Admin' : role === 'staff' ? 'Staff' : 'Guest'} logged in`,
      });
    } catch (err) {
      console.error('[Audit] Failed to record login:', err.message, err);
    }

    res.status(200).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role || 'guest',
      token,
      refreshToken,
      expiresIn: 6 * 3600,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const refreshToken = req.body?.refreshToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const token = generateToken(user._id, ACCESS_TOKEN_EXPIRY);
    res.status(200).json({ token, expiresIn: 6 * 3600 });
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
});

const isDevOtpAllowed = () =>
  process.env.NODE_ENV === 'development' || process.env.DEV_OTP_IN_RESPONSE === 'true';

// Forgot password
router.post('/forgot-password', authLimiter, forgotPasswordValidation, async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account with that email exists' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('[Password Reset OTP]', { email: user.email, otp });

    user.resetPasswordOTP = crypto.createHash('sha256').update(otp).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0A2342 0%, #153a66 100%); padding: 30px; text-align: center;">
          <h1 style="color: #D4AF37; margin: 0; font-size: 28px;">Aurora Hotel</h1>
        </div>
        <div style="padding: 40px 30px; background-color: #f9f9f9;">
          <h2 style="color: #0A2342; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Hello ${user.firstName},</p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Use the code below to reset your password:</p>
          <div style="background-color: #fff; border: 2px solid #D4AF37; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">Your OTP Code:</p>
            <h1 style="color: #0A2342; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #333; font-size: 16px;">This code expires in <strong>10 minutes</strong>.</p>
        </div>
        <div style="background-color: #0A2342; padding: 20px; text-align: center;">
          <p style="color: #D4AF37; font-size: 12px; margin: 0;">© 2024 Aurora Hotel. All rights reserved.</p>
        </div>
      </div>
    `;

    let emailSent = false;
    try {
      await sendEmail({ email: user.email, subject: 'Password Reset OTP - Aurora Hotel', html });
      emailSent = true;
    } catch (sendError) {
      console.error('Forgot password email error:', sendError.message);
      if (!isDevOtpAllowed()) {
        return res.status(500).json({ message: 'Email could not be sent' });
      }
    }

    const payload = {
      message: emailSent ? 'OTP sent to your email' : 'OTP generated (email not sent).',
      email: user.email,
    };
    if (isDevOtpAllowed()) payload.otpForDev = otp;
    res.status(200).json(payload);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Email could not be sent' });
  }
});

// Reset password
router.post('/reset-password', authLimiter, resetPasswordValidation, async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    const user = await User.findOne({
      email,
      resetPasswordOTP: hashedOTP,
      resetPasswordExpire: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Current user (protected)
router.get('/me', protect, async (req, res) => {
  res.status(200).json(req.user);
});

// Logout (protected)
router.post('/logout', protect, async (req, res) => {
  try {
    const now = new Date();
    await User.updateOne(
      { _id: req.user._id },
      { lastActivity: now, isOnline: false }
    );
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Check if an admin account exists (public, no auth required)
router.get('/admin-exists', async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    res.json({ adminExists: !!adminExists });
  } catch (error) {
    console.error('Check admin error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

function generateToken(id, expiresIn = ACCESS_TOKEN_EXPIRY) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn });
}

export default router;