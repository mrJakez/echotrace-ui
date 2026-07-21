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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem("echotrace-theme")||"auto";var r=p==="auto"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.dataset.theme=p;document.documentElement.dataset.resolvedTheme=r}catch(e){document.documentElement.dataset.theme="auto";document.documentElement.dataset.resolvedTheme="dark"}})();`
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
