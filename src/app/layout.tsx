import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./crm.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM PTSLU | Data Customer, RFM & Cohort",
  description: "CRM PTSLU: data customer 2023-sekarang, analisa RFM, cohort retensi, dan reminder repeat order.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`} data-theme="light">
      <body>{children}</body>
    </html>
  );
}
