export function life(element) {
  const controller = new AbortController();
  const clean = [];
  const api = {
    element,
    on(target, event, fn) {
      target.addEventListener(event, fn, { signal: controller.signal });
    },
    cleanup(fn) {
      clean.push(fn);
    },
    destroy() {
      clean.forEach((fn) => fn());
      controller.abort();
      element.remove();
    },
  };
  return api;
}
