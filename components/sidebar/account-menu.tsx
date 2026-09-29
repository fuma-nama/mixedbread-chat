"use client";

import { cn } from "cn";
import {
  ChevronsUpDownIcon,
  LogInIcon,
  LogOutIcon,
  PlusIcon,
  SunMoonIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  useConnect,
  useOrganizations,
} from "@/components/chat/sources-provider";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { withNext } from "@/lib/safe-next";
import type { Organization } from "@/lib/sources";
import { DisconnectDialog, OrganizationRow } from "./organizations";
import { ThemeSwitch } from "./theme-switch";

export interface User {
  name: string;
  email: string;
  /** The Mixedbread profile picture, when there is one. */
  image?: string | null;
}

/**
 * The person signed in with Mixedbread and the organizations they
 * connected; signed out, as on someone's shared chat, a way to sign in.
 */
export function AccountMenu({ user }: { user?: User }) {
  if (!user) return <SignedOut />;
  return <SignedIn user={user} />;
}

function SignedOut() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1.5">
      <Link
        // Back to this page once signed in, say the shared chat being read.
        href={withNext("/login", pathname)}
        className={buttonVariants({ size: "sm", className: "flex-1" })}
      >
        <LogInIcon />
        Sign in
      </Link>
      {/* Signed out there is no account menu, so the theme gets one of its own. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Theme"
          className={buttonVariants({
            variant: "ghost",
            size: "icon-sm",
            className: "shrink-0 text-muted-foreground",
          })}
        >
          <SunMoonIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end">
          <ThemeSwitch />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SignedIn({ user }: { user: User }) {
  const organizations = useOrganizations();
  const { pending, connect } = useConnect();
  // Held here, outside the menu, so the dialog outlives the menu closing.
  const [leaving, setLeaving] = useState<Organization>();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 text-left outline-offset-0 outline-ring transition-colors duration-150 hover:bg-soft focus-visible:outline-2 aria-expanded:bg-soft">
          <Avatar user={user} className="size-7 text-[12px]" />
          <span className="min-w-0 flex-1 truncate text-[13px]">
            {user.name || user.email}
          </span>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="w-(--anchor-width) min-w-60"
        >
          <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-2">
            <Avatar user={user} className="size-8 text-[13px]" />
            <div className="flex min-w-0 flex-col">
              {user.name && (
                <span className="truncate text-[13.5px] font-medium">
                  {user.name}
                </span>
              )}
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {organizations.length === 1 ? "Organization" : "Organizations"}
            </DropdownMenuLabel>
            {organizations.map((organization) => (
              <OrganizationRow
                key={organization.id}
                organization={organization}
                // The last one stays: it is how this account signs in.
                onDisconnect={
                  organizations.length > 1
                    ? () => setLeaving(organization)
                    : undefined
                }
              />
            ))}
            <DropdownMenuItem
              closeOnClick={false}
              disabled={pending}
              onClick={connect}
              className="text-xs text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center"
              >
                {pending ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <PlusIcon className="size-3.5" />
                )}
              </span>
              {pending ? "Opening Mixedbread…" : "Connect another organization"}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <ThemeSwitch />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              // Loaded on demand: chat pages have no other use for the auth client.
              const { authClient } = await import("@/lib/auth-client");
              await authClient.signOut();
              window.location.href = "/login";
            }}
          >
            <LogOutIcon />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DisconnectDialog
        organization={leaving}
        onClose={() => setLeaving(undefined)}
      />
    </>
  );
}

/**
 * The Mixedbread profile picture, or the name's first letter on warm crust
 * until the picture loads, and in its place if it never does.
 */
function Avatar({ user, className }: { user: User; className: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-135 from-honey to-crust font-semibold text-white uppercase shadow-raised",
        className,
      )}
    >
      {(user.name || user.email).charAt(0)}
      {user.image && !failed && (
        // oxlint-disable-next-line nextjs/no-img-element -- a remote avatar of unknown host gains nothing from next/image
        <img
          // A picture that failed before the page hydrated fires no error
          // React can hear, so its state is read on mount too.
          ref={(image) => {
            if (image?.complete && image.naturalWidth === 0) setFailed(true);
          }}
          src={user.image}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
