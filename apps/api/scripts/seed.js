'use strict';

const strapiFactory = require('@strapi/strapi');
const { runMigrations } = require('../src/lib/finance/migrations');
const { seedBaseData } = require('../src/lib/finance/bootstrap');

async function main() {
  const appContext = await strapiFactory.compile();
  const app = await strapiFactory.createStrapi(appContext).load();

  await runMigrations(app);
  await seedBaseData(app);

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
