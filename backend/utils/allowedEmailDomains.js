/**
 * Allowed email domains for signup. Only these common, existing providers are accepted.
 * Rejects non-existing or uncommon domains (e.g. @something.test.com).
 */
const ALLOWED_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.ca',
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'live.com',
  'live.co.uk',
  'msn.com',
  'icloud.com',
  'me.com',
  'mail.com',
  'protonmail.com',
  'proton.me',
  'aol.com',
]);

/**
 * Check if the email's domain is in the allowed list.
 * @param {string} email - Normalized email (e.g. user@gmail.com)
 * @returns {{ valid: boolean, message?: string }}
 */
export function isAllowedEmailDomain(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Invalid email' };
  }
  const at = email.indexOf('@');
  if (at === -1 || at === email.length - 1) {
    return { valid: false, message: 'Invalid email' };
  }
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) {
    return { valid: false, message: 'Invalid email' };
  }
  if (!ALLOWED_DOMAINS.has(domain)) {
    return {
      valid: false,
      message:
        'Please use an email from a supported provider (e.g. Gmail, Yahoo, Outlook, Hotmail).',
    };
  }
  return { valid: true };
}
