require('dotenv').config({ path: '../.env' }); 
const { neon } = require('@neondatabase/serverless'); 
const sql = neon(process.env.DATABASE_URL); 
sql`SELECT * FROM locket_idols`.then(console.log).catch(console.error);
