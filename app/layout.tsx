import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// PWA és Mobil optimalizált metaadatok
export const metadata: Metadata = {
  title: "Dartisan",
  description: "Premium Darts Assistant & Scoreboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dartisan",
  },
  formatDetection: {
    telephone: false,
  },
};

// Külön viewport beállítás a villódzásmentes mobil élményhez
export const viewport: Viewport = {
  themeColor: "#0b0d11",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu" className="dark">
      <head>
        {/* PWA ikonok és mobil finomhangolás */}
        <link rel="icon" href="/icons/apple.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} bg-[#0b0d11] text-slate-200 antialiased overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}