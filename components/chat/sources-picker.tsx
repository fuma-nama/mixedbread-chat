"use client";

import { cn } from "cn";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  GlobeIcon,
  LayersIcon,
  PlusIcon,
  RotateCwIcon,
  SearchIcon,
  SearchSlashIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Toasting } from "@/components/brand/bakery";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useGlide } from "@/hooks/use-glide";
import { PLATFORM_URL } from "@/lib/mixedbread/platform";
import {
  choiceFor,
  type Organization,
  type SourceSelection,
  type StoreChoice,
  type StoreOption,
  searchesStores,
} from "@/lib/sources";
import {
  type StoresState,
  useAllStores,
  useConnect,
  useOrganizations,
  useSelection,
  useSources,
} from "./sources-provider";

/** From this many stores on, a field filters them. */
const FILTER_FROM = 8;

/** Where people create stores and upload files. */

/**
 * Picks what the next question searches: the web, and the stores of each
 * connected organization. Changes apply at once and the panel stays open,
 * so several can be flipped in a row.
 */
export function SourcesPicker() {
  const { web, docs, lapsed, label } = reachOf(
    useSelection(),
    useOrganizations(),
    useAllStores(),
  );
  const [query, setQuery] = useState("");
  const glide = useGlide<HTMLButtonElement>("width", 240);
  // The words come in on a change, not on arrival.
  const [shown, setShown] = useState({ label, changed: false });
  if (shown.label !== label) setShown({ label, changed: true });

  return (
    <Popover
      onOpenChange={(open, details) => {
        // Escape clears a filter before it closes the panel.
        if (!open && details.reason === "escape-key" && query) {
          details.cancel();
          setQuery("");
        }
        // Cleared on the way in, so the list doesn't jump while it fades out.
        if (open) setQuery("");
      }}
    >
      <PopoverTrigger
        ref={glide}
        aria-label={`Sources: ${label}`}
        // Its label gives way when space runs out; on phones only the glyphs
        // show, and they keep their room.
        className="relative min-w-0 cursor-pointer rounded-full text-[13px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 hover:bg-soft hover:text-foreground focus-visible:outline-2 aria-expanded:bg-soft aria-expanded:text-foreground max-sm:min-w-fit"
      >
        {/* The width glides so the pickers beside it don't jump, while what
            it holds takes its new place at once and is never squeezed. */}
        <span className="flex h-8 w-(--glide-to) items-center gap-1.5 pr-6.5 pl-2 max-sm:pr-2">
          <span
            aria-hidden="true"
            className={cn(
              "relative h-3.5 shrink-0",
              web && docs ? "w-7.5" : "w-3.5",
            )}
          >
            <GlobeIcon data-on={web} className={glyph} />
            {/* Beside the globe while the web is on, so it fades out in place. */}
            <span data-on={docs} className={cn(glyph, web && "translate-x-4")}>
              <LayersIcon className="size-3.5" />
              {/* An organization to sign in to again: a small mark, not an alarm. */}
              {lapsed && (
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-crust ring-2 ring-card motion-safe:animate-pop" />
              )}
            </span>
            <SearchSlashIcon data-on={!web && !docs} className={glyph} />
          </span>
          {/* Waits for the glyphs to move and the width to all but land, so
              the words never run into a glyph or past the edge. */}
          <span
            key={label}
            className={cn(
              "truncate max-sm:hidden",
              shown.changed &&
                "motion-safe:[animation:var(--animate-swap-in)_140ms_backwards]",
            )}
          >
            {label}
          </span>
        </span>
        {/* On the gliding edge rather than after the words, which may not
            fit yet. */}
        <ChevronDownIcon className="absolute inset-y-0 right-2 my-auto size-3.5 opacity-60 max-sm:hidden" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={8}
        aria-label="Sources"
        className="w-[min(21rem,calc(100vw-1.5rem))]"
      >
        <Panel query={query} onQuery={setQuery} />
      </PopoverContent>
    </Popover>
  );
}

const glyph =
  "absolute top-0 left-0 size-3.5 transition-[translate,scale,opacity] duration-300 ease-smooth motion-reduce:transition-none data-[on=false]:scale-50 data-[on=false]:opacity-0";

