import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Andrew & Juliette — Our Book",
  description:
    "A shared book of plans, ideas, and the good stuff you've already done together: bucket lists, a shared calendar, dinner decisions, and a photo scrapbook.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg)] text-[var(--text)] antialiased">
        {children}
      </body>
    </html>
  );
}
