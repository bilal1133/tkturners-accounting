import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";
import {
  Home,
  Wallet,
  Users,
  Banknote,
  Landmark,
  Coins,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { LedgerPage } from "./pages/Ledger";
import { ContactsPage } from "./pages/Contacts";
import { ContactDetailsPage } from "./pages/ContactDetails";
import { ProjectDetailsPage } from "./pages/ProjectDetails";
import { PayrollPage } from "./pages/Payroll";
import { GeneratePayrollPage } from "./pages/GeneratePayroll";
import { PayrollBatchDetailsPage } from "./pages/PayrollBatchDetails";
import { AccountsPage } from "./pages/Accounts";
import { AccountDetailsPage } from "./pages/AccountDetails";
import { LoginPage } from "./pages/Login";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LogOut } from "lucide-react";
import { TransactionDetailsPage } from "./pages/TransactionDetails";
import { CurrenciesPage } from "./pages/Currencies";
import { DashboardPage } from "./pages/Dashboard";

type SidebarProps = {
  collapsed?: boolean;
  isMobile?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
};

const Sidebar = ({
  collapsed = false,
  isMobile = false,
  onToggleCollapse,
  onNavigate,
}: SidebarProps) => {
  const { logout, user } = useAuth();
  const navItems = useMemo(
    () => [
      { to: "/", label: "Dashboard", icon: Home },
      { to: "/accounts", label: "Accounts & Books", icon: Landmark },
      { to: "/ledger", label: "Ledger", icon: Wallet },
      { to: "/contacts", label: "Contacts & Docs", icon: Users },
      { to: "/payroll", label: "Payroll & Loans", icon: Banknote },
      { to: "/currencies", label: "Currencies", icon: Coins },
    ],
    [],
  );

  return (
    <aside
      className={`${collapsed && !isMobile ? "w-20" : "w-72"} border-r border-cyan-900/40 bg-slate-950/90 backdrop-blur-xl h-full flex flex-col transition-all duration-200`}
    >
      <div
        className={`${collapsed && !isMobile ? "px-3 py-4" : "p-6"} border-b border-cyan-900/30 flex items-center justify-between gap-2`}
      >
        <h1
          className={`text-xl font-bold bg-gradient-to-r from-cyan-300 via-sky-200 to-teal-200 bg-clip-text text-transparent ${collapsed && !isMobile ? "sr-only" : ""}`}
        >
          Partner Accounting
        </h1>
        {!isMobile ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-900/40 bg-slate-900/90 text-slate-200 hover:bg-slate-800"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        ) : null}
      </div>
      <nav className="scroll-surface scroll-thin flex-1 overflow-y-auto p-4 space-y-2 pr-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center ${collapsed && !isMobile ? "justify-center" : "gap-3"} rounded-xl border px-3 py-2.5 transition-all ${
                isActive
                  ? "border-cyan-500/60 bg-cyan-500/10 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.22)]"
                  : "border-transparent text-slate-300 hover:border-cyan-900/60 hover:bg-slate-900/70 hover:text-slate-100"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={
                    isActive
                      ? "text-cyan-300"
                      : "text-slate-500 group-hover:text-slate-300"
                  }
                />
                <span className={`${collapsed && !isMobile ? "sr-only" : "font-medium"}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className={`${collapsed && !isMobile ? "p-3" : "p-4"} border-t border-cyan-900/30`}>
        <div className={`mb-3 ${collapsed && !isMobile ? "px-1" : "px-3"}`}>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            {collapsed && !isMobile ? "User" : "Logged In As"}
          </p>
          <p
            className={`text-sm text-slate-200 font-medium truncate mt-0.5 ${collapsed && !isMobile ? "hidden" : ""}`}
            title={user?.email}
          >
            {user?.email}
          </p>
        </div>
        <button
          onClick={logout}
          className={`w-full flex items-center justify-center ${collapsed && !isMobile ? "" : "gap-2"} bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium py-2.5 rounded-xl transition-colors border border-cyan-900/40`}
          title={collapsed && !isMobile ? "Sign Out" : undefined}
        >
          <LogOut size={16} />
          <span className={collapsed && !isMobile ? "sr-only" : ""}>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("sidebar_collapsed");
    if (stored === "1") setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sidebar_collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_20%,rgba(34,211,238,0.12),transparent_45%),radial-gradient(circle_at_85%_4%,rgba(45,212,191,0.1),transparent_35%),#020617]">
      <div className="hidden md:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="relative z-50 h-full max-w-[18rem]">
            <Sidebar isMobile onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="scroll-surface scroll-thin relative flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-cyan-900/30 bg-slate-950/70 px-4 py-2.5 md:hidden">
          <h2 className="text-sm font-semibold tracking-wide text-cyan-100">
            Partner Accounting
          </h2>
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg border border-cyan-900/40 bg-slate-900/90 p-2 text-slate-200"
            aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {children}
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { jwt, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Loading auth state...
      </div>
    );
  }

  if (!jwt) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { jwt, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Loading auth state...
      </div>
    );
  }

  if (jwt) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/accounts" element={<AccountsPage />} />
                    <Route
                      path="/accounts/:id"
                      element={<AccountDetailsPage />}
                    />
                    <Route path="/currencies" element={<CurrenciesPage />} />
                    <Route path="/ledger" element={<LedgerPage />} />
                    <Route
                      path="/ledger/:id"
                      element={<TransactionDetailsPage />}
                    />
                    <Route path="/contacts" element={<ContactsPage />} />
                    <Route
                      path="/contacts/:id"
                      element={<ContactDetailsPage />}
                    />
                    <Route
                      path="/projects/:id"
                      element={<ProjectDetailsPage />}
                    />
                    <Route
                      path="/payrolls/generate"
                      element={<GeneratePayrollPage />}
                    />
                    <Route
                      path="/payrolls/:id"
                      element={<PayrollBatchDetailsPage />}
                    />
                    <Route path="/payroll" element={<PayrollPage />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
