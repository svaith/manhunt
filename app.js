import {beginDemoEscape,reachDemoEscape,finishDemoState} from './game.js';
import {compassHeading, proximityTransition} from './v2.js';
import {spawnPowerup, collectDemoPowerup, activateDemoReveal, revealActive, CAMPUS, ZONE_DESTINATIONS, nextCircle, fresh, outside, formatTime, demoState, advanceDemo} from './game.js';
const $=id=>document.getElementById(id);
let client,uid,state,map,circle,next,markers=new Map(),demo=false,joinMode=false,busy=false,polling=false,watch=null,position=null,lastUpload=0,offset=0,lastSuccess=0,timerHandle,pollHandle,wakeLock;
let heading=null,headingAt=0,compassOn=false,nearLatch=false;
let selectedHunters=new Set(),previousRoles=null,previousPhase=null;
let escapeMarker=null,escapeRing=null;
let powerupMarker=null,powerupRing=null,previousInventory=null,wasRevealing=false;
let savedCode=localStorage.getItem('manhunt-room')||'';
const cfg=window.MANHUNT_CONFIG||{};
const configured=Boolean(cfg.supabaseUrl&&cfg.supabasePublishableKey);
$('setup-note').hidden=configured;
$('room-code').value=new URLSearchParams(location.search).get('room')||savedCode;
if($('room-code').value)setMode(true);
$('nickname').value=localStorage.getItem('manhunt-name')||'';
function now(){return Date.now()/1000+offset;}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(timerHandle);timerHandle=setTimeout(()=>$('toast').hidden=true,5000);}
function setMode(join){joinMode=join;$('join-field').hidden=!join;$('room-code').required=join;$('entry-submit').innerHTML=join?'Join lobby <span>↗</span>':'Create lobby <span>↗</span>';for(const [id,active] of [['join-tab',join],['create-tab',!join]]){$(id).classList.toggle('selected',active);$(id).setAttribute('aria-pressed',active);}}
$('join-tab').onclick=()=>setMode(true);$('create-tab').onclick=()=>setMode(false);
async function backend(){
  if(!configured)throw Error('Add your Supabase project settings to config.js first. You can explore the demo now.');
  if(!client){const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.8');client=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);}
  const {data:{session},error}=await client.auth.getSession();if(error)throw error;
  if(session){uid=session.user.id;return;}
  const {data,error:signError}=await client.auth.signInAnonymously();if(signError)throw signError;uid=data.user.id;
}
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw Error(error.message);if(data?.server_now)offset=data.server_now-Date.now()/1000;return data;}
async function guarded(fn){if(busy)return;busy=true;try{await fn();}catch(e){toast(e.message||'Something went wrong. Please retry.');}finally{busy=false;}}
$('entry-form').onsubmit=e=>{e.preventDefault();guarded(async()=>{
  $('entry-submit').disabled=true;
  try{await backend();const name=$('nickname').value.trim();if(!name)throw Error('Enter a nickname.');localStorage.setItem('manhunt-name',name);
    const data=await rpc('manhunt_enter',{p_name:name,p_code:joinMode?$('room-code').value.trim().toUpperCase():null});demo=false;state=data;localStorage.setItem('manhunt-room',data.code);openGame();
  }finally{$('entry-submit').disabled=false;}
});};
$('demo-button').onclick=()=>{demo=true;uid='me';offset=0;state=demoState(now());for(const p of state.players)p.location_kind='live';openGame();};
function openGame(){
  $('welcome').hidden=true;$('game').hidden=false;$('demo-banner').hidden=!demo;
  if(!map){
    if(!window.L){toast('Map library could not load. Check your connection and reload.');}
    else{map=L.map('map',{zoomControl:true}).setView([CAMPUS.lat,CAMPUS.lng],15);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);circle=L.circle([CAMPUS.lat,CAMPUS.lng],{radius:CAMPUS.radius,color:'#608c23',fillColor:'#b8da71',fillOpacity:.12,weight:2}).addTo(map);next=L.circle([CAMPUS.lat,CAMPUS.lng],{radius:0,color:'#986600',fillOpacity:.04,dashArray:'8 8',weight:2}).addTo(map);}
  }
  previousRoles=null;previousPhase=null;previousInventory=null;wasRevealing=false;selectedHunters.clear();nearLatch=false;$('nearby-alert').hidden=true;lastSuccess=Date.now();render();setTimeout(()=>{map?.invalidateSize();fitMap();},50);
  clearInterval(pollHandle);pollHandle=setInterval(sync,3000);
  requestWake();
}
function fitMap(){if(map&&state?.circle)map.fitBounds(L.latLng(state.circle.lat,state.circle.lng).toBounds(Math.max(state.circle.radius,80)*2.25),{maxZoom:18});}
$('fit-map').onclick=fitMap;
async function sync(action='poll',extra={}){
  if(!state||demo||polling)return;polling=true;
  try{
    const payload={...extra};
    if(position&&Date.now()-position.captured<15000&&Date.now()-lastUpload>=4000&&state.phase!=='finished'){
      const {lat,lng,accuracy}=position;Object.assign(payload,{lat,lng,accuracy,captured_at:position.captured/1000});lastUpload=Date.now();
    }
    const data=await rpc('manhunt_action',{p_code:state.code,p_action:action,p_payload:payload});
    state=data;lastSuccess=Date.now();$('connection').hidden=true;render();
  }catch(e){if((e.message||'').includes('removed from this lobby')){exitRemovedLobby();return;}$('connection').textContent=`Not synced: ${e.message}. Reconnecting…`;$('connection').hidden=false;if(action!=='poll')toast(e.message);}
  finally{polling=false;}
}
async function action(type,extra={}){
  if(demo){if(type==='tag'){const p=state.players.find(p=>p.id===uid);p.caught_at??=now();p.role='hunter';p.reason='Tagged';p.powerups=0;p.reveal_until=null;if(state.players.every(p=>p.role==='hunter'))finishDemoState(state,now(),'hunters','Hunters win! Everyone was infected.');else beginDemoEscape(state,now());}if(type==='end')finishDemo();if(type==='reveal')activateDemoReveal(state,uid,now());render();return;}
  if(polling){toast('Syncing — try again in a moment.');return;}
  await sync(type,extra);
}
function finishDemo(){state.ended_at??=now();state.powerup=null;state.phase='finished';state.deadline=null;for(const p of state.players){p.lat=null;p.lng=null;p.updated=null;p.powerups=0;p.reveal_until=null;}}
function confirmAction(title,description){return new Promise(resolve=>{$('confirm-title').textContent=title;$('confirm-description').textContent=description;const d=$('confirm-dialog');d.returnValue='cancel';d.onclose=()=>resolve(d.returnValue==='confirm');d.showModal();});}
$('tag-button').onclick=()=>guarded(async()=>{if(await confirmAction('You got tagged?','You’ll become a hunter for the rest of this game. Go find the remaining runners.'))await action('tag');});
$('end-button').onclick=()=>guarded(async()=>{if(await confirmAction('End this game?','This ends the game for everyone and clears all player locations.'))await action('end');});
$('start-button').onclick=()=>guarded(()=>action('start',{hunters:Number($('hunter-select').value),selection:$('hunter-mode').value,hunter_ids:[...selectedHunters]}));
$('advance-demo').onclick=()=>{
 if(state.phase==='finished')return;
 offset+=Math.max(0,(state.deadline||now())-now());
 if(state.escape)advanceDemo(state,now());
 else if($('demo-zone').value==='random')advanceDemo(state,now());
 else{
  if(state.phase==='headstart'){state.phase='active';state.round=1;}
  else{state.circle=state.next;state.next=nextCircle(state.circle);state.round++;state.powerup=spawnPowerup(state.circle,state.round,now());}
  state.deadline=now()+300;
 }
 render();fitMap();
};
$('copy-room').onclick=()=>guarded(async()=>{if(demo){toast('This is a demo. Create a real room to invite friends.');return;}const url=new URL(location.href);url.search='';url.searchParams.set('room',state.code);try{await navigator.clipboard.writeText(url.href);toast('Invite link copied.');}catch{toast(`Room code: ${state.code}`);}});
$('leave-button').onclick=()=>guarded(async()=>{
  if(!await confirmAction('Leave the room?',state.host===uid&&state.phase!=='finished'?'As host, leaving ends the room and clears everyone’s locations.':'Your location will be cleared. Leaving an active game forfeits your runner role.'))return;
  if(!demo){if(polling){toast('Syncing — try again in a moment.');return;}await rpc('manhunt_action',{p_code:state.code,p_action:'leave',p_payload:{}});localStorage.removeItem('manhunt-room');}
  stopTracking();clearInterval(pollHandle);state=null;demo=false;$('game').hidden=true;$('welcome').hidden=false;$('connection').hidden=true;wakeLock?.release();
});
async function requestWake(){try{if('wakeLock' in navigator&&state?.phase!=='finished')wakeLock=await navigator.wakeLock.request('screen');}catch{/* Unsupported or declined; on-screen guidance remains. */}}
function stopTracking(){stopCompass();if(watch!=null)navigator.geolocation.clearWatch(watch);watch=null;position=null;$('location-button').disabled=false;}
$('location-button').onclick=()=>{
  if(demo){toast('Demo locations are simulated. Live rooms use your phone’s GPS.');return;}
  if(!navigator.geolocation){toast('This browser does not support location.');return;}
  if(watch!=null)return;
  $('location-status').textContent='Finding your location…';
  watch=navigator.geolocation.watchPosition(pos=>{
    position={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy,captured:pos.timestamp};
    $('location-status').textContent=`GPS ±${Math.round(pos.coords.accuracy)} m · updating`;
    $('location-button').textContent='Location enabled ✓';$('location-button').disabled=true;
    if(pos.coords.accuracy>100)$('location-status').textContent+=' · move outdoors for a better fix';
    render();sync();
  },err=>{stopTracking();$('location-status').textContent=err.code===1?'Location permission denied. Allow it in your browser settings, then retry.':'Location unavailable. Move outdoors and try again.';toast($('location-status').textContent);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
};
function render(){
  if(!state)return;
  announceCatches();
  const me=state.players.find(p=>p.id===uid), host=state.host===uid,finished=state.phase==='finished',lobby=state.phase==='lobby';
  const runners=state.players.filter(p=>p.role==='runner'&&!p.left).length,hunters=state.players.filter(p=>p.role==='hunter'&&!p.left).length;
  $('advance-demo').disabled=finished;$('demo-results').disabled=finished;
  $('copy-room').textContent=state.code+' ⧉';$('player-count').textContent=`${state.players.filter(p=>!p.left).length} / 15`;
  $('runner-count').textContent=runners;$('hunter-count').textContent=hunters;
  $('host-controls').hidden=!host||!lobby;$('end-button').hidden=!host||finished;
  const options=Math.max(1,state.players.filter(p=>!p.left).length-1);const selected=$('hunter-select').value||'1';
  if($('hunter-select').options.length!==options){$('hunter-select').replaceChildren(...Array.from({length:options},(_,i)=>new Option(String(i+1),String(i+1))));$('hunter-select').value=String(Math.min(Number(selected),options));}
  const manual=$('hunter-mode').value==='manual';
  selectedHunters=new Set([...selectedHunters].filter(id=>state.players.some(p=>p.id===id&&!p.left)));
  $('hunter-picks').hidden=!manual;
  $('hunter-options').replaceChildren(...state.players.filter(p=>!p.left).map(p=>{
    const label=document.createElement('label'),input=document.createElement('input');
    label.className='hunter-choice';input.type='checkbox';input.checked=selectedHunters.has(p.id);
    input.onchange=()=>{if(input.checked)selectedHunters.add(p.id);else selectedHunters.delete(p.id);render();};
    label.append(input,document.createTextNode(p.name+(p.id===uid?' (you)':'')));return label;
  }));
  $('hunter-selection-status').textContent=`${selectedHunters.size} of ${$('hunter-select').value} hunters selected`;
  $('start-button').disabled=(manual&&selectedHunters.size!==Number($('hunter-select').value))||state.players.filter(p=>!p.left).length<2||!state.players.filter(p=>!p.left).every(p=>(demo?fresh(p,now())&&p.accuracy<=100&&!outside(p,CAMPUS):p.ready));
  $('my-role').textContent=finished?(state.winner==='runner'?(state.winner_id===uid?'You escaped!':'Runner wins'):state.winner==='hunters'?'Hunters win':'Hunt complete'):lobby?'In the lobby':me?.role==='hunter'?'You’re a hunter':'You’re a runner';
  $('my-role').style.color=me?.role==='hunter'&&!finished?'var(--red)':'var(--text)';
  $('role-note').textContent=finished?(state.end_reason||'Everyone was infected. Good hunt.') :lobby?'Enable your location. The host starts when everyone is ready.':me?.role==='hunter'?(state.phase==='headstart'?'Let the runners go. The hunt begins when the timer ends.':'Find the runners. Once tagged, they join your team.'):'Stay inside the circle. When tagged, tap the button below.';
  $('tag-button').hidden=lobby||finished||me?.role!=='runner';$('location-button').hidden=finished;$('compass-button').hidden=finished;
  updateProximity();updatePowerups();renderStats();
  if(state.escape&&!finished)$('role-note').textContent=me?.role==='runner'?'Reach the blue escape zone before the three-minute timer ends.':'Stop the last runner from reaching the blue escape zone.';
  $('demo-escape-reach').hidden=!demo||!state.escape||finished||me?.role!=='runner';
  $('demo-finale').disabled=finished;
  $('advance-demo').textContent=state.escape?'Skip to escape timeout →':'Skip to next round →';
  if(demo)$('location-status').textContent='Simulated locations · demo only';
  if(finished){stopTracking();$('location-status').textContent='Locations cleared. Tracking stopped.';wakeLock?.release();}
  $('players').replaceChildren(...state.players.filter(p=>!p.left).map(p=>{
    const li=document.createElement('li'),av=document.createElement('span'),name=document.createElement('span'),sub=document.createElement('small'),badge=document.createElement('span');
    av.className='avatar'+(p.role==='hunter'?' infected':'');av.textContent=p.name.slice(0,2).toUpperCase();name.className='player-name';name.textContent=p.name+(p.id===uid?' (you)':'');
    sub.textContent=finished?(p.reason||''):p.role==='hunter'&&me?.role!=='hunter'&&!revealActive(state,uid,now())?'Location hidden':p.lat==null?(p.role==='hunter'?'Location hidden':'Waiting for GPS'):fresh(p,now())?'Live GPS':`GPS ${Math.max(0,Math.floor(now()-p.updated))}s old`;name.append(sub);
    badge.className='badge'+(p.role==='hunter'?' infected':'');badge.textContent=lobby?'Ready?':p.role;li.append(av,name,badge);
    if(host&&lobby&&p.id!==uid){
      const kick=document.createElement('button');kick.type='button';kick.className='kick-button';kick.textContent='Kick';kick.setAttribute('aria-label',`Kick ${p.name}`);
      kick.onclick=()=>guarded(async()=>{if(await confirmAction(`Kick ${p.name}?`,'They’ll be removed from this lobby and cannot rejoin it from the same browser.'))await action('kick',{player_id:p.id});});
      li.append(kick);
    }
    return li;
  }));
  if(map){
    circle.setLatLng([state.circle.lat,state.circle.lng]).setRadius(state.circle.radius);
    next.setLatLng([state.next.lat,state.next.lng]).setRadius(lobby||finished||state.escape?0:state.next.radius);
    powerupMarker?.remove();powerupRing?.remove();powerupMarker=null;powerupRing=null;
    if(state.powerup&&state.phase==='active'){
      const item=state.powerup;
      powerupRing=L.circle([item.lat,item.lng],{radius:20,color:'#e5a925',fillColor:'#ffca49',fillOpacity:.35,weight:2}).addTo(map);
      powerupMarker=L.marker([item.lat,item.lng],{icon:L.divIcon({className:'',iconSize:[32,32],iconAnchor:[16,16],html:'<div class="powerup-pin">⚡</div>'})}).bindTooltip('Hunter reveal pickup · 20m · first runner collects').addTo(map);
    }
    escapeMarker?.remove();escapeRing?.remove();escapeMarker=null;escapeRing=null;
    if(state.escape&&!finished){const z=state.escape;
      escapeRing=L.circle([z.lat,z.lng],{radius:20,color:'#53d9ef',fillColor:'#53d9ef',fillOpacity:.45,weight:3}).addTo(map);
      escapeMarker=L.marker([z.lat,z.lng],{icon:L.divIcon({className:'',iconSize:[34,34],iconAnchor:[17,17],html:'<div class="escape-pin">⚑</div>'})}).bindTooltip('ESCAPE · Last runner wins on entering · 20m').addTo(map);
    }
    const visible=new Set();
    for(const entry of state.players){
      const p=entry.id===uid&&position&&Date.now()-position.captured<15000?{...entry,...position,updated:now()}:entry;
      if((p.role==='hunter'&&me?.role!=='hunter'&&p.id!==uid&&!revealActive(state,uid,now()))||p.lat==null||p.left||finished)continue;visible.add(p.id);
      const icon=L.divIcon({className:'',iconSize:[34,34],iconAnchor:[17,17],html:`<div class="player-marker ${p.role==='hunter'?'infected':''} ${fresh(p,now())?'':'stale'}"></div>`});
      let marker=markers.get(p.id);if(!marker){marker=L.marker([p.lat,p.lng]).addTo(map);markers.set(p.id,marker);}marker.setLatLng([p.lat,p.lng]).setIcon(icon);
      marker.getElement()?.querySelector('.player-marker')?.append(document.createTextNode(p.name.slice(0,2).toUpperCase()));
      if(p.id===uid&&heading!=null&&Date.now()-headingAt<10000){const arrow=document.createElement('span');arrow.className='heading-arrow';arrow.style.transform=`rotate(${heading}deg)`;marker.getElement()?.querySelector('.player-marker')?.append(arrow);}
      marker.setOpacity(fresh(p,now())?1:.5);
      const label=document.createElement('span');label.textContent=`${p.name} · ${p.role}${fresh(p,now())?' · live':` · GPS ${Math.max(0,Math.floor(now()-p.updated))}s old`}`;marker.unbindTooltip().bindTooltip(label,{direction:'top',offset:[0,-18]});
    }
    for(const [id,marker]of markers){if(!visible.has(id)){marker.remove();markers.delete(id);}}
  }
  $('location-rule').textContent=me?.role==='hunter'?'Runners and fellow hunters live':revealActive(state,uid,now())?'Reveal active · all players live':'Runners live · hunters hidden';
  updateClock();
}
function updateClock(){
  if(!state)return;updatePowerups();
  const revealing=revealActive(state,uid,now());
  if(revealing!==wasRevealing){wasRevealing=revealing;render();return;}
  if(heading!=null&&Date.now()-headingAt>=10000){heading=null;render();return;}const phase=state.phase,remaining=state.deadline?Math.max(0,state.deadline-now()):0;
  $('phase-label').textContent={lobby:'WAITING ROOM',headstart:'RUNNERS’ HEAD START',active:'NEXT CIRCLE IN',finished:'GAME OVER'}[phase];
  if(state.escape&&phase==='active')$('phase-label').textContent='FINAL ESCAPE';
  $('round-label').textContent=phase==='lobby'?'LOBBY':phase==='finished'?'FINISHED':`ROUND ${state.round}`;
  $('timer').textContent=phase==='lobby'?'--:--':phase==='finished'?'GG':formatTime(remaining);
  $('timer-caption').textContent=phase==='lobby'?'Waiting for your friends':phase==='finished'?'The hunt has ended':phase==='headstart'?'Hunters wait. Runners, get moving.':'Reach the dashed circle before time runs out.';
  if(state.escape&&phase==='active')$('timer-caption').textContent=state.escape.runner_id===uid?'Shrinking paused. Reach the blue zone to escape.':'Shrinking paused. Catch the runner before they escape.';
  $('progress-fill').style.width=`${state.deadline?Math.max(0,Math.min(100,remaining/(state.escape?180:300)*100)):0}%`;
  $('radius-label').textContent=phase==='lobby'?'Starting radius':'Current radius';$('radius-value').textContent=`${Math.round(state.circle.radius).toLocaleString()} m`;
  $('map-status').textContent=phase==='finished'?'LOCATIONS CLEARED':demo?'SIMULATED CAMPUS MAP':'LIVE CAMPUS MAP';
  if(!demo&&Date.now()-lastSuccess>12000){$('connection').textContent='Connection is stale. The timer may be ahead of the shared game. Reconnecting…';$('connection').hidden=false;}
  if(demo&&state.deadline&&remaining===0){advanceDemo(state,now());render();}
}
setInterval(updateClock,1000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state){requestWake();sync();}});
window.addEventListener('online',()=>sync());

