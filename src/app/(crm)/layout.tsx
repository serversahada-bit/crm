import { Suspense } from "react";
import { Milk, RefreshCw } from "lucide-react";
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
