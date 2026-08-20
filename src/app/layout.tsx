import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as ToasterSonner } from "@/components/ui/sonner";
import { SessionProvider } from "@/lib/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thuso — Restaurant Counter & Kitchen",
  description: "Offline-first restaurant POS with real-time KOT sync between counter and kitchen tablet.",
  keywords: ["restaurant", "POS", "KOT", "billing", "kitchen display", "restaurant management"],
  authors: [{ name: "Thuso" }],
  manifest: "/manifest.json",
  openGraph: {
    title: "Thuso",
    description: "Offline-first restaurant POS with real-time KOT sync",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
      <div className="h-5"></div>
        <SessionProvider>
          {children}
          <Toaster />
          <ToasterSonner />
        </SessionProvider>
      </body>
    </html>
  );
}
