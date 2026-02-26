import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "../lib/api";
import { currencyLabel } from "../lib/currency";
import { X } from "lucide-react";

const optionalDateField = (label: string) =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || !Number.isNaN(new Date(value).getTime()),
      `${label} is invalid`,
    )
    .refine(
      (value) => !value || new Date(value) <= new Date(),
      `${label} cannot be in the future`,
    );

const optionalNonNegativeNumber = (label: string) =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) =>
        !value ||
        (Number.isFinite(Number.parseFloat(value)) &&
          Number.parseFloat(value) >= 0),
      `${label} must be a non-negative number`,
    );

const contactSchema = z
  .object({
    type: z.enum(["Employee", "Customer", "Vendor"]),
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().email("Invalid email format").optional().or(z.literal("")),
    phone: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (value) => !value || /^[0-9+\-()\s]{7,20}$/.test(value),
        "Phone must be 7-20 characters and contain only digits or + - ( )",
      ),
    salary: optionalNonNegativeNumber("Base Salary"),
    position: z.string().optional().or(z.literal("")),
    cnic: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (value) => !value || /^\d{13}$/.test(value),
        "CNIC must be exactly 13 digits",
      ),
    birth_day: optionalDateField("Birth Date"),
    joining_date: optionalDateField("Joining Date"),
    address: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (value) => !value || value.trim().length <= 200,
        "Address must be at most 200 characters",
      ),
    bank_account: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (value) => !value || /^[A-Za-z0-9\-\s]{6,34}$/.test(value),
        "Bank account must be 6-34 characters (letters, numbers, spaces, -)",
      ),
    active: z.boolean().default(true),
    department: z.string().optional().or(z.literal("")),
    fuel_allowance: optionalNonNegativeNumber("Fuel Allowance"),
    rental_allowance: optionalNonNegativeNumber("Rental Allowance"),
    gym_allowance: optionalNonNegativeNumber("Gym Allowance"),
    currency: z.string().optional().or(z.literal("")),
    company_name: z.string().optional().or(z.literal("")),
    company_vat: z.string().optional().or(z.literal("")),
    description: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.birth_day && data.joining_date) {
      const birth = new Date(data.birth_day);
      const joining = new Date(data.joining_date);
      if (joining < birth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["joining_date"],
          message: "Joining Date cannot be earlier than Birth Date",
        });
      }
    }

    if (data.type === "Employee") {
      if (!data.position?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["position"],
          message: "Job Position is required for employees",
        });
      }

      if (!data.department?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["department"],
          message: "Department is required for employees",
        });
      }
    }

    if (data.type === "Customer" && !data.company_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["company_name"],
        message: "Company Name is required for customers",
      });
    }
  });

type EditContactModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contactId: string | number;
  contactData: any;
};

