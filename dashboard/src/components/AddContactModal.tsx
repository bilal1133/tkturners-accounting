import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "../lib/api";
import { X } from "lucide-react";

const contactSchema = z.object({
  type: z.enum(["Employee", "Customer", "Vendor"]),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  salary: z.string().optional().or(z.literal("")),
  position: z.string().optional().or(z.literal("")),
  cnic: z
    .string()
    .max(13, "CNIC must be at most 13 digits")
    .optional()
    .or(z.literal("")),
  joining_date: z.string().optional().or(z.literal("")),
  fuel_allowance: z.string().optional().or(z.literal("")),
  rental_allowance: z.string().optional().or(z.literal("")),
  gym_allowance: z.string().optional().or(z.literal("")),
  company_name: z.string().optional().or(z.literal("")),
  company_vat: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
});

type AddContactModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const AddContactModal = ({
  isOpen,
  onClose,
  onSuccess,
}: AddContactModalProps) => {
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      type: "Employee",
      name: "",
      email: "",
      phone: "",
      // employee fields
      salary: "",
      position: "",
      cnic: "",
      joining_date: "",
      fuel_allowance: "",
      rental_allowance: "",
      gym_allowance: "",
      // customer fields
      company_name: "",
      company_vat: "",
      // vendor & customer
      description: "",
    },
  });

  const [loading, setLoading] = useState(false);
  const selectedType = useWatch({ control, name: "type" });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      let contact_type: any[] = [];

      if (data.type === "Employee") {
        contact_type = [
          {
            __component: "contact-type.employee",
            salary: data.salary ? parseFloat(data.salary) : null,
            position: data.position,
            cnic: data.cnic ? data.cnic : null,
            joining_date: data.joining_date || null,
            fuel_allowance: data.fuel_allowance
              ? parseFloat(data.fuel_allowance)
              : null,
            rental_allowance: data.rental_allowance
              ? parseFloat(data.rental_allowance)
              : null,
            gym_allowance: data.gym_allowance
              ? parseFloat(data.gym_allowance)
              : null,
          },
        ];
      } else if (data.type === "Customer") {
        contact_type = [
          {
            __component: "contact-type.customer",
            company_name: data.company_name,
            company_vat: data.company_vat,
            description: data.description,
          },
        ];
      } else if (data.type === "Vendor") {
        contact_type = [
          {
            __component: "contact-type.vendor",
            description: data.description,
          },
        ];
      }

      await api.post("/contacts", {
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          contact_type: contact_type,
        },
      });

      reset();
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      const strapiErrors = e.response?.data?.error?.details?.errors;
      if (strapiErrors && Array.isArray(strapiErrors)) {
        strapiErrors.forEach((err: any) => {
          // Extract the last part of the path (e.g., "cnic" from ["contact_type", "0", "cnic"])
          const fieldPath = err.path ? err.path[err.path.length - 1] : null;
          if (fieldPath) {
            setError(fieldPath as any, {
              type: "server",
              message: err.message,
            });
          } else {
            alert(err.message);
          }
        });
      } else {
        alert(e.response?.data?.error?.message || "Failed to save contact.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-xl font-semibold text-white">Add Contact</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Name
              </label>
              <input
                {...register("name")}
                className={`w-full bg-slate-800 border ${errors.name ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
              />
              {errors.name && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.name.message as string}
                </p>
              )}
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Contact Category
              </label>
              <select
                {...register("type")}
                className={`w-full bg-slate-800 border ${errors.type ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
              >
                <option value="Customer">Customer</option>
                <option value="Vendor">Vendor</option>
                <option value="Employee">Employee</option>
              </select>
              {errors.type && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.type.message as string}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Email
              </label>
              <input
                type="email"
                {...register("email")}
                className={`w-full bg-slate-800 border ${errors.email ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.email.message as string}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Phone
              </label>
              <input
                type="tel"
                {...register("phone")}
                className={`w-full bg-slate-800 border ${errors.phone ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
              />
              {errors.phone && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.phone.message as string}
                </p>
              )}
            </div>
          </div>

          {/* Dynamic Sections Based on Type */}
          {selectedType === "Employee" && (
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <h3 className="text-sm font-medium text-indigo-400 uppercase tracking-wider">
                Employee Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Job Position
                  </label>
                  <input
                    {...register("position")}
                    placeholder="e.g. Technician"
                    className={`w-full bg-slate-800 border ${errors.position ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.position && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.position.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    CNIC
                  </label>
                  <input
                    type="number"
                    {...register("cnic")}
                    placeholder="13-digit CNIC"
                    className={`w-full bg-slate-800 border ${errors.cnic ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.cnic && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.cnic.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Base Salary
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("salary")}
                    placeholder="0.00"
                    className={`w-full bg-slate-800 border ${errors.salary ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.salary && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.salary.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    {...register("joining_date")}
                    className={`w-full bg-slate-800 border ${errors.joining_date ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.joining_date && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.joining_date.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Fuel Allowance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("fuel_allowance")}
                    placeholder="0.00"
                    className={`w-full bg-slate-800 border ${errors.fuel_allowance ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.fuel_allowance && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.fuel_allowance.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Rental Allowance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("rental_allowance")}
                    placeholder="0.00"
                    className={`w-full bg-slate-800 border ${errors.rental_allowance ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.rental_allowance && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.rental_allowance.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Gym Allowance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("gym_allowance")}
                    placeholder="0.00"
                    className={`w-full bg-slate-800 border ${errors.gym_allowance ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.gym_allowance && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.gym_allowance.message as string}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedType === "Customer" && (
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <h3 className="text-sm font-medium text-indigo-400 uppercase tracking-wider">
                Customer Info
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Company Name
                  </label>
                  <input
                    {...register("company_name")}
                    className={`w-full bg-slate-800 border ${errors.company_name ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.company_name && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.company_name.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    VAT Number
                  </label>
                  <input
                    {...register("company_vat")}
                    className={`w-full bg-slate-800 border ${errors.company_vat ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.company_vat && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.company_vat.message as string}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Description
                  </label>
                  <textarea
                    {...register("description")}
                    rows={3}
                    className={`w-full bg-slate-800 border ${errors.description ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.description && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.description.message as string}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedType === "Vendor" && (
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <h3 className="text-sm font-medium text-indigo-400 uppercase tracking-wider">
                Vendor Info
              </h3>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Description / Services Provided
                </label>
                <textarea
                  {...register("description")}
                  rows={4}
                  className={`w-full bg-slate-800 border ${errors.description ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                />
                {errors.description && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.description.message as string}
                  </p>
                )}
              </div>
            </div>
          )}

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
              {loading ? "Saving..." : "Save Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
