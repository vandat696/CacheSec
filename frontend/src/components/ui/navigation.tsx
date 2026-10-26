"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";

export type TabItem = { id: string; label: string; content: ReactNode };

export function Tabs({
  label,
  items,
}: {
  label: string;
  items: readonly TabItem[];
}) {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const tablist = list.current;
    if (!tablist) return;
    let frame: number;
    const position = () => {
      const button = buttons.current[selected];
      if (!button || !indicator.current || !tablist.clientWidth) return;
      indicator.current.style.transform = `translateX(${button.offsetLeft}px) scaleX(${button.offsetWidth / tablist.clientWidth})`;
      frame = requestAnimationFrame(() =>
        tablist.classList.add("nui-tabs-positioned"),
      );
    };
    const observer = new ResizeObserver(position);
    observer.observe(tablist);
    buttons.current.forEach((button) => {
      if (button) observer.observe(button);
    });
    position();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [selected]);

  return (
    <div className="nui nui-theme">
      <div ref={list} className="nui-tablist" role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            className="nui-tab"
            role="tab"
            id={`${id}-tab-${item.id}`}
            aria-controls={`${id}-panel-${item.id}`}
            aria-selected={index === selected}
            tabIndex={index === selected ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              const targets: Record<string, number> = {
                ArrowRight: (selected + 1) % items.length,
                ArrowLeft: (selected - 1 + items.length) % items.length,
                Home: 0,
                End: items.length - 1,
              };
              const target = targets[event.key];
              if (target === undefined) return;
              event.preventDefault();
              setSelected(target);
              buttons.current[target]?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
        <span
          className="nui-tab-indicator"
          aria-hidden="true"
          ref={indicator}
        />
      </div>
      {items.map((item, index) => (
        <div
          key={item.id}
          className="nui-tabpanel"
          role="tabpanel"
          id={`${id}-panel-${item.id}`}
          aria-labelledby={`${id}-tab-${item.id}`}
          hidden={index !== selected}
          tabIndex={0}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}

export function Dropdown({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: readonly { value: string; label: string }[];
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
