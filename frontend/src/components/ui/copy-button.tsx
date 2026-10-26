"use client";

import { useRef } from "react";
import { Button } from "./button";
import { useToast } from "./feedback";
import { Icon } from "./icon";

export function CopyButton({
  text,
  label = "Sao chép",
}: {
  text: string;
  label?: string;
}) {
  const showToast = useToast();
  const fallback = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <Button
        variant="tertiary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            showToast("Đã sao chép nội dung");
          } catch {
            // A visible, selectable fallback also works when clipboard permission is denied.
            if (fallback.current) {
              fallback.current.hidden = false;
              fallback.current.focus();
              fallback.current.select();
            }
            showToast("Chọn nội dung rồi nhấn Ctrl+C hoặc giữ để sao chép.");
          }
        }}
      >
        <Icon name="copy" />
        {label}
      </Button>
      <textarea
        ref={fallback}
        className="nui-input copy-fallback"
        aria-label="Nội dung để sao chép thủ công"
        readOnly
        value={text}
        hidden
      />
    </>
  );
}
