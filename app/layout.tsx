import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileShell from "@/components/mobile/MobileShell";

export const metadata: Metadata = {
  title: "Timebox Calendar",
  description: "タイムボクシング & カレンダー",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Timebox",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">
        <MobileShell>{children}</MobileShell>
      </body>
    </html>
  );
}
