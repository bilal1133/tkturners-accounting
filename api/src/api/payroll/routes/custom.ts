export default {
  routes: [
    {
      method: "GET",
      path: "/payrolls/employee/:id",
      handler: "payroll.findByEmployee",
    },
    {
      method: "POST",
      path: "/payrolls/:id/process",
      handler: "payroll.process",
    },
    {
      method: "GET",
      path: "/payrolls/:id/export.csv",
      handler: "payroll.exportCsv",
    },
    {
      method: "GET",
      path: "/payrolls/:id/details",
      handler: "payroll.findOneDetailed",
    },
  ],
};
