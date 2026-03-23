import express from 'express';
import jwt from 'jsonwebtoken';
import Room from '../models/room.js';
import { findDatasetReply } from '../utils/chatDatasetMatcher.js';
import { recommendRoomTypeFromCsv } from '../utils/recommendationTable.js';

const router = express.Router();

const AI_ML_URL = process.env.AI_ML_URL || 'http://127.0.0.1:5001';
const AI_NLP_URL = process.env.AI_NLP_URL || 'http://127.0.0.1:5002';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_MODEL_FALLBACKS = (process.env.OLLAMA_MODEL_FALLBACKS || 'qwen3:8b,llama3.1:8b,llama3.2,gemma3:4b')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const OLLAMA_MODEL_CANDIDATES = [...new Set([OLLAMA_MODEL, ...OLLAMA_MODEL_FALLBACKS])];
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.35);
const OLLAMA_TOP_P = Number(process.env.OLLAMA_TOP_P || 0.9);
const OLLAMA_REPEAT_PENALTY = Number(process.env.OLLAMA_REPEAT_PENALTY || 1.08);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 220);
const AI_CHAT_TIMEOUT_MS = Number(process.env.AI_CHAT_TIMEOUT_MS || 5000);
const ROOM_KB_TTL_MS = Number(process.env.ROOM_KB_TTL_MS || 60000);

const CHAT_MEMORY_TTL_MS = 30 * 60 * 1000;
const CHAT_MAX_MESSAGES = 24;
const SUGGESTION_MAX_TRACKED = 80;
const SUGGESTION_DEFAULT_COUNT = 4;

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

const HOTEL_FEATURES = {
  wifi: {
    available: true,
    label: 'free WiFi',
    includedForCheckedIn: true,
    detailsEn: [
      'Hotel-wide high-speed WiFi access is available for guests.',
      'No extra fee for checked-in guests.',
      'Network name and password are provided at check-in or by the front desk.',
      'Signal quality may vary by room location and usage load.',
    ],
    detailsTl: [
      'May hotel-wide high-speed WiFi access para sa guests.',
      'Walang extra charge para sa checked-in guests.',
      'Ibinibigay ang WiFi network name at password sa check-in o sa front desk.',
      'Posibleng mag-iba ang signal depende sa location ng room at usage load.',
    ],
  },
  pool: {
    available: true,
    label: 'Sky Infinity Pool',
    includedForCheckedIn: true,
    detailsEn: [
      'Sky Infinity Pool is available for hotel guests.',
      'Pool access is included for checked-in guests.',
      'For exact operating hours, towel policy, and safety rules, please confirm with the front desk.',
    ],
    detailsTl: [
      'Available ang Sky Infinity Pool para sa hotel guests.',
      'Included ang pool access para sa checked-in guests.',
      'Para sa eksaktong operating hours, towel policy, at safety rules, paki-confirm sa front desk.',
    ],
  },
  gym: {
    available: true,
    label: 'Zen Wellness Studio',
    includedForCheckedIn: true,
    detailsEn: [
      'Zen Wellness Studio is available for hotel guests.',
      'Gym access is included for checked-in guests.',
      'For exact hours and usage guidelines, please confirm with the front desk.',
    ],
    detailsTl: [
      'Available ang Zen Wellness Studio para sa hotel guests.',
      'Included ang gym access para sa checked-in guests.',
      'Para sa eksaktong hours at usage guidelines, paki-confirm sa front desk.',
    ],
  },
  dining: {
    available: true,
    label: 'Lumina Dining',
    includedForCheckedIn: false,
    detailsEn: [
      'Lumina Dining is available on-site.',
      'Dining charges depend on your order or package inclusion.',
      'For menu hours and pricing, please confirm with the front desk or dining staff.',
    ],
    detailsTl: [
      'Available on-site ang Lumina Dining.',
      'Ang dining charges ay depende sa order o package inclusion.',
      'Para sa menu hours at pricing, paki-confirm sa front desk o dining staff.',
    ],
  },
  yoga: {
    available: null,
    label: 'yoga sessions',
    includedForCheckedIn: null,
    detailsEn: [
      'Yoga sessions may be available depending on schedule or package.',
      'Please confirm current session availability and fees with the front desk.',
    ],
    detailsTl: [
      'Posibleng may yoga sessions depende sa schedule o package.',
      'Paki-confirm sa front desk ang current availability at fees ng sessions.',
    ],
  },
  breakfast: { available: null, label: 'breakfast options', includedForCheckedIn: null },
  parking: { available: true, label: 'guest parking', includedForCheckedIn: null },
};

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
      date: null,
      roomType: null,
    },
    topic: {
      current: 'general',
      previous: null,
      lastAmenity: null,
      lastRoomType: null,
      lastUpdatedAt: Date.now(),
    },
    messages: [],
    shownSuggestions: [],
    updatedAt: Date.now(),
  };
  chatMemoryStore.set(sessionKey, created);
  return created;
}

function inferTopicFromMessage(message, extractedSlots, memory) {
  const text = String(message || '').toLowerCase();

  if (isCancellationTopic(text)) return 'cancellation';
  if (detectAmenityTopics(text, memory).length) return 'amenity';

  if (
    isRoomTopic(text) ||
    shouldRecommend(text) ||
    hasSlotDetails(extractedSlots) ||
    /\b(standard|deluxe|suite|villa|cabin|room|rooms|kuwarto|silid)\b/.test(text)
  ) {
    return 'room';
  }

  if (/\b(check\s*-?in|check\s*-?out|payment|refund|policy|rules?)\b/.test(text)) {
    return 'policy';
  }

  if (isFollowUpReference(text) && memory?.topic?.current && memory.topic.current !== 'general') {
    return memory.topic.current;
  }

  return null;
}

function updateTopicMemory(memory, message, extractedSlots) {
  if (!memory.topic) {
    memory.topic = {
      current: 'general',
      previous: null,
      lastAmenity: null,
      lastRoomType: null,
      lastUpdatedAt: Date.now(),
    };
  }

  const inferred = inferTopicFromMessage(message, extractedSlots, memory);
  if (inferred && inferred !== memory.topic.current) {
    memory.topic.previous = memory.topic.current;
    memory.topic.current = inferred;
    memory.topic.lastUpdatedAt = Date.now();
  }

  if (inferred === 'amenity') {
    const amenity = detectAmenityTopics(message, memory)[0] || null;
    if (amenity) memory.topic.lastAmenity = amenity;
  }

  const explicitRoomType = String(extractedSlots?.roomType || '').toLowerCase().trim();
  if (explicitRoomType) {
    memory.topic.lastRoomType = explicitRoomType;
    memory.topic.current = 'room';
    memory.topic.lastUpdatedAt = Date.now();
  }

  const text = String(message || '').toLowerCase();
  const roomTypeMention = text.match(/\b(standard|deluxe|suite|villa|cabin)\b/);
  if (roomTypeMention?.[1]) {
    memory.topic.lastRoomType = roomTypeMention[1];
    memory.topic.current = 'room';
    memory.topic.lastUpdatedAt = Date.now();
  }
}

function wordToNumber(value) {
  const map = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    isa: 1,
    isang: 1,
    dalawa: 2,
    tatlo: 3,
    apat: 4,
    lima: 5,
    anim: 6,
    pito: 7,
    walo: 8,
    siyam: 9,
    sampu: 10,
  };

  const token = String(value || '').toLowerCase().trim();
  if (!token) return null;
  if (/^\d+$/.test(token)) return Number(token);
  return map[token] || null;
}

