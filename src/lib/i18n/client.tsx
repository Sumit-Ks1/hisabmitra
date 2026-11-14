"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Lang } from "@/lib/db-types";
import { DEFAULT_LANG, makeT, type T } from "./index";

const LangContext = createContext<Lang>(DEFAULT_LANG);

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useT(): T {
  const lang = useContext(LangContext);
  return useMemo(() => makeT(lang), [lang]);
}
