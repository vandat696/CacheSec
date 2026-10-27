"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { chatModes, type ChatMode } from "./chat-state";

export function ChatSettings({
  mode,
  disabled,
  onChange,
}: {
  mode: ChatMode;
  disabled: boolean;
  onChange: (mode: ChatMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      className="chat-settings"
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        // Check after Tab's default focus movement. A pointer click on a radio
        // label may temporarily focus main before activating the radio input.
        requestAnimationFrame(() => {
          if (!root.current?.contains(document.activeElement)) setOpen(false);
        });
      }}
    >
      <Button
        ref={trigger}
        variant="tertiary"
        className="chat-settings-trigger"
        aria-label="Cài đặt chat"
        title={disabled ? "Chờ phản hồi để đổi chế độ" : "Cài đặt chat"}
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <Icon name="gear" />
      </Button>
      <fieldset
        id={id}
        className="chat-mode-options"
        hidden={!open}
        disabled={disabled}
      >
        <legend>Chế độ chat</legend>
        {chatModes.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={`${id}-mode`}
              value={option.value}
              checked={mode === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
        <p>Phản hồi mô phỏng · cache chưa hoạt động.</p>
      </fieldset>
    </div>
  );
}
