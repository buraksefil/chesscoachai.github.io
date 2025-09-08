'use client';

import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';

type Msg = { role: 'user' | 'ai'; text: string };

export default function ChatBox({ moves, fen }: { moves: string[]; fen: string }) {
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);

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
    const turnLabel = turnColor === 'w' ? 'Beyaz' : 'Siyah';

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
      white: { count: whitePieces.length, pieces: whitePieces },
      black: { count: blackPieces.length, pieces: blackPieces },
    };
  }, [fen, moves]);

  // Basit yerel özet (LLM boş dönerse yedek)
  function localFallbackSummary(): string {
    const d = state;
    if (d.is_checkmate) {
      const winner = d.side_to_move === 'Beyaz' ? 'Siyah' : 'Beyaz';
      return `Şah mat. ${winner} kazandı.`;
    }
    if (d.is_stalemate) return `Patt — berabere. Sıra ${d.side_to_move}'ta ama yasal hamle yok.`;
    if (d.is_draw) return `Oyun berabere. Sıra: ${d.side_to_move}.`;
    return `Oyun devam ediyor. Sıra ${d.side_to_move}'ta. Toplam legal hamle: ${d.legal_count}.`;
  }

  async function askCoach(question: string) {
    const endpoint = process.env.NEXT_PUBLIC_AI_ENDPOINT || '/api/ask-ai';

    // Tek prompt: her zaman koç modu, sadece STATE’e dayan, Türkçe yaz.
    const prompt =
`Sen ChessCoach.ai isimli güçlü bir satranç koçusun.
Aşağıda sana chess.js'ten üretilmiş TAHTA DURUMU (STATE) veriyorum.
Cevaplarını YALNIZ bu STATE'e dayanarak üret. Uydurma yapma; emin değilsen "bu veriden kesin söyleyemem" de.
Türkçe yaz. Öğretici, sade ve net ol.

Genel davranış:
- Kullanıcı ne sorarsa sorsun, önce konumu kısaca değerlendir (şah/tehdit/taş aktivitesi/plan).
- İSTERSE hamle öner: sıranın kimde olduğunu belirt, en iyi bulduğun 1 hamleyi **SAN** formatında yaz ve 3–6 cümleyle gerekçelendir.
- Eğer sıranın karşı tarafta olduğunu fark edersen, önce "Sıra ${state.side_to_move}'ta" diye düzelt ve ona göre konuş.
- Taktik uyarıları (açıkta taş, çatal, mat ağı vb.) varsa belirt.
- Gereksiz uzun anlatma; net, araç gösterir gibi konuş.
- Çıktı biçimi: normal metin/markdown. JSON döndürme.

STATE (JSON):
\`\`\`json
${JSON.stringify(state)}
\`\`\`

Kullanıcının sorusu:
${question}`;

    const res = await fetch(
      endpoint.startsWith('http') ? endpoint : endpoint, // GH Pages için tam URL ise aynen kullan
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      }
    );

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

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-white max-w-3xl">
      <h3 className="text-xl font-semibold mb-3">Aktif taşlar (canlı FEN):</h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="font-semibold mb-1">Beyaz:</div>
          <ul className="list-disc list-inside opacity-90">
            {state.white.pieces.length ? state.white.pieces.map((p, i) => <li key={i}>{p.piece} ({p.square})</li>) : <li>—</li>}
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-1">Siyah:</div>
          <ul className="list-disc list-inside opacity-90">
            {state.black.pieces.length ? state.black.pieces.map((p, i) => <li key={i}>{p.piece} ({p.square})</li>) : <li>—</li>}
          </ul>
        </div>
      </div>

      {/* Mesajlar */}
      <div className="mt-4 space-y-2 max-h-64 overflow-y-auto bg-white/5 rounded p-2 border border-white/10">
        {msgs.map((m, i) => (
          <div key={i} className={'text-sm whitespace-pre-wrap ' + (m.role === 'user' ? 'text-blue-200' : 'text-emerald-200')}>
            <span className="inline-block mr-1 px-1.5 py-0.5 rounded bg-white/10">
              {m.role === 'user' ? 'Sen' : 'AI'}
            </span>
            {m.text}
          </div>
        ))}
        {!msgs.length && (
          <div className="text-sm opacity-70">
            Her şeyi sorabilirsin: “Şu anki konumu değerlendir”, “Planım ne olmalı?”, “Mat var mı?”, “En iyi hamle?”
          </div>
        )}
      </div>

      {/* Girdi */}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
          placeholder="AI'ya bir şey sor…"
          className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 outline-none"
        />
        <button onClick={onSend} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">
          Gönder
        </button>
      </div>

      {moves.length > 0 && (
        <div className="text-xs opacity-70 mt-2">Son hamle: {moves[moves.length - 1]}</div>
      )}
    </div>
  );
}
