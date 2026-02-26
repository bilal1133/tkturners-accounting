import { factories } from "@strapi/strapi";

const EPSILON = 0.01;

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value);
  return Number.NaN;
};

const toNullableNumber = (value: unknown) => {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNullableString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const almostEqual = (a: number, b: number) => Math.abs(a - b) <= EPSILON;

const isValidDate = (value: unknown) => {
  if (!value) return false;
  return !Number.isNaN(new Date(String(value)).getTime());
};

const asArray = <T>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);

const relationId = (value: any) => {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  if (typeof value === "object" && Number.isInteger(value.id)) return value.id;
  return null;
};

const relationDocumentId = (value: any) => {
  if (!value || typeof value !== "object") return null;
  return typeof value.documentId === "string" ? value.documentId : null;
};

const normalizeRelationInput = (value: any) => {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "object") {
    const id = relationId(value);
    if (id !== null) return id;

    const documentId = relationDocumentId(value);
    if (documentId) {
      return { documentId };
    }

    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isInteger(parsed) ? parsed : null;
    }

    return { documentId: trimmed };
  }

  const id = relationId(value);
  if (id !== null) return id;

  return null;
};

const PAYROLL_POPULATE = {
  employee_details: {
    populate: [
      "contact",
      "payee_account",
      "payee_account.currency",
      "loan_ref",
      "salary_transaction",
      "loan_repayment_transaction",
    ],
  },
};

const getEmployeeComponent = (contact: any) =>
  asArray<any>(contact?.contact_type).find(
    (entry) => entry.__component === "contact-type.employee",
  ) || null;

const getEmployeeCurrency = (contact: any) => getEmployeeComponent(contact)?.currency || null;

const getCurrencyMeta = (currency: any) => ({
  id: currency?.id || null,
  code: currency?.code || currency?.Code || "",
  name: currency?.name || currency?.Name || "",
  symbol: currency?.symbol || currency?.Symbol || "",
});

const decoratePayroll = (payroll: any) => {
  const totalsByCurrency = new Map<
    string,
    {
      currency_id: number | null;
      code: string;
      name: string;
      symbol: string;
      total_net: number;
      employee_count: number;
    }
  >();

  const slips = asArray<any>(payroll.employee_details);

  slips.forEach((slip) => {
    const sourceCurrency = slip?.payee_account?.currency || getEmployeeCurrency(slip?.contact);
    const currency = getCurrencyMeta(sourceCurrency);

    const key = `${currency.id || "none"}:${currency.code || ""}:${currency.symbol || ""}:${currency.name || ""}`;
    const existing = totalsByCurrency.get(key);

    const net =
      toNullableNumber(slip?.converted_net_pay) ??
      toNullableNumber(slip?.net_pay) ??
      0;

    if (existing) {
      existing.total_net = round2(existing.total_net + net);
      existing.employee_count += 1;
      return;
    }

    totalsByCurrency.set(key, {
      currency_id: currency.id,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      total_net: round2(net),
      employee_count: 1,
    });
  });

  return {
    ...payroll,
    total_employees: slips.length,
    total_net_pay: round2(
      slips.reduce((sum, slip) => {
        const net =
          toNullableNumber(slip?.converted_net_pay) ??
          toNullableNumber(slip?.net_pay) ??
          0;
        return sum + net;
      }, 0),
    ),
    totals_by_currency: Array.from(totalsByCurrency.values()),
  };
};

