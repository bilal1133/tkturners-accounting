export default {
  routes: [
    {
      method: "GET",
      path: "/ledger/transactions",
      handler: "transaction.ledgerList",
      config: {
        auth: {
          scope: ["api::transaction.transaction.ledgerList"],
        },
      },
    },
    {
      method: "GET",
      path: "/reports/dashboard",
      handler: "transaction.dashboardReport",
      config: {
        auth: {
          scope: ["api::transaction.transaction.dashboardReport"],
        },
      },
    },
  ],
};
