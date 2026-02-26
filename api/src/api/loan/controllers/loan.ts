import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::loan.loan",
  ({ strapi }) => ({
    async find(ctx) {
      // 1. Fetch base loans using default logic (handles pagination & filters)
      const { data, meta } = await super.find(ctx);

      if (!data || data.length === 0) {
        return { data, meta };
      }

      // 2. Extract loan IDs
      const loanIds = data.map((loan) => loan.id);

      // 3. Find contacts that have these loans in their employee component
      const contacts = await strapi.entityService.findMany(
        "api::contact.contact",
        {
          populate: ["contact_type", "contact_type.loans"],
          filters: {
            contact_type: {
              $on: {
                "contact-type.employee": {
                  loans: {
                    id: { $in: loanIds },
                  },
                },
              },
            },
          },
        } as any,
      );

      // 4. Create a lookup map for fast assignment
      const loadToEmployeeMap: any = {};
      contacts.forEach((contact: any) => {
        const employeeComponent = contact.contact_type?.find(
          (c: any) => c.__component === "contact-type.employee",
        );
        if (employeeComponent && employeeComponent.loans) {
          employeeComponent.loans.forEach((l: any) => {
            loadToEmployeeMap[l.id] = {
              id: contact.id,
              name: contact.name,
              email: contact.email,
            };
          });
        }
      });

      // 5. Mutate the returned data array to inject the artificial relation
      const enrichedData = data.map((loan) => ({
        ...loan,
        employee: loadToEmployeeMap[loan.id] || null,
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
        } as any,
      );

      // 3. Inject the employee data if found
      if (contacts && contacts.length > 0) {
        response.data.employee = {
          id: (contacts[0] as any).id,
          name: (contacts[0] as any).name,
          email: (contacts[0] as any).email,
        };
      } else {
        response.data.employee = null;
      }

      return response;
    },

    async issue(ctx) {
      try {
        const { employeeId, accountId, amount, monthlyInstallment, date } =
          ctx.request.body.data;

        if (!employeeId || !accountId || !amount || !monthlyInstallment) {
          return ctx.badRequest("Missing required fields for loan issuance");
        }

        // 1. Fetch the Employee Contact
        const employeeContact = await strapi.entityService.findOne(
          "api::contact.contact",
          employeeId,
          {
            populate: ["contact_type", "contact_type.loans"],
          },
        );

        if (!employeeContact) {
          return ctx.notFound("Employee not found");
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

        // 2. Generate the Disbursement Transaction (Expense)
        const transaction = await strapi.entityService.create(
          "api::transaction.transaction",
          {
            data: {
              date_time: date ? new Date(date) : new Date(),
              note: `Loan Disbursement for ${employeeContact.name}`,
              payment_type: "Transfer",
              contact: employeeId,
              type: [
                {
                  __component: "type.expense",
                  amount: amount,
                  account: accountId,
                },
              ],
            },
          },
        );

        // 3. Create the Loan Record
        const loan = await strapi.entityService.create("api::loan.loan", {
          data: {
            total_amount: amount,
            remaining_balance: amount,
            monthly_installment: monthlyInstallment,
            status: "Active",
            disbursement_transaction: transaction.id,
          },
        });

        // 4. Update the Employee's dynamic zone to inject the new Loan
        const updatedContactType = [...(employeeContact as any).contact_type];
        const existingLoans =
          updatedContactType[employeeComponentIndex].loans || [];

        updatedContactType[employeeComponentIndex].loans = [
          ...existingLoans,
          loan.id,
        ];

        await strapi.entityService.update("api::contact.contact", employeeId, {
          data: {
            contact_type: updatedContactType,
          },
        });

        return ctx.send({
          data: loan,
          message: "Loan efficiently issued and fully orchestrated.",
        });
      } catch (error) {
        console.error("Error issuing loan:", error);
        return ctx.internalServerError("Failed to issue loan");
      }
    },
  }),
);
