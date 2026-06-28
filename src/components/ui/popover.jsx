"use client"

import * as React from "react"
import * as radixUi from "radix-ui"
import { cn } from "src/lib/utils.js";

function Popover({
  ...props
}) {
  return <radixUi.Popover.Root data-slot="popover" {...props} />;
}
function PopoverTrigger({
  ...props
}) {
  return <radixUi.Popover.Trigger data-slot="popover-trigger" {...props} />;
}
function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}) {
  return (
    <radixUi.Popover.Portal>
      <radixUi.Popover.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-4 rounded-3xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props} />
    </radixUi.Popover.Portal>
  );
}
function PopoverAnchor({
  ...props
}) {
  return <radixUi.Popover.Anchor data-slot="popover-anchor" {...props} />;
}
function PopoverHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props} />
  );
}
function PopoverTitle({
  className,
  ...props
}) {
  return (
    <div
      data-slot="popover-title"
      className={cn("text-base font-medium", className)}
      {...props} />
  );
}
function PopoverDescription({
  className,
  ...props
}) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props} />
  );
}
export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
