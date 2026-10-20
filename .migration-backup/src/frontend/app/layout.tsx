import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3AM SDC Hackathon",
  description: "Hackathon project dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
