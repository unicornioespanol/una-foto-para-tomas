import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { token,digest,hashPassword,verifyPassword,cookieOptions,csvCell } from './security.mjs';
import { validateEvent } from './events.mjs';
import { filteredEvents,aggregate } from './analytics.mjs';
const scope='page activity, audio, choices, learning tasks and album option IDs';
const uuid=z.string().uuid();
function fail(status,code){throw Object.assign(new Error(code),{status})}
export async function createApp(db,{project=process.env.RESEARCH_PROJECT_ID??'tomas',mode=process.env.TELEMETRY_MODE??'off',origin=process.env.PUBLIC_ORIGIN??'http://127.0.0.1:3000',production=process.env.NODE_ENV==='production'}={}){
  if(!['off','debug','research'].includes(mode))throw new Error('Invalid telemetry mode');
  if(production){let parsed;try{parsed=new URL(origin)}catch{throw new Error('Invalid PUBLIC_ORIGIN')}if(parsed.protocol!=='https:'||parsed.origin!==origin)throw new Error('Production requires PUBLIC_ORIGIN with HTTPS and no path');}
  const app=express();app.disable('x-powered-by');if(process.env.TRUST_PROXY)app.set('trust proxy',Number(process.env.TRUST_PROXY));
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],imgSrc:["'self'",'data:','blob:'],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"]}}}));
  app.use(cookieParser());app.use(express.json({limit:'70kb',strict:true}));
  app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next()});
  const cookies=cookieOptions(production);const dummyHash=await hashPassword(token());
  app.get('/api/csrf',(req,res)=>{const existing=req.cookies.book_csrf;const csrf=/^[A-Za-z0-9_-]{43}$/.test(existing??'')?existing:token();res.cookie('book_csrf',csrf,{...cookies,maxAge:86400000});res.json({csrf})});
  app.use('/api',(req,res,next)=>{
    if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
    if(req.get('origin')!==origin)return res.status(403).json({error:'origin'});
    const header=req.get('x-csrf-token')??'',cookie=req.cookies.book_csrf??'';
    if(!header||header.length!==cookie.length||!timingSafeEqual(Buffer.from(header),Buffer.from(cookie)))return res.status(403).json({error:'csrf'});next();
  });
  app.get('/api/health',(_req,res)=>res.json({ok:true}));
  app.get('/api/config',async(_req,res)=>{const {rows:[settings]}=await db.query('SELECT idle_ms,method_version,consent_version FROM research_settings WHERE project_id=$1',[project]);res.json({mode,project_id:project,...settings})});
  async function reader(req,{expired=false}={}){
    const hash=digest(req.cookies.book_reader??'');
    const {rows:[r]}=await db.query(`SELECT t.*,c.status,c.version,c.granted_at,p.project_id,p.deletion_status FROM participant_tokens t JOIN research_consents c ON c.id=t.consent_id JOIN research_participants p ON p.id=t.participant_id WHERE t.token_hash=$1 ${expired?'':'AND t.expires_at > now()'}`,[hash]);
    if(!r||r.project_id!==project||r.deletion_status!=='active')fail(401,'reader_session');return r;
  }
  const auth=async(req,res,next)=>{
    const {rows:[a]}=await db.query('SELECT s.*,u.project_id,u.role,u.username FROM admin_sessions s JOIN admin_users u ON u.id=s.admin_id WHERE s.token_hash=$1 AND s.expires_at>now()',[digest(req.cookies.book_admin??'')]);
    if(!a)return res.status(401).json({error:'admin_session'});if(a.project_id!==project||a.role!=='admin')return res.status(403).json({error:'admin_scope'});req.admin=a;next();
  };
  const audit=(a,action,targetId=null)=>db.query('INSERT INTO admin_audit_log(id,admin_id,project_id,action,target_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),a.admin_id,project,action,targetId]);
  const loginLimit=rateLimit({windowMs:15*60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false});
  app.post('/api/admin/auth/login',loginLimit,async(req,res)=>{
    const {username,password}=z.object({username:z.string().min(1).max(80),password:z.string().min(1).max(200)}).strict().parse(req.body);
    const {rows:[a]}=await db.query('SELECT * FROM admin_users WHERE username=$1 AND project_id=$2',[username,project]);
    const valid=await verifyPassword(password,a?.password_hash??dummyHash);if(!a||!valid)return res.status(401).json({error:'invalid_credentials'});
    const t=token(),csrf=token();await db.query('INSERT INTO admin_sessions(token_hash,admin_id,expires_at,csrf) VALUES($1,$2,$3,$4)',[digest(t),a.id,new Date(Date.now()+8*3600000).toISOString(),csrf]);res.cookie('book_admin',t,{...cookies,maxAge:8*3600000});res.json({authenticated:true});
  });
  app.get('/api/admin/auth/session',auth,(req,res)=>res.json({authenticated:true,username:req.admin.username,project_id:project}));
  app.post('/api/admin/auth/logout',auth,async(req,res)=>{await db.query('DELETE FROM admin_sessions WHERE token_hash=$1',[digest(req.cookies.book_admin)]);res.clearCookie('book_admin',cookies);res.json({ok:true})});
  app.post('/api/admin/research/invitations',auth,async(req,res)=>{
    z.object({adult_consent_recorded:z.literal(true)}).strict().parse(req.body);
    const code=token(),{rows:[settings]}=await db.query('SELECT consent_version FROM research_settings WHERE project_id=$1',[project]);
    await db.query('INSERT INTO consent_grants(code_hash,project_id,version,scope,method,expires_at) VALUES($1,$2,$3,$4,$5,$6)',[digest(code),project,settings.consent_version,scope,'registered-adult-code',new Date(Date.now()+7*86400000).toISOString()]);await audit(req.admin,'consent_code_issued');res.json({code,expires_in_days:7});
  });
  app.post('/api/research/consents',rateLimit({windowMs:60000,limit:20}),async(req,res)=>{
    if(mode!=='research')return res.status(409).json({error:'research_disabled'});
    const {code,version}=z.object({code:z.string().min(20).max(100),version:z.string().max(90)}).strict().parse(req.body);
    const participant=randomUUID(),consent=randomUUID(),t=token();
    await db.transaction(async tx=>{
      const {rows:[grant]}=await tx.query('SELECT * FROM consent_grants WHERE code_hash=$1 AND project_id=$2 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[digest(code),project]);
      if(!grant||grant.version!==version)fail(403,'invalid_consent_code');
      await tx.query('INSERT INTO research_participants(id,project_id) VALUES($1,$2)',[participant,project]);
      await tx.query('INSERT INTO research_consents(id,participant_id,version,scope,method) VALUES($1,$2,$3,$4,$5)',[consent,participant,version,grant.scope,grant.method]);
      await tx.query('INSERT INTO participant_tokens(token_hash,participant_id,consent_id,expires_at) VALUES($1,$2,$3,$4)',[digest(t),participant,consent,new Date(Date.now()+30*86400000).toISOString()]);
      await tx.query('UPDATE consent_grants SET used_at=now() WHERE code_hash=$1',[digest(code)]);
    });res.cookie('book_reader',t,{...cookies,maxAge:30*86400000});res.json({participant_id:participant,consent_id:consent,status:'active'});
  });
  app.get('/api/research/status',async(req,res)=>{const r=await reader(req);res.json({participant_id:r.participant_id,consent_id:r.consent_id,status:r.status,expires_at:r.expires_at})});
  app.post('/api/research/consents/:id/withdraw',async(req,res)=>{
    const r=await reader(req,{expired:true});if(uuid.parse(req.params.id)!==r.consent_id)fail(403,'own_consent_only');
    await db.transaction(async tx=>{await tx.query('SELECT id FROM research_consents WHERE id=$1 FOR UPDATE',[r.consent_id]);await tx.query("UPDATE research_consents SET status='withdrawn',withdrawn_at=COALESCE(withdrawn_at,now()) WHERE id=$1",[r.consent_id]);await tx.query('INSERT INTO consent_tombstones(consent_id) VALUES($1) ON CONFLICT DO NOTHING',[r.consent_id])});res.json({status:'withdrawn'});
  });
  app.post('/api/telemetry/events',rateLimit({windowMs:60000,limit:120}),async(req,res)=>{
    if(mode!=='research')return res.status(403).json({error:'research_disabled'});
    const r=await reader(req);const batch=z.object({events:z.array(z.unknown()).min(1).max(50)}).strict().parse(req.body);const events=batch.events.map(validateEvent);
    if(Buffer.byteLength(JSON.stringify(req.body))>65536)fail(413,'batch_size');
    const accepted=await db.transaction(async tx=>{
      const {rows:[consent]}=await tx.query('SELECT status FROM research_consents WHERE id=$1 FOR UPDATE',[r.consent_id]);
      if(consent?.status!=='active'||r.status!=='active')fail(403,'consent_revoked');
      for(const e of events){
        if(e.participant_id!==r.participant_id||e.consent_id!==r.consent_id)fail(403,'participant_binding');
        const {rows:[existing]}=await tx.query('SELECT participant_id FROM reader_sessions WHERE id=$1',[e.session_id]);if(existing&&existing.participant_id!==r.participant_id)fail(403,'session_binding');
        await tx.query('INSERT INTO reader_sessions(id,participant_id,started_at,content_version) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET last_seen_at=now()',[e.session_id,r.participant_id,e.client_ts,e.content_version]);
        const {rows:[run]}=await tx.query('SELECT session_id FROM reading_runs WHERE id=$1',[e.run_id]);if(run&&run.session_id!==e.session_id)fail(403,'run_binding');
        await tx.query('INSERT INTO reading_runs(id,session_id,started_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[e.run_id,e.session_id,e.client_ts]);
        const {rows:[other]}=await tx.query('SELECT participant_id FROM telemetry_events WHERE event_id=$1',[e.event_id]);if(other&&other.participant_id!==r.participant_id)fail(403,'event_binding');
        await tx.query('INSERT INTO telemetry_events(event_id,project_id,book_id,content_version,participant_id,session_id,run_id,consent_id,event_schema_version,sequence,event_name,page_id,step_id,client_ts,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT DO NOTHING',[e.event_id,project,e.book_id,e.content_version,r.participant_id,e.session_id,e.run_id,r.consent_id,1,e.sequence,e.event,e.page_id,e.step_id,e.client_ts,JSON.stringify(e.payload)]);
        if(e.event==='choice_selected')await tx.query('UPDATE reading_runs SET route=COALESCE($1,route),ending=COALESCE($2,ending) WHERE id=$3',[e.payload.route??null,e.payload.ending??null,e.run_id]);
        if(e.event==='story_completed')await tx.query('UPDATE reading_runs SET completed_at=COALESCE(completed_at,$1),route=$2,ending=$3 WHERE id=$4',[e.client_ts,e.payload.route,e.payload.ending,e.run_id]);
      }
      // Recompute derived route fields by sequence, including late offline batches.
      for(const runId of new Set(events.map(e=>e.run_id))){
        const {rows}=await tx.query("SELECT event_name,sequence,payload,client_ts FROM telemetry_events WHERE run_id=$1 AND event_name IN ('choice_selected','story_completed') ORDER BY sequence",[runId]);
        const choices=rows.filter(e=>e.event_name==='choice_selected'),routeChoice=choices.filter(e=>e.payload.route).at(-1),endingChoice=choices.filter(e=>e.payload.ending&&e.sequence>(routeChoice?.sequence??0)).at(-1);
        const completion=rows.filter(e=>e.event_name==='story_completed'&&e.sequence>(choices.at(-1)?.sequence??0)).at(-1);
        if(rows.length)await tx.query('UPDATE reading_runs SET route=$1,ending=$2,completed_at=$3 WHERE id=$4',[routeChoice?.payload.route??completion?.payload.route??null,endingChoice?.payload.ending??completion?.payload.ending??null,completion?.client_ts??null,runId]);
      }
      return events.map(e=>e.event_id);
    });res.json({accepted_event_ids:accepted});
  });
  app.use('/api/admin',auth);
  app.get('/api/admin/research/settings',async(_req,res)=>{const {rows:[s]}=await db.query('SELECT * FROM research_settings WHERE project_id=$1',[project]);res.json(s)});
  app.patch('/api/admin/research/settings',async(req,res)=>{const p=z.object({retention_days:z.number().int().min(1).max(730),idle_ms:z.number().int().min(30000).max(600000)}).strict().parse(req.body);await db.query('UPDATE research_settings SET retention_days=$1,idle_ms=$2 WHERE project_id=$3',[p.retention_days,p.idle_ms,project]);await audit(req.admin,'settings_updated');res.json({ok:true})});
  app.delete('/api/admin/research/participants/:id',async(req,res)=>{
    const id=uuid.parse(req.params.id);z.object({confirm:z.literal('DELETE')}).strict().parse(req.body);
    await db.transaction(async tx=>{const {rows}=await tx.query('SELECT c.id FROM research_consents c JOIN research_participants p ON p.id=c.participant_id WHERE p.id=$1 AND p.project_id=$2 FOR UPDATE',[id,project]);if(!rows.length)fail(404,'participant');for(const c of rows)await tx.query('INSERT INTO consent_tombstones(consent_id) VALUES($1) ON CONFLICT DO NOTHING',[c.id]);await tx.query('DELETE FROM research_participants WHERE id=$1 AND project_id=$2',[id,project])});await audit(req.admin,'participant_deleted',id);res.json({deleted:true});
  });
  for(const name of ['summary','funnel','pages','audio','choices','tasks','sessions'])app.get(`/api/admin/analytics/${name}`,async(req,res)=>{const result=await filteredEvents(db,project,req.query);const a=aggregate(result.events,result.filters.unit);const data=name==='sessions'?a.sessions.slice(((result.filters.page??1)-1)*(result.filters.limit??25),(result.filters.page??1)*(result.filters.limit??25)):a[name];res.json({data,filters:result.filters,total:name==='sessions'?a.sessions.length:undefined,predictions:name==='tasks'?a.predictions:undefined,updated_at:a.updated_at})});
  app.get('/api/admin/analytics/sessions/:id',async(req,res)=>{const id=uuid.parse(req.params.id);const result=await filteredEvents(db,project,req.query);const events=result.events.filter(e=>e.session_id===id);if(!events.length)fail(404,'session');res.json({events,summary:aggregate(events).sessions[0],filters:result.filters})});
  app.get('/api/admin/analytics/export',async(req,res)=>{
    const {events,filters}=await filteredEvents(db,project,req.query);await audit(req.admin,'export');
    res.set('Content-Disposition',`attachment; filename="tomas-analytics.${filters.format==='csv'?'csv':'json'}"`);
    if(filters.format!=='csv')return res.json(filters.kind==='aggregates'?{filters,...aggregate(events,filters.unit)}:{filters,events});
    if(filters.kind==='aggregates'){const a=aggregate(events,filters.unit);res.type('text/csv; charset=utf-8');return res.send('\uFEFFsection,data\r\n'+Object.entries(a).map(([k,v])=>[k,JSON.stringify(v)].map(csvCell).join(',')).join('\r\n'))}
    const keys=['event_id','participant_id','session_id','run_id','event_name','page_id','step_id','sequence','active_ms','received_at','client_ts','payload'];res.type('text/csv; charset=utf-8');res.send('\uFEFF'+keys.join(',')+'\r\n'+events.map(e=>keys.map(k=>csvCell(k==='active_ms'?e.payload.active_delta_ms??'':e[k])).join(',')).join('\r\n'));
  });
  const dist=resolve('dist');app.get('/admin/analytics',(_req,res)=>res.sendFile(resolve(dist,'admin.html')));app.get('/research',(_req,res)=>res.sendFile(resolve(dist,'research.html')));app.use(express.static(dist,{index:'index.html',dotfiles:'deny',maxAge:0}));
  app.use('/api',(_req,res)=>res.status(404).json({error:'not_found'}));
  app.get('/healthz',async(_req,res)=>{try{await db.query('SELECT 1');res.json({ok:true})}catch{res.status(503).json({error:'database_unavailable'})}});
  app.use((req,res,next)=>{
    // Only document navigation may fall back. Missing audio/scripts stay 404.
    if(req.method!=='GET'||!req.accepts('html')||req.path.startsWith('/assets/')||req.path.split('/').at(-1).includes('.'))return next();
    const entry=req.path.startsWith('/admin/')?'admin.html':req.path.startsWith('/research/')?'research.html':'index.html';
    res.sendFile(resolve(dist,entry));
  });
  app.use((_req,res)=>res.status(404).json({error:'not_found'}));
  app.use((error,_req,res,_next)=>{const status=error instanceof z.ZodError?422:error.status??500;res.status(status).json({error:status>=500?'server_unavailable':error instanceof z.ZodError?'invalid_schema':error.message})});
  return app;
}
