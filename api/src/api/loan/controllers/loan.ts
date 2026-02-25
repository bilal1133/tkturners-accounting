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
  }),
);
