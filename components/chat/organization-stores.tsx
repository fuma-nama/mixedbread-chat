"use client";

import { cn } from "cn";
import {
  ArrowUpRightIcon,
  CheckIcon,
  LayersIcon,
  PlusIcon,
  RotateCwIcon,
} from "lucide-react";
import { useState } from "react";
import { Toasting } from "@/components/brand/bakery";
import { Spinner } from "@/components/ui/spinner";
import { PLATFORM_URL } from "@/lib/mixedbread/platform";
import {
  choiceFor,
  type Organization,
  type StoreChoice,
  type StoreOption,
} from "@/lib/sources";
import {
  type StoresState,
  useConnect,
  useSelection,
  useSources,
} from "./sources-provider";

export const row =
  "group/row flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] text-foreground/90 transition-colors duration-100 outline-none select-none scroll-my-1 hover:bg-soft hover:text-foreground focus-visible:bg-soft focus-visible:text-foreground disabled:cursor-default disabled:opacity-60 [&_svg]:shrink-0";

// One that ends up first, as while filtering, hides.
export const separator = "-mx-1 my-1 h-px bg-soft first:hidden";

/**
 * On Auto, Toast picks where to look; on Manual, the stores ticked are
 * searched, and none leaves the organization out. Ticking a store found by
 * the filter on Auto turns to Manual with just that one.
 */
export function OrganizationStores({
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

/** The stores searched once `id` is ticked or unticked. From Auto it is the only one. */
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

function matches(store: StoreOption, words: string[]): boolean {
  const text = `${store.name} ${store.description ?? ""}`.toLowerCase();
  return words.every((word) => text.includes(word));
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

// Toast finds the stores itself on Auto, so only Manual waits for the list.
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
        onClick={() => sources.reload(organization.id)}
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

export function ConnectButton({
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
  /** Loaded or unfolded after the panel opened, so it slides in. */
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
