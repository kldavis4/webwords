import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebWords",
  description: "A fast, dictionary-backed word search game built with Next.js.",
  icons: {
    icon: [{ type: "image/svg+xml", url: "/favicon.svg" }],
    shortcut: [{ type: "image/svg+xml", url: "/favicon.svg" }]
  }
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
