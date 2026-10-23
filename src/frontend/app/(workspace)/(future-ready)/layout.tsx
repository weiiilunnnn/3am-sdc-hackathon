import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aiversecity | Role Matching",
  description: "Explore verified technology roles and personalised starter learning pathways using synthetic profiles.",
};

export default function FutureRoleLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="future-role-ui">{children}</div>;
}
