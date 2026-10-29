import {CAMPUS_PATH_POINTS} from './campus-paths.js';
import {CAMPUS_RING} from './campus-boundary.js';
export {CAMPUS_RING};
export const CAMPUS = { lat: 38.9897, lng: -76.9436, radius: 800 };
export function onCampus(p) {
  let inside=false;
  for(let i=0,j=CAMPUS_RING.length-1;i<CAMPUS_RING.length;j=i++){
    const [xi,yi]=CAMPUS_RING[i],[xj,yj]=CAMPUS_RING[j];
    if((yi>p.lat)!==(yj>p.lat)&&p.lng<(xj-xi)*(p.lat-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
export const INTERVAL = 300;
export function distance(a, b) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lng-a.lng)*rad/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,h)), Math.sqrt(Math.max(0,1-h)));
}
// Equal representation for north, central, and south-campus destinations.
export const ZONE_DESTINATIONS = [
 {lat:38.9945,lng:-76.9436},{lat:38.993,lng:-76.947},
 {lat:38.989,lng:-76.943},{lat:38.988,lng:-76.947},
 {lat:38.9855,lng:-76.9425},{lat:38.9835,lng:-76.9445}
];
export function nextCircle(c, random = Math.random) {
 const radius=Math.max(0,c.radius*.72-5);
 const choices=ZONE_DESTINATIONS.filter(p=>distance(c,p)<=c.radius*.92&&onCampus(p));
 let target=c.target||choices[Math.min(choices.length-1,Math.floor(random()*choices.length))]||{lat:c.lat,lng:c.lng};
 const d=distance(c,target), room=c.radius-radius;
 const shift=Math.min(d,Math.max(d-radius,room*(.7+.28*random())));
 const rad=Math.PI/180, a=c.lat*rad, b=target.lat*rad, dl=(target.lng-c.lng)*rad;
 const bearing=Math.atan2(Math.sin(dl)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl));
 const step=shift/6371000;
 const lat=Math.asin(Math.sin(a)*Math.cos(step)+Math.cos(a)*Math.sin(step)*Math.cos(bearing));
 const lng=c.lng*rad+Math.atan2(Math.sin(bearing)*Math.sin(step)*Math.cos(a),Math.cos(step)-Math.sin(a)*Math.sin(lat));
 const n={radius,lat:lat/rad,lng:lng/rad,target};
 if(onCampus(n))return n;
 return {radius,lat:c.lat,lng:c.lng,target:{lat:c.lat,lng:c.lng}};
}
export function fresh(p, now) { return p.lat != null && p.updated != null && now-p.updated <= 30; }
export function outside(p,c) { return distance(p,c)>c.radius+20; }
export function formatTime(seconds) {
  const s=Math.max(0,Math.ceil(seconds)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
export function demoState(now) {
  return {started_at:now,code:'DEMO',host:'me',phase:'headstart',round:0,deadline:now+300,circle:{...CAMPUS},next:nextCircle(CAMPUS),players:[
    {initial_hunter:false,stats:{distance_m:1340,top_mps:5.8,collected:0,used:0},id:'me',name:'You',role:'runner',lat:38.9881,lng:-76.9447,updated:now},
    {initial_hunter:true,stats:{distance_m:980,top_mps:4.4,collected:0,used:0},id:'a',name:'Alex',role:'hunter',lat:38.9923,lng:-76.9457,updated:now},
    {initial_hunter:false,stats:{distance_m:1510,top_mps:5.1,collected:0,used:0},id:'b',name:'Jordan',role:'runner',lat:38.9858,lng:-76.9461,updated:now},
    {initial_hunter:false,stats:{distance_m:1120,top_mps:4.9,collected:0,used:0},id:'c',name:'Sam',role:'runner',lat:38.9905,lng:-76.938,updated:now},
    {initial_hunter:false,stats:{distance_m:1730,top_mps:6.1,collected:0,used:0},id:'d',name:'Riley',role:'runner',lat:38.995,lng:-76.9419,updated:now}
  ]};
}
export function advanceDemo(s, now) {
  if (s.phase==='finished') return s;
  if(s.phase==='headstart'){s.phase='active';s.round=1;}
  else {s.circle=s.next;s.next=nextCircle(s.circle);s.round++;s.powerup=spawnPowerup(s.circle,s.round,now);}
  s.deadline=now+300;
  for(const p of s.players){p.updated=now;if(p.role==='runner'&&outside(p,s.circle)){p.caught_at??=now;p.role='hunter';p.reason='Outside the circle';p.powerups=0;p.reveal_until=null;}}
  if(s.players.every(p=>p.role==='hunter')){s.ended_at??=now;s.powerup=null;s.phase='finished';s.deadline=null;for(const p of s.players){p.lat=null;p.lng=null;p.updated=null;p.powerups=0;p.reveal_until=null;}}
  return s;
}

export function spawnPowerup(c, round, now, random = Math.random) {
 // Never fall back to a random off-path location, even for tiny circles.
 const candidates=CAMPUS_PATH_POINTS.filter(([lat,lng])=>distance({lat,lng},c)<=Math.max(0,c.radius-20));
 if(!candidates.length)return null;
 const [lat,lng]=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
 const spot={lat,lng};
 return {...spot,id:`demo-${round}-${now}`,radius:20,round,spawned_at:now};
}
export function collectDemoPowerup(s,id,now){
 const p=s.players.find(p=>p.id===id);
 if(s.phase!=='active'||!s.powerup||p?.role!=='runner'||p.left||!fresh(p,now)||now-p.updated>15||p.updated<s.powerup.spawned_at||(p.accuracy??10)>30||distance(p,s.powerup)>20)return false;
 p.stats??={distance_m:0,top_mps:0,collected:0,used:0};p.stats.collected=(p.stats.collected||0)+1;p.powerups=(p.powerups||0)+1;s.powerup=null;return true;
}
export function activateDemoReveal(s,id,now){
 const p=s.players.find(p=>p.id===id);
 if(s.phase!=='active'||p?.role!=='runner'||!p.powerups)return false;
 p.stats??={distance_m:0,top_mps:0,collected:0,used:0};p.stats.used=(p.stats.used||0)+1;p.powerups--;p.reveal_until=Math.max(now,p.reveal_until||0)+60;return true;
}
export function revealActive(s,id,now){
 const p=s.players.find(p=>p.id===id);
 return s.phase==='active'&&p?.role==='runner'&&(p.reveal_until||0)>now;
}
