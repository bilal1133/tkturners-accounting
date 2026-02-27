import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Users, Briefcase, Plus } from "lucide-react";
import { AddContactModal } from "../components/AddContactModal";
import { AddProjectModal } from "../components/AddProjectModal";
import { Link } from "react-router-dom";

export const ContactsPage = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isContactModalOpen, setContactModalOpen] = useState(false);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contRes, projRes] = await Promise.all([
        api.get("/contacts?populate=*&pagination[pageSize]=500&status=published"),
        api.get("/projects?populate=*"),
      ]);
      setContacts(contRes.data.data);
      setProjects(projRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getContactType = (contact: any) => {
    if (contact.contact_type && contact.contact_type.length > 0) {
      const comp = contact.contact_type[0].__component;
      if (comp === "contact-type.employee") return "Employee";
      if (comp === "contact-type.vendor") return "Vendor";
      if (comp === "contact-type.customer") return "Customer";
      return comp;
    }
    return "Unknown";
  };

  return (
    <div className="space-y-8 text-slate-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Contacts & Projects</h1>
          <p className="text-slate-400 mt-1">
            Manage your team, customers, vendors, and jobs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Contacts Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users size={18} className="text-indigo-400" />
              Contacts List
            </h2>
            <button
              onClick={() => setContactModalOpen(true)}
              className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1"
            >
              <Plus size={16} /> Add Contact
            </button>
          </div>
          <div className="p-4 flex-1">
            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : (
              <ul className="space-y-3">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/contacts/${c.documentId}`}
                      className="flex justify-between items-center p-3 rounded-lg hover:bg-slate-800 transition-colors border border-slate-800 border-transparent hover:border-slate-700 cursor-pointer group"
                    >
                      <div>
                        <p className="font-medium text-slate-200 group-hover:text-indigo-300 transition-colors">
                          {c.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {c.email} • {c.phone}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-slate-800 font-medium border border-slate-700">
                        {getContactType(c)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Projects Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase size={18} className="text-teal-400" />
              Active Projects
            </h2>
            <button
              onClick={() => setProjectModalOpen(true)}
              className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1"
            >
              <Plus size={16} /> Add Project
            </button>
          </div>
          <div className="p-4 flex-1">
            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : (
              <ul className="space-y-3">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="p-4 rounded-lg bg-slate-800/50 border border-slate-800"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <Link
                        to={`/projects/${p.documentId}`}
                        className="font-semibold text-slate-200 hover:text-indigo-400 transition-colors"
                      >
                        {p.name}
                      </Link>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${p.status === "Active" ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" : "bg-slate-800 text-slate-400"}`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {p.description}
                    </p>
                    {p.contact && (
                      <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-800">
                        Client: {p.contact.name}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <AddContactModal
        isOpen={isContactModalOpen}
        onClose={() => setContactModalOpen(false)}
        onSuccess={() => loadData()}
      />

      <AddProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