function stopCompass(){
 window.removeEventListener('deviceorientation',onOrientation);
 window.removeEventListener('deviceorientationabsolute',onOrientation);
 heading=null;compassOn=false;
 $('compass-button').textContent='Enable compass arrow';
}
function onOrientation(e){
 const h=compassHeading(e,screen.orientation?.angle||window.orientation||0);
 if(h==null)return;
 heading=h;headingAt=Date.now();$('compass-status').textContent='Compass enabled · hold phone flat';const arrow=markers.get(uid)?.getElement()?.querySelector('.heading-arrow');if(arrow)arrow.style.transform=`rotate(${h}deg)`;else render();
}
$('compass-button').onclick=async()=>{
 if(compassOn){stopCompass();$('compass-status').textContent='Compass off';render();return;}
 if(!window.DeviceOrientationEvent){$('compass-status').textContent='Compass unavailable — keeping your normal marker.';return;}
 try{
  if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission(true)!=='granted'){
   $('compass-status').textContent='Compass permission declined — keeping your normal marker.';return;
  }
  compassOn=true;window.addEventListener('deviceorientation',onOrientation);window.addEventListener('deviceorientationabsolute',onOrientation);
  $('compass-button').textContent='Disable compass arrow';$('compass-status').textContent='Waiting for compass… normal marker until available.';
 }catch{$('compass-status').textContent='Compass unavailable — keeping your normal marker.';}
};
function updateProximity(){
 const me=state.players.find(p=>p.id===uid);
 const active=state.phase==='active'&&me?.role==='runner'&&!demo;
 const transition=proximityTransition(nearLatch,active,state.hunter_nearby,state.hunters_clear);
 nearLatch=transition.latched;
 if(!active||transition.cleared)$('nearby-alert').hidden=true;
 if(transition.notify){$('nearby-alert').hidden=false;if($('vibration-toggle').checked)navigator.vibrate?.([200,100,200]);}
 $('proximity-status').textContent=!active?'Nearby alerts start when the hunt begins.':state.hunter_nearby==null?'Nearby alerts waiting for fresh, accurate GPS.':'Nearby alerts active · GPS estimates only';
}
$('dismiss-nearby').onclick=()=>$('nearby-alert').hidden=true;

