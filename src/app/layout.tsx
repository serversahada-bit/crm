import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Milk, RefreshCw } from "lucide-react";
import { ActiveNavLinks, NavLinks } from "@/components/NavLinks";
import { MobileNavToggle, NavBackdrop, ThemeToggle } from "@/components/ShellControls";
import { DataFreshness } from "@/components/DataFreshness";
import { reloadData } from "./actions";
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
      <body>
        <div className="app-layout">
          <aside className="sidebar">
            <div className="sidebar-header">
              <div className="brand-wrapper">
                <div className="brand-icon">
                  <Milk size={20} />
                </div>
                <div className="brand-text">
                  <span className="brand-name">CRM PTSLU</span>
                  <span className="brand-badge">Customer Analytics</span>
                </div>
              </div>
            </div>
            <div className="sidebar-content">
              <div>
                <div className="nav-section-title">Menu</div>
                <Suspense fallback={<NavLinks />}>
                  <ActiveNavLinks />
                </Suspense>
              </div>
            </div>
            <div className="sidebar-footer">
              <Suspense fallback={<span className="muted-small">Memuat data...</span>}>
                <DataFreshness />
              </Suspense>
            </div>
          </aside>
          <NavBackdrop />

          <main className="main-content">
            <header className="top-navbar">
              <div className="navbar-left">
                <MobileNavToggle />
              </div>
              <div className="navbar-right">
                <form action={reloadData}>
                  <button className="btn-ghost" type="submit" title="Muat ulang data dari database">
                    <RefreshCw size={15} />
                    <span>Muat ulang data</span>
                  </button>
                </form>
                <ThemeToggle />
              </div>
            </header>
            <div className="page-body">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
