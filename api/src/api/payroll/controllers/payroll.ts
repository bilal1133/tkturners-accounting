import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::payroll.payroll",
  ({ strapi }) => ({
    async findByEmployee(ctx) {
      const { id } = ctx.params;
      const { pagination } = ctx.query;

      // 1. Fetch all payrolls and populate the employee details and their contacts
      // Note: We fetch all because we need to search inside the components.
      // A more optimized database query could be written using Knex if data grows massive.
      const payrolls = await strapi.entityService.findMany(
        "api::payroll.payroll",
        {
          populate: {
            employee_details: {
              populate: ["contact", "payee_account", "loan_ref", "transaction"],
            },
          },
        },
      );

      // 2. Extract and flatten the matching payslips from the batches
      let matchingPayslips = [];

      payrolls.forEach((batch: any) => {
        if (batch.employee_details) {
          const employeePayslip = batch.employee_details.find(
            (slip: any) =>
              slip.contact && String(slip.contact.id) === String(id),
          );

          if (employeePayslip) {
            // Reformat the returned object to look like a standard flat record
            matchingPayslips.push({
              id: employeePayslip.id, // component ID
              batch_id: batch.id, // Parent Payroll ID
              pay_period_start: batch.pay_period_start,
              pay_period_end: batch.pay_period_end,
              batch_status: batch.payroll_status,
              ...employeePayslip,
            });
          }
        }
      });

      // Sort by latest pay period first
      matchingPayslips.sort(
        (a, b) =>
          new Date(b.pay_period_start).getTime() -
          new Date(a.pay_period_start).getTime(),
      );

      // 3. Manual Pagination Slicing
      const pag = pagination as any;
      const page = pag && pag.page ? parseInt(pag.page as string) : 1;
      const pageSize =
        pag && pag.pageSize ? parseInt(pag.pageSize as string) : 25; // Default 25 matches standard Strapi size

      const total = matchingPayslips.length;
      const pageCount = Math.ceil(total / pageSize);
      const start = (page - 1) * pageSize;
      const paginatedData = matchingPayslips.slice(start, start + pageSize);

      // 4. Return standard Strapi formatted response
      return {
        data: paginatedData,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount,
            total,
          },
        },
      };
    },
  }),
);
