const CORE_FINANCE_CONTROLLERS = [
  "api::account.account",
  "api::category.category",
  "api::contact.contact",
  "api::currency.currency",
  "api::loan.loan",
  "api::payroll.payroll",
  "api::project.project",
  "api::transaction.transaction",
] as const;

const CORE_CRUD_ACTIONS = ["find", "findOne", "create", "update", "delete"] as const;

const CORE_FINANCE_ACTIONS = CORE_FINANCE_CONTROLLERS.flatMap((controller) =>
  CORE_CRUD_ACTIONS.map((action) => `${controller}.${action}`),
);

const CUSTOM_FINANCE_ACTIONS = [
  "api::loan.loan.issue",
  "api::loan.loan.repay",
  "api::payroll.payroll.findByEmployee",
  "api::payroll.payroll.process",
  "api::payroll.payroll.exportCsv",
  "api::payroll.payroll.findOneDetailed",
];

const FINANCE_ADMIN_ACTIONS = [...new Set([...CORE_FINANCE_ACTIONS, ...CUSTOM_FINANCE_ACTIONS])];

const SELF_SERVICE_BLOCKED_ACTIONS = [...FINANCE_ADMIN_ACTIONS];

type RoleRecord = {
  id: number;
  type: string;
  name: string;
};

const ensureRole = async (
  strapi: any,
  params: { type: string; name: string; description: string },
): Promise<RoleRecord> => {
  const roleQuery = strapi.query("plugin::users-permissions.role");
  const existing = (await roleQuery.findOne({
    where: { type: params.type },
  })) as RoleRecord | null;

  if (existing) return existing;

  return (await roleQuery.create({
    data: {
      type: params.type,
      name: params.name,
      description: params.description,
    },
  })) as RoleRecord;
};

const ensurePermissions = async (
  strapi: any,
  roleId: number,
  actions: string[],
) => {
  const permissionQuery = strapi.db.query("plugin::users-permissions.permission");
  const existing = (await permissionQuery.findMany({
    where: { role: roleId },
    select: ["action"],
  })) as Array<{ action: string }>;

  const existingActions = new Set(existing.map((row) => row.action));
  const missing = actions
    .filter((action) => !existingActions.has(action))
    .map((action) => ({ action, role: roleId }));

  if (missing.length === 0) return;

  await permissionQuery.createMany({ data: missing });
};

const removePermissions = async (
  strapi: any,
  roleId: number,
  actions: string[],
) => {
  if (actions.length === 0) return;

  await strapi.db.query("plugin::users-permissions.permission").deleteMany({
    where: {
      role: roleId,
      action: { $in: actions },
    },
  });
};

export default {
  register(/*{ strapi }*/) {},

  async bootstrap({ strapi }) {
    try {
      const roleQuery = strapi.query("plugin::users-permissions.role");

      const financeAdminRole = await ensureRole(strapi, {
        type: "finance-admin",
        name: "Finance Admin",
        description: "Full accounting dashboard and payroll operations access.",
      });

      const employeeSelfServiceRole = await ensureRole(strapi, {
        type: "employee-self-service",
        name: "Employee Self Service",
        description:
          "No direct accounting CRUD access; reserved for Slack self-service usage.",
      });

      await ensurePermissions(strapi, financeAdminRole.id, FINANCE_ADMIN_ACTIONS);

      const roleTypesToRestrict = ["public", "authenticated", employeeSelfServiceRole.type];

      for (const roleType of roleTypesToRestrict) {
        const role = (await roleQuery.findOne({
          where: { type: roleType },
        })) as RoleRecord | null;

        if (!role) continue;
        await removePermissions(strapi, role.id, SELF_SERVICE_BLOCKED_ACTIONS);
      }

      strapi.log.info(
        "Permissions bootstrap complete: finance-admin seeded; public/authenticated/employee-self-service restricted from finance APIs.",
      );
    } catch (error) {
      strapi.log.error("Could not apply role policy bootstrap:", error);
    }
  },
};
