/**
 * NoSQL injection protection: strip MongoDB operators and dotted keys from body/query.
 * Prevents payloads like { email: { $gt: "" } } or { "email.$": "x" } from being used.
 */
function sanitize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    out[key] = sanitize(value);
  }
  return out;
}

export function sanitizeNoSql(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitize(req.query);
  }
  next();
}