const normalizeDraftSlip = (raw: any, batchStatus: "draft" | "processed" = "draft") => {
  const grossInput = toNullableNumber(raw?.gross_pay);
  const deduction = round2(Math.max(0, toNullableNumber(raw?.loan_amount_to_deduct) ?? 0));
  const contact = normalizeRelationInput(raw?.contact);
  const payeeAccount = normalizeRelationInput(raw?.payee_account);
  const loanRef = normalizeRelationInput(raw?.loan_ref);
  const salaryTransaction = normalizeRelationInput(raw?.salary_transaction);
  const loanRepaymentTransaction = normalizeRelationInput(raw?.loan_repayment_transaction);

  const derivedGross = round2(
    (toNullableNumber(raw?.net_pay) ?? 0) + (toNullableNumber(raw?.loan_amount_to_deduct) ?? 0),
  );

  const gross = round2(Math.max(0, grossInput ?? derivedGross));
  const net = round2(
    toNullableNumber(raw?.net_pay) ?? Math.max(0, gross - deduction),
  );
  const employeeName =
    toNullableString(raw?.employee_name) || toNullableString(raw?.contact?.name);

  return {
    employee_name: employeeName,
    ...(contact ? { contact } : {}),
    ...(payeeAccount ? { payee_account: payeeAccount } : {}),
    ...(loanRef ? { loan_ref: loanRef } : {}),
    bonus: toNullableNumber(raw?.bonus),
    overtime_amount: toNullableNumber(raw?.overtime_amount),
    fuel_allowance: toNullableNumber(raw?.fuel_allowance),
    gym_allowance: toNullableNumber(raw?.gym_allowance),
    rental_allowance: toNullableNumber(raw?.rental_allowance),
    gross_pay: gross,
    loan_amount_to_deduct: deduction,
    net_pay: net,
    converted_gross_pay: toNullableNumber(raw?.converted_gross_pay),
    converted_loan_deduction: toNullableNumber(raw?.converted_loan_deduction),
    converted_net_pay: toNullableNumber(raw?.converted_net_pay),
    payroll_status: batchStatus,
    ...(salaryTransaction ? { salary_transaction: salaryTransaction } : {}),
    ...(loanRepaymentTransaction
      ? { loan_repayment_transaction: loanRepaymentTransaction }
      : {}),
  };
};

const csvCell = (value: unknown) => {
  const str = value === null || value === undefined ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
};

