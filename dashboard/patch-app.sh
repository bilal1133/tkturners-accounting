#!/bin/bash
patch /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/App.tsx << 'PATCHEOF'
--- /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/App.tsx
+++ /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/App.tsx
@@ -5,6 +5,7 @@
 import { ContactsPage } from "./pages/Contacts";
 import { PayrollPage } from "./pages/Payroll";
 import { AccountsPage } from "./pages/Accounts";
 import { AccountDetailsPage } from "./pages/AccountDetails";
+import { TransactionDetailsPage } from "./pages/TransactionDetails";
 import { LoginPage } from "./pages/Login";
 import { AuthProvider, useAuth } from "./context/AuthContext";
 
@@ -120,6 +121,7 @@
                     <Route path="/accounts" element={<AccountsPage />} />
                     <Route path="/accounts/:id" element={<AccountDetailsPage />} />
                     <Route path="/ledger" element={<LedgerPage />} />
+                    <Route path="/ledger/:id" element={<TransactionDetailsPage />} />
                     <Route path="/contacts" element={<ContactsPage />} />
                     <Route path="/payroll" element={<PayrollPage />} />
                   </Routes>
PATCHEOF
chmod +x patch-app.sh
./patch-app.sh
rm patch-app.sh
