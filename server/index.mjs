import { openDatabase,migrate } from './db.mjs';
import { createApp } from './app.mjs';
import { retention } from './retention.mjs';
const project=process.env.RESEARCH_PROJECT_ID??'tomas';
let db;
try{db=await openDatabase();await migrate(db,project);await retention(db,project)}catch{if(db)await db.close();console.error('database_startup_failed: check DATABASE_URL, TLS and migrations');process.exit(1)}
let app;try{app=await createApp(db)}catch{await db.close();console.error('server_configuration_failed: check PUBLIC_ORIGIN and TELEMETRY_MODE');process.exit(1)}
const server=app.listen(Number(process.env.PORT??3000),process.env.HOST??'0.0.0.0',()=>console.log(`Book server ready · telemetry ${process.env.TELEMETRY_MODE??'off'}`));
const timer=setInterval(()=>retention(db,project).catch(()=>console.error('retention_failed')),86400000);timer.unref();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearInterval(timer);server.close(async()=>{await db.close();process.exit(0)})});