/**
 * What the selection reaches, as far as the stores loaded so far tell, and
 * whether a searched organization lost its grant.
 */
function reachOf(
  selection: SourceSelection,
  organizations: Organization[],
  all: Record<string, StoresState>,
) {
  const { web } = selection;
  let docs = false;
  let lapsed = false;
  // Whether Toast picks for one, organizations searched whole, and whether
  // one's stores are still loading.
  let auto = false;
  let whole = 0;
  let loading = false;
  // Stores in reach, and the name of the first one picked.
  let count = 0;
  let first: string | undefined;

  for (const { id } of organizations) {
    const choice = choiceFor(selection, id);
    if (!searchesStores(choice)) continue;
    docs = true;
    const state = all[id];
    const stores = state?.status === "ok" ? state.stores : undefined;
    lapsed ||= state?.status === "reconnect";
    if (choice === "auto") {
      auto = true;
      continue;
    }
    if (choice === "all") {
      whole++;
      count += stores?.length ?? 0;
      loading ||= !state || state.status === "loading";
      continue;
    }
    if (!stores) {
      count += choice.length;
      continue;
    }
    // Once the stores load, picks count only while their stores are there.
    const picked = new Set(choice);
    for (const store of stores) {
      if (!picked.has(store.id)) continue;
      count++;
      first ??= store.name;
    }
  }

  // Where Toast picks, how many it looks through is up to it.
  let phrase = `${count} ${count === 1 ? "store" : "stores"}`;
  if (auto) phrase = web ? "stores" : "Stores";
  else if (whole === organizations.length)
    phrase = web ? "all stores" : "All stores";
  else if (whole === 0 && count === 1 && first) phrase = first;
  else if (loading) phrase = web ? "stores" : "Stores";

  let label = web ? "Web" : "No search";
  if (docs) label = web ? `Web + ${phrase}` : phrase;
  return { web, docs, lapsed, label };
}

const row =
  "group/row flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] text-foreground/90 transition-colors duration-100 outline-none select-none scroll-my-1 hover:bg-soft hover:text-foreground focus-visible:bg-soft focus-visible:text-foreground disabled:cursor-default disabled:opacity-60 [&_svg]:shrink-0";

const heading = "px-2 pt-1.5 pb-1 text-xs text-muted-foreground";

// Between sections; one that ends up first, as while filtering, has none.
const separator = "-mx-1 my-1 h-px bg-soft first:hidden";

/**
 * The web, each organization's stores, a filter when there are many, and a
 * way to connect another. The panel is only as tall as what it holds and
 * glides when that changes, with the filter on the edge by the trigger,
 * which stays put. Arrow keys move between rows, and typing on one filters.
 */
