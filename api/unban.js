require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function unban() {
  try {
    const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!dbUrl) {
      console.log('No DB URL');
      return;
    }
    const sql = neon(dbUrl);
    await sql`DELETE FROM ip_blacklist`;
    await sql`DELETE FROM web_security_threats`;
    console.log('Unbanned all');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
unban();
