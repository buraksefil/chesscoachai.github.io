type Props = { hint: string; fen: string; ply: number };

export default function HintCard({ hint, fen, ply }: Props) {
  return (
    <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-3">
      <div className="text-sm">
        <span className="font-semibold">🍏 AI Önerisi:</span>{' '}
        {hint ? (
          <span>
            Bu konumda mantıklı hamle <b>{hint}</b>.
          </span>
        ) : (
          <span>Hamleden sonra öneri hazırlanıyor…</span>
        )}
      </div>
      <div className="text-[11px] opacity-70 mt-1">
        Sent FEN: {fen} • Ply: {ply}
      </div>
    </div>
  );
}
