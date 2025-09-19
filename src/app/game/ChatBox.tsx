'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { useLang } from '@/providers/LanguageProvider';

type Msg = { role: 'user' | 'ai'; text: string };

export default function ChatBox({ moves, fen }: { moves: string[]; fen: string }) {
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const { lang, t } = useLang();
  const listRef = useRef<HTMLDivElement | null>(null);

  const pieceTR: Record<string, string> = {
    p: 'Piyon', n: 'At', b: 'Fil', r: 'Kale', q: 'Vezir', k: 'Şah',
  };
  const files = ['a','b','c','d','e','f','g','h'];
  const sqName = (r: number, f: number) => `${files[f]}${8 - r}`;

  function kingSqOf(g: Chess, color: 'w' | 'b'): string | null {
    const b = g.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const c = b[r][f];
      if (c && c.type === 'k' && c.color === color) return sqName(r, f);
    }
    return null;
  }

  // --- STATE: tahtadan türetilen gerçekler (LLM’e her mesajda bunu vereceğiz)
  const state = useMemo(() => {
    const g = new Chess(fen);
    const board = g.board();

    const whitePieces: Array<{ piece: string; square: string }> = [];
    const blackPieces: Array<{ piece: string; square: string }> = [];
    for (let r = 0; r < 8; r++) {
      for (let fIdx = 0; fIdx < 8; fIdx++) {
        const cell = board[r][fIdx];
        if (!cell) continue;
        const sq = sqName(r, fIdx);
        (cell.color === 'w' ? whitePieces : blackPieces).push({
          piece: pieceTR[cell.type] ?? cell.type.toUpperCase(),
          square: sq,
        });
      }
    }

    const turnColor = g.turn(); // 'w' | 'b'
    const whiteLabel = t('white');
    const blackLabel = t('black');
    const turnLabel = turnColor === 'w' ? whiteLabel : blackLabel;

    const legalVerbose = g.moves({ verbose: true }) as any[];

    return {
      fen,
      side_to_move: turnLabel,
      last_move: moves[moves.length - 1] ?? null,
      is_check: g.isCheck(),
      is_checkmate: g.isCheckmate(),
      is_stalemate: g.isStalemate(),
      is_draw: g.isDraw(),
      w_king: kingSqOf(g, 'w'),
      b_king: kingSqOf(g, 'b'),
      legal_count: legalVerbose.length,
      // SAN ve basit verbose (LLM hamle seçebilmek için)
      legal_moves_san: g.moves(),
      legal_moves_verbose: legalVerbose.map(m => ({
        from: m.from, to: m.to, san: m.san, piece: m.piece,
        captured: m.captured ?? null, promotion: m.promotion ?? null
      })),
      white: { count: whitePieces.length, pieces: whitePieces, label: whiteLabel },
      black: { count: blackPieces.length, pieces: blackPieces, label: blackLabel },
    };
  }, [fen, moves, t]);

  // Basit yerel özet (LLM boş dönerse yedek)
  function localFallbackSummary(): string {
    const d = state;
    if (d.is_checkmate) {
      const loser = d.side_to_move === t('white') ? t('white') : t('black');
      const winner = d.side_to_move === t('white') ? t('black') : t('white');
      return `${t('status.checkmate')} ${loser} ${t('status.mated')} — ${winner} ${t('status.won')}.`;
    }
    if (d.is_stalemate) return `${t('status.stalemate')} ${t('status.turnOf')} ${d.side_to_move}.`;
    if (d.is_draw) return `${t('status.draw')} ${t('status.turnOf')} ${d.side_to_move}.`;
    return `${t('status.turnOf')} ${d.side_to_move}.`;
  }

  async function askCoach(question: string) {
    const envEndpoint = process.env.NEXT_PUBLIC_AI_ENDPOINT;
    const isGhPages = typeof window !== 'undefined' && /github\.io$/.test(window.location.hostname);
    const endpoint = envEndpoint && envEndpoint.length
      ? envEndpoint
      : (isGhPages ? 'https://ask-ai.buraksefil-work.workers.dev/api/ask-ai' : '/api/ask-ai');

    // Tek prompt: her zaman koç modu, sadece STATE’e dayan; dili seçime göre yaz.
    const prompt =
`You are ChessCoach.ai, a strong chess coach.
Below is the board STATE generated from chess.js.
Respond ONLY based on this STATE. If uncertain, say so.
Write strictly in language code: ${lang}.

Requirements:
1) Write at most 6 sentences in TOTAL.
2) Start with a brief assessment + reasoning in 3–5 sentences (checks, threats, plans).
3) Then a separate line: "Best move: <SAN>" (or say none if no legal move).
4) If the side to move is the opponent, clearly state that first using STATE.white.label / STATE.black.label.
5) Optionally add one short "Tactics:" line only if something immediate exists.
6) Output plain text/markdown only. Do NOT return JSON.

STATE (JSON):
\`\`\`json
${JSON.stringify(state)}
\`\`\`

User question:
${question}`;

    const isExternal = endpoint.startsWith('http');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: isExternal
        ? { 'Content-Type': 'application/json', 'X-Lang': lang }
        : { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isExternal
          ? { prompt, lang, model: 'llama-3.3-70b-versatile' }
          : { prompt, systemPrompt: `You are a chess expert coach. Always answer strictly in ${lang}. Follow the OUTPUT FORMAT exactly and use AT MOST 6 sentences in total. Do not reply with only whose turn it is. Never output JSON.` }
      ),
    });

    const data = await res.json().catch(() => ({}));
    const text = String(data?.result ?? '').trim();
    return text || localFallbackSummary();
  }

  async function onSend() {
    const text = input.trim();
    if (!text) return;
    setMsgs(prev => [...prev, { role: 'user', text }]);
    setInput('');
    try {
      const answer = await askCoach(text);
      setMsgs(prev => [...prev, { role: 'ai', text: answer }]);
    } catch {
      setMsgs(prev => [...prev, { role: 'ai', text: localFallbackSummary() }]);
    }
  }

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-white max-w-3xl">
      <h3 className="text-xl font-semibold mb-3">{t('chat.title')}</h3>

      {/* Mesajlar */}
      <div ref={listRef} className="mt-4 space-y-2 max-h-64 overflow-y-auto bg-white/5 rounded p-2 border border-white/10">
        {msgs.map((m, i) => (
          <div key={i} className={'text-sm whitespace-pre-wrap ' + (m.role === 'user' ? 'text-blue-200' : 'text-emerald-200')}>
            <span className="inline-block mr-1 px-1.5 py-0.5 rounded bg-white/10">
              {m.role === 'user' ? 'Sen' : 'AI'}
            </span>
            {m.text}
          </div>
        ))}
        {!msgs.length && (
          <div className="text-sm opacity-70">{t('chat.helper')}</div>
        )}
      </div>

      {/* Girdi */}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
          placeholder={t('chat.placeholder')}
          className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 outline-none"
        />
        <button onClick={onSend} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">
          {t('chat.send')}
        </button>
      </div>

      {/* Only chat area as requested */}
    </div>
  );
}