function extractBookingSlots(message) {
  const text = String(message || '').toLowerCase();
  const slots = {};

  const guestsMatch =
    text.match(/(\d+)\s*(guest|guests|people|person|adult|pax|tao|bisita)\b/) ||
    text.match(/\bfor\s+(\d+)\b/) ||
    text.match(/\bpara\s+sa\s+(\d+)\b/) ||
    text.match(/\b(\d+)\s+kami\b/) ||
    text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|isa|isang|dalawa|tatlo|apat|lima|anim|pito|walo|siyam|sampu)\s*(kami|kame|guest|guests|people|person|adult|adults|pax|tao|bisita)\b/);
  if (guestsMatch?.[1]) {
    const converted = wordToNumber(guestsMatch[1]);
    if (typeof converted === 'number' && Number.isFinite(converted)) {
      slots.guests = Math.min(10, Math.max(1, converted));
    }
  }

  const nightsMatch =
    text.match(/(\d+)\s*(night|nights|day|days|gabi|araw)\b/) ||
    text.match(/\bstay\s+(\d+)\b/) ||
    text.match(/\b(\d+)\s+gabi\b/);
  if (nightsMatch?.[1]) slots.nights = Math.min(30, Math.max(1, Number(nightsMatch[1])));

  const dateMatch =
    text.match(/\b(today|tomorrow|next week|next month|ngayon|bukas|sa makalawa)\b/) ||
    text.match(/\b(\d{4}-\d{2}-\d{2})\b/) ||
    text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i);
  if (dateMatch?.[1]) slots.date = dateMatch[1];

  const roomTypeMatch = text.match(/\b(standard|deluxe|suite|villa|cabin|penthouse)\b/i);
  if (roomTypeMatch?.[1]) slots.roomType = String(roomTypeMatch[1]).toLowerCase();

  const budgetKMatch = text.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
  if (budgetKMatch?.[1]) {
    slots.budget = Math.max(1, Math.round(Number(budgetKMatch[1]) * 1000));
  }

  const budgetMatch =
    text.match(/(?:budget|under|max|price|presyo|halaga|hanggang|php|peso|₱|pera)\s*(\d+)/i) ||
    text.match(/\b(\d+)\s*(?:budget|budgets)\b/i) ||
    text.match(/\b(\d+)\s+\w+\s*(?:budget|budgets|pera)\b/i) ||
    text.match(/\b(\d+)\s*(?:ang\s+)?(?:pera|budget)\b/i) ||
    text.match(/\b(\d+)\s*(?:php|peso|₱)\b/i) ||
    text.match(/(?:mas\s+mababa\s+sa|below)\s*(\d+)/i);
  if (budgetMatch?.[1] && typeof slots.budget !== 'number') slots.budget = Math.max(1, Number(budgetMatch[1]));

  return slots;
}

function mergeSlots(memory, extracted) {
  if (typeof extracted.guests === 'number') memory.slots.guests = extracted.guests;
  if (typeof extracted.nights === 'number') memory.slots.nights = extracted.nights;
  if (typeof extracted.budget === 'number') memory.slots.budget = extracted.budget;
  if (typeof extracted.date === 'string' && extracted.date.trim()) memory.slots.date = extracted.date.trim();
  if (typeof extracted.roomType === 'string' && extracted.roomType.trim()) memory.slots.roomType = extracted.roomType.trim();
}

function shouldRecommend(message) {
  const text = String(message || '').toLowerCase();
  return /\b(recommend|suggest|best room|which room|what room|rekomenda|irekomenda|anong room|alin room|magandang room|ano magandang kuwarto)\b/.test(text);
}

function isRoomTopic(message) {
  const text = String(message || '').toLowerCase();
  return /\b(room|rooms|kuwarto|silid|book|booking|reservation|reserve|wifi|price|presyo|budgets?|guests?|people|persons?|tao|nights?|gabi|amenit|facility|pasilidad|pool|swim|gym|fitness|restaurant|dining|breakfast|parking|cancel|cancellation|kansela|refund|rebook|reschedule)\b/.test(text);
}

function detectAmenityTopic(message, memory) {
  const topics = detectAmenityTopics(message, memory);
  return topics[0] || null;
}

function detectAmenityTopics(message, memory) {
  const text = String(message || '').toLowerCase();
  const found = [];

  if (/\b(wifi|wi-fi|internet)\b/.test(text)) found.push('wifi');
  if (/\b(pool|swimming)\b/.test(text)) found.push('pool');
  if (/\b(gym|fitness|workout)\b/.test(text)) found.push('gym');
  if (/\b(yoga)\b/.test(text)) found.push('yoga');
  if (/\b(dining|restaurant|food|meal|dine)\b/.test(text)) found.push('dining');
  if (/\b(breakfast)\b/.test(text)) found.push('breakfast');
  if (/\b(parking|car park)\b/.test(text)) found.push('parking');

  if (found.length) return [...new Set(found)];

  if (/\b(what about|how about|and that|and this|that one|it)\b/.test(text)) {
    if (String(memory?.topic?.current || '') === 'room') {
      return [];
    }

    const recent = Array.isArray(memory?.messages) ? [...memory.messages].reverse().slice(0, 6) : [];
    const hay = recent.map((m) => String(m?.content || '').toLowerCase()).join(' ');
    const recentFound = [];
    if (/\b(pool|swimming)\b/.test(hay)) recentFound.push('pool');
    if (/\b(gym|fitness|workout)\b/.test(hay)) recentFound.push('gym');
    if (/\b(yoga)\b/.test(hay)) recentFound.push('yoga');
    if (/\b(dining|restaurant|food|meal|dine)\b/.test(hay)) recentFound.push('dining');
    if (/\b(wifi|wi-fi|internet)\b/.test(hay)) recentFound.push('wifi');
    if (/\b(breakfast)\b/.test(hay)) recentFound.push('breakfast');
    if (/\b(parking|car park)\b/.test(hay)) recentFound.push('parking');
    if (recentFound.length) return [...new Set(recentFound)];

    if (memory?.topic?.current === 'amenity' && memory?.topic?.lastAmenity) {
      return [memory.topic.lastAmenity];
    }
  }

  return [];
}

function asksAmenityFeeDetails(message) {
  const text = String(message || '').toLowerCase();
  return /\b(free|included|extra charge|charge|fee|cost|how much|libre|bayad|magkano|may bayad|walang bayad|included ba|kasama ba|pag check in|kapag check in|when checked in|upon check in)\b/.test(
    text,
  );
}

function asksAmenityOnlyFocus(message) {
  const text = String(message || '').toLowerCase();
  return /\b(only|just|focused|focus|interested only|iyon lang|yun lang|yan lang|pool lang|gym lang|about the pool only|about pool only|amenity only)\b/.test(
    text,
  );
}

function asksWifiConnectionDetails(message) {
  const text = String(message || '').toLowerCase();
  return /\b(what wifi|which wifi|wifi name|network name|ssid|password|passcode|wifi password|internet password|connect|connection|login|anong wifi|pangalan ng wifi|password ng wifi|paano kumonekta|how to connect)\b/.test(
    text,
  );
}

function buildAmenityDetailsReply(feature, amenity, filipino) {
  const detailLines = filipino ? feature?.detailsTl : feature?.detailsEn;
  if (Array.isArray(detailLines) && detailLines.length) {
    return detailLines.join(' ');
  }

  if (feature.available === true) {
    return filipino ? `Oo, meron po kaming ${feature.label}.` : `Yes, we have ${feature.label}.`;
  }
  if (feature.available === false) {
    return filipino ? `Sa ngayon, wala po kaming ${feature.label}.` : `At the moment, we do not have ${feature.label}.`;
  }

  return filipino
    ? `May ${feature.label} options po kami, pero depende ito sa package at availability. Para sa pinaka-accurate na details, paki-check ang reservation page o front desk.`
    : `We have ${feature.label}, but availability can depend on package and schedule. For exact details, please check the reservation page or front desk.`;
}

