import type { Metadata } from "next";
import { Noto_Serif_TC, Noto_Sans_TC } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { DEFAULT_FONT_SIZE, FONT_SIZE_INIT_SCRIPT } from "@/lib/font-size";
import "./globals.css";

// CJK fonts: no `subsets` — next/font types don't expose chinese-traditional
// Weights: 400/900 only — 700 removed to reduce render-blocking CSS size.
// Elements using font-weight:700 in serif TC get browser weight-matching to 900.
const serifTC = Noto_Serif_TC({
  weight: ["400", "900"],
  display: "swap",
  variable: "--font-serif-tc",
  preload: false,
});

const sansTC = Noto_Sans_TC({
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-sans-tc",
  preload: false,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://afterhours.film";

export const metadata: Metadata = {
  title: {
    default: "散場之後",
    template: "%s — 散場之後",
  },
  description: "一份個人藝術電影日誌・每夜更新",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "散場之後",
  },
  alternates: {
    types: {
      "application/rss+xml": `${SITE_URL}/rss.xml`,
    },
  },
  openGraph: {
    siteName: "散場之後",
    locale: "zh_TW",
    type: "website",
    images: [{ url: `${SITE_URL}/og`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [`${SITE_URL}/og`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      data-font-size={DEFAULT_FONT_SIZE}
      className={`${serifTC.variable} ${sansTC.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          在首次繪製前把讀者存的字級寫上 <html>，避免 hydration 後才修正造成
          全文重排。<html> 的 suppressHydrationWarning 讓 React 接受這個由
          script 改過的 DOM 而不是丟棄它。詳見 lib/font-size.ts。
        */}
        <script dangerouslySetInnerHTML={{ __html: FONT_SIZE_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Footer />
      </body>
    </html>
  );
}