$('hunter-mode').onchange=()=>render();
$('hunter-select').onchange=()=>render();
function announceCatches(){
 if(previousRoles&&['headstart','active'].includes(previousPhase)){
  const changed=state.players.filter(p=>!p.left&&p.role==='hunter'&&previousRoles.get(p.id)==='runner');
  if(changed.length){
   const messages=changed.map(p=>p.reason==='Outside the circle'?`${p.name} left the zone and became a hunter.`:p.reason==='Location disconnected'?`${p.name} lost location and became a hunter.`:`${p.name} got caught! They’re now a hunter.`);
   toast(messages.join(' '));
  }
 }
 previousRoles=new Map(state.players.map(p=>[p.id,p.role]));previousPhase=state.phase;
}

$('demo-zone').onchange=()=>{
 if(!demo)return;
 $('demo-banner').querySelector('span').textContent=$('demo-zone').value==='random'?'DEMO · Simulated players and locations. Nothing is shared.':'ZONE ROUTE PREVIEW · Players stay put so you can inspect every circle.';
 state=demoState(now());
 for(const p of state.players)p.location_kind='live';
 if($('demo-zone').value!=='random'){
  state.next=nextCircle({...CAMPUS,target:ZONE_DESTINATIONS[Number($('demo-zone').value)]});
 }
 previousRoles=null;previousPhase=null;previousInventory=null;wasRevealing=false;render();fitMap();
};

