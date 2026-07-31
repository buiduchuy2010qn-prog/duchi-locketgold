import { neon } from "@neondatabase/serverless";

function getDatabaseUrl() {
  const candidates = [process.env.DATABASE_URL, process.env.NEON_DATABASE_URL];
  for (const raw of candidates) {
    if (raw && typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
  }
  return null;
}

const dbUrl = getDatabaseUrl();
export const sql = dbUrl ? neon(dbUrl) : null;

export async function initDb() {
  if (!sql) return;
  
  await sql`
    CREATE TABLE IF NOT EXISTS admin_roles (
      uid VARCHAR(128) PRIMARY KEY,
      email VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  
  await sql`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id SERIAL PRIMARY KEY,
      admin_uid VARCHAR(128) NOT NULL,
      action VARCHAR(128) NOT NULL,
      target_uid VARCHAR(128),
      details TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  
  await sql`
    CREATE TABLE IF NOT EXISTS login_history (
      id SERIAL PRIMARY KEY,
      uid VARCHAR(128) NOT NULL,
      ip_address VARCHAR(64),
      country VARCHAR(64),
      city VARCHAR(64),
      browser VARCHAR(128),
      os VARCHAR(128),
      device VARCHAR(128),
      login_method VARCHAR(64),
      build_version VARCHAR(64),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
}
