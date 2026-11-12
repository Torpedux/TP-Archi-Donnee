import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Toutes les pages lisent la base à chaque requête.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Bracket", template: "%s · Bracket" },
  description: "Tournois e-sport : classements, arbres, scores en direct et graphe « qui a battu qui ».",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
