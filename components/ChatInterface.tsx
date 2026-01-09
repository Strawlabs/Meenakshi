
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ChatMessage } from '../types';
import { MEENAKSHI_SYSTEM_PROMPT } from '../constants';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Vanakkam! Naan Meenakshi — Maa Madurai Vizha AI host. How can I help you today?', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText, timestamp: Date.now() }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const isLocationQuery = userText.toLowerCase().includes('where') || userText.toLowerCase().includes('location') || userText.toLowerCase().includes('nearby');
      const isRealTimeQuery = userText.toLowerCase().includes('latest') || userText.toLowerCase().includes('news') || userText.toLowerCase().includes('current');

      const modelName = isLocationQuery ? 'gemini-2.5-flash' : 'gemini-3-flash-preview';
      const tools = [];
      if (isLocationQuery) tools.push({ googleMaps: {} });
      if (isRealTimeQuery) tools.push({ googleSearch: {} });

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userText,
        config: {
          systemInstruction: MEENAKSHI_SYSTEM_PROMPT,
          tools: tools.length > 0 ? tools : undefined,
        },
      });

      let aiText = response.text || "I'm sorry, I couldn't process that.";
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        const links = chunks.map((c: any) => {
          if (c.web) return `[${c.web.title}](${c.web.uri})`;
          if (c.maps) return `[${c.maps.title}](${c.maps.uri})`;
          return null;
        }).filter(Boolean);
        
        if (links.length > 0) {
          aiText += "\n\nSources:\n" + links.join('\n');
        }
      }

      setMessages(prev => [...prev, { role: 'model', text: aiText, timestamp: Date.now() }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Ennala ippo bathil solla mudiyala. Konjam kazhithu try pannunga. (Sorry, I'm having trouble right now.)", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] glass rounded-3xl overflow-hidden mt-6">
      <div className="p-4 border-b border-white/10 bg-white/5">
        <h2 className="font-bold flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Chat with Meenakshi
        </h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
              m.role === 'user' 
                ? 'bg-orange-500 text-white rounded-tr-none' 
                : 'bg-white/10 text-slate-100 rounded-tl-none border border-white/5'
            }`}>
              {m.text.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
              ))}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 px-4 py-2 rounded-2xl rounded-tl-none animate-pulse">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white/5 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white p-2 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;