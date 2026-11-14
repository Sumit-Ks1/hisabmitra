import type { Lang } from "@/lib/db-types";

/**
 * Two-language copy without a key catalogue: every string is written once, in
 * place, in both simple English and Hinglish.
 *
 *   t("Add tenant", "Tenant jodein")
 */
export type T = (en: string, hinglish: string) => string;

export const makeT =
  (lang: Lang): T =>
  (en, hinglish) =>
    lang === "en" ? en : hinglish;

export const DEFAULT_LANG: Lang = "hinglish";

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "hinglish", label: "Hinglish" },
  { value: "en", label: "English" },
];
