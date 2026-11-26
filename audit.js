import { db } from './db.js';
export async function audit({ companyId, userId, action, entity, entityId, payload, req }) {
  try {
    await db.execute({ 
      sql: `INSERT INTO audit (company_id, user_id, action, entity, entity_id, payload, ip, ua) VALUES (?,?,?,?,?,?,?,?)`,
      args: [companyId, userId || null, action, entity, entityId || null, payload ? JSON.stringify(payload) : null, req?.ip || null, req?.headers?.['user-agent'] || null]
    });
  } catch (e) { 
    console.error('[audit] error', e.name||'Error'); 
  }
}
