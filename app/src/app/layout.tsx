import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { EnTete } from "@/composants/en-tete";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Toutes les pages lisent la base à chaque requête.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Bracket", template: "%s · Bracket" },
  description: "Tournois e-sport : classements, arbres, scores en direct et graphe « qui a battu qui ».",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <EnTete />
        <main id="contenu" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
          Bracket · TP Conception et architecture des données · PostgreSQL + Neo4j
        </footer>
      </body>
    </html>
  );
}
