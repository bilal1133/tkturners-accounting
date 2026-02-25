export default {
  routes: [
    {
      method: "GET",
      path: "/payrolls/employee/:id",
      handler: "payroll.findByEmployee",
      config: {
        auth: false, // Set to true if you are using JWT authentication
      },
    },
  ],
};
