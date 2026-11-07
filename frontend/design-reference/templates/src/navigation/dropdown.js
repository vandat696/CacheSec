import { base, buttonNode, el, uid } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function Dropdown(options = {}) {
  const root = base("div", "nui-dropdown"),
    trigger = buttonNode(options.label || "Tùy chọn"),
    menu = el("div", "nui-menu"),
    instance = life(root);
  menu.hidden = true;
  menu.id = uid();
  menu.setAttribute("role", "menu");
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-controls", menu.id);
  trigger.setAttribute("aria-expanded", "false");
  root.append(trigger, menu);
  const buttons = [];
  instance.close = (focus = false) => {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (focus) trigger.focus();
  };
  instance.open = () => {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    buttons[0]?.focus();
  };
  (options.items || []).forEach((item) => {
    const b = buttonNode(item.label);
    b.className = "nui-menu-item";
    b.setAttribute("role", "menuitem");
    menu.append(b);
    buttons.push(b);
    instance.on(b, "click", () => {
      options.onSelect?.(item.value);
      instance.close(true);
    });
  });
  instance.on(trigger, "click", () =>
    menu.hidden ? instance.open() : instance.close(),
  );
  instance.on(root, "keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      instance.close(true);
    }
    if (e.key === "Tab") instance.close();
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (menu.hidden) {
        instance.open();
        return;
      }
      let i = buttons.indexOf(document.activeElement);
      i =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? buttons.length - 1
            : (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length;
      buttons[i]?.focus();
    }
  });
  instance.on(document, "pointerdown", (e) => {
    if (!root.contains(e.target)) instance.close();
  });
  instance.on(root, "focusout", (e) => {
    if (!root.contains(e.relatedTarget)) instance.close();
  });
  return instance;
}
