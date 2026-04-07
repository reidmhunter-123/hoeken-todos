import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hoeken Action Items",
  description: "Reid's email-backed to-do dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}