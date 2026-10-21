import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pathwaay | Career Explorer",
  description: "Explore career paths, their links to the Sustainable Development Goals, and illustrative AI futures.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
