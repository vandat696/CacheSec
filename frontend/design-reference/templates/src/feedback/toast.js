import { base, el, buttonNode } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function Toast(options = {}) {
  const root = base("div", "nui-toast-area"),
    instance = life(root);
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  let timer;
  instance.show = (message) => {
    clearTimeout(timer);
    root.replaceChildren();
    const box = el("div", "nui-toast"),
      close = buttonNode("Đóng");
    box.append(el("span", "", message || options.message || "Đã lưu"), close);
    root.append(box);
    instance.on(close, "click", () => root.replaceChildren());
    timer = setTimeout(() => root.replaceChildren(), options.duration ?? 4000);
  };
  instance.cleanup(() => clearTimeout(timer));
  return instance;
}
