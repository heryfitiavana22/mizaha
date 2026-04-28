import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mizaha",
  description: "Recherche intelligente de prospects B2B en France",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.className} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning={true}
    >
      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning={true}
      >
        <header className="border-b bg-background">
          <nav className="container mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="font-semibold text-sm">
              Mizaha
            </Link>
            <Link
              href="/searches/new"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Nouvelle recherche
            </Link>
            <Link
              href="/companies"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Entreprises
            </Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
