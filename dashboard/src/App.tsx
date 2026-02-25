import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Home, Wallet, Users, Banknote, Landmark } from "lucide-react";
import { LedgerPage } from "./pages/Ledger";
import { ContactsPage } from "./pages/Contacts";
import { ContactDetailsPage } from "./pages/ContactDetails";
import { ProjectDetailsPage } from "./pages/ProjectDetails";
import { PayrollPage } from "./pages/Payroll";
import { AccountsPage } from "./pages/Accounts";
import { AccountDetailsPage } from "./pages/AccountDetails";
import { LoginPage } from "./pages/Login";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LogOut } from "lucide-react";

const Sidebar = () => {
  const { logout, user } = useAuth();

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900 h-screen flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Partner Accounting
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link
          to="/"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Home size={20} className="text-slate-400" />
          <span className="font-medium text-slate-200">Dashboard</span>
        </Link>
        <Link
          to="/accounts"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Landmark size={20} className="text-slate-400" />
          <span className="font-medium text-slate-200">Accounts & Books</span>
        </Link>
        <Link
          to="/ledger"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Wallet size={20} className="text-slate-400" />
          <span className="font-medium text-slate-200">Ledger</span>
        </Link>
        <Link
          to="/contacts"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Users size={20} className="text-slate-400" />
          <span className="font-medium text-slate-200">Contacts & Docs</span>
        </Link>
        <Link
          to="/payroll"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Banknote size={20} className="text-slate-400" />
          <span className="font-medium text-slate-200">Payroll & Loans</span>
        </Link>
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="mb-3 px-3">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            Logged In As
          </p>
          <p
            className="text-sm text-slate-300 font-medium truncate mt-0.5"
            title={user?.email}
          >
            {user?.email}
          </p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors border border-slate-700"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  );
};

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen overflow-hidden">
    <Sidebar />
    <main className="flex-1 overflow-y-auto bg-slate-950 p-8">{children}</main>
  </div>
);

// Placeholder pages
const DashboardPage = () => <div className="text-3xl font-bold">Dashboard</div>;

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
    return <LoginPage />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
                    <Route path="/ledger" element={<LedgerPage />} />
                    <Route path="/contacts" element={<ContactsPage />} />
                    <Route
                      path="/contacts/:id"
                      element={<ContactDetailsPage />}
                    />
                    <Route
                      path="/projects/:id"
                      element={<ProjectDetailsPage />}
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
