const sql = require('./src/config/db'); 
async function clearBlacklist() { 
  try {
    const r = await sql`DELETE FROM admin_ip_blacklist`; 
    console.log("Cleared all IPs from admin_ip_blacklist", r); 
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0); 
  }
} 
clearBlacklist();