export const EditContactModal = ({
  isOpen,
  onClose,
  onSuccess,
  contactId,
  contactData,
}: EditContactModalProps) => {
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    setValue,
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
      birth_day: "",
      joining_date: "",
      address: "",
      bank_account: "",
      active: true,
      department: "",
      fuel_allowance: "",
      rental_allowance: "",
      gym_allowance: "",
      currency: "",
      // customer fields
      company_name: "",
      company_vat: "",
      // vendor & customer
      description: "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const selectedType = useWatch({ control, name: "type" });

  useEffect(() => {
    if (isOpen) {
      api
        .get("/currencies")
        .then((res) => {
          setCurrencies(res.data.data);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Re-apply currency after currencies list loads (fixes race condition where
  // reset() runs before currencies are fetched, leaving the select blank)
  useEffect(() => {
    if (!isOpen || !contactData || currencies.length === 0) return;
    const specificData =
      contactData.contact_type && contactData.contact_type.length > 0
        ? contactData.contact_type[0]
        : {};
    if (specificData.currency) {
      const currencyId =
        typeof specificData.currency === "object"
          ? specificData.currency.id?.toString() || ""
          : specificData.currency.toString();
      if (currencyId) setValue("currency", currencyId);
    }
  }, [currencies, isOpen, contactData, setValue]);

  useEffect(() => {
    if (isOpen && contactData) {
      const getContactType = (data: any) => {
        if (data.contact_type && data.contact_type.length > 0) {
          const comp = data.contact_type[0].__component;
          if (comp === "contact-type.employee") return "Employee";
          if (comp === "contact-type.vendor") return "Vendor";
          if (comp === "contact-type.customer") return "Customer";
        }
        return "Employee";
      };
      const cType = getContactType(contactData);
      const specificData =
        contactData.contact_type && contactData.contact_type.length > 0
          ? contactData.contact_type[0]
          : {};

      reset({
        type: cType as any,
        name: contactData.name || "",
        email: contactData.email || "",
        phone: contactData.phone || "",
        salary: specificData.salary ? specificData.salary.toString() : "",
        position: specificData.position || "",
        cnic: specificData.cnic ? specificData.cnic.toString() : "",
        birth_day: specificData.birth_day || "",
        joining_date: specificData.joining_date || "",
        address: specificData.address || "",
        bank_account: specificData.bank_account || "",
        active: specificData.active ?? true,
        department: specificData.department || "",
        fuel_allowance: specificData.fuel_allowance
          ? specificData.fuel_allowance.toString()
          : "",
        rental_allowance: specificData.rental_allowance
          ? specificData.rental_allowance.toString()
          : "",
        gym_allowance: specificData.gym_allowance
          ? specificData.gym_allowance.toString()
          : "",
        currency: specificData.currency
          ? typeof specificData.currency === "object"
            ? specificData.currency.id?.toString() || ""
            : specificData.currency.toString()
          : "",
        company_name: specificData.company_name || "",
        company_vat: specificData.company_vat || "",
        description: specificData.description || "",
      });
    }
  }, [isOpen, contactData, reset]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      let contact_type: any[] = [];

      if (data.type === "Employee") {
        // Preserve existing loans from the contact data
        const existingEmployee = contactData.contact_type?.find(
          (c: any) => c.__component === "contact-type.employee",
        );

        contact_type = [
          {
            __component: "contact-type.employee",
            salary: data.salary ? parseFloat(data.salary) : null,
            position: data.position,
            cnic: data.cnic ? data.cnic : null,
            birth_day: data.birth_day || null,
            joining_date: data.joining_date || null,
            address: data.address || null,
            bank_account: data.bank_account || null,
            active: data.active,
            department: data.department || null,
            fuel_allowance: data.fuel_allowance
              ? parseFloat(data.fuel_allowance)
              : null,
            rental_allowance: data.rental_allowance
              ? parseFloat(data.rental_allowance)
              : null,
            gym_allowance: data.gym_allowance
              ? parseFloat(data.gym_allowance)
              : null,
            currency: data.currency ? Number(data.currency) : null,
            ...(existingEmployee?.loans && {
              loans: {
                set: existingEmployee.loans.map((l: any) => l.id || l),
              },
            }),
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

      await api.put(`/contacts/${contactId}`, {
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
      console.error("Error updating contact:", e);
      console.error("Response data:", e.response?.data);
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
          <h2 className="text-xl font-semibold text-white">Edit Contact</h2>
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
                    type="text"
                    inputMode="numeric"
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
                    Birth Date
                  </label>
                  <input
                    type="date"
                    {...register("birth_day")}
                    className={`w-full bg-slate-800 border ${errors.birth_day ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.birth_day && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.birth_day.message as string}
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
                    Currency
                  </label>
                  <select
                    {...register("currency")}
                    className={`w-full bg-slate-800 border ${errors.currency ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  >
                    <option value="">System Default</option>
                    {currencies.map((curr) => (
                      <option key={curr.id} value={curr.id}>
                        {currencyLabel(curr)}
                      </option>
                    ))}
                  </select>
                  {errors.currency && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.currency.message as string}
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
                    Department
                  </label>
                  <select
                    {...register("department")}
                    className={`w-full bg-slate-800 border ${errors.department ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  >
                    <option value="">Select Department...</option>
                    <option value="Management">Management</option>
                    <option value="Engineering">Engineering</option>
                    <option value="HouseKeeping">HouseKeeping</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Bussiness Development">
                      Business Development
                    </option>
                  </select>
                  {errors.department && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.department.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Bank Account
                  </label>
                  <input
                    type="text"
                    {...register("bank_account")}
                    placeholder="e.g. PK12ABCD1234567890"
                    className={`w-full bg-slate-800 border ${errors.bank_account ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.bank_account && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.bank_account.message as string}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Address
                  </label>
                  <textarea
                    {...register("address")}
                    rows={2}
                    placeholder="Current address"
                    className={`w-full bg-slate-800 border ${errors.address ? "border-red-500" : "border-slate-700"} rounded-md p-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                  {errors.address && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.address.message as string}
                    </p>
                  )}
                </div>
                <div className="flex items-center mt-8">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-400">
                    <input
                      type="checkbox"
                      {...register("active")}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                    />
                    Active Employee
                  </label>
                  {errors.active && (
                    <p className="text-red-400 text-xs ml-2">
                      {errors.active.message as string}
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
              {loading ? "Saving..." : "Update Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
