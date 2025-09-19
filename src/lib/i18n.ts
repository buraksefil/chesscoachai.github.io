export type Lang = 'tr' | 'de' | 'en';
import tr from '@/locales/tr.json';
import de from '@/locales/de.json';
import en from '@/locales/en.json';

const dictionaries: Record<Lang, Record<string, string>> = { tr, de, en };
export const DEFAULT_LANG: Lang = 'en';
export const STORAGE_KEY = 'chesscoach.lang';
export const getDict = (lang: Lang) => dictionaries[lang] ?? en;
