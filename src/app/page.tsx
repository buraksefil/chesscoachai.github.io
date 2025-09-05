'use client';

import { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import ChatBox from './ChatBox';
import useStockfish from '@/hooks/useStockfish';

export default function GamePage() {
  const [game, setGame] = useState(() => new Chess());
  const [moves, setMoves] = useState<string[]>([]);

  const { sendPosition } = useStockfish((bestMove) => {
    const move = game.move({
      from: bestMove.substring(0, 2),
      to: bestMove.substring(2, 4),
      promotion: 'q',
    });

    if (move) {
      setGame(new Chess(game.fen())); // Tahta güncelle
      setMoves((prev) => [...prev, move.san]);
    }
  });

  const makeAMove = (from: string, to: string) => {
    const move = game.move({ from, to, promotion: 'q' });

    if (move) {
      setGame(new Chess(game.fen()));
      setMoves((prev) => [...prev, move.san]);

      // Kullanıcı hamle yaptıktan sonra Stockfish'e FEN gönder
      setTimeout(() => {
        sendPosition(game.fen());
      }, 300);

      return true;
    }
    return false;
  };

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
