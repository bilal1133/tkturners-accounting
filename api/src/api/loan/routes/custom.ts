export default {
  routes: [
    {
      method: "POST",
      path: "/loans/issue",
      handler: "api::loan.loan.issue",
    },
    {
      method: "POST",
      path: "/loans/repay",
      handler: "api::loan.loan.repay",
    },
  ],
};
