import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FutureReady | Sourced career pathways by 3AM",
  description: "Explore verified technology roles and personalised starter learning pathways using synthetic profiles.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
