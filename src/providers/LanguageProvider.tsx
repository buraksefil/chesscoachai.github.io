'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANG, STORAGE_KEY, getDict, type Lang } from '@/lib/i18n';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
};

const LanguageCtx = createContext<Ctx>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (k) => k
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);

  // ilk açılışta storage'tan oku
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as Lang | null;
    if (saved) setLang(saved);
  }, []);

  const dict = useMemo(() => getDict(lang), [lang]);
  const t = (k: string) => dict[k] ?? k;

  const update = (l: Lang) => {
    setLang(l);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, l);
  };

  return (
    <LanguageCtx.Provider value={{ lang, setLang: update, t }}>
      {children}
    </LanguageCtx.Provider>
  );
}

export function useLang() {
  return useContext(LanguageCtx);
}