function Panel({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (query: string) => void;
}) {
  const sources = useSources();
  const organizations = useOrganizations();
  const selection = useSelection();
  const all = useAllStores();
  const ref = useGlide<HTMLDivElement>("height", 240);
  const filterRef = useRef<HTMLInputElement>(null);
  const several = organizations.length > 1;
  let total = 0;
  for (const { id } of organizations) {
    const state = all[id];
    if (state?.status === "ok") total += state.stores.length;
  }
  const filterable = total >= FILTER_FROM;
  const text = query.trim();
  const words =
    filterable && text ? text.toLowerCase().split(/\s+/) : undefined;

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const filter = filterRef.current;
    // The filter comes first in the page and first or last on screen; either
    // way, cycling through these runs as the rows show.
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "input, [data-row]:not(:disabled)",
      ),
    );
    const index = items.indexOf(event.target as HTMLElement);
    if (index === -1) return;
    let to: HTMLElement | undefined;
    if (event.key === "ArrowDown") to = items[(index + 1) % items.length];
    else if (event.key === "ArrowUp") to = items.at(index - 1);
    else if (event.target === filter) {
      // Enter ticks the first match, so a store is a few keys away.
      if (event.key === "Enter" && words) {
        event.currentTarget.querySelector<HTMLElement>("[data-store]")?.click();
      }
      return;
    } else if (event.key === "Home") to = items[filter ? 1 : 0];
    else if (event.key === "End") to = items.at(-1);
    else if (
      filter &&
      event.key.length === 1 &&
      event.key !== " " &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      // Typing on a row moves to the filter, which takes the key as typed.
      filter.focus();
      return;
    } else return;
    event.preventDefault();
    to?.focus();
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- arrow keys for the rows inside
    <div
      ref={ref}
      onKeyDown={onKeyDown}
      className="flex max-h-[min(24rem,var(--available-height))] flex-col overflow-hidden"
    >
      {filterable && (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-soft px-3 in-data-[side=top]:order-last in-data-[side=top]:border-t in-data-[side=top]:border-b-0">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={filterRef}
            type="text"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Filter stores"
            aria-label="Filter stores"
            autoComplete="off"
            spellCheck={false}
            className="h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground/75 md:text-[13.5px]"
          />
        </div>
      )}
      <div className="min-h-0 flex-1 scroll-py-1 scroll-pt-9 scrollbar-thin overflow-y-auto overscroll-contain p-1">
        {!words && (
          <>
            <div className={heading}>Search in</div>
            <button
              type="button"
              role="switch"
              aria-checked={selection.web}
              data-row=""
              onClick={() =>
                sources.select({ ...selection, web: !selection.web })
              }
              className={row}
            >
              <GlobeIcon className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate">Web</span>
              <span
                aria-hidden="true"
                className="flex h-4 w-7 shrink-0 items-center rounded-full bg-input p-0.5 transition-colors duration-200 group-aria-checked/row:bg-primary motion-reduce:transition-none"
              >
                <span className="size-3 rounded-full bg-card shadow-raised transition-[translate] duration-200 ease-spring group-aria-checked/row:translate-x-3 motion-reduce:transition-none" />
              </span>
            </button>
          </>
        )}
        {organizations.map((organization) => (
          <OrganizationStores
            key={organization.id}
            organization={organization}
            state={all[organization.id]}
            named={several}
            words={words}
          />
        ))}
        {words ? (
          // Shows once no organization has a match.
          <p className="hidden px-3 py-2.5 text-center text-[13px] text-muted-foreground only:block">
            No stores match “{text}”
          </p>
        ) : (
          <>
            <div aria-hidden="true" className={separator} />
            <ConnectButton icon={<PlusIcon />}>
              Connect another organization
            </ConnectButton>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One organization's stores, on Auto, where Toast picks where to look for
 * each question, or Manual, where the stores ticked are searched: all of
 * them, stores made later included, or just some. Manual with none ticked
 * leaves the organization out. Ticking a store found by the filter on Auto
 * turns to Manual with just that one.
 */
function OrganizationStores({
  organization,
  state,
  named,
  words,
}: {
  organization: Organization;
  state: StoresState | undefined;
  /** Several organizations are connected, so each names itself. */
  named: boolean;
  /** While filtering, only stores with every word show, and nothing else. */
  words: string[] | undefined;
}) {
  const sources = useSources();
  const selection = useSelection();
  const choice = choiceFor(selection, organization.id);
  const auto = choice === "auto";
  // Rows ready as the panel opens are simply there; rows that load or unfold
  // later slide in, one after another.
  const [unfold, setUnfold] = useState(() => state?.status !== "ok" || auto);
  const stores = state?.status === "ok" ? state.stores : undefined;
  let shown = auto ? [] : (stores ?? []);
  if (words) {
    shown = [];
    for (const store of stores ?? []) {
      if (matches(store, words)) shown.push(store);
    }
    if (shown.length === 0) return null;
  }
  const picked = new Set(Array.isArray(choice) ? choice : []);
  // Its grant lapsed, or it has no stores: nothing to pick from.
  const searchable = state?.status !== "reconnect" && stores?.length !== 0;
  const name = named ? organization.name : "Stores";

  function choose(next: StoreChoice) {
    if (next === "auto") setUnfold(true);
    sources.select({
      ...selection,
      organizations: { ...selection.organizations, [organization.id]: next },
    });
  }

  return (
    <>
      <div aria-hidden="true" className={separator} />
      <div
        role="group"
        aria-label={name}
        aria-busy={!state || state.status === "loading" || undefined}
      >
        {!words && (named || searchable) && (
          <div className="sticky top-0 z-1 -mx-1 flex min-h-9 items-center gap-2.5 bg-popover px-3 py-1 text-[13.5px] text-foreground/90">
            <LayersIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {/* Choosable before its list loads. */}
            {searchable && (
              <Mode
                auto={auto}
                label={name}
                onChange={(next) => choose(next ? "auto" : [])}
              />
            )}
          </div>
        )}
        {!words && !auto && searchable && (
          <button
            type="button"
            role="checkbox"
            aria-checked={choice === "all"}
            data-row=""
            onClick={() => choose(choice === "all" ? [] : "all")}
            className={cn(row, unfold && "motion-safe:animate-swap-in")}
          >
            <Box />
            <span className="flex-1 truncate">All stores</span>
          </button>
        )}
        {shown.map((store, index) => (
          <button
            key={store.id}
            type="button"
            role="checkbox"
            aria-checked={choice === "all" || picked.has(store.id)}
            data-row=""
            data-store=""
            title={store.description ?? undefined}
            onClick={() => choose(toggle(choice, store.id, stores))}
            style={
              unfold
                ? {
                    animationDelay: `${Math.min(index + 1, 8) * 16}ms`,
                    animationFillMode: "backwards",
                  }
                : undefined
            }
            className={cn(row, unfold && "motion-safe:animate-swap-in")}
          >
            <Box />
            <span className="min-w-0 flex-1 truncate">{store.name}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 text-[11.5px] text-muted-foreground/80 tabular-nums">
              {storeStatus(store)}
            </span>
          </button>
        ))}
        {!words && (
          <StoresNotice
            organization={organization}
            state={state}
            manual={!auto}
          />
        )}
      </div>
    </>
  );
}

/**
 * The stores searched once `id` is ticked or unticked. From Auto it is the
 * only one; from all of them, every other one stays.
 */
function toggle(
  choice: StoreChoice,
  id: string,
  stores: StoreOption[] | undefined,
): string[] {
  if (choice === "auto") return [id];
  if (choice !== "all") {
    return choice.includes(id)
      ? choice.filter((picked) => picked !== id)
      : [...choice, id];
  }
  const rest: string[] = [];
  for (const store of stores ?? []) if (store.id !== id) rest.push(store.id);
  return rest;
}

const segment =
  "relative flex h-6 cursor-pointer items-center justify-center gap-1 rounded-full px-2.5 text-[12.5px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 hover:text-foreground focus-visible:outline-2 aria-checked:text-foreground";

/**
 * Auto or Manual, as a pill that glides to the one picked; the slice pops up
 * while Toast gets to pick. Arrow keys switch, as in any set of radios.
 */
function Mode({
  auto,
  label,
  onChange,
}: {
  auto: boolean;
  label: string;
  onChange: (auto: boolean) => void;
}) {
  const pick = (next: boolean) => next !== auto && onChange(next);

  return (
    // oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- its radios take focus
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const next = event.key === "ArrowLeft";
        pick(next);
        event.currentTarget.querySelectorAll("button")[next ? 0 : 1].focus();
      }}
      className="relative grid shrink-0 grid-cols-2 rounded-full bg-soft p-0.5"
    >
      <span
        aria-hidden="true"
        style={{ translate: auto ? "0 0" : "100% 0" }}
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-popover shadow-raised transition-[translate] duration-300 ease-smooth motion-reduce:transition-none"
      />
      <button
        type="button"
        role="radio"
        aria-checked={auto}
        tabIndex={auto ? 0 : -1}
        data-row={auto ? "" : undefined}
        onClick={() => pick(true)}
        className={segment}
      >
        <Toasting state={auto ? "done" : "stopped"} />
        Auto
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!auto}
        tabIndex={auto ? -1 : 0}
        data-row={auto ? undefined : ""}
        onClick={() => pick(false)}
        className={segment}
      >
        Manual
      </button>
    </div>
  );
}

