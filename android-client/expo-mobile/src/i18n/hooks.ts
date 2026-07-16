import { useCallback, useSyncExternalStore } from "react";
import { getLanguage, setLanguage, t as translate, type LanguageCode, LANGUAGES } from "./index";

const listeners = new Set<() => void>();

export function useLanguage() {
  const language = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    getLanguage
  );

  const changeLanguage = useCallback((code: LanguageCode) => {
    setLanguage(code);
    listeners.forEach((cb) => cb());
  }, []);

  return { language, changeLanguage, languages: LANGUAGES, t: translate };
}

export { translate as t };
