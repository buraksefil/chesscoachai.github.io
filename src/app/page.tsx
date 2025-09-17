'use client';

import Link from 'next/link';
import LanguagePicker from '@/components/LanguagePicker';
import { useLang } from '@/providers/LanguageProvider';

export default function HomePage() {
  const { t } = useLang();

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <LanguagePicker />
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold">Chess Coach AI</h1>
        <Link href="/game" className="px-6 py-3 rounded-2xl border hover:bg-black/5">
          {t('play')}
        </Link>
      </div>
    </main>
  );
}