export default factories.createCoreController(
  "api::payroll.payroll",
  ({ strapi }) => {
    const findPayrollByIdentifier = async (idOrDocumentId: string) => {
      const fromDocument = await strapi.entityService.findMany("api::payroll.payroll", {
        filters: { documentId: { $eq: idOrDocumentId } },
        populate: PAYROLL_POPULATE,
        limit: 1,
      } as any);

      if (fromDocument?.[0]) return fromDocument[0] as any;

      const numericId = Number.parseInt(idOrDocumentId, 10);
      if (!Number.isInteger(numericId)) return null;

      try {
        return (await strapi.entityService.findOne("api::payroll.payroll", numericId, {
          populate: PAYROLL_POPULATE,
        } as any)) as any;
      } catch {
        return null;
      }
    };

    const ensurePublished = async (
      uid: string,
      id: number | string,
      existing?: any,
    ) => {
      const entry =
        existing ??
        (await (strapi.entityService as any).findOne(uid, id, {
          fields: ["id", "documentId", "publishedAt"],
        }));

      if (!entry) return null;
      if (entry.publishedAt) return entry;

      return (strapi.entityService as any).update(uid, id, {
        data: { publishedAt: new Date() },
      });
    };

    const getOrCreateCategory = async (name: string) => {
      const found = await strapi.entityService.findMany("api::category.category", {
        filters: { name: { $eq: name } },
        fields: ["id", "documentId", "publishedAt", "name"],
        limit: 1,
      } as any);

      if (found?.[0]) {
        return ensurePublished("api::category.category", found[0].id, found[0]);
      }

      return strapi.entityService.create("api::category.category", {
        data: {
          name,
          publishedAt: new Date(),
        },
      } as any);
    };

    const runInTransaction = async <T>(
      callback: (trx: any) => Promise<T>,
    ): Promise<T> => {
      const connection = (strapi.db as any)?.connection;
      if (!connection?.transaction) {
        return callback(null);
      }

      return connection.transaction(async (trx: any) => callback(trx));
    };

    const tableExistsCache = new Map<string, boolean>();
    const hasTable = async (connection: any, tableName: string) => {
      const cached = tableExistsCache.get(tableName);
      if (cached !== undefined) return cached;

      try {
        const exists = await connection.schema.hasTable(tableName);
        tableExistsCache.set(tableName, Boolean(exists));
        return Boolean(exists);
      } catch {
        tableExistsCache.set(tableName, false);
        return false;
      }
    };

    const hydrateEmployeeFallbacks = async (payrollOrPayrolls: any) => {
      const payrolls = Array.isArray(payrollOrPayrolls)
        ? payrollOrPayrolls
        : [payrollOrPayrolls].filter(Boolean);
      if (payrolls.length === 0) return;

      const employeeComponentIds = new Set<number>();
      payrolls.forEach((payroll) => {
        asArray<any>(payroll?.employee_details).forEach((slip) => {
          const componentId = relationId(slip?.id);
          if (componentId !== null) {
            employeeComponentIds.add(componentId);
          }
        });
      });

      if (employeeComponentIds.size === 0) return;

      const connection = (strapi.db as any)?.connection;
      if (!connection) return;

      const componentIds = Array.from(employeeComponentIds);

      let contactRows: any[] = [];
      if (await hasTable(connection, "components_employee_employees_contact_lnk")) {
        let query = connection("components_employee_employees_contact_lnk as l")
          .leftJoin("contacts as c", "c.id", "l.contact_id")
          .select(
            "l.employee_id as employee_id",
            "c.id as contact_id",
            "c.document_id as contact_document_id",
            "c.name as contact_name",
          )
          .whereIn("l.employee_id", componentIds);

        if (
          (await hasTable(connection, "contacts_cmps")) &&
          (await hasTable(connection, "components_contact_type_employees_currency_lnk"))
        ) {
          query = query
            .leftJoin("contacts_cmps as cc", function joinContactEmployeeType(this: any) {
              this.on("cc.entity_id", "=", "c.id")
                .andOn("cc.component_type", "=", connection.raw("?", ["contact-type.employee"]))
                .andOn("cc.field", "=", connection.raw("?", ["contact_type"]));
            })
            .leftJoin(
              "components_contact_type_employees_currency_lnk as cec",
              "cec.employee_id",
              "cc.cmp_id",
            )
            .leftJoin("currencies as emp_cur", "emp_cur.id", "cec.currency_id")
            .select(
              "emp_cur.id as employee_currency_id",
              "emp_cur.document_id as employee_currency_document_id",
              "emp_cur.code as employee_currency_code",
              "emp_cur.name as employee_currency_name",
              "emp_cur.symbol as employee_currency_symbol",
            );
        }

        contactRows = await query;
      }

      const payeeRows =
        (await hasTable(connection, "components_employee_employees_payee_account_lnk"))
        && (await hasTable(connection, "accounts_currency_lnk"))
          ? await connection("components_employee_employees_payee_account_lnk as l")
              .leftJoin("accounts as a", "a.id", "l.account_id")
              .leftJoin("accounts_currency_lnk as acl", "acl.account_id", "a.id")
              .leftJoin("currencies as cur", "cur.id", "acl.currency_id")
              .select(
                "l.employee_id as employee_id",
                "a.id as account_id",
                "a.document_id as account_document_id",
                "a.name as account_name",
                "cur.id as currency_id",
                "cur.document_id as currency_document_id",
                "cur.code as currency_code",
                "cur.name as currency_name",
                "cur.symbol as currency_symbol",
              )
              .whereIn("l.employee_id", componentIds)
          : [];

      const loanRows =
        (await hasTable(connection, "components_employee_employees_loan_ref_lnk"))
          ? await connection("components_employee_employees_loan_ref_lnk as l")
              .leftJoin("loans as loan", "loan.id", "l.loan_id")
              .select(
                "l.employee_id as employee_id",
                "loan.id as loan_id",
                "loan.document_id as loan_document_id",
                "loan.status as loan_status",
                "loan.remaining_balance as loan_remaining_balance",
              )
              .whereIn("l.employee_id", componentIds)
          : [];

      const contactByComponentId = new Map<number, any>();
      const contactByContactId = new Map<number, any>();
      asArray<any>(contactRows).forEach((row) => {
        const key = relationId(row?.employee_id);
        if (key !== null && !contactByComponentId.has(key)) {
          contactByComponentId.set(key, row);
        }

        const contactId = relationId(row?.contact_id);
        if (contactId !== null && !contactByContactId.has(contactId)) {
          contactByContactId.set(contactId, row);
        }
      });

      const payeeByComponentId = new Map<number, any>();
      const payeeByAccountId = new Map<number, any>();
      asArray<any>(payeeRows).forEach((row) => {
        const key = relationId(row?.employee_id);
        if (key !== null && !payeeByComponentId.has(key)) {
          payeeByComponentId.set(key, row);
        }

        const accountId = relationId(row?.account_id);
        if (accountId !== null && !payeeByAccountId.has(accountId)) {
          payeeByAccountId.set(accountId, row);
        }
      });

      const loanByComponentId = new Map<number, any>();
      const loanByLoanId = new Map<number, any>();
      asArray<any>(loanRows).forEach((row) => {
        const key = relationId(row?.employee_id);
        if (key !== null && !loanByComponentId.has(key)) {
          loanByComponentId.set(key, row);
        }

        const loanId = relationId(row?.loan_id);
        if (loanId !== null && !loanByLoanId.has(loanId)) {
          loanByLoanId.set(loanId, row);
        }
      });

      payrolls.forEach((payroll) => {
        asArray<any>(payroll?.employee_details).forEach((slip) => {
          const componentId = relationId(slip?.id);
          if (componentId === null) return;

          const currentContactId = relationId(slip?.contact);
          const linkedContact =
            (currentContactId !== null ? contactByContactId.get(currentContactId) : null) ||
            contactByComponentId.get(componentId);
          if (linkedContact) {
            const employeeCurrency = linkedContact?.employee_currency_id
              ? {
                  id: linkedContact.employee_currency_id,
                  documentId: linkedContact.employee_currency_document_id || null,
                  code: linkedContact.employee_currency_code || null,
                  name: linkedContact.employee_currency_name || null,
                  symbol: linkedContact.employee_currency_symbol || null,
                }
              : null;

            if (!toNullableString(slip?.employee_name)) {
              slip.employee_name = toNullableString(linkedContact?.contact_name);
            }

            if (!slip?.contact || typeof slip?.contact !== "object") {
              slip.contact = {
                id: linkedContact.contact_id,
                documentId: linkedContact.contact_document_id || null,
                name: linkedContact.contact_name || null,
                contact_type: employeeCurrency
                  ? [
                      {
                        __component: "contact-type.employee",
                        currency: employeeCurrency,
                      },
                    ]
                  : [],
              };
            } else if (
              employeeCurrency &&
              !Array.isArray(slip.contact.contact_type)
            ) {
              slip.contact = {
                ...slip.contact,
                contact_type: [
                  {
                    __component: "contact-type.employee",
                    currency: employeeCurrency,
                  },
                ],
              };
            }
          }

          const currentAccountId = relationId(slip?.payee_account);
          const linkedPayee =
            (currentAccountId !== null ? payeeByAccountId.get(currentAccountId) : null) ||
            payeeByComponentId.get(componentId);
          if (linkedPayee?.account_id) {
            const accountPayload = {
              id: linkedPayee.account_id,
              documentId: linkedPayee.account_document_id || null,
              name: linkedPayee.account_name || null,
              currency: linkedPayee.currency_id
                ? {
                    id: linkedPayee.currency_id,
                    documentId: linkedPayee.currency_document_id || null,
                    code: linkedPayee.currency_code || null,
                    name: linkedPayee.currency_name || null,
                    symbol: linkedPayee.currency_symbol || null,
                  }
                : null,
            };

            if (!slip?.payee_account || typeof slip?.payee_account !== "object") {
              slip.payee_account = accountPayload;
            } else if (!slip.payee_account.currency && accountPayload.currency) {
              slip.payee_account = {
                ...slip.payee_account,
                currency: accountPayload.currency,
              };
            }
          }

          const currentLoanId = relationId(slip?.loan_ref);
          const linkedLoan =
            (currentLoanId !== null ? loanByLoanId.get(currentLoanId) : null) ||
            loanByComponentId.get(componentId);
          if (linkedLoan?.loan_id && (!slip?.loan_ref || typeof slip?.loan_ref !== "object")) {
            slip.loan_ref = {
              id: linkedLoan.loan_id,
              documentId: linkedLoan.loan_document_id || null,
              status: linkedLoan.loan_status || null,
              remaining_balance: toNullableNumber(linkedLoan.loan_remaining_balance) ?? 0,
            };
          }
        });
      });
    };

    return {
      async create(ctx) {
        const payload = ctx.request.body?.data;

        if (!payload || typeof payload !== "object") {
          return ctx.badRequest("Missing data payload");
        }

        if (!isValidDate(payload.pay_period_start) || !isValidDate(payload.pay_period_end)) {
          return ctx.badRequest("Pay period start and end dates are required");
        }

        if (!isValidDate(payload.pay_date)) {
          return ctx.badRequest("Pay date is required");
        }

        if (new Date(payload.pay_period_start) > new Date(payload.pay_period_end)) {
          return ctx.badRequest("pay_period_start cannot be later than pay_period_end");
        }

        const employeeDetails = asArray<any>(payload.employee_details).map((raw) =>
          normalizeDraftSlip(raw, "draft"),
        );

        const created = await (strapi.entityService as any).create(
          "api::payroll.payroll",
          {
            data: {
              pay_period_start: payload.pay_period_start,
              pay_period_end: payload.pay_period_end,
              pay_date: payload.pay_date,
              payroll_status: "draft",
              ledger_synced: true,
              employee_details: employeeDetails,
            },
            populate: PAYROLL_POPULATE,
          },
        );

        await hydrateEmployeeFallbacks(created);
        return { data: decoratePayroll(created) };
      },

      async find(ctx) {
        const originalPopulate = (ctx.query as any)?.populate;
        (ctx.query as any).populate = "*";

        const response = await super.find(ctx);
        await hydrateEmployeeFallbacks(asArray<any>(response?.data));

        (ctx.query as any).populate = originalPopulate;

        return {
          ...response,
          data: asArray<any>(response?.data).map((row) => decoratePayroll(row)),
        };
      },

      async findOne(ctx, next) {
        return this.findOneDetailed(ctx, next);
      },

      async findOneDetailed(ctx) {
        const { id } = ctx.params;
        const payroll = await findPayrollByIdentifier(String(id));

        if (!payroll) {
          return ctx.notFound("Payroll batch not found");
        }

        await hydrateEmployeeFallbacks(payroll);

        return { data: decoratePayroll(payroll) };
      },

      async update(ctx) {
        const { id } = ctx.params;
        const existing = await findPayrollByIdentifier(String(id));

        if (!existing) {
          return ctx.notFound("Payroll batch not found");
        }

        const payload = ctx.request.body?.data;
        if (!payload || typeof payload !== "object") {
          return ctx.badRequest("Missing data payload");
        }

        const updateData: Record<string, any> = {};
        const editableFields = ["pay_period_start", "pay_period_end", "pay_date", "employee_details"];
        editableFields.forEach((field) => {
          if (field in payload) {
            updateData[field] = payload[field];
          }
        });

        if ("payroll_status" in payload) {
          updateData.payroll_status = payload.payroll_status;
        }

        if ("ledger_synced" in payload) {
          updateData.ledger_synced = payload.ledger_synced;
        }

        const startDate = updateData.pay_period_start || existing.pay_period_start;
        const endDate = updateData.pay_period_end || existing.pay_period_end;
        const payDate = updateData.pay_date || existing.pay_date;

        if (!isValidDate(startDate) || !isValidDate(endDate) || !isValidDate(payDate)) {
          return ctx.badRequest("Invalid payroll date values");
        }

        if (new Date(startDate) > new Date(endDate)) {
          return ctx.badRequest("pay_period_start cannot be later than pay_period_end");
        }

        if (
          updateData.payroll_status &&
          updateData.payroll_status === "processed" &&
          existing.payroll_status !== "processed"
        ) {
          return ctx.badRequest("Use /payrolls/:id/process to process a batch");
        }

        if (updateData.employee_details) {
          const status = existing.payroll_status === "processed" ? "processed" : "draft";
          const existingDetails = asArray<any>(existing.employee_details);
          const existingById = new Map<number, any>();
          existingDetails.forEach((detail) => {
            const detailId = relationId(detail?.id);
            if (detailId !== null) {
              existingById.set(detailId, detail);
            }
          });

          updateData.employee_details = asArray<any>(updateData.employee_details).map(
            (raw, index) => {
            const rawId = relationId(raw?.id);
            const current =
              (rawId !== null ? existingById.get(rawId) : null) || existingDetails[index] || {};
            const merged = {
              ...current,
              ...raw,
              id: raw?.id ?? current?.id ?? null,
              contact: raw?.contact ?? current?.contact ?? null,
              payee_account: raw?.payee_account ?? current?.payee_account ?? null,
              loan_ref: raw?.loan_ref ?? current?.loan_ref ?? null,
              salary_transaction:
                raw?.salary_transaction ?? current?.salary_transaction ?? null,
              loan_repayment_transaction:
                raw?.loan_repayment_transaction ??
                current?.loan_repayment_transaction ??
                null,
            };

            return normalizeDraftSlip(merged, status);
            },
          );
        }

        if (
          existing.payroll_status === "processed" &&
          ["pay_period_start", "pay_period_end", "pay_date", "employee_details"].some(
            (field) => field in updateData,
          )
        ) {
          updateData.ledger_synced = false;
        }

        const updated = await (strapi.entityService as any).update(
          "api::payroll.payroll",
          existing.id,
          {
            data: updateData,
            populate: PAYROLL_POPULATE,
          },
        );

        await hydrateEmployeeFallbacks(updated);
        return { data: decoratePayroll(updated) };
      },

      async delete(ctx) {
        const { id } = ctx.params;
        const existing = await findPayrollByIdentifier(String(id));

        if (!existing) {
          return ctx.notFound("Payroll batch not found");
        }

        if (existing.payroll_status !== "draft") {
          return ctx.badRequest("Only draft payroll batches can be deleted");
        }

        await (strapi.entityService as any).delete("api::payroll.payroll", existing.id);

        return {
          data: {
            id: existing.id,
            documentId: existing.documentId,
            pay_period_start: existing.pay_period_start,
            pay_period_end: existing.pay_period_end,
            pay_date: existing.pay_date,
            payroll_status: existing.payroll_status,
          },
        };
      },

      async process(ctx) {
        const { id } = ctx.params;

        const payroll = await findPayrollByIdentifier(String(id));
        if (!payroll) {
          return ctx.notFound("Payroll batch not found");
        }

        await hydrateEmployeeFallbacks(payroll);

        if (payroll.payroll_status === "processed") {
          return ctx.badRequest("Payroll batch has already been processed");
        }

        const slips = asArray<any>(payroll.employee_details);
        if (slips.length === 0) {
          return ctx.badRequest("Payroll batch has no employee rows");
        }

        const errors: Array<{ row: number; field: string; message: string }> = [];

        const prepared = slips.map((slip, index) => {
          const row = index + 1;
          const gross = round2(toNullableNumber(slip.gross_pay) ?? 0);
          const deduction = round2(toNullableNumber(slip.loan_amount_to_deduct) ?? 0);
          const net = round2(toNullableNumber(slip.net_pay) ?? 0);

          if (!slip.contact) {
            errors.push({ row, field: "contact", message: "Employee is required" });
          }

          if (!slip.payee_account) {
            errors.push({ row, field: "payee_account", message: "Payee account is required" });
          }

          if (!(gross > 0)) {
            errors.push({ row, field: "gross_pay", message: "gross_pay must be greater than 0" });
          }

          if (deduction < 0) {
            errors.push({
              row,
              field: "loan_amount_to_deduct",
              message: "loan_amount_to_deduct cannot be negative",
            });
          }

          if (!almostEqual(net, gross - deduction)) {
            errors.push({
              row,
              field: "net_pay",
              message: "net_pay must equal gross_pay - loan_amount_to_deduct",
            });
          }

          if (!(net > 0)) {
            errors.push({ row, field: "net_pay", message: "net_pay must be greater than 0" });
          }

          const employeeCurrency = getCurrencyMeta(getEmployeeCurrency(slip.contact));
          const payoutCurrency = getCurrencyMeta(slip?.payee_account?.currency);

          const crossCurrency =
            employeeCurrency.id !== null &&
            payoutCurrency.id !== null &&
            employeeCurrency.id !== payoutCurrency.id;

          const convertedGross = toNullableNumber(slip.converted_gross_pay);
          const convertedDeduction = toNullableNumber(slip.converted_loan_deduction);
          const convertedNet = toNullableNumber(slip.converted_net_pay);

          if (crossCurrency) {
            if (convertedGross === null || !(convertedGross > 0)) {
              errors.push({
                row,
                field: "converted_gross_pay",
                message:
                  "converted_gross_pay is required and must be > 0 for cross-currency payroll",
              });
            }

            if (convertedDeduction === null || convertedDeduction < 0) {
              errors.push({
                row,
                field: "converted_loan_deduction",
                message:
                  "converted_loan_deduction is required and cannot be negative for cross-currency payroll",
              });
            }

            if (convertedNet === null || !(convertedNet > 0)) {
              errors.push({
                row,
                field: "converted_net_pay",
                message:
                  "converted_net_pay is required and must be > 0 for cross-currency payroll",
              });
            }

            if (
              convertedGross !== null &&
              convertedDeduction !== null &&
              convertedNet !== null &&
              !almostEqual(convertedNet, convertedGross - convertedDeduction)
            ) {
              errors.push({
                row,
                field: "converted_net_pay",
                message:
                  "converted_net_pay must equal converted_gross_pay - converted_loan_deduction",
              });
            }
          }

          const postingGross = round2(crossCurrency ? convertedGross ?? 0 : gross);
          const postingDeduction = round2(crossCurrency ? convertedDeduction ?? 0 : deduction);

          if (deduction > 0) {
            if (!slip.loan_ref) {
              errors.push({
                row,
                field: "loan_ref",
                message: "loan_ref is required when loan_amount_to_deduct is greater than 0",
              });
            } else {
              const remaining = round2(toNullableNumber(slip.loan_ref.remaining_balance) ?? 0);
              if (deduction > remaining + EPSILON) {
                errors.push({
                  row,
                  field: "loan_amount_to_deduct",
                  message: "loan_amount_to_deduct cannot exceed loan remaining balance",
                });
              }
            }
          }

          return {
            row,
            slip,
            gross,
            deduction,
            net,
            postingGross,
            postingDeduction,
            crossCurrency,
            convertedGross: crossCurrency ? round2(convertedGross ?? 0) : null,
            convertedDeduction: crossCurrency ? round2(convertedDeduction ?? 0) : null,
            convertedNet: crossCurrency ? round2(convertedNet ?? 0) : null,
            contact: slip.contact,
            account: slip.payee_account,
            loan: slip.loan_ref || null,
          };
        });

        if (errors.length > 0) {
          return ctx.badRequest("Payroll validation failed", { errors });
        }

        const payrollCategory = await getOrCreateCategory("Payroll");
        const loanCategory = await getOrCreateCategory("Loan");

        if (!payrollCategory || !loanCategory) {
          return ctx.internalServerError("Failed to resolve payroll categories");
        }

        try {
          await runInTransaction(async (trx) => {
            const updatedDetails = [];

            for (const row of prepared) {
              const contactDocId = relationDocumentId(row.contact);
              const accountId = relationId(row.account);
              const payoutCurrencyId = relationId(row.account?.currency);

              const salaryTx = await (strapi.entityService as any).create(
                "api::transaction.transaction",
                {
                  data: {
                    date_time: new Date(payroll.pay_date),
                    note: `Payroll Salary (${payroll.pay_period_start} to ${payroll.pay_period_end})`,
                    payment_type: "Transfer",
                    category: payrollCategory.documentId
                      ? { documentId: payrollCategory.documentId }
                      : payrollCategory.id,
                    contact: contactDocId ? { documentId: contactDocId } : relationId(row.contact),
                    type: [
                      {
                        __component: "type.expense",
                        amount: row.postingGross,
                        account: accountId,
                        currency: payoutCurrencyId,
                      },
                    ],
                  },
                },
                trx ? ({ transacting: trx } as any) : undefined,
              );

              let repaymentTx: any = null;

              if (row.deduction > 0 && row.loan) {
                repaymentTx = await (strapi.entityService as any).create(
                  "api::transaction.transaction",
                  {
                    data: {
                      date_time: new Date(payroll.pay_date),
                      note: `Payroll Loan Repayment (${payroll.pay_period_start} to ${payroll.pay_period_end})`,
                      payment_type: "Transfer",
                      category: loanCategory.documentId
                        ? { documentId: loanCategory.documentId }
                        : loanCategory.id,
                      loan_repayment: row.loan.id,
                      contact: contactDocId
                        ? { documentId: contactDocId }
                        : relationId(row.contact),
                      type: [
                        {
                          __component: "type.income",
                          amount: row.postingDeduction,
                          account: accountId,
                          currency: payoutCurrencyId,
                        },
                      ],
                    },
                  },
                  trx ? ({ transacting: trx } as any) : undefined,
                );

                const oldBalance = round2(toNullableNumber(row.loan.remaining_balance) ?? 0);
                const newBalance = round2(Math.max(0, oldBalance - row.deduction));
                const newStatus = newBalance === 0 ? "Paid Off" : row.loan.status || "Active";

                await (strapi.entityService as any).update(
                  "api::loan.loan",
                  row.loan.id,
                  {
                    data: {
                      remaining_balance: newBalance,
                      status: newStatus,
                    },
                  },
                  trx ? ({ transacting: trx } as any) : undefined,
                );
              }

              updatedDetails.push({
                contact: normalizeRelationInput(row.contact),
                employee_name:
                  toNullableString(row?.slip?.employee_name) ||
                  toNullableString(row?.contact?.name),
                payee_account: normalizeRelationInput(row.account),
                loan_ref: normalizeRelationInput(row.loan),
                bonus: toNullableNumber(row.slip.bonus),
                overtime_amount: toNullableNumber(row.slip.overtime_amount),
                fuel_allowance: toNullableNumber(row.slip.fuel_allowance),
                gym_allowance: toNullableNumber(row.slip.gym_allowance),
                rental_allowance: toNullableNumber(row.slip.rental_allowance),
                gross_pay: row.gross,
                loan_amount_to_deduct: row.deduction,
                net_pay: row.net,
                converted_gross_pay: row.convertedGross,
                converted_loan_deduction: row.convertedDeduction,
                converted_net_pay: row.convertedNet,
                payroll_status: "processed",
                ...(normalizeRelationInput(salaryTx)
                  ? { salary_transaction: normalizeRelationInput(salaryTx) }
                  : {}),
                ...(normalizeRelationInput(repaymentTx)
                  ? {
                      loan_repayment_transaction:
                        normalizeRelationInput(repaymentTx),
                    }
                  : {}),
              });
            }

            await (strapi.entityService as any).update(
              "api::payroll.payroll",
              payroll.id,
              {
                data: {
                  payroll_status: "processed",
                  ledger_synced: true,
                  employee_details: updatedDetails,
                },
              },
              trx ? ({ transacting: trx } as any) : undefined,
            );
          });
        } catch (error) {
          strapi.log.error("Payroll processing failed", error);
          return ctx.internalServerError("Failed to process payroll batch");
        }

        const refreshed = await findPayrollByIdentifier(String(id));
        await hydrateEmployeeFallbacks(refreshed);
        return { data: decoratePayroll(refreshed) };
      },

      async exportCsv(ctx) {
        const { id } = ctx.params;
        const payroll = await findPayrollByIdentifier(String(id));

        if (!payroll) {
          return ctx.notFound("Payroll batch not found");
        }

        await hydrateEmployeeFallbacks(payroll);

        const header = [
          "batch_document_id",
          "pay_period_start",
          "pay_period_end",
          "pay_date",
          "status",
          "ledger_synced",
          "employee_document_id",
          "employee_name",
          "employee_currency",
          "payout_account",
          "payout_currency",
          "gross_pay",
          "loan_deduction",
          "net_pay",
          "converted_gross_pay",
          "converted_loan_deduction",
          "converted_net_pay",
          "salary_transaction_document_id",
          "loan_repayment_transaction_document_id",
          "loan_document_id",
        ];

        const rows = [header.map(csvCell).join(",")];

        asArray<any>(payroll.employee_details).forEach((slip) => {
          const employeeCurrency = getCurrencyMeta(getEmployeeCurrency(slip.contact));
          const payoutCurrency = getCurrencyMeta(slip?.payee_account?.currency);

          rows.push(
            [
              payroll.documentId || payroll.id,
              payroll.pay_period_start,
              payroll.pay_period_end,
              payroll.pay_date,
              payroll.payroll_status,
              payroll.ledger_synced,
              slip?.contact?.documentId || "",
              slip?.contact?.name || slip?.employee_name || "",
              employeeCurrency.symbol || employeeCurrency.code || employeeCurrency.name,
              slip?.payee_account?.name || "",
              payoutCurrency.symbol || payoutCurrency.code || payoutCurrency.name,
              slip?.gross_pay,
              slip?.loan_amount_to_deduct,
              slip?.net_pay,
              slip?.converted_gross_pay,
              slip?.converted_loan_deduction,
              slip?.converted_net_pay,
              slip?.salary_transaction?.documentId || "",
              slip?.loan_repayment_transaction?.documentId || "",
              slip?.loan_ref?.documentId || "",
            ]
              .map(csvCell)
              .join(","),
          );
        });

        const filename = `payroll-${payroll.documentId || payroll.id}-${payroll.pay_date || "export"}.csv`;

        ctx.set("Content-Type", "text/csv; charset=utf-8");
        ctx.set("Content-Disposition", `attachment; filename=\"${filename}\"`);
        ctx.body = rows.join("\n");
      },

      async findByEmployee(ctx) {
        const { id } = ctx.params;
        const { pagination } = ctx.query as any;

        const payrolls = await strapi.entityService.findMany("api::payroll.payroll", {
          populate: PAYROLL_POPULATE,
          sort: ["pay_period_start:desc"],
          limit: 1000,
        } as any);

        await hydrateEmployeeFallbacks(payrolls);

        const flattened: any[] = [];

        asArray<any>(payrolls).forEach((batch) => {
          asArray<any>(batch.employee_details).forEach((slip) => {
            const contact = slip?.contact;
            if (!contact) return;

            const contactMatches =
              String(contact.documentId) === String(id) || String(contact.id) === String(id);

            if (!contactMatches) return;

            flattened.push({
              id: slip.id,
              batch_id: batch.id,
              batch_document_id: batch.documentId,
              pay_period_start: batch.pay_period_start,
              pay_period_end: batch.pay_period_end,
              pay_date: batch.pay_date,
              batch_status: batch.payroll_status,
              ledger_synced: batch.ledger_synced,
              ...slip,
            });
          });
        });

        const page = pagination?.page ? Number.parseInt(String(pagination.page), 10) : 1;
        const pageSize = pagination?.pageSize
          ? Number.parseInt(String(pagination.pageSize), 10)
          : 25;

        const total = flattened.length;
        const pageCount = Math.max(1, Math.ceil(total / pageSize));
        const safePage = Math.min(Math.max(page, 1), pageCount);
        const start = (safePage - 1) * pageSize;

        return {
          data: flattened.slice(start, start + pageSize),
          meta: {
            pagination: {
              page: safePage,
              pageSize,
              pageCount,
              total,
            },
          },
        };
      },
    };
  },
);
