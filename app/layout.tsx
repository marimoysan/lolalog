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
    icon: [
      { url: "/lolalog-icono-1024.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/lolalog-icono-1024.svg",
    apple: "/apple-touch-icon.png",
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
