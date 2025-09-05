// ✅ 1. Yeni bileşen dosyası: app/components/MoveHistory.tsx

'use client';

export type MoveDetail = {
  color: 'white' | 'black';
  from: string;
  to: string;
  piece: string;
};

const pieceNames: Record<string, string> = {
  p: 'Piyon',
  n: 'At',
  b: 'Fil',
  r: 'Kale',
  q: 'Vezir',
  k: 'Şah',
};

export default function MoveHistory({ moveDetails }: { moveDetails: MoveDetail[] }) {
  const rows = [];
  for (let i = 0; i < moveDetails.length; i += 2) {
    const white = moveDetails[i];
    const black = moveDetails[i + 1];
    rows.push({ white, black, num: Math.floor(i / 2) + 1 });
  }

  return (
    <div className="bg-gray-900 text-white p-4 rounded-md w-80 h-96 overflow-y-auto">
      <h2 className="text-lg font-bold mb-2">♟️ Hamle Geçmişi</h2>
      <table className="text-sm w-full table-fixed">
        <thead>
          <tr>
            <th>#</th>
            <th>Beyaz</th>
            <th>Siyah</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ white, black, num }) => (
            <tr key={num}>
              <td className="pr-2">{num}</td>
              <td className="pr-2">
                {white
                  ? `${pieceNames[white.piece.toLowerCase()]} ${white.from} → ${white.to}`
                  : ''}
              </td>
              <td>
                {black
                  ? `${pieceNames[black.piece.toLowerCase()]} ${black.from} → ${black.to}`
                  : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ✅ 2. pages/game/page.tsx veya senin GamePage.tsx dosyanda aşağıdaki değişiklikleri yap

'use client';

import { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import ChatBox from './ChatBox';
import MoveHistory, { MoveDetail } from './MoveHistory';

export default function GamePage() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moves, setMoves] = useState<string[]>([]);
  const [moveDetails, setMoveDetails] = useState<MoveDetail[]>([]);

  const makeAMove = (from: string, to: string) => {
    const newGame = new Chess(game.fen());
    const move = newGame.move({ from, to, promotion: 'q' });

    if (move) {
      console.log('✅ Hamle yapıldı:', move.san);

      setMoveDetails((prev) => [
        ...prev,
        {
          color: game.turn() === 'w' ? 'black' : 'white',
          from: move.from,
          to: move.to,
          piece: move.piece,
        },
      ]);

      setGame(newGame);
      setFen(newGame.fen());
      setMoves((prev) => [...prev, move.san]);
      return true;
    } else {
      console.log('❌ Geçersiz hamle:', from, '→', to);
      return false;
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-10 p-8">
      <Chessboard
        position={fen}
        onPieceDrop={(from, to) => makeAMove(from, to)}
        boardWidth={400}
      />
      <div className="flex flex-col gap-4">
        <ChatBox moves={moves} />
        <MoveHistory moveDetails={moveDetails} />
      </div>
    </div>
  );
}
