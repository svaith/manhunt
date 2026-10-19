-- Run once in the Supabase SQL Editor. No service key is used by the browser.
begin;
create table if not exists public.manhunt_rooms (
  code text primary key,
  host uuid not null,
  state jsonb not null,
  expires_at timestamptz not null default (now() + interval '12 hours')
);
alter table public.manhunt_rooms enable row level security;
revoke all on public.manhunt_rooms from anon, authenticated;

create or replace function public.manhunt_distance(a jsonb,b jsonb)
returns double precision language sql immutable set search_path = '' as $$
 select 6371000 * 2 * asin(sqrt(least(1.0,
   power(sin(radians((b->>'lat')::float8-(a->>'lat')::float8)/2),2)
   +cos(radians((a->>'lat')::float8))*cos(radians((b->>'lat')::float8))
   *power(sin(radians((b->>'lng')::float8-(a->>'lng')::float8)/2),2))));
$$;
create or replace function public.manhunt_on_campus(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare ring jsonb := '[[-76.940873,38.999621],[-76.940844,38.999716],[-76.940717,39.000173],[-76.940807,39.000187],[-76.940932,39.000213],[-76.941048,39.000269],[-76.94125,39.000301],[-76.941391,39.000323],[-76.941732,39.000378],[-76.941748,39.00038],[-76.942424,39.000189],[-76.942562,39.00015],[-76.942608,39.000003],[-76.942441,38.99982],[-76.942383,38.999733],[-76.942329,38.999622],[-76.942302,38.999534],[-76.94228,38.99946],[-76.942281,38.999397],[-76.942275,38.999336],[-76.942323,38.999336],[-76.942367,38.999336],[-76.942366,38.999326],[-76.94232,38.998788],[-76.942307,38.99863],[-76.942312,38.998629],[-76.942373,38.99862],[-76.943104,38.998547],[-76.94314,38.998543],[-76.943812,38.998475],[-76.944059,38.99845],[-76.944534,38.998417],[-76.945956,38.998277],[-76.946393,38.998229],[-76.946611,38.998072],[-76.947008,38.997758],[-76.947164,38.997627],[-76.947889,38.996965],[-76.948521,38.996254],[-76.949003,38.995623],[-76.948982,38.995607],[-76.949081,38.995472],[-76.949112,38.995481],[-76.949149,38.995429],[-76.949407,38.995075],[-76.949224,38.994837],[-76.949225,38.994837],[-76.94951,38.994679],[-76.949506,38.99468],[-76.950018,38.993974],[-76.950036,38.993946],[-76.950108,38.993928],[-76.950259,38.993887],[-76.950999,38.992832],[-76.951102,38.992669],[-76.951492,38.992126],[-76.951494,38.992126],[-76.952302,38.990983],[-76.953436,38.989384],[-76.953894,38.988725],[-76.953953,38.988646],[-76.954417,38.988106],[-76.954856,38.987481],[-76.95496,38.987317],[-76.955161,38.986975],[-76.955198,38.986906],[-76.955351,38.986684],[-76.955431,38.98632],[-76.955503,38.985985],[-76.95546,38.985856],[-76.955431,38.985776],[-76.955236,38.985617],[-76.954886,38.985546],[-76.95484,38.985529],[-76.954584,38.985431],[-76.953992,38.985309],[-76.953106,38.985121],[-76.952395,38.98497],[-76.951859,38.984857],[-76.951743,38.984838],[-76.951626,38.984821],[-76.95151,38.984806],[-76.951392,38.984792],[-76.951275,38.98478],[-76.951157,38.98477],[-76.950956,38.984756],[-76.950862,38.984752],[-76.950768,38.98475],[-76.950673,38.984749],[-76.950579,38.984749],[-76.950485,38.984751],[-76.950391,38.984754],[-76.950297,38.984758],[-76.950203,38.984763],[-76.950039,38.984777],[-76.950025,38.98473],[-76.949912,38.984743],[-76.949747,38.984767],[-76.949729,38.984769],[-76.949722,38.984771],[-76.949715,38.984773],[-76.949709,38.984775],[-76.949702,38.984779],[-76.949697,38.984783],[-76.949692,38.984787],[-76.949688,38.984792],[-76.949684,38.984797],[-76.949682,38.984802],[-76.94968,38.984808],[-76.949679,38.984816],[-76.94968,38.98506],[-76.949681,38.985087],[-76.949604,38.985086],[-76.949607,38.985033],[-76.949607,38.984823],[-76.949607,38.984818],[-76.949604,38.984812],[-76.9496,38.984807],[-76.949595,38.984803],[-76.949588,38.9848],[-76.949581,38.984798],[-76.949574,38.984797],[-76.949566,38.984798],[-76.949529,38.984805],[-76.949328,38.984856],[-76.949318,38.984857],[-76.949308,38.984858],[-76.949298,38.98486],[-76.949288,38.984862],[-76.949278,38.984865],[-76.949269,38.984867],[-76.949259,38.98487],[-76.94925,38.984873],[-76.949241,38.984877],[-76.949231,38.984881],[-76.949223,38.984884],[-76.949214,38.984889],[-76.949205,38.984893],[-76.949197,38.984898],[-76.949189,38.984902],[-76.949181,38.984908],[-76.949173,38.984913],[-76.949166,38.984918],[-76.949159,38.984924],[-76.949152,38.98493],[-76.949145,38.984936],[-76.949139,38.984942],[-76.949133,38.984948],[-76.949127,38.984955],[-76.949121,38.984962],[-76.949116,38.984969],[-76.949111,38.984976],[-76.949107,38.984983],[-76.949102,38.98499],[-76.949099,38.984997],[-76.949095,38.985005],[-76.949092,38.985012],[-76.949089,38.98502],[-76.949086,38.985028],[-76.949084,38.985035],[-76.949082,38.985043],[-76.94908,38.985051],[-76.949079,38.985059],[-76.949078,38.985067],[-76.949078,38.985075],[-76.949078,38.985086],[-76.948981,38.985086],[-76.948975,38.985032],[-76.948974,38.985026],[-76.948972,38.985021],[-76.948969,38.985016],[-76.948965,38.985011],[-76.948961,38.985007],[-76.948955,38.985003],[-76.948949,38.985],[-76.948943,38.984998],[-76.948936,38.984996],[-76.948929,38.984995],[-76.948921,38.984995],[-76.948914,38.984996],[-76.948907,38.984997],[-76.948899,38.985],[-76.948793,38.985045],[-76.94876,38.985059],[-76.948672,38.985028],[-76.948678,38.985024],[-76.948682,38.98502],[-76.948687,38.985016],[-76.94869,38.985011],[-76.948693,38.985006],[-76.948696,38.985001],[-76.948698,38.984996],[-76.948699,38.98499],[-76.9487,38.984985],[-76.9487,38.984979],[-76.9487,38.984974],[-76.948699,38.984968],[-76.948697,38.984963],[-76.948695,38.984958],[-76.948629,38.984884],[-76.948623,38.98488],[-76.948617,38.984876],[-76.94861,38.984873],[-76.948603,38.98487],[-76.948596,38.984867],[-76.948589,38.984865],[-76.948581,38.984863],[-76.948574,38.984862],[-76.948566,38.984861],[-76.948554,38.98486],[-76.94854,38.984861],[-76.948545,38.984806],[-76.948545,38.984806],[-76.94874,38.984787],[-76.948752,38.984776],[-76.948751,38.984705],[-76.948746,38.98449],[-76.948043,38.982704],[-76.948109,38.982688],[-76.948143,38.98268],[-76.948194,38.982667],[-76.949086,38.982453],[-76.949097,38.982451],[-76.949227,38.982778],[-76.950597,38.982822],[-76.951883,38.982855],[-76.951721,38.982361],[-76.951679,38.982235],[-76.951614,38.982053],[-76.951484,38.98202],[-76.951212,38.98195],[-76.950968,38.981888],[-76.950233,38.981699],[-76.950031,38.981157],[-76.949653,38.981102],[-76.948575,38.980944],[-76.948498,38.980929],[-76.948322,38.980415],[-76.948257,38.980432],[-76.946622,38.980892],[-76.94666,38.98102],[-76.946746,38.981315],[-76.946678,38.981322],[-76.946632,38.981327],[-76.946523,38.981337],[-76.946413,38.981346],[-76.946312,38.981349],[-76.946212,38.981354],[-76.946053,38.981355],[-76.946035,38.981355],[-76.946005,38.981354],[-76.94597,38.981353],[-76.94594,38.981353],[-76.945874,38.98135],[-76.945743,38.981343],[-76.945644,38.981334],[-76.945557,38.981326],[-76.945448,38.981313],[-76.944888,38.981241],[-76.944473,38.981187],[-76.944416,38.98118],[-76.944322,38.981176],[-76.944275,38.981176],[-76.944235,38.981177],[-76.944188,38.981179],[-76.944064,38.981192],[-76.944025,38.981203],[-76.944169,38.98172],[-76.943505,38.981634],[-76.943495,38.981635],[-76.943354,38.98164],[-76.943214,38.981646],[-76.943073,38.981652],[-76.942933,38.981657],[-76.942909,38.981301],[-76.942769,38.981306],[-76.94264,38.981312],[-76.942628,38.981312],[-76.942652,38.981668],[-76.942451,38.981676],[-76.942125,38.98169],[-76.942121,38.981635],[-76.94211,38.981466],[-76.942094,38.981223],[-76.94208,38.981218],[-76.942072,38.981215],[-76.942063,38.981212],[-76.942055,38.981209],[-76.942044,38.981206],[-76.942034,38.981203],[-76.942027,38.9812],[-76.942021,38.981199],[-76.942017,38.981197],[-76.942016,38.981197],[-76.942012,38.981196],[-76.942004,38.981194],[-76.941991,38.98119],[-76.941982,38.981188],[-76.941972,38.981185],[-76.941965,38.981184],[-76.941955,38.981181],[-76.941942,38.981179],[-76.941937,38.981177],[-76.941935,38.981177],[-76.941928,38.981176],[-76.941915,38.981173],[-76.941899,38.98117],[-76.941885,38.981168],[-76.941872,38.981166],[-76.941859,38.981165],[-76.941854,38.981164],[-76.941852,38.981164],[-76.941838,38.981162],[-76.941804,38.981159],[-76.941787,38.981158],[-76.941769,38.981157],[-76.94176,38.981157],[-76.941728,38.981156],[-76.941685,38.981157],[-76.941682,38.981157],[-76.941683,38.98113],[-76.940805,38.981165],[-76.940559,38.981166],[-76.94023,38.981178],[-76.940098,38.981183],[-76.940049,38.981185],[-76.939421,38.981107],[-76.939481,38.981793],[-76.938432,38.981839],[-76.938228,38.981848],[-76.938044,38.981859],[-76.938035,38.98186],[-76.938026,38.981862],[-76.938017,38.981864],[-76.938008,38.981867],[-76.938,38.981871],[-76.937992,38.981874],[-76.937985,38.981879],[-76.937978,38.981883],[-76.937971,38.981888],[-76.937965,38.981893],[-76.937959,38.981899],[-76.937953,38.981905],[-76.937949,38.981911],[-76.937945,38.981917],[-76.937943,38.981926],[-76.937942,38.981934],[-76.93794,38.981943],[-76.937939,38.981951],[-76.937939,38.98196],[-76.937938,38.981968],[-76.937937,38.981977],[-76.937937,38.981985],[-76.937937,38.981994],[-76.937937,38.982002],[-76.937937,38.982011],[-76.937938,38.982019],[-76.937938,38.982028],[-76.937939,38.982031],[-76.937939,38.982034],[-76.937922,38.982312],[-76.937921,38.982317],[-76.937919,38.982323],[-76.937919,38.98233],[-76.937914,38.982886],[-76.937899,38.983081],[-76.937883,38.98323],[-76.937864,38.983379],[-76.937842,38.983528],[-76.937816,38.983677],[-76.937787,38.983825],[-76.937755,38.983973],[-76.93768,38.984267],[-76.937638,38.984413],[-76.937593,38.984559],[-76.937544,38.984704],[-76.937492,38.984848],[-76.937253,38.985408],[-76.937165,38.985566],[-76.937162,38.985572],[-76.937159,38.98558],[-76.937158,38.985587],[-76.937157,38.985594],[-76.937101,38.985689],[-76.937069,38.985743],[-76.93703,38.985809],[-76.936759,38.986257],[-76.936701,38.986353],[-76.93668,38.986398],[-76.936661,38.98644],[-76.936637,38.98649],[-76.936351,38.986926],[-76.936345,38.986934],[-76.935861,38.987694],[-76.935487,38.988282],[-76.935484,38.988288],[-76.935481,38.988293],[-76.93525,38.988636],[-76.934849,38.989244],[-76.934608,38.989807],[-76.93459,38.989849],[-76.934589,38.989853],[-76.934559,38.989922],[-76.934565,38.989924],[-76.934705,38.98997],[-76.934764,38.990051],[-76.934889,38.990224],[-76.934953,38.990323],[-76.934886,38.99035],[-76.934884,38.990351],[-76.93487,38.990356],[-76.934898,38.9904],[-76.934916,38.990429],[-76.934943,38.990418],[-76.935,38.990396],[-76.935053,38.990479],[-76.935146,38.990753],[-76.935149,38.990763],[-76.935156,38.990783],[-76.935095,38.99112],[-76.93521,38.991244],[-76.935244,38.99128],[-76.935415,38.991464],[-76.935464,38.991517],[-76.935514,38.99157],[-76.935534,38.991592],[-76.935755,38.991829],[-76.935775,38.991851],[-76.935811,38.991889],[-76.936582,38.992717],[-76.935863,38.992532],[-76.935828,38.992523],[-76.935827,38.992523],[-76.935578,38.992459],[-76.935459,38.992428],[-76.935176,38.992355],[-76.934958,38.992299],[-76.934897,38.992283],[-76.934874,38.992277],[-76.934865,38.992275],[-76.934903,38.992531],[-76.934905,38.992547],[-76.934919,38.99264],[-76.934793,38.992776],[-76.934769,38.992802],[-76.934753,38.992819],[-76.934745,38.992829],[-76.934744,38.99283],[-76.934618,38.992966],[-76.934541,38.993051],[-76.934521,38.993071],[-76.93452,38.993073],[-76.934508,38.993086],[-76.935102,38.993128],[-76.935149,38.993719],[-76.935173,38.994613],[-76.93521,38.995107],[-76.935244,38.995579],[-76.935324,38.996538],[-76.935343,38.996832],[-76.935331,38.996829],[-76.935428,38.997461],[-76.935435,38.997508],[-76.935437,38.997548],[-76.935442,38.997594],[-76.935462,38.997797],[-76.935576,38.99779],[-76.935576,38.99779],[-76.936074,38.997758],[-76.936676,38.997719],[-76.937098,38.997692],[-76.937275,38.997681],[-76.937475,38.99767],[-76.93778,38.997653],[-76.937767,38.999289],[-76.938162,38.999322],[-76.93815,38.999368],[-76.938036,38.999739],[-76.938312,38.99979],[-76.93845,38.99933],[-76.938553,38.999317],[-76.938453,38.99903],[-76.938576,38.999014],[-76.938854,38.998982],[-76.939483,38.998908],[-76.93997,38.998851],[-76.940244,38.998818],[-76.940487,38.998789],[-76.940664,38.998767],[-76.940865,38.998743],[-76.940898,38.998739],[-76.941074,38.998718],[-76.941066,38.998922],[-76.940993,38.9992],[-76.940873,38.999621]]'; inside boolean := false; i integer; j integer;
 x float8 := (p->>'lng')::float8; y float8 := (p->>'lat')::float8;
 xi float8; yi float8; xj float8; yj float8;
begin
 if x is null or y is null then return false;end if;
 j:=jsonb_array_length(ring)-1;
 for i in 0..jsonb_array_length(ring)-1 loop
  xi:=(ring->i->>0)::float8; yi:=(ring->i->>1)::float8;
  xj:=(ring->j->>0)::float8; yj:=(ring->j->>1)::float8;
  if (yi>y)<>(yj>y) then
   if x<(xj-xi)*(y-yi)/(yj-yi)+xi then inside:=not inside;end if;
  end if;
  j:=i;
 end loop;return inside;
end;
$$;

create or replace function public.manhunt_next(c jsonb)
returns jsonb language plpgsql volatile set search_path = '' as $$
declare r float8 := greatest(0,(c->>'radius')::float8*.72-5);
 angle float8; shift float8; candidate jsonb; attempt integer;
begin
 for attempt in 1..40 loop
  angle:=random()*2*pi();shift:=(.45+.53*sqrt(random()))*((c->>'radius')::float8-r);
  candidate:=jsonb_build_object('radius',r,
   'lat',(c->>'lat')::float8+sin(angle)*shift/111320,
   'lng',(c->>'lng')::float8+cos(angle)*shift/(111320*cos(radians((c->>'lat')::float8))));
  if public.manhunt_on_campus(candidate) then return candidate;end if;
 end loop;
 return c||jsonb_build_object('radius',r);
end;
$$;

-- Viewer-specific locations. Raw GPS and cached runner pings never leak through.
create or replace function public.manhunt_snapshot(s jsonb, t double precision)
returns jsonb language plpgsql stable set search_path = '' as $$
declare viewer jsonb; p jsonb; q jsonb; output jsonb:='[]'; near boolean:=false;
 clear boolean:=true; valid boolean; ready boolean; live boolean;
begin
 select x into viewer from jsonb_array_elements(s->'players') x where x->>'id'=auth.uid()::text;
 valid:=s->>'phase'='active' and viewer->>'role'='runner'
   and viewer->>'lat' is not null and t-(viewer->>'updated')::float8<=15
   and (viewer->>'accuracy')::float8<=30;
 for p in select x from jsonb_array_elements(s->'players') x loop
  if p->>'role'='hunter' and not coalesce((p->>'left')::boolean,false) then
   if p->>'lat' is null or coalesce(t-(p->>'updated')::float8,999)>15 or coalesce((p->>'accuracy')::float8,999)>30 then clear:=false;
   else
    if valid and public.manhunt_distance(viewer,p)<=30 then near:=true;end if;
    if valid and public.manhunt_distance(viewer,p)<=40 then clear:=false;end if;
   end if;
  end if;
  ready:=p->>'lat' is not null and coalesce(t-(p->>'updated')::float8,999)<=30
    and coalesce((p->>'accuracy')::float8,999)<=100
    and public.manhunt_distance(p,s->'circle')<=(s->'circle'->>'radius')::float8+20;
  live:=p->>'id'=auth.uid()::text or (viewer->>'role'='hunter' and p->>'role'='hunter');
  q:=(p-'ping')||jsonb_build_object('ready',ready,'location_kind',case when live then 'live' else 'ping' end);
  if not live then
   q:=q||jsonb_build_object('lat',null,'lng',null,'accuracy',null,'updated',null);
   if p->>'role'='runner' and p->'ping' is not null then q:=q||(p->'ping');end if;
  end if;
  if s->>'phase'='finished' or coalesce((p->>'left')::boolean,false) then
   q:=q||'{"lat":null,"lng":null,"accuracy":null,"updated":null}'::jsonb;
  end if;
  output:=output||jsonb_build_array(q);
 end loop;
 return jsonb_set(s,'{players}',output)||jsonb_build_object('server_now',t,
   'hunter_nearby',case when valid then near else null end,
   'hunters_clear',valid and clear);
end;
$$;

create or replace function public.manhunt_enter(p_name text,p_code text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); t float8:=extract(epoch from clock_timestamp());
 r public.manhunt_rooms%rowtype; s jsonb; p jsonb; c text;
 campus jsonb:='{"lat":38.9897,"lng":-76.9436,"radius":800}';
begin
 if u is null then raise exception 'Sign in anonymously first'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 24 then raise exception 'Name must be 1–24 characters';end if;
 if p_code is null then
   if (select count(*) from public.manhunt_rooms where host=u and expires_at>now() and state->>'phase'<>'finished')>=3 then raise exception 'You already host three rooms. End an existing game first';end if;
   loop
     c:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
     s:=jsonb_build_object('code',c,'host',u,'phase','lobby','round',0,'deadline',null,'circle',campus,'next',public.manhunt_next(campus),'players',jsonb_build_array(jsonb_build_object('id',u,'name',trim(p_name),'role','runner','lat',null,'lng',null,'updated',null)));
     begin insert into public.manhunt_rooms(code,host,state) values(c,u,s);exit;exception when unique_violation then end;
   end loop;
 else
   c:=upper(trim(p_code));
   select * into r from public.manhunt_rooms where code=c and expires_at>now() for update;
   if not found then raise exception 'Room not found or expired';end if;
   s:=r.state;
   if exists(select 1 from jsonb_array_elements(s->'players') x where x->>'id'=u::text and not coalesce((x->>'left')::boolean,false)) then
     return public.manhunt_snapshot(s,t);
   end if;
   if s->>'phase'<>'lobby' then raise exception 'This game has already started or ended';end if;
   if jsonb_array_length(s->'players')>=15 then raise exception 'This room is full (15 players)';end if;
   p:=jsonb_build_object('id',u,'name',trim(p_name),'role','runner','lat',null,'lng',null,'updated',null);
   s:=jsonb_set(s,'{players}',(s->'players')||jsonb_build_array(p));
   update public.manhunt_rooms set state=s where code=c;
 end if;
 return public.manhunt_snapshot(s,t);
end;
$$;

create or replace function public.manhunt_action(p_code text,p_action text default 'poll',p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 u uuid:=auth.uid(); t float8:=extract(epoch from clock_timestamp());
 r public.manhunt_rooms%rowtype; s jsonb; players jsonb; p jsonb; c jsonb;
 n integer; i integer; idx integer:=-1; h integer; chosen text[];
 deadline float8; pending float8; lat float8; lng float8; accuracy float8;
 campus jsonb:='{"lat":38.9897,"lng":-76.9436,"radius":800}';
begin
 if u is null then raise exception 'Sign in anonymously first';end if;
 if p_action is null or p_action not in ('poll','start','tag','end','leave') then raise exception 'Unknown game action';end if;
 select * into r from public.manhunt_rooms where code=upper(trim(p_code)) for update;
 if not found then raise exception 'Room not found';end if;
 s:=r.state;players:=s->'players';n:=jsonb_array_length(players);
 for i in 0..n-1 loop
   if players->i->>'id'=u::text and not coalesce((players->i->>'left')::boolean,false) then idx:=i;exit;end if;
 end loop;
 if idx=-1 then raise exception 'You are not a member of this room';end if;
 if r.expires_at<=now() then s:=s||'{"phase":"finished","deadline":null,"end_reason":"Room expired after 12 hours."}'::jsonb;end if;

 -- Advance against server deadlines BEFORE accepting a new GPS sample.
 -- Late samples cannot rewrite where someone was at an earlier boundary.
 while s->>'phase' in ('headstart','active') and (s->>'deadline')::float8<=t loop
   deadline:=(s->>'deadline')::float8;
   if s->>'phase'='headstart' then
     s:=s||jsonb_build_object('phase','active','round',1,'deadline',deadline+300);
   else
     c:=s->'next';
     s:=s||jsonb_build_object('circle',c,'next',public.manhunt_next(c),'round',(s->>'round')::int+1,'deadline',deadline+300);
     for i in 0..n-1 loop
       p:=players->i;
       if p->>'role'='runner' and not coalesce((p->>'left')::boolean,false) then
         if p->>'pending_until' is not null and (p->>'pending_until')::float8<=deadline then
           p:=p||'{"role":"hunter","reason":"Location disconnected","pending_until":null,"pending_circle":null}'::jsonb;
         elsif p->>'lat' is not null and p->>'updated' is not null
           and deadline-(p->>'updated')::float8 between 0 and 30
           and coalesce((p->>'accuracy')::float8,9999)<=100 then
           if public.manhunt_distance(p,c)>(c->>'radius')::float8+20 then
             p:=p||'{"role":"hunter","reason":"Outside the circle"}'::jsonb;
           end if;
         else
           p:=p||jsonb_build_object('pending_until',deadline+90,'pending_circle',c);
         end if;
         players:=jsonb_set(players,array[i::text],p);
       end if;
     end loop;
   end if;
 end loop;

 -- Expire grace periods even if no new location arrived.
 for i in 0..n-1 loop
   p:=players->i;
   if p->>'role'='runner' and p->>'pending_until' is not null and t>=(p->>'pending_until')::float8 then
     players:=jsonb_set(players,array[i::text],p||'{"role":"hunter","reason":"Location disconnected","pending_until":null,"pending_circle":null}'::jsonb);
   end if;
 end loop;

 if s->>'phase'<>'finished' and p_payload ? 'lat' then
   lat:=(p_payload->>'lat')::float8;lng:=(p_payload->>'lng')::float8;accuracy:=(p_payload->>'accuracy')::float8;
   if lat is null or lng is null or accuracy is null or not(lat between -90 and 90) or not(lng between -180 and 180) or not(accuracy between 0 and 10000) then raise exception 'Invalid GPS sample';end if;
   p:=players->idx;
   p:=p||jsonb_build_object('lat',lat,'lng',lng,'accuracy',accuracy,'updated',t);
   if p->>'role'='runner' and (p->'ping' is null or p->'ping'='null'::jsonb or t-coalesce((p->'ping'->>'updated')::float8,0)>=120) then
    p:=p||jsonb_build_object('ping',jsonb_build_object('lat',lat,'lng',lng,'accuracy',accuracy,'updated',t));
   end if;
   if p->>'role'='runner' and p->>'pending_until' is not null and accuracy<=100 then
     if public.manhunt_distance(p,p->'pending_circle')>(p->'pending_circle'->>'radius')::float8+20 then p:=p||'{"role":"hunter","reason":"Outside the circle"}'::jsonb;end if;
     p:=p||'{"pending_until":null,"pending_circle":null}'::jsonb;
   end if;
   players:=jsonb_set(players,array[idx::text],p);
 end if;

 if p_action='start' then
   if u<>r.host then raise exception 'Only the host can start';end if;
   if s->>'phase'<>'lobby' then raise exception 'Game already started';end if;
   h:=(p_payload->>'hunters')::int;
   if n<2 or h is null or h<1 or h>=n then raise exception 'Choose between 1 and player count minus 1 hunters';end if;
   for i in 0..n-1 loop
     p:=players->i;
     if p->>'lat' is null or p->>'updated' is null or t-(p->>'updated')::float8>30 or coalesce((p->>'accuracy')::float8,9999)>100 then raise exception 'Everyone needs a fresh GPS fix (within 100 m accuracy)';end if;
     if public.manhunt_distance(p,campus)>820 then raise exception 'Everyone must be inside the starting circle';end if;
   end loop;
   if coalesce(p_payload->>'selection','random') not in ('random','manual') then raise exception 'Invalid hunter selection mode';end if;
   if p_payload->>'selection'='manual' then
    if jsonb_typeof(p_payload->'hunter_ids') is distinct from 'array' then raise exception 'Choose your hunters';end if;
    select array_agg(value) into chosen from jsonb_array_elements_text(p_payload->'hunter_ids');
    if coalesce(cardinality(chosen),0)<>h or (select count(distinct x) from unnest(chosen) x)<>h then raise exception 'Select exactly % different hunters',h;end if;
    if exists(select 1 from unnest(chosen) x where not exists(select 1 from jsonb_array_elements(players) candidate_player where candidate_player->>'id'=x and not coalesce((candidate_player->>'left')::boolean,false))) then raise exception 'Selected hunter is not in this lobby';end if;
   else
    select array_agg(x->>'id') into chosen from (select x from jsonb_array_elements(players) x order by random() limit h) shuffled;
   end if;
   for i in 0..n-1 loop
     if players->i->>'id'=any(chosen) then players:=jsonb_set(players,array[i::text,'role'],'"hunter"');end if;
   end loop;
   for i in 0..n-1 loop
    p:=players->i;
    players:=jsonb_set(players,array[i::text],p||jsonb_build_object('ping',case when p->>'role'='runner' then jsonb_build_object('lat',p->'lat','lng',p->'lng','accuracy',p->'accuracy','updated',p->'updated') else null end));
   end loop;
   s:=s||jsonb_build_object('phase','headstart','round',0,'deadline',t+300);
 elsif p_action='tag' then
   if s->>'phase' not in ('headstart','active') then raise exception 'No active game';end if;
   players:=jsonb_set(players,array[idx::text],(players->idx)||'{"role":"hunter","reason":"Tagged","pending_until":null,"pending_circle":null}'::jsonb);
 elsif p_action='end' then
   if u<>r.host then raise exception 'Only the host can end the game';end if;
   s:=s||'{"phase":"finished","deadline":null,"end_reason":"The host ended the game."}'::jsonb;
 elsif p_action='leave' then
   if u=r.host then
     s:=s||'{"phase":"finished","deadline":null,"end_reason":"The host left the room."}'::jsonb;
   elsif s->>'phase'='lobby' then players:=players-idx;
   else players:=jsonb_set(players,array[idx::text],(players->idx)||'{"left":true,"ping":null,"role":"hunter","reason":"Left game","lat":null,"lng":null,"updated":null,"pending_until":null,"pending_circle":null}'::jsonb);
   end if;
 end if;
 if s->>'phase' in ('headstart','active') and not exists(select 1 from jsonb_array_elements(players) x where x->>'role'='runner' and not coalesce((x->>'left')::boolean,false)) then
   s:=s||'{"phase":"finished","deadline":null,"end_reason":"Everyone was infected. Good hunt."}'::jsonb;
 end if;
 if s->>'phase'='finished' then
   select coalesce(jsonb_agg(x||'{"lat":null,"lng":null,"accuracy":null,"updated":null,"ping":null,"pending_until":null,"pending_circle":null}'::jsonb),'[]') into players from jsonb_array_elements(players) x;
 end if;
 s:=jsonb_set(s,'{players}',players);
 update public.manhunt_rooms set state=s where code=r.code;
 return public.manhunt_snapshot(s,t);
end;
$$;
revoke all on function public.manhunt_snapshot(jsonb,double precision) from public, anon, authenticated;
revoke all on function public.manhunt_distance(jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.manhunt_on_campus(jsonb) from public, anon, authenticated;
revoke all on function public.manhunt_next(jsonb) from public, anon, authenticated;
revoke all on function public.manhunt_enter(text,text) from public, anon;
revoke all on function public.manhunt_action(text,text,jsonb) from public, anon;
grant execute on function public.manhunt_enter(text,text) to authenticated;
grant execute on function public.manhunt_action(text,text,jsonb) to authenticated;
commit;
