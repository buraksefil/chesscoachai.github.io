'use client';

import { useLang } from '@/providers/LanguageProvider';

export type MoveDetail = {
  color: 'white' | 'black';
  from: string;
  to: string;
  piece: string; // 'p' | 'n' | 'b' | 'r' | 'q' | 'k' ya da adı
};

type Props = {
  moveDetails: MoveDetail[];
};

// Dil-özel taş adları
const PIECE_NAMES: Record<'tr' | 'en' | 'de', Record<string, string>> = {
  tr: { p: 'Piyon', n: 'At', b: 'Fil', r: 'Kale', q: 'Vezir', k: 'Şah' },
  en: { p: 'Pawn',  n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' },
  de: { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' }
};

export default function MoveHistory({ moveDetails }: Props) {
  const { lang, t } = useLang();

  const pretty = (m?: MoveDetail) => {
    if (!m) return '';
    const dict = PIECE_NAMES[lang] ?? PIECE_NAMES.en;
    const name = dict[m.piece] ?? m.piece.toUpperCase();
    return `${name} ${m.from} → ${m.to}`;
  };

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
      <div className="text-lg font-semibold mb-2">{t('history.title')}</div>
      <table className="w-full text-sm">
        <thead className="opacity-70">
          <tr>
            <th className="text-left w-8">#</th>
            <th className="text-left">{t('history.white')}</th>
            <th className="text-left">{t('history.black')}</th>
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
                {t('history.none')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
