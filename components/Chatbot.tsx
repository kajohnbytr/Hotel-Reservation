import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { getApiBaseUrl } from '../lib/api';

const PRE_SEND_DELAY_MS = 120;
const TYPING_CHAR_INTERVAL_MS = 8;
const MAX_TYPING_ANIMATION_CHARS = 140;

const STARTER_QUESTIONS = [
  'What rooms are available?',
  'What are the room prices?',
  'Does the hotel provide free WiFi?',
  'How do I make a reservation?',
];

/** Removes consecutive repeated words so the bot doesn't say "the the" or "room room". */
function deduplicateRepeatedWords(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // Preserve intentional line breaks by deduplicating on each line.
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[ \t]+/g, ' ')
        .trim()
        .split(' ')
        .filter((word, i, arr) => i === 0 || word.toLowerCase() !== arr[i - 1]?.toLowerCase())
        .join(' '),
    )
    .join('\n')
    .trim();
}

function normalizeRoomCatalogMessage(text: string): string {
  const source = String(text || '');
  const lower = source.toLowerCase();
  if (!/(available rooms|room prices|room options)/.test(lower)) return source;

  const pattern = /([A-Za-z][A-Za-z0-9\s'\-]*?)\s*₱\s?(\d+(?:,\d+)*)\s*(?:\/\s*night|per\s*night)?\s*(?:•|-)?\s*up to\s*(\d+)\s*guests/gi;
  const matches = [...source.matchAll(pattern)];
  if (matches.length < 2) return source;

  const first = matches[0];
  const headingRaw = source.slice(0, first.index ?? 0).trim();
  const heading = headingRaw || 'Here are our available rooms:';

  const blocks = matches.map((m) => {
    const name = String(m[1] || '').trim();
    const price = String(m[2] || '').trim();
    const guests = String(m[3] || '').trim();
    return `**${name}**\n- Price: ₱${price} per night\n- Capacity: Up to ${guests} guests`;
  });

  const last = matches[matches.length - 1];
  const tailStart = (last.index ?? 0) + last[0].length;
  const footer = source.slice(tailStart).trim();

  return `${heading}\n\n${blocks.join('\n\n')}${footer ? `\n\n${footer}` : ''}`;
}

function renderInlineRichText(line: string): React.ReactNode {
  const parts = String(line || '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, idx) => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return <strong key={`b-${idx}`}>{boldMatch[1]}</strong>;
    }
    return <React.Fragment key={`t-${idx}`}>{part}</React.Fragment>;
  });
}

