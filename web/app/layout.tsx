import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rahbarlik AI — Executive Chat",
  description: "AI Executive Platform — Bitrix24 + OpenAI agent chat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
