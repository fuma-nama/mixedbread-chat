"use client";

import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountMenu({
  user,
}: {
  user?: { name: string; email: string };
}) {
  if (!user) {
    return (
      <div className="flex gap-1.5">
        <Link
          href="/register"
          className={buttonVariants({ size: "sm", className: "flex-1" })}
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className={buttonVariants({
            size: "sm",
            variant: "ghost",
            className: "flex-1",
          })}
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 text-left outline-offset-0 outline-ring transition-colors duration-150 hover:bg-soft focus-visible:outline-2 aria-expanded:bg-soft">
        <Avatar name={user.name || user.email} />
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {user.email}
        </span>
        <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-(--anchor-width)"
      >
        <DropdownMenuItem
          onClick={async () => {
            // Loaded on demand: chat pages have no other use for the auth client.
            const { authClient } = await import("@/lib/auth-client");
            await authClient.signOut();
            window.location.href = "/";
          }}
        >
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-135 from-honey to-crust text-[12px] font-semibold text-white uppercase shadow-raised"
    >
      {name.charAt(0)}
    </span>
  );
}
