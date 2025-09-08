'use client';

import { useRef, useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import ChatBox from './ChatBox';
import MoveHistory, { MoveDetail } from './MoveHistory';

// 🔗 Worker URL'in: build-time ENV yoksa bu default kullanılacak
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'https://ask-ai.buraksefil-work.workers.dev').replace(/\/$/, '');

const AI_ENDPOINT =
  process.env.NEXT_PUBLIC_AI_ENDPOINT ||
  'https://ask-ai.buraksefil-work.workers.dev/api/ask-ai';

type AISuggestion = {
  san: string;
  from: string;
  to: string;
  piece: string;
  reason: string;
};

type PendingMove = { from: string; to: string; color: 'w' | 'b' } | null;
type Difficulty = 'easy' | 'normal' | 'hard';

export default function GamePage() {
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

  const pieceNameTR: Record<string, string> = { p: 'Piyon', n: 'At', b: 'Fil', r: 'Kale', q: 'Vezir', k: 'Şah' };
  const pieceHowTo: Record<string, string> = {
    p: 'Bir kare ileri (ilk hamlede iki kare olabilir); çapraz alır; son sırada terfi eder.',
    n: '“L” (2+1) şeklinde gider ve taşların üzerinden atlayabilir.',
    b: 'Çapraz doğrultularda istediği kadar ilerler.',
    r: 'Dikey/yatay doğrultuda istediği kadar ilerler.',
    q: 'Kale+Fil birleşimi: yatay/dikey/çapraz istediği kadar ilerler.',
    k: 'Bir kare her yöne gider; kale ile rok yapabilir.',
  };

  function clearTeachHints() { setSelectedSq(null); setMoveSquares({}); }

  function updateStatus(g: Chess) {
    if (g.isCheckmate()) {
      const loser = g.turn() === 'w' ? 'Beyaz' : 'Siyah';
      const winner = g.turn() === 'w' ? 'Siyah' : 'Beyaz';
      setStatus({ over: true, text: `Şah mat! ${loser} mat oldu — ${winner} kazandı.` });
      return true;
    }
    if (g.isStalemate()) {
      const side = g.turn() === 'w' ? 'Beyaz' : 'Siyah';
      setStatus({ over: true, text: `Patt — berabere. Sıra ${side}'ta; ${side.toLowerCase()}nın hiç legal hamlesi yok ve şahı tehdit altında değil.` });
      return true;
    }
    if (g.isThreefoldRepetition()) { setStatus({ over: true, text: 'Üç kez tekrar — berabere.' }); return true; }
    if (g.isInsufficientMaterial()) { setStatus({ over: true, text: 'Yetersiz taş — berabere.' }); return true; }
    if (g.isDraw()) { setStatus({ over: true, text: 'Berabere.' }); return true; }
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
    let best = verbose[0], sBest = -Infinity;
    for (const m of verbose) {
      const s = heuristicScore(m, g);
      if (s > sBest) { sBest = s; best = m; }
    }
    const pieceFull: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
    return { san: best.san, from: best.from, to: best.to, piece: pieceFull[best.piece] ?? best.piece, reason: 'Heuristik yedek öneri.' };
  }

  async function getAIHint(fen: string) {
    try {
      const g = new Chess(fen);
      const legalSAN = g.moves();
      if (!legalSAN.length) { setAiSuggestion(null); setAiHintText('Hamle yok.'); return; }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController(); abortRef.current = controller;
      const mySeq = ++reqSeq.current;

      // 🔁 GROQ Worker'a istek
      const ask = async (prompt: string) => {
        const res = await fetch(`${API_BASE}/api/ask-ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            prompt,
            model: 'llama-3.3-70b-versatile', // Worker fallback’ı da var; bu satır opsiyonel
          }),
        });
        const data = await res.json(); return String(data?.result ?? '').trim();
      };

      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ prompt }),
      });

      const strict =
        `You are a chess assistant. Choose EXACTLY ONE best move by its 0-based index from this SAN list.\n` +
        `Return ONLY JSON: {"i":<int>,"reason":"<1-2 sentences>"}\n` +
        `Moves: ${JSON.stringify(legalSAN)}\nFEN: ${fen}`;

      const parseIndex = (txt: string): { i?: number; reason?: string } | null => {
        try {
          const j = JSON.parse(txt.replace(/(\r\n|\n|\r)/g, '').replace(/'/g, '"'));
          if (Number.isInteger(j?.i)) return j;
        } catch {}
        const m = txt.match(/"i"\s*:\s*(\d+)|\bi\s*:\s*(\d+)/);
        if (m) return { i: Number(m[1] ?? m[2]), reason: '' };
        return null;
      };

      let raw = await ask(strict); if (mySeq !== reqSeq.current) return;
      let obj = parseIndex(raw);

      if (!obj || !(obj.i! >= 0 && obj.i! < legalSAN.length)) {
        raw = await ask(strict); if (mySeq !== reqSeq.current) return;
        obj = parseIndex(raw);
      }

      if (!obj || !(obj.i! >= 0 && obj.i! < legalSAN.length)) {
        const fb = fallbackSuggestion(fen);
        if (fb) { setAiSuggestion(fb); setAiHintText(''); }
        else { setAiSuggestion(null); setAiHintText('[Öneri üretilemedi]'); }
        return;
      }

      const sim = new Chess(fen);
      const applied = sim.move(legalSAN[obj.i!]);
      if (!applied) {
        const fb = fallbackSuggestion(fen);
        if (fb) { setAiSuggestion(fb); setAiHintText(''); }
        else { setAiSuggestion(null); setAiHintText('[Öneri üretilemedi]'); }
        return;
      }
      const pieceFull: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
      setAiSuggestion({ san: applied.san, from: applied.from, to: applied.to, piece: pieceFull[applied.piece] ?? applied.piece, reason: obj.reason ?? '' });
      setAiHintText('');
    } catch (err) {
      const fb = fallbackSuggestion(fen);
      if (fb) { setAiSuggestion(fb); setAiHintText(''); }
      else { setAiSuggestion(null); setAiHintText('[AI yorum alınamadı]'); }
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
  }, [difficulty]);

  const prettyDiff = difficulty === 'easy' ? 'Kolay' : difficulty === 'normal' ? 'Normal' : difficulty === 'hard' ? 'Zor' : 'Seçilmedi';

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
                <div className="text-lg font-semibold mb-3">Zorluk seç</div>
                <div className="grid grid-cols-1 gap-2">
                  <button className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 border border-white/20"
                          onClick={() => setDifficulty('easy')}>Kolay</button>
                  <button className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 border border-white/20"
                          onClick={() => setDifficulty('normal')}>Normal</button>
                  <button className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 border border-white/20"
                          onClick={() => setDifficulty('hard')}>Zor</button>
                </div>
                <p className="text-xs opacity-70 mt-3">
                  Kolay: rastgele • Normal: sezgisel • Zor: küçük arama (2 plilik)
                </p>
              </div>
            </div>
          )}

          {showPromotion && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <div className="bg-zinc-900 text-white rounded-xl p-4 border border-zinc-700 w-64">
                <div className="font-semibold mb-2">Terfi: hangi taş?</div>
                <div className="grid grid-cols-4 gap-2">
                  <button className="px-2 py-2 bg-zinc-800 rounded hover:bg-zinc-700" onClick={() => choosePromotion('q')}>Vezir</button>
                  <button className="px-2 py-2 bg-zinc-800 rounded hover:bg-zinc-700" onClick={() => choosePromotion('r')}>Kale</button>
                  <button className="px-2 py-2 bg-zinc-800 rounded hover:bg-zinc-700" onClick={() => choosePromotion('b')}>Fil</button>
                  <button className="px-2 py-2 bg-zinc-800 rounded hover:bg-zinc-700" onClick={() => choosePromotion('n')}>At</button>
                </div>
                <div className="mt-3 text-right">
                  <button onClick={cancelPromotion} className="text-sm opacity-80 hover:opacity-100">İptal</button>
                </div>
              </div>
            </div>
          )}

          {status.over ? (
            <div className="bg-amber-100 border border-amber-400 text-amber-900 text-sm p-3 rounded">
              🏁 <strong>Oyun bitti:</strong> {status.text}{' '}
              <button onClick={resetGame} className="ml-2 px-2 py-1 bg-amber-200 rounded border border-amber-400 hover:bg-amber-300">
                Yeni Oyun
              </button>
            </div>
          ) : (aiSuggestion || aiHintText) && difficulty && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-900 text-sm p-3 rounded">
              <div className="font-semibold">🍏 AI Önerisi</div>
              {aiSuggestion ? (
                <div className="mt-1">
                  <div>
                    <b>Hamle:</b> {aiSuggestion.san}{' '}
                    <span className="opacity-80">— ({aiSuggestion.piece} {aiSuggestion.from} → {aiSuggestion.to})</span>
                  </div>
                  {aiSuggestion.reason && <div className="mt-1">{aiSuggestion.reason}</div>}
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
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-white">
            <div className="text-lg font-semibold">Rakip Zorluğu</div>
            <div className="mt-1">
              <span className="inline-block px-2 py-1 rounded bg-blue-600/80 border border-blue-500 text-sm">
                Seviye: <b>{difficulty ? (difficulty === 'easy' ? 'Kolay' : difficulty === 'normal' ? 'Normal' : 'Zor') : 'Seçilmedi'}</b> {difficulty ? '• kilitli' : '(seçilmedi)'}
              </span>
            </div>
            <p className="text-xs opacity-70 mt-2">
              Seviye her oyun başında seçilir ve oyun bitene kadar değiştirilemez.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Öğretici Modu</div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={teaching}
                  onChange={(e) => { setTeaching(e.target.checked); if (!e.target.checked) clearTeachHints(); }}
                />
                Açık
              </label>
            </div>
            <p className="text-sm opacity-80 mt-2">
              Tahtada bir <b>taşa tıklayın</b>; o taşın gidebileceği kareler vurgulanır. Aşağıda taşın adı ve hareket şekli görünür.
            </p>
            {(() => {
              if (!selectedSq) return <div className="mt-3 text-sm opacity-60">Henüz bir taş seçilmedi.</div>;
              const p = game.get(selectedSq); if (!p) return <div className="mt-3 text-sm opacity-60">Henüz bir taş seçilmedi.</div>;
              const name = pieceNameTR[p.type] ?? p.type.toUpperCase();
              const color = p.color === 'w' ? 'Beyaz' : 'Siyah';
              const how = pieceHowTo[p.type] ?? '';
              return (
                <div className="mt-3 rounded-lg bg-white/10 border border-white/10 p-3">
                  <div className="font-medium">Seçili taş: {color} <b>{name}</b>{selectedSq ? ` (${selectedSq})` : null}</div>
                  <div className="text-sm mt-1">{how}</div>
                </div>
              );
            })()}
          </div>

          <MoveHistory moveDetails={moveDetails} />
        </div>
      </div>
    </div>
  );
}
