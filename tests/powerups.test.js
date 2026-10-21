import test from 'node:test';
import {CAMPUS_PATH_POINTS} from '../campus-paths.js';
import assert from 'node:assert/strict';
import {CAMPUS,distance,demoState,spawnPowerup,collectDemoPowerup,activateDemoReveal,revealActive} from '../game.js';
import {onCampus} from '../game.js';
test('pickup is on campus and inside its circle',()=>{for(let i=0;i<100;i++){const p=spawnPowerup(CAMPUS,2,10);assert.ok(CAMPUS_PATH_POINTS.some(([lat,lng])=>lat===p.lat&&lng===p.lng));assert.ok(onCampus(p));assert.ok(distance(p,CAMPUS)+20<=CAMPUS.radius+.01);}});
test('only first fresh runner collects; items stack and activation extends privately',()=>{
 const s=demoState(0);s.phase='active';const p=s.players.find(p=>p.id==='me');
 const spawn=()=>{s.powerup={...CAMPUS,spawned_at:10};Object.assign(p,{...CAMPUS,accuracy:10,updated:10});};
 spawn();p.accuracy=50;assert.equal(collectDemoPowerup(s,'me',10),false);p.accuracy=10;
 assert.equal(collectDemoPowerup(s,'me',26),false);assert.equal(collectDemoPowerup(s,'me',10),true);assert.equal(collectDemoPowerup(s,'me',10),false);
 spawn();assert.equal(collectDemoPowerup(s,'me',10),true);assert.equal(p.powerups,2);
 assert.equal(activateDemoReveal(s,'me',11),true);assert.equal(p.reveal_until,71);assert.equal(revealActive(s,'me',70),true);assert.equal(revealActive(s,'b',12),false);
 activateDemoReveal(s,'me',12);assert.equal(p.reveal_until,131);assert.equal(revealActive(s,'me',131),false);assert.equal(activateDemoReveal(s,'me',12),false);
});


test('no off-path fallback when the circle contains no eligible path sample',()=>{
 assert.equal(spawnPowerup({lat:0,lng:0,radius:30},3,10),null);
 assert.equal(spawnPowerup({...CAMPUS,radius:0},3,10),null);
});
