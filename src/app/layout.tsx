import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { siteConfig } from "@/lib/config";
import { BRAND } from "@/lib/constants";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: BRAND.title,
    template: "%s · HisabMitra",
  },
  description: BRAND.description,
  keywords: [...BRAND.keywords],
  applicationName: BRAND.name,
  category: "business",
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: BRAND.name,
    title: BRAND.title,
    description: BRAND.description,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.title,
    description: BRAND.description,
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#4F6EF7",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontSize: "0.95rem" } }} />
        <PwaRegister />
      </body>
    </html>
  );
}
