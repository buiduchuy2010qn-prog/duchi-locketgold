const { neon } = require('@neondatabase/serverless');
const sql = neon("postgresql://neondb_owner:npg_uK3CgR8kFjfa@ep-polished-breeze-a8z1l4n5-pooler.eastus2.azure.neon.tech/neondb?sslmode=require");
sql`SELECT * FROM admin_roles`.then(console.log).catch(console.error);
