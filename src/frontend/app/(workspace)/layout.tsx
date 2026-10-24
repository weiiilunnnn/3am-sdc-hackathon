import type { Metadata } from "next";
import "./globals.css";
import "./cv-studio/cv-v2.css";
import "../pathwaay-ribbon.css";
import AppShell from "./AppShell";
import PathwaayRibbon from "../PathwaayRibbon";

export const metadata: Metadata = {
  title: "Pathwaay — Career Explorer",
  description: "Build your skills profile and explore pathways into meaningful work.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><AppShell><PathwaayRibbon />{children}</AppShell></body>
    </html>
  );
}
