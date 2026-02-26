#!/bin/bash
patch /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/pages/Contacts.tsx << 'PATCHEOF'
--- /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/pages/Contacts.tsx
+++ /Users/bilal/dev/tkturners/new-tkturners-accounting/dashboard/src/pages/Contacts.tsx
@@ -1,9 +1,10 @@
 import { useEffect, useState } from 'react';
 import { api } from '../lib/api';
-import { Users, Building, Plus, Mail, Phone, Briefcase } from 'lucide-react';
+import { Users, Building, Plus, Mail, Phone, Briefcase, ArrowRight } from 'lucide-react';
 import { AddContactModal } from '../components/AddContactModal';
 import { AddProjectModal } from '../components/AddProjectModal';
+import { Link } from 'react-router-dom';
 
 export const ContactsPage = () => {
   const [contacts, setContacts] = useState<any[]>([]);
@@ -82,23 +83,26 @@
             )}
           </div>
         ) : contacts.map((contact) => (
-          <div key={contact.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
-            <div className="flex justify-between items-start mb-4">
-              <div className="p-2 bg-indigo-500/10 rounded-lg">
-                <Building size={24} className="text-indigo-400" />
-              </div>
-              <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
-                contact.type === 'Client' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
-                contact.type === 'Vendor' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
-                'bg-amber-500/10 text-amber-400 border-amber-500/20'
-              }`}>
-                {contact.type}
-              </span>
-            </div>
-            
-            <h3 className="font-semibold text-lg text-white mb-3 truncate" title={contact.name}>{contact.name}</h3>
-            
-            <div className="space-y-2 text-sm text-slate-400">
+          <Link to={`/contacts/${contact.id}`} key={contact.id} className="block group">
+            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-indigo-500/50 transition-all hover:bg-slate-800/50 h-full flex flex-col">
+              <div className="flex justify-between items-start mb-4">
+                <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
+                  <Building size={24} className="text-indigo-400" />
+                </div>
+                <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
+                  contact.type === 'Client' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
+                  contact.type === 'Vendor' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
+                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
+                }`}>
+                  {contact.type}
+                </span>
+              </div>
+              
+              <div className="flex justify-between items-center mb-3">
+                <h3 className="font-semibold text-lg text-white truncate group-hover:text-indigo-300 transition-colors" title={contact.name}>{contact.name}</h3>
+                <ArrowRight size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors flex-shrink-0 ml-2" />
+              </div>
+              
+              <div className="space-y-2 text-sm text-slate-400 flex-1">
                 {contact.email && (
                   <div className="flex items-center gap-2 truncate">
                     <Mail size={14} className="text-slate-500 flex-shrink-0" />
@@ -109,10 +113,11 @@
                   <div className="flex items-center gap-2 truncate">
                     <Phone size={14} className="text-slate-500 flex-shrink-0" />
                     <span>{contact.phone}</span>
                   </div>
                 )}
-            </div>
-          </div>
+              </div>
+            </div>
+          </Link>
         ))}
       </div>
PATCHEOF
chmod +x patch-contacts.sh
./patch-contacts.sh
rm patch-contacts.sh
