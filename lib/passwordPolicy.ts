/**
 * Client-side password policy (must match backend).
 * Min 8 chars, at least one: uppercase, lowercase, number, special character.
 */
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /\d/;
const SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

export interface PasswordValidation {
  valid: boolean;
  message?: string;
}

export function validatePassword(password: string): PasswordValidation {
  if (typeof password !== 'string') return { valid: false, message: 'Password must be a string' };
  if (password.length < MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_LENGTH} characters` };
  }
  if (password.length > MAX_LENGTH) {
    return { valid: false, message: `Password must be at most ${MAX_LENGTH} characters` };
  }
  if (/\s/.test(password)) {
    return { valid: false, message: 'Password must not contain spaces or whitespace' };
  }
  if (!UPPER.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!LOWER.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!DIGIT.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!SPECIAL.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&* etc.)' };
  }
  return { valid: true };
}

export const PASSWORD_HINT =
  'At least 8 characters, no spaces, with uppercase, lowercase, a number, and a special character (!@#$%^&* etc.)';
