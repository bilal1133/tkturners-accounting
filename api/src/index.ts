export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    try {
      // Find the Authenticated role
      const authenticatedRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "authenticated" } });

      if (authenticatedRole) {
        strapi.log.info(
          "Found Authenticated role, granting read/write access to all api objects",
        );

        const controllersToOpen = [
          "api::account.account",
          "api::category.category",
          "api::contact.contact",
          "api::currency.currency",
          "api::loan.loan",
          "api::payroll.payroll",
          "api::project.project",
          "api::transaction.transaction",
        ];

        for (const controller of controllersToOpen) {
          await strapi.db
            .query("plugin::users-permissions.permission")
            .createMany({
              data: [
                { action: `${controller}.find`, role: authenticatedRole.id },
                { action: `${controller}.findOne`, role: authenticatedRole.id },
                { action: `${controller}.create`, role: authenticatedRole.id },
                { action: `${controller}.update`, role: authenticatedRole.id },
                { action: `${controller}.delete`, role: authenticatedRole.id },
              ],
            })
            .catch((e) => {
              // Ignoring unique constraint errors since we run this on every boot
            });
        }
      }
    } catch (e) {
      strapi.log.error("Could not set permissions automatically:", e);
    }
  },
};
