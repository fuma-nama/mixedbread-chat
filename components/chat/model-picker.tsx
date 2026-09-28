"use client";

import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isModelId, type ModelId, models } from "@/lib/models";

export function ModelPicker({
  value,
  onChange,
}: {
  value: ModelId;
  onChange: (model: ModelId) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="font-medium text-base" />}
      >
        {models.find((model) => model.id === value)?.name}
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(id) => {
            if (!isModelId(id)) return;
            // Read by the server to preselect the model on the next visit.
            void cookieStore.set({
              name: "model",
              value: id,
              expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
            });
            onChange(id);
          }}
        >
          {models.map((model) => (
            <DropdownMenuRadioItem key={model.id} value={model.id}>
              {model.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
