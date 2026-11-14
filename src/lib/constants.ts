export const BRAND = {
  name: "HisabMitra",
  tagline: "PG ka hisaab, ab digital.",
  secondaryTagline: "Tenants se lekar payments tak, sab kuch ek jagah.",
  message: "From physical registers to smart digital management.",
  shortDescription:
    "HisabMitra is a simple PG and hostel management app for India — built to replace registers, notebooks and scattered spreadsheets with one organized dashboard.",
  title: "HisabMitra — Smart PG & Hostel Management Software",
  description:
    "Manage PG tenants, rooms, monthly rent, pending payments, electricity charges and payment records with HisabMitra — a simple, mobile-first PG management app for India.",
  keywords: [
    "PG management software India",
    "PG tenant management",
    "Hostel management software",
    "Rent tracking software",
    "PG owner software",
    "Tenant payment tracking",
  ],
  disclaimer:
    "HisabMitra is an independent property management platform. It is not affiliated with any government electricity distribution company, UPPCL, PVVNL, NPCI or BBPS.",
} as const;

/** Date the legal pages were last revised. Kept static on purpose. */
export const LEGAL_LAST_UPDATED = "14 November 2026";
export const LEGAL_LAST_UPDATED_ISO = "2026-11-14";

export type NavLink = { label: string; href: string };

export const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/#top" },
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Contact", href: "/#contact" },
];

export const FOOTER_LINKS: { heading: string; links: NavLink[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How It Works", href: "/#how-it-works" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" },
      { label: "Login", href: "/login" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];
