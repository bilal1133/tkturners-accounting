const { Pool } = require("pg");
const bcrypt = require("bcryptjs"); // Assuming strapi uses bcryptjs or bcrypt is installed

const pool = new Pool({
  user: "admin",
  host: "127.0.0.1",
  database: "tkturners-accounting",
  password: "admin",
  port: 5432,
});

(async () => {
  try {
    const hash = await bcrypt.hash("TestPassword123", 10);
    // Prefer the finance-admin role after security hardening.
    const financeRoleRes = await pool.query(
      "SELECT id FROM up_roles WHERE type = 'finance-admin' LIMIT 1",
    );
    const fallbackRoleRes = await pool.query(
      "SELECT id FROM up_roles WHERE type = 'authenticated' LIMIT 1",
    );
    const roleId =
      financeRoleRes.rows[0]?.id || fallbackRoleRes.rows[0]?.id || null;

    if (!roleId) {
      throw new Error("No valid user role found (finance-admin/authenticated).");
    }

    await pool.query(
      "INSERT INTO up_users (username, email, provider, password, confirmed, blocked, role_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())",
      ["e2etest", "e2etest@tkturners.com", "local", hash, true, false, roleId],
    );
    console.log("Test user created: e2etest@tkturners.com / TestPassword123");
  } catch (e) {
    if (e.code === "23505") {
      console.log("User already exists, updating password...");
      const hash = await bcrypt.hash("TestPassword123", 10);
      await pool.query(
        "UPDATE up_users SET password = $1 WHERE email = 'e2etest@tkturners.com'",
        [hash],
      );
      console.log("Password reset.");
    } else {
      console.error(e);
    }
  } finally {
    pool.end();
  }
})();
