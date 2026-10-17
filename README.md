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
- The initial area follows the main-campus parcel in Maryland iMAP�s UMD Administrative Boundary (feature 1), excluding the golf course and detached university properties. Later circles are clipped to this outline; both the server and browser reject off-campus positions. The underlying initial circle has a 1,500 m radius, but its visible/playable area is campus only. Parcel data can lag road changes; agree on accessible play areas before starting. Source: https://mdgeodata.md.gov/imap/rest/services/Structure/MD_CampusFacilities/FeatureServer/3
- The server randomly selects the chosen number of hunters. Runners get five minutes to scatter. Everyone can see every location immediately, including during the head start. Hunters must honor the head-start rule.
- At the end of the head start, round 1 begins with the original circle. The first shrink happens five minutes later. Each following shrink is five minutes apart.
- The dashed amber circle is the next boundary. It is visible for the full preceding five minutes, including a preview during head start. Circle centers stay on campus. Each next radius is `max(0, current radius × 0.72 − 5)` meters. Its center moves randomly within the preceding circle so the next circle is fully contained. Eventually the radius reaches zero if runners remain. Circles are not snapped to paths or accessible buildings.
- At a shrink deadline, runners outside the new circle become hunters. A 20-meter tolerance reduces boundary errors. Crossing outside between deadlines does not infect someone immediately.
- A valid boundary fix must be no more than 30 seconds old with reported accuracy within 100 meters. Missing or poor fixes trigger a **90-second grace period from the deadline**. A fresh, accurate update during grace is checked against that boundary; outside means hunter. No valid fix before grace expires also means hunter. This is a forgiving game rule, not proof of someone's historical position.
- Players press **I got tagged** to become hunters. There is no way to undo it. Hunters cannot infect someone remotely through the UI. GPS and tagging remain honor-based; browser locations can be spoofed.
- The game ends when all remaining runners are infected or the host ends it. Player locations are cleared from shared state and tracking stops. Leaving clears your location; leaving an active game forfeits your runner role. When the host leaves, the game ends for everyone.
- Game updates poll every three seconds; GPS uploads are throttled to approximately every 4–6 seconds. Only recent browser samples are uploaded. Deadlines use database time. If all browsers disconnect, rules are reconciled against elapsed deadlines on the next request; no always-running Vercel server is needed.

## Location and privacy

Players explicitly enable location. Locations are visible to everyone who joins their room during the lobby and game. No location history is recorded by this app; each update replaces the prior fix. Expired room cleanup requires the scheduled job above. Like other hosted databases, your provider may retain backups independently of application deletion.

Keep the room code within your group: it is an invitation secret, not strong authentication. Room membership is required to read locations after joining. Do not use this for public matchmaking without adding abuse protection, invite controls, rate limits and anonymous sign-in CAPTCHA.

**Keep the browser open and the screen awake.** The app requests a screen wake lock when supported, but phone/browser behavior varies. Locking the phone or changing apps may stop GPS updates and trigger the stale-location rules. HTTPS is required for location on deployed phones; localhost works for development. A native app would be needed for dependable background tracking.

Play only where you are permitted to go. Circle geometry does not know whether a destination is a road, closed building, construction site or accessible route. Agree on any excluded areas before starting.

## Test before playing

`npm test` runs five dependency-free circle and demo tests. Run `npm install`, then `npm run test:db` for 17 additional checks using an isolated in-memory PostgreSQL runtime. These exercise the real SQL functions with mocked user identities without touching a Supabase project.

Before relying on a real game, test with two or more phones on your deployment:

1. Create/join the same room; confirm both names and locations appear, and a non-host cannot start/end the game.
2. Confirm starting requires everyone inside the initial circle with a recent GPS fix. Select hunters and verify everyone sees the same assignments and countdown.
3. Try denying location access, refreshing the page, briefly disconnecting, then rejoining from the same browser.
4. Wait through the head start and first shrink. Verify the new circle matches the preview and test the stale-location grace period with a spare device.
5. Press **I got tagged**, then end the game and verify all location markers disappear.

Database functions are transactional and serialize updates to each room using a row lock, so concurrent requests cannot overwrite each other's tags or circle transitions. All five circle/demo tests and 17 database checks passed during development. The desktop/mobile layout, demo map, timer transition and tagging confirmation were checked in a browser. Your configured Supabase Auth, cleanup schedule and real phone GPS still need the deployment checks above.

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

Map attribution remains visible. OpenStreetMap's public tile service is appropriate only within its usage policy; choose a suitable tile provider if usage grows. External dependencies are Turf 7.2.0, Leaflet 1.9.4, Supabase JS 2.49.8, and Google Fonts (with local font fallbacks).

Reference documentation: https://supabase.com/docs/guides/auth/auth-anonymous · https://supabase.com/docs/guides/database/functions · https://leafletjs.com/examples/quick-start/ · https://operations.osmfoundation.org/policies/tiles/

## Updating an existing Supabase setup

Run the updated `supabase.sql` again to replace the game functions, then create a new room. Existing rooms keep their original boundaries.
