import { base, el, buttonNode, uid } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function Dialog(options = {}) {
  const root = base("dialog", "nui-dialog"),
    heading = el("h3", "", options.title || "Dialog"),
    text = el("p", "nui-help", options.description || ""),
    actions = el("div", "nui-row"),
    stack = el("div", "nui-stack"),
    cancel = buttonNode(options.cancelLabel || "Đóng"),
    confirm = buttonNode(options.confirmLabel || "Xác nhận", "primary");
  heading.id = uid();
  root.setAttribute("aria-labelledby", heading.id);
  text.id = uid();
  root.setAttribute("aria-describedby", text.id);
  actions.append(cancel, confirm);
  stack.append(heading, text, actions);
  root.append(stack);
  const instance = life(root);
  let returnFocus;
  instance.open = () => {
    returnFocus = document.activeElement;
    root.showModal();
    cancel.focus();
  };
  instance.close = () => root.close();
  instance.on(cancel, "click", instance.close);
  instance.on(confirm, "click", () => {
    options.onConfirm?.();
    instance.close();
  });
  instance.on(root, "close", () => {
    if (returnFocus?.isConnected) returnFocus.focus();
    options.onClose?.();
  });
  instance.cleanup(() => {
    if (root.open) root.close();
  });
  return instance;
}