function buildAmenitySingleLine(feature, amenity, filipino, asksFee) {
  if (!feature) return null;

  if (!asksFee && amenity === 'dining') {
    return filipino
      ? `${feature.label}: available on-site; charges depend sa order o package.`
      : `${feature.label}: available on-site; charges depend on your order or package.`;
  }

  if (!asksFee && amenity === 'yoga') {
    return filipino
      ? `${feature.label}: depende sa schedule at package; paki-confirm sa front desk.`
      : `${feature.label}: depends on schedule and package; please confirm with the front desk.`;
  }

  if (asksFee && feature.available !== false) {
    if (feature.includedForCheckedIn === true) {
      return filipino
        ? `${feature.label}: included para sa checked-in guests (walang extra charge).`
        : `${feature.label}: included for checked-in guests (no extra charge).`;
    }
    if (feature.includedForCheckedIn === false) {
      return filipino
        ? `${feature.label}: available pero may separate charge depende sa order o package.`
        : `${feature.label}: available but may have a separate charge depending on order or package.`;
    }
    return filipino
      ? `${feature.label}: availability at fees ay depende sa package/schedule; paki-confirm sa front desk.`
      : `${feature.label}: availability and fees depend on package/schedule; please confirm with the front desk.`;
  }

  if (feature.available === true) {
    return filipino
      ? `${feature.label}: available for hotel guests.`
      : `${feature.label}: available for hotel guests.`;
  }

  if (feature.available === false) {
    return filipino
      ? `${feature.label}: currently not available.`
      : `${feature.label}: currently not available.`;
  }

  return filipino
    ? `${feature.label}: depende sa package at schedule; paki-confirm sa front desk.`
    : `${feature.label}: depends on package and schedule; please confirm with the front desk.`;
}

function amenityAvailabilityReply(message, memory) {
  const filipino = isLikelyFilipino(message);
  const amenityTopics = detectAmenityTopics(message, memory);
  if (!amenityTopics.length) return null;

  const amenity = amenityTopics[0];

  const feature = HOTEL_FEATURES[amenity];
  if (!feature) return null;

  const asksFee = asksAmenityFeeDetails(message);
  const amenityOnlyFocus = asksAmenityOnlyFocus(message);
  const asksWifiDetails = amenity === 'wifi' && asksWifiConnectionDetails(message);

  if (amenityTopics.length > 1) {
    const lines = amenityTopics
      .map((topic) => buildAmenitySingleLine(HOTEL_FEATURES[topic], topic, filipino, asksFee))
      .filter(Boolean)
      .map((line) => `- ${line}`);

    const intro = filipino
      ? 'Narito ang details ng amenities na tinanong mo:'
      : 'Here are the details for the amenities you asked about:';
    const outro = filipino
      ? 'Para sa exact operating hours at latest policy per amenity, paki-confirm sa front desk.'
      : 'For exact operating hours and latest policy per amenity, please confirm with the front desk.';

    return `${intro}\n\n${lines.join('\n')}\n\n${outro}`;
  }

  if (asksFee && feature.available !== false) {
    if (amenity === 'wifi') {
      return filipino
        ? 'Oo, libre ang WiFi para sa checked-in guests. Ang network name at password ay ibinibigay sa check-in o puwede mong hingin sa front desk.'
        : 'Yes, WiFi is free for checked-in guests. The network name and password are provided at check-in or can be requested at the front desk.';
    }

    if (feature.includedForCheckedIn === true) {
      return filipino
        ? `Oo, para sa checked-in guests, included na ang access sa ${feature.label} at walang extra charge, subject sa operating hours at house rules.`
        : `Yes. For checked-in guests, access to ${feature.label} is included with no extra charge, subject to operating hours and house rules.`;
    }

    if (feature.includedForCheckedIn === false) {
      return filipino
        ? `${feature.label} ay available, pero may separate charge depende sa order o package. Para sa exact amount, i-confirm sa front desk o reservation details.`
        : `${feature.label} is available, but it may have a separate charge depending on your order or package. For the exact amount, please confirm with the front desk or reservation details.`;
    }

    return filipino
      ? `Available ang ${feature.label}, pero depende sa package kung included o may additional fee. Para sa pinaka-accurate na amount, paki-confirm sa reservation details o front desk.`
      : `${feature.label} is available, but whether it is included or charged depends on your package. For the most accurate amount, please confirm via reservation details or the front desk.`;
  }

  if (asksWifiDetails || amenityOnlyFocus || amenity === 'pool' || amenity === 'gym' || amenity === 'dining' || amenity === 'yoga' || amenity === 'wifi') {
    return buildAmenityDetailsReply(feature, amenity, filipino);
  }

  if (feature.available === true) {
    return filipino ? `Oo, meron po kaming ${feature.label}.` : `Yes, we have ${feature.label}.`;
  }

  if (feature.available === false) {
    return filipino
      ? `Sa ngayon, wala po kaming ${feature.label}. Maaari kitang tulungan sa ibang available amenities o room options.`
      : `At the moment, we do not have ${feature.label}. I can help you with other available amenities or room options.`;
  }

  return filipino
    ? `May ${feature.label} options po kami, pero depende ito sa package at availability. Para sa pinaka-accurate na details, paki-check ang reservation page o front desk.`
    : `We have ${feature.label}, but availability can depend on package and schedule. For exact details, please check the reservation page or front desk.`;
}

function isCancellationTopic(message) {
  const text = String(message || '').toLowerCase();
  return /\b(cancel|cancellation|kansela|refund|rebook|reschedule|request cancel|request cancellation)\b/.test(text);
}

function isBookingHelpTopic(message) {
  const text = String(message || '').toLowerCase();
  return /\b(how\s+do\s+i\s+book|how\s+can\s+i\s+book|book\s+then|book\s+now|booking\s+steps?|reservation\s+steps?|paano\s+mag\s*book|paano\s+mag\s*reserve|how\s+to\s+reserve|how\s+to\s+book)\b/.test(
    text,
  );
}

function hasSlotDetails(extractedSlots) {
  return (
    typeof extractedSlots?.guests === 'number' ||
    typeof extractedSlots?.budget === 'number' ||
    typeof extractedSlots?.nights === 'number' ||
    typeof extractedSlots?.date === 'string' ||
    typeof extractedSlots?.roomType === 'string'
  );
}

function shouldAutoRecommend(message, memory, extractedSlots) {
  if (isBookingHelpTopic(message) || isCancellationTopic(message)) return false;
  if (shouldRecommend(message)) return true;

  const text = String(message || '').toLowerCase();
  const detailJustUpdated = hasSlotDetails(extractedSlots);
  const confirmationPrompt = /\b(ok|sige|go|now|pwede|recommend na|go ahead|tuloy)\b/.test(text);
  const hasHotelContext = hasRecentHotelContext(memory);

  if (detailJustUpdated) {
    return isRoomTopic(message) || hasHotelContext || isFollowUpReference(message);
  }

  if (isRoomTopic(message) && (memory?.slots?.guests || memory?.slots?.budget)) {
    return true;
  }

  return confirmationPrompt && hasHotelContext;
}

function isAIMetaQuestion(message) {
  const text = String(message || '').toLowerCase();
  return /\b(ollama|llm|chatgpt|openai|model|ai|artificial intelligence|language model)\b/.test(text);
}

function isLikelyFilipino(message) {
  const text = String(message || '').toLowerCase();
  return /\b(ano|anong|paano|pwede|gusto|kailangan|para|kami|kayo|namin|lang|tao|bisita|gabi|presyo|kuwarto|silid|salamat|magkano|rekomenda|irekomenda)\b/.test(text);
}

