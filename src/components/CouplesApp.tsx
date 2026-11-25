"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildBackup,
  carryOverItems,
  downloadBackup,
  getMyProfile,
  getMySpaceId,
  getMySpaceName,
  importBackup,
  listCookedDishes,
  listCravings,
  listDinnerProposals,
  listDishRatings,
  listEvents,
  listGroceryItems,
  listItems,
  listMemories,
  listTellYouLater,
  setMyProfile,
  NAME_TAKEN_MESSAGE,
  NO_SPACE_MESSAGE,
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
  CookedDish,
  Craving,
  DinnerProposal,
  DishRating,
  GroceryItem,
  Item,
  Memory,
  Person,
  Season,
  TellYouLater,
} from "@/lib/types";
import {
  useBackLayer,
  useBackNavigation,
  useEdgeSwipeBack,
} from "@/lib/back-nav";
import { CategorySection, ItemCard } from "./items";
import { CalendarSection, EventCard } from "./calendar";
import { CravingsSection } from "./cravings";
import { CookedSection } from "./cooked";
import { DinnerDecisionsSection } from "./dinner";
import { GrocerySection } from "./grocery";
import { IdentityPickerModal } from "./identity";
import { PushBanner } from "./push-banner";
import { ScrapbookSection } from "./scrapbook";
import SproutLoader from "./sprout-loader";
import { TellYouLaterSection } from "./tell-you-later";
import {
  EmptyNote,
  HOME_SECTION_LABELS,
  SectionHeader,
  sectionPanelStyle,
  useCollapsedSections,
  useHomeLayout,
  type HomeSectionId,
} from "./shared";

type View = "home" | "add" | "scrapbook";

/** The little control row shown above a section while the home page is
 * in Edit layout mode: up/down arrows to move it, and Hide to tuck it
 * away. Arrows only — no drag-and-drop, which is fiddly on a phone. */
function LayoutEditBar({
  id,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onHide,
}: {
  id: HomeSectionId;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHide: () => void;
}) {
  const label = HOME_SECTION_LABELS[id];
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm shadow-sm">
      <span className="font-semibold">{label}</span>
      <span className="flex-1" />
      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst}
        aria-label={`Move ${label} up`}
        className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-sm font-semibold disabled:opacity-40"
      >
        ↑ Up
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={isLast}
        aria-label={`Move ${label} down`}
        className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-sm font-semibold disabled:opacity-40"
      >
        ↓ Down
      </button>
      <button
        type="button"
        onClick={onHide}
        aria-label={`Hide ${label}`}
        className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-sm font-semibold"
      >
        Hide
      </button>
    </div>
  );
}

const SEEN_SEASON_KEY = "couples-app-season-seen";

