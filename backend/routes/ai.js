import express from 'express';

const router = express.Router();

const AI_ML_URL = process.env.AI_ML_URL || 'http://127.0.0.1:5001';
const AI_NLP_URL = process.env.AI_NLP_URL || 'http://127.0.0.1:5002';

/**
 * Proxy to Python ML service (room recommendation).
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
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (err) {
    console.error('[AI predict]', err.message);
    res.status(502).json({
      message: 'Recommendation service is unavailable. Please try again later.',
    });
  }
});

/**
 * Proxy to Python NLP chatbot (intents / general chat).
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
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (err) {
    console.error('[AI chat]', err.message);
    res.status(502).json({
      reply: 'I am currently offline. Please try again later.',
    });
  }
});

export default router;
