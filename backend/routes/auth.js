import express from 'express';
import rateLimit from 'express-rate-limit';
import User from '../models/user.js';
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

// Stricter rate limit for auth endpoints (brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  message: { message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const ACCESS_TOKEN_EXPIRY = '5 seconds';   // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '5 seconds'; // Refresh token for renewal

// Registration
router.post('/register', authLimiter, registerValidation, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const user = await User.create({ firstName, lastName, email, password });
    const token = generateToken(user._id, ACCESS_TOKEN_EXPIRY);
    const refreshToken = generateToken(user._id, REFRESH_TOKEN_EXPIRY);
    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      token,
      refreshToken,
      expiresIn: 3600, // seconds for frontend
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Login
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = generateToken(user._id, ACCESS_TOKEN_EXPIRY);
    const refreshToken = generateToken(user._id, REFRESH_TOKEN_EXPIRY);
    res.status(200).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      token,
      refreshToken,
      expiresIn: 3600,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Refresh token (short-lived + refresh)
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
    res.status(200).json({
      token,
      expiresIn: 3600,
    });
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
});

// For dev/testing: when email is fake or SMTP not configured, return OTP in response so user can still submit it
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
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0A2342 0%, #153a66 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #D4AF37; margin: 0; font-size: 28px;">Aurora Hotel</h1>
                </div>
                <div style="padding: 40px 30px; background-color: #f9f9f9;">
                    <h2 style="color: #0A2342; margin-top: 0;">Password Reset Request</h2>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hello ${user.firstName},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        We received a request to reset your password. Use the code below to reset your password:
                    </p>
                    <div style="background-color: #fff; border: 2px solid #D4AF37; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                        <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">Your OTP Code:</p>
                        <h1 style="color: #0A2342; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
                    </div>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        This code will expire in <strong>10 minutes</strong>.
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                    </p>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        Best regards,<br>
                        <strong>Aurora Hotel Team</strong>
                    </p>
                </div>
                <div style="background-color: #0A2342; padding: 20px; text-align: center;">
                    <p style="color: #D4AF37; font-size: 12px; margin: 0;">
                        © 2024 Aurora Hotel. All rights reserved.
                    </p>
                </div>
            </div>
        `;

    let emailSent = false;
    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset OTP - Aurora Hotel',
        html,
      });
      emailSent = true;
    } catch (sendError) {
      console.error('Forgot password email error:', sendError.message);
      if (!isDevOtpAllowed()) {
        return res.status(500).json({ message: 'Email could not be sent' });
      }
      // In dev: still return success and include OTP so fake/non-working emails can be tested
    }

    const payload = {
      message: emailSent ? 'OTP sent to your email' : 'OTP generated. Use the code below (email not sent).',
      email: user.email,
    };
    if (isDevOtpAllowed()) {
      payload.otpForDev = otp;
    }
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

function generateToken(id, expiresIn = ACCESS_TOKEN_EXPIRY) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn });
}

export default router;
