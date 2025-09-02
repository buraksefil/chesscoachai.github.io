'use client';

import { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import ChatBox from './ChatBox';

export default function GamePage() {
  const [game, setGame] = useState(() => new Chess());
  const [moves, setMoves] = useState<string[]>([]);

  function makeAMove(source: string, target: string) {
    const move = game.move({
      from: source,
      to: target,
      promotion: 'q',
    });

    if (move) {
      console.log('✅ Hamle başarili:', move.san);
      setMoves((prev) => [...prev, move.san]);
      // game referansını değiştirmiyoruz
      return true;
    } else {
      console.log('❌ Geçersiz hamle:', source, '→', target);
      return false;
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-10 p-8">
      <Chessboard
        position={game.fen()}
        onPieceDrop={(source, target) => makeAMove(source, target)}
        boardWidth={400}
      />
      <ChatBox moves={moves} />
    </div>
  );
}
