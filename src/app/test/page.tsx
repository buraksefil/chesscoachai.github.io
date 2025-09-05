'use client';

import { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

export default function ChessTest() {
  const [game, setGame] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());

  function onDrop(sourceSquare, targetSquare) {
    console.log('🧲 Sürükle-bırak:', sourceSquare, '→', targetSquare);

    const newGame = new Chess(game.fen());
    const move = newGame.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    if (move === null) {
      console.log('❌ Geçersiz hamle');
      return false;
    }

    console.log('✅ Hamle yapıldı:', move.san);
    setGame(newGame);
    setFen(newGame.fen());
    return true;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black">
      <h1 className="text-2xl font-bold mb-4">♟️ Satranç Test Tahtası</h1>
      <Chessboard
        position={fen}
        onPieceDrop={onDrop}
        boardWidth={400}
      />
    </div>
  );
}
