import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {openDatabase,migrate} from './db.mjs';
import {hashPassword} from './security.mjs';
import {readSecret} from './terminal.mjs';
import {retention} from './retention.mjs';

let db;
try{
  const {values,positionals}=parseArgs({options:{username:{type:'string'},'password-file':{type:'string'}},allowPositionals:true});
  const command=positionals[0],project=process.env.RESEARCH_PROJECT_ID??'tomas';
  if(!['migrate','create-admin','retention','check'].includes(command))throw new Error('Use migrate | create-admin | retention | check');
  let username,password;
  if(command==='create-admin'){
    username=values.username;
    if(!username){const rl=createInterface({input:stdin,output:stdout});try{username=(await rl.question('Admin username: ')).trim()}finally{rl.close()}}
    if(!/^[a-zA-Z0-9_.-]{3,60}$/.test(username))throw new Error('Invalid username');
    if(values['password-file'])password=(await readFile(values['password-file'],'utf8')).replace(/\r?\n$/,'');
    else{password=await readSecret('Admin password (hidden, at least 16 characters): ');if(password!==await readSecret('Repeat password (hidden): '))throw new Error('Passwords do not match')}
    if(password.length<16||password.length>200||/[\r\n]/.test(password))throw new Error('Password must be 16–200 characters on one line');
  }
  db=await openDatabase();
  if(command==='check'){
    const {rows:[tls]}=db.kind==='pg'?await db.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()'):{rows:[{ssl:false}]};
    console.log(`Database reachable; adapter=${db.kind}; TLS=${tls?.ssl===true?'on':'off'}`);
  }else{
    await migrate(db,project);
    if(command==='migrate')console.log('Migrations applied.');
    if(command==='create-admin'){
      await db.query('INSERT INTO admin_users(id,project_id,username,password_hash) VALUES($1,$2,$3,$4)',[randomUUID(),project,username,await hashPassword(password)]);
      password=undefined;console.log('Administrator created. Password was not printed or logged.');
    }
    if(command==='retention')console.log(await retention(db,project));
  }
}catch(error){
  // Database errors can contain values, connection strings or participant IDs.
  const safe=['Use ','Invalid username','Password','Interactive terminal','Cancelled','Production database','DATABASE_URL','Invalid DATABASE_URL'];
  console.error(safe.some(prefix=>error.message.startsWith(prefix))?error.message:'Operation failed; check local configuration, TLS, database access and duplicate username.');process.exitCode=1;
}finally{if(db)await db.close()}
