'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/providers/LanguageProvider';

export default function LanguagePicker() {
  const { lang, setLang, t } = useLang();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // seçilmemişse göster
    setShow(typeof window !== 'undefined' && !localStorage.getItem('chesscoach.lang'));
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50">
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl w-[90%] max-w-md shadow-xl">
        <h2 className="text-xl font-semibold mb-4">{t('chooseLanguage')}</h2>
        <div className="grid gap-2">
          <button className="btn" onClick={() => { setLang('tr'); setShow(false); }}>
            {t('turkish')}
          </button>
          <button className="btn" onClick={() => { setLang('de'); setShow(false); }}>
            {t('german')}
          </button>
          <button className="btn" onClick={() => { setLang('en'); setShow(false); }}>
            {t('english')}
          </button>
        </div>
      </div>
    </div>
  );
}
