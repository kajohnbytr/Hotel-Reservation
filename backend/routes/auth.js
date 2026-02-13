import express from 'express';
import User from '../models/user.js';
import { protect } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/sendEmail.js';
import crypto from 'crypto';

const router = express.Router();

//Registration Route
router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    try {
        if(!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'Please fill all fields' })
        }

        const userExists = await User.findOne({ email });
        if(userExists) {
            return res
            .status(400)
            .json({ message: 'User already exists' })
        }

        const user = await User.create({ firstName, lastName, email, password });
        const token = generateToken(user._id);
        res.status(201).json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            token,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
})

//Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        if(!email || !password) {
            return res
            .status(400)
            .json({ message: 'Please fill all fields' })
        }
        const user = await User.findOne({ email });

        if(!user || !(await user.matchPassword(password))) {
            return res
            .status(401)
            .json({ message: 'Invalid email or password' });
        }
        const token = generateToken(user._id);
        res.status(200).json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            token,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
})

//Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    try {
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ message: 'No account with that email exists' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Hash OTP and save to user
        user.resetPasswordOTP = crypto.createHash('sha256').update(otp).digest('hex');
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
        
        await user.save();

        // Send email
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

        await sendEmail({
            email: user.email,
            subject: 'Password Reset OTP - Aurora Hotel',
            html,
        });

        res.status(200).json({ 
            message: 'OTP sent to your email',
            email: user.email 
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        user.resetPasswordOTP = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        
        res.status(500).json({ message: 'Email could not be sent' });
    }
});

//Verify OTP and Reset Password
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    
    try {
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Please provide email, OTP, and new password' });
        }

        // Hash the provided OTP to compare with stored hash
        const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
        
        const user = await User.findOne({
            email,
            resetPasswordOTP: hashedOTP,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Update password
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

//Me
router.get("/me", protect, async (req, res) => {
    res.status(200).json(req.user)
})

//Generate Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',})
}

export default router;