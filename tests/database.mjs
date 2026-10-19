import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`);
await db.exec(await readFile(new URL('../supabase.sql', import.meta.url),'utf8'));
const ids=['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003'];
async function as(i){await db.query("select set_config('test.uid',$1,false)",[i==null?'':ids[i]]);}
async function enter(i,name,code=null){await as(i);return (await db.query('select public.manhunt_enter($1,$2) as s',[name,code])).rows[0].s;}
async function action(i,code,type='poll',payload={}){await as(i);return(await db.query('select public.manhunt_action($1,$2,$3) as s',[code,type,payload])).rows[0].s;}
async function edit(code,fn){const s=(await db.query('select state from public.manhunt_rooms where code=$1',[code])).rows[0].state;fn(s);await db.query('update public.manhunt_rooms set state=$1 where code=$2',[s,code]);}
const stamp=()=>Date.now()/1000;
let count=0;async function check(name,fn){await fn();console.log('PASS',name);count++;}
await check('authentication required',async()=>{await as(null);await assert.rejects(()=>db.query("select public.manhunt_enter('No auth',null)"),/Sign in/);});
let s=await enter(0,'Host'),code=s.code;
await check('room membership enforced',async()=>{await assert.rejects(()=>action(2,code),/not a member/);});
await enter(1,'Runner',code);
await check('non-host cannot start',async()=>{await assert.rejects(()=>action(1,code,'start',{hunters:1}),/Only the host/);});
await check('start requires GPS',async()=>{await assert.rejects(()=>action(0,code,'start',{hunters:1}),/fresh GPS/);});
const gps={lat:38.9897,lng:-76.9436,accuracy:10};
await action(0,code,'poll',gps);await action(1,code,'poll',gps);
await check('random assignment and headstart',async()=>{s=await action(0,code,'start',{hunters:1});assert.equal(s.phase,'headstart');assert.equal(s.players.filter(p=>p.role==='hunter').length,1);assert.equal(s.deadline-s.server_now,300);});
await check('hunters only see their own coordinates; others still hidden',async()=>{
 for(const i of [0,1]){
  for(const snapshot of [await action(i,code,'poll',gps),await enter(i,'Reconnect',code)]){
   const meId=ids[i];
   const hunter=snapshot.players.find(p=>p.role==='hunter');
   const runner=snapshot.players.find(p=>p.role==='runner');
   if(hunter.id===meId){
    assert.notEqual(hunter.lat,null);assert.notEqual(hunter.lng,null);
    assert.notEqual(hunter.accuracy,null);assert.notEqual(hunter.updated,null);
   }else{
    assert.equal(hunter.lat,null);assert.equal(hunter.lng,null);
    assert.equal(hunter.accuracy,null);assert.equal(hunter.updated,null);
   }
   assert.equal(runner.lat,gps.lat);assert.equal(runner.lng,gps.lng);
  }
 }
});
await check('late joins closed and existing membership reconnects',async()=>{await assert.rejects(()=>enter(2,'Late',code),/already started/);const re=await enter(1,'Runner',code);assert.equal(re.players.length,2);});
await check('headstart ends without shrinking',async()=>{await edit(code,s=>s.deadline=stamp()-1);s=await action(0,code);assert.equal(s.phase,'active');assert.equal(s.round,1);assert.equal(s.circle.radius,800);});
await check('outside player infected at shrink, final locations cleared',async()=>{await edit(code,s=>{s.deadline=stamp()-1;for(const p of s.players){p.lat=39.1;p.lng=-76.94;p.updated=stamp()-2;p.accuracy=10;}});s=await action(0,code);assert.equal(s.phase,'finished');assert.ok(s.players.every(p=>p.role==='hunter'&&p.lat===null));});
await check('direct table access denied',async()=>{await db.exec('set role authenticated');await assert.rejects(()=>db.query('select * from public.manhunt_rooms'),/permission denied/);await db.exec('reset role');});
async function active(){let s=await enter(0,'Host');await enter(1,'Runner',s.code);await edit(s.code,s=>{s.phase='active';s.round=1;s.deadline=stamp()-1;s.players[0].role='hunter';});return s.code;}
code=await active();
await check('stale GPS gets grace, accurate inside GPS resolves it',async()=>{s=await action(0,code);assert.ok(s.players[1].pending_until>stamp());assert.equal(s.players[1].role,'runner');const c=s.circle;s=await action(1,code,'poll',{lat:c.lat,lng:c.lng,accuracy:10});assert.equal(s.players[1].pending_until,null);assert.equal(s.players[1].role,'runner');});
await check('missed grace infects without accepting a late GPS fix',async()=>{await edit(code,s=>s.players[1].pending_until=stamp()-1);s=await action(1,code,'poll',gps);assert.equal(s.phase,'finished');assert.equal(s.players[1].reason,'Location disconnected');assert.equal(s.players[1].lat,null);});
code=await active();
await check('low accuracy does not clear grace',async()=>{s=await action(1,code,'poll',{...gps,accuracy:200});assert.ok(s.players[1].pending_until);});
await check('tag is irreversible and end clears positions',async()=>{s=await action(1,code,'tag');assert.equal(s.phase,'finished');assert.ok(s.players.every(p=>p.lat===null));});
code=await active();
await check('leave forfeits and clears location',async()=>{s=await action(1,code,'leave');assert.equal(s.players[1].left,true);assert.equal(s.players[1].lat,null);assert.equal(s.phase,'finished');});
code=await active();
await check('host leave ends room',async()=>{s=await action(0,code,'leave');assert.equal(s.phase,'finished');});
code=await active();
await check('runner gets hunter proximity alerts without hunter coordinates',async()=>{
 await edit(code,s=>{
  const hunter=s.players[0],runner=s.players[1];
  hunter.role='hunter';runner.role='runner';
  hunter.lat=38.9898;hunter.lng=-76.9436;hunter.updated=stamp()-1;hunter.accuracy=10;
  runner.lat=38.98975;runner.lng=-76.94358;runner.updated=stamp()-1;runner.accuracy=10;
 });
 const runnerView=await action(1,code,'poll',gps);
 const hunterView=await action(0,code,'poll',gps);
 assert.equal(runnerView.hunter_nearby,true);
 assert.equal(runnerView.players.find(p=>p.role==='hunter').lat,null);
 assert.equal(hunterView.hunter_nearby,false);
});
await check('expired room ends and clears locations',async()=>{s=await enter(0,'Host');code=s.code;await db.query("update public.manhunt_rooms set expires_at=now()-interval '1 second' where code=$1",[code]);s=await action(0,code);assert.equal(s.phase,'finished');});
await check('starting circle rejects an outside start',async()=>{
 s=await enter(0,'Host');code=s.code;await enter(1,'Runner',code);
 await action(0,code,'poll',gps);
 await action(1,code,'poll',{lat:38.993,lng:-76.957,accuracy:10});
 await assert.rejects(()=>action(0,code,'start',{hunters:1}),/starting circle/);
 await action(0,code,'end');
});
console.log(`${count} database checks passed`);await db.close();
