import type { Metadata } from "next";
import "./globals.css";
import "./noteforge.css";

export const metadata: Metadata = {
  title: "Noteforge — Your team's workspace",
  description: "Write, plan, and organize your work in Noteforge. Connected pages, a block editor, and flexible databases.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
