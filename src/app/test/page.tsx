'use client';

import { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

export default function TestPage() {
  const [game, setGame] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());

  function onDrop(source: string, target: string) {
    const tempGame = new Chess(game.fen());
    const move = tempGame.move({
      from: source,
      to: target,
      promotion: 'q',
    });
    
    if (move === null) {
      console.log('❌ Geçersiz hamle:', source, '→', target);
      return false;
    }
    console.log('⏩ Sürüklenen:', source, '→', target);


    console.log('✅ Hamle:', move.san);
    setGame(tempGame);
    setFen(tempGame.fen());
    return true;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-4">Satranç Test</h1>
      <Chessboard
        position={fen}
        onPieceDrop={onDrop}
        boardWidth={400}
      />
    </div>
  );
}