function getLastAssistantReply(memory) {
  if (!Array.isArray(memory?.messages)) return '';
  const last = [...memory.messages].reverse().find((m) => m.role === 'assistant');
  return String(last?.content || '');
}

function roomNameList(rooms) {
  return rooms.map((r) => r.name).slice(0, 10).join(', ');
}

function formatPeso(value) {
  const amount = Math.max(0, Number(value) || 0);
  return `₱${amount}`;
}

function formatRoomInclusions(amenitiesInput, filipino = false) {
  const amenities = Array.isArray(amenitiesInput)
    ? amenitiesInput.map((a) => String(a || '').trim()).filter(Boolean)
    : [];

  const unique = [...new Set(amenities)];
  if (!unique.length) {
    return filipino ? 'Libreng WiFi' : 'Free WiFi';
  }
  return unique.join(', ');
}

function formatRoomListingResponse(roomsInput, filipino = false) {
  const rooms = (Array.isArray(roomsInput) ? roomsInput : []).slice(0, 8);
  if (!rooms.length) {
    return filipino
      ? 'Sa ngayon, wala akong room data na maipapakita. Pakicheck ang Rooms page para sa latest availability.'
      : 'I do not have room data to display right now. Please check the Rooms page for the latest availability.';
  }

  const lines = rooms.flatMap((room) => {
    const name = String(room?.name || 'Room');
    const guests = Math.max(1, Number(room?.maxGuests) || 1);
    const inclusions = formatRoomInclusions(room?.amenities, filipino);
    const type = String(room?.type || 'room').toLowerCase();
    const typeLine = filipino ? `Uri: ${type}` : `Type: ${type}`;
    const capacityLine = filipino ? `Kapasidad: Hanggang ${guests} guests` : `Capacity: Up to ${guests} guests`;
    const inclusionLine = filipino ? `Inclusions: ${inclusions}` : `Inclusions: ${inclusions}`;
    return [`**${name}**`, `- ${typeLine}`, `- ${capacityLine}`, `- ${inclusionLine}`, ''];
  });

  const heading = filipino ? 'Narito po ang full details ng available rooms:' : 'Here are the full details of our available rooms:';
  const footer = filipino
    ? 'Kung kailangan mo ng presyo, itanong lang: "Ano ang room prices?". Puwede rin akong mag-recommend base sa budget at bilang ng guests.'
    : 'If you need pricing, ask: "What are the room prices?". I can also recommend the best room based on your budget and number of guests.';

  return `${heading}\n\n${lines.join('\n').trim()}\n\n${footer}`;
}

function formatRoomPriceResponse(roomsInput, filipino = false) {
  const rooms = (Array.isArray(roomsInput) ? roomsInput : []).slice(0, 8);
  if (!rooms.length) {
    return filipino
      ? 'Sa ngayon, wala akong price list na maipapakita. Pakicheck ang Rooms page para sa latest pricing.'
      : 'I do not have a price list to show right now. Please check the Rooms page for the latest pricing.';
  }

  const lines = rooms.map((room) => {
    const name = String(room?.name || 'Room');
    const priceLine = filipino
      ? `Presyo: ${formatPeso(room?.pricePerNight)} bawat gabi`
      : `Price: ${formatPeso(room?.pricePerNight)} per night`;
    const capacityLine = filipino
      ? `Kapasidad: Hanggang ${Math.max(1, Number(room?.maxGuests) || 1)} guests`
      : `Capacity: Up to ${Math.max(1, Number(room?.maxGuests) || 1)} guests`;
    const inclusionLine = `Inclusions: ${formatRoomInclusions(room?.amenities, filipino)}`;
    return `**${name}**\n- ${priceLine}\n- ${capacityLine}\n- ${inclusionLine}`;
  });
  const heading = filipino ? 'Narito po ang room prices at inclusions:' : 'Here are our room prices and inclusions:';
  const footer = filipino
    ? 'Sabihin ang budget at bilang ng guests para mahanapan kita ng best value option.'
    : 'Tell me your budget and number of guests and I can suggest the best value option.';

  return `${heading}\n\n${lines.join('\n\n')}\n\n${footer}`;
}

function faqKnowledgeReply(message, knowledge, memory) {
  const text = String(message || '').toLowerCase();
  const filipino = isLikelyFilipino(message);
  const rooms = Array.isArray(knowledge?.rooms) ? knowledge.rooms : [];

  if (isBookingHelpTopic(message)) {
    const roomHint = String(memory?.topic?.lastRoomType || '').trim();
    const suggested = roomHint
      ? rooms
          .filter((r) => String(r?.type || '').toLowerCase() === roomHint.toLowerCase())
          .sort((a, b) => Number(a.pricePerNight) - Number(b.pricePerNight))[0]
      : null;

    if (suggested) {
      return filipino
        ? `Narito ang booking steps: 1) Mag-sign in. 2) Pumunta sa Rooms page. 3) Piliin ang ${suggested.name} at dates mo. 4) I-click ang Reserve/Confirm. 5) Hintayin ang booking confirmation sa Dashboard. Note: reservation-first ito, walang payment na kukunin sa booking step.`
        : `Here are the booking steps: 1) Sign in. 2) Open the Rooms page. 3) Select ${suggested.name} and your dates. 4) Click Reserve/Confirm. 5) Wait for booking confirmation in your Dashboard. Note: this is reservation-first, and no payment is collected at booking step.`;
    }

    return filipino
      ? 'Narito ang booking steps: 1) Mag-sign in. 2) Pumunta sa Rooms page. 3) Piliin ang room at dates mo. 4) I-click ang Reserve/Confirm. 5) Hintayin ang confirmation sa Dashboard. Note: reservation-first ito, walang payment na kukunin sa booking step.'
      : 'Here are the booking steps: 1) Sign in. 2) Open the Rooms page. 3) Select your room and dates. 4) Click Reserve/Confirm. 5) Wait for confirmation in your Dashboard. Note: this is reservation-first, and no payment is collected at booking step.';
  }

  const amenityReply = amenityAvailabilityReply(message, memory);
  if (amenityReply) return amenityReply;

  if (/\b(check\s*-?in|check in|arrival time|oras ng check in|anong oras check in)\b/.test(text)) {
    return filipino
      ? 'Check-in time namin ay 2:00 PM. Puwede ang early check-in depende sa availability.'
      : 'Our standard check-in time is 2:00 PM. Early check-in may be available depending on room availability.';
  }

  if (/\b(check\s*-?out|check out|departure|oras ng check out|anong oras check out)\b/.test(text)) {
    return filipino
      ? 'Check-out time ay 12:00 PM. Maaari kang mag-request ng late check-out depende sa availability.'
      : 'Our check-out time is 12:00 PM. Late check-out can be requested subject to availability.';
  }

  if (/\b(payment|pay|gcash|card|credit card|cash|bayad|paano magbayad)\b/.test(text)) {
    return filipino
      ? 'Sa booking flow, reservation muna ang nire-record. Para sa payment options (cash/card/e-wallet), paki-confirm sa front desk o sa official contact details ng hotel.'
      : 'In the booking flow, we record the reservation first. For payment options (cash/card/e-wallet), please confirm directly with the front desk or official hotel contact details.';
  }

  if (/\b(cancel|cancellation|refund|rebook|reschedule|kansela|cancelled|cancel)\b/.test(text)) {
    if (/\b(how|paano|guide|steps?|process|help me|assist me)\b/.test(text)) {
      return filipino
        ? 'Narito ang mabilis na paraan para mag-cancel: 1) Mag-sign in at pumunta sa Dashboard. 2) Hanapin ang active booking mo. 3) I-click ang Request cancellation. 4) Hintayin ang staff approval (magiging Pending cancellation muna). Kung wala kang dashboard access, i-contact ang front desk at ibigay ang booking ID at pangalan mo.'
        : 'Here is the quickest way to cancel: 1) Sign in and open your Dashboard. 2) Find your active booking. 3) Click Request cancellation. 4) Wait for staff approval (status becomes Pending cancellation first). If Dashboard access is unavailable, contact the front desk and provide your booking ID and name.';
    }

    return filipino
      ? 'Para sa cancellation o changes, paki-contact ang front desk. Kung available sa account mo, gamitin din ang Dashboard cancellation request.'
      : 'For cancellation or booking changes, please contact the front desk. If available in your account, you can also submit a cancellation request from the Dashboard.';
  }

  if (/\b(amenit|facility|facilities|services|pasilidad|anong meron|anong facilities)\b/.test(text)) {
    return filipino
      ? 'Kasama sa highlighted amenities namin ang Sky Infinity Pool, Zen Wellness Studio (gym), Lumina Dining, at free WiFi. Para sa exact package inclusions, i-check ang reservation details.'
      : 'Our highlighted amenities include Sky Infinity Pool, Zen Wellness Studio (gym), Lumina Dining, and free WiFi. For exact package inclusions, please check reservation details.';
  }

  if (/\b(available room|available rooms|room types|what rooms do you have|mga room|anong room|uri ng room|available na rooms)\b/.test(text) && rooms.length) {
    return formatRoomListingResponse(rooms, filipino);
  }

  return null;
}

