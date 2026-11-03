export async function retention(db,project){
  return db.transaction(async tx=>{
    const {rows:[settings]}=await tx.query('SELECT retention_days FROM research_settings WHERE project_id=$1',[project]);
    const cutoff=new Date(Date.now()-settings.retention_days*86400000).toISOString();
    const count=await tx.query('DELETE FROM telemetry_events WHERE project_id=$1 AND received_at < $2 RETURNING event_id',[project,cutoff]);
    await tx.query('DELETE FROM reader_sessions WHERE participant_id IN (SELECT id FROM research_participants WHERE project_id=$1) AND last_seen_at < $2',[project,cutoff]);
    await tx.query('DELETE FROM admin_sessions WHERE expires_at < now()');await tx.query('DELETE FROM participant_tokens WHERE expires_at < now()');
    await tx.query('DELETE FROM consent_grants WHERE project_id=$1 AND expires_at < now()',[project]);
    await tx.query('DELETE FROM admin_audit_log WHERE project_id=$1 AND created_at < $2',[project,cutoff]);
    await tx.query('INSERT INTO consent_tombstones(consent_id) SELECT c.id FROM research_consents c JOIN research_participants p ON p.id=c.participant_id WHERE p.project_id=$1 AND p.created_at<$2 AND NOT EXISTS(SELECT 1 FROM reader_sessions s WHERE s.participant_id=p.id) ON CONFLICT DO NOTHING',[project,cutoff]);
    await tx.query('DELETE FROM research_participants p WHERE p.project_id=$1 AND p.created_at<$2 AND NOT EXISTS(SELECT 1 FROM reader_sessions s WHERE s.participant_id=p.id)',[project,cutoff]);
    return {deleted_events:count.rows.length};
  });
}
