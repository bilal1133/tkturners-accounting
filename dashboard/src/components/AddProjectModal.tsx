import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { api } from "../lib/api";
import { X } from "lucide-react";

type AddProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const AddProjectModal = ({
  isOpen,
  onClose,
  onSuccess,
}: AddProjectModalProps) => {
  const { register, handleSubmit, reset } = useForm();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      api
        .get("/contacts")
        .then((res) => setContacts(res.data.data))
        .catch(console.error);
    }
  }, [isOpen]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await api.post("/projects", {
        data: {
          name: data.name,
          description: data.description,
          status: data.status,
          contact: data.contactId ? parseInt(data.contactId) : null,
        },
      });
      reset();
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save project.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Add Project</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Project Name
            </label>
            <input
              required
              {...register("name")}
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Status
              </label>
              <select
                required
                {...register("status")}
                defaultValue="Active"
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Client (Contact)
              </label>
              <select
                {...register("contactId")}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">No Client</option>
                {contacts
                  .filter((c) => c.type === "Customer")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Description
            </label>
            <textarea
              {...register("description")}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
