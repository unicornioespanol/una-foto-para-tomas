import { readFile,mkdir } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
export function postgresOptions(url,production=process.env.NODE_ENV==='production'){
  let parsed;try{parsed=new URL(url)}catch{throw new Error('Invalid DATABASE_URL')}
  if(!['postgres:','postgresql:'].includes(parsed.protocol))throw new Error('DATABASE_URL must use PostgreSQL');
  if(production){
    const p=parsed.searchParams;
    if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0'||['disable','no-verify','prefer','verify-ca'].includes(p.get('sslmode'))||['0','false','no-verify'].includes(p.get('ssl'))||p.get('uselibpqcompat')==='true')throw new Error('Production database requires verified TLS');
    p.delete('ssl');p.set('sslmode','verify-full');
  }
  return {connectionString:parsed.href,enableChannelBinding:true,max:5,connectionTimeoutMillis:15000,idleTimeoutMillis:10000};
}
export async function openDatabase({url=process.env.DATABASE_URL,localPath=process.env.DEV_DATABASE_PATH??'runtime/dev-postgres'}={}){
  if(url){
    const {Pool}=await import('pg');const pool=new Pool(postgresOptions(url));
    pool.on('error',()=>console.error('database_pool_error'));
    return {kind:'pg',query:(sql,args=[])=>pool.query(sql,args),exec:sql=>pool.query(sql),close:()=>pool.end(),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await fn({query:(sql,args=[])=>c.query(sql,args),exec:sql=>c.query(sql)});await c.query('COMMIT');return result}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}};
  }
  if(process.env.NODE_ENV==='production')throw new Error('DATABASE_URL is required in production');
  if(localPath!==':memory:')await mkdir(dirname(resolve(localPath)),{recursive:true});
  const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite(localPath===':memory:'?undefined:localPath);await db.waitReady;
  return {kind:'pglite',query:(sql,args=[])=>db.query(sql,args),exec:sql=>db.exec(sql),close:()=>db.close(),transaction:fn=>db.transaction(tx=>fn({query:(sql,args=[])=>tx.query(sql,args),exec:sql=>tx.exec(sql)}))};
}
export async function migrate(db,project='tomas'){
  const sql=await readFile(new URL('./migrations/001_research.sql',import.meta.url),'utf8');
  await db.transaction(async tx=>{
    // One transaction and a transaction-scoped lock also work with Neon pooling.
    if(db.kind==='pg')await tx.query('SELECT pg_advisory_xact_lock(20261103,1)');
    await tx.exec(sql);
    await tx.query('INSERT INTO research_settings(project_id) VALUES($1) ON CONFLICT DO NOTHING',[project]);
  });
}
