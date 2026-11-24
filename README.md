# Couples App

A shared app for one space — a couple, a family, or a household. One place for the things
everyone in the space plans and remembers together:

- **Seasonal bucket list** with season tabs (Spring / Summer / Fall /
  Winter, current season marked "now"), a one-time season-change greeting
  that offers to carry unfinished wishes into the new season, and
  season-aware suggestion chips.
- **Long-term bucket list** for the big dreams, shown on the home page
  under the seasonal list.
- **Shared calendar** with upcoming plans, past plans, and tap-for-details
  pop-outs on every event.
- **Idea collections** for dates, dinners, recipes, crafts, and places to
  try — all shown on the home page too, with their add forms and
  tap-to-add suggestion chips on the Add & browse page.
- **Tuck sections away** — every section on the home page has a little
  arrow in its header; tap the arrow (or the header) to hide that
  section's contents, tap again to bring them back. The choice is saved
  on that phone, so it sticks between visits.
- **Pick for tonight** — a random picker across open date, dinner, and
  places ideas.
- **Dinner this week** — one person suggests a dinner for a night this
  week (pick the day, defaults to today); suggestions lay out by day,
  soonest first, like the calendar. Anyone else in the space can accept it, decline
  it, or counter with something else for the same night. Counters show
  "Instead of: …", an accepted dinner gets an "It's decided" banner for
  that day, past dinners and earlier rounds stay in collapsible history.
- **Cravings** — anyone posts "I'm craving X" or "I'm looking
  for Y" (food, an item, anything), with an optional note. Someone else
  can mark it "Got it", recording who fulfilled it and where they found
  it. Fulfilled cravings move to a collapsible history.
- **Tell you later** — something to tell everyone else, a thing to
  remember to do, or good news worth celebrating later, before it's
  forgotten by dinner. Three kinds: "Tell you", "Remind me to do",
  and "Good news", each with an optional "when?" note. Mark one "Told
  you", "Done", or "Celebrated" and it moves to a collapsible history.
- **Push notifications** — a gentle ping on your phone when someone else
  in your space posts a craving, suggests a dinner, or leaves you a note. Each phone
  opts in once from a banner on the home page; saying no hides it and
  never nags. See "Push notifications" below for the setup.
