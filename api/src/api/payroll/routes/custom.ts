export default {
  routes: [
    {
      method: "GET",
      path: "/payrolls/employee/:id",
      handler: "payroll.findByEmployee",
      config: {
        auth: {
          scope: ["api::payroll.payroll.findByEmployee"],
        },
      },
    },
    {
      method: "POST",
      path: "/payrolls/:id/process",
      handler: "payroll.process",
      config: {
        auth: {
          scope: ["api::payroll.payroll.process"],
        },
      },
    },
    {
      method: "GET",
      path: "/payrolls/:id/export.csv",
      handler: "payroll.exportCsv",
      config: {
        auth: {
          scope: ["api::payroll.payroll.exportCsv"],
        },
      },
    },
    {
      method: "GET",
      path: "/payrolls/:id/details",
      handler: "payroll.findOneDetailed",
      config: {
        auth: {
          scope: ["api::payroll.payroll.findOneDetailed"],
        },
      },
    },
  ],
};
