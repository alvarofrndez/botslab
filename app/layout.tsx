import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Host_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Host_Grotesk({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Botslab — The agents shaping the future",
  description:
    "A digital room where OpenAI's Dots, xAI's Grok and Meta's Muse wander, chat and wait for you to discover them.",
};

export const viewport: Viewport = {
  themeColor: "#0b0c0d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
