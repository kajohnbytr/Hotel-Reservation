import express from 'express';
import jwt from 'jsonwebtoken';
import Room from '../models/room.js';

const router = express.Router();

const AI_ML_URL = process.env.AI_ML_URL || 'http://127.0.0.1:5001';
const AI_NLP_URL = process.env.AI_NLP_URL || 'http://127.0.0.1:5002';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const AI_CHAT_TIMEOUT_MS = Number(process.env.AI_CHAT_TIMEOUT_MS || 2000);
const ROOM_KB_TTL_MS = Number(process.env.ROOM_KB_TTL_MS || 60000);

const CHAT_MEMORY_TTL_MS = 30 * 60 * 1000;
const CHAT_MAX_MESSAGES = 16;

const chatMemoryStore = new Map();
const roomKnowledgeCache = {
  snapshot: null,
  updatedAt: 0,
};

const STATIC_ROOM_KNOWLEDGE = [
  { name: 'Standard Room', type: 'standard', pricePerNight: 150, maxGuests: 2, amenities: ['WiFi'] },
  { name: 'Deluxe Room', type: 'deluxe', pricePerNight: 250, maxGuests: 2, amenities: ['WiFi'] },
  { name: 'Aurora Royal Suite', type: 'suite', pricePerNight: 450, maxGuests: 4, amenities: ['WiFi'] },
  { name: 'Lakeside Villa', type: 'villa', pricePerNight: 800, maxGuests: 6, amenities: ['WiFi'] },
  { name: 'Forest Cabin', type: 'cabin', pricePerNight: 400, maxGuests: 4, amenities: ['WiFi'] },
];

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

  const guestsMatch =
    text.match(/(\d+)\s*(guest|guests|people|person|adult|pax|tao|bisita)\b/) ||
    text.match(/\bfor\s+(\d+)\b/) ||
    text.match(/\bpara\s+sa\s+(\d+)\b/) ||
    text.match(/\b(\d+)\s+kami\b/);
  if (guestsMatch?.[1]) slots.guests = Math.min(10, Math.max(1, Number(guestsMatch[1])));

  const nightsMatch =
    text.match(/(\d+)\s*(night|nights|day|days|gabi|araw)\b/) ||
    text.match(/\bstay\s+(\d+)\b/) ||
    text.match(/\b(\d+)\s+gabi\b/);
  if (nightsMatch?.[1]) slots.nights = Math.min(30, Math.max(1, Number(nightsMatch[1])));

  const budgetKMatch = text.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
  if (budgetKMatch?.[1]) {
    slots.budget = Math.max(1, Math.round(Number(budgetKMatch[1]) * 1000));
  }

  const budgetMatch =
    text.match(/(?:budget|under|max|price|presyo|halaga|hanggang|php|peso|₱)\s*(\d+)/i) ||
    text.match(/\b(\d+)\s*(?:php|peso|₱)\b/i) ||
    text.match(/(?:mas\s+mababa\s+sa|below)\s*(\d+)/i);
  if (budgetMatch?.[1] && typeof slots.budget !== 'number') slots.budget = Math.max(1, Number(budgetMatch[1]));

  return slots;
}

function mergeSlots(memory, extracted) {
  if (typeof extracted.guests === 'number') memory.slots.guests = extracted.guests;
  if (typeof extracted.nights === 'number') memory.slots.nights = extracted.nights;
  if (typeof extracted.budget === 'number') memory.slots.budget = extracted.budget;
}

function shouldRecommend(message) {
  const text = String(message || '').toLowerCase();
  return /\b(recommend|suggest|best room|which room|what room|rekomenda|irekomenda|anong room|alin room|magandang room|ano magandang kuwarto)\b/.test(text);
}

function isRoomTopic(message) {
  const text = String(message || '').toLowerCase();
  return /\b(room|rooms|kuwarto|silid|book|booking|reservation|reserve|wifi|price|presyo|budget|guests?|tao|nights?|gabi|amenit|facility|pasilidad)\b/.test(text);
}

