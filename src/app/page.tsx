// app/page.tsx
'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-8">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-bold">ChessCoach.ai</h1>
        <p className="opacity-80">
          Akıllı satranç koçu: öneri, plan ve taktikleri anlık olarak açıklar.
        </p>
        <Link
          href="chesscoachai.github.io/game"
          className="inline-block px-6 py-3 rounded bg-emerald-600 hover:bg-emerald-700"
        >
          Oyna
        </Link>
      </div>
    </main>
  );
}
