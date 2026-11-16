"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildBackup,
  carryOverItems,
  downloadBackup,
  getMyProfile,
  importBackup,
  listCravings,
  listDinnerProposals,
  listEvents,
  listItems,
  listMemories,
  setMyProfile,
  type ImportResult,
} from "@/lib/data";
import { CATEGORY_META } from "@/lib/suggestions";
import {
  SEASONS,
  SEASON_EMOJI,
  fmtFull,
  seasonFor,
  seasonOffset,
  todayStr,
} from "@/lib/seasons";
import type {
  CalEvent,
  Craving,
  DinnerProposal,
  Item,
  Memory,
  Person,
  Season,
} from "@/lib/types";
import { CategorySection, ItemCard } from "./items";
import { CalendarSection, EventCard } from "./calendar";
import { CravingsSection } from "./cravings";
import { DinnerDecisionsSection } from "./dinner";
import { IdentityPickerModal } from "./identity";
import { ScrapbookSection } from "./scrapbook";
import { EmptyNote, SectionHeader, sectionPanelStyle, useCollapsedSections } from "./shared";

type View = "home" | "add" | "scrapbook";

const SEEN_SEASON_KEY = "couples-app-season-seen";

export default function CouplesApp({ userEmail }: { userEmail: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [proposals, setProposals] = useState<DinnerProposal[]>([]);
  const [cravings, setCravings] = useState<Craving[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("home");

  // Identity: who is signed in. Read from the profiles table on session
  // load, so the dinner and cravings forms already know who's typing.
  // Null until the person has picked a name.
  const [me, setMe] = useState<Person | null>(null);
  const [identityModal, setIdentityModal] = useState<"first-run" | null>(
    null,
  );
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState("");
  // The first-run picker is offered once per session; dismissing it
  // doesn't reopen it on every refresh, the forms show their own
  // compact chooser instead.
  const identityPromptedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [itemsData, eventsData, proposalsData, cravingsData, memoriesData] =
        await Promise.all([
          listItems(supabase),
          listEvents(supabase),
          listDinnerProposals(supabase),
          listCravings(supabase),
          listMemories(supabase),
        ]);
      setItems(itemsData);
      setEvents(eventsData);
      setProposals(proposalsData);
      setCravings(cravingsData);
      setMemories(memoriesData);
      setLoadError("");
    } catch {
      setLoadError("Something didn't load. Please try again.");
    } finally {
      setLoading(false);
    }
    // Identity is fetched separately, so a profiles-table problem never
    // blocks the lists above.
    try {
      const profile = await getMyProfile(supabase);
      if (profile) {
        setMe(profile.display_name);
      } else if (!identityPromptedRef.current) {
        identityPromptedRef.current = true;
        setIdentityModal("first-run");
      }
    } catch {
      // Most likely the profiles table doesn't exist yet (migration 0003
      // hasn't run). The lists above still work; the picker explains
      // what to do when saving fails.
      setMe(null);
      setIdentityError(
        "We couldn't load your name yet — if migration 0003 hasn't run in Supabase, run it first, then pick your name.",
      );
      if (!identityPromptedRef.current) {
        identityPromptedRef.current = true;
        setIdentityModal("first-run");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Saves a picked name to the signed-in account's profile row. */
  async function saveIdentity(person: Person) {
    setIdentitySaving(true);
    setIdentityError("");
    try {
      await setMyProfile(supabase, person);
      setMe(person);
      setIdentityModal(null);
      setIdentityError("");
    } catch {
      setIdentityError(
        "That didn't save. If migration 0003 hasn't run in Supabase yet, run it first, then try again.",
      );
    } finally {
      setIdentitySaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  // Start each view at the top so switching feels like turning a page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const season = seasonFor(new Date());
  // Home-page sections can be tucked away with the little arrow in
  // their header. The choice is kept in localStorage, so it sticks on
  // this device. The Add & browse page doesn't pass these props, so its
  // sections stay as they are.
  const { isCollapsed, toggle: toggleSection } = useCollapsedSections();
  const collapseProps = (id: string) => ({
    collapsed: isCollapsed(id),
    onToggleCollapsed: () => toggleSection(id),
  });
  // The seasonal panel can browse any season, not just the current one;
  // it starts on the current season.
  const [viewSeason, setViewSeason] = useState<Season>(season);
  const seasonItems = items.filter(
    (i) => i.category === "seasonal" && i.season === viewSeason,
  );
  const seasonOpen = seasonItems.filter((i) => i.status === "idea");
  const seasonDone = seasonItems.filter((i) => i.status === "done").length;
  const seasonPct =
    seasonItems.length === 0
      ? 0
      : Math.round((seasonDone / seasonItems.length) * 100);
  const today = todayStr();
  const upcomingEvents = events.filter((e) => e.event_date >= today);
  const doneCount = items.filter((i) => i.status === "done").length;

  // Season-change moment: when the calendar season has moved on since the
  // last visit, greet the new season once and offer to carry last season's
  // unfinished wishes over. The last-seen season is kept in localStorage.
  const [prevSeason, setPrevSeason] = useState<Season | null>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SEEN_SEASON_KEY);
      if (stored && SEASONS.includes(stored as Season) && stored !== season) {
        setPrevSeason(stored as Season);
      } else if (stored !== season) {
        window.localStorage.setItem(SEEN_SEASON_KEY, season);
      }
    } catch {
      // localStorage unavailable; the greeting just won't persist.
    }
    // Runs once on mount; `season` is fixed for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const prevSeasonItems =
    prevSeason === null
      ? []
      : items.filter(
          (i) => i.category === "seasonal" && i.season === prevSeason,
        );
  const prevSeasonOpen = prevSeasonItems.filter((i) => i.status === "idea");
  const prevSeasonDone = prevSeasonItems.length - prevSeasonOpen.length;
  const [carryPending, setCarryPending] = useState(false);
  const [carryError, setCarryError] = useState("");

  function dismissSeasonGreeting() {
    try {
      window.localStorage.setItem(SEEN_SEASON_KEY, season);
    } catch {
      // ignore
    }
    setPrevSeason(null);
  }

  async function onCarryOver() {
    setCarryPending(true);
    setCarryError("");
    try {
      await carryOverItems(
        supabase,
        prevSeasonOpen.map((i) => i.id),
        season,
      );
      dismissSeasonGreeting();
      void load();
    } catch {
      setCarryError("That didn't carry over. Please try again.");
    } finally {
      setCarryPending(false);
    }
  }

  const [pickedId, setPickedId] = useState<number | null>(null);
  const pickPool = items.filter(
    (i) =>
      (i.category === "date" ||
        i.category === "dinner" ||
        i.category === "places") &&
      i.status === "idea",
  );
  const picked = pickPool.find((i) => i.id === pickedId) ?? null;

  function pickForTonight() {
    if (pickPool.length === 0) return;
    let next = pickPool[Math.floor(Math.random() * pickPool.length)];
    if (pickPool.length > 1) {
      while (next && next.id === pickedId) {
        next = pickPool[Math.floor(Math.random() * pickPool.length)];
      }
    }
    setPickedId(next ? next.id : null);
  }

  function exportBackup() {
    downloadBackup(buildBackup(items, events, proposals, cravings, memories));
  }

  // Import a backup file (the prototype's export format, or one from
  // this app). Scrapbook photos are not in the file, so imported
  // memories come in as caption-only entries.
  const importRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [importPending, setImportPending] = useState(false);

  async function onImportFile(file: File | null) {
    if (!file || importPending) return;
    setImportPending(true);
    setImportError("");
    setImportResult(null);
    try {
      const text = await file.text();
      const payload: unknown = JSON.parse(text);
      const result = await importBackup(supabase, payload);
      setImportResult(result);
      void load();
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : "That file couldn't be imported. Please check it and try again.",
      );
    } finally {
      setImportPending(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        {loading && (
          <p className="mt-10 text-center text-[var(--dim)]">
            Loading your book…
          </p>
        )}
        {loadError && !loading && (
          <div className="mt-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-medium">Something didn&apos;t load.</p>
            <p className="mt-1 text-sm text-[var(--dim)]">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className="mt-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && view === "home" && (
          <>
            {/* Hero: just what's coming up, plus one way in to add things. */}
            <header className="pt-6">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium tracking-wide text-[var(--accent)]">
                  Andrew &amp; Juliette
                </p>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--dim)]"
                  aria-label={`Sign out of ${userEmail}`}
                >
                  Sign out
                </button>
              </div>
              <h1 className="font-display mt-1 text-4xl font-semibold leading-tight">
                {season} together {SEASON_EMOJI[season]}
              </h1>
              <p className="mt-2 max-w-md text-base text-[var(--dim)]">
                Everything in your book, in one place — what&apos;s coming
                up, what you&apos;re dreaming of, and what&apos;s decided.
                Tap “Add new things” when you want to add an idea or plan.
              </p>
              <button
                type="button"
                onClick={() => setView("add")}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-base font-semibold text-white shadow-sm"
              >
                <span aria-hidden className="text-lg leading-none">
                  +
                </span>
                Add new things
              </button>
            </header>

            {/* Season-change greeting: shown once when a new season begins. */}
            {prevSeason && (
              <section
                aria-label={`Welcome to ${season}`}
                className="pop-in mt-6 rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5"
                style={sectionPanelStyle("var(--sky-soft)")}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--sky)] text-[22px] shadow-sm"
                  >
                    {SEASON_EMOJI[season]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-2xl font-semibold leading-tight">
                      Welcome to {season}!
                    </h2>
                    <p className="mt-0.5 text-sm text-[var(--dim)]">
                      {prevSeason} is in the books
                      {prevSeasonItems.length > 0
                        ? ` — you checked off ${prevSeasonDone} of ${prevSeasonItems.length} ${prevSeason} ${
                            prevSeasonItems.length === 1 ? "wish" : "wishes"
                          }.`
                        : "."}
                      {prevSeasonOpen.length > 0
                        ? ` ${prevSeasonOpen.length} ${
                            prevSeasonOpen.length === 1
                              ? "wish didn't"
                              : "wishes didn't"
                          } happen — want to carry ${
                            prevSeasonOpen.length === 1 ? "it" : "them"
                          } into ${season}?`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prevSeasonOpen.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void onCarryOver()}
                      disabled={carryPending}
                      className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {carryPending
                        ? "Carrying over…"
                        : `Carry ${prevSeasonOpen.length} into ${season}`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={dismissSeasonGreeting}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                  >
                    {prevSeasonOpen.length > 0
                      ? `Leave them in ${prevSeason}`
                      : "Lovely, thanks"}
                  </button>
                </div>
                {carryError && (
                  <p className="mt-2 text-sm text-[var(--rose)]">
                    {carryError}
                  </p>
                )}
              </section>
            )}

            {/* Coming up: the next plans on the calendar, soonest first. */}
            <section
              aria-label="Coming up"
              className="mt-7 rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5"
              style={sectionPanelStyle("var(--teal-soft)")}
            >
              <SectionHeader
                emoji="🗓️"
                label="Coming up"
                blurb="Your next plans, in order."
                color="var(--teal)"
                pill={
                  upcomingEvents.length > 0
                    ? `${upcomingEvents.length} coming up`
                    : undefined
                }
                collapsed={isCollapsed("coming-up")}
                onToggle={() => toggleSection("coming-up")}
              />
              {!isCollapsed("coming-up") && (
                <>
                  {upcomingEvents.length === 0 ? (
                    <EmptyNote text="Nothing on the calendar yet. Tap “Add new things” to put your next plan in." />
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {upcomingEvents.map((e) => (
                        <EventCard key={e.id} event={e} refresh={load} />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>

            {/* Dinner decisions: suggest, accept, decline, or counter. */}
            <DinnerDecisionsSection
              proposals={proposals}
              dinnerIdeas={items.filter(
                (i) => i.category === "dinner" && i.status === "idea",
              )}
              refresh={load}
              me={me}
              onPickIdentity={(person) => void saveIdentity(person)}
              onNeedIdentity={() => setIdentityModal("first-run")}
              identitySaving={identitySaving}
              identityError={identityError}
              {...collapseProps("dinner-week")}
            />

            {/* Cravings: post a hankering, the other can surprise you. */}
            <CravingsSection
              cravings={cravings}
              refresh={load}
              me={me}
              onPickIdentity={(person) => void saveIdentity(person)}
              onNeedIdentity={() => setIdentityModal("first-run")}
              identitySaving={identitySaving}
              identityError={identityError}
              {...collapseProps("cravings")}
            />

            {/* Seasonal bucket list: browse any season, current one first. */}
            <section
              aria-label="Seasonal bucket list"
              className="mt-6 rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5"
              style={sectionPanelStyle("var(--accent-soft)")}
            >
              <SectionHeader
                emoji={SEASON_EMOJI[viewSeason]}
                label="Seasonal bucket list"
                blurb="Wishes for this season and the ones coming up. Check one off when you've lived it."
                color="var(--accent)"
                pill={
                  seasonItems.length > 0
                    ? `${seasonDone}/${seasonItems.length} done`
                    : undefined
                }
                collapsed={isCollapsed("seasonal")}
                onToggle={() => toggleSection("seasonal")}
              />
              {!isCollapsed("seasonal") && (
                <>
              <div
                className="mt-3 flex flex-wrap gap-1.5"
                role="tablist"
                aria-label="Choose a season to view"
              >
                {SEASONS.map((s) => {
                  const offset = seasonOffset(season, s);
                  const active = s === viewSeason;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-label={`View ${s} bucket list${offset === 0 ? " (this season)" : offset === 1 ? " (up next)" : ""}`}
                      onClick={() => setViewSeason(s)}
                      className={`rounded-full px-3.5 py-2 text-sm font-semibold ${
                        active
                          ? "text-white shadow-sm"
                          : "border border-[var(--border)] bg-[var(--surface)]"
                      }`}
                      style={
                        active ? { background: "var(--accent)" } : undefined
                      }
                    >
                      {SEASON_EMOJI[s]} {s}
                      {offset === 0 && (
                        <span className="ml-1 text-xs font-medium opacity-80">
                          · now
                        </span>
                      )}
                      {offset === 1 && (
                        <span className="ml-1 text-xs font-medium opacity-80">
                          · up next
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div
                className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--accent-soft)]"
                role="progressbar"
                aria-valuenow={seasonPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${viewSeason} bucket list progress`}
              >
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: `${seasonPct}%` }}
                />
              </div>
              {seasonOpen.length === 0 ? (
                <EmptyNote
                  text={
                    seasonItems.length > 0
                      ? `Every ${viewSeason} wish is checked off. Nice work, you two.`
                      : viewSeason === season
                        ? `No ${viewSeason} wishes yet. Tap “Add new things” to dream a few up.`
                        : `Nothing on the ${viewSeason} list yet. Tap “Add new things” to start dreaming it up.`
                  }
                />
              ) : (
                <ul className="mt-3 space-y-2">
                  {seasonOpen.map((i) => (
                    <ItemCard key={i.id} item={i} refresh={load} />
                  ))}
                </ul>
              )}
                </>
              )}
            </section>

            {/* Long-term bucket list, places, and idea collections —
                now on the home page too, browse-only. Adding new things
                still happens on the Add & browse page. */}
            <CategorySection
              category="longterm"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-longterm")}
            />
            <CategorySection
              category="places"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-places")}
            />
            <CategorySection
              category="date"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-date")}
            />
            <CategorySection
              category="dinner"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-dinner")}
            />
            <CategorySection
              category="recipe"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-recipe")}
            />
            <CategorySection
              category="craft"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-craft")}
            />

            {/* Pick for tonight */}
            <section
              aria-label="Pick for tonight"
              className="mt-6 rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold leading-tight">
                    Can&apos;t decide tonight?
                  </h2>
                  <p className="mt-0.5 text-sm text-[var(--dim)]">
                    Let the book pick a date, dinner, or place to try for you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={pickForTonight}
                  disabled={pickPool.length === 0}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  🎲 Pick for tonight
                </button>
              </div>
              {pickPool.length === 0 && (
                <p className="mt-2 text-sm text-[var(--dim)]">
                  Add a date, dinner, or places idea first, under “Add new
                  things.”
                </p>
              )}
              {picked && (
                <div
                  key={picked.id}
                  className="pop-in mt-3 rounded-xl bg-[var(--rose-soft)] p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rose)]">
                    Tonight&apos;s pick · {CATEGORY_META[picked.category].label}
                  </p>
                  <p className="font-display mt-1 text-xl font-semibold">
                    {picked.title}
                  </p>
                  {picked.notes && (
                    <p className="mt-1 text-sm text-[var(--dim)]">
                      {picked.notes}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={pickForTonight}
                    className="mt-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium"
                  >
                    Pick again
                  </button>
                </div>
              )}
              {doneCount > 0 && (
                <p className="mt-3 text-sm text-[var(--dim)]">
                  ✨ {doneCount} {doneCount === 1 ? "thing" : "things"} checked
                  off together so far.
                </p>
              )}
            </section>

            {/* Scrapbook: a peek at the latest photos, and the way in. */}
            <section
              aria-label="Scrapbook"
              className="mt-6 rounded-[1.4rem] border border-[var(--border)] p-4 shadow-sm sm:p-5"
              style={sectionPanelStyle("var(--berry-soft)")}
            >
              <SectionHeader
                emoji="📸"
                label="Scrapbook"
                blurb="The days you've already lived together, kept like polaroids."
                color="var(--berry)"
                pill={
                  memories.length > 0
                    ? `${memories.length} ${memories.length === 1 ? "memory" : "memories"}`
                    : undefined
                }
                collapsed={isCollapsed("scrapbook")}
                onToggle={() => toggleSection("scrapbook")}
              />
              {!isCollapsed("scrapbook") && (
                <>
              {memories.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {memories.slice(0, 3).map((m) => (
                    <div
                      key={m.id}
                      className="aspect-square w-full overflow-hidden rounded-lg bg-stone-100"
                    >
                      {m.image_url ? (
                        <img
                          src={m.image_url}
                          alt={
                            m.caption || `Memory from ${fmtFull(m.memory_date)}`
                          }
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl">
                          🖼️
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyNote text="No photos pasted in yet. Your first memory is waiting." />
              )}
              <button
                type="button"
                onClick={() => setView("scrapbook")}
                className="mt-3 rounded-full bg-[var(--berry)] px-4 py-2 text-sm font-semibold text-[var(--bg)]"
              >
                {memories.length > 0
                  ? "Open the scrapbook →"
                  : "Start the scrapbook →"}
              </button>
                </>
              )}
            </section>

            {/* Backup: download everything, or restore from a file. */}
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={exportBackup}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
              >
                ⬇ Back up everything
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                aria-label="Choose a backup file to import"
                className="hidden"
                onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                disabled={importPending}
                className="ml-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                {importPending ? "Importing…" : "⬆ Import a backup"}
              </button>
              {importResult && (
                <p className="mt-2 text-sm text-[var(--dim)]">
                  Imported {importResult.items} ideas, {importResult.events}{" "}
                  plans, {importResult.proposals} dinner suggestions,{" "}
                  {importResult.cravings} cravings, and{" "}
                  {importResult.memories} memories
                  {importResult.skipped > 0
                    ? ` (${importResult.skipped} rows skipped)`
                    : ""}
                  . Scrapbook photos aren&apos;t in backup files, so imported
                  memories come in without photos.
                </p>
              )}
              {importError && (
                <p className="mt-2 text-sm text-[var(--rose)]">
                  {importError}
                </p>
              )}
            </div>
          </>
        )}

        {!loading && !loadError && view === "add" && (
          <>
            {/* Add page: every collection, its add form, and suggestions. */}
            <header className="pt-6">
              <button
                type="button"
                onClick={() => setView("home")}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold"
              >
                ← Back to what&apos;s coming up
              </button>
              <h1 className="font-display mt-4 text-3xl font-semibold leading-tight">
                Add &amp; browse
              </h1>
              <p className="mt-1 max-w-md text-base text-[var(--dim)]">
                Every list lives here: add new ideas, tap a suggestion, and
                plan what&apos;s next. Photos live in the scrapbook, one tap
                from the home page.
              </p>
            </header>

            <CategorySection category="seasonal" items={items} refresh={load} />
            <CalendarSection events={events} refresh={load} />
            <CategorySection category="longterm" items={items} refresh={load} />
            <CategorySection category="date" items={items} refresh={load} />
            <CategorySection category="places" items={items} refresh={load} />
            <DinnerDecisionsSection
              proposals={proposals}
              dinnerIdeas={items.filter(
                (i) => i.category === "dinner" && i.status === "idea",
              )}
              compact
              refresh={load}
              me={me}
              onPickIdentity={(person) => void saveIdentity(person)}
              onNeedIdentity={() => setIdentityModal("first-run")}
              identitySaving={identitySaving}
              identityError={identityError}
            />
            <CravingsSection
              cravings={cravings}
              compact
              refresh={load}
              me={me}
              onPickIdentity={(person) => void saveIdentity(person)}
              onNeedIdentity={() => setIdentityModal("first-run")}
              identitySaving={identitySaving}
              identityError={identityError}
            />
            <CategorySection category="dinner" items={items} refresh={load} />
            <CategorySection category="recipe" items={items} refresh={load} />
            <CategorySection category="craft" items={items} refresh={load} />

            <p className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setView("home")}
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                ← Done — back to what&apos;s coming up
              </button>
            </p>
          </>
        )}

        {!loading && !loadError && view === "scrapbook" && (
          <>
            {/* Scrapbook page: the full polaroid book, reached from home. */}
            <header className="pt-6">
              <button
                type="button"
                onClick={() => setView("home")}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold"
              >
                ← Back to what&apos;s coming up
              </button>
            </header>
            <ScrapbookSection memories={memories} refresh={load} />
            <p className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setView("home")}
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                ← Done — back to what&apos;s coming up
              </button>
            </p>
          </>
        )}

        <footer className="mt-12 text-center text-xs text-[var(--dim)]">
          Made for two. Everything you add is saved here, ready for the next
          “what should we do?”
        </footer>

        {/* Who are you? — one-time picker the first time someone signs
            in. The name is saved on their account; after that the
            dinner and cravings forms post as them silently. */}
        {identityModal && (
          <IdentityPickerModal
            saving={identitySaving}
            error={identityError}
            onPick={(person) => void saveIdentity(person)}
            onDismiss={() => setIdentityModal(null)}
          />
        )}
      </main>
    </div>
  );
}
