const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tkturners-accounting',
  password: 'admin',
  port: 5432,
});

(async () => {
  try {
    // Get the Authenticated role ID
    const roleRes = await pool.query("SELECT id FROM up_roles WHERE type = 'authenticated'");
    const roleId = roleRes.rows[0].id;
    
    console.log(`Authenticated role ID: ${roleId}`);
    
    const controllers = [
      'api::account.account',
      'api::category.category',
      'api::contact.contact',
      'api::currency.currency',
      'api::loan.loan',
      'api::payroll.payroll',
      'api::project.project',
      'api::transaction.transaction'
    ];
    
    const actions = ['find', 'findOne', 'create', 'update', 'delete'];
    
    // Check if the table exists, it might be named differently
    let tablePrefix = 'up_permissions';
    
    for (const controller of controllers) {
      for (const action of actions) {
        const actionStr = `${controller}.${action}`;
        
        // For Postgres Strapi 5, the permissions table assigns actions to roles
        await pool.query(
          "INSERT INTO up_permissions (action, role_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT DO NOTHING",
          [actionStr, roleId]
        ).catch(e => {
            // Ignore if it already exists or if schema is slightly different
            if(e.code !== '23505') console.log(`Error inserting ${actionStr}: ${e.message}`);
        });
      }
    }
    console.log("Permissions seeded directly into DB");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
})();
