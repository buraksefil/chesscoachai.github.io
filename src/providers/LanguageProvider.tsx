'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANG, STORAGE_KEY, getDict, type Lang } from '@/lib/i18n';

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string; };

const C = createContext<Ctx>({ lang: DEFAULT_LANG, setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved) setLang(saved);
  }, []);

  const dict = useMemo(() => getDict(lang), [lang]);
  const t = (k: string) => dict[k] ?? k;

  const update = (l: Lang) => {
    setLang(l);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, l);
  };

  return <C.Provider value={{ lang, setLang: update, t }}>{children}</C.Provider>;
}

export const useLang = () => useContext(C);
