import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { translations, type Language } from "./translations";

type I18nContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const STORAGE_KEY = "jan.language";

const isLanguage = (value: string | null): value is Language => {
  if (!value) return false;
  return Object.prototype.hasOwnProperty.call(translations, value);
};

const detectSystemLanguage = (): Language => {
  const systemLang = navigator.language || navigator.languages?.[0] || "en";
  
  const baseLang = systemLang.toLowerCase().split("-")[0];
  
  const languageMap: Record<string, Language> = {
    ru: "ru",
    en: "en",
    uk: "uk",
    pl: "pl",
    be: "be"
  };
  
  const fullLang = systemLang.toLowerCase();
  if (fullLang.startsWith("be")) return "be";
  if (fullLang.startsWith("ru")) return "ru";
  if (fullLang.startsWith("uk")) return "uk";
  if (fullLang.startsWith("pl")) return "pl";
  if (fullLang.startsWith("en")) return "en";
  
  if (languageMap[baseLang]) {
    return languageMap[baseLang];
  }
  
  return "en";
};

const resolvePath = (source: Record<string, unknown>, path: string) =>
  path.split(".").reduce<unknown>((acc, key) => {
    if (typeof acc !== "object" || acc === null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);

const interpolate = (
  template: string,
  params?: Record<string, string | number>
) => {
  if (!params) return template;
  return Object.entries(params).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value)),
    template
  );
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) {
      return stored;
    }
    const detected = detectSystemLanguage();
    window.localStorage.setItem(STORAGE_KEY, detected);
    return detected;
  });

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const updateLanguage = useCallback((next: Language) => {
    setLanguage(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const entry = resolvePath(translations[language], key);
      if (typeof entry !== "string") return key;
      return interpolate(entry, params);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage: updateLanguage,
      t
    }),
    [language, updateLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
};