function updatePowerups(){
 const me=state.players.find(p=>p.id===uid),active=state.phase==='active',count=me?.powerups||0;
 const seconds=Math.max(0,(me?.reveal_until||0)-now());
 if(previousInventory!=null&&count>previousInventory)toast('Power-up collected! Stored in your inventory.');
 previousInventory=count;
 $('powerup-count').textContent=count;
 $('reveal-button').disabled=!active||me?.role!=='runner'||count<1;
 $('reveal-button').textContent=seconds>0?'Extend reveal · +60s':'Reveal hunters · 60s';
 $('powerup-status').textContent=me?.role==='hunter'?'Only runners can collect and use reveals.':!active?'First pickup spawns at the first shrink after hunting begins.':state.powerup?'A sidewalk pickup is on the map. First runner within 20m collects it.':count?'Saved for whenever you need it.':'Pickup collected or not spawned yet. Another appears next circle.';
 $('reveal-timer').textContent=revealActive(state,uid,now())?`Hunters revealed for you · ${formatTime(seconds)}`:count?'Each item reveals all hunters privately for 60 seconds.':'Unused items stack. Getting caught forfeits them.';
 $('demo-pickup').hidden=!demo||!active||me?.role!=='runner'||!state.powerup;
}
$('reveal-button').onclick=()=>guarded(()=>action('reveal'));
$('demo-pickup').onclick=()=>{
 if(!demo||!state.powerup)return;
 const me=state.players.find(p=>p.id===uid);
 Object.assign(me,{lat:state.powerup.lat,lng:state.powerup.lng,accuracy:10,updated:now()});
 collectDemoPowerup(state,uid,now());render();
};

