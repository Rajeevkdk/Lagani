import {spawnSync} from 'node:child_process';
import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import pg from 'pg';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(process.platform!=='win32')throw new Error('Use docker compose up -d postgres, or supply DATABASE_URL for your PostgreSQL server.');
const native=resolve(root,'node_modules/@embedded-postgres/windows-x64/native/bin');
const runtime=resolve(root,'.runtime');const data=resolve(runtime,'postgres');
mkdirSync(runtime,{recursive:true});
const run=(name,args)=>{const result=spawnSync(resolve(native,name+'.exe'),args,{stdio:'inherit',windowsHide:true});if(result.status!==0)throw new Error(`${name} failed (${result.status})`);};
if(process.argv[2]==='stop'){run('pg_ctl',['-D',data,'stop','-m','fast']);process.exit(0);}
if(!existsSync(resolve(data,'PG_VERSION'))){const password=resolve(runtime,'db-password');writeFileSync(password,'lagani_local_only');run('initdb',['-D',data,'-U','lagani','-A','scram-sha-256','--pwfile='+password,'--encoding=UTF8','--locale=C']);}
const status=spawnSync(resolve(native,'pg_ctl.exe'),['-D',data,'status'],{windowsHide:true,stdio:'ignore'});
if(status.status!==0)run('pg_ctl',['-D',data,'-l',resolve(runtime,'postgres.log'),'-o','-h 127.0.0.1 -p 54322 -c shared_buffers=32MB -c max_connections=50','start']);
const client=new pg.Client({connectionString:process.env.DATABASE_URL||'postgresql://lagani:lagani_local_only@127.0.0.1:54322/postgres'});
await client.connect();
if(!(await client.query("SELECT 1 FROM pg_database WHERE datname='lagani'")).rowCount)await client.query('CREATE DATABASE lagani');
await client.end();console.log('Local PostgreSQL ready on 127.0.0.1:54322. Run npm run db:migrate and npm run db:seed.');
