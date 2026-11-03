// Local PostgreSQL utilities. Secrets are passed via child environment, never argv.
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {access,mkdir,mkdtemp,copyFile,unlink,rmdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname} from 'node:path';
import {openDatabase,postgresOptions} from '../server/db.mjs';

const [command,file]=process.argv.slice(2);
let staging;
try{
  if(!['dump','restore'].includes(command)||!file)throw new Error('Usage: node tools/pg-tool.mjs dump|restore FILE');
  const url=new URL(postgresOptions(process.env.DATABASE_URL,true).connectionString),target=resolve(file);
  if(command==='dump'){
    try{await access(target);throw new Error('Backup file already exists')}catch(error){if(error.code!=='ENOENT')throw error}
    await mkdir(dirname(target),{recursive:true});
  }else{
    await access(target);const db=await openDatabase();
    try{const {rows:[r]}=await db.query("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','S','f')");if(Number(r.count)!==0)throw new Error('Restore requires an empty separate database')}finally{await db.close()}
  }
  const program=command==='dump'?'pg_dump':'pg_restore',binary=process.env.PG_BIN_DIR?join(process.env.PG_BIN_DIR,program+(process.platform==='win32'?'.exe':'')):program;
  const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGSSLMODE:'verify-full',PGSSLROOTCERT:url.searchParams.get('sslrootcert')??process.env.PGSSLROOTCERT??'system',PGCHANNELBINDING:'prefer',PGAPPNAME:'tomas-local-backup'};
  // DATABASE_URL isn't used by libpq; don't copy it to utility diagnostics.
  delete env.DATABASE_URL;
  // Native Windows libpq tools can lose accents in absolute argv paths.
  // Stage a fixed ASCII basename, pass cwd via the OS, then copy with Node.
  // Keep the plaintext staging copy on the same protected disk as the backup.
  staging=await mkdtemp(join(dirname(target),'.tomas-backup-'));
  if(command==='restore')await copyFile(target,join(staging,'archive.dump'));
  const args=command==='dump'?['--format=custom','--no-owner','--no-privileges','--file','archive.dump']:['--exit-on-error','--single-transaction','--no-owner','--no-privileges','--dbname',env.PGDATABASE,'archive.dump'];
  const code=await new Promise((ok,no)=>{const child=spawn(binary,args,{cwd:staging,env,stdio:['ignore','ignore','pipe']});child.stderr.resume();child.once('error',no);child.once('exit',ok)});
  if(code!==0)throw new Error('PostgreSQL utility failed');
  if(command==='dump')await copyFile(join(staging,'archive.dump'),target,constants.COPYFILE_EXCL);
  console.log(command==='dump'?'Backup written locally. Encrypt and verify a restore before relying on it.':'Restore completed in the empty target database.');
}catch{console.error('Backup/restore failed: check PostgreSQL client version, TLS roots, local file and empty restore target. Secrets and utility output withheld.');process.exitCode=1}
finally{if(staging){await unlink(join(staging,'archive.dump')).catch(()=>{});await rmdir(staging).catch(()=>{})}}
