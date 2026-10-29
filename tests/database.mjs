import {CAMPUS_PATH_POINTS} from '../campus-paths.js';
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
await check('viewer-specific hunter visibility on polls and reconnect',async()=>{
 for(const i of [0,1]){
  for(const snapshot of [await action(i,code,'poll',gps),await enter(i,'Reconnect',code)]){
   const me=snapshot.players.find(p=>p.id===ids[i]);const hunter=snapshot.players.find(p=>p.role==='hunter');
   assert.equal(hunter.lat,me.role==='hunter'?gps.lat:null);
   const runner=snapshot.players.find(p=>p.role==='runner');assert.equal(runner.lat,gps.lat);
   assert.ok(snapshot.players.every(p=>!('ping' in p)));
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
await check('expired room ends and clears locations',async()=>{s=await enter(0,'Host');code=s.code;await db.query("update public.manhunt_rooms set expires_at=now()-interval '1 second' where code=$1",[code]);s=await action(0,code);assert.equal(s.phase,'finished');});
await check('starting circle rejects an outside start',async()=>{
 s=await enter(0,'Host');code=s.code;await enter(1,'Runner',code);
 await action(0,code,'poll',gps);
 await action(1,code,'poll',{lat:38.993,lng:-76.957,accuracy:10});
 await assert.rejects(()=>action(0,code,'start',{hunters:1}),/starting circle/);
 await action(0,code,'end');
});
await check('runners are live to hunters and runners on polls and reconnects; legacy pings ignored',async()=>{
 s=await enter(0,'Host');code=s.code;await enter(1,'Runner',code);await enter(2,'Runner 2',code);
 await edit(code,s=>{s.phase='active';s.deadline=stamp()+300;s.players[0].role='hunter';for(const p of s.players)Object.assign(p,gps,{updated:stamp(),ping:{...gps,updated:stamp()-100}});});
 const moved={...gps,lat:gps.lat+.001};s=await action(1,code,'poll',moved);assert.equal(s.players[1].lat,moved.lat);
 for(const i of [0,2])for(const view of [await action(i,code),await enter(i,'Reconnect',code)]){
  assert.equal(view.players[1].lat,moved.lat);assert.equal(view.players[1].location_kind,'live');assert.ok(!('ping' in view.players[1]));
  if(i===2)assert.equal(view.players[0].lat,null);
 }
 const newer={...gps,lat:gps.lat+.002};await action(1,code,'poll',newer);s=await action(2,code);assert.equal(s.players[1].lat,newer.lat);
 await action(0,code,'end');
});
await check('nearby warning is hunt-only, private, fresh, and uses 30m entry/40m reset',async()=>{
 code=await active();
 await edit(code,s=>{s.phase='headstart';s.deadline=stamp()+300;for(const p of s.players)Object.assign(p,gps,{updated:stamp()});});
 s=await action(1,code);assert.equal(s.hunter_nearby,null);
 await edit(code,s=>s.phase='active');s=await action(1,code);assert.equal(s.hunter_nearby,true);assert.equal(s.hunters_clear,false);assert.equal(s.players[0].lat,null);
 await edit(code,s=>s.players[0].lat=gps.lat+.00031);s=await action(1,code);assert.equal(s.hunter_nearby,false);assert.equal(s.hunters_clear,false);
 await edit(code,s=>s.players[0].lat=gps.lat+.0005);s=await action(1,code);assert.equal(s.hunters_clear,true);
 await edit(code,s=>s.players[0].updated=stamp()-31);s=await action(1,code);assert.equal(s.hunters_clear,false);
 await action(0,code,'end');
});
await check('hunter teammates are live, runners cannot see hunter GPS or cached pings',async()=>{
 s=await enter(0,'Host');code=s.code;await enter(1,'Hunter',code);await enter(2,'Runner',code);
 await edit(code,s=>{s.phase='active';s.deadline=stamp()+300;for(const p of s.players)Object.assign(p,gps,{updated:stamp(),ping:{...gps,updated:stamp()}});s.players[0].role='hunter';s.players[1].role='hunter';});
 s=await action(0,code);assert.equal(s.players[1].lat,gps.lat);assert.equal(s.players[1].location_kind,'live');
 s=await action(2,code);assert.ok(s.players.filter(p=>p.role==='hunter').every(p=>p.lat===null&&!('ping' in p)));
 await action(0,code,'end');
});
await check('host can choose exact hunters and invalid selections are rejected',async()=>{
 s=await enter(0,'Host');code=s.code;await enter(1,'Player',code);await enter(2,'Player 2',code);
 for(const i of [0,1,2])await action(i,code,'poll',gps);
 await assert.rejects(()=>action(0,code,'start',{hunters:2,selection:'manual',hunter_ids:[ids[1],ids[1]]}),/different hunters/);
 await assert.rejects(()=>action(0,code,'start',{hunters:1,selection:'manual',hunter_ids:['outsider']}),/not in this lobby/);
 await assert.rejects(()=>action(0,code,'start',{hunters:1,selection:'manual',hunter_ids:[]}),/different hunters/);
 s=await action(0,code,'start',{hunters:1,selection:'manual',hunter_ids:[ids[1]]});
 assert.equal(s.players.find(p=>p.id===ids[1]).role,'hunter');assert.equal(s.players.find(p=>p.id===ids[0]).role,'runner');
 await action(0,code,'end');
});
await check('southern destination is reachable and hidden from clients',async()=>{
 let c={lat:38.9897,lng:-76.9436,radius:800,target:{lat:38.9835,lng:-76.9445}};
 for(let i=0;i<25;i++){
  const next=(await db.query('select public.manhunt_next($1) as c',[c])).rows[0].c;
  const d=(await db.query('select public.manhunt_distance($1,$2) as d',[c,next])).rows[0].d;
  assert.ok(d+next.radius<=c.radius+.01);c=next;
 }
 assert.ok(c.lat<38.984);
 s=await enter(0,'Host');code=s.code;assert.ok(!('target' in s.next));assert.ok(!('target' in s.circle));await action(0,code,'end');
});
await check('power-up first claim, stacking, private reveal, expiry and infection',async()=>{
 s=await enter(0,'Host');code=s.code;await enter(1,'Runner',code);await enter(2,'Other runner',code);
 await edit(code,s=>{s.phase='active';s.round=2;s.deadline=stamp()+300;s.players[0].role='hunter';for(const p of s.players)Object.assign(p,gps,{updated:stamp()});s.powerup={...gps,radius:20,spawned_at:stamp()-1};});
 await action(0,code,'poll',gps);s=await action(1,code);assert.ok(s.powerup); // No pickup without a new GPS fix.
 s=await action(1,code,'poll',{...gps,accuracy:50});assert.ok(s.powerup);
 s=await action(1,code,'poll',gps);assert.equal(s.powerup,null);assert.equal(s.players[1].powerups,1);
 s=await action(2,code,'poll',gps);assert.equal(s.players[2].powerups||0,0);assert.ok(!('powerups' in s.players[1]));
 await assert.rejects(()=>action(2,code,'reveal'),/power|reveal|item/i);
 await edit(code,s=>s.powerup={...gps,radius:20,spawned_at:stamp()-1});
 s=await action(1,code,'poll',gps);assert.equal(s.players[1].powerups,2);assert.equal(s.players[1].stats.collected,2);
 s=await action(1,code,'reveal');assert.equal(s.players[1].powerups,1);assert.equal(s.players[0].lat,gps.lat);const until=s.players[1].reveal_until;
 s=await enter(1,'Reconnect',code);assert.equal(s.players[0].lat,gps.lat);
 s=await action(2,code);assert.equal(s.players[0].lat,null);assert.ok(!('reveal_until' in s.players[1]));
 s=await action(1,code,'reveal');assert.equal(s.players[1].reveal_until,until+60);assert.equal(s.players[1].stats.used,2);
 await edit(code,s=>s.players[1].reveal_until=stamp()-1);s=await action(1,code);assert.equal(s.players[0].lat,null);
 await edit(code,s=>{s.players[1].powerups=2;s.players[1].reveal_until=stamp()+60;});
 s=await action(1,code,'tag');assert.equal(s.players[1].powerups,0);assert.equal(s.players[1].reveal_until,null);assert.equal(s.players[1].stats.collected,2);assert.equal(s.players[1].stats.used,2);
 await action(0,code,'end');
});
await check('pickup starts at round two and is replaced at the next shrink',async()=>{
 s=await enter(0,'Host');code=s.code;await enter(1,'Runner',code);
 await edit(code,s=>{s.phase='headstart';s.deadline=stamp()-1;s.players[0].role='hunter';});
 s=await action(0,code);assert.equal(s.round,1);assert.ok(!s.powerup);
 await edit(code,s=>s.deadline=stamp()-1);s=await action(0,code);assert.equal(s.round,2);assert.equal(s.powerup.round,2);const id=s.powerup.id;
 await edit(code,s=>s.deadline=stamp()-1);s=await action(0,code);assert.equal(s.round,3);assert.notEqual(s.powerup.id,id);
 await action(0,code,'end');
});
await check('SQL pickups use bundled sidewalk samples without off-path fallback',async()=>{
 const c={lat:38.9897,lng:-76.9436,radius:571};
 for(let i=0;i<12;i++){
  const p=(await db.query('select public.manhunt_powerup($1,2,10) as p',[c])).rows[0].p;
  assert.ok(CAMPUS_PATH_POINTS.some(([lat,lng])=>lat===p.lat&&lng===p.lng));
  const d=(await db.query('select public.manhunt_distance($1,$2) as d',[c,p])).rows[0].d;assert.ok(d+20<=c.radius+.01);
 }
 const empty=(await db.query('select public.manhunt_powerup($1,3,10) as p',[{lat:0,lng:0,radius:30}])).rows[0].p;assert.equal(empty,null);
});
await check('movement estimates reject GPS noise, spikes, repeats, gaps and stale fixes',async()=>{
 async function track(p,fix,t){return (await db.query('select public.manhunt_track($1,$2,$3) as p',[p,fix,t])).rows[0].p;}
 const base={...gps,accuracy:5};let p=await track({}, {...base,captured_at:100},100);
 p=await track(p,{...base,lat:base.lat+.0001,captured_at:106},106);
 assert.ok(p.stats.distance_m>10&&p.stats.distance_m<12);assert.ok(p.stats.top_mps>1.7&&p.stats.top_mps<2);
 const distance=p.stats.distance_m,top=p.stats.top_mps;
 p=await track(p,{...base,lat:base.lat+.0001,captured_at:106},107);assert.equal(p.stats.distance_m,distance);
 p=await track(p,{...base,lat:base.lat+.00011,captured_at:112},112);assert.equal(p.stats.distance_m,distance); // Jitter below 5m.
 p=await track(p,{...base,lat:base.lat+.02,captured_at:118},118);assert.equal(p.stats.distance_m,distance); // Teleport.
 p=await track(p,{...base,lat:base.lat+.03,accuracy:50,captured_at:124},124);assert.equal(p.stats.distance_m,distance);
 p=await track(p,{...base,lat:base.lat+.03,captured_at:160},160);assert.equal(p.stats.distance_m,distance); // Tracking gap.
 p=await track(p,{...base,lat:base.lat+.0301,captured_at:161},180);assert.equal(p.stats.distance_m,distance); // Stale.
 assert.equal(p.stats.top_mps,top);
});
await check('personal stats stay private and persist after catch, reconnect and finish',async()=>{
 s=await enter(0,'Host');code=s.code;await enter(1,'Runner',code);await enter(2,'Runner 2',code);
 for(const i of [0,1,2])await action(i,code,'poll',gps);
 s=await action(0,code,'start',{hunters:1,selection:'manual',hunter_ids:[ids[0]]});
 assert.equal(s.players[0].initial_hunter,true);assert.equal(s.players[0].stats.distance_m,0);assert.ok(!('stats' in s.players[1]));
 await edit(code,s=>{s.players[1].stats={distance_m:123,top_mps:3,collected:2,used:1};s.players[1].stats_anchor={...gps,time:stamp()};});
 s=await action(1,code);assert.equal(s.players[1].stats.distance_m,123);assert.ok(s.players.every(p=>!('stats_anchor' in p)));assert.ok(!('stats' in s.players[0]));
 s=await action(1,code,'tag');const caught=s.players[1].caught_at;assert.ok(caught>=s.started_at);
 s=await action(1,code,'tag');assert.equal(s.players[1].caught_at,caught);
 s=await action(2,code,'tag');assert.equal(s.phase,'finished');const ended=s.ended_at;assert.ok(ended>=caught);
 s=await enter(1,'Reconnect',code);assert.equal(s.players[1].stats.distance_m,123);assert.equal(s.players[1].stats.collected,2);assert.equal(s.players[1].stats.used,1);assert.equal(s.players[1].caught_at,caught);
 assert.ok(s.players.every(p=>p.lat===null&&!('stats_anchor' in p)));assert.ok(!('stats' in s.players[2]));
 s=await action(0,code);assert.equal(s.ended_at,ended);assert.ok(!('stats' in s.players[1]));
});
await check('simultaneous zone infections share boundary time in catch order',async()=>{
 s=await enter(0,'Host');code=s.code;await enter(1,'Runner',code);await enter(2,'Runner 2',code);
 for(const i of [0,1,2])await action(i,code,'poll',gps);
 await action(0,code,'start',{hunters:1,selection:'manual',hunter_ids:[ids[0]]});
 const boundary=stamp()-1;
 await edit(code,s=>{s.phase='active';s.round=1;s.deadline=boundary;for(const p of s.players)Object.assign(p,{lat:39.1,lng:-76.94,accuracy:10,updated:boundary-1});});
 s=await action(0,code);assert.equal(s.phase,'finished');assert.equal(s.players[1].caught_at,boundary);assert.equal(s.players[2].caught_at,boundary);assert.equal(s.players[0].caught_at,undefined);
});
await check('leaving is distinct from being caught and stores its timestamp',async()=>{
 s=await enter(0,'Host');code=s.code;await enter(1,'Runner',code);await enter(2,'Runner 2',code);
 for(const i of [0,1,2])await action(i,code,'poll',gps);
 await action(0,code,'start',{hunters:1,selection:'manual',hunter_ids:[ids[0]]});
 s=await action(1,code,'leave');assert.equal(s.players[1].caught_at,undefined);assert.ok(s.players[1].left_at>=s.started_at);await action(0,code,'end');
});
console.log(`${count} database checks passed`);await db.close();
