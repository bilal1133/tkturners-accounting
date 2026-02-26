/**
 * contact controller
 */

import { factories } from "@strapi/strapi";

const PHONE_REGEX = /^[0-9+\-()\s]{7,20}$/;
const CNIC_REGEX = /^\d{13}$/;
const BANK_ACCOUNT_REGEX = /^[A-Za-z0-9\-\s]{6,34}$/;

const toNumber = (value: any) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value);
  return Number.NaN;
};

const isNonNegativeNumber = (value: any) => {
  if (value === undefined || value === null || value === "") return true;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) && parsed >= 0;
};

const isValidDateValue = (value: any) => {
  if (value === undefined || value === null || value === "") return true;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const isDateInFuture = (value: any) => {
  if (!isValidDateValue(value) || !value) return false;
  return new Date(value) > new Date();
};

const asTrimmedString = (value: any) =>
  typeof value === "string" ? value.trim() : "";

const validateContactData = (
  data: any,
  options: { requireContactType: boolean },
) => {
  if (!data || typeof data !== "object") {
    return "Missing data payload";
  }

  if ("name" in data && !asTrimmedString(data.name)) {
    return "Name is required";
  }

  if ("email" in data && data.email) {
    const email = asTrimmedString(data.email);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return "Invalid email format";
  }

  if ("phone" in data && data.phone) {
    const phone = asTrimmedString(data.phone);
    if (!PHONE_REGEX.test(phone)) {
      return "Phone must be 7-20 characters and contain only digits or + - ( )";
    }
  }

  const hasContactType = "contact_type" in data;
  if (options.requireContactType && !hasContactType) {
    return "Contact category is required";
  }

  if (!hasContactType) {
    return null;
  }

  if (!Array.isArray(data.contact_type) || data.contact_type.length === 0) {
    return "Contact category is required";
  }

  const component = data.contact_type[0];
  if (!component?.__component) {
    return "Contact category is invalid";
  }

  if (component.__component === "contact-type.employee") {
    if (!asTrimmedString(component.position)) {
      return "Job Position is required for employees";
    }

    if (!asTrimmedString(component.department)) {
      return "Department is required for employees";
    }

    if (component.cnic && !CNIC_REGEX.test(String(component.cnic))) {
      return "CNIC must be exactly 13 digits";
    }

    if (!isNonNegativeNumber(component.salary)) {
      return "Base Salary must be a non-negative number";
    }

    if (!isNonNegativeNumber(component.fuel_allowance)) {
      return "Fuel Allowance must be a non-negative number";
    }

    if (!isNonNegativeNumber(component.rental_allowance)) {
      return "Rental Allowance must be a non-negative number";
    }

    if (!isNonNegativeNumber(component.gym_allowance)) {
      return "Gym Allowance must be a non-negative number";
    }

    if (!isValidDateValue(component.birth_day)) {
      return "Birth Date is invalid";
    }

    if (!isValidDateValue(component.joining_date)) {
      return "Joining Date is invalid";
    }

    if (isDateInFuture(component.birth_day)) {
      return "Birth Date cannot be in the future";
    }

    if (isDateInFuture(component.joining_date)) {
      return "Joining Date cannot be in the future";
    }

    if (
      component.birth_day &&
      component.joining_date &&
      new Date(component.joining_date) < new Date(component.birth_day)
    ) {
      return "Joining Date cannot be earlier than Birth Date";
    }

    if (
      component.bank_account &&
      !BANK_ACCOUNT_REGEX.test(String(component.bank_account))
    ) {
      return "Bank account must be 6-34 characters (letters, numbers, spaces, -)";
    }

    if (
      component.address &&
      String(component.address).trim().length > 200
    ) {
      return "Address must be at most 200 characters";
    }

    return null;
  }

  if (component.__component === "contact-type.customer") {
    if (!asTrimmedString(component.company_name)) {
      return "Company Name is required for customers";
    }
    return null;
  }

  if (component.__component === "contact-type.vendor") {
    return null;
  }

  return "Contact category is invalid";
};

export default factories.createCoreController(
  "api::contact.contact",
  () => ({
    async create(ctx) {
      const error = validateContactData(ctx.request.body?.data, {
        requireContactType: true,
      });
      if (error) return ctx.badRequest(error);

      return super.create(ctx);
    },

    async update(ctx) {
      const error = validateContactData(ctx.request.body?.data, {
        requireContactType: false,
      });
      if (error) return ctx.badRequest(error);

      return super.update(ctx);
    },
  }),
);