function matches(store: StoreOption, words: string[]): boolean {
  const text = `${store.name} ${store.description ?? ""}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

/** What a store holds, or why it may not answer in full. */
function storeStatus(store: StoreOption): React.ReactNode {
  switch (store.status) {
    case "in_progress":
      return (
        <>
          <span className="size-1.5 rounded-full bg-crust motion-safe:animate-breathe" />
          Indexing
        </>
      );
    case "failed":
      return (
        <>
          <span className="size-1.5 rounded-full bg-destructive" />
          Failed
        </>
      );
    case "expired":
      return "Expired";
    default:
      return store.files === 0
        ? "No files"
        : `${store.files.toLocaleString()} ${store.files === 1 ? "file" : "files"}`;
  }
}

/**
 * Loading, failed, signed out, or empty: what stands in for the list. Toast
 * finds the stores itself on Auto, so only Manual waits for the list.
 */
function StoresNotice({
  organization,
  state,
  manual,
}: {
  organization: Organization;
  state: StoresState | undefined;
  manual: boolean;
}) {
  const sources = useSources();

  if (!state || state.status === "loading") {
    if (!manual) return null;
    return (
      <p
        role="status"
        className="flex h-8 items-center gap-2.5 px-2 text-[13px] text-muted-foreground"
      >
        <Spinner aria-hidden="true" />
        Loading stores…
      </p>
    );
  }
  if (state.status === "error") {
    if (!manual) return null;
    return (
      <button
        type="button"
        data-row=""
        onClick={() => sources.load(organization.id, true)}
        className={cn(row, "motion-safe:animate-swap-in")}
      >
        <RotateCwIcon className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{state.message}</span>
        <span className="text-xs text-muted-foreground">Retry</span>
      </button>
    );
  }
  if (state.status === "reconnect") {
    return (
      <ConnectButton
        icon={<RotateCwIcon />}
        hint="Access ended. Sign in again to search it."
      >
        Reconnect {organization.name}
      </ConnectButton>
    );
  }
  if (state.stores.length > 0) return null;
  return (
    <a
      href={PLATFORM_URL}
      target="_blank"
      rel="noreferrer"
      data-row=""
      className={cn(row, "items-start motion-safe:animate-swap-in")}
    >
      <PlusIcon className="mt-0.5 size-4 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        Create a store
        <span className="text-xs text-muted-foreground">
          No stores here yet. Add files on Mixedbread.
        </span>
      </span>
      <ArrowUpRightIcon className="mt-0.5 size-3.5 text-muted-foreground" />
    </a>
  );
}

/**
 * Leaves for Mixedbread, which asks which organization to connect, and
 * comes back here. It stays pending while the browser goes.
 */
function ConnectButton({
  icon,
  hint,
  children,
}: {
  icon: React.ReactNode;
  /** A line under the label, saying why. */
  hint?: string;
  children: React.ReactNode;
}) {
  const { pending, connect } = useConnect();

  return (
    <button
      type="button"
      data-row=""
      disabled={pending}
      onClick={connect}
      className={cn(
        row,
        "[&>svg]:size-4 [&>svg]:text-muted-foreground",
        hint && "items-start [&>svg]:mt-0.5",
      )}
    >
      {pending ? <Spinner aria-hidden="true" /> : icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          key={String(pending)}
          className={cn("truncate", pending && "motion-safe:animate-swap-in")}
        >
          {pending ? "Opening Mixedbread…" : children}
        </span>
        {hint && (
          <span className="text-xs text-pretty text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

/** A checkbox's box, checked with the row it is in. The tick springs in. */
function Box() {
  return (
    <span
      aria-hidden="true"
      className="grid size-3.5 shrink-0 place-items-center rounded-[4px] bg-card shadow-[inset_0_0_0_1.5px_var(--input)] transition-[background-color,box-shadow] duration-150 group-aria-checked/row:bg-primary group-aria-checked/row:shadow-none motion-reduce:transition-none"
    >
      <CheckIcon
        strokeWidth={3}
        className="size-2.5 scale-50 text-primary-foreground! opacity-0 transition-[scale,opacity] duration-200 ease-spring group-aria-checked/row:scale-100 group-aria-checked/row:opacity-100 motion-reduce:transition-none"
      />
    </span>
  );
}
