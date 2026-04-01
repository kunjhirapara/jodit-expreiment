import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jodit Rich Text Editor — Next.js",
  description:
    "A premium rich text editor built with Jodit-React and Next.js featuring inline image uploads, drag & drop support, and local image storage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
