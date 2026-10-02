"use client";

import { Menu } from "@base-ui/react/menu";
import { cn } from "cn";
import {
  ArrowUpRightIcon,
  ChevronsUpDownIcon,
  LogInIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  RotateCwIcon,
  SunIcon,
  SunMoonIcon,
  UnplugIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  disconnect,
  storesOf,
  useAllStores,
  useConnect,
  useOrganizations,
} from "@/components/chat/picks";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  createAlertDialogHandle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { setTheme, useTheme } from "@/hooks/use-theme";
import { PLATFORM_URL } from "@/lib/mixedbread/platform";
import { withNext } from "@/lib/safe-next";
import type { Organization } from "@/lib/sources";
import { type Theme, themes } from "@/lib/theme";

// Outside the menu, so the dialog outlives the menu closing.
const disconnectDialog = createAlertDialogHandle<Organization>();

export interface User {
  name: string;
  email: string;
  image?: string | null;
}

export function SignedOut() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1.5">
      <Link
        href={withNext("/login", pathname)}
        className={buttonVariants({ size: "sm", className: "flex-1" })}
      >
        <LogInIcon />
        Sign in
      </Link>
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

export function AccountMenu({ user }: { user: User }) {
  const organizations = useOrganizations();
  const { pending, connect } = useConnect();

  async function leave(organization: Organization) {
    disconnectDialog.close();
    try {
      await disconnect(organization.id);
      toast.add({ title: `${organization.name} disconnected` });
    } catch {
      toast.add({ title: "Couldn’t disconnect. Try again." });
    }
  }

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
                    ? () => disconnectDialog.openWithPayload(organization)
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
          <DropdownMenuItem onClick={logOut}>
            <LogOutIcon />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog handle={disconnectDialog}>
        {({ payload: organization }) => (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Disconnect {organization?.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Its stores won’t be searched. You can connect it again anytime.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => organization && void leave(organization)}
              >
                Disconnect
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}

async function logOut() {
  // Chat pages have no other use for the auth client.
  const { authClient } = await import("@/lib/auth-client");
  await authClient.signOut();
  window.location.href = "/login";
}

function OrganizationRow({
  organization,
  onDisconnect,
}: {
  organization: Organization;
  onDisconnect?: () => void;
}) {
  const lapsed =
    storesOf(useAllStores(), organization.id).status === "reconnect";
  const { pending, connect } = useConnect();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-soft text-[11px] font-medium text-foreground/70 uppercase"
        >
          {organization.name.charAt(0)}
        </span>
        <span className="min-w-0 flex-1 truncate">{organization.name}</span>
        {lapsed && (
          <span className="size-1.5 shrink-0 rounded-full bg-crust">
            <span className="sr-only">Signed out</span>
          </span>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        <DropdownMenuLinkItem
          href={PLATFORM_URL}
          target="_blank"
          rel="noreferrer"
          closeOnClick
        >
          <ArrowUpRightIcon />
          Manage on Mixedbread
        </DropdownMenuLinkItem>
        {lapsed && (
          <DropdownMenuItem
            closeOnClick={false}
            disabled={pending}
            onClick={connect}
          >
            {pending ? <Spinner aria-hidden="true" /> : <RotateCwIcon />}
            {pending ? "Opening Mixedbread…" : "Sign in again"}
          </DropdownMenuItem>
        )}
        {onDisconnect && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDisconnect}>
              <UnplugIcon />
              Disconnect
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

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
          // A picture that failed before hydration fires no error React hears.
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

const icons = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

// Where each icon turns in from.
const turns = { system: "0deg", light: "-90deg", dark: "40deg" };

function ThemeSwitch() {
  const theme = useTheme();
  // Icons turn only when picked here, not each time the menu opens.
  const [picked, setPicked] = useState(false);
  const index = themes.findIndex((entry) => entry.id === theme);

  return (
    <DropdownMenuRadioGroup
      value={theme}
      onValueChange={(value: Theme) => {
        setPicked(true);
        setTheme(value);
      }}
      className="flex items-center justify-between gap-3 py-1 pr-1 pl-2"
    >
      <DropdownMenuLabel className="p-0 text-[13.5px] text-foreground/90">
        Theme
      </DropdownMenuLabel>
      <div className="relative flex rounded-full bg-soft p-0.5">
        <span
          aria-hidden="true"
          style={{ translate: `${index * 100}% 0` }}
          className="absolute top-0.5 left-0.5 size-7 rounded-full bg-popover shadow-raised transition-[translate] duration-300 ease-smooth motion-reduce:transition-none"
        />
        {themes.map(({ id, name }) => {
          const Icon = icons[id];
          return (
            <Menu.RadioItem
              key={id}
              value={id}
              aria-label={name}
              style={{ "--turn": turns[id] } as React.CSSProperties}
              className="group/theme relative flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 outline-none data-checked:text-foreground data-highlighted:text-foreground data-highlighted:not-data-checked:bg-soft"
            >
              <Icon
                className={cn(
                  "size-3.5",
                  picked &&
                    "group-data-checked/theme:motion-safe:animate-theme-turn",
                )}
              />
            </Menu.RadioItem>
          );
        })}
      </div>
    </DropdownMenuRadioGroup>
  );
}