export default function CouplesApp({ userEmail }: { userEmail: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [proposals, setProposals] = useState<DinnerProposal[]>([]);
  const [cravings, setCravings] = useState<Craving[]>([]);
  const [tellYouLater, setTellYouLater] = useState<TellYouLater[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [cookedDishes, setCookedDishes] = useState<CookedDish[]>([]);
  const [dishRatings, setDishRatings] = useState<DishRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("home");

  // Back navigation: the system back gesture and a swipe from the left
  // edge step back through the views and pop-outs instead of leaving
  // the app mid-task. The Add and scrapbook views are back layers;
  // home is the base, so back from home exits the app as usual.
  // See src/lib/back-nav.ts.
  useBackNavigation();
  useEdgeSwipeBack();
  const addNav = useBackLayer("view:add", view === "add", () =>
    setView("home"),
  );
  const scrapbookNav = useBackLayer(
    "view:scrapbook",
    view === "scrapbook",
    () => setView("home"),
  );

  // Identity: who is signed in. Read from the profiles table on session
  // load, so the dinner and cravings forms already know who's typing.
  // Null until the person has picked a name.
  const [me, setMe] = useState<Person | null>(null);
  // The space's display name for the header (e.g. "Andrew & Juliette").
  // Null until loaded, or when the account has no space yet.
  const [spaceName, setSpaceName] = useState<string | null>(null);
  // Whether the account belongs to a space yet. Null until the
  // identity load has run; false for a spaceless account, which
  // can't save a name and sees empty lists.
  const [hasSpace, setHasSpace] = useState<boolean | null>(null);
  const [identityModal, setIdentityModal] = useState<
    "first-run" | "edit-name" | null
  >(null);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState("");
  // The first-run picker is offered once per session; dismissing it
  // doesn't reopen it on every refresh, the forms show their own
  // compact chooser instead.
  const identityPromptedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [
        itemsData,
        eventsData,
        proposalsData,
        cravingsData,
        tellYouLaterData,
        memoriesData,
        groceryData,
        cookedData,
        ratingsData,
      ] = await Promise.all([
        listItems(supabase),
        listEvents(supabase),
        listDinnerProposals(supabase),
        listCravings(supabase),
        listTellYouLater(supabase),
        listMemories(supabase),
        listGroceryItems(supabase),
        listCookedDishes(supabase),
        listDishRatings(supabase),
      ]);
      setItems(itemsData);
      setEvents(eventsData);
      setProposals(proposalsData);
      setCravings(cravingsData);
      setTellYouLater(tellYouLaterData);
      setMemories(memoriesData);
      setGroceryItems(groceryData);
      setCookedDishes(cookedData);
      setDishRatings(ratingsData);
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
      // Whether the account belongs to a space yet. A spaceless
      // account can't save a name (migration 0007's WITH CHECK
      // rejects a null space_id), so the picker says so up front
      // instead of failing only on save.
      try {
        setHasSpace((await getMySpaceId(supabase)) !== null);
      } catch {
        setHasSpace(null);
      }
      // The space name is separate from the profile: it comes from the
      // spaces table, and a missing one just falls back to "Our book"
      // in the header.
      try {
        setSpaceName(await getMySpaceName(supabase));
      } catch {
        setSpaceName(null);
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
    } catch (err) {
      // The "name taken" message is written for the user, so show it
      // verbatim in the picker. A spaceless account can't save a name
      // at all — the profiles upsert fails migration 0007's WITH
      // CHECK, which null never satisfies — so say that plainly
      // instead of blaming migration 0003, which has run. Anything
      // else keeps the generic hint, since a raw database error is
      // no help here.
      if (err instanceof Error && err.message === NAME_TAKEN_MESSAGE) {
        setIdentityError(err.message);
      } else {
        let noSpace = false;
        try {
          noSpace = (await getMySpaceId(supabase)) === null;
        } catch {
          noSpace = false;
        }
        setIdentityError(
          noSpace
            ? NO_SPACE_MESSAGE
            : "That didn't save. If migration 0003 hasn't run in Supabase yet, run it first, then try again.",
        );
      }
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
  // Home-page layout: which sections are shown, and in what order.
  // Kept in localStorage per device, so each person arranges their own
  // home page. Hiding a section never deletes anything. The Add &
  // browse page reads the same order (see addSections below), but not
  // the visibility — a section hidden on the home page still shows
  // there, since hiding is a home display choice, not a removal.
  const layout = useHomeLayout();
  const [editingLayout, setEditingLayout] = useState(false);
  // Renders the edit controls above one section while Edit layout mode
  // is on: up/down arrows to move it, Hide to tuck it away.
  const editBar = (id: HomeSectionId) => {
    if (!editingLayout) return null;
    const at = layout.indexOf(id);
    return (
      <LayoutEditBar
        id={id}
        isFirst={at <= 0}
        isLast={at < 0 || at >= layout.order.length - 1}
        onMoveUp={() => layout.moveUp(id)}
        onMoveDown={() => layout.moveDown(id)}
        onHide={() => layout.hide(id)}
      />
    );
  };
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
  const upcomingEvents = events.filter(
    (e) => e.event_date >= today && e.is_done !== true,
  );
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
    downloadBackup(
      buildBackup(
        items,
        events,
        proposals,
        cravings,
        tellYouLater,
        memories,
        groceryItems,
        cookedDishes,
        dishRatings,
      ),
    );
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

  // Add & browse page: every addable section, in the same order as the
  // home page on this device (same layout hook, same localStorage).
  // Sections hidden on the home page still show here, after the
  // visible ones in default order — hiding is a home display choice,
  // and the user still needs to add to that collection. "Pick for
  // tonight" and the scrapbook have no add form, so they don't appear
  // here; photos live in the scrapbook view. Anything not in the
  // layout registry at all keeps its current relative order at the end
  // (Array.sort is stable), rather than disappearing.
  const addSections = (() => {
    const sections: { id: HomeSectionId; el: ReactNode }[] = [
      {
        id: "seasonal",
        el: (
          <CategorySection category="seasonal" items={items} refresh={load} />
        ),
      },
      {
        id: "coming-up",
        el: <CalendarSection events={events} refresh={load} />,
      },
      {
        id: "collection-longterm",
        el: (
          <CategorySection category="longterm" items={items} refresh={load} />
        ),
      },
      {
        id: "collection-date",
        el: <CategorySection category="date" items={items} refresh={load} />,
      },
      {
        id: "collection-places",
        el: (
          <CategorySection category="places" items={items} refresh={load} />
        ),
      },
      {
        id: "dinner-week",
        el: (
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
        ),
      },
      {
        id: "cravings",
        el: (
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
        ),
      },
      {
        id: "grocery-list",
        el: (
          <GrocerySection
            items={groceryItems}
            refresh={load}
            me={me}
            onPickIdentity={(person) => void saveIdentity(person)}
            onNeedIdentity={() => setIdentityModal("first-run")}
            identitySaving={identitySaving}
            identityError={identityError}
          />
        ),
      },
      {
        id: "tell-you-later",
        el: (
          <TellYouLaterSection
            entries={tellYouLater}
            compact
            refresh={load}
            me={me}
            onPickIdentity={(person) => void saveIdentity(person)}
            onNeedIdentity={() => setIdentityModal("first-run")}
            identitySaving={identitySaving}
            identityError={identityError}
          />
        ),
      },
      {
        id: "collection-dinner",
        el: (
          <CategorySection category="dinner" items={items} refresh={load} />
        ),
      },
      {
        id: "collection-recipe",
        el: (
          <CategorySection
            category="recipe"
            items={items}
            refresh={load}
            me={me}
          />
        ),
      },
      {
        id: "cooked-together",
        el: (
          <CookedSection
            dishes={cookedDishes}
            ratings={dishRatings}
            refresh={load}
            me={me}
            onPickIdentity={(person) => void saveIdentity(person)}
            onNeedIdentity={() => setIdentityModal("first-run")}
            identitySaving={identitySaving}
            identityError={identityError}
          />
        ),
      },
      {
        id: "collection-craft",
        el: <CategorySection category="craft" items={items} refresh={load} />,
      },
    ];
    const orderIndex = new Map(
      [...layout.order, ...layout.hidden].map((id, i) => [id, i] as const),
    );
    return [...sections]
      .sort(
        (a, b) =>
          (orderIndex.get(a.id) ?? Number.POSITIVE_INFINITY) -
          (orderIndex.get(b.id) ?? Number.POSITIVE_INFINITY),
      )
      .map((s) => <Fragment key={s.id}>{s.el}</Fragment>);
  })();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        {loading && <SproutLoader />}
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
                  {spaceName ?? "Our book"}
                </p>
                <div className="flex items-center gap-2">
                  {me && (
                    <button
                      type="button"
                      onClick={() => setIdentityModal("edit-name")}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--dim)]"
                      aria-label={`Change your name, currently ${me}`}
                    >
                      ✎ {me}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--dim)]"
                    aria-label={`Sign out of ${userEmail}`}
                  >
                    Sign out
                  </button>
                </div>
              </div>
              <h1 className="font-display mt-1 text-4xl font-semibold leading-tight">
                {season} together {SEASON_EMOJI[season]}
              </h1>
              <p className="mt-2 max-w-md text-base text-[var(--dim)]">
                This is your space — what&apos;s coming up, what you&apos;re
                dreaming of, and what&apos;s decided, all in one place.
                Tap “Add new things” when you want to add an idea or plan.
              </p>
              <button
                type="button"
                onClick={() => {
                  setView("add");
                  addNav.open();
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-base font-semibold text-white shadow-sm"
              >
                <span aria-hidden className="text-lg leading-none">
                  +
                </span>
                Add new things
              </button>
              <button
                type="button"
                onClick={() => setEditingLayout((v) => !v)}
                aria-pressed={editingLayout}
                className="ml-2 mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-base font-semibold shadow-sm"
              >
                {editingLayout ? "✓ Done" : "Edit layout"}
              </button>
              {editingLayout && (
                <button
                  type="button"
                  onClick={() => layout.reset()}
                  className="ml-2 mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-base font-semibold shadow-sm"
                >
                  Reset layout
                </button>
              )}
              {editingLayout && (
                <p className="mt-2 text-sm text-[var(--dim)]">
                  Use the arrows to move a section, Hide to tuck it away.
                  Hidden sections can be brought back from the bottom of the
                  page.
                </p>
              )}
            </header>

            {/* Push notifications: a one-time, dismissible offer to get
                a ping when someone else in your space posts something. */}
            <PushBanner me={me} />

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

            {/* Home sections, in the saved layout order. The wrapper is a
                flex column so each section can be moved with the `order`
                style; hiding one just leaves it out. In Edit layout mode
                the container gets a gap between sections and each panel's
                own top margin is flattened, so the edit bar sits tight
                against its own section instead of against the one above. */}
            {editingLayout && (
              <style>{`.layout-editing > div > section { margin-top: 0.25rem; }`}</style>
            )}
            <div
              className={
                editingLayout
                  ? "layout-editing flex flex-col gap-6"
                  : "flex flex-col"
              }
            >
            {layout.isVisible("coming-up") && (
              <div style={{ order: layout.indexOf("coming-up") }}>
                {editBar("coming-up")}
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
              </div>
            )}

            {/* Dinner decisions: suggest, accept, decline, or counter. */}
            {layout.isVisible("dinner-week") && (
              <div style={{ order: layout.indexOf("dinner-week") }}>
                {editBar("dinner-week")}
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
              </div>
            )}

            {/* Cravings: post a hankering, someone else can surprise you. */}
            {layout.isVisible("cravings") && (
              <div style={{ order: layout.indexOf("cravings") }}>
                {editBar("cravings")}
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
              </div>
            )}

            {/* Grocery list: what to pick up at the shop. */}
            {layout.isVisible("grocery-list") && (
              <div style={{ order: layout.indexOf("grocery-list") }}>
                {editBar("grocery-list")}
            <GrocerySection
              items={groceryItems}
              refresh={load}
              me={me}
              onPickIdentity={(person) => void saveIdentity(person)}
              onNeedIdentity={() => setIdentityModal("first-run")}
              identitySaving={identitySaving}
              identityError={identityError}
              {...collapseProps("grocery-list")}
            />
              </div>
            )}

            {/* Tell you later: something to tell everyone else, a thing to
                remember to do, or good news to celebrate later. */}
            {layout.isVisible("tell-you-later") && (
              <div style={{ order: layout.indexOf("tell-you-later") }}>
                {editBar("tell-you-later")}
            <TellYouLaterSection
              entries={tellYouLater}
              refresh={load}
              me={me}
              onPickIdentity={(person) => void saveIdentity(person)}
              onNeedIdentity={() => setIdentityModal("first-run")}
              identitySaving={identitySaving}
              identityError={identityError}
              {...collapseProps("tell-you-later")}
            />
              </div>
            )}

            {/* Seasonal bucket list: browse any season, current one first. */}
            {layout.isVisible("seasonal") && (
              <div style={{ order: layout.indexOf("seasonal") }}>
                {editBar("seasonal")}
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
                      ? `Every ${viewSeason} wish is checked off. Nice work, everyone.`
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
              </div>
            )}

            {/* Long-term bucket list, places, and idea collections —
                now on the home page too, browse-only. Adding new things
                still happens on the Add & browse page. */}
            {layout.isVisible("collection-longterm") && (
              <div style={{ order: layout.indexOf("collection-longterm") }}>
                {editBar("collection-longterm")}
            <CategorySection
              category="longterm"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-longterm")}
            />
              </div>
            )}
            {layout.isVisible("collection-places") && (
              <div style={{ order: layout.indexOf("collection-places") }}>
                {editBar("collection-places")}
            <CategorySection
              category="places"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-places")}
            />
              </div>
            )}
            {layout.isVisible("collection-date") && (
              <div style={{ order: layout.indexOf("collection-date") }}>
                {editBar("collection-date")}
            <CategorySection
              category="date"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-date")}
            />
              </div>
            )}
            {layout.isVisible("collection-dinner") && (
              <div style={{ order: layout.indexOf("collection-dinner") }}>
                {editBar("collection-dinner")}
            <CategorySection
              category="dinner"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-dinner")}
            />
              </div>
            )}
            {layout.isVisible("collection-recipe") && (
              <div style={{ order: layout.indexOf("collection-recipe") }}>
                {editBar("collection-recipe")}
            <CategorySection
              category="recipe"
              items={items}
              refresh={load}
              showAdd={false}
              me={me}
              {...collapseProps("collection-recipe")}
            />
              </div>
            )}
            {layout.isVisible("cooked-together") && (
              <div style={{ order: layout.indexOf("cooked-together") }}>
                {editBar("cooked-together")}
            <CookedSection
              dishes={cookedDishes}
              ratings={dishRatings}
              refresh={load}
              me={me}
              onPickIdentity={(person) => void saveIdentity(person)}
              onNeedIdentity={() => setIdentityModal("first-run")}
              identitySaving={identitySaving}
              identityError={identityError}
              {...collapseProps("cooked-together")}
            />
              </div>
            )}
            {layout.isVisible("collection-craft") && (
              <div style={{ order: layout.indexOf("collection-craft") }}>
                {editBar("collection-craft")}
            <CategorySection
              category="craft"
              items={items}
              refresh={load}
              showAdd={false}
              {...collapseProps("collection-craft")}
            />
              </div>
            )}

            {/* Pick for tonight */}
            {layout.isVisible("pick-tonight") && (
              <div style={{ order: layout.indexOf("pick-tonight") }}>
                {editBar("pick-tonight")}
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
              </div>
            )}

            {/* Scrapbook: a peek at the latest photos, and the way in. */}
            {layout.isVisible("scrapbook") && (
              <div style={{ order: layout.indexOf("scrapbook") }}>
                {editBar("scrapbook")}
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
                onClick={() => {
                  setView("scrapbook");
                  scrapbookNav.open();
                }}
                className="mt-3 rounded-full bg-[var(--berry)] px-4 py-2 text-sm font-semibold text-[var(--bg)]"
              >
                {memories.length > 0
                  ? "Open the scrapbook →"
                  : "Start the scrapbook →"}
              </button>
                </>
              )}
            </section>
              </div>
            )}
            </div>

            {/* Hidden sections: only appears when at least one section is
                tucked away. Each one gets its own Show button, so any
                single section comes back without resetting the layout. */}
            {layout.hidden.length > 0 && (
              <section
                aria-label="Hidden sections"
                className="mt-6 rounded-[1.4rem] border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
              >
                <h2 className="font-display text-xl font-semibold leading-tight">
                  Hidden sections
                </h2>
                <p className="mt-0.5 text-sm text-[var(--dim)]">
                  Tucked away for now. Show one to bring it back at the
                  bottom of your home page, then move it where you like.
                </p>
                <ul className="mt-3 space-y-2">
                  {layout.hidden.map((id) => (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm font-medium">
                        {HOME_SECTION_LABELS[id]}
                      </span>
                      <button
                        type="button"
                        onClick={() => layout.show(id)}
                        aria-label={`Show ${HOME_SECTION_LABELS[id]}`}
                        className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white"
                      >
                        Show
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

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
                  {importResult.cravings} cravings,{" "}
                  {importResult.tellYouLater} tell-you-later notes,{" "}
                  {importResult.groceryItems} grocery items,{" "}
                  {importResult.cookedDishes} cooked dishes,{" "}
                  {importResult.dishRatings} dish ratings, and{" "}
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
            {/* Add page: every collection, its add form, and suggestions,
                in the same order as the home page (see addSections). */}
            <header className="pt-6">
              <button
                type="button"
                onClick={() => addNav.closeViaUi()}
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

            {addSections}

            <p className="mt-10 text-center">
              <button
                type="button"
                onClick={() => addNav.closeViaUi()}
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
                onClick={() => scrapbookNav.closeViaUi()}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold"
              >
                ← Back to what&apos;s coming up
              </button>
            </header>
            <ScrapbookSection memories={memories} refresh={load} />
            <p className="mt-10 text-center">
              <button
                type="button"
                onClick={() => scrapbookNav.closeViaUi()}
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                ← Done — back to what&apos;s coming up
              </button>
            </p>
          </>
        )}

        {/* Who are you? — one-time picker the first time someone signs
            in, and the name-change form when opened from the header.
            The name is saved on their account; after that the
            dinner and cravings forms post as them silently. */}
        {identityModal && (
          <IdentityPickerModal
            saving={identitySaving}
            error={identityError}
            noSpace={hasSpace === false}
            initialName={
              identityModal === "edit-name" ? (me ?? "") : ""
            }
            onPick={(person) => void saveIdentity(person)}
            onDismiss={() => setIdentityModal(null)}
          />
        )}
      </main>
    </div>
  );
}
