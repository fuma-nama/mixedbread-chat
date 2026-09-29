"use client";

import { ArrowUpRightIcon, RotateCwIcon, UnplugIcon } from "lucide-react";
import { useState } from "react";
import {
  useConnect,
  useSources,
  useStoresOf,
} from "@/components/chat/sources-provider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { PLATFORM_URL } from "@/lib/mixedbread/platform";
import type { Organization } from "@/lib/sources";

/**
 * An organization, opening a menu to manage it on Mixedbread, sign in to it
 * again when its grant lapsed, or disconnect it.
 */
export function OrganizationRow({
  organization,
  onDisconnect,
}: {
  organization: Organization;
  /** Left out for the last one. */
  onDisconnect?: () => void;
}) {
  const lapsed = useStoresOf(organization.id)?.status === "reconnect";
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

/** Confirms before an organization's stores leave every future search. */
export function DisconnectDialog({
  organization,
  onClose,
}: {
  organization?: Organization;
  onClose: () => void;
}) {
  const sources = useSources();
  // Kept while the dialog fades out, so its words don't vanish first.
  const [shown, setShown] = useState(organization);
  if (organization && organization !== shown) setShown(organization);

  async function disconnect(target: Organization) {
    onClose();
    try {
      await sources.disconnect(target.id);
      toast.add({ title: `${target.name} disconnected` });
    } catch {
      toast.add({ title: "Couldn’t disconnect. Try again." });
    }
  }

  return (
    <AlertDialog
      open={organization !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {shown?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its stores won’t be searched. You can connect it again anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => shown && void disconnect(shown)}
          >
            Disconnect
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
