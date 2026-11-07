"use client";
import { useId, useState, useEffect, useRef } from "react";
import { Button } from "../Button";
export function Dropdown({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: readonly {
    value: string;
    label: string;
  }[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    buttons.current[0]?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      ref={root}
      className="nui nui-theme nui-dropdown"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
        if (event.key === "Tab") setOpen(false);
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        const current = buttons.current.findIndex(
          (button) => button === document.activeElement,
        );
        const target =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (current +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  items.length) %
                items.length;
        buttons.current[target]?.focus();
      }}
    >
      <Button
        ref={trigger}
        variant="secondary"
        aria-haspopup="menu"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
      </Button>
      <div className="nui-menu" role="menu" id={id} hidden={!open}>
        {items.map((item, index) => (
          <button
            key={item.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            className="nui-menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              onSelect(item.value);
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
