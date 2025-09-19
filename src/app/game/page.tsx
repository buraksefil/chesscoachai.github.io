'use client';

import { useRef, useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import ChatBox from './ChatBox';
import MoveHistory, { MoveDetail } from './MoveHistory';
import { useLang } from '@/providers/LanguageProvider';

// ▶️ API endpoint
const AI_ENDPOINT =
  process.env.NEXT_PUBLIC_AI_ENDPOINT ||
  'https://ask-ai.buraksefil-work.workers.dev/api/ask-ai';

type AISuggestion = {
  san: string;
  from: string;
  to: string;
  piece: string;
  reasonTr?: string;
  reasonEn?: string;
};

type PendingMove = { from: string; to: string; color: 'w' | 'b' } | null;
type Difficulty = 'easy' | 'normal' | 'hard';

export default function GamePage() {
  const { lang, t } = useLang();

  const [game, setGame] = useState(() => new Chess());
  const [moves, setMoves] = useState<string[]>([]);
  const [moveDetails, setMoveDetails] = useState<MoveDetail[]>([]);
  const [aiHintText, setAiHintText] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);

  // ▶️ Zorluk (oyun başında seçiliyor; null = seçilmedi)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);

  // AI istek sırası
  const reqSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Promotion (kendi modalımız)
  const [pending, setPending] = useState<PendingMove>(null);
  const [showPromotion, setShowPromotion] = useState(false);

  // Oyun sonu durumu
  const [status, setStatus] = useState<{ over: boolean; text: string }>({ over: false, text: '' });

  // Öğretici Mod
  const [teaching, setTeaching] = useState(true);
  const [selectedSq, setSelectedSq] = useState<string | null>(null);
  const [moveSquares, setMoveSquares] = useState<Record<string, React.CSSProperties>>({});

  const pieceNames: Record<'tr'|'en'|'de', Record<string,string>> = {
    tr: { p: 'Piyon', n: 'At', b: 'Fil', r: 'Kale', q: 'Vezir', k: 'Şah' },
    en: { p: 'Pawn',  n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' },
    de: { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' }
  };
  const pieceHow: Record<'tr'|'en'|'de', Record<string,string>> = {
    tr: {
      p: 'Bir kare ileri (ilk hamlede iki kare olabilir); çapraz alır; son sırada terfi eder.',
      n: '“L” (2+1) şeklinde gider ve taşların üzerinden atlayabilir.',
      b: 'Çapraz doğrultularda istediği kadar ilerler.',
      r: 'Dikey/yatay doğrultuda istediği kadar ilerler.',
      q: 'Kale+Fil birleşimi: yatay/dikey/çapraz istediği kadar ilerler.',
      k: 'Bir kare her yöne gider; kale ile rok yapabilir.'
    },
    en: {
      p: 'Moves one forward (two from start); captures diagonally; promotes on last rank.',
      n: 'Moves in an “L” (2+1) and jumps over pieces.',
      b: 'Moves any number of squares diagonally.',
      r: 'Moves any number of squares horizontally/vertically.',
      q: 'Rook + Bishop: any number of squares in any direction.',
      k: 'One square any direction; can castle with rook.'
    },
    de: {
      p: 'Ein Feld vor (zwei vom Start); schlägt diagonal; Umwandlung auf letzter Reihe.',
      n: 'Bewegt sich in „L“-Form (2+1) und springt über Figuren.',
      b: 'Beliebig viele Felder diagonal.',
      r: 'Beliebig viele Felder horizontal/vertikal.',
      q: 'Turm + Läufer: beliebig viele Felder in alle Richtungen.',
      k: 'Ein Feld in jede Richtung; Rochade möglich.'
    }
  };
  const currentLang: 'tr'|'en'|'de' = (lang === 'tr' || lang === 'de' || lang === 'en') ? lang : 'en';

  function clearTeachHints() { setSelectedSq(null); setMoveSquares({}); }

  function updateStatus(g: Chess) {
    if (g.isCheckmate()) {
      const loser = g.turn() === 'w' ? t('white') : t('black');
      const winner = g.turn() === 'w' ? t('black') : t('white');
      setStatus({ over: true, text: `${t('status.checkmate')} ${loser} ${t('status.mated')} — ${winner} ${t('status.won')}.` });
      return true;
    }
    if (g.isStalemate()) {
      const side = g.turn() === 'w' ? t('white') : t('black');
      setStatus({ over: true, text: `${t('status.stalemate')} ${t('status.turnOf',)} ${side}.` });
      return true;
    }
    if (g.isThreefoldRepetition()) { setStatus({ over: true, text: t('status.threefold') }); return true; }
    if (g.isInsufficientMaterial()) { setStatus({ over: true, text: t('status.insufficient') }); return true; }
    if (g.isDraw()) { setStatus({ over: true, text: t('status.draw') }); return true; }
    setStatus({ over: false, text: '' });
    return false;
  }

  const PIECE_VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  function evaluateBoard(g: Chess): number {
    const board = g.board();
    let score = 0;
    for (const row of board) for (const cell of row) {
      if (!cell) continue;
      const v = PIECE_VALUE[cell.type] ?? 0;
      score += cell.color === 'w' ? v : -v;
    }
    try {
      const parts = g.fen().split(' ');
      if (parts.length === 6) {
        const fenW = [parts[0], 'w', parts[2], parts[3], parts[4], parts[5]].join(' ');
        const fenB = [parts[0], 'b', parts[2], parts[3], parts[4], parts[5]].join(' ');
        const wMoves = new Chess(fenW).moves().length;
        const bMoves = new Chess(fenB).moves().length;
        score += 0.1 * (wMoves - bMoves);
      }
    } catch {}
    return score;
  }

  function heuristicScore(m: any, g: Chess) {
    let s = 0;
    if (m.captured) s += (PIECE_VALUE[m.captured] ?? 0) - 5;
    if (typeof m.san === 'string') { if (m.san.includes('#')) s += 1e4; else if (m.san.includes('+')) s += 50; }
    const f = m.to[0]; const r = Number(m.to[1]); if ('cdef'.includes(f) && r >= 3 && r <= 6) s += 8;
    if (m.piece === 'n' || m.piece === 'b') s += 6; if (m.piece === 'q' && g.moveNumber() < 10) s -= 10;
    if (m.promotion) s += PIECE_VALUE[m.promotion] ?? 800;
    return s + Math.random();
  }

  function minimax(g: Chess, depth: number, alpha: number, beta: number, maxing: boolean, forColor: 'w'|'b'): number {
    if (depth === 0 || g.isGameOver()) {
      const s = evaluateBoard(g); return forColor === 'w' ? s : -s;
    }
    const moves = g.moves({ verbose: true }) as any[];
    if (maxing) {
      let best = -Infinity;
      for (const m of moves) { const ng = new Chess(g.fen()); ng.move({ from: m.from, to: m.to, promotion: m.promotion }); best = Math.max(best, minimax(ng, depth-1, alpha, beta, false, forColor)); alpha = Math.max(alpha, best); if (beta <= alpha) break; }
      return best;
    } else {
      let best = Infinity;
      for (const m of moves) { const ng = new Chess(g.fen()); ng.move({ from: m.from, to: m.to, promotion: m.promotion }); best = Math.min(best, minimax(ng, depth-1, alpha, beta, true, forColor)); beta = Math.min(beta, best); if (beta <= alpha) break; }
      return best;
    }
  }

  function pickBotMove(g: Chess, level: Difficulty): any | null {
    const moves = g.moves({ verbose: true }) as any[]; if (!moves.length) return null;
    if (level === 'easy') return moves[Math.floor(Math.random() * moves.length)];
    if (level === 'normal') { let best = moves[0], sBest = -Infinity; for (const m of moves) { const s = heuristicScore(m, g); if (s > sBest) { sBest = s; best = m; } } return best; }
    let bestMove = moves[0], best = -Infinity;
    for (const m of moves) { const ng = new Chess(g.fen()); ng.move({ from: m.from, to: m.to, promotion: m.promotion }); const s = minimax(ng, 1, -Infinity, Infinity, false, 'b'); if (s > best) { best = s; bestMove = m; } }
    return bestMove;
  }

  function fallbackSuggestion(fen: string): AISuggestion | null {
    const g = new Chess(fen);
    const verbose = g.moves({ verbose: true }) as any[];
    if (!verbose.length) return null;

    let best = verbose[0];
    let sBest = -Infinity;
    for (const m of verbose) {
      const s = heuristicScore(m, g);
      if (s > sBest) { sBest = s; best = m; }
    }
    const pieceFull: Record<string, string> = {
      p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King',
    };

    return {
      san: best.san,
      from: best.from,
      to: best.to,
      piece: pieceFull[best.piece] ?? best.piece,
      reasonTr: t('ai.fallbackTr'),
      reasonEn: t('ai.fallbackEn'),
    };
  }

  async function getAIHint(fen: string) {
    try {
      const g = new Chess(fen);
      const legalSAN = g.moves();
      if (!legalSAN.length) { setAiSuggestion(null); setAiHintText(t('ai.noMoves')); return; }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController(); abortRef.current = controller;
      const mySeq = ++reqSeq.current;

      // Worker'a tek çağrı: prompt'u burada kuruyoruz
      const strict =
        `You are a chess assistant. From the SAN list, pick EXACTLY ONE best move by its 0-based index.` +
        ` Respond with ONLY JSON like: {"i":<int>,"reason_tr":"<1-2 sentences>","reason_en":"<1-2 sentences>"}` +
        `\nMoves: ${JSON.stringify(legalSAN)}\nFEN: ${fen}\nLANG:${lang}`;

      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lang': lang },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: strict,
          lang,                        // <— modeli dile uyarmak için
          model: 'llama-3.3-70b-versatile'
        }),
      });
      const data = await res.json();
      let raw = String(data?.result ?? '').trim();
      if (mySeq !== reqSeq.current) return;

      const parseIndex = (
        txt: string,
        max: number
      ): { i?: number; tr?: string; en?: string } | null => {
        try {
          const cleaned = txt.replace(/(\r\n|\n|\r)/g, '').replace(/'/g, '"');
          const j = JSON.parse(cleaned);
          if (Number.isInteger(j?.i)) {
            return {
              i: j.i,
              tr: j.reason_tr || j.reasonTr || '',
              en: j.reason_en || j.reasonEn || '',
            };
          }
        } catch {}
        const m = txt.match(/"i"\s*:\s*(\d+)|\bi\s*:\s*(\d+)/);
        if (m) return { i: Number(m[1] ?? m[2]), tr: '', en: '' };
        return null;
      };

      let obj = parseIndex(raw, legalSAN.length);

      if (!obj || !(obj.i! >= 0 && obj.i! < legalSAN.length)) {
        // ikinci deneme için aynı prompt'u tekrar göndermek yerine yerel fallback
        const fb = fallbackSuggestion(fen);
        if (fb) { setAiSuggestion(fb); setAiHintText(''); }
        else { setAiSuggestion(null); setAiHintText(t('ai.unavailable')); }
        return;
      }

      const sim = new Chess(fen);
      const applied = sim.move(legalSAN[obj.i!]);
      if (!applied) {
        const fb = fallbackSuggestion(fen);
        if (fb) { setAiSuggestion(fb); setAiHintText(''); }
        else { setAiSuggestion(null); setAiHintText(t('ai.unavailable')); }
        return;
      }
      const pieceFull: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
      setAiSuggestion({
        san: applied.san,
        from: applied.from,
        to: applied.to,
        piece: pieceFull[applied.piece] ?? applied.piece,
        reasonTr: obj.tr ?? '',
        reasonEn: obj.en ?? '',
      });

      setAiHintText('');
    } catch {
      const fb = fallbackSuggestion(fen);
      if (fb) { setAiSuggestion(fb); setAiHintText(''); }
      else { setAiSuggestion(null); setAiHintText(t('ai.error')); }
    }
  }

  function applyMoveSafe(from: string, to: string, promotion?: 'q'|'r'|'b'|'n') {
    try {
      const temp = new Chess(game.fen());
      const mv = temp.move({ from, to, promotion });
      if (!mv) return false;

      setGame(temp);
      setMoves(p => [...p, mv.san]);
      setMoveDetails(p => [...p, { color: mv.color === 'w' ? 'white' : 'black', from: mv.from, to: mv.to, piece: mv.piece }]);

      clearTeachHints(); setAiSuggestion(null); setAiHintText('');
      if (abortRef.current) abortRef.current.abort(); reqSeq.current++;

      const ended = updateStatus(temp); if (ended) return true;

      if (!difficulty) return true;

      setTimeout(() => {
        const ng = new Chess(temp.fen());
        if (updateStatus(ng)) return;

        const m = pickBotMove(ng, difficulty);
        if (!m) { updateStatus(ng); return; }

        const bmv = ng.move({ from: m.from, to: m.to, promotion: m.promotion });
        if (!bmv) return;

        setGame(ng);
        setMoves(p => [...p, bmv.san]);
        setMoveDetails(p => [...p, { color: bmv.color === 'w' ? 'white' : 'black', from: bmv.from, to: bmv.to, piece: bmv.piece }]);

        if (updateStatus(ng)) return;
        if (ng.turn() === 'w') getAIHint(ng.fen());
      }, 350);

      return true;
    } catch { return false; }
  }

  const rank = (sq: string) => Number(sq[1]);
  function needsPromotion(from: string, to: string) {
    const piece = game.get(from); if (!piece || piece.type !== 'p') return false;
    const r = rank(to); return (piece.color === 'w' && r === 8) || (piece.color === 'b' && r === 1);
  }

  function onDrop(source: string, target: string) {
    if (!difficulty) return false;
    if (status.over) return false;
    if (needsPromotion(source, target)) { setPending({ from: source, to: target, color: game.get(source)!.color }); setShowPromotion(true); return false; }
    return applyMoveSafe(source, target);
  }

  function onSquareClick(square: string) {
    if (!teaching) return;
    const g = new Chess(game.fen()); const piece = g.get(square);
    if (!piece) { clearTeachHints(); return; }
    const verbose = g.moves({ square, verbose: true }) as any[]; if (!verbose.length) { clearTeachHints(); return; }
    const styles: Record<string, React.CSSProperties> = {};
    styles[square] = { boxShadow: 'inset 0 0 0 3px rgba(16,185,129,.95)' };
    for (const m of verbose) styles[m.to] = { background: 'radial-gradient(circle, rgba(16,185,129,.45) 35%, rgba(16,185,129,0) 36%)', borderRadius: '50%' };
    setSelectedSq(square); setMoveSquares(styles);
  }

  function choosePromotion(piece: 'q'|'r'|'b'|'n') { if (!pending) return; applyMoveSafe(pending.from, pending.to, piece); setPending(null); setShowPromotion(false); }
  function cancelPromotion() { setPending(null); setShowPromotion(false); }

  function resetGame() {
    setGame(new Chess()); setMoves([]); setMoveDetails([]); setAiSuggestion(null); setAiHintText('');
    setShowPromotion(false); setPending(null); setStatus({ over: false, text: '' }); clearTeachHints();
    if (abortRef.current) abortRef.current.abort(); reqSeq.current++;
    setDifficulty(null);
  }

  useEffect(() => {
    if (difficulty && !status.over) getAIHint(game.fen());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, lang]); // dil değişince yeni öneri iste

  const prettyDiff =
    difficulty === 'easy' ? t('difficulty.easy') :
    difficulty === 'normal' ? t('difficulty.normal') :
    difficulty === 'hard' ? t('difficulty.hard') :
    t('difficulty.unselected');

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(420px,1fr)_360px] gap-6 items-start">
        <div className="relative flex flex-col gap-4">
          <Chessboard
            position={game.fen()}
            onPieceDrop={onDrop}
            onSquareClick={onSquareClick}
            customSquareStyles={teaching ? moveSquares : {}}
            boardWidth={400}
            arePiecesDraggable={!!difficulty && !status.over}
          />

          {difficulty === null && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
              <div className="bg-zinc-900 text-white rounded-xl p-5 border border-zinc-700 w-80">
                <div className="text-lg font-semibold">{t('difficulty.select')}</div>
                <div className="grid grid-cols-1 gap-2">
                  <button className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 border border-white/20"
                          onClick={() => setDifficulty('easy')}>{t('difficulty.easy')}</button>
                  <button className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 border border-white/20"
                          onClick={() => setDifficulty('normal')}>{t('difficulty.normal')}</button>
                  <button className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 border border-white/20"
                          onClick={() => setDifficulty('hard')}>{t('difficulty.hard')}</button>
                </div>
                <p className="text-xs opacity-70 mt-3">
                  {t('difficulty.help')} {/* örn: "Easy: random • Normal: heuristic • Hard: small search" */}
                </p>
              </div>
            </div>
          )}

          {showPromotion && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <div className="bg-zinc-900 text-white rounded-xl p-4 border border-zinc-700 w-64">
                <div className="font-semibold mb-2">{t('promotion.title')}</div>
                <div className="grid grid-cols-4 gap-2">
                  <button className="px-2 py-2 bg-zinc-800 rounded hover:bg-zinc-700" onClick={() => choosePromotion('q')}>{t('piece.queen')}</button>
                  <button className="px-2 py-2 bg-zinc-800 rounded hover:bg-zinc-700" onClick={() => choosePromotion('r')}>{t('piece.rook')}</button>
                  <button className="px-2 py-2 bg-zinc-800 rounded hover:bg-zinc-700" onClick={() => choosePromotion('b')}>{t('piece.bishop')}</button>
                  <button className="px-2 py-2 bg-zinc-800 rounded hover:bg-zinc-700" onClick={() => choosePromotion('n')}>{t('piece.knight')}</button>
                </div>
                <div className="mt-3 text-right">
                  <button onClick={cancelPromotion} className="text-sm opacity-80 hover:opacity-100">{t('common.cancel')}</button>
                </div>
              </div>
            </div>
          )}

          {status.over ? (
            <div className="bg-amber-100 border border-amber-400 text-amber-900 text-sm p-3 rounded">
              🏁 <strong>{t('game.over')}:</strong> {status.text}{' '}
              <button onClick={resetGame} className="ml-2 px-2 py-1 bg-amber-200 rounded border border-amber-400 hover:bg-amber-300">
                {t('game.new')}
              </button>
            </div>
          ) : (aiSuggestion || aiHintText) && difficulty && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-900 text-sm p-3 rounded">
              <div className="font-semibold">🍏 {t('ai.suggestion')}</div>
              {aiSuggestion ? (
                <div className="mt-1 space-y-1">
                  <div>
                    <b>{t('ai.move')}:</b> {aiSuggestion.san}{' '}
                    <span className="opacity-80">
                      — ({aiSuggestion.piece} {aiSuggestion.from} → {aiSuggestion.to})</span>
                  </div>
                  {aiSuggestion.reasonTr && <div className="mt-1">{aiSuggestion.reasonTr}</div>}
                  {aiSuggestion.reasonEn && <div className="mt-1">EN: {aiSuggestion.reasonEn}</div>}
                </div>
              ) : (
                <div className="mt-1">{aiHintText}</div>
              )}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-6">
          <ChatBox moves={moves} fen={game.fen()} />
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <MoveHistory moveDetails={moveDetails} />
        </div>
      </div>
    </div>
  );
}
