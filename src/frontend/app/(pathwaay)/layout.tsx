import type { Metadata } from "next";
import "./globals.css";
import "../pathwaay-ribbon.css";
import PathwaayRibbon from "../PathwaayRibbon";

export const metadata: Metadata = {
  title: "Pathwaay | Career Explorer",
  description: "Explore career paths, their links to the Sustainable Development Goals, and illustrative AI futures.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning><PathwaayRibbon />{children}</body>
    </html>
  );
}