- **It knows who you are** — each account types a name once ("Who are
  you?"), saved on that account, so the dinner, cravings, and
  tell-you-later forms already know who's typing. No toggle on every
  post, and no identity UI on the forms at all — the name shows up on
  the posted item instead ("Maya suggested…", "Sam is craving…").
  Anyone can change their saved name later from the header.
- **Scrapbook** — photos with a caption and date, shown as tilted
  polaroids with a lightbox.
- **Backup** — export everything as JSON, or import a backup file (the
  format matches the prototype's export, so a backup downloaded from the
  prototype can be imported here).
- **Install it like an app** — the app is installable on your phones:
  add it to the home screen and it shows up with its own icon (a little
  plum book with a heart) and the name "Co-op Mode", opening full
  screen like a downloaded app. No app store, no subscription. See
  "Install it on your phones" below.

This is a production port of a prototype that lived in a workshop with no
login. The real version adds Supabase Auth (email + password) and a shared
Supabase database so both people can use it from their own phones.

**This app is completely separate from Bark Park Buddies**: its own GitHub
repo, its own Supabase project, its own database, its own storage bucket,
and its own Vercel project. Nothing is shared between the two.

## Tech stack

- [Next.js](https://nextjs.org/) 15 (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Supabase](https://supabase.com/) — Postgres, Auth (email + password),
  and Storage for scrapbook photos

## Setup — what Andrew needs to do

Do these in order. Nothing below touches Bark Park Buddies.

### 1. Create a NEW Supabase project (separate from Bark Park Buddies)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and
   click **New project**.
2. Name it `couples-app` (any name works, this keeps it obvious).
3. Pick a database password and save it somewhere safe (a password
   manager). Pick a region near you.
4. Wait for the project to finish provisioning (about a minute).

Do **not** reuse the Bark Park Buddies project. This app gets its own
database, its own keys, and its own storage bucket.

### 2. Run the migration SQL in the new project

1. In the new project's dashboard, open the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `supabase/migrations/0001_couples_app.sql` in this repo, copy the
   whole file, and paste it into the query editor.
4. Click **Run**. It creates the `items`, `events`, `dinner_proposals`,
   and `memories` tables, enables Row Level Security, and creates the
   `scrapbook-photos` storage bucket with its policies.
5. Repeat with `supabase/migrations/0002_cravings.sql` in a new query.
   It adds the `cravings` table (the Cravings board) with the same
   Row Level Security pattern. Run 0002 only after 0001.
6. Repeat with `supabase/migrations/0003_profiles.sql` in a new query.
   It adds the `profiles` table (one row per account, saying which of
   the two people it is) with the same Row Level Security pattern. Run
   0003 only after 0002. The dinner and cravings forms won't know
   who's typing until this has run.
7. Repeat with `supabase/migrations/0004_dinner_dates.sql` in a new
   query. It adds a `dinner_date` column to the `dinner_proposals`
   table so dinner suggestions can be laid out by day. Run 0004 only
   after 0003. Dinner suggestions saved before this change have no
   date and keep working; they show under "No day picked yet".
8. Repeat with `supabase/migrations/0005_tell_you_later.sql` in a new
   query. It adds the `tell_you_later` table (the "Tell you later"
   section) with the same Row Level Security pattern. Run 0005 only
   after 0004.
9. Repeat with `supabase/migrations/0006_push_subscriptions.sql` in a
   new query. It adds the `push_subscriptions` table (one row per phone
   that enables push notifications). Unlike the shared tables, each
   person can only see their own subscriptions — the Edge Function
   reads them with the service role key instead. Run 0006 only after
   0005. If you don't want push notifications, you can skip this file
   and the Edge Function in the "Push notifications" section; the app
   works exactly as before without them.

You can re-run any file safely — they use `create table if not exists`
and drop policies before recreating them.

### 3. Copy the API keys

In the new project's dashboard, go to **Project Settings → API** and copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon `public` key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Use the **anon** key, not the `service_role` key. The service-role key
bypasses Row Level Security and must never be put in a frontend app.

### 4. Create the two user accounts

1. In the new project's dashboard, go to **Authentication → Users**.
2. Click **Add user → Create new user**.
3. Enter Andrew's email and a password, and check **Auto Confirm User**
   (so no confirmation email is needed), then click **Create user**.
4. Repeat for Juliette's email and password.

Both accounts sign in to the same shared app and see the same data.
There is no separate "couple" to configure — sharing is by design (see
"How sharing works" below).

The first time each of you signs in, the app asks "Who are you?" once.
Pick your name and it is saved on your account — after that, dinner
suggestions, counters, and cravings are posted as you automatically,
with no identity questions on the forms. Your name shows on the things
you post, so the other can see who suggested what.

### 5. Deploy to Vercel as a NEW project

1. Go to [vercel.com](https://vercel.com) and click **Add New → Project**.
2. Import this GitHub repository (`Moonc8ke/couples-app`).
3. Before deploying, add the two environment variables (under
   **Environment Variables**):
   - `NEXT_PUBLIC_SUPABASE_URL` — the Project URL from step 3
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key from step 3
4. Click **Deploy**.

When it finishes, Vercel gives the app a web address (something like
`couples-app.vercel.app`). Open it on both phones, sign in with the two
accounts from step 4, and you're in. Add it to your home screens so it
feels like an app.

Do **not** add it to the Bark Park Buddies Vercel project — this is a
separate Vercel project with its own address and its own env vars.

### Install it on your phones

The app is installable, so it can live on your home screens with its own
icon (a little plum book with a heart) and the name "Co-op Mode",
opening full screen like a downloaded app. No app store, no subscription.

If you already saved the site to your home screen before this was added,
that old shortcut won't pick up the new icon or the full-screen
behaviour on its own — delete it first, then re-add it once:

1. **Delete the old home-screen shortcut** (long-press the icon, remove
   it). This doesn't delete anything from the app — your lists, plans,
   and photos live in Supabase, not on the phone.
2. **Android (Chrome):** open the app's address, tap the three-dot
   menu → **Add to Home screen** (or tap **Install** if the browser
   offers it).
3. **iPhone (Safari):** open the app's address, tap the **Share**
   button → **Add to Home Screen**.

After this one-time re-add, the app keeps updating itself automatically
whenever a new version is deployed — it's still the same website
underneath. It needs internet to load and to sync between your two
phones, the same as the website does. (There is a service worker now,
but it only handles push notifications — nothing is cached offline, so
you never get a stale copy of the app and it can't interfere with
sign-in.)

### Push notifications

When one of you posts a craving, suggests a dinner, or leaves a
"Tell you later" note, the other gets a gentle ping on their phone.
It works the other way too: when one of you marks a craving
"Got it", answers a dinner suggestion, or marks a note done, the
person who posted it gets a ping.
Each phone opts in once from a banner on the home page; saying no
hides it and never nags. The banner only shows when push can work on
that phone and no choice has been made yet.

How it works: the app registers a small service worker that only
handles notifications (it never caches anything), the phone saves a
push subscription in the `push_subscriptions` table, and a Supabase
Edge Function (`supabase/functions/send-push`) sends the ping when a
new row appears, or when a row is answered or finished. Scope is v1: only cravings, dinner proposals, and
tell-you-later notes send notifications — bucket-list items, calendar
events, and scrapbook memories do not.

The app code deploys itself through Vercel as usual. The rest needs
your Supabase login, in order:

1. **Run migrations 0005 and 0006** in the Co-op mode Supabase SQL
   Editor (step 2 above). 0005 adds the `tell_you_later` table; 0006
   adds the `push_subscriptions` table.
2. **Set the Edge Function secrets** with the Supabase CLI. First
   link the CLI to the project (the project ref is the part after
   `/project/` in the dashboard URL):
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase secrets set \
     VAPID_PUBLIC_KEY="BMN_UsjtfIlrdK4-qgkyDQvumv-lxWdh0_N10L3UjvKFNPu9wbZynKYl1NipTnU3qzogDRlZ7SshzA5Hm95l9JU" \
     VAPID_PRIVATE_KEY="<the private key shared with you directly>" \
     VAPID_SUBJECT="mailto:rabe.andrew@yahoo.com"
   ```
   The public key is already hardcoded in `src/lib/push.ts` (it is
   public by design). The **private key is never stored in this repo**
   — it was generated with the app code and shared with you directly;
   paste that value in place of `<the private key shared with you
   directly>`. If you ever lose it, generate a new pair and update
   both the secret and `src/lib/push.ts` to match.
3. **Deploy the Edge Function** with the Supabase CLI, from this repo:
   ```bash
   supabase functions deploy send-push
   ```
4. **Create the Database Webhooks** in the Supabase dashboard
   (Database → Webhooks), one per table — a webhook watches a single
   table. For each of `cravings`, `dinner_proposals`, and
   `tell_you_later`:
   - Name: `send-push-cravings` (and so on for each table)
   - Table: the table name; Events: **INSERT and UPDATE**
   - Type: HTTP Request, Method: **POST**
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/send-push`
   - HTTP Headers: `Authorization: Bearer <your anon key>` (Project
     Settings → API) and `Content-Type: application/json`

   The function only pings on a real change — a new post, a "Got it",
   an accept or decline, or a note marked done — so edits and re-saves
   stay silent. A dinner counter needs no extra setup: the counter is
   a new suggestion row, so its INSERT already pings the suggester.
5. **Enable notifications on each phone**: open the app, and tap
   **Enable notifications** on the banner at the top of the home page.
   The browser asks for permission once. On iPhone this only works if
   the app is installed on the Home Screen and the phone runs iOS 16.4
   or later; on Android it works from the installed app in Chrome.

To test it, post a craving from one phone and watch the other —
then mark it "Got it" from the second phone and watch the first. If a
phone stops receiving pings (app uninstalled, permission revoked), the
Edge Function deletes that phone's subscription the next time it tries
to send to it, so it never keeps trying a dead device.

### 6. (Optional) Import the prototype's data

If you have a backup file from the prototype (`couples-app-backup.json`,
downloaded with its "Back up everything" button):

1. Sign in to the new app.
2. On the home page, click **Import a backup** and choose the file.
3. It adds the items, calendar plans, and dinner suggestions, and
   re-links dinner counters to the new rows. It reports how many rows
   were added and how many were skipped.

One honest limitation: **scrapbook photos are not in backup files** —
the prototype's export only carries each memory's caption and date, not
the photo itself. Imported memories come in as caption-only entries
(shown with a placeholder tile). Re-add the photos from your phones if
you want them back in the scrapbook.

## How sharing works

- **Auth:** Supabase Auth with email + password. The app has a sign-in
  page; unauthenticated visitors are redirected to it.
- **Sharing model:** Row Level Security is enabled on every table, with a
  single policy per table: any signed-in user can read and write every
  row. This is a deliberate choice for a small family app — everyone in
  the space shares everything on purpose, and there is no per-user
  ownership. Spaces (migration 0007) wall each space's data off from
  every other space. The one exception is `push_subscriptions`
  (migration 0006): each person can only see their own notification
  subscriptions, because a subscription belongs to one phone. The
  send-push Edge Function reads them with the service role key instead,
  so it can notify the other members of the space.
- **Who's who:** The `profiles` table (migration 0003) holds one row per
  account with a free-form `display_name`, typed in the app's "Who are
  you?" picker (migration 0009 dropped the old Andrew/Juliette-only
  check). The app reads it on sign-in; dinner suggestions and cravings
  are posted as that person, and accept/decline/counter/"Got it" are
  recorded as that person too. Older dinner and craving rows keep the
  names they were saved with. Names are unique within a space since
  migration 0010: the picker refuses a name another member already
  uses (compared without caring about upper/lower case), and a unique
  index in the database backs that up. Two different spaces may still
  reuse the same name.
- **Photos:** Scrapbook photos live in the `scrapbook-photos` storage
  bucket (public for viewing, so they render with a plain `<img>` tag;
  only signed-in users can upload or delete). Photo URLs include a
  timestamp and random suffix, but anyone who has a URL can view that
  photo — don't share photo links outside the two of you.
- **Season greeting:** When the calendar season changes, the app shows a
  one-time "Welcome to Winter!" style greeting and offers to carry
  unfinished wishes from last season into the new one. Which season was
  last seen is stored in each browser's localStorage, so each phone gets
  its own greeting.

## Local development

```bash
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm install
npm run dev                  # http://localhost:3000
```

`npm run build` verifies the production build. It needs the two
`NEXT_PUBLIC_SUPABASE_*` variables set (placeholder values are fine for a
build check — the app only reads them at runtime).

## Project structure

```
public/
  manifest.webmanifest  PWA manifest: name "Co-op Mode", standalone,
                        cream theme, app icons
  icon.svg              App icon source (text SVG): plum book + heart.
                        The PNGs below are generated from it at build
                        time by scripts/generate-icons.mjs (prebuild)
                        and are not committed.
  icon-192.png          App icon, 192x192 (generated, gitignored)
  icon-512.png          App icon, 512x512 (generated, gitignored)
  icon-maskable-512.png App icon with safe-zone padding (maskable)
                        (generated, gitignored)
  apple-touch-icon.png  iPhone home-screen icon, 180x180
                        (generated, gitignored)
  launch-*.png          iPhone launch images, 8 portrait sizes
                        (generated from scripts/launch-template.svg
                        by scripts/generate-icons.mjs, gitignored)
src/
  app/
    layout.tsx            Root layout + metadata
    page.tsx              Home (requires sign-in, renders the app)
    globals.css           Warm paper theme (ported from the prototype)
    login/page.tsx        Email + password sign-in
    auth/callback/route.ts  Supabase email-confirmation return trip
  components/
    CouplesApp.tsx        Views (home / add / scrapbook), season greeting,
                          coming-up list, seasonal panel, all collections
                          on home, pick for tonight, scrapbook tile,
                          backup export/import
    items.tsx             Bucket-list + idea sections, item cards with
                          detail pop-outs, add forms, suggestion chips
    calendar.tsx          Shared calendar, event cards with detail pop-outs
    dinner.tsx            "Dinner this week" suggest / accept / decline /
                          counter flow, laid out by day
    cravings.tsx          Cravings board: post a craving or a wish, mark
                          it "Got it" with who fulfilled it and where
    tell-you-later.tsx    "Tell you later": something to tell the other,
                          a thing to remember to do, or good news to
                          celebrate later; mark it told / done /
                          celebrated
    push-banner.tsx       Dismissible "Enable notifications" banner on
                          the home page
    sw-register.tsx       Registers the push-only service worker
    identity.tsx          "Who are you?" picker and the compact
                          in-form name chooser
    scrapbook.tsx         Polaroid grid, photo upload, lightbox
    shared.tsx            Section panels, headers, dialog shell, and the
                          home-section tuck-away state (localStorage)
  lib/
    supabase/             Browser, server, and middleware Supabase clients
    data.ts               All Supabase reads/writes, photo upload,
                          backup export/import
    push.ts               Web Push helpers: VAPID public key, subscribe
                          this device and save its subscription
    seasons.ts            Season math, date formatting
    suggestions.ts        Category metadata + suggestion chips
    types.ts              Shared types + backup file format
supabase/
  migrations/
    0001_couples_app.sql  Tables, RLS policies, storage bucket + policies
    0002_cravings.sql     Cravings table + RLS (run after 0001)
    0003_profiles.sql     Profiles table + RLS (run after 0002)
    0004_dinner_dates.sql Dinner date column on dinner_proposals
                          (run after 0003)
    0005_tell_you_later.sql  "Tell you later" table + RLS (run after 0004)
    0006_push_subscriptions.sql  Push subscriptions, one row per
                          phone (run after 0005)
  functions/
    send-push/index.ts    Edge Function: notifies the other partner when
                          a craving, dinner proposal, or tell-you-later
                          note is posted (webhooks on INSERT)
```

## Troubleshooting

- **"Invalid login credentials"**: the email or password doesn't match
  an account. Check that both accounts were created in the *new*
  project (step 4) and that **Auto Confirm User** was checked. Users
  created without auto-confirm can't sign in until they confirm via the
  email link.
- **Sign-in works but lists are empty**: the migration may not have run
  in this project, or the app is pointed at a different Supabase project
  than the one where you ran it. Check the env vars in Vercel match the
  new project, then redeploy.
- **Cravings won't load or save**: the `cravings` table comes from
  migration 0002, which runs separately from 0001. Run
  `supabase/migrations/0002_cravings.sql` in the project's SQL Editor
  (after 0001) and reload the app.
- **"Who are you?" won't save, or the forms don't know who you are**:
  the `profiles` table comes from migration 0003, which runs
  separately from 0001 and 0002. Run
  `supabase/migrations/0003_profiles.sql` in the project's SQL Editor
  (after 0002) and reload the app. Until it runs, the picker says so
  when you try to save, and the dinner and cravings forms show a
  compact "Who's posting?" chooser instead.
- **Dinner suggestions won't save, or dates don't show**: the
  `dinner_date` column comes from migration 0004, which runs
  separately from 0001–0003. Run
  `supabase/migrations/0004_dinner_dates.sql` in the project's SQL
  Editor (after 0003) and reload the app. Until it runs, suggesting a
  dinner fails (the save needs the new column), while older
  suggestions still load and show under "No day picked yet".
- **"Tell you later" won't load or save**: the `tell_you_later`
  table comes from migration 0005, which runs separately from
  0001–0004. Run `supabase/migrations/0005_tell_you_later.sql` in the
  project's SQL Editor (after 0004) and reload the app.
- **The notifications banner never appears**: push needs a browser
  that supports it. On iPhone it only works for the app installed on
  the Home Screen (iOS 16.4+), not from Safari directly, and only
  after the app has been opened at least once. If permission was
  already denied, the banner hides itself — re-enable notifications
  in the browser's site settings for the app's address. If the banner
  was dismissed with "Not now", it stays hidden on that phone.
- **Notifications aren't arriving**: check the pieces in order — the
  `push_subscriptions` table exists (migration 0006), the Edge
  Function is deployed (`supabase functions list` should show
  `send-push`), the three webhooks exist (Database → Webhooks) and
  are enabled, and the phone tapped "Enable notifications" (the
  banner hides once it's on). The Edge Function's logs (Supabase
  dashboard → Edge Functions → send-push → Logs) show each send, and
  a "VAPID keys not configured" error means step 2 of the push setup
  hasn't run.
- **Photo upload fails**: check the `scrapbook-photos` bucket exists in
  the new project's **Storage** section (the migration creates it). If it
  is missing, re-run the migration SQL.
- **"Failed to fetch" / network errors**: usually the env vars. The app
  reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  at build time on Vercel — if you add or change them after a deploy,
  redeploy so the new values take effect.
- **Data from the prototype didn't appear after import**: the import
  reports how many rows it added and skipped. Rows are skipped when a
  title is missing or a category/season value isn't recognized — check
  the backup file is the JSON downloaded from the prototype, not a
  screenshot or a renamed file.
- **The home-screen icon is still the old one, or it opens in the
  browser**: that shortcut was saved before the app became installable,
  and old shortcuts don't update on their own. Delete the old icon from
  the home screen and re-add it (see "Install it on your phones"
  above) — the new one opens full screen with the book icon and the
  name "Co-op Mode".
