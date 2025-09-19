'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/providers/LanguageProvider';

const STORAGE_KEY = 'chesscoach.lang';
const allowed = new Set(['tr','en','de']);

export default function LanguagePicker() {
  const { lang, setLang, t } = useLang();
  const [show, setShow] = useState(false);

  // URL ile zorla açmak için: ?reset-lang=1
  const force = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('reset-lang') === '1';
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (force) { setShow(true); return; }
    if (!saved || !allowed.has(saved)) setShow(true);
  }, [force]);

  const choose = (code: 'tr'|'en'|'de') => {
    setLang(code);
    localStorage.setItem(STORAGE_KEY, code);
    setShow(false);
  };

  return (
    <>
      {show && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
          <div className="w-[90%] max-w-md rounded-2xl border bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold">{t('chooseLanguage')}</h2>
            <div className="grid gap-2">
              <button className="rounded-xl border px-4 py-2 hover:bg-black/5" onClick={() => choose('tr')}>{t('turkish')}</button>
              <button className="rounded-xl border px-4 py-2 hover:bg-black/5" onClick={() => choose('de')}>{t('german')}</button>
              <button className="rounded-xl border px-4 py-2 hover:bg-black/5" onClick={() => choose('en')}>{t('english')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sağ altta her zaman görünen değiştir butonu */}
      <button
        aria-label="Change language"
        onClick={() => setShow(true)}
        className="fixed bottom-3 right-3 z-40 rounded-full border bg-white/80 px-3 py-2 text-sm backdrop-blur hover:bg-white dark:bg-zinc-900/80 dark:hover:bg-zinc-900"
      >
        🌐 {lang.toUpperCase()}
      </button>
    </>
  );
}