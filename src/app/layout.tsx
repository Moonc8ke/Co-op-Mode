import type { Metadata, Viewport } from "next";
import "./globals.css";
import Splash from "@/components/Splash";

export const metadata: Metadata = {
  title: "Andrew & Juliette — Our Book",
  description:
    "A shared book of plans, ideas, and the good stuff you've already done together: bucket lists, a shared calendar, dinner decisions, and a photo scrapbook.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    title: "Co-op Mode",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  // The legacy apple- prefixed full-screen tag, for older iOS Safari.
  // Next already emits the modern "mobile-web-app-capable" tag itself.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#fff7ed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg)] text-[var(--text)] antialiased">
        <Splash />
        {children}
      </body>
    </html>
  );
}