function connectedFollowUpReply(message, memory, knowledge) {
  const text = String(message || '').toLowerCase();
  const filipino = isLikelyFilipino(message);
  const rooms = Array.isArray(knowledge?.rooms) ? knowledge.rooms : [];
  const hasFollowUpCue = /\b(it|that|this|same|again|more|continue|what about|how about|compare|difference|yan|yun|ito|paano naman|pwede ba)\b/.test(text);
  if (!hasFollowUpCue) return null;

  const lastAssistant = getLastAssistantReply(memory).toLowerCase();
  if (!lastAssistant) return null;

  let mentionedRoom = rooms.find((r) => lastAssistant.includes(String(r.name || '').toLowerCase()));
  if (!mentionedRoom && memory?.topic?.lastRoomType) {
    const byType = rooms
      .filter((r) => String(r?.type || '').toLowerCase() === String(memory.topic.lastRoomType).toLowerCase())
      .sort((a, b) => Number(a.pricePerNight) - Number(b.pricePerNight));
    mentionedRoom = byType[0] || null;
  }
  if (!mentionedRoom) return null;

  const nights = memory?.slots?.nights || 1;
  const estimated = Math.max(1, Number(mentionedRoom.pricePerNight || 0)) * Math.max(1, Number(nights));

  return filipino
    ? `Base sa huli nating usapan, puwede pa rin ang ${mentionedRoom.name}. Tantyang total para sa ${nights} night(s): PHP ${estimated}. Kung gusto mo, iko-compare ko ito sa 1-2 alternative options.`
    : `Based on our previous message, ${mentionedRoom.name} is still a good option. Estimated total for ${nights} night(s): PHP ${estimated}. If you want, I can compare it against 1-2 alternatives.`;
}

function cancellationFollowUpReply(message, memory) {
  const text = String(message || '').toLowerCase().trim();
  const filipino = isLikelyFilipino(message);
  const lastAssistant = getLastAssistantReply(memory).toLowerCase();

  const hasCancellationContext =
    isCancellationTopic(lastAssistant) ||
    /dashboard|request cancellation|pending cancellation|front desk/.test(lastAssistant) ||
    String(memory?.topic?.current || '') === 'cancellation';
  if (!hasCancellationContext) return null;

  const hasFollowUpCue = /\b(what about|how about|that one|it|same|continue|next)\b/.test(text);
  const asksForGuidance =
    /\b(please|pls|help|guide|how|paano|steps?|process|sige|ok)\b/.test(text) ||
    hasFollowUpCue ||
    text.length <= 8;
  if (!asksForGuidance) return null;

  return filipino
    ? 'Sige, guided steps: 1) Mag-sign in at pumunta sa Dashboard. 2) Buksan ang active booking mo. 3) I-click ang Request cancellation. 4) Hintayin ang staff approval habang pending status. Kung hindi ma-access ang dashboard, tawagan ang front desk at ibigay ang booking ID at pangalan.'
    : 'Sure, guided steps: 1) Sign in and open Dashboard. 2) Open your active booking. 3) Click Request cancellation. 4) Wait for staff approval while status is pending. If Dashboard is unavailable, call the front desk and provide your booking ID and name.';
}

function isSmallTalk(message) {
  const text = String(message || '').toLowerCase().trim();
  return /\b(hi|hello|hey|kumusta|kamusta|good morning|good afternoon|good evening|thanks|thank you|salamat|ok|okay|sige|noted|got it|nice|game|tara|go)\b/.test(text);
}

function isFollowUpReference(message) {
  const text = String(message || '').toLowerCase();
  return /\b(it|that|this|those|these|one|same|again|more|continue|what about|how about|why|compare|difference|and|please|pls|help|guide|mas|yun|iyon|yan|ito|ganun|ganoon|paano naman|pwede ba)\b/.test(text);
}

function hasRecentHotelContext(memory) {
  if (['room', 'amenity', 'policy'].includes(String(memory?.topic?.current || ''))) return true;
  const recent = Array.isArray(memory?.messages) ? memory.messages.slice(-6) : [];
  return recent.some((m) => isRoomTopic(m?.content));
}

function hasRecentCancellationContext(memory) {
  if (String(memory?.topic?.current || '') === 'cancellation') return true;
  const recent = Array.isArray(memory?.messages) ? memory.messages.slice(-6) : [];
  return recent.some((m) => isCancellationTopic(m?.content));
}

function isHotelOrFollowUp(message, memory, extractedSlots) {
  if (isRoomTopic(message) || isSmallTalk(message) || isAIMetaQuestion(message)) return true;
  if (isFollowUpReference(message) && memory?.topic?.current && memory.topic.current !== 'general') return true;
  if (hasSlotDetails(extractedSlots) && hasRecentHotelContext(memory)) return true;
  if (isFollowUpReference(message) && hasRecentCancellationContext(memory)) return true;
  return isFollowUpReference(message) && hasRecentHotelContext(memory);
}

function buildOffTopicReply(message) {
  const filipino = isLikelyFilipino(message);
  return filipino
    ? 'Narito ako para tulungan ka sa hotel concerns. Maaari kang magtanong tungkol sa rooms, presyo, wifi, amenities, reservation, o cancellation. Kung may follow-up ka, ilagay lang ang details at itutuloy ko agad.'
    : 'I am here to help with hotel concerns. Ask about rooms, pricing, wifi, amenities, reservations, or cancellations. If this is a follow-up, share a little detail and I will continue from there.';
}

function pickBestRoomMatch(knowledge, guests, budget, preferredType = null) {
  const rooms = Array.isArray(knowledge?.rooms) ? knowledge.rooms : [];
  const filteredByType = preferredType ? rooms.filter((r) => String(r.type || '').toLowerCase() === preferredType) : rooms;
  const byCapacity = filteredByType.filter((r) => Number(r?.maxGuests) >= Math.max(1, Number(guests) || 1));
  const base = byCapacity.length ? byCapacity : filteredByType.length ? filteredByType : rooms;
  const sorted = [...base].sort((a, b) => Number(a.pricePerNight) - Number(b.pricePerNight));

  if (typeof budget === 'number' && Number.isFinite(budget)) {
    const withinBudget = sorted.filter((r) => Number(r.pricePerNight) <= budget);
    if (withinBudget.length) return { room: withinBudget[0], withinBudget: true };
  }

  return { room: sorted[0] || null, withinBudget: false };
}

