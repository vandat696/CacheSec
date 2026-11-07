"use client";
import { useId, useState, type ReactNode, useEffect, useRef } from "react";
export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};
export function Tabs({
  label,
  items,
  toolbar,
}: {
  label: string;
  items: readonly TabItem[];
  toolbar?: ReactNode;
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
      {toolbar}
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
