import express from "express";
import User from "../models/user.js";
import { protect } from "../middleware/auth.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/sendEmail.js";
import crypto from "crypto";

const router = express.Router();

// Strong Password Policy
const passwordRegex =
  /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>_-]).{8,}$/;

// Name Validation (letters, spaces, hyphen only)
const nameRegex = /^[A-Za-z\s-]+$/;

// Email Validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Generate Token (7 days expiry)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  let { firstName, lastName, email, password } = req.body;

  try {
    // Trim inputs
    firstName = firstName?.trim();
    lastName = lastName?.trim();
    email = email?.trim();

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    // Prevent numbers in names
    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
      return res.status(400).json({
        message: "First and Last Name must contain letters only",
      });
    }

    // Validate Email Format
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    // Strong Password Check
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character",
      });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
    });

    console.log("NEW USER REGISTERED");
    console.log("Name:", firstName, lastName);
    console.log("Email:", email);
    console.log("User ID:", user._id);
    console.log("Time:", new Date().toLocaleString());
    console.log("-----------------------------------");

    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      token,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  let { email, password } = req.body;

  try {
    email = email?.trim();

    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    // Validate Email Format
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // ALWAYS check lock first
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({
        message:
          "Your account has been locked because you exceeded the maximum login attempts. Please try again later.",
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      user.loginAttempts += 1;

      if (user.loginAttempts >= 3) {
        user.lockUntil = Date.now() + 15 * 60 * 1000;
        await user.save();

        return res.status(403).json({
          message:
            "Your account has been locked because you exceeded the maximum login attempts. Please try again later.",
        });
      }

      await user.save();

      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Successful login
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      token,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ================= LOGOUT =================
router.post("/logout", protect, (req, res) => {
  console.log("USER LOGGED OUT");
  console.log("Email:", req.user.email);
  console.log("User ID:", req.user._id);
  console.log("Time:", new Date().toLocaleString());
  console.log("-----------------------------------");

  res.status(200).json({ message: "Logged out successfully" });
});

// ================= FORGOT PASSWORD =================
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        message:
          "If an account exists with that email, an OTP has been sent.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save();

    await sendEmail({
      email: user.email,
      subject: "Password Reset OTP",
      html: `<h2>Your OTP Code is: ${otp}</h2>`,
    });

    res.status(200).json({
      message:
        "If an account exists with that email, an OTP has been sent.",
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    res.status(500).json({ message: "Email could not be sent" });
  }
});

// ================= RESET PASSWORD =================
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        message: "Please provide email, OTP, and new password",
      });
    }

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character",
      });
    }

    const hashedOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    const user = await User.findOne({
      email,
      resetPasswordOTP: hashedOTP,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ================= ME =================
router.get("/me", protect, async (req, res) => {
  res.status(200).json(req.user);
});

export default router;
