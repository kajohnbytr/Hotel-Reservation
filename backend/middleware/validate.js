import { body, validationResult } from 'express-validator';
import { validatePassword } from '../utils/passwordPolicy.js';
import { isAllowedEmailDomain } from '../utils/allowedEmailDomains.js';

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    const message = first?.msg || 'Validation failed';
    return res.status(400).json({ message });
  }
  next();
};

const noNumbers = (field) =>
  body(field).not().matches(/\d/).withMessage(`${field === 'firstName' ? 'First name' : 'Last name'} cannot contain numbers`);
const noWhitespace = (field, label) =>
  body(field).not().matches(/\s/).withMessage(`${label} cannot contain spaces`);

export const registerValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 32 }).withMessage('First name must be at most 32 characters'),
  noNumbers('firstName'),
  noWhitespace('firstName', 'First name'),
  body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 32 }).withMessage('Last name must be at most 32 characters'),
  noNumbers('lastName'),
  noWhitespace('lastName', 'Last name'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isLength({ max: 64 }).withMessage('Email must be at most 64 characters')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  noWhitespace('email', 'Email'),
  body('password').notEmpty().withMessage('Password is required').isLength({ max: 64 }).withMessage('Password must be at most 64 characters'),
  noWhitespace('password', 'Password'),
  handleValidation,
  (req, res, next) => {
    const email = req.body.email;
    const domainCheck = isAllowedEmailDomain(email);
    if (!domainCheck.valid) {
      return res.status(400).json({ message: domainCheck.message });
    }
    next();
  },
  (req, res, next) => {
    const { password } = req.body;
    const result = validatePassword(password);
    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }
    next();
  },
];

export const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isLength({ max: 64 }).withMessage('Email must be at most 64 characters')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  noWhitespace('email', 'Email'),
  body('password').notEmpty().withMessage('Password is required').isLength({ max: 64 }).withMessage('Password must be at most 64 characters'),
  noWhitespace('password', 'Password'),
  handleValidation,
];

export const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  handleValidation,
];

export const resetPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('otp').trim().notEmpty().withMessage('OTP is required'),
  body('newPassword').notEmpty().withMessage('New password is required'),
  handleValidation,
  (req, res, next) => {
    const result = validatePassword(req.body.newPassword);
    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }
    next();
  },
];
