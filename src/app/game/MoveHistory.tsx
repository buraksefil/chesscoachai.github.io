'use client';

export type MoveDetail = {
  color: 'white' | 'black';
  from: string;
  to: string;
  piece: string; // 'p' | 'n' | 'b' | 'r' | 'q' | 'k' ya da adı
};

type Props = {
  moveDetails: MoveDetail[];
};

const PIECE_TR: Record<string, string> = {
  p: 'Piyon',
  n: 'At',
  b: 'Fil',
  r: 'Kale',
  q: 'Vezir',
  k: 'Şah',
};

function pretty(m?: MoveDetail) {
  if (!m) return '';
  const name = PIECE_TR[m.piece] ?? m.piece.toUpperCase();
  return `${name} ${m.from} → ${m.to}`;
}

export default function MoveHistory({ moveDetails }: Props) {
  // satırları 1…n şeklinde hazırla (beyaz/siyah çiftleri)
  const rows: Array<{ no: number; white?: string; black?: string }> = [];
  for (let i = 0; i < moveDetails.length; i += 2) {
    const white = moveDetails[i];
    const black = moveDetails[i + 1];
    rows.push({
      no: Math.floor(i / 2) + 1,
      white: pretty(white),
      black: pretty(black),
    });
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-white">
      <div className="text-lg font-semibold mb-2">Hamle Geçmişi</div>
      <table className="w-full text-sm">
        <thead className="opacity-70">
          <tr>
            <th className="text-left w-8">#</th>
            <th className="text-left">Beyaz</th>
            <th className="text-left">Siyah</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r) => (
              <tr key={r.no} className="border-t border-white/10">
                <td className="py-1 pr-2">{r.no}</td>
                <td className="py-1 pr-2">{r.white || '—'}</td>
                <td className="py-1">{r.black || '—'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="py-2 opacity-60">
                Henüz hamle yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
