"use client";
import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/feedback/ToastProvider";
import type { CatalogItem } from "../catalog";
export function ButtonPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Button";
    }
  >;
}) {
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = useToast();
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <Button onClick={() => showToast("Button: onClick được gọi")}>
        {item.options.label}
      </Button>
      {(["secondary", "tertiary", "danger"] as const).map((variant) => (
        <Button
          key={variant}
          variant={variant}
          onClick={() => showToast(`Button / ${variant}`)}
        >
          {variant}
        </Button>
      ))}
      <Button disabled>Disabled</Button>
      <Button
        variant="secondary"
        loading={loading}
        onClick={() => {
          setLoading(true);
          timer.current = setTimeout(() => setLoading(false), 900);
        }}
      >
        Thử loading
      </Button>
    </>
  );
}
