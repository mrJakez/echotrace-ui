import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "EchoTrace",
  description: "Recordings, transcript and timeline context in one calendar-first workspace."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
