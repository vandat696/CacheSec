import { base, el, buttonNode, uid } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function Tabs(options = {}) {
  const root = base(),
    list = el("div", "nui-tablist"),
    panels = el("div"),
    instance = life(root),
    buttons = [];
  const indicator = el("span", "nui-tab-indicator");
  indicator.setAttribute("aria-hidden", "true");
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", options.label || "Tabs");
  const items = options.items || [];
  let selected = 0,
    frame = 0,
    positioned = false;
  root.append(list, panels);
  function positionIndicator() {
    const button = buttons[selected];
    if (!button || !list.clientWidth || !button.offsetWidth) return;
    const listRect = list.getBoundingClientRect(),
      buttonRect = button.getBoundingClientRect();
    const scale = listRect.width / list.offsetWidth || 1;
    const x =
      (buttonRect.left - listRect.left) / scale -
      list.clientLeft +
      list.scrollLeft;
    const width = buttonRect.width / scale;
    indicator.style.transform = `translate3d(${x}px,0,0) scaleX(${width / list.clientWidth})`;
    if (!positioned) {
      positioned = true;
      frame = requestAnimationFrame(() =>
        list.classList.add("nui-tabs-positioned"),
      );
    }
  }
  instance.select = (index) => {
    if (!buttons[index]) return;
    selected = index;
    buttons.forEach((button, i) => {
      button.setAttribute("aria-selected", String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      panels.children[i].hidden = i !== index;
    });
    positionIndicator();
    options.onChange?.(items[index].id ?? index);
  };
  items.forEach((item, i) => {
    const button = buttonNode(item.label);
    button.className = "nui-tab";
    button.id = uid();
    button.setAttribute("role", "tab");
    const panel = el("div", "nui-tabpanel", item.content || "");
    panel.id = uid();
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", button.id);
    panel.tabIndex = 0;
    button.setAttribute("aria-controls", panel.id);
    list.append(button);
    panels.append(panel);
    buttons.push(button);
    instance.on(button, "click", () => instance.select(i));
    instance.on(button, "keydown", (event) => {
      let target;
      if (event.key === "ArrowRight") target = (selected + 1) % items.length;
      if (event.key === "ArrowLeft")
        target = (selected - 1 + items.length) % items.length;
      if (event.key === "Home") target = 0;
      if (event.key === "End") target = items.length - 1;
      if (target !== undefined) {
        event.preventDefault();
        instance.select(target);
        buttons[target].focus();
      }
    });
  });
  list.append(indicator);
  instance.select(options.selectedIndex || 0);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(positionIndicator);
    observer.observe(list);
    buttons.forEach((button) => observer.observe(button));
    instance.cleanup(() => observer.disconnect());
  } else {
    instance.on(window, "resize", positionIndicator);
  }
  frame = requestAnimationFrame(positionIndicator);
  instance.cleanup(() => cancelAnimationFrame(frame));
  return instance;
}
