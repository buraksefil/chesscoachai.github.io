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
