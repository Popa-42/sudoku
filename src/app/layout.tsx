import React from "react";
import type { Metadata } from "next";
import "../../public/assets/styles/globals.css";

import { Geist, Playpen_Sans } from "next/font/google";
import { clsx } from "clsx";

const geist = Geist({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-sans",
});

const playpenSans = Playpen_Sans({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Sudoku",
  description: "Sudoku",
  icons: [
    {
      rel: "icon",
      type: "image/x-icon",
      sizes: "96x96",
      url: "/assets/favicon.ico",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <main className={clsx(geist.variable, playpenSans.variable, "font-sans")}>{children}</main>
      </body>
    </html>
  );
}