function shouldAutoRecommend(message, memory, extractedSlots) {
  if (shouldRecommend(message)) return true;
  if (!isRoomTopic(message)) return false;
  if (!memory?.slots?.guests || !memory?.slots?.budget) return false;

  const text = String(message || '').toLowerCase();
  const detailJustUpdated =
    typeof extractedSlots?.guests === 'number' ||
    typeof extractedSlots?.budget === 'number' ||
    typeof extractedSlots?.nights === 'number';
  const confirmationPrompt = /\b(ok|sige|go|now|pwede|recommend na|go ahead|tuloy)\b/.test(text);

  return detailJustUpdated || confirmationPrompt;
}

function isAIMetaQuestion(message) {
  const text = String(message || '').toLowerCase();
  return /\b(ollama|llm|chatgpt|openai|model|ai|artificial intelligence|language model)\b/.test(text);
}

function isLikelyFilipino(message) {
  const text = String(message || '').toLowerCase();
  return /\b(ano|anong|paano|pwede|gusto|kailangan|para|kami|tao|bisita|gabi|presyo|kuwarto|silid|salamat|magkano|rekomenda|irekomenda)\b/.test(text);
}

function rememberTurn(memory, role, content) {
  memory.messages.push({ role, content: String(content || '') });
  if (memory.messages.length > CHAT_MAX_MESSAGES) {
    memory.messages = memory.messages.slice(memory.messages.length - CHAT_MAX_MESSAGES);
  }
  memory.updatedAt = Date.now();
}

function formatRoomKnowledgeForPrompt(knowledge) {
  const rooms = Array.isArray(knowledge?.rooms) ? knowledge.rooms : [];
  if (!rooms.length) return 'No room data available.';
  return rooms
    .slice(0, 10)
    .map((r) => `${r.name} (${r.type}) - PHP ${r.pricePerNight}/night, max ${r.maxGuests} guests`)
    .join('; ');
}

function buildRoomKnowledgeSnapshot(roomsInput) {
  const rooms = (Array.isArray(roomsInput) ? roomsInput : [])
    .filter((r) => Number(r?.pricePerNight) > 0)
    .map((r) => ({
      name: String(r?.name || r?.type || 'Room'),
      type: String(r?.type || 'room').toLowerCase(),
      pricePerNight: Number(r?.pricePerNight),
      maxGuests: Number(r?.maxGuests) || 2,
      amenities: Array.isArray(r?.amenities) ? r.amenities.map((a) => String(a)) : [],
    }));

  const sortedByPrice = [...rooms].sort((a, b) => a.pricePerNight - b.pricePerNight);
  const sortedByCapacity = [...rooms].sort((a, b) => b.maxGuests - a.maxGuests);

  return {
    rooms,
    cheapestRoom: sortedByPrice[0] || null,
    highestCapacityRoom: sortedByCapacity[0] || null,
    roomCount: rooms.length,
  };
}

async function getRoomKnowledgeSnapshot() {
  const now = Date.now();
  if (roomKnowledgeCache.snapshot && now - roomKnowledgeCache.updatedAt < ROOM_KB_TTL_MS) {
    return roomKnowledgeCache.snapshot;
  }

  try {
    const dbRooms = await Room.find({}, { name: 1, type: 1, pricePerNight: 1, maxGuests: 1, amenities: 1 }).lean();
    const base = dbRooms?.length ? dbRooms : STATIC_ROOM_KNOWLEDGE;
    const snapshot = buildRoomKnowledgeSnapshot(base);
    roomKnowledgeCache.snapshot = snapshot;
    roomKnowledgeCache.updatedAt = now;
    return snapshot;
  } catch {
    const snapshot = buildRoomKnowledgeSnapshot(STATIC_ROOM_KNOWLEDGE);
    roomKnowledgeCache.snapshot = snapshot;
    roomKnowledgeCache.updatedAt = now;
    return snapshot;
  }
}

