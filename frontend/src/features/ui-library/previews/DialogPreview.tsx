"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/feedback/Dialog";
import { useToast } from "@/components/ui/feedback/ToastProvider";
import type { CatalogItem } from "../catalog";
export function DialogPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Dialog";
    }
  >;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const showToast = useToast();
  return (
    <>
      <Button variant="secondary" onClick={() => setDialogOpen(true)}>
        Mở Dialog
      </Button>
      <Dialog
        open={dialogOpen}
        title={item.options.title}
        confirmLabel={item.options.confirmLabel}
        onClose={() => setDialogOpen(false)}
        onConfirm={() => showToast("Dialog: onConfirm được gọi")}
      >
        {item.options.description}
      </Dialog>
    </>
  );
}
