import type { Metadata, Viewport } from "next";
import "./globals.css";

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

// iPhone launch images (portrait). iOS shows the matching one instead of a
// blank screen while the app loads. Android ignores these — Chrome draws
// its own splash from the manifest instead, and that cannot be customized.
// Each PNG is generated at build time by scripts/generate-icons.mjs
// (prebuild) from scripts/launch-template.svg; see that file for the sizes.
const LAUNCH_IMAGES: Array<{ href: string; media: string }> = [
  {
    href: "/launch-1290x2796.png",
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    href: "/launch-1179x2556.png",
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    href: "/launch-1284x2778.png",
    media:
      "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    href: "/launch-1170x2532.png",
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    href: "/launch-1125x2436.png",
    media:
      "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    href: "/launch-828x1792.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    href: "/launch-750x1334.png",
    media:
      "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    href: "/launch-640x1136.png",
    media:
      "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {LAUNCH_IMAGES.map((image) => (
          <link
            key={image.href}
            rel="apple-touch-startup-image"
            media={image.media}
            href={image.href}
          />
        ))}
      </head>
      <body className="bg-[var(--bg)] text-[var(--text)] antialiased">
        {children}
      </body>
    </html>
  );
}
