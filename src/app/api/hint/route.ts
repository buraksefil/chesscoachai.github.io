import { NextRequest, NextResponse } from 'next/server';
import { Chess } from 'chess.js';

export async function POST(req: NextRequest) {
  try {
    const { fen, legalMoves } = await req.json() as { fen: string; legalMoves: string[] };

    // Güvenlik: FEN gerçekten parse ediliyor mu?
    const g = new Chess(fen);
    const currentLegals = g.moves(); // SAN

    // İstemciden gelen legalMoves ile motorun bulduğunu kesiştir (ek güvenlik)
    const legalSet = new Set(currentLegals);
    const filtered = (Array.isArray(legalMoves) ? legalMoves : []).filter(m => legalSet.has(m));

    // Basit bir heuristikle "makul" bir hamle seç (merkez ve geliştirme öncelikli)
    const score = (san: string) => {
      let s = 0;
      // merkeze yönelim
      if (/[cdef]4|[cdef]5/.test(san)) s += 3;
      if (/^[NB]/.test(san)) s += 2;            // at/fil geliştir
      if (/^O-O/.test(san)) s += 4;             // rok
      if (/^Q/.test(san)) s -= 2;               // erken vezir geliştirmeni azalt
      if (/x/.test(san)) s += 1;                // takas hafifçe olumlu
      return s;
    };

    const pool = filtered.length ? filtered : currentLegals;
    const best = pool
      .map(m => ({ m, s: score(m) }))
      .sort((a, b) => b.s - a.s)[0]?.m ?? pool[0] ?? '';

    return NextResponse.json({ hint: best, fromFen: fen }, { status: 200 });
  } catch (e: any) {
    console.error('hint error', e);
    return NextResponse.json({ hint: '', error: e?.message ?? 'unknown' }, { status: 200 });
  }
}
