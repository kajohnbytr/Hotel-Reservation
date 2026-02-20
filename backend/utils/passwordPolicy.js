/**
 * Server-side password policy: length + complexity.
 * Used for register and reset-password.
 */
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/** Must contain at least one of each: uppercase, lowercase, number, special character */
const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /\d/;
const SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/**
 * Validates password against policy.
 * @param {string} password - Plain password
 * @returns {{ valid: boolean, message?: string }}
 */
export function validatePassword(password) {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Password must be a string' };
  }
  const p = password;
  if (p.length < MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_LENGTH} characters` };
  }
  if (p.length > MAX_LENGTH) {
    return { valid: false, message: `Password must be at most ${MAX_LENGTH} characters` };
  }
  if (/\s/.test(p)) {
    return { valid: false, message: 'Password must not contain spaces or whitespace' };
  }
  if (!UPPER.test(p)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!LOWER.test(p)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!DIGIT.test(p)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!SPECIAL.test(p)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&* etc.)' };
  }
  return { valid: true };
}
