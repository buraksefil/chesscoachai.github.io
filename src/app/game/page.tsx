'use client';


import { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import ChatBox from './ChatBox';
import MoveHistory, { MoveDetail } from './MoveHistory';


export default function GamePage() {
const [game, setGame] = useState(() => new Chess());
const [moves, setMoves] = useState<string[]>([]);
const [moveDetails, setMoveDetails] = useState<MoveDetail[]>([]);
const [aiHint, setAiHint] = useState('');
const legalMoves = game.moves();


async function getAIHint(fen: string) {
try {
const res = await fetch('/api/ask-ai', {
method: 'POST',
body: JSON.stringify({
prompt: `Aşağıdaki FEN pozisyonuna göre, yalnızca geçerli (legal) hamleleri dikkate alarak, beyaz için önerilecek en mantıklı bir hamleyi seç ve sadece 1-2 cümle ile açıklama yap. Hamle illegalse önerme. FEN: ${fen}`,
}),
});
const data = await res.json();
setAiHint(data.result);
} catch (err) {
console.error('AI yorum alınamadı:', err);
setAiHint('[AI yorum alınamadı]');
}
}


function makeAMove(source: string, target: string) {
const tempGame = new Chess(game.fen());
const move = tempGame.move({ from: source, to: target, promotion: 'q' });


if (move) {
setGame(tempGame);
setMoves((prev) => [...prev, move.san]);
setMoveDetails((prev) => [
...prev,
{ color: 'white', from: move.from, to: move.to, piece: move.piece },
]);


setTimeout(() => {
const nextGame = new Chess(tempGame.fen());
const possibleMoves = nextGame.moves();
if (possibleMoves.length === 0) return;
const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
const botMove = nextGame.move(randomMove);
if (botMove) {
setGame(nextGame);
setMoves((prev) => [...prev, botMove.san]);
setMoveDetails((prev) => [
...prev,
{ color: 'black', from: botMove.from, to: botMove.to, piece: botMove.piece },
]);
getAIHint(nextGame.fen());
}
}, 500);


return true;
} else {
return false;
}
}


return (
    <div className="flex flex-col md:flex-row gap-10 p-8">
      <div className="flex flex-col items-center gap-4">
        <Chessboard
          position={game.fen()}
          onPieceDrop={(source, target) => makeAMove(source, target)}
          boardWidth={400}
        />
  
        {/* AI önerisi satranç tahtasının altına geldi */}
        {aiHint && (
          <div className="w-full max-w-md bg-yellow-100 border border-yellow-400 text-yellow-900 text-sm p-3 rounded">
            🍏 <strong>AI Önerisi:</strong> {aiHint}
          </div>
        )}
      </div>
  
      <div className="flex flex-col gap-4">
        <ChatBox moves={moves} />
        <MoveHistory moveDetails={moveDetails} />
      </div>
    </div>
  );
}