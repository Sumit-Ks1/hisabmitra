import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";
import { LEGAL_LAST_UPDATED_ISO } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/about", priority: 0.7 },
    { path: "/contact", priority: 0.6 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${siteConfig.url}${path}`,
    // Static date on purpose: content changes are deliberate, not per-build.
    lastModified: LEGAL_LAST_UPDATED_ISO,
    changeFrequency: "monthly",
    priority,
  }));
}