function getConversationContext(memory) {
  const recent = Array.isArray(memory?.messages) ? memory.messages.slice(-6) : [];
  const lastUser = [...recent].reverse().find((m) => m.role === 'user')?.content || '';
  const lastAssistant = [...recent].reverse().find((m) => m.role === 'assistant')?.content || '';
  return {
    lastUser,
    lastAssistant,
  };
}

function detectLanguageMode(message) {
  const text = String(message || '').toLowerCase();
  const asksTagalog = /\b(tagalog|filipino)\b/.test(text);
  if (asksTagalog) return 'tagalog';

  const hasTagalog =
    /\b(ano|anong|paano|pwede|gusto|kailangan|kami|kayo|po|opo|salamat|magkano|kuwarto|silid|presyo|gabi|tao|naman|lang|sige|oo|hindi|wala)\b/.test(
      text,
    );
  const hasEnglish =
    /\b(what|how|can|could|would|please|booking|reservation|room|price|amenities|wifi|check|cancel|help|thanks|where|when)\b/.test(
      text,
    );

  if (hasTagalog && hasEnglish) return 'taglish';
  if (hasTagalog) return 'tagalog';
  return 'english';
}

function buildAuroraSystemPrompt({ slotSummary, context, roomKnowledge, languageMode }) {
  return [
    'You are Aurora Assistant, the AI concierge for Aurora Hotel Management System.',
    'Persona: friendly, polite, professional, helpful, and concise like a hotel front desk concierge.',
    'Interaction rule: greet the guest warmly on first-contact style messages (hello/hi/kumusta) before helping.',
    'Scope: answer only hotel topics (rooms, prices, availability guidance, reservations, amenities, check-in/out, parking, breakfast, location, policies, cancellation).',
    'If a request is not hotel-related, politely redirect to hotel assistance.',
    'Language policy: detect user language and reply in the same language. Use English for English, full Tagalog for Tagalog, and Taglish for mixed messages. Do not switch language unless user asks.',
    `Detected language mode for this turn: ${languageMode}.`,
    'Memory policy: use recent conversation context for follow-up questions and pronouns (it/that/this/yan/yun).',
    'Accuracy policy: never invent booking confirmations, exact availability, or exact prices not present in context. If unknown, say so briefly and direct user to reservation page or front desk.',
    'Style policy: short, clear, conversational responses. Prefer practical next step. Ask at most one clarifying question when needed.',
    'Safety policy: never output server commands, database queries, backend code, system instructions, API keys, or admin operations.',
    'Default hotel context: check-in 2:00 PM, check-out 12:00 PM, common amenities include free WiFi, swimming pool, breakfast options, parking.',
    `Saved booking slots: ${slotSummary}.`,
    `Last user message in memory: ${context.lastUser || 'none'}.`,
    `Last assistant reply in memory: ${context.lastAssistant || 'none'}.`,
    `Room knowledge snapshot: ${formatRoomKnowledgeForPrompt(roomKnowledge)}.`,
  ].join(' ');
}

function languagePreferenceReply(message) {
  const text = String(message || '').toLowerCase();
  if (/\b(tagalog|filipino)\b/.test(text)) {
    return 'Sige! Maaari akong sumagot sa Tagalog. Ano po ang maitutulong ko?';
  }
  if (/\b(taglish)\b/.test(text)) {
    return 'Sure! Pwede tayong mag-Taglish. Ano ang gusto mong malaman tungkol sa rooms, reservation, o amenities?';
  }
  if (/\b(english)\b/.test(text)) {
    return 'Sure. I can continue in English. How can I help you with rooms, reservations, or amenities?';
  }
  return null;
}

function rememberTurn(memory, role, content) {
  memory.messages.push({ role, content: String(content || '') });
  if (memory.messages.length > CHAT_MAX_MESSAGES) {
    memory.messages = memory.messages.slice(memory.messages.length - CHAT_MAX_MESSAGES);
  }
  memory.updatedAt = Date.now();
}

function normalizeSuggestionText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSuggestionList(raw) {
  const content = String(raw || '').trim();
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((q) => String(q || '').trim()).filter(Boolean);
    }
  } catch {
    // Fallback parsing below.
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);
}

function buildFallbackSuggestions(memory) {
  const recent = Array.isArray(memory?.messages) ? memory.messages.slice(-8) : [];
  const joined = recent
    .map((m) => String(m?.content || ''))
    .join(' ')
    .toLowerCase();

  if (/\b(reserve|reservation|booking|book|check\s*-?in|check\s*-?out|cancel|cancellation)\b/.test(joined)) {
    return [
      'Is a deposit required before check-in?',
      'Can I cancel my reservation without a fee?',
      'What time is check-in and check-out?',
      'Can I reserve a room online right now?',
    ];
  }

  if (/\b(price|budget|rate|cost|cheapest|discount|promo)\b/.test(joined)) {
    return [
      'What is the cheapest room available?',
      'Are there any promotions or discounts today?',
      'Which room is best for 3 guests on a budget?',
      'Is breakfast included in the room rate?',
    ];
  }

  if (/\b(wifi|internet|amenit|pool|parking|breakfast)\b/.test(joined)) {
    return [
      'Does every room include free WiFi?',
      'What amenities are included in each room?',
      'Is parking available for overnight guests?',
      'Is breakfast included in all room packages?',
    ];
  }

  return [
    'What rooms are available right now?',
    'What are the room prices?',
    'Which room is best for 3 guests?',
    'How can I make a reservation?',
  ];
}

function filterUniqueSuggestions(memory, suggestions, count) {
  const askedByUser = new Set(
    (Array.isArray(memory?.messages) ? memory.messages : [])
      .filter((m) => m?.role === 'user')
      .map((m) => normalizeSuggestionText(m.content)),
  );

  const shown = new Set((memory?.shownSuggestions || []).map((s) => normalizeSuggestionText(s)));
  const picked = [];
  const pickedNorm = new Set();

  for (const suggestion of suggestions) {
    const cleaned = String(suggestion || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) continue;

    const normalized = normalizeSuggestionText(cleaned);
    if (!normalized) continue;
    if (askedByUser.has(normalized)) continue;
    if (shown.has(normalized)) continue;
    if (pickedNorm.has(normalized)) continue;

    const withQuestionMark = cleaned.endsWith('?') ? cleaned : `${cleaned}?`;
    picked.push(withQuestionMark);
    pickedNorm.add(normalized);
    if (picked.length >= count) break;
  }

  return picked;
}

function rememberShownSuggestions(memory, suggestions) {
  const current = Array.isArray(memory?.shownSuggestions) ? memory.shownSuggestions : [];
  const merged = [...current, ...suggestions].map((s) => String(s || '').trim()).filter(Boolean);
  memory.shownSuggestions = [...new Set(merged)].slice(-SUGGESTION_MAX_TRACKED);
  memory.updatedAt = Date.now();
}

