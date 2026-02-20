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

export const registerValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  noNumbers('firstName'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  noNumbers('lastName'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
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
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
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
