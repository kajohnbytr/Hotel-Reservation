import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { wait } from '../lib/utils';

export function Chatbot({ onRecommend }: { onRecommend?: (type: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: 'Welcome to Aurora. How may I assist you today?' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // ================= TALK TO NLP CHATBOT =================
  const askNLP = async (message: string) => {
    try {
      const res = await fetch("http://localhost:5002/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });

      const data = await res.json();
      return data.reply;
    } catch {
      return "I am currently offline. Please try again.";
    }
  };

  // ================= EXTRACT BOOKING INFO =================
  const extractBookingInfo = (text: string) => {
    const numbers = text.match(/\d+/g);

    let guests = 2;
    let nights = 1;
    let price = 2500;

    if (numbers) {
      if (numbers[0]) guests = parseInt(numbers[0]);
      if (numbers[1]) nights = parseInt(numbers[1]);
      if (numbers[2]) price = parseInt(numbers[2]);
    }

    return { guests, nights, price };
  };

  // ================= CALL AI RECOMMENDATION =================
  const callAI = async (bookingInfo: any) => {
    try {
      const res = await fetch("http://localhost:5000/api/ai/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bookingInfo)
      });

      const data = await res.json();
      return data.message;

    } catch {
      return "I cannot access the recommendation system right now.";
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

    // ===== DETECT BOOKING REQUEST =====
    if (
      lowerInput.includes("guest") ||
      lowerInput.includes("people") ||
      lowerInput.includes("person") ||
      lowerInput.includes("night") ||
      lowerInput.includes("budget") ||
      lowerInput.includes("stay")
    ) {
      const bookingInfo = extractBookingInfo(userMessage);
      botResponse = await callAI(bookingInfo);
    }

    // ===== NORMAL CHAT =====
    else {
      botResponse = await askNLP(userMessage);
    }

    setMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
    setIsTyping(false);
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
            className="fixed bottom-8 right-8 z-50 w-80 sm:w-96 h-[500px] bg-[#F9F7F2] border border-[#0A2342]/20 shadow-2xl flex flex-col overflow-hidden rounded-2xl"
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
                        : 'bg-white border border-[#0A2342]/10 text-[#0A2342] rounded-t-xl rounded-br-xl'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-[#0A2342]/10 p-4 rounded-t-xl rounded-br-xl">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#0A2342]/40 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-[#0A2342]/40 rounded-full animate-bounce delay-100" />
                      <span className="w-1.5 h-1.5 bg-[#0A2342]/40 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-[#0A2342]/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about rooms, wifi, or tell your budget..."
                  className="flex-1 bg-[#F9F7F2] border border-[#0A2342]/20 rounded-lg px-4 py-3 text-[#0A2342] text-sm focus:outline-none focus:border-[#D4AF37]"
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
