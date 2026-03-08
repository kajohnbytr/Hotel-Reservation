import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

const AI_ML_URL = process.env.AI_ML_URL || 'http://127.0.0.1:5001';
const AI_NLP_URL = process.env.AI_NLP_URL || 'http://127.0.0.1:5002';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const CHAT_MEMORY_TTL_MS = 30 * 60 * 1000;
const CHAT_MAX_MESSAGES = 16;

const chatMemoryStore = new Map();

function pruneExpiredMemory() {
  const now = Date.now();
  for (const [key, value] of chatMemoryStore.entries()) {
    if (!value?.updatedAt || now - value.updatedAt > CHAT_MEMORY_TTL_MS) {
      chatMemoryStore.delete(key);
    }
  }
}

function getChatSessionKey(req) {
  const auth = req.headers?.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id) return `user:${decoded.id}`;
    } catch {
      // Fall back to anonymous key when token is missing/invalid.
    }
  }

  const headerSessionId = String(req.headers?.['x-chat-session-id'] || '').trim();
  if (headerSessionId) {
    return `anon:${headerSessionId.slice(0, 120)}`;
  }

  const ip = req.ip || 'unknown-ip';
  const ua = String(req.headers?.['user-agent'] || 'unknown-ua').slice(0, 80);
  return `anon:${ip}:${ua}`;
}

function getOrCreateChatMemory(sessionKey) {
  const existing = chatMemoryStore.get(sessionKey);
  if (existing) return existing;

  const created = {
    slots: {
      guests: null,
      nights: null,
      budget: null,
    },
    messages: [],
    updatedAt: Date.now(),
  };
  chatMemoryStore.set(sessionKey, created);
  return created;
}

function extractBookingSlots(message) {
  const text = String(message || '').toLowerCase();
  const slots = {};

  const guestsMatch = text.match(/(\d+)\s*(guest|guests|people|person|adult|pax)\b/) || text.match(/\bfor\s+(\d+)\b/);
  if (guestsMatch?.[1]) slots.guests = Math.min(10, Math.max(1, Number(guestsMatch[1])));

  const nightsMatch = text.match(/(\d+)\s*(night|nights|day|days)\b/) || text.match(/\bstay\s+(\d+)\b/);
  if (nightsMatch?.[1]) slots.nights = Math.min(30, Math.max(1, Number(nightsMatch[1])));

  const budgetMatch = text.match(/(?:budget|under|max|price|php|peso|₱)\s*(\d+)/i) || text.match(/\b(\d+)\s*(?:php|peso|₱)\b/i);
  if (budgetMatch?.[1]) slots.budget = Math.max(1, Number(budgetMatch[1]));

  return slots;
}

function mergeSlots(memory, extracted) {
  if (typeof extracted.guests === 'number') memory.slots.guests = extracted.guests;
  if (typeof extracted.nights === 'number') memory.slots.nights = extracted.nights;
  if (typeof extracted.budget === 'number') memory.slots.budget = extracted.budget;
}

function shouldRecommend(message) {
  const text = String(message || '').toLowerCase();
  return /\b(recommend|suggest|best room|which room|what room)\b/.test(text);
}

function rememberTurn(memory, role, content) {
  memory.messages.push({ role, content: String(content || '') });
  if (memory.messages.length > CHAT_MAX_MESSAGES) {
    memory.messages = memory.messages.slice(memory.messages.length - CHAT_MAX_MESSAGES);
  }
  memory.updatedAt = Date.now();
}

async function checkOllamaHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      return { online: false, model: OLLAMA_MODEL };
    }
    const data = await response.json().catch(() => ({}));
    const models = Array.isArray(data?.models) ? data.models : [];
    const hasConfiguredModel = models.some((m) => String(m?.name || '').startsWith(`${OLLAMA_MODEL}`));
    return {
      online: true,
      model: OLLAMA_MODEL,
      modelAvailable: hasConfiguredModel,
    };
  } catch {
    return { online: false, model: OLLAMA_MODEL };
  } finally {
    clearTimeout(timeout);
  }
}

