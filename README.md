# MANHUNT · College Park

A phone-friendly campus infection game. Static HTML, CSS and JavaScript on Vercel, with Supabase handling shared state, anonymous identities and server-controlled rules. Leaflet + OpenStreetMap provide the map; no Google Maps API key needed.

## Try the interface

Run `npm run dev` in this folder and open the local address it prints. Choose **Explore a demo**. The demo simulates five players; **Skip to next round** advances the circle. It never shares or requests real locations. The website needs internet access for the map and libraries.

## Enable real multiplayer

1. Create a project at https://supabase.com.
2. Under **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**. Each browser gets its own private identity without a signup form. Keep the same browser/device to reconnect as the same player.
3. Run the entire `supabase.sql` file in the project's **SQL Editor**. It creates the room table and restricted functions. Run it using the database owner, as the SQL Editor normally does.
4. Enable **pg_cron** under **Database → Extensions**, then run `cleanup.sql` once. This deletes expired rooms automatically even if everyone closes their browser. Rooms expire 12 hours after creation, and cleanup runs every five minutes.
5. Find your project URL and **publishable key** (or legacy `anon` key) under **Project Settings → API / API Keys**. Put them in `config.js`:

   ```js
   window.MANHUNT_CONFIG = {
     supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
     supabasePublishableKey: 'YOUR-PUBLIC-PUBLISHABLE-KEY'
   };
   ```

   These values are intentionally visible in the browser. **Never use a secret or service_role key here.** The database rejects direct reads/writes, checks authenticated membership on every game request, and limits host actions to the host.

6. Push this folder to your own GitHub repository and import it into Vercel. Choose **Other** as the framework, no build command, and `.` as the output directory. If this folder sits inside a larger repository, choose `outputs/campus-manhunt` as the Vercel root directory. Deploy. Alternatively run `npx vercel` in this folder and follow its prompts.
7. Open the HTTPS deployment on your phones. Create a room, copy the invite using the room code button, and have each friend join with a name. Every player taps **Enable location** and allows the browser permission. The host chooses the starting hunter count and starts the game.

Supabase is the shared backend; a Vercel deployment by itself does not enable multiplayer. This project does not require paid Google services. Check your hosting/backend provider's current quotas before relying on any free tier.

## Game rules

- Up to 15 players. Nicknames are capped at 24 characters. Room codes are six characters. Joining is closed after the game starts; existing players can reconnect from the same browser through Join lobby.
- The starting zone is a true **800-meter-radius circle centered at 38.9897, -76.9436**, covering a central chunk of campus. Parts of campus are intentionally outside the starting circle. Zones are never clipped to campus property lines; the visible circle is the game boundary.
- The server randomly selects the chosen number of hunters. Runners get five minutes to scatter. Each player sees their own GPS live. All players see runner locations live, using the latest uploaded GPS fix. Hunters see fellow hunters live; runners receive hunter coordinates only during their own active reveal. This applies to reconnects too. Hunters must honor the head-start rule.
- At the end of the head start, round 1 begins with the original circle. The first shrink happens five minutes later. Each following shrink is five minutes apart.
- The dashed amber circle is the next boundary. It is visible for the full preceding five minutes, including a preview during head start. Circle centers stay on the main-campus parcel, using Maryland iMAP boundary data only to choose centers; it does not clip the circles. Each next radius is `max(0, current radius × 0.72 − 5)` meters. Each game chooses one of six destinations with equal chances: two north-campus, two central, and two south-campus options (including the Mall area and farther south). Circles move toward that hidden destination with randomized step lengths, while staying nested and keeping their centers on campus. This makes southern finishes as likely as northern ones instead of relying on a short random walk from the starting center. Eventually the radius reaches zero if runners remain. Circles are not snapped to paths or accessible buildings.
- At a shrink deadline, runners outside the new circle become hunters. A 20-meter tolerance reduces boundary errors. Crossing outside between deadlines does not infect someone immediately.
- A valid boundary fix must be no more than 30 seconds old with reported accuracy within 100 meters. Missing or poor fixes trigger a **90-second grace period from the deadline**. A fresh, accurate update during grace is checked against that boundary; outside means hunter. No valid fix before grace expires also means hunter. This is a forgiving game rule, not proof of someone's historical position.
- Players press **I got tagged** to become hunters. There is no way to undo it. Hunters cannot infect someone remotely through the UI. GPS and tagging remain honor-based; browser locations can be spoofed.
- The game ends when all remaining runners are infected or the host ends it. Player locations are cleared from shared state and tracking stops. Leaving clears your location; leaving an active game forfeits your runner role. When the host leaves, the game ends for everyone.
- Game updates poll every three seconds; GPS uploads are throttled to approximately every 4–6 seconds. Only recent browser samples are uploaded. Deadlines use database time. If all browsers disconnect, rules are reconciled against elapsed deadlines on the next request; no always-running Vercel server is needed.

