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

  // ---------- Yardımcılar ----------
  const files = ['a','b','c','d','e','f','g','h'];
  const sqName = (r: number, f: number) => `${files[f]}${8 - r}`;

  function flipTurnInFen(f: string, to: 'w' | 'b') {
    const p = f.split(' ');
    if (p.length !== 6) return f;
    return [p[0], to, p[2], p[3], p[4], p[5]].join(' ');
  }

  function kingSqOf(g: Chess, color: 'w' | 'b'): string | null {
    const b = g.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const c = b[r][f];
      if (c && c.type === 'k' && c.color === color) return sqName(r, f);
    }
    return null;
  }

  function attackersOfSquare(f: string, attacker: 'w'|'b', targetSq: string) {
    const g = new Chess(flipTurnInFen(f, attacker));
    const mv = g.moves({ verbose: true }) as any[];
    return mv
      .filter(m => m.to === targetSq)
      .map(m => ({ piece: pieceTR[m.piece] ?? m.piece.toUpperCase(), from: m.from, to: m.to }));
  }

  // ---------- STATE + türetilmiş gerçekler ----------
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

    const turnColor = g.turn(); // 'w'|'b' sırası olan
    const turnLabel = turnColor === 'w' ? 'Beyaz' : 'Siyah';
    const oppColor = turnColor === 'w' ? 'b' : 'w';
    const wKing = kingSqOf(g, 'w');
    const bKing = kingSqOf(g, 'b');
    const legalVerbose = g.moves({ verbose: true }) as any[];

    const derived = {
      side_to_move: turnLabel,
      last_move: moves[moves.length - 1] ?? null,
      is_check: g.isCheck(),
      is_checkmate: g.isCheckmate(),
      is_stalemate: g.isStalemate(),
      is_draw: g.isDraw(),
      w_king: wKing,
      b_king: bKing,
      legal_count: legalVerbose.length,
      // saldıran taşlar
      attackers_on_w: wKing ? attackersOfSquare(fen, 'b', wKing) : [],
      attackers_on_b: bKing ? attackersOfSquare(fen, 'w', bKing) : [],
      winner_if_mate: g.isCheckmate() ? (turnColor === 'w' ? 'Siyah' : 'Beyaz') : null,
    };

    return {
      fen,
      white: { count: whitePieces.length, pieces: whitePieces },
      black: { count: blackPieces.length, pieces: blackPieces },
      legal_moves_san: g.moves(),
      legal_moves_verbose: legalVerbose.map(m => ({ from: m.from, to: m.to, san: m.san, piece: m.piece, captured: m.captured ?? null, promotion: m.promotion ?? null })),
      derived,
    };
  }, [fen, moves]);

  // ---------- Yerel uzun açıklama (fallback + doğruluk garantisi) ----------
  function localLongExplanation(): string {
    const d = state.derived;
    const side = d.side_to_move;
    if (d.is_checkmate) {
      const king = (d.side_to_move === 'Beyaz') ? state.derived.w_king : state.derived.b_king;
      const atk = d.side_to_move === 'Beyaz' ? d.attackers_on_w : d.attackers_on_b;
      return [
        `Şah mat: sıra ${side}'ta ve ${side.toLowerCase()}nın şahı ${king ?? '-'} karesinde tehdit altında.`,
        `Hiçbir yasal hamle yok; bu nedenle konum mat olarak sonuçlandı.`,
        `Saldıran taş(lar): ${atk.length ? atk.map(a => `${a.piece} (${a.from}→${a.to})`).join(', ') : 'en az bir taş'}.`,
        `${d.winner_if_mate} kazandı.`,
      ].join(' ');
    }
    if (d.is_stalemate) {
      return `Patt: sıra ${side}'ta ve ${side.toLowerCase()}nın hiç yasal hamlesi yok, ancak şah tehdit altında değil. Konum beraberedir.`;
    }
    if (d.is_check) {
      const king = (d.side_to_move === 'Beyaz') ? state.derived.w_king : state.derived.b_king;
      const atk = d.side_to_move === 'Beyaz' ? d.attackers_on_w : d.attackers_on_b;
      return [
        `${side} şah altında. Kral ${king ?? '-'} karesinde.`,
        `Saldıran taş(lar): ${atk.length ? atk.map(a => `${a.piece} (${a.from}→${a.to})`).join(', ') : 'en az bir taş'}.`,
        `Toplam legal hamle sayısı: ${d.legal_count}.`,
      ].join(' ');
    }
    if (d.is_draw) {
      return `Oyun berabere (50 hamle kuralı, üç tekrar veya diğer bir sebep). Sıra: ${side}. Legal hamle sayısı: ${d.legal_count}.`;
    }
    return `Oyun devam ediyor. Sıra ${side}'ta. Legal hamle sayısı: ${state.derived.legal_count}.`;
  }

  // ---------- LLM: STATE’e dayan, 4–6 cümle yaz, JSON dön ----------
  async function askLLMWithState(question: string, forceFacts?: string) {
    const minSent = 4, maxSent = 6;

    const protocol =
`SEN BİR SATRANÇ ASİSTANISIN.
Aşağıda chess.js'ten türetilmiş TAHTA GERÇEĞİ (STATE) ve özetlenmiş GERÇEKLER (FACTS) var.
Cevabını YALNIZCA bunlara dayanarak üret; çelişki yaratma, uydurma yapma.
Türkçe yaz ve ${minSent}–${maxSent} cümle uzunluğunda açıkla.

DÖNÜŞ ŞEMASI (yalnız JSON):
{"short": "<tek cümlelik özet>", "long": "<${minSent}-${maxSent} cümle açıklama>", "mate": true/false, "check": true/false, "stalemate": true/false, "turn": "Beyaz|Siyah"}

STATE:
\`\`\`json
${JSON.stringify(state)}
\`\`\`

FACTS (önemli, çelişme):
\`\`\`
${forceFacts ?? localLongExplanation()}
\`\`\`

KULLANICI SORUSU:
${question}
`;

    const res = await fetch('/api/ask-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: protocol }),
    });
    const data = await res.json();
    const raw = String(data?.result ?? '').trim();

    try {
      const obj = JSON.parse(raw.replace(/(\r\n|\n|\r)/g, '').replace(/'/g, '"'));
      // Basit doğrulama + uzunluk kontrolü
      const long: string = String(obj?.long ?? '').trim();
      if (!long || long.split(/[.!?](\s|$)/).filter(s => s.trim().length > 0).length < minSent) {
        throw new Error('too-short');
      }
      // Mate/check/stale alanlarını da cross-check edelim; çelişirse yerel metne düş
      if (obj?.mate !== state.derived.is_checkmate || obj?.stalemate !== state.derived.is_stalemate || obj?.check !== state.derived.is_check) {
        throw new Error('contradiction');
      }
      return long;
    } catch {
      // JSON bozuksa/kısa/çelişkiliyse yerel metni dön
      return localLongExplanation();
    }
  }

  // ---------- UI davranışı ----------
  async function onSend() {
    const text = input.trim();
    if (!text) return;
    setMsgs(prev => [...prev, { role: 'user', text }]);
    setInput('');

    const lower = text.toLowerCase();

    // Kritik durum soruları → yerel teşhis + LLM ile uzun anlatım
    const isMateQ = /(şah\s*mat|sah\s*mat|checkmate|mate)/i.test(lower);
    const isCheckQ = /(şah\s*altında|şah\s*çekildi|check\b)/i.test(lower);
    const isStaleQ = /(patt|stalemate|berabere)/i.test(lower);
    const needsStateExplain = isMateQ || isCheckQ || isStaleQ || /durumu|position|konum/i.test(lower);

    try {
      const answer = await askLLMWithState(text, needsStateExplain ? localLongExplanation() : undefined);
      setMsgs(prev => [...prev, { role: 'ai', text: answer }]);
    } catch {
      setMsgs(prev => [...prev, { role: 'ai', text: localLongExplanation() }]);
    }
  }

  // ---------- Render ----------
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
            Örn: “Şu anki durumu açıkla”, “Şah mat mı?”, “Planım ne olmalı?”, “f1→a6 legal mi?”
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