// Built-in fallback when Python ML is unavailable
function fallbackPredict(body) {
  const guests = Number(body?.guests) || 2;
  const nights = Number(body?.nights) || 1;
  const budget = Number(body?.price) || 500;
  let suggestion = 'Our Standard and Deluxe rooms are great for couples. ';
  if (guests > 2) suggestion = 'For larger groups, check our Suite, Villa, or Cabin options. ';
  if (budget >= 800) suggestion = 'With that budget, our Lakeside Villa or Aurora Penthouse would be perfect. ';
  else if (budget >= 400) suggestion = 'Our Aurora Royal Suite or Forest Cabin offer great value. ';
  return {
    message: `${suggestion}Browse the Rooms page to see availability and reserve—no payment is collected at booking.`,
    type: 'suite',
  };
}

// Built-in fallback when Python NLP is unavailable: hotel-specific intents
function fallbackChat(message) {
  if (!message || typeof message !== 'string') {
    return { reply: 'How can I help you today? Ask about our rooms, wifi, or how to make a reservation.' };
  }
  const text = message.toLowerCase().trim();
  if (/^(hi|hello|hey|good morning|good afternoon)/.test(text)) {
    return { reply: 'Hello! Welcome to Aurora. You can ask me about our rooms, wifi, prices, or how to make a reservation.' };
  }
  if (/\b(thank|thanks|ty)\b/.test(text)) {
    return { reply: "You're welcome! Enjoy your stay at Aurora." };
  }
  if (/\b(room|rooms|accommodation|stay)\b/.test(text) && !/\bprice|\bcost|\bbudget/.test(text)) {
    return { reply: 'We have Standard, Deluxe, Suite, Villa, and Cabin options. Each room includes wifi. Say your budget or number of guests and I can suggest one, or click "View Rooms" to see all.' };
  }
  if (/\b(wifi|internet|wi-fi)\b/.test(text)) {
    return { reply: 'Complimentary high-speed wifi is included in all rooms. No extra charge.' };
  }
  if (/\b(price|cost|budget|rate|rates|how much)\b/.test(text)) {
    return { reply: 'Rates vary by room type. Our Standard starts around ₱150/night; Deluxe, Suite, Villa, and Cabin go higher. Tell me your budget or guests and I can recommend a room, or check the Rooms page for full pricing.' };
  }
  if (/\b(reserve|reservation|book|booking)\b/.test(text)) {
    return { reply: 'To reserve: sign in, go to Rooms, choose your room and dates, then confirm. No payment is taken at booking—we only record your reservation. You can pay at check-in if required.' };
  }
  if (/\b(cancel|cancellation)\b/.test(text)) {
    return { reply: 'To change or cancel a reservation, please contact the front desk or use the contact details on our website.' };
  }
  if (/\b(contact|phone|email|help)\b/.test(text)) {
    return { reply: 'For assistance, use the contact information on our website or speak to the front desk. You can also manage your bookings in your Dashboard after signing in.' };
  }
  if (/\b(amenity|amenities|facility)\b/.test(text)) {
    return { reply: 'Our rooms include wifi, quality bedding, and modern amenities. Specific perks (e.g. balcony, tub) are listed on each room on the Rooms page.' };
  }
  return {
    reply: "I can help with room types, wifi, prices, and how to make a reservation. Try asking: 'What rooms do you have?' or 'What\'s the price range?'",
  };
}

/**
 * Proxy to Python ML service (room recommendation). Uses built-in fallback if service is down.
 * POST /api/ai/predict { guests, nights, price }
 */
