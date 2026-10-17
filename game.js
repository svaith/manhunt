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
export function nextCircle(c, random = Math.random) {
  const radius = Math.max(0, c.radius * .72 - 5);
  for(let attempt=0;attempt<40;attempt++){
    const angle = random()*2*Math.PI;
    const shift = (.45+.53*Math.sqrt(random()))*(c.radius-radius);
    const n={ radius, lat:c.lat+Math.sin(angle)*shift/111320, lng:c.lng+Math.cos(angle)*shift/(111320*Math.cos(c.lat*Math.PI/180)) };
    if(onCampus(n))return n;
  }
  return {...c,radius};
}
export function fresh(p, now) { return p.lat != null && p.updated != null && now-p.updated <= 30; }
export function outside(p,c) { return distance(p,c)>c.radius+20; }
export function formatTime(seconds) {
  const s=Math.max(0,Math.ceil(seconds)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
export function demoState(now) {
  return {code:'DEMO',host:'me',phase:'headstart',round:0,deadline:now+300,circle:{...CAMPUS},next:nextCircle(CAMPUS),players:[
    {id:'me',name:'You',role:'runner',lat:38.9881,lng:-76.9447,updated:now},
    {id:'a',name:'Alex',role:'hunter',lat:38.9923,lng:-76.9457,updated:now},
    {id:'b',name:'Jordan',role:'runner',lat:38.9858,lng:-76.9461,updated:now},
    {id:'c',name:'Sam',role:'runner',lat:38.9905,lng:-76.938,updated:now},
    {id:'d',name:'Riley',role:'runner',lat:38.995,lng:-76.9419,updated:now}
  ]};
}
export function advanceDemo(s, now) {
  if (s.phase==='finished') return s;
  if(s.phase==='headstart'){s.phase='active';s.round=1;}
  else {s.circle=s.next;s.next=nextCircle(s.circle);s.round++;}
  s.deadline=now+300;
  for(const p of s.players){p.updated=now;if(p.role==='runner'&&outside(p,s.circle)){p.role='hunter';p.reason='Outside the circle';}}
  if(s.players.every(p=>p.role==='hunter')){s.phase='finished';s.deadline=null;for(const p of s.players){p.lat=null;p.lng=null;p.updated=null;}}
  return s;
}
