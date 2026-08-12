import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { EntriesProvider } from "@/lib/db/entries-store";
import { PinGate } from "@/components/PinGate";
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
  title: "LolaLog",
  description: "Diario personal de síntomas",
  manifest: "/manifest.json",
  icons: {
    icon: "/lolalog-icono-1024.svg",
    shortcut: "/lolalog-icono-1024.svg",
    apple: "/lolalog-icono-1024.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F6E56",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <EntriesProvider>
          <PinGate>{children}</PinGate>
        </EntriesProvider>
      </body>
    </html>
  );
}
