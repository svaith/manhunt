import {CAMPUS, fresh, outside, formatTime, demoState, advanceDemo} from './game.js';
const $=id=>document.getElementById(id);
let client,uid,state,map,circle,next,markers=new Map(),demo=false,joinMode=false,busy=false,polling=false,watch=null,position=null,lastUpload=0,offset=0,lastSuccess=0,timerHandle,pollHandle,wakeLock;
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
$('demo-button').onclick=()=>{demo=true;uid='me';offset=0;state=demoState(now());openGame();};
function openGame(){
  $('welcome').hidden=true;$('game').hidden=false;$('demo-banner').hidden=!demo;
  if(!map){
    if(!window.L){toast('Map library could not load. Check your connection and reload.');}
    else{map=L.map('map',{zoomControl:true}).setView([CAMPUS.lat,CAMPUS.lng],15);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);circle=L.circle([CAMPUS.lat,CAMPUS.lng],{radius:CAMPUS.radius,color:'#608c23',fillColor:'#b8da71',fillOpacity:.12,weight:2}).addTo(map);next=L.circle([CAMPUS.lat,CAMPUS.lng],{radius:0,color:'#986600',fillOpacity:.04,dashArray:'8 8',weight:2}).addTo(map);}
  }
  lastSuccess=Date.now();render();setTimeout(()=>{map?.invalidateSize();fitMap();},50);
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
      const {lat,lng,accuracy}=position;Object.assign(payload,{lat,lng,accuracy});lastUpload=Date.now();
    }
    const data=await rpc('manhunt_action',{p_code:state.code,p_action:action,p_payload:payload});
    state=data;lastSuccess=Date.now();$('connection').hidden=true;render();
  }catch(e){$('connection').textContent=`Not synced: ${e.message}. Reconnecting…`;$('connection').hidden=false;if(action!=='poll')toast(e.message);}
  finally{polling=false;}
}
async function action(type,extra={}){
  if(demo){if(type==='tag'){const p=state.players.find(p=>p.id===uid);p.role='hunter';p.reason='Tagged';if(state.players.every(p=>p.role==='hunter'))finishDemo();}if(type==='end')finishDemo();render();return;}
  if(polling){toast('Syncing — try again in a moment.');return;}
  await sync(type,extra);
}
function finishDemo(){state.phase='finished';state.deadline=null;for(const p of state.players){p.lat=null;p.lng=null;p.updated=null;}}
function confirmAction(title,description){return new Promise(resolve=>{$('confirm-title').textContent=title;$('confirm-description').textContent=description;const d=$('confirm-dialog');d.returnValue='cancel';d.onclose=()=>resolve(d.returnValue==='confirm');d.showModal();});}
$('tag-button').onclick=()=>guarded(async()=>{if(await confirmAction('You got tagged?','You’ll become a hunter for the rest of this game. Go find the remaining runners.'))await action('tag');});
$('end-button').onclick=()=>guarded(async()=>{if(await confirmAction('End this game?','This ends the game for everyone and clears all player locations.'))await action('end');});
$('start-button').onclick=()=>guarded(()=>action('start',{hunters:Number($('hunter-select').value)}));
$('advance-demo').onclick=()=>{advanceDemo(state,now());render();fitMap();};
$('copy-room').onclick=()=>guarded(async()=>{if(demo){toast('This is a demo. Create a real room to invite friends.');return;}const url=new URL(location.href);url.search='';url.searchParams.set('room',state.code);try{await navigator.clipboard.writeText(url.href);toast('Invite link copied.');}catch{toast(`Room code: ${state.code}`);}});
$('leave-button').onclick=()=>guarded(async()=>{
  if(!await confirmAction('Leave the room?',state.host===uid&&state.phase!=='finished'?'As host, leaving ends the room and clears everyone’s locations.':'Your location will be cleared. Leaving an active game forfeits your runner role.'))return;
  if(!demo){if(polling){toast('Syncing — try again in a moment.');return;}await rpc('manhunt_action',{p_code:state.code,p_action:'leave',p_payload:{}});localStorage.removeItem('manhunt-room');}
  stopTracking();clearInterval(pollHandle);state=null;demo=false;$('game').hidden=true;$('welcome').hidden=false;$('connection').hidden=true;wakeLock?.release();
});
async function requestWake(){try{if('wakeLock' in navigator&&state?.phase!=='finished')wakeLock=await navigator.wakeLock.request('screen');}catch{/* Unsupported or declined; on-screen guidance remains. */}}
function stopTracking(){if(watch!=null)navigator.geolocation.clearWatch(watch);watch=null;position=null;$('location-button').disabled=false;}
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
    sync();
  },err=>{stopTracking();$('location-status').textContent=err.code===1?'Location permission denied. Allow it in your browser settings, then retry.':'Location unavailable. Move outdoors and try again.';toast($('location-status').textContent);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
};
function render(){
  if(!state)return;
  const me=state.players.find(p=>p.id===uid), host=state.host===uid,finished=state.phase==='finished',lobby=state.phase==='lobby';
  const runners=state.players.filter(p=>p.role==='runner'&&!p.left).length,hunters=state.players.filter(p=>p.role==='hunter'&&!p.left).length;
  $('copy-room').textContent=state.code+' ⧉';$('player-count').textContent=`${state.players.filter(p=>!p.left).length} / 15`;
  $('runner-count').textContent=runners;$('hunter-count').textContent=hunters;
  $('host-controls').hidden=!host||!lobby;$('end-button').hidden=!host||finished;
  const options=Math.max(1,state.players.filter(p=>!p.left).length-1);const selected=$('hunter-select').value||'1';
  if($('hunter-select').options.length!==options){$('hunter-select').replaceChildren(...Array.from({length:options},(_,i)=>new Option(String(i+1),String(i+1))));$('hunter-select').value=String(Math.min(Number(selected),options));}
  $('start-button').disabled=state.players.filter(p=>!p.left).length<2||!state.players.filter(p=>!p.left).every(p=>fresh(p,now())&&p.accuracy<=100&&!outside(p,CAMPUS));
  $('my-role').textContent=finished?'Hunt complete':lobby?'In the lobby':me?.role==='hunter'?'You’re a hunter':'You’re a runner';
  $('my-role').style.color=me?.role==='hunter'&&!finished?'var(--red)':'var(--text)';
  $('role-note').textContent=finished?(state.end_reason||'Everyone was infected. Good hunt.') :lobby?'Enable your location. The host starts when everyone is ready.':me?.role==='hunter'?(state.phase==='headstart'?'Let the runners go. The hunt begins when the timer ends.':'Find the runners. Once tagged, they join your team.'):'Stay inside the circle. When tagged, tap the button below.';
  $('tag-button').hidden=lobby||finished||me?.role!=='runner';$('location-button').hidden=finished;
  if(demo)$('location-status').textContent='Simulated locations · demo only';
  if(finished){stopTracking();$('location-status').textContent='Locations cleared. Tracking stopped.';wakeLock?.release();}
  $('players').replaceChildren(...state.players.filter(p=>!p.left).map(p=>{
    const li=document.createElement('li'),av=document.createElement('span'),name=document.createElement('span'),sub=document.createElement('small'),badge=document.createElement('span');
    av.className='avatar'+(p.role==='hunter'?' infected':'');av.textContent=p.name.slice(0,2).toUpperCase();name.className='player-name';name.textContent=p.name+(p.id===uid?' (you)':'');
    sub.textContent=finished?(p.reason||''):p.role==='hunter'?'Location hidden':p.pending_until?'Location grace period':p.lat==null?'Waiting for GPS':!fresh(p,now())?'Location stale':p.accuracy>100?'Low GPS accuracy':p.id===state.host?'Host · GPS live':'GPS live';name.append(sub);
    badge.className='badge'+(p.role==='hunter'?' infected':'');badge.textContent=lobby?'Ready?':p.role;li.append(av,name,badge);return li;
  }));
  if(map){
    circle.setLatLng([state.circle.lat,state.circle.lng]).setRadius(state.circle.radius);
    next.setLatLng([state.next.lat,state.next.lng]).setRadius(lobby||finished?0:state.next.radius);
    const visible=new Set();
    for(const p of state.players){if(p.role==='hunter'||p.lat==null||p.left||finished)continue;visible.add(p.id);
      const icon=L.divIcon({className:'',iconSize:[34,34],iconAnchor:[17,17],html:`<div class="player-marker ${p.role==='hunter'?'infected':''} ${fresh(p,now())?'':'stale'}"></div>`});
      let marker=markers.get(p.id);if(!marker){marker=L.marker([p.lat,p.lng]).addTo(map);markers.set(p.id,marker);}marker.setLatLng([p.lat,p.lng]).setIcon(icon);
      marker.getElement()?.querySelector('.player-marker')?.append(document.createTextNode(p.name.slice(0,2).toUpperCase()));
      const label=document.createElement('span');label.textContent=`${p.name} · ${p.role}${fresh(p,now())?'':' · stale'}`;marker.unbindTooltip().bindTooltip(label,{direction:'top',offset:[0,-18]});
    }
    for(const [id,marker]of markers){if(!visible.has(id)){marker.remove();markers.delete(id);}}
  }
  updateClock();
}
function updateClock(){
  if(!state)return;const phase=state.phase,remaining=state.deadline?Math.max(0,state.deadline-now()):0;
  $('phase-label').textContent={lobby:'WAITING ROOM',headstart:'RUNNERS’ HEAD START',active:'NEXT CIRCLE IN',finished:'GAME OVER'}[phase];
  $('round-label').textContent=phase==='lobby'?'LOBBY':phase==='finished'?'FINISHED':`ROUND ${state.round}`;
  $('timer').textContent=phase==='lobby'?'--:--':phase==='finished'?'GG':formatTime(remaining);
  $('timer-caption').textContent=phase==='lobby'?'Waiting for your friends':phase==='finished'?'The hunt has ended':phase==='headstart'?'Hunters wait. Runners, get moving.':'Reach the dashed circle before time runs out.';
  $('progress-fill').style.width=`${state.deadline?Math.max(0,Math.min(100,remaining/300*100)):0}%`;
  $('radius-label').textContent=phase==='lobby'?'Starting radius':'Current radius';$('radius-value').textContent=`${Math.round(state.circle.radius).toLocaleString()} m`;
  $('map-status').textContent=phase==='finished'?'LOCATIONS CLEARED':demo?'SIMULATED CAMPUS MAP':'LIVE CAMPUS MAP';
  if(!demo&&Date.now()-lastSuccess>12000){$('connection').textContent='Connection is stale. The timer may be ahead of the shared game. Reconnecting…';$('connection').hidden=false;}
  if(demo&&state.deadline&&remaining===0){advanceDemo(state,now());render();}
}
setInterval(updateClock,1000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state){requestWake();sync();}});
window.addEventListener('online',()=>sync());
