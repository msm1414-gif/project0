import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timebox Calendar",
  description: "Google Calendar 風タイムボクシング & カレンダー",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