function renderStats(){
 const finished=state.phase==='finished',me=state.players.find(p=>p.id===uid);
 $('end-stats').hidden=!finished;if(!finished)return;
 $('stats-demo-note').hidden=!demo;
 const st=me?.stats,available=!!st;
 $('stat-distance').textContent=available?`${((st.distance_m||0)/1609.344).toFixed(2)} mi`:'Not recorded';
 $('stat-speed').textContent=available?`${((st.top_mps||0)*2.2369362921).toFixed(1)} mph`:'Not recorded';
 const end=me?.caught_at??me?.left_at??state.ended_at;
 $('stat-survival').textContent=me?.initial_hunter?'Started as hunter':state.started_at!=null&&end!=null?formatTime(Math.max(0,end-state.started_at)):'Not recorded';
 $('stat-collected').textContent=available?String(st.collected||0):'—';$('stat-used').textContent=available?String(st.used||0):'—';
 const caught=state.players.filter(p=>!p.initial_hunter&&p.caught_at!=null).sort((a,b)=>a.caught_at-b.caught_at);
 let rank=0,previous=null;
 $('catch-order').replaceChildren(...caught.map((p,i)=>{
  if(previous!==p.caught_at)rank=i+1;previous=p.caught_at;
  const li=document.createElement('li'),detail=document.createElement('small');li.value=rank;
  li.append(document.createTextNode(p.name+(p.id===uid?' (you)':'')));
  detail.textContent=`${state.started_at!=null?formatTime(Math.max(0,p.caught_at-state.started_at))+' · ':''}${p.reason||'Caught'}`;
  li.append(detail);return li;
 }));
 if(!caught.length){const li=document.createElement('li');li.textContent='No runners were caught.';$('catch-order').append(li);}
 $('initial-hunters').textContent='Starting hunters: '+(state.players.filter(p=>p.initial_hunter).map(p=>p.name).join(', ')||'Not recorded');
 const remaining=state.players.filter(p=>!p.initial_hunter&&p.caught_at==null);
 $('uncaught-players').textContent=remaining.map(p=>`${p.name}: ${p.id===state.winner_id?'escaped and won':p.left?'left game':'not caught before game ended'}`).join(' · ');
}

