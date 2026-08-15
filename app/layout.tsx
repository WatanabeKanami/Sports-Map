import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "いまスポ | 今日できる運動を見つけよう",
  description:
    "時間・予算・人数・気分から、江東区でできる運動を3つ提案。給水スポットや涼み処も一緒に探せるスポーツマップです。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "いまスポ | 今日できる運動を見つけよう",
    description:
      "時間・予算・人数・気分から、江東区でできる運動を3つ提案します。",
    type: "website",
    locale: "ja_JP",
    images: [
      {
        url: "/og-sports-map.jpg",
        width: 1536,
        height: 1024,
        alt: "江東区の水辺と運動施設を描いた、いまスポのイラスト地図",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "いまスポ | 今日できる運動を見つけよう",
    description: "江東区で今からできる運動を3つ提案するスポーツマップ。",
    images: ["/og-sports-map.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
