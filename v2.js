export function compassHeading(event, screenAngle = 0) {
  let heading;
  if(Number.isFinite(event.webkitCompassHeading) && (event.webkitCompassAccuracy == null || event.webkitCompassAccuracy >= 0))heading=event.webkitCompassHeading;
  else if(event.absolute === true && Number.isFinite(event.alpha))heading=360-event.alpha;
  else return null;
  return ((heading+screenAngle)%360+360)%360;
}
export function proximityTransition(latched, active, nearby, clear) {
  if(!active)return {latched:false,notify:false,cleared:true};
  if(nearby===true)return {latched:true,notify:!latched,cleared:false};
  if(clear===true)return {latched:false,notify:false,cleared:true};
  return {latched,notify:false,cleared:false};
}