function roomKnowledgeReply(message, knowledge) {
  const text = String(message || '').toLowerCase();
  const filipino = isLikelyFilipino(message);
  const rooms = knowledge?.rooms || [];
  if (!rooms.length) return null;

  const asksRoomList = /\b(what rooms|room types|list.*room|available rooms|anong room|mga room|uri ng room|available na rooms)\b/.test(text);
  if (asksRoomList) {
    const list = rooms
      .slice(0, 8)
      .map((r) => `${r.name} (PHP ${r.pricePerNight}/night, up to ${r.maxGuests} guests)`)
      .join('; ');
    return filipino
      ? `Narito ang available rooms: ${list}. Sabihin mo ang budget at bilang ng guests para makapag-recommend ako.`
      : `Here are our available rooms: ${list}. Share your budget and number of guests so I can recommend the best one.`;
  }

  const asksCheapest = /\b(cheapest|lowest|budget room|pinakamura|murang room|lowest price)\b/.test(text);
  if (asksCheapest && knowledge.cheapestRoom) {
    const r = knowledge.cheapestRoom;
    return filipino
      ? `Pinakamura namin ngayon ang ${r.name} sa PHP ${r.pricePerNight}/night (hanggang ${r.maxGuests} guests).`
      : `Our most affordable option right now is ${r.name} at PHP ${r.pricePerNight}/night (up to ${r.maxGuests} guests).`;
  }

  const asksBiggest = /\b(largest|biggest|family|group|pinakamalaki|pang pamilya|maraming tao)\b/.test(text);
  if (asksBiggest && knowledge.highestCapacityRoom) {
    const r = knowledge.highestCapacityRoom;
    return filipino
      ? `Para sa mas malaking group, pinaka-maluwag ang ${r.name} (hanggang ${r.maxGuests} guests, PHP ${r.pricePerNight}/night).`
      : `For larger groups, our most spacious option is ${r.name} (up to ${r.maxGuests} guests, PHP ${r.pricePerNight}/night).`;
  }

  const asksSpecificPrice = /\b(price|presyo|magkano|how much)\b/.test(text);
  if (asksSpecificPrice) {
    const matched = rooms.find((r) => text.includes(r.type) || text.includes(r.name.toLowerCase()));
    if (matched) {
      return filipino
        ? `${matched.name} ay PHP ${matched.pricePerNight}/night, good for up to ${matched.maxGuests} guests.`
        : `${matched.name} is PHP ${matched.pricePerNight}/night, good for up to ${matched.maxGuests} guests.`;
    }
  }

  return null;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = AI_CHAT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
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

  const filipino = isLikelyFilipino(message);
  const text = message.toLowerCase().trim();

  if (filipino && /\b(hi|hello|hey|kumusta|magandang umaga|magandang hapon)\b/.test(text)) {
    return { reply: 'Kumusta! Welcome sa Aurora. Pwede kang magtanong tungkol sa rooms, wifi, presyo, at reservation.' };
  }

  if (filipino && /\b(salamat|thank you|thanks)\b/.test(text)) {
    return { reply: 'Walang anuman! Sana ay ma-enjoy mo ang stay mo sa Aurora.' };
  }

  if (filipino && /\b(room|rooms|kuwarto|silid|accommodation|stay)\b/.test(text) && !/\bprice|cost|budget|presyo|magkano/.test(text)) {
    return { reply: 'Mayroon kaming Standard, Deluxe, Suite, Villa, at Cabin. Lahat ng room may wifi. Sabihin mo lang ang budget o bilang ng guests para makapag-suggest ako.' };
  }

  if (filipino && /\b(wifi|internet|wi-fi)\b/.test(text)) {
    return { reply: 'Libre ang high-speed wifi sa lahat ng rooms. Wala itong extra charge.' };
  }

  if (filipino && /\b(price|cost|budget|rate|rates|how much|presyo|magkano)\b/.test(text)) {
    return { reply: 'Nag-iiba ang presyo depende sa room type. Nagsisimula ang Standard sa paligid ng ₱150/night. Sabihin mo ang budget at guests mo para makapag-recommend ako ng tamang room.' };
  }

  if (filipino && /\b(reserve|reservation|book|booking|magpa-book|magbook|pa-reserve)\b/.test(text)) {
    return { reply: 'Para mag-reserve: mag-sign in, pumunta sa Rooms, piliin ang room at dates, tapos i-confirm. Walang payment na kukunin sa booking stage.' };
  }

  if (filipino && /\b(cancel|cancellation|kansela|i-cancel)\b/.test(text)) {
    return { reply: 'Para magbago o mag-cancel ng reservation, makipag-ugnayan sa front desk o gamitin ang contact details sa website.' };
  }

  if (filipino && /\b(contact|phone|email|help|tulong)\b/.test(text)) {
    return { reply: 'Para sa tulong, gamitin ang contact information sa website o kausapin ang front desk. Pwede mo ring i-manage ang bookings sa Dashboard kapag naka-sign in.' };
  }

  if (filipino && /\b(amenity|amenities|facility|pasilidad)\b/.test(text)) {
    return { reply: 'Kasama sa rooms ang wifi, quality bedding, at modern amenities. Naka-lista ang specific features ng bawat room sa Rooms page.' };
  }

  if (isAIMetaQuestion(text)) {
    return {
      reply: filipino
        ? `Oo. Gumagamit ako ng local AI via Ollama kapag available. Kapag unavailable, may fallback assistant pa rin para tuloy ang support. Gusto mo ba ng tulong sa rooms o reservation?`
        : 'Yes. I can use local AI via Ollama when available. If it is unavailable, I switch to fallback assistant logic so support still works. Want help with rooms or reservations?',
    };
  }

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
  if (filipino) {
    return {
      reply: 'Matutulungan kita sa room types, wifi, presyo, at reservation. Halimbawa: "Anong mga room meron kayo?" o "May budget akong 2000 para sa 3 tao".',
    };
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
  const roomKnowledge = await getRoomKnowledgeSnapshot();
  const extractedSlots = extractBookingSlots(message);
  mergeSlots(memory, extractedSlots);

  if (isAIMetaQuestion(message)) {
    const filipino = isLikelyFilipino(message);
    const metaReply = filipino
      ? `Oo, kilala ko ang Ollama. Kapag online ito, dito ko kinukuha ang mas natural na sagot. Kapag offline, may backup responses pa rin ako. Maaari kitang tulungan sa room recommendations, presyo, at reservation.`
      : 'Yes, I know Ollama. When it is online, I use it for richer natural responses. If it is offline, I still work using backup logic. I can help with room recommendations, pricing, and reservations.';
    rememberTurn(memory, 'user', String(message || ''));
    rememberTurn(memory, 'assistant', metaReply);
    return res.json({ reply: metaReply });
  }

  const factualReply = roomKnowledgeReply(message, roomKnowledge);
  if (factualReply) {
    rememberTurn(memory, 'user', String(message || ''));
    rememberTurn(memory, 'assistant', factualReply);
    return res.json({ reply: factualReply });
  }

  // If user explicitly asks for recommendation, use collected slots first.
  if (shouldAutoRecommend(message, memory, extractedSlots)) {
    const guests = memory.slots.guests;
    const nights = memory.slots.nights || 1;
    const budget = memory.slots.budget;

    if (!guests || !budget) {
      const missing = [];
      if (!guests) missing.push('number of guests');
      if (!budget) missing.push('budget');
      const filipino = isLikelyFilipino(message);
      const ask = filipino
        ? `Mare-recommend ko ang best room para sa iyo. Pakibigay ang ${missing
            .map((item) => (item === 'number of guests' ? 'bilang ng guests' : 'budget'))
            .join(' at ')}.`
        : `I can recommend the best room for you. Please share your ${missing.join(' and ')}.`;
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
      const { response, data } = await fetchJsonWithTimeout(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            stream: false, // get a single JSON response instead of streaming chunks
            messages: [
              {
                role: 'system',
                content:
                  `You are Aurora, a helpful hotel assistant for Aurora Hotel. Answer clearly and naturally about rooms, wifi, prices, reservations, and hotel policies. Respond in the user's language (English or Filipino/Tagalog). You may answer brief AI/meta questions (for example about Ollama) in 1-2 sentences, then guide back to hotel help. If the user gave budget/guests/nights, use that context to provide practical room suggestions. Saved booking details for this user: ${slotSummary}. Room knowledge: ${formatRoomKnowledgeForPrompt(roomKnowledge)}.`,
              },
              ...recentMessages,
              { role: 'user', content: String(message || '') },
            ],
          }),
        },
        AI_CHAT_TIMEOUT_MS,
      );
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
    const { response, data } = await fetchJsonWithTimeout(
      `${AI_NLP_URL}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      },
      AI_CHAT_TIMEOUT_MS,
    );
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
