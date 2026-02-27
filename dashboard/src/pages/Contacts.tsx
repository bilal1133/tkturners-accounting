import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Users, Briefcase, Plus, Search } from "lucide-react";
import { AddContactModal } from "../components/AddContactModal";
import { AddProjectModal } from "../components/AddProjectModal";
import { Link } from "react-router-dom";

export const ContactsPage = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const getEmployeeComponent = (contact: any) =>
    contact?.contact_type?.find(
      (item: any) => item?.__component === "contact-type.employee",
    ) || null;

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((contact) => {
      const employee = getEmployeeComponent(contact);
      const department = String(employee?.department || "").trim();
      if (department) set.add(department);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return contacts.filter((contact) => {
      const type = getContactType(contact);
      const employee = getEmployeeComponent(contact);
      const department = String(employee?.department || "").trim();
      const isActive = employee?.active === undefined ? null : Boolean(employee.active);

      if (typeFilter !== "all" && type !== typeFilter) return false;
      if (departmentFilter !== "all" && department !== departmentFilter) return false;
      if (statusFilter === "active" && isActive !== true) return false;
      if (statusFilter === "inactive" && isActive !== false) return false;

      if (!query) return true;

      const haystack = [
        contact.name,
        contact.email,
        contact.phone,
        type,
        department,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [contacts, searchText, typeFilter, departmentFilter, statusFilter]);

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

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex flex-col gap-4">
          <div className="flex justify-between items-center">
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <Search size={15} className="text-slate-500" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search name, email, phone..."
                className="w-full bg-transparent outline-none placeholder:text-slate-500"
              />
            </label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
            >
              <option value="all">All Types</option>
              <option value="Employee">Employee</option>
              <option value="Vendor">Vendor</option>
              <option value="Customer">Customer</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
            >
              <option value="all">Any Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
            >
              <option value="all">All Departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
            <div className="md:col-span-2 text-xs text-slate-500 flex items-center justify-end">
              Showing {filteredContacts.length} of {contacts.length} contacts
            </div>
          </div>
        </div>

        <div className="scroll-surface scroll-thin overflow-x-auto">
          {loading ? (
            <p className="text-slate-500 p-4">Loading...</p>
          ) : (
            <table className="w-full min-w-[940px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wide text-xs">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No contacts match current filters.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => {
                    const type = getContactType(contact);
                    const employee = getEmployeeComponent(contact);
                    const department = employee?.department || "—";
                    const isActive =
                      employee?.active === undefined ? null : Boolean(employee.active);

                    return (
                      <tr
                        key={contact.id}
                        className="border-b border-slate-800/60 hover:bg-slate-800/35"
                      >
                        <td className="px-4 py-3 font-medium text-slate-100">
                          {contact.name}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{type}</td>
                        <td className="px-4 py-3 text-slate-300">{department}</td>
                        <td className="px-4 py-3 text-slate-300">{contact.email || "—"}</td>
                        <td className="px-4 py-3 text-slate-300">{contact.phone || "—"}</td>
                        <td className="px-4 py-3">
                          {isActive === null ? (
                            <span className="text-xs text-slate-500">N/A</span>
                          ) : (
                            <span
                              className={`text-xs px-2 py-1 rounded border ${
                                isActive
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              }`}
                            >
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/contacts/${contact.documentId}`}
                            className="text-indigo-400 hover:text-indigo-300 font-medium"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
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
