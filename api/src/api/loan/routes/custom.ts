export default {
  routes: [
    {
      method: "POST",
      path: "/loans/issue",
      handler: "api::loan.loan.issue",
      config: {
        auth: false,
      },
    },
  ],
};