## Location and privacy

Players explicitly enable location. The server stores the latest GPS fix and a private temporary stats anchor. Each player sees their own live fix and every runner’s live fix. Hunter GPS is returned to hunters and to runners with an active reveal. Outside an active reveal, runners receive only hunter proximity booleans, not hunter coordinates, exact distances, identities, or counts. No location history is recorded by this app; each update replaces the prior fix. Expired room cleanup requires the scheduled job above. Like other hosted databases, your provider may retain backups independently of application deletion.

Keep the room code within your group: it is an invitation secret, not strong authentication. Room membership is required to read locations after joining. Do not use this for public matchmaking without adding abuse protection, invite controls, rate limits and anonymous sign-in CAPTCHA.

**Keep the browser open and the screen awake.** The app requests a screen wake lock when supported, but phone/browser behavior varies. Locking the phone or changing apps may stop GPS updates and trigger the stale-location rules. HTTPS is required for location on deployed phones; localhost works for development. A native app would be needed for dependable background tracking.

Play only where you are permitted to go. Circle geometry does not know whether a destination is a road, closed building, construction site or accessible route. Agree on any excluded areas before starting.

## Test before playing

`npm test` runs fourteen dependency-free circle and demo tests. Run `npm install`, then `npm run test:db` for 40 additional checks using an isolated in-memory PostgreSQL runtime. These exercise the real SQL functions with mocked user identities without touching a Supabase project.

Before relying on a real game, test with two or more phones on your deployment:

1. Create/join the same room; confirm both names and locations appear, and a non-host cannot start/end the game.
2. Confirm starting requires everyone inside the initial circle with a recent GPS fix. Select hunters and verify everyone sees the same assignments and countdown.
3. Try denying location access, refreshing the page, briefly disconnecting, then rejoining from the same browser.
4. Wait through the head start and first shrink. Verify the new circle matches the preview and test the stale-location grace period with a spare device.
5. Press **I got tagged**, then end the game and verify all location markers disappear.

Database functions are transactional and serialize updates to each room using a row lock, so concurrent requests cannot overwrite each other's tags or circle transitions. All fourteen browser-logic tests and 40 database checks passed during development. The desktop/mobile layout, demo map, timer transition and tagging confirmation were checked in a browser. Your configured Supabase Auth, cleanup schedule and real phone GPS still need the deployment checks above.

## Files

- `index.html`, `style.css`: responsive interface
- `app.js`: lobby, map, GPS, shared-state polling, accessibility and connection feedback
- `game.js`: demo and browser geometry utilities
- `config.js`: public Supabase settings
- `supabase.sql`: authoritative game rules and access control
- `cleanup.sql`: expired room cleanup schedule
- `vercel.json`: deployment headers
- `tests/game.test.js`: circle, timing, demo and cleanup checks
- `tests/database.mjs`: database access, transitions, GPS grace and location clearing checks

Map attribution remains visible. OpenStreetMap's public tile service is appropriate only within its usage policy; choose a suitable tile provider if usage grows. External dependencies are Leaflet 1.9.4, Supabase JS 2.49.8, and Google Fonts (with local font fallbacks).

Reference documentation: https://supabase.com/docs/guides/auth/auth-anonymous · https://supabase.com/docs/guides/database/functions · https://leafletjs.com/examples/quick-start/ · https://operations.osmfoundation.org/policies/tiles/

## Updating an existing Supabase setup

Run the updated `supabase.sql` again to replace the game functions, then create a new room. Existing rooms keep their original boundaries.

## V2 mobile features

- Tap **Enable compass arrow** to allow compass access on iPhone. A real compass heading adds an arrow to your own marker. Android absolute-orientation sensors are supported too. Relative orientation, missing sensors, or denied permission leave the normal marker; no movement-direction fallback is used. Hold the phone flat. If heading events stop, the arrow disappears after ten seconds.
- Runner markers use the latest GPS upload for all room members, refreshed through the existing three-second room polling and roughly 4–6-second GPS uploads. There is no runner ping timer. Stale fixes are labeled and faded. Hunter visibility remains restricted.
- During the active hunt only, runners see **Hunter nearby!** when a hunter is within 30 meters. Both fixes must be at most 15 seconds old with reported accuracy within 30 meters. Unknown/stale data never counts as clear. The warning fires once, then rearms only once all hunters are beyond 40 meters (a drift buffer). Dismiss hides the warning without rearming.
- Vibration is attempted where supported and can be toggled off. iPhone Safari generally does not support web vibration, so the visual alert is the reliable fallback. Alerts require the page to stay open; these are not background push notifications. GPS estimates can still miss or falsely trigger a 30-meter warning.
- Upgrade the database with the latest `supabase.sql` before deploying this frontend. Start a new room and have everyone reload for V2. Legacy cached pings are ignored; current runner fixes are returned immediately.

