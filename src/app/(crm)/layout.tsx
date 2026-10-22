import { Suspense } from "react";
import Image from "next/image";
import { RefreshCw } from "lucide-react";
import sahadaMark from "@/assets/brand/sahada-mark.png";
import { ActiveNavLinks, NavLinks } from "@/components/NavLinks";
import { MobileNavToggle, NavBackdrop, ThemeToggle } from "@/components/ShellControls";
import { DataFreshness } from "@/components/DataFreshness";
import { AdminNav, UserMenu } from "@/components/UserMenu";
import { reloadData } from "./actions";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-wrapper">
            <Image src={sahadaMark} alt="Logo PT Sahada Laku Utama" className="brand-logo" width={40} height={40} priority />
            <div className="brand-text">
              <span className="brand-name">CRM PTSLU</span>
              <span className="brand-badge">PT Sahada Laku Utama</span>
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
          <Suspense fallback={null}>
            <AdminNav />
          </Suspense>
        </div>
        <div className="sidebar-footer stacked">
          <Suspense fallback={null}>
            <DataFreshness />
          </Suspense>
          <Suspense fallback={<span className="muted-small">Memuat akun...</span>}>
            <UserMenu />
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
  );
}
