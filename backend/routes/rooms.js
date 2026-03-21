import express from 'express';
import Room from '../models/room.js';
import AuditLog from '../models/auditLog.js';
import { protect } from '../middleware/auth.js';
import { requireAdmin, requireStaffOrAdmin } from '../middleware/admin.js';

const router = express.Router();
const MAX_GUESTS_LIMIT = 20;
const MAX_PRICE_PER_NIGHT = 50000;
const IMAGE_FILE_EXT_RE = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)(\?.*)?$/i;

function extractMetaImageUrl(html) {
  if (!html) return null;
  const patterns = [
    /<meta\s[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
    /<meta\s[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["'][^>]*>/i,
    /<link\s[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["'][^>]*>/i,
    /<link\s[^>]*href=["']([^"']+)["'][^>]*rel=["']image_src["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

async function normalizeRoomImageUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return trimmed;
  }

  if (IMAGE_FILE_EXT_RE.test(parsedUrl.pathname)) {
    return parsedUrl.href;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(parsedUrl.href, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html, image/*;q=0.9, */*;q=0.8',
        'User-Agent': 'AuroraBot/1.0 (+https://aurora.local)',
      },
    });

    if (!response.ok) {
      return parsedUrl.href;
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('image/')) {
      return response.url || parsedUrl.href;
    }

    if (!contentType.includes('text/html')) {
      return parsedUrl.href;
    }

    const html = await response.text();
    const metaImageUrl = extractMetaImageUrl(html);
    if (!metaImageUrl) {
      return parsedUrl.href;
    }

    try {
      return new URL(metaImageUrl, response.url || parsedUrl.href).href;
    } catch {
      return parsedUrl.href;
    }
  } catch {
    return parsedUrl.href;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Create room (admin only)
router.post('/', protect, requireAdmin, async (req, res) => {
  try {
    const { name, type, pricePerNight, maxGuests, description, imageUrl, amenities } = req.body;
    if (!name || !type || pricePerNight == null) {
      return res.status(400).json({ message: 'Name, type, and pricePerNight are required' });
    }

    const parsedPricePerNight = Number(pricePerNight);
    const parsedMaxGuests = maxGuests == null || maxGuests === '' ? 2 : Number(maxGuests);

    if (!Number.isFinite(parsedPricePerNight) || parsedPricePerNight <= 0 || parsedPricePerNight > MAX_PRICE_PER_NIGHT) {
      return res.status(400).json({ message: `pricePerNight must be greater than 0 and less than or equal to ${MAX_PRICE_PER_NIGHT}` });
    }

    if (!Number.isInteger(parsedMaxGuests) || parsedMaxGuests < 1 || parsedMaxGuests > MAX_GUESTS_LIMIT) {
      return res.status(400).json({ message: `maxGuests must be a whole number between 1 and ${MAX_GUESTS_LIMIT}` });
    }

    const normalizedImageUrl = await normalizeRoomImageUrl(imageUrl);

    const room = await Room.create({
      name,
      type,
      pricePerNight: parsedPricePerNight,
      maxGuests: parsedMaxGuests,
      description,
      imageUrl: normalizedImageUrl,
      amenities: Array.isArray(amenities) ? amenities : [],
    });
    try {
      const adminName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
      await AuditLog.create({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: adminName,
        action: 'room_added',
        details: `Added room: ${name}`,
      });
    } catch (err) {
      console.error('[Audit] Failed to record room_added:', err.message);
    }
    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Update room (staff/admin)
router.put('/:id', protect, requireStaffOrAdmin, async (req, res) => {
  try {
    const { name, type, pricePerNight, maxGuests, description, imageUrl, amenities } = req.body;
    const update = {};
    if (name != null) update.name = name;
    if (type != null) update.type = type;
    if (pricePerNight != null) {
      const parsedPricePerNight = Number(pricePerNight);
      if (!Number.isFinite(parsedPricePerNight) || parsedPricePerNight <= 0 || parsedPricePerNight > MAX_PRICE_PER_NIGHT) {
        return res.status(400).json({ message: `pricePerNight must be greater than 0 and less than or equal to ${MAX_PRICE_PER_NIGHT}` });
      }
      update.pricePerNight = parsedPricePerNight;
    }
    if (maxGuests != null) {
      const parsedMaxGuests = Number(maxGuests);
      if (!Number.isInteger(parsedMaxGuests) || parsedMaxGuests < 1 || parsedMaxGuests > MAX_GUESTS_LIMIT) {
        return res.status(400).json({ message: `maxGuests must be a whole number between 1 and ${MAX_GUESTS_LIMIT}` });
      }
      update.maxGuests = parsedMaxGuests;
    }
    if (description != null) update.description = description;
    if (imageUrl != null) update.imageUrl = await normalizeRoomImageUrl(imageUrl);
    if (amenities != null) update.amenities = Array.isArray(amenities) ? amenities : [];

    const room = await Room.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    try {
      const adminName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
      await AuditLog.create({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: adminName,
        action: 'room_updated',
        details: `Updated room: ${room.name}`,
      });
    } catch (err) {
      console.error('[Audit] Failed to record room_updated:', err.message);
    }

    res.json(room);
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// List rooms (for admin and public)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 }).lean();
    res.json(rooms);
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;