function renderMultilineText(text: string): React.ReactNode {
  const lines = String(text || '').split(/\n/);
  return lines.map((line, idx) => (
    <React.Fragment key={`line-${idx}`}>
      {line.startsWith('- ') ? <>• {renderInlineRichText(line.slice(2))}</> : renderInlineRichText(line)}
      {idx < lines.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
}

export function Chatbot({ onRecommend }: { onRecommend?: (type: string) => void }) {
  const API_BASE = getApiBaseUrl();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: 'Welcome to Aurora. Ask about rooms, prices, or reservations, then share your budget and number of guests for recommendations.' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [ollamaModelStatus, setOllamaModelStatus] = useState<'unknown' | 'ok' | 'missing'>('unknown');
  const [showStarterPanel, setShowStarterPanel] = useState(false);
  const [starterDismissed, setStarterDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasConversationStarted = messages.some((m) => m.role === 'user');
  const firstMessage = messages[0];
  const remainingMessages = messages.slice(1);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen || hasConversationStarted || starterDismissed) {
      setShowStarterPanel(false);
      return;
    }

    const timer = setTimeout(() => setShowStarterPanel(true), 180);
    return () => clearTimeout(timer);
  }, [isOpen, hasConversationStarted, starterDismissed]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ai/health`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const online = Boolean(data?.ollama?.online);
        setOllamaStatus(online ? 'online' : 'offline');
        if (online) {
          setOllamaModelStatus(data?.ollama?.modelAvailable === false ? 'missing' : 'ok');
        } else {
          setOllamaModelStatus('unknown');
        }
      } catch {
        if (!cancelled) {
          setOllamaStatus('offline');
          setOllamaModelStatus('unknown');
        }
      }
    };

    setOllamaStatus('checking');
    checkHealth();
    const interval = setInterval(checkHealth, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [API_BASE, isOpen]);

  const getChatSessionId = () => {
    const key = 'aurora_chat_session_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(key, id);
    }
    return id;
  };

  // Smoothly stream a bot response character by character
  const streamBotMessage = async (text: string, recommendedType: string | null) => {
    const normalized = normalizeRoomCatalogMessage(text || '');
    const finalText = deduplicateRepeatedWords(normalized);
    if (!finalText) {
      setIsTyping(false);
      return;
    }

    // Long answers are shown immediately to avoid multi-second rendering delays.
    if (finalText.length > MAX_TYPING_ANIMATION_CHARS) {
      setMessages((prev) => [...prev, { role: 'bot', text: finalText }]);
      if (recommendedType && onRecommend) onRecommend(recommendedType);
      setIsTyping(false);
      return;
    }

    // Add an empty bot message first
    setMessages((prev) => [...prev, { role: 'bot', text: '' }]);

    await new Promise<void>((resolve) => {
      let index = 0;
      const interval = setInterval(() => {
        index += 1;
        const slice = finalText.slice(0, index);
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const copy = [...prev];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = last.role === 'bot' ? { ...last, text: slice } : last;
          return copy;
        });
        if (index >= finalText.length) {
          clearInterval(interval);
          resolve();
        }
      }, TYPING_CHAR_INTERVAL_MS); // typing speed (ms per character)
    });

    if (recommendedType && onRecommend) onRecommend(recommendedType);
    setIsTyping(false);
  };

  // ================= TALK TO NLP CHATBOT (via backend) =================
  const askNLP = async (message: string): Promise<{ reply: string; type?: string }> => {
    const sessionId = getChatSessionId();
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Chat-Session-Id": sessionId,
        },
        body: JSON.stringify({ message })
      });

      const data = await res.json();
      return {
        reply: data.reply ?? "I am currently offline. Please try again.",
        type: data.type,
      };
    } catch {
      return { reply: "I am currently offline. Please try again." };
    }
  };

  // ================= SEND MESSAGE =================
  const sendUserMessage = async (userMessage: string) => {
    if (!userMessage.trim() || isTyping) return;

    setStarterDismissed(true);
    setShowStarterPanel(false);
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    // Keep a tiny pause so typing indicator appears, but avoid noticeable lag.
    await new Promise((resolve) => setTimeout(resolve, PRE_SEND_DELAY_MS));

    let botResponse = "";
    let recommendedType: string | null = null;
    const data = await askNLP(userMessage);
    botResponse = data.reply;
    if (data.type) recommendedType = data.type;

    await streamBotMessage(botResponse, recommendedType);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input;
    setInput('');
    await sendUserMessage(userMessage);
  };

  const handleStarterClick = async (question: string) => {
    if (isTyping) return;
    await sendUserMessage(question);
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
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span className="font-serif tracking-wide">Aurora Assistant</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#F9F7F2]/70">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      ollamaStatus === 'online'
                        ? 'bg-emerald-400'
                        : ollamaStatus === 'offline'
                          ? 'bg-red-400'
                          : 'bg-amber-300 animate-pulse'
                    }`}
                  />
                  <span>
                    Ollama: {ollamaStatus}
                    {ollamaStatus === 'online' && ollamaModelStatus === 'missing' ? ' (model missing)' : ''}
                  </span>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[#F9F7F2]/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
              {firstMessage && (
                <div className={`flex ${firstMessage.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] p-4 text-sm leading-relaxed ${
                      firstMessage.role === 'user'
                        ? 'bg-[#0A2342] text-white rounded-t-xl rounded-bl-xl'
                        : 'bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 text-[#0A2342] dark:text-[#F9F7F2] rounded-t-xl rounded-br-xl'
                    } whitespace-pre-wrap`}
                  >
                    {renderMultilineText(firstMessage.text)}

                    {firstMessage.role === 'bot' && showStarterPanel && !hasConversationStarted && !isTyping && (
                      <div className="mt-4 pt-3 border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/15">
                        <p className="text-[11px] uppercase tracking-widest text-[#0A2342]/60 dark:text-[#F9F7F2]/60 mb-2">
                          Start by asking
                        </p>
                        <ol className="list-decimal pl-5 space-y-1.5">
                          {STARTER_QUESTIONS.map((question, idx) => (
                            <motion.li
                              key={question}
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.18, delay: idx * 0.04 }}
                              className="text-sm text-[#0A2342]/80 dark:text-[#F9F7F2]/80"
                            >
                              <button
                                onClick={() => handleStarterClick(question)}
                                className="text-left hover:text-[#0A2342] dark:hover:text-white transition-colors"
                              >
                                {question}
                              </button>
                            </motion.li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {remainingMessages.map((msg, idx) => (
                <div key={`${idx + 1}-${msg.role}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] p-4 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#0A2342] text-white rounded-t-xl rounded-bl-xl'
                        : 'bg-white dark:bg-[#05152a] border border-[#0A2342]/10 dark:border-[#F9F7F2]/10 text-[#0A2342] dark:text-[#F9F7F2] rounded-t-xl rounded-br-xl'
                    } whitespace-pre-wrap`}
                  >
                    {renderMultilineText(msg.text)}
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