router.post('/predict', async (req, res) => {
  try {
    const response = await fetch(`${AI_ML_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.message) {
      return res.json(data);
    }
  } catch (err) {
    console.error('[AI predict]', err.message);
  }
  res.json(fallbackPredict(req.body));
});

/**
 * Health endpoint for chatbot status indicator.
 * GET /api/ai/health
 */
router.get('/health', async (_req, res) => {
  const ollama = await checkOllamaHealth();
  res.json({
    ok: true,
    ollama,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Chat endpoint used by the frontend chatbot.
 *
 * Priority:
 *  1) Local Ollama LLM (if running)
 *  2) Built‑in hotel fallback intents
 *
 * POST /api/ai/chat { message }
 */
router.post('/chat', async (req, res) => {
  const message = req.body?.message;
  pruneExpiredMemory();

  const sessionKey = getChatSessionKey(req);
  const memory = getOrCreateChatMemory(sessionKey);
  const extractedSlots = extractBookingSlots(message);
  mergeSlots(memory, extractedSlots);

  // If user explicitly asks for recommendation, use collected slots first.
  if (shouldRecommend(message)) {
    const guests = memory.slots.guests;
    const nights = memory.slots.nights || 1;
    const budget = memory.slots.budget;

    if (!guests || !budget) {
      const missing = [];
      if (!guests) missing.push('number of guests');
      if (!budget) missing.push('budget');
      const ask = `I can recommend the best room for you. Please share your ${missing.join(' and ')}.`;
      rememberTurn(memory, 'user', String(message || ''));
      rememberTurn(memory, 'assistant', ask);
      return res.json({ reply: ask });
    }

    try {
      const response = await fetch(`${AI_ML_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests, nights, price: budget }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.message) {
        rememberTurn(memory, 'user', String(message || ''));
        rememberTurn(memory, 'assistant', data.message);
        return res.json({ reply: data.message, type: data.type || undefined });
      }
    } catch (err) {
      console.error('[AI chat][predict]', err.message);
    }

    const fallbackRecommendation = fallbackPredict({ guests, nights, price: budget });
    rememberTurn(memory, 'user', String(message || ''));
    rememberTurn(memory, 'assistant', fallbackRecommendation.message);
    return res.json({ reply: fallbackRecommendation.message, type: fallbackRecommendation.type });
  }

  // 1) Try local Ollama first (free, runs on your laptop)
  if (OLLAMA_MODEL) {
    try {
      const slotSummary = [
        memory.slots.guests ? `guests=${memory.slots.guests}` : null,
        memory.slots.nights ? `nights=${memory.slots.nights}` : null,
        memory.slots.budget ? `budget=${memory.slots.budget}` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'none';

      const recentMessages = memory.messages.slice(-8);
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false, // get a single JSON response instead of streaming chunks
          messages: [
            {
              role: 'system',
              content:
                `You are Aurora, a helpful hotel assistant for Aurora Hotel. Answer briefly and clearly about rooms, wifi, prices, reservations, and hotel policies. If a question is unrelated to hotels, politely steer the user back to hotel topics. Saved booking details for this user: ${slotSummary}.`,
            },
            ...recentMessages,
            { role: 'user', content: String(message || '') },
          ],
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.message?.content) {
        rememberTurn(memory, 'user', String(message || ''));
        rememberTurn(memory, 'assistant', data.message.content);
        return res.json({ reply: data.message.content });
      }
    } catch (err) {
      console.error('[AI chat][ollama]', err.message);
      // if Ollama is not running, we'll fall back below
    }
  }

  // 2) Try Python NLP chatbot service if available
  try {
    const response = await fetch(`${AI_NLP_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.reply) {
      rememberTurn(memory, 'user', String(message || ''));
      rememberTurn(memory, 'assistant', data.reply);
      return res.json({ reply: data.reply });
    }
  } catch (err) {
    console.error('[AI chat][nlp]', err.message);
  }

  // 3) Final fallback: simple rule-based hotel replies
  const fallback = fallbackChat(message);
  rememberTurn(memory, 'user', String(message || ''));
  rememberTurn(memory, 'assistant', fallback.reply);
  res.json(fallback);
});

export default router;
