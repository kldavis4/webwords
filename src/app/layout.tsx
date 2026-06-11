import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WordWeb Boggle",
  description: "A fast, dictionary-backed Boggle word search game built with Next.js."
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