$('demo-results').onclick=()=>{
 if(!demo||!state||state.phase==='finished')return;
 offset+=Math.max(0,state.started_at+1800-now());
 for(const [i,id] of ['d','b','c','me'].entries()){
  const p=state.players.find(p=>p.id===id);
  if(p&&p.caught_at==null){p.caught_at=state.started_at+600+i*300;p.role='hunter';p.reason='Tagged';}
 }
 finishDemo();render();
};

function exitRemovedLobby(){
 stopTracking();clearInterval(pollHandle);wakeLock?.release();state=null;demo=false;
 localStorage.removeItem('manhunt-room');savedCode='';$('room-code').value='';
 for(const marker of markers.values())marker.remove();markers.clear();
 powerupMarker?.remove();powerupRing?.remove();powerupMarker=null;powerupRing=null;escapeMarker?.remove();escapeRing?.remove();escapeMarker=null;escapeRing=null;
 $('players').replaceChildren();$('game').hidden=true;$('welcome').hidden=false;$('connection').hidden=true;
 toast('The host removed you from the lobby.');
}

$('demo-finale').onclick=()=>{
 if(!demo||!state||state.phase==='finished')return;
 state.phase='active';for(const p of state.players)if(p.id!==uid&&p.role==='runner'){p.role='hunter';p.reason='Tagged';p.caught_at=now();}
 beginDemoEscape(state,now());render();fitMap();
};
$('demo-escape-reach').onclick=()=>{
 if(!demo||!state?.escape||state.phase==='finished')return;
 const me=state.players.find(p=>p.id===uid);Object.assign(me,{lat:state.escape.lat,lng:state.escape.lng,accuracy:10,updated:now()});
 reachDemoEscape(state,uid,now());render();
};
