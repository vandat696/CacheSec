"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

type Props = {
  label: string; controls: string; orientation: "vertical" | "horizontal";
  defaultSize: number; min: number; max: number; maxRatio: number; reservedSpace?: number;
  resizePane: "before" | "after"; onChange: (size: number) => void; hidden?: boolean;
};

export function PaneResizeHandle({ label, controls, orientation, defaultSize, min, max,
  maxRatio, reservedSpace = 0, resizePane, onChange, hidden }: Props) {
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; start: number; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [metrics, setMetrics] = useState({ value: defaultSize, max });
  const horizontal = orientation === "vertical";
  const direction = resizePane === "before" ? 1 : -1;

  function measure() {
    const pane = document.getElementById(controls);
    const parent = handle.current?.parentElement;
    if (!pane || !parent) return null;
    const available = parent.getBoundingClientRect()[horizontal ? "width" : "height"];
    return {
      value: pane.getBoundingClientRect()[horizontal ? "width" : "height"],
      max: Math.max(min, Math.min(max, available * maxRatio, available - reservedSpace)),
    };
  }

  useEffect(() => {
    const pane = document.getElementById(controls);
    const parent = handle.current?.parentElement;
    if (!pane || !parent) return;
    const observer = new ResizeObserver(() => {
      const available = parent.getBoundingClientRect()[horizontal ? "width" : "height"];
      const value = pane.getBoundingClientRect()[horizontal ? "width" : "height"];
      if (!value || !available) return;
      setMetrics({ value: Math.round(value), max: Math.floor(Math.max(min,
        Math.min(max, available * maxRatio, available - reservedSpace))) });
    });
    observer.observe(parent); observer.observe(pane);
    return () => observer.disconnect();
  }, [controls, horizontal, min, max, maxRatio, reservedSpace]);

  function resize(value: number) {
    const bounds = measure();
    if (bounds) onChange(Math.round(Math.max(min, Math.min(bounds.max, value))));
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <div ref={handle} role="separator" tabIndex={0} hidden={hidden}
    className={`pane-resize-handle pane-resize-${controls}`} aria-label={label}
    aria-controls={controls} aria-orientation={orientation} aria-valuemin={min}
    aria-valuemax={metrics.max} aria-valuenow={metrics.value} aria-valuetext={`${metrics.value} px`}
    title={`${label} · Nhấp đúp để đặt lại`} data-dragging={dragging}
    onDoubleClick={() => resize(defaultSize)}
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      const bounds = measure();
      if (!bounds) return;
      event.preventDefault(); event.currentTarget.focus();
      drag.current = { pointerId: event.pointerId, start: horizontal ? event.clientX : event.clientY, size: bounds.value };
      event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
    }}
    onPointerMove={event => {
      const current = drag.current;
      if (current?.pointerId === event.pointerId) resize(current.size + direction *
        ((horizontal ? event.clientX : event.clientY) - current.start));
    }}
    onPointerUp={finish} onPointerCancel={finish}
    onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
    onKeyDown={event => {
      const decrease = horizontal ? "ArrowLeft" : "ArrowUp";
      const increase = horizontal ? "ArrowRight" : "ArrowDown";
      const bounds = measure();
      if (!bounds || ![decrease, increase, "Home", "End", "Enter"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Home") resize(min);
      else if (event.key === "End") resize(bounds.max);
      else if (event.key === "Enter") resize(defaultSize);
      else resize(bounds.value + (event.key === increase ? 1 : -1) * direction * (event.shiftKey ? 40 : 10));
    }} />;
}
