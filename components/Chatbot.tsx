import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { wait } from '../lib/utils';

/** Removes consecutive repeated words so the bot doesn't say "the the" or "room room". */
function deduplicateRepeatedWords(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((word, i, arr) => i === 0 || word.toLowerCase() !== arr[i - 1]?.toLowerCase())
    .join(' ');
}

export function Chatbot({ onRecommend }: { onRecommend?: (type: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: 'Welcome to Aurora. Ask about rooms, wifi, prices, or how to reserve. You can also tell me your budget or number of guests for a suggestion.' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestionsScrollRef = useRef<HTMLDivElement>(null);

  const quickReplies = [
    'What rooms do you have?',
    "What's the price range?",
    'I need a room for 2 guests',
    'Tell me about wifi',
    'How do I make a reservation?',
    'Recommend a room for my budget',
    'Is wifi included?',
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // ================= TALK TO NLP CHATBOT (via backend) =================
  const askNLP = async (message: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });

      const data = await res.json();
      return data.reply ?? "I am currently offline. Please try again.";
    } catch {
      return "I am currently offline. Please try again.";
    }
  };

  // ================= EXTRACT BOOKING INFO =================
  const extractBookingInfo = (text: string) => {
    const lower = text.toLowerCase();
    const numbers = text.match(/\d+/g) || [];
    let guests = 2;
    let nights = 1;
    let price = 500;

    // "2 guests" / "for 2 people" / "2 people"
    const guestMatch = lower.match(/(\d+)\s*(guest|people|person|adult|pax)/) || lower.match(/(?:for|party of)\s*(\d+)/);
    if (guestMatch) guests = parseInt(guestMatch[1], 10) || guests;

    // "3 nights" / "3 days" / "stay 2 nights"
    const nightMatch = lower.match(/(\d+)\s*(night|day)/) || lower.match(/(?:stay|for)\s*(\d+)/);
    if (nightMatch) nights = parseInt(nightMatch[1], 10) || nights;

    // "budget 5000" / "under 300" / "price 200" / "₱1000"
    const priceMatch = lower.match(/(?:budget|under|max|price|₱|php|peso)\s*(\d+)/i) || lower.match(/(\d+)\s*(?:budget|peso|php)/i);
    if (priceMatch) price = parseInt(priceMatch[1], 10) || price;
    else if (numbers.length >= 3) price = parseInt(numbers[2], 10) || price;
    else if (numbers.length === 2) { guests = parseInt(numbers[0], 10) || guests; nights = parseInt(numbers[1], 10) || nights; }
    else if (numbers.length === 1) guests = parseInt(numbers[0], 10) || guests;

    return { guests: Math.min(10, Math.max(1, guests)), nights: Math.min(30, Math.max(1, nights)), price };
  };

  // ================= CALL AI RECOMMENDATION (via backend) =================
  const callAI = async (bookingInfo: { guests: number; nights: number; price: number }) => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingInfo)
      });
      const data = await res.json();
      return data;
    } catch {
      return { message: "I cannot access the recommendation system right now." };
    }
  };

  // ================= SEND MESSAGE =================
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    await wait(900);

    let botResponse = "";
    const lowerInput = userMessage.toLowerCase();

    // ===== DETECT BOOKING / RECOMMENDATION REQUEST =====
    let recommendedType: string | null = null;
    if (
      lowerInput.includes("guest") ||
      lowerInput.includes("people") ||
      lowerInput.includes("person") ||
      lowerInput.includes("night") ||
      lowerInput.includes("budget") ||
      lowerInput.includes("stay") ||
      lowerInput.includes("recommend") ||
      lowerInput.includes("suggest")
    ) {
      const bookingInfo = extractBookingInfo(userMessage);
      const data = await callAI(bookingInfo);
      botResponse = typeof data === 'string' ? data : (data?.message ?? data);
      if (typeof data === 'object' && data?.type) recommendedType = data.type;
    }

    // ===== NORMAL CHAT =====
    else {
      botResponse = await askNLP(userMessage);
    }

    botResponse = deduplicateRepeatedWords(botResponse);
    setMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
    if (recommendedType && onRecommend) onRecommend(recommendedType);
    setIsTyping(false);
  };

  const handleQuickReply = (text: string) => {
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsTyping(true);
    (async () => {
      await wait(600);
      const lower = text.toLowerCase();
      let botResponse: string;
      let recommendedType: string | null = null;
      if (/\b(guest|people|night|budget|stay|room|recommend)\b/.test(lower)) {
        const info = extractBookingInfo(text);
        const data = await callAI(info);
        botResponse = typeof data === 'object' && data?.message ? data.message : String(data);
        if (typeof data === 'object' && data?.type) recommendedType = data.type;
      } else {
        botResponse = await askNLP(text);
      }
      setMessages(prev => [...prev, { role: 'bot', text: deduplicateRepeatedWords(botResponse) }]);
      if (recommendedType && onRecommend) onRecommend(recommendedType);
      setIsTyping(false);
    })();
  };

  return (
    <>
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 z-40 w-14 h-14 bg-[#0A2342] text-[#D4AF37] rounded-full flex items-center justify-center shadow-2xl hover:bg-[#153a66] transition-colors"
        >
          <MessageSquare className="w-6 h-6" />
        </motion.button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-50 w-80 sm:w-96 h-[500px] bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 shadow-2xl flex flex-col overflow-hidden rounded-2xl"
          >
            <div className="p-4 bg-[#0A2342] text-[#F9F7F2] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                <span className="font-serif tracking-wide">Aurora Assistant</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[#F9F7F2]/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] p-4 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#0A2342] text-white rounded-t-xl rounded-bl-xl'
                        : 'bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 text-[#0A2342] dark:text-[#F9F7F2] rounded-t-xl rounded-br-xl'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 p-4 rounded-t-xl rounded-br-xl">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#0A2342]/40 dark:bg-[#F9F7F2]/40 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-[#0A2342]/40 dark:bg-[#F9F7F2]/40 rounded-full animate-bounce delay-100" />
                      <span className="w-1.5 h-1.5 bg-[#0A2342]/40 dark:bg-[#F9F7F2]/40 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 w-full min-w-0 flex flex-col border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/10 bg-[#F9F7F2]/30 dark:bg-[#05152a]/50">
              <div
                ref={suggestionsScrollRef}
                role="region"
                aria-label="Suggestion chips"
                className="chatbot-suggestions-scroll w-full min-w-0 overflow-x-scroll overflow-y-hidden"
                style={{ WebkitOverflowScrolling: 'touch' }}
                onWheel={(e) => {
                  const el = suggestionsScrollRef.current;
                  if (!el || e.deltaY === 0) return;
                  const canScrollLeft = el.scrollLeft > 0;
                  const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
                  if ((e.deltaY > 0 && canScrollRight) || (e.deltaY < 0 && canScrollLeft)) {
                    e.preventDefault();
                    el.scrollLeft += e.deltaY;
                  }
                }}
              >
                <div className="flex flex-nowrap gap-2 px-4 py-2.5 pb-3" style={{ width: 'max-content', minWidth: 'max-content' }}>
                  {quickReplies.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQuickReply(q)}
                      className="flex-shrink-0 inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-[#0A2342] text-white hover:bg-[#153a66] dark:bg-[#0A2342] dark:text-[#F9F7F2] dark:hover:bg-[#153a66] border-0 transition-colors shadow-sm"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-[#05152a] border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about rooms, wifi, or tell your budget..."
                  className="flex-1 bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 rounded-lg px-4 py-3 text-[#0A2342] dark:text-[#F9F7F2] text-sm focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  onClick={handleSend}
                  className="p-3 bg-[#0A2342] text-[#D4AF37] rounded-lg hover:bg-[#153a66] transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
