import express from 'express';

const router = express.Router();

const AI_ML_URL = process.env.AI_ML_URL || 'http://127.0.0.1:5001';
const AI_NLP_URL = process.env.AI_NLP_URL || 'http://127.0.0.1:5002';

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
 * Proxy to Python NLP chatbot. Uses built-in hotel intents if service is down.
 * POST /api/ai/chat { message }
 */
router.post('/chat', async (req, res) => {
  try {
    const response = await fetch(`${AI_NLP_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.reply) {
      return res.json(data);
    }
  } catch (err) {
    console.error('[AI chat]', err.message);
  }
  res.json(fallbackChat(req.body?.message));
});

export default router;