async function generateFollowUpSuggestions(memory, roomKnowledge, count = SUGGESTION_DEFAULT_COUNT) {
  const recentConversation = (Array.isArray(memory?.messages) ? memory.messages.slice(-10) : [])
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${String(m.content || '').trim()}`)
    .join('\n');

  const roomSnapshot = formatRoomKnowledgeForPrompt(roomKnowledge);
  const targetCount = Math.max(3, Math.min(4, Number(count) || SUGGESTION_DEFAULT_COUNT));

  for (const candidateModel of OLLAMA_MODEL_CANDIDATES) {
    try {
      const { response, data } = await fetchJsonWithTimeout(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: candidateModel,
            stream: false,
            options: {
              temperature: 0.35,
              top_p: 0.9,
              repeat_penalty: 1.1,
              num_predict: 180,
            },
            messages: [
              {
                role: 'system',
                content:
                  'You generate concise follow-up hotel questions in English only. Return only a valid JSON array of questions. No markdown, no explanations.' +
                  ' Questions must be relevant to hotel topics (rooms, pricing, amenities, reservation, cancellation, check-in/out).',
              },
              {
                role: 'user',
                content:
                  `Based on the conversation below, generate ${targetCount} short suggested follow-up questions that a hotel guest might ask next. ` +
                  'Rules: keep questions short; avoid repeating questions already asked; keep questions practical; return JSON array only. ' +
                  `Room data snapshot: ${roomSnapshot}. Conversation:\n${recentConversation || 'No prior conversation.'}`,
              },
            ],
          }),
        },
        AI_CHAT_TIMEOUT_MS,
      );

      if (!response.ok) continue;
      const parsed = parseSuggestionList(data?.message?.content || '');
      let filtered = filterUniqueSuggestions(memory, parsed, targetCount);

      if (filtered.length < targetCount) {
        const fallback = buildFallbackSuggestions(memory);
        filtered = filterUniqueSuggestions(memory, [...filtered, ...fallback], targetCount);
      }

      if (filtered.length) {
        rememberShownSuggestions(memory, filtered);
        return filtered;
      }
    } catch {
      // Try next model candidate.
    }
  }

  const fallback = filterUniqueSuggestions(memory, buildFallbackSuggestions(memory), targetCount);
  if (fallback.length) {
    rememberShownSuggestions(memory, fallback);
    return fallback;
  }
  return [];
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

function mergeRoomSources(dbRooms = [], staticRooms = []) {
  const merged = [...dbRooms, ...staticRooms];
  const seen = new Set();

  return merged.filter((room) => {
    const name = String(room?.name || '').trim().toLowerCase();
    const type = String(room?.type || '').trim().toLowerCase();
    const key = `${name}|${type}`;
    if (!name && !type) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getRoomKnowledgeSnapshot() {
  const now = Date.now();
  if (roomKnowledgeCache.snapshot && now - roomKnowledgeCache.updatedAt < ROOM_KB_TTL_MS) {
    return roomKnowledgeCache.snapshot;
  }

  try {
    const dbRooms = await Room.find({}, { name: 1, type: 1, pricePerNight: 1, maxGuests: 1, amenities: 1 }).lean();
    const base = mergeRoomSources(dbRooms, STATIC_ROOM_KNOWLEDGE);
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
  const wantsRecommendation = /\b(recommend|suggest|best room|which room|what room|rekomenda|irekomenda)\b/.test(text);
  if (asksRoomList && !wantsRecommendation) {
    return formatRoomListingResponse(rooms, filipino);
  }

  const asksCheapest = /\b(cheapest|lowest|budget room|pinakamura|murang room|lowest price)\b/.test(text);
  if (asksCheapest && knowledge.cheapestRoom) {
    const r = knowledge.cheapestRoom;
    return filipino
      ? `Pinakamura namin ngayon ang ${r.name} sa PHP ${r.pricePerNight} bawat gabi (hanggang ${r.maxGuests} guests).`
      : `Our most affordable option right now is ${r.name} at PHP ${r.pricePerNight} per night (up to ${r.maxGuests} guests).`;
  }

  const asksMostExpensive = /\b(most expensive|highest price|priciest|premium room|pinakamahal|pinaka mahal|mahal na room|most premium)\b/.test(text);
  if (asksMostExpensive) {
    const mostExpensiveRoom = [...rooms].sort((a, b) => Number(b.pricePerNight) - Number(a.pricePerNight))[0];
    if (mostExpensiveRoom) {
      const inclusions = formatRoomInclusions(mostExpensiveRoom?.amenities, filipino);
      return filipino
        ? `Pinaka-mahal na room namin ngayon ang **${mostExpensiveRoom.name}**.\n- Presyo: PHP ${mostExpensiveRoom.pricePerNight} bawat gabi\n- Kapasidad: Hanggang ${mostExpensiveRoom.maxGuests} guests\n- Inclusions: ${inclusions}`
        : `Our most expensive room right now is **${mostExpensiveRoom.name}**.\n- Price: PHP ${mostExpensiveRoom.pricePerNight} per night\n- Capacity: Up to ${mostExpensiveRoom.maxGuests} guests\n- Inclusions: ${inclusions}`;
    }
  }

  const asksBiggest = /\b(largest|biggest|family|group|pinakamalaki|pang pamilya|maraming tao)\b/.test(text);
  if (asksBiggest && knowledge.highestCapacityRoom) {
    const r = knowledge.highestCapacityRoom;
    return filipino
      ? `Para sa mas malaking group, pinaka-maluwag ang ${r.name} (hanggang ${r.maxGuests} guests, PHP ${r.pricePerNight} bawat gabi).`
      : `For larger groups, our most spacious option is ${r.name} (up to ${r.maxGuests} guests, PHP ${r.pricePerNight} per night).`;
  }

  const asksSpecificPrice = /\b(price|prices|rate|rates|presyo|magkano|how much|room price|room prices)\b/.test(text);
  if (asksSpecificPrice) {
    const matched = rooms.find((r) => text.includes(r.type) || text.includes(r.name.toLowerCase()));
    if (matched) {
      const inclusions = formatRoomInclusions(matched?.amenities, filipino);
      return filipino
        ? `**${matched.name}**\n- Presyo: PHP ${matched.pricePerNight} bawat gabi\n- Kapasidad: Hanggang ${matched.maxGuests} guests\n- Inclusions: ${inclusions}`
        : `**${matched.name}**\n- Price: PHP ${matched.pricePerNight} per night\n- Capacity: Up to ${matched.maxGuests} guests\n- Inclusions: ${inclusions}`;
    }

    return formatRoomPriceResponse(rooms, filipino);
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
    const availableModelNames = models.map((m) => String(m?.name || ''));
    const hasConfiguredModel = availableModelNames.some((name) => name.startsWith(`${OLLAMA_MODEL}`));
    return {
      online: true,
      model: OLLAMA_MODEL,
      modelAvailable: hasConfiguredModel,
      candidates: OLLAMA_MODEL_CANDIDATES,
      availableModels: availableModelNames.slice(0, 12),
    };
  } catch {
    return { online: false, model: OLLAMA_MODEL };
  } finally {
    clearTimeout(timeout);
  }
}

// Built-in fallback when Python ML is unavailable
function fallbackPredict(body, knowledge) {
  const guests = Number(body?.guests) || 2;
  const nights = Number(body?.nights) || 1;
  const budget = Number(body?.price) || 500;
  const filipino = Boolean(body?.filipino);
  const csvRecommendedType = recommendRoomTypeFromCsv({ guests, nights, budget });
  const preferredType = body?.roomType || csvRecommendedType || null;

  const { room: topChoice, withinBudget } = pickBestRoomMatch(knowledge, guests, budget, preferredType);
  let suggestion = 'Our room options vary by guest count and budget. ';
  if (topChoice && withinBudget) {
    suggestion = filipino
      ? `Para sa ${guests} guest(s) na may budget na PHP ${budget}, ang ${topChoice.name} ang pinaka-affordable na akmang option. `
      : `For ${guests} guest(s) with a budget of PHP ${budget}, ${topChoice.name} is the most affordable suitable option. `;
  } else if (topChoice) {
    suggestion = filipino
      ? `Para sa ${guests} guest(s), ang ${topChoice.name} ang pinakamalapit na fit base sa capacity at pricing. `
      : `For ${guests} guest(s), ${topChoice.name} is the closest available fit based on capacity and pricing. `;
  } else if (csvRecommendedType) {
    suggestion = filipino
      ? `Base sa recommendation dataset, ang ${csvRecommendedType} ang suggested room type para sa ${guests} guest(s) at budget na PHP ${budget}. `
      : `Based on the recommendation dataset, ${csvRecommendedType} is the suggested room type for ${guests} guest(s) with a budget of PHP ${budget}. `;
  }

  return {
    message: filipino
      ? `${suggestion}Tingnan ang Rooms page para sa latest availability at reservation flow.`
      : `${suggestion}Browse the Rooms page to see availability and reserve—no payment is collected at booking.`,
    type: topChoice?.type || undefined,
  };
}

// Built-in fallback when Python NLP is unavailable: hotel-specific intents
function fallbackChat(message) {
  if (!message || typeof message !== 'string') {
    return { reply: 'How can I help you today? Ask about our rooms, wifi, or how to make a reservation.' };
  }

  const datasetReply = findDatasetReply(message);
  if (datasetReply) {
    return { reply: datasetReply };
  }

  const filipino = isLikelyFilipino(message);
  const text = message.toLowerCase().trim();

  if (/\b(game|tara|go)\b/.test(text)) {
    return filipino
      ? { reply: 'Game! Tulungan kita maghanap ng best room. Ilan kayo at magkano ang budget mo?' }
      : { reply: 'Great. Let us find the best room for you. How many guests and what is your budget?' };
  }

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

  if (/\b(check\s*-?in|check\s*-?out|arrival|departure|amenit|facility|cancel|cancellation|refund|payment|gcash|cash|card)\b/.test(text)) {
    return {
      reply: filipino
        ? 'Matutulungan kita sa check-in/out, cancellation, payment guidance, at amenities. Sabihin mo lang kung alin ang kailangan mo para mas specific ang sagot ko.'
        : 'I can help with check-in/out, cancellation guidance, payment questions, and amenities. Tell me which one you need and I will answer specifically.',
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
  const roomKnowledge = await getRoomKnowledgeSnapshot();
  res.json(fallbackPredict({ ...req.body, filipino: isLikelyFilipino(req.body?.message || '') }, roomKnowledge));
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
 * Generate AI follow-up suggestions for the current chat session.
 * POST /api/ai/suggestions { count }
 */
router.post('/suggestions', async (req, res) => {
  pruneExpiredMemory();
  const sessionKey = getChatSessionKey(req);
  const memory = getOrCreateChatMemory(sessionKey);
  const roomKnowledge = await getRoomKnowledgeSnapshot();
  const count = Number(req.body?.count) || SUGGESTION_DEFAULT_COUNT;

  const suggestions = await generateFollowUpSuggestions(memory, roomKnowledge, count);
  return res.json({ suggestions });
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
  updateTopicMemory(memory, message, extractedSlots);

  const languageReply = languagePreferenceReply(message);
  if (languageReply) {
    rememberTurn(memory, 'user', String(message || ''));
    rememberTurn(memory, 'assistant', languageReply);
    return res.json({ reply: languageReply });
  }

  // Guardrail: avoid drifting to unrelated topics and keep answers on hotel/follow-up context.
  if (!isHotelOrFollowUp(message, memory, extractedSlots)) {
    const offTopic = buildOffTopicReply(message);
    rememberTurn(memory, 'user', String(message || ''));
    rememberTurn(memory, 'assistant', offTopic);
    return res.json({ reply: offTopic });
  }

  const roomKnowledge = await getRoomKnowledgeSnapshot();
  mergeSlots(memory, extractedSlots);

  // Strong deterministic knowledge path for frequently asked guest questions.
  const faqReply = faqKnowledgeReply(message, roomKnowledge, memory);
  if (faqReply) {
    rememberTurn(memory, 'user', String(message || ''));
    rememberTurn(memory, 'assistant', faqReply);
    return res.json({ reply: faqReply });
  }

  // If the user follows up on a previous recommendation, keep continuity.
  const followUpReply = connectedFollowUpReply(message, memory, roomKnowledge);
  if (followUpReply) {
    rememberTurn(memory, 'user', String(message || ''));
    rememberTurn(memory, 'assistant', followUpReply);
    return res.json({ reply: followUpReply });
  }

  const cancelFollowUp = cancellationFollowUpReply(message, memory);
  if (cancelFollowUp) {
    rememberTurn(memory, 'user', String(message || ''));
    rememberTurn(memory, 'assistant', cancelFollowUp);
    return res.json({ reply: cancelFollowUp });
  }

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
    const preferredRoomType = memory.slots.roomType || null;

    if (!guests || !budget) {
      const missing = [];
      if (!guests) missing.push('number of guests');
      if (!budget) missing.push('budget');
      const filipino = isLikelyFilipino(message);

      if (guests && !budget) {
        const quickMatch = pickBestRoomMatch(roomKnowledge, guests, null, preferredRoomType);
        if (quickMatch.room) {
          const guidedReply = filipino
            ? `Salamat! Para sa ${guests} guest(s), puwedeng magandang option ang ${quickMatch.room.name}. Magkano ang budget mo para mahanapan kita ng pinaka-affordable na fit?`
            : `Thanks. For ${guests} guest(s), ${quickMatch.room.name} can be a good starting option. What budget do you have so I can find the most affordable fit?`;
          rememberTurn(memory, 'user', String(message || ''));
          rememberTurn(memory, 'assistant', guidedReply);
          return res.json({ reply: guidedReply });
        }
      }

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

    const fallbackRecommendation = fallbackPredict(
      { guests, nights, price: budget, roomType: preferredRoomType, filipino: isLikelyFilipino(message) },
      roomKnowledge,
    );
    rememberTurn(memory, 'user', String(message || ''));
    rememberTurn(memory, 'assistant', fallbackRecommendation.message);
    return res.json({ reply: fallbackRecommendation.message, type: fallbackRecommendation.type });
  }

  // 1) Try local Ollama first (free, runs on your laptop)
  if (OLLAMA_MODEL_CANDIDATES.length) {
    try {
      const context = getConversationContext(memory);
      const languageMode = detectLanguageMode(message);
      const slotSummary = [
        memory.slots.guests ? `guests=${memory.slots.guests}` : null,
        memory.slots.nights ? `nights=${memory.slots.nights}` : null,
        memory.slots.budget ? `budget=${memory.slots.budget}` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'none';

      const recentMessages = memory.messages.slice(-8);
      const promptMessages = [
        {
          role: 'system',
          content: buildAuroraSystemPrompt({
            slotSummary,
            context,
            roomKnowledge,
            languageMode,
          }),
        },
        ...recentMessages,
        { role: 'user', content: String(message || '') },
      ];

      for (const candidateModel of OLLAMA_MODEL_CANDIDATES) {
        const { response, data } = await fetchJsonWithTimeout(
          `${OLLAMA_BASE_URL}/api/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: candidateModel,
              stream: false,
              options: {
                temperature: OLLAMA_TEMPERATURE,
                top_p: OLLAMA_TOP_P,
                repeat_penalty: OLLAMA_REPEAT_PENALTY,
                num_predict: OLLAMA_NUM_PREDICT,
              },
              messages: promptMessages,
            }),
          },
          AI_CHAT_TIMEOUT_MS,
        );

        if (response.ok && data?.message?.content) {
          rememberTurn(memory, 'user', String(message || ''));
          rememberTurn(memory, 'assistant', data.message.content);
          return res.json({ reply: data.message.content, model: candidateModel });
        }
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
