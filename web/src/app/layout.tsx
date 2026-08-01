import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeryRare Media",
  description: "Premium streaming by Very Rare Society",

  icons: {
    icon: "/branding/vrsm-dark-favicon-trans.png",
    shortcut: "/branding/vrsm-dark-favicon-trans.png",
    apple: "/branding/vrsm-dark-favicon-trans.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
