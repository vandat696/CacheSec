import { base } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function Button(options = {}) {
  const b = base("button", "nui-button");
  b.type = options.type || "button";
  b.textContent = options.label || "Button";
  b.dataset.variant = options.variant || "primary";
  b.disabled = !!options.disabled;
  const instance = life(b);
  instance.on(b, "click", (e) => options.onClick?.(e, instance));
  instance.setLoading = (loading) => {
    b.disabled = loading || !!options.disabled;
    b.textContent = loading
      ? options.loadingLabel || "Đang xử lý…"
      : options.label || "Button";
    b.setAttribute("aria-busy", String(loading));
  };
  return instance;
}
