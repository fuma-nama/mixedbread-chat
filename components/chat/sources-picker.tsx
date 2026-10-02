"use client";

import { Popover } from "@base-ui/react/popover";
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
import { field, fieldInput, pill, popup } from "@/components/ui/popup";
import { Spinner } from "@/components/ui/spinner";
import { useGlide } from "@/hooks/use-glide";
import { PLATFORM_URL } from "@/lib/mixedbread/platform";
import {
  choiceFor,
  type Organization,
  type StoreChoice,
  type StoreOption,
  searchesStores,
} from "@/lib/sources";
import {
  reloadStores,
  select,
  storesOf,
  useAllStores,
  useConnect,
  useOrganizations,
  usePickedStores,
  useSelection,
} from "./picks";

const FILTER_FROM = 8;

const row =
  "group/row flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] text-foreground/90 transition-colors duration-100 outline-none select-none scroll-my-1 hover:bg-soft hover:text-foreground focus-visible:bg-soft focus-visible:text-foreground disabled:cursor-default disabled:opacity-60 [&_svg]:shrink-0";

// Hidden when first, as while filtering.
const separator = "-mx-1 my-1 h-px bg-soft first:hidden";

export function SourcesPicker() {
  const { web, docs, lapsed, label } = useReach();
  const [query, setQuery] = useState("");
  const glide = useGlide<HTMLButtonElement>("width", 240);
  // The words come in on a change, not on arrival.
  const [shown, setShown] = useState({ label, changed: false });
  if (shown.label !== label) setShown({ label, changed: true });

  return (
    <Popover.Root
      onOpenChange={(open, details) => {
        if (!open && details.reason === "escape-key" && query) {
          details.cancel();
          setQuery("");
        }
        // Cleared on the way in, so the list doesn't jump while it fades out.
        if (open) setQuery("");
      }}
    >
      <Popover.Trigger
        ref={glide}
        aria-label={`Sources: ${label}`}
        className={cn(pill, "relative min-w-0 max-sm:min-w-fit")}
      >
        {/* The width glides while what it holds takes its new place at once. */}
        <span className="flex h-8 w-(--glide-to) items-center gap-1.5 pr-6.5 pl-2 max-sm:pr-2">
          <span
            aria-hidden="true"
            className={cn(
              "relative h-3.5 shrink-0",
              web && docs ? "w-7.5" : "w-3.5",
            )}
          >
            <GlobeIcon data-on={web} className={glyph} />
            <span data-on={docs} className={cn(glyph, web && "translate-x-4")}>
              <LayersIcon className="size-3.5" />
              {lapsed && (
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-crust ring-2 ring-card motion-safe:animate-pop" />
              )}
            </span>
            <SearchSlashIcon data-on={!web && !docs} className={glyph} />
          </span>
          {/* Waits for the glyphs to move and the width to all but land. */}
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
        <ChevronDownIcon className="absolute inset-y-0 right-2 my-auto size-3.5 opacity-60 max-sm:hidden" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="isolate z-50 outline-none"
          align="start"
          side="top"
          sideOffset={8}
        >
          <Popover.Popup
            aria-label="Sources"
            className={cn(
              popup,
              "max-h-(--available-height) w-[min(21rem,calc(100vw-1.5rem))] max-w-(--available-width)",
            )}
          >
            <Panel query={query} onQuery={setQuery} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const glyph =
  "absolute top-0 left-0 size-3.5 transition-[translate,scale,opacity] duration-300 ease-smooth motion-reduce:transition-none data-[on=false]:scale-50 data-[on=false]:opacity-0";

function useReach() {
  const selection = useSelection();
  const organizations = useOrganizations();
  const all = useAllStores();
  const picked = usePickedStores();
  const { web } = selection;
  let docs = false;
  let lapsed = false;
  let auto = false;
  let whole = 0;
  let loading = false;
  // Once the stores load, picks count only while their stores are there.
  let count = picked.length;

  for (const { id } of organizations) {
    const choice = choiceFor(selection, id);
    if (!searchesStores(choice)) continue;
    docs = true;
    const state = storesOf(all, id);
    if (state.status === "reconnect") lapsed = true;
    if (choice === "auto") auto = true;
    else if (choice === "all") {
      whole++;
      if (state.status === "ok") count += state.stores.length;
      if (state.status === "loading") loading = true;
    } else if (state.status !== "ok") count += choice.length;
  }

  const first = picked[0]?.name;
  // Where Toast picks, how many it looks through is up to it.
  let phrase = `${count} ${count === 1 ? "store" : "stores"}`;
  if (whole === organizations.length)
    phrase = web ? "all stores" : "All stores";
  else if (auto || loading) phrase = web ? "stores" : "Stores";
  else if (whole === 0 && count === 1 && first) phrase = first;

  let label = web ? "Web" : "No search";
  if (docs) label = web ? `Web + ${phrase}` : phrase;
  return { web, docs, lapsed, label };
}

function Panel({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (query: string) => void;
}) {
  const organizations = useOrganizations();
  const selection = useSelection();
  const all = useAllStores();
  const ref = useGlide<HTMLDivElement>("height", 240);
  const filterRef = useRef<HTMLInputElement>(null);
  let total = 0;
  for (const { id } of organizations) {
    const state = storesOf(all, id);
    if (state.status === "ok") total += state.stores.length;
  }
  const filterable = total >= FILTER_FROM;
  const text = query.trim();
  const words =
    filterable && text ? text.toLowerCase().split(/\s+/) : undefined;

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const filter = filterRef.current;
    // The filter may show first or last; cycling in page order suits both.
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
      if (event.key === "Enter" && words)
        event.currentTarget.querySelector<HTMLElement>("[data-store]")?.click();
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
      // The filter takes the key as typed.
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
        <div className={field}>
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
            className={fieldInput}
          />
        </div>
      )}
      <div className="min-h-0 flex-1 scroll-py-1 scroll-pt-9 scrollbar-thin overflow-y-auto overscroll-contain p-1">
        {!words && (
          <>
            <div className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
              Search in
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={selection.web}
              data-row=""
              onClick={() => select({ ...selection, web: !selection.web })}
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

/** On Auto, Toast picks where to look; on Manual, ticking none leaves the organization out. */
function OrganizationStores({
  organization,
  words,
}: {
  organization: Organization;
  words: string[] | undefined;
}) {
  const state = storesOf(useAllStores(), organization.id);
  const named = useOrganizations().length > 1;
  const selection = useSelection();
  const choice = choiceFor(selection, organization.id);
  const auto = choice === "auto";
  const [unfold, setUnfold] = useState(() => state.status !== "ok" || auto);
  const stores = state.status === "ok" ? state.stores : undefined;
  let shown = auto ? [] : (stores ?? []);
  if (words) {
    shown = (stores ?? []).filter((store) => {
      const text = `${store.name} ${store.description ?? ""}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
    if (shown.length === 0) return null;
  }
  const picked = new Set(Array.isArray(choice) ? choice : []);
  const searchable = state.status !== "reconnect" && stores?.length !== 0;
  const name = named ? organization.name : "Stores";

  function choose(next: StoreChoice) {
    if (next === "auto") setUnfold(true);
    select({
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
        aria-busy={state.status === "loading" || undefined}
      >
        {!words && (named || searchable) && (
          <div className="sticky top-0 z-1 -mx-1 flex min-h-9 items-center gap-2.5 bg-popover px-3 py-1 text-[13.5px] text-foreground/90">
            <LayersIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{name}</span>
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
          <Check
            checked={choice === "all"}
            unfold={unfold}
            onClick={() => choose(choice === "all" ? [] : "all")}
          >
            <span className="flex-1 truncate">All stores</span>
          </Check>
        )}
        {shown.map((store, index) => (
          <Check
            key={store.id}
            checked={choice === "all" || picked.has(store.id)}
            unfold={unfold}
            delay={Math.min(index + 1, 8) * 16}
            data-store=""
            title={store.description ?? undefined}
            onClick={() => choose(toggle(choice, store.id, stores))}
          >
            <span className="min-w-0 flex-1 truncate">{store.name}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 text-[11.5px] text-muted-foreground/80 tabular-nums">
              {storeStatus(store)}
            </span>
          </Check>
        ))}
        {/* Toast finds the stores itself on Auto, so only Manual waits for the list. */}
        {!auto && state.status === "loading" && (
          <p
            role="status"
            className="flex h-8 items-center gap-2.5 px-2 text-[13px] text-muted-foreground"
          >
            <Spinner aria-hidden="true" />
            Loading stores…
          </p>
        )}
        {!auto && state.status === "error" && (
          <button
            type="button"
            data-row=""
            onClick={() => reloadStores(organization.id)}
            className={cn(row, "motion-safe:animate-swap-in")}
          >
            <RotateCwIcon className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              Couldn’t load the stores.
            </span>
            <span className="text-xs text-muted-foreground">Retry</span>
          </button>
        )}
        {state.status === "reconnect" && (
          <ConnectButton
            icon={<RotateCwIcon />}
            hint="Access ended. Sign in again to search it."
          >
            Reconnect {organization.name}
          </ConnectButton>
        )}
        {stores?.length === 0 && (
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
        )}
      </div>
    </>
  );
}

function toggle(
  choice: StoreChoice,
  id: string,
  stores: StoreOption[] | undefined,
): string[] {
  if (choice === "auto") return [id];
  const ids =
    choice === "all" ? (stores ?? []).map((store) => store.id) : choice;
  return ids.includes(id)
    ? ids.filter((picked) => picked !== id)
    : [...ids, id];
}

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
      {[true, false].map((option) => (
        <button
          key={String(option)}
          type="button"
          role="radio"
          aria-checked={option === auto}
          tabIndex={option === auto ? 0 : -1}
          data-row={option === auto ? "" : undefined}
          onClick={() => pick(option)}
          className="relative flex h-6 cursor-pointer items-center justify-center gap-1 rounded-full px-2.5 text-[12.5px] text-muted-foreground outline-offset-0 outline-ring transition-colors duration-150 hover:text-foreground focus-visible:outline-2 aria-checked:text-foreground"
        >
          {option && <Toasting state={auto ? "done" : "stopped"} />}
          {option ? "Auto" : "Manual"}
        </button>
      ))}
    </div>
  );
}

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

function ConnectButton({
  icon,
  hint,
  children,
}: {
  icon: React.ReactNode;
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

function Check({
  checked,
  unfold,
  delay = 0,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  checked: boolean;
  /** Arrived after the panel opened, so it slides in. */
  unfold: boolean;
  delay?: number;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-row=""
      style={
        unfold
          ? { animationDelay: `${delay}ms`, animationFillMode: "backwards" }
          : undefined
      }
      className={cn(row, unfold && "motion-safe:animate-swap-in")}
      {...props}
    >
      <span
        aria-hidden="true"
        className="grid size-3.5 shrink-0 place-items-center rounded-[4px] bg-card shadow-[inset_0_0_0_1.5px_var(--input)] transition-[background-color,box-shadow] duration-150 group-aria-checked/row:bg-primary group-aria-checked/row:shadow-none motion-reduce:transition-none"
      >
        <CheckIcon
          strokeWidth={3}
          className="size-2.5 scale-50 text-primary-foreground! opacity-0 transition-[scale,opacity] duration-200 ease-spring group-aria-checked/row:scale-100 group-aria-checked/row:opacity-100 motion-reduce:transition-none"
        />
      </span>
      {children}
    </button>
  );
}
