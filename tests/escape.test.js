import test from 'node:test';
import assert from 'node:assert/strict';
import {demoState,beginDemoEscape,reachDemoEscape,advanceDemo,distance,CAMPUS} from '../game.js';
import {CAMPUS_PATH_POINTS} from '../campus-paths.js';
function lastRunner(){const s=demoState(0);s.phase='active';for(const p of s.players)if(p.id!=='me')p.role='hunter';return s;}
test('final chase chooses a sidewalk away from the runner and stops shrinking',()=>{
 const s=lastRunner();assert.equal(beginDemoEscape(s,10,()=>.5),true);const z=s.escape,p=s.players[0];assert.equal(s.deadline,190);
 assert.ok(CAMPUS_PATH_POINTS.some(([lat,lng])=>lat===z.lat&&lng===z.lng));assert.ok(distance(p,z)>=60);assert.ok(distance(s.circle,z)+20<=s.circle.radius+.01);
 const radius=s.circle.radius;advanceDemo(s,20);assert.equal(s.circle.radius,radius);assert.equal(s.phase,'active');
});
test('entering escape wins immediately only with fresh accurate GPS',()=>{
 const s=lastRunner();beginDemoEscape(s,10);const p=s.players[0];Object.assign(p,{lat:s.escape.lat,lng:s.escape.lng,updated:11,accuracy:50});
 assert.equal(reachDemoEscape(s,'me',11),false);p.accuracy=10;assert.equal(reachDemoEscape(s,'a',11),false);assert.equal(reachDemoEscape(s,'me',30),false);
 assert.equal(reachDemoEscape(s,'me',11),true);assert.equal(s.winner,'runner');assert.equal(s.winner_id,'me');assert.ok(s.players.every(p=>p.lat===null));
});
test('timeout gives hunters the win; no finale during headstart or with multiple runners',()=>{
 let s=demoState(0);assert.equal(beginDemoEscape(s,10),false);s.phase='active';assert.equal(beginDemoEscape(s,10),false);
 s=lastRunner();beginDemoEscape(s,10);const z=s.escape;Object.assign(s.players[0],{lat:z.lat,lng:z.lng,updated:190,accuracy:10});assert.equal(reachDemoEscape(s,'me',190),false);
 advanceDemo(s,190);assert.equal(s.phase,'finished');assert.equal(s.winner,'hunters');assert.ok(s.players.every(p=>p.lat===null));
});
