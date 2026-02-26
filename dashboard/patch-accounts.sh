#!/bin/bash
patch /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/pages/Accounts.tsx << 'PATCHEOF'
--- /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/pages/Accounts.tsx
+++ /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/pages/Accounts.tsx
@@ -1,7 +1,8 @@
 import { useEffect, useState } from 'react';
 import { api } from '../lib/api';
-import { Building2, Plus, Landmark } from 'lucide-react';
+import { Building2, Plus, Landmark, ArrowRight } from 'lucide-react';
 import { AddAccountModal } from '../components/AddAccountModal';
+import { Link } from 'react-router-dom';
 
 export const AccountsPage = () => {
   const [accounts, setAccounts] = useState<any[]>([]);
@@ -36,22 +37,25 @@
 
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {loading ? <p className="text-slate-500">Loading...</p> : accounts.map((acc) => (
-          <div key={acc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
-            <div className="flex justify-between items-start mb-4">
-              <div className="p-2 bg-indigo-500/10 rounded-lg">
-                <Building2 size={24} className="text-indigo-400" />
+          <Link to={`/accounts/${acc.id}`} key={acc.id} className="block group">
+            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-indigo-500/50 transition-all hover:bg-slate-800/50">
+              <div className="flex justify-between items-start mb-4">
+                <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
+                  <Building2 size={24} className="text-indigo-400" />
+                </div>
+                <span className="text-xs font-medium px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 group-hover:border-slate-600 transition-colors">
+                  {acc.currency?.Symbol || acc.currency?.Name || 'N/A'}
+                </span>
               </div>
-              <span className="text-xs font-medium px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
-                {acc.currency?.Symbol || acc.currency?.Name || 'N/A'}
-              </span>
-            </div>
-            <h3 className="font-semibold text-lg text-white truncate" title={acc.name}>{acc.name}</h3>
-            <p className="text-sm text-slate-400 mt-1">
-              Initial: {acc.initial_amount}
-            </p>
-            {acc.exclude_from_statistics && (
-               <span className="inline-block mt-3 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded">
-                 Excluded from Stats
-               </span>
-            )}
-          </div>
+              <div className="flex justify-between items-end">
+                  <div>
+                      <h3 className="font-semibold text-lg text-white truncate group-hover:text-indigo-300 transition-colors" title={acc.name}>{acc.name}</h3>
+                      <p className="text-sm text-slate-400 mt-1">
+                        Initial: {acc.initial_amount}
+                      </p>
+                  </div>
+                  <ArrowRight size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors mb-1" />
+              </div>
+              {acc.exclude_from_statistics && (
+                 <span className="inline-block mt-3 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded">
+                   Excluded from Stats
+                 </span>
+              )}
+            </div>
+          </Link>
         ))}
PATCHEOF
chmod +x patch-accounts.sh
./patch-accounts.sh
rm patch-accounts.sh
