import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::loan.loan",
  ({ strapi }) => {
    const ensurePublished = async (
      uid: string,
      id: number | string,
      existing?: any,
      options?: { forcePublish?: boolean },
    ) => {
      const entry =
        existing ??
        (await (strapi.entityService as any).findOne(uid, id, {
          fields: ["id", "documentId", "publishedAt"],
        }));

      if (!entry) return null;
      const shouldForcePublish = options?.forcePublish === true;
      if (entry.publishedAt && entry.documentId && !shouldForcePublish) return entry;

      const documentId = entry.documentId;
      if (documentId && typeof (strapi as any).documents === "function") {
        try {
          await (strapi as any).documents(uid).publish({
            documentId,
          });
        } catch (_error) {
          // Fallback below for environments where document publish API isn't available.
        }
      }

      const refreshed = await (strapi.entityService as any).findOne(uid, id, {
        fields: ["id", "documentId", "publishedAt"],
      });
      if (refreshed?.publishedAt) return refreshed;

      return (strapi.entityService as any).update(uid, id, {
        data: { publishedAt: new Date() },
      });
    };

    const resolveContact = async (identifier: string | number) => {
      const raw = String(identifier ?? "").trim();
      if (!raw) return null;

      // Try as documentId first.
      const asDocument = await strapi.entityService.findMany("api::contact.contact", {
        filters: { documentId: raw },
        limit: 1,
        populate: ["contact_type", "contact_type.loans", "contact_type.currency"],
      } as any);
      if (asDocument?.[0]) return asDocument[0];

      // Then try as numeric row id.
      const asId = Number(raw);
      if (Number.isFinite(asId)) {
        const asNumeric = await strapi.entityService.findMany("api::contact.contact", {
          filters: { id: asId },
          limit: 1,
          populate: ["contact_type", "contact_type.loans", "contact_type.currency"],
        } as any);
        if (asNumeric?.[0]) return asNumeric[0];
      }

      return null;
    };

    const getOrCreateLoanCategory = async () => {
      const found = await strapi.entityService.findMany("api::category.category", {
        filters: { name: "Loan" },
        limit: 1,
        fields: ["id", "documentId", "publishedAt"],
      } as any);

      if (found?.[0]) {
        return ensurePublished("api::category.category", found[0].id, found[0]);
      }

      return strapi.entityService.create("api::category.category", {
        data: {
          name: "Loan",
          publishedAt: new Date(),
        },
      } as any);
    };

    const toNumber = (value: any) => {
      if (typeof value === "number") return value;
      if (typeof value === "string") return Number.parseFloat(value);
      return Number.NaN;
    };

    const isPositiveNumber = (value: any) => {
      const parsed = toNumber(value);
      return Number.isFinite(parsed) && parsed > 0;
    };

    const isNonNegativeNumber = (value: any) => {
      const parsed = toNumber(value);
      return Number.isFinite(parsed) && parsed >= 0;
    };

    const isValidDateValue = (value: any) => {
      if (value === undefined || value === null || value === "") return true;
      return !Number.isNaN(new Date(value).getTime());
    };

    const extractEmployeeCurrency = (contact: any) => {
      const employeeComponent = contact?.contact_type?.find(
        (c: any) => c.__component === "contact-type.employee",
      );
      return employeeComponent?.currency || null;
    };

    const buildEmployeeFromContact = (contact: any) => {
      if (!contact) return null;
      return {
        id: contact.id,
        documentId: contact.documentId,
        name: contact.name,
        email: contact.email,
        currency: extractEmployeeCurrency(contact),
      };
    };

    const getLoanToEmployeeMapFromDisbursementTransactions = async (
      loanIds: number[],
    ) => {
      if (!loanIds.length) return {};

      const txs = await strapi.entityService.findMany(
        "api::transaction.transaction",
        {
          filters: {
            loan_disbursement: {
              id: { $in: loanIds },
            },
          },
          populate: [
            "loan_disbursement",
            "contact",
            "contact.contact_type",
            "contact.contact_type.currency",
          ],
          limit: Math.max(loanIds.length * 2, 25),
        } as any,
      );

      const map: Record<number, any> = {};
      (txs as any[]).forEach((tx: any) => {
        const loanId = tx?.loan_disbursement?.id;
        const employee = buildEmployeeFromContact(tx?.contact);
        if (loanId && employee) {
          map[loanId] = employee;
        }
      });

      return map;
    };

    return {
      async find(ctx) {
        // 1. Fetch base loans using default logic (handles pagination & filters)
        const { data, meta } = await super.find(ctx);

        if (!data || data.length === 0) {
          return { data, meta };
        }

        const loanIds = data.map((loan) => loan.id);

        // 2. Find contacts and map loans manually since Strapi dynamic zone filters are unsupported.
        const contacts = await strapi.entityService.findMany(
          "api::contact.contact",
          {
            populate: ["contact_type", "contact_type.loans", "contact_type.currency"],
          } as any,
        );

        // 3. Create a lookup map for fast assignment
        const loanToEmployeeMap: any = {};
        contacts.forEach((contact: any) => {
          const employeeComponent = contact.contact_type?.find(
            (c: any) => c.__component === "contact-type.employee",
          );
          if (employeeComponent && employeeComponent.loans) {
            employeeComponent.loans.forEach((l: any) => {
              loanToEmployeeMap[l.id] = buildEmployeeFromContact(contact);
            });
          }
        });

        // 3b. Fallback map for legacy/unlinked loans via disbursement transaction.contact.
        const txFallbackMap =
          await getLoanToEmployeeMapFromDisbursementTransactions(loanIds);

        // 4. Mutate the returned data array to inject the artificial relation
        const enrichedData = data.map((loan) => ({
          ...loan,
          employee: loanToEmployeeMap[loan.id] || txFallbackMap[loan.id] || null,
        }));

        return { data: enrichedData, meta };
      },

      async findOne(ctx) {
        // 1. Fetch the single loan
        const response = await super.findOne(ctx);

        if (!response || !response.data) {
          return response;
        }

        const loanId = response.data.id;

        // 2. Find the contact that owns this loan
        const contacts = await strapi.entityService.findMany(
          "api::contact.contact",
          {
            populate: ["contact_type", "contact_type.loans", "contact_type.currency"],
            filters: {
              contact_type: {
                $on: {
                  "contact-type.employee": {
                    loans: {
                      id: { $eq: loanId },
                    },
                  },
                },
              },
            },
          } as any,
        );

        // 3. Inject the employee data if found
        if (contacts && contacts.length > 0) {
          const contact = contacts[0] as any;
          response.data.employee = buildEmployeeFromContact(contact);
        } else {
          // Fallback for legacy/unlinked loans: resolve owner from disbursement transaction.contact
          const txFallbackMap =
            await getLoanToEmployeeMapFromDisbursementTransactions([loanId]);
          response.data.employee = txFallbackMap[loanId] || null;
        }

        return response;
      },

      async update(ctx) {
        const payload = ctx.request.body?.data;

        if (!payload || typeof payload !== "object") {
          return ctx.badRequest("Missing data payload");
        }

        const hasTotalAmount = payload.total_amount !== undefined;
        const hasMonthlyInstallment = payload.monthly_installment !== undefined;
        const hasRemainingBalance = payload.remaining_balance !== undefined;
        const hasStatus = payload.status !== undefined;

        if (hasTotalAmount && !isPositiveNumber(payload.total_amount)) {
          return ctx.badRequest("Total Loan Amount must be greater than 0");
        }

        if (hasMonthlyInstallment && !isPositiveNumber(payload.monthly_installment)) {
          return ctx.badRequest(
            "Monthly Installment Deduction must be greater than 0",
          );
        }

        if (hasRemainingBalance && !isNonNegativeNumber(payload.remaining_balance)) {
          return ctx.badRequest("Remaining Balance cannot be negative");
        }

        if (hasStatus) {
          const validStatuses = ["Active", "Paid Off", "Defaulted"];
          if (!validStatuses.includes(payload.status)) {
            return ctx.badRequest("Invalid loan status");
          }
        }

        const totalAmount = hasTotalAmount ? toNumber(payload.total_amount) : null;
        const monthlyInstallment = hasMonthlyInstallment
          ? toNumber(payload.monthly_installment)
          : null;
        const remainingBalance = hasRemainingBalance
          ? toNumber(payload.remaining_balance)
          : null;

        if (
          hasTotalAmount &&
          hasMonthlyInstallment &&
          monthlyInstallment !== null &&
          totalAmount !== null &&
          monthlyInstallment > totalAmount
        ) {
          return ctx.badRequest(
            "Monthly Installment Deduction cannot exceed Total Loan Amount",
          );
        }

        if (
          hasTotalAmount &&
          hasRemainingBalance &&
          remainingBalance !== null &&
          totalAmount !== null &&
          remainingBalance > totalAmount
        ) {
          return ctx.badRequest(
            "Remaining Balance cannot exceed Total Loan Amount",
          );
        }

        if (hasStatus && hasRemainingBalance && payload.status === "Paid Off" && remainingBalance !== 0) {
          return ctx.badRequest(
            "Remaining Balance must be 0 when status is Paid Off",
          );
        }

        if (hasStatus && hasRemainingBalance && payload.status !== "Paid Off" && remainingBalance === 0) {
          return ctx.badRequest(
            "Status must be Paid Off when Remaining Balance is 0",
          );
        }

        return super.update(ctx);
      },

      async issue(ctx) {
        try {
          const {
            employeeId,
            accountId,
            amount,
            monthlyInstallment,
            convertedAmount,
            date,
            note,
            payment_type,
          } = ctx.request.body.data;

          if (!employeeId || !accountId || amount === undefined || monthlyInstallment === undefined) {
            return ctx.badRequest("Missing required fields for loan issuance");
          }

          if (!isPositiveNumber(amount)) {
            return ctx.badRequest("Total Loan Amount must be greater than 0");
          }

          if (!isPositiveNumber(monthlyInstallment)) {
            return ctx.badRequest(
              "Monthly Installment Deduction must be greater than 0",
            );
          }

          const principalAmount = toNumber(amount);
          const monthlyInstallmentAmount = toNumber(monthlyInstallment);

          if (monthlyInstallmentAmount > principalAmount) {
            return ctx.badRequest(
              "Monthly Installment Deduction cannot exceed Total Loan Amount",
            );
          }

          if (convertedAmount !== undefined && convertedAmount !== null && convertedAmount !== "") {
            if (!isPositiveNumber(convertedAmount)) {
              return ctx.badRequest("Converted Amount must be greater than 0");
            }
          }

          if (!isValidDateValue(date)) {
            return ctx.badRequest("Invalid disbursement date");
          }

          // 1. Fetch the Employee Contact
          const employeeContact = await resolveContact(employeeId);

          if (!employeeContact) {
            return ctx.notFound("Employee not found");
          }

          const publishedEmployeeContact = await ensurePublished(
            "api::contact.contact",
            employeeId,
            employeeContact as any,
          );
          const employeeContactDocumentId = publishedEmployeeContact?.documentId;

          if (!employeeContactDocumentId) {
            return ctx.badRequest("Employee contact is missing documentId");
          }

          const employeeComponentIndex = (
            employeeContact as any
          ).contact_type?.findIndex(
            (c: any) => c.__component === "contact-type.employee",
          );

          if (
            employeeComponentIndex === -1 ||
            employeeComponentIndex === undefined
          ) {
            return ctx.badRequest("Contact is not configured as an Employee");
          }

          // 2. Fetch the disbursement account's currency — the transaction is recorded
          //    in the account's currency, which matches deductAmount whether or not
          //    a convertedAmount (cross-currency) was provided.
          const account = await strapi.entityService.findOne(
            "api::account.account",
            accountId,
            { populate: ["currency"] } as any,
          );
          if (!account) {
            return ctx.notFound("Disbursement account not found");
          }
          const transactionCurrencyId = (account as any)?.currency?.id ?? undefined;

          // 2b. Get/create Loan category and ensure it is published so populate can resolve it in ledger.
          const loanCategory = await getOrCreateLoanCategory();
          if (!loanCategory?.documentId) {
            return ctx.internalServerError("Loan category is missing documentId");
          }

          // 3. Generate the Disbursement Transaction (Expense) via entityService
          const deductAmount = convertedAmount !== undefined && convertedAmount !== null && convertedAmount !== ""
            ? parseFloat(convertedAmount)
            : principalAmount;

          let transaction: any;
          try {
            // Create the disbursement transaction with relation links in the same write.
            transaction = await strapi.entityService.create(
              "api::transaction.transaction",
              {
                data: {
                  date_time: date ? new Date(date) : new Date(),
                  note: note || `Loan Disbursement for ${employeeContact.name}`,
                  payment_type: payment_type || "Transfer",
                  contact: { documentId: employeeContactDocumentId },
                  category: { documentId: loanCategory.documentId },
                  type: [
                    {
                      __component: "type.expense",
                      amount: deductAmount,
                      account: accountId,
                      currency: transactionCurrencyId,
                    },
                  ],
                },
              },
            );
            await ensurePublished("api::transaction.transaction", transaction.id);
          } catch (txError: any) {
            console.error(
              "Error creating disbursement transaction:",
              txError.message,
            );
            throw txError;
          }

          // 4. Create the Loan Record
          const loan = await strapi.entityService.create("api::loan.loan", {
            data: {
              total_amount: principalAmount,
              remaining_balance: principalAmount,
              monthly_installment: monthlyInstallmentAmount,
              status: "Active",
              disbursement_transaction: transaction.id,
            },
          });
          await ensurePublished("api::loan.loan", loan.id);

          // 5. Update the Employee's dynamic zone to inject the new Loan
          const updatedContactType = [...(employeeContact as any).contact_type];
          const employeeComponent = updatedContactType[employeeComponentIndex] || {};
          const existingLoans = employeeComponent.loans || [];
          const existingLoanIds = existingLoans
            .map((l: any) => l?.id || l)
            .map((v: any) => Number(v))
            .filter((v: any) => Number.isFinite(v));
          const uniqueLoanIds = Array.from(
            new Set([...existingLoanIds, Number(loan.id)]),
          );
          const employeeCurrencyId =
            typeof employeeComponent.currency === "object"
              ? employeeComponent.currency?.id
              : employeeComponent.currency;

          // Build a normalized employee component payload; copying raw populated
          // relation objects can cause Strapi to ignore component relation updates.
          updatedContactType[employeeComponentIndex] = {
            __component: "contact-type.employee",
            salary: employeeComponent.salary ?? null,
            position: employeeComponent.position || null,
            birth_day: employeeComponent.birth_day || null,
            address: employeeComponent.address || null,
            cnic: employeeComponent.cnic || null,
            joining_date: employeeComponent.joining_date || null,
            bank_account: employeeComponent.bank_account || null,
            fuel_allowance: employeeComponent.fuel_allowance ?? null,
            rental_allowance: employeeComponent.rental_allowance ?? null,
            gym_allowance: employeeComponent.gym_allowance ?? null,
            active: employeeComponent.active ?? true,
            department: employeeComponent.department || null,
            currency: employeeCurrencyId ? Number(employeeCurrencyId) : null,
            loans: { set: uniqueLoanIds },
          };

          await strapi.entityService.update(
            "api::contact.contact",
            (employeeContact as any).id || employeeId,
            {
              data: {
                contact_type: updatedContactType,
              },
            },
          );
          await ensurePublished(
            "api::contact.contact",
            (employeeContact as any).id || employeeId,
            undefined,
            { forcePublish: true },
          );

          return ctx.send({
            data: loan,
            message: "Loan efficiently issued and fully orchestrated.",
          });
        } catch (error) {
          console.error("Error issuing loan:", error);
          return ctx.internalServerError("Failed to issue loan");
        }
      },

      async repay(ctx: any) {
        try {
          const {
            loanId,
            employeeId,
            accountId,
            amount,
            convertedAmount,
            date,
            note,
            payment_type,
          } = ctx.request.body.data;

          if (!loanId || !accountId || amount === undefined) {
            return ctx.badRequest("Missing required fields for loan repayment");
          }

          if (!isPositiveNumber(amount)) {
            return ctx.badRequest("Repayment Amount must be greater than 0");
          }

          if (convertedAmount !== undefined && convertedAmount !== null && convertedAmount !== "") {
            if (!isPositiveNumber(convertedAmount)) {
              return ctx.badRequest("Converted Amount must be greater than 0");
            }
          }

          if (!isValidDateValue(date)) {
            return ctx.badRequest("Invalid repayment date");
          }

          const repaymentAmount = toNumber(amount);

          // 1. Fetch the parent loan
          const loan = await strapi.entityService.findOne(
            "api::loan.loan",
            loanId,
          );

          if (!loan) {
            return ctx.notFound("Loan not found");
          }

          const loanData = loan as any;
          const oldBalance = parseFloat(
            (loanData.remaining_balance || loanData.total_amount)?.toString() ||
              "0",
          );

          if (!Number.isFinite(oldBalance)) {
            return ctx.internalServerError("Loan balance is invalid");
          }

          if (oldBalance <= 0) {
            return ctx.badRequest("Loan is already fully paid");
          }

          if (repaymentAmount > oldBalance) {
            return ctx.badRequest(
              "Repayment Amount cannot exceed remaining loan balance",
            );
          }

          // 1b. Fetch employee contact and normalize to documentId relation
          let employeeContactDocumentId: string | null = null;
          if (employeeId) {
            const employeeContact = await resolveContact(employeeId);
            if (employeeContact) {
              const publishedEmployeeContact = await ensurePublished(
                "api::contact.contact",
                employeeContact.id,
                employeeContact,
              );
              employeeContactDocumentId =
                publishedEmployeeContact?.documentId || null;
            } else {
              return ctx.badRequest(
                "Employee not found. Please refresh and try repayment again.",
              );
            }
          }

          // Fallback: derive employee owner from loan if caller did not send employeeId.
          if (!employeeContactDocumentId) {
            const ownerContacts = await strapi.entityService.findMany(
              "api::contact.contact",
              {
                fields: ["id", "documentId", "publishedAt"],
                populate: ["contact_type", "contact_type.loans"],
                filters: {
                  contact_type: {
                    $on: {
                      "contact-type.employee": {
                        loans: {
                          id: { $eq: loanId },
                        },
                      },
                    },
                  },
                },
                limit: 1,
              } as any,
            );

            const ownerContact = ownerContacts?.[0];
            if (ownerContact) {
              const publishedOwnerContact = await ensurePublished(
                "api::contact.contact",
                ownerContact.id,
                ownerContact,
              );
              employeeContactDocumentId = publishedOwnerContact?.documentId || null;
            }
          }

          // Fallback for loans not linked in employee dynamic-zone relation:
          // resolve owner from disbursement transaction.contact.
          if (!employeeContactDocumentId) {
            const disbursementTxs = await strapi.entityService.findMany(
              "api::transaction.transaction",
              {
                fields: ["id"],
                populate: ["contact"],
                filters: {
                  loan_disbursement: {
                    id: { $eq: loanId },
                  },
                },
                limit: 1,
              } as any,
            );

            const ownerContact = (disbursementTxs as any[])?.[0]?.contact;
            if (ownerContact?.id) {
              const publishedOwnerContact = await ensurePublished(
                "api::contact.contact",
                ownerContact.id,
                ownerContact,
              );
              employeeContactDocumentId = publishedOwnerContact?.documentId || null;
            }
          }

          if (!employeeContactDocumentId) {
            return ctx.badRequest(
              "Employee contact is required to record loan repayment",
            );
          }

          // 2. Fetch the receiving account's currency — the transaction is recorded
          //    in the account's currency, which matches depositAmount whether or not
          //    a convertedAmount (cross-currency) was provided.
          const account = await strapi.entityService.findOne(
            "api::account.account",
            accountId,
            { populate: ["currency"] } as any,
          );
          if (!account) {
            return ctx.notFound("Receiving account not found");
          }
          const transactionCurrencyId = (account as any)?.currency?.id ?? undefined;

          // 2b. Get/create Loan category and ensure it is published so populate can resolve it in ledger.
          const loanCategory = await getOrCreateLoanCategory();
          if (!loanCategory?.documentId) {
            return ctx.internalServerError("Loan category is missing documentId");
          }

          // 3. Generate the Repayment Transaction (Income) via entityService
          const depositAmount = convertedAmount !== undefined && convertedAmount !== null && convertedAmount !== ""
            ? parseFloat(convertedAmount)
            : repaymentAmount;

          let repaymentTx: any;
          try {
            const txData: any = {
              date_time: date ? new Date(date) : new Date(),
              note: note || "Loan Repayment",
              payment_type: payment_type || "Transfer",
              loan_repayment: loanId,
              category: { documentId: loanCategory.documentId },
              type: [
                {
                  __component: "type.income",
                  amount: depositAmount,
                  account: accountId,
                  currency: transactionCurrencyId,
                },
              ],
            };

            txData.contact = { documentId: employeeContactDocumentId };

            // Create the repayment transaction with relation links in the same write.
            repaymentTx = await strapi.entityService.create(
              "api::transaction.transaction",
              {
                data: txData,
              },
            );
            await ensurePublished("api::transaction.transaction", repaymentTx.id);
          } catch (repayError: any) {
            console.error("Error creating repayment transaction:", repayError.message);
            throw repayError;
          }

          // 4. Update the Loan's Remaining Balance
          const newBalance = Math.max(0, oldBalance - repaymentAmount); // Do not drop below 0

          const newStatus = newBalance === 0 ? "Paid Off" : loanData.status;

          const updatedLoan = await strapi.entityService.update(
            "api::loan.loan",
            loanId,
            {
              data: {
                remaining_balance: newBalance,
                status: newStatus,
              },
            },
          );
          await ensurePublished(
            "api::loan.loan",
            loanId,
            undefined,
            { forcePublish: true },
          );

          return ctx.send({
            data: updatedLoan,
            message: "Loan repayment successfully recorded",
          });
        } catch (error) {
          console.error("Error repaying loan:", error);
          return ctx.internalServerError("Failed to repay loan");
        }
      },
    };
  },
);
