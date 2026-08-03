require('dotenv').config({ path: '../.env' }); 
const { neon } = require('@neondatabase/serverless'); 
const sql = neon(process.env.DATABASE_URL); 
sql`SELECT * FROM celebrity_profiles`.then(console.log).catch(console.error);
