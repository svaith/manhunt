import test from 'node:test';
import assert from 'node:assert/strict';
import {compassHeading,proximityTransition} from '../v2.js';
test('compass uses absolute headings only and supports iOS and screen rotation',()=>{
 assert.equal(compassHeading({webkitCompassHeading:90}),90);
 assert.equal(compassHeading({alpha:90,absolute:true}),270);
 assert.equal(compassHeading({alpha:90,absolute:false}),null);
 assert.equal(compassHeading({webkitCompassHeading:350},90),80);
 assert.equal(compassHeading({webkitCompassHeading:90,webkitCompassAccuracy:-1}),null);
});
test('nearby warning triggers once, survives stale GPS and rearms only after clear',()=>{
 assert.equal(proximityTransition(false,false,true,false).notify,false);
 let s=proximityTransition(false,true,true,false);assert.equal(s.notify,true);
 s=proximityTransition(s.latched,true,true,false);assert.equal(s.notify,false);
 s=proximityTransition(s.latched,true,null,false);assert.equal(s.latched,true);
 s=proximityTransition(s.latched,true,false,true);assert.equal(s.latched,false);
 assert.equal(proximityTransition(s.latched,true,true,false).notify,true);
});
