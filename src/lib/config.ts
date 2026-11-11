/**
 * Site-wide configuration, read from environment variables.
 *
 * Every contact or social value is optional. When a value is missing or
 * invalid, the corresponding link is simply not rendered — nothing is ever
 * invented or hardcoded.
 */

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function httpsUrl(value: string | undefined): string | undefined {
  const v = clean(value);
  if (!v) return undefined;
  try {
    const url = new URL(v);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function email(value: string | undefined): string | undefined {
  const v = clean(value);
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : undefined;
}

function resolveSiteUrl(): string {
  const explicit = clean(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit.replace(/\/+$/, "");

  // Vercel exposes the production domain automatically.
  const vercel = clean(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export type SocialLink = { label: string; href: string };

const instagram = httpsUrl(process.env.NEXT_PUBLIC_INSTAGRAM_URL);
const linkedin = httpsUrl(process.env.NEXT_PUBLIC_LINKEDIN_URL);

export const siteConfig = {
  name: "HisabMitra",
  url: resolveSiteUrl(),
  contactEmail: email(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  socials: [
    linkedin && { label: "LinkedIn", href: linkedin },
    instagram && { label: "Instagram", href: instagram },
  ].filter(Boolean) as SocialLink[],
} as const;
