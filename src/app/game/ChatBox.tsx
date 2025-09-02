'use client';

import { useState } from 'react';
import { askAI } from '@/lib/openai';

interface Props {
  moves: string[];
}

export default function ChatBox({ moves }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = `👤: ${input}`;
    setMessages((prev) => [...prev, userMessage]);

    // 💡 Bağlamlı prompt
    const history = moves.length > 0 ? `Hamle geçmişi: ${moves.join(', ')}.\n` : '';
    const fullPrompt = `${history}Kullanıcının sorusu: ${input}`;

    try {
      const aiReply = await askAI(fullPrompt);
      setMessages((prev) => [...prev, `🤖: ${aiReply}`]);
    } catch (err) {
      setMessages((prev) => [...prev, '🤖: [AI cevap veremedi]']);
    }

    setInput('');
  }

  return (
    <div className="w-full max-w-md border rounded-lg p-4 bg-white shadow">
      <div className="h-64 overflow-y-auto mb-3 bg-gray-100 p-3 rounded text-black text-sm whitespace-pre-wrap">
        {messages.map((msg, i) => (
          <div key={i} className="mb-2">{msg}</div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="border rounded flex-grow p-2 text-black"
          placeholder="AI'ya bir şey sor..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Gönder
        </button>
      </div>
    </div>
  );
}
