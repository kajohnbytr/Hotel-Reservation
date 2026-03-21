import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import bookingRoutes from './routes/bookings.js';
import roomRoutes from './routes/rooms.js';
import adminRoutes from './routes/admin.js';
import { connectDB } from './config/db.js';
import { sanitizeNoSql } from './middleware/sanitizeNoSql.js';
import { seedDefaultRooms } from './utils/seedDefaultRooms.js';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

const PORT = process.env.PORT || 5000;

const app = express();

function parseOrigin(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getAllowedOriginHosts() {
  const hosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  const configuredOrigins = [
    process.env.CORS_ORIGIN,
    process.env.CLIENT_URL,
    process.env.PUBLIC_API_URL,
  ];

  for (const value of configuredOrigins) {
    for (const entry of String(value || '').split(',').map((item) => item.trim()).filter(Boolean)) {
      const parsed = parseOrigin(entry);
      if (parsed?.hostname) hosts.add(parsed.hostname);
    }
  }

  return hosts;
}

const allowedOriginHosts = getAllowedOriginHosts();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'http:', 'https:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));

// CORS before other middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const parsed = parseOrigin(origin);
    if (parsed && ['http:', 'https:'].includes(parsed.protocol) && allowedOriginHosts.has(parsed.hostname)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Global rate limit (per IP)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json({ limit: '10kb' }));

// NoSQL injection protection: strip $ and dotted keys from body/query
app.use(sanitizeNoSql);

app.use('/api/users', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);

connectDB();

mongoose.connection.once('open', () => {
  seedDefaultRooms()
    .then((count) => {
      console.log(`[Rooms] Default catalog synced (${count} entries).`);
    })
    .catch((error) => {
      console.error('[Rooms] Failed to seed default catalog:', error?.message || error);
    });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
