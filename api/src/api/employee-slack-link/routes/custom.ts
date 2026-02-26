export default {
  routes: [
    {
      method: "POST",
      path: "/slack/financials/command",
      handler: "api::employee-slack-link.employee-slack-link.handleFinancialCommand",
      config: {
        auth: false,
      },
    },
  ],
};
