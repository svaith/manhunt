import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPUS,ZONE_DESTINATIONS,onCampus,nextCircle,distance,formatTime,fresh,outside,demoState,advanceDemo} from '../game.js';
test('campus boundary includes core campus and excludes nearby neighborhoods and golf course',()=>{
  assert.ok(onCampus(CAMPUS));
  assert.ok(onCampus({lat:38.9957,lng:-76.9415}));
  assert.ok(!onCampus({lat:38.993,lng:-76.957}));
  assert.ok(!onCampus({lat:38.979,lng:-76.936}));
  for(let i=0;i<50;i++)assert.ok(onCampus(nextCircle(CAMPUS)));
});
test('circles shrink and stay within their previous circle',()=>{let c=CAMPUS;for(let i=0;i<80;i++){let n=nextCircle(c);assert.ok(n.radius<c.radius||c.radius===0);assert.ok(distance(c,n)+n.radius<=c.radius+1);assert.ok(Number.isFinite(n.lat));c=n;}assert.equal(c.radius,0);});
test('distance and boundary buffer',()=>{assert.equal(distance(CAMPUS,CAMPUS),0);assert.ok(outside({lat:39.1,lng:-76.94},CAMPUS));assert.ok(!outside(CAMPUS,CAMPUS));});
test('server time freshness and countdown boundaries',()=>{assert.equal(formatTime(300),'05:00');assert.equal(formatTime(-2),'00:00');assert.equal(formatTime(60.1),'01:01');assert.ok(fresh({lat:1,updated:100},130));assert.ok(!fresh({lat:1,updated:100},131));assert.ok(!fresh({lat:null,updated:100},100));});
test('head start ends before first shrink; demo eventually finishes and clears locations',()=>{let s=demoState(0);advanceDemo(s,300);assert.equal(s.phase,'active');assert.equal(s.circle.radius,800);assert.equal(s.round,1);for(let i=0;i<50&&s.phase!=='finished';i++)advanceDemo(s,600+i*300);assert.equal(s.phase,'finished');assert.ok(s.players.every(p=>p.lat===null));assert.equal(s.winner,'hunters');});

test('each north, central and south destination is reachable with nested campus circles',()=>{
 for(let k=0;k<ZONE_DESTINATIONS.length;k++){
  let first=true,c=CAMPUS;
  const random=()=>{if(first){first=false;return (k+.1)/6;}return .5;};
  for(let i=0;i<25;i++){
   const n=nextCircle(c,random);assert.ok(distance(c,n)+n.radius<=c.radius+.01);assert.ok(onCampus(n));c=n;
  }
  assert.ok(distance(c,ZONE_DESTINATIONS[k])<.1);
 }
});
