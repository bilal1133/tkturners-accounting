const fs = require('fs/promises');
const path = require('path');

async function ensureMigrationTable(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS finance_schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function runMigrations(strapiInstance) {
  const knex = strapiInstance.db.connection;
  const migrationsDir = path.join(process.cwd(), 'database', 'migrations');

  await ensureMigrationTable(knex);

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const existing = await knex('finance_schema_migrations').where({ name: file }).first();
    if (existing) {
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');

    await knex.transaction(async (trx) => {
      await trx.raw(sql);
      await trx('finance_schema_migrations').insert({ name: file });
    });

    strapiInstance.log.info(`Applied migration ${file}`);
  }
}

module.exports = {
  runMigrations,
};
