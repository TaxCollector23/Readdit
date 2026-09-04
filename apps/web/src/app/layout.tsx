import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Readdit — Reddit intelligence for developers",
  description:
    "Readdit reads Reddit so you don't have to. Evidence-backed research on what Reddit actually thinks about products, tools, and technologies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