## Catch announcements and hunter selection

Hosts can pick hunters randomly or select exactly the chosen number from the lobby. The server validates membership, uniqueness and count. Everyone with the game open gets a catch announcement when a runner becomes a hunter; zone and location forfeits have distinct messages. Initial assignments and reconnecting do not replay catch announcements. These are in-page notices, not background phone push notifications.

## Hunter reveal pickups

A visible 20-meter pickup zone spawns at each shrink beginning with round 2. No pickup spawns during the head start or first hunting circle. An unclaimed pickup is replaced by the next one. Only the first runner reporting fresh GPS with accuracy within 30 meters inside the zone collects it; the database locks the room so simultaneous requests cannot both win.

Collected items stack privately in the runner’s inventory. Each activation reveals all hunters live to that runner for 60 seconds. Using another item adds 60 seconds. Infection forfeits unused items and ends an active reveal. Everyone sees the unclaimed pickup, including hunters, but only runners can collect it.

Demo: choose a specific destination, skip twice, click “Walk to power-up (demo),” then activate the reveal. Skip again to collect a second item. Real games collect automatically from GPS. Frontend and SQL changes must be deployed together.

### Sidewalk placement

Pickup centers are selected from bundled OpenStreetMap outdoor walking paths sampled at no more than 5-meter intervals. Both SQL and the demo use the same coordinates, filtered to the campus parcel. Samples marked private/restricted, indoor, tunnel, road crossing, construction, or area polygons are excluded. Each pickup center is at least 20 meters inside the current circle. If no eligible sample remains, that circle has no pickup; there is no off-path fallback. Collection still works within 20 meters of the center. Mapping cannot confirm current access or temporary closures.

Path dataset: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), distributed under [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The derived dataset is `campus-paths.js`; retrieval date, source filters and original way IDs are in `campus-paths-source.json`. The SQL embeds the same dataset. No external path service is required during a game.

## Personal end-of-game stats

Each player sees only their own distance (miles), top speed (mph), survival time, and power-ups collected/used after the game. All players see the first-to-last catch order with reasons; simultaneous zone infections share a rank. Starting hunters and uncaught/left players are separate. Survival runs from head start until infection (or game end if uncaught); starting hunters have no survival time.

Movement is estimated on the server from GPS fixes with accuracy within 20 meters, sampled over 5–20 seconds. Movement below the accuracy threshold, speeds above 12 m/s, duplicate/old samples, and tracking gaps are excluded. Stats include running and hunting, starting with the head start. These conservative estimates can undercount actual distance. No route history is stored: only totals and a private temporary GPS anchor, cleared when the game ends. Totals remain with the room until its normal expiry; they are not a permanent profile.

The demo shows explicitly labeled illustrative movement totals; skipping a round advances its simulated clock. Use “Preview results” in the demo to see sample personal stats and catch order. New games started after deploying the SQL and frontend record real stats. Old games do not have retroactive stats.

## Lobby removal

Only the room creator can kick another player, and only in the waiting lobby. Kick buttons disappear once the game starts. The server enforces this rule, prevents self-kicks, removes the player’s room data, and blocks that anonymous identity from rejoining the same room. The removed player returns to the entry screen on the next poll, and their tracking stops. Clearing browser data or using another browser creates a new anonymous identity, so this is not a permanent account ban.

## Last-runner escape

When exactly one runner remains after the head start, the shrinking circle freezes and a blue 20-meter escape zone appears for everyone. The last runner has three minutes to enter it and wins immediately on a new GPS fix with accuracy within 20 meters. Hunters win if the runner is tagged, leaves, or the escape timer expires. The server resolves expiry before accepting GPS; cached fixes cannot win. Existing reveals still work during the chase, and no new power-ups spawn.

The target is a mapped sidewalk point, normally 60–400 meters from the runner’s last position, inside the current circle. If that circle cannot fit a separated sidewalk target, the final chase uses the last larger circle (or starting circle), keeping the escape destination on campus paths. Walking-path geometry does not guarantee access or routing distance. GPS estimates and the honor-system tagging button still apply. If multiple requests arrive together, the room lock determines which accepted action resolves first. The final result remains recorded for the room’s lifetime.

Demo: use “Preview final chase,” then “Reach escape zone (demo)” for a runner win or “Skip to escape timeout” for a hunters win. Start new rooms after upgrading the frontend and SQL.
