require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function fix() {
  await sql`UPDATE web_users SET current_web_source = 'vercel' WHERE current_web_source IN ('web-locket', 'https://locket-dio.com', 'https://www.locket-dio.com', 'locket-dio.com');`;
  await sql`UPDATE login_history SET web_source = 'vercel' WHERE web_source IN ('web-locket', 'https://locket-dio.com', 'https://www.locket-dio.com', 'locket-dio.com');`;
  await sql`UPDATE user_sessions SET web_source = 'vercel' WHERE web_source IN ('web-locket', 'https://locket-dio.com', 'https://www.locket-dio.com', 'locket-dio.com');`;
  console.log('Fixed!');
}
fix().catch(console.error);
