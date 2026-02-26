#!/bin/bash
patch /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/pages/Ledger.tsx << 'PATCHEOF'
--- /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/pages/Ledger.tsx
+++ /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/pages/Ledger.tsx
@@ -1,6 +1,7 @@
 import { useEffect, useState } from 'react';
 import { api } from '../lib/api';
 import { Plus, ArrowDownRight, ArrowUpRight, RefreshCw, Filter } from 'lucide-react';
 import { AddTransactionModal } from '../components/AddTransactionModal';
+import { Link } from 'react-router-dom';
 
 export const LedgerPage = () => {
@@ -95,7 +96,9 @@
                   </td>
                   <td className="p-4 text-slate-300">{tx.account?.name || '-'}</td>
                   <td className="p-4 text-right">
-                     <button className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors">
-                         Edit
-                     </button>
+                     <Link to={`/ledger/${tx.id}`} className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors">
+                         View
+                     </Link>
                   </td>
                 </tr>
PATCHEOF
chmod +x patch-ledger.sh
./patch-ledger.sh
rm patch-ledger.sh
