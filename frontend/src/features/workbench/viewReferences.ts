// These IDs are navigation hints only. Every restore is fetched and authorized by the backend.
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type View = "proposal" | "quotation";
const routes = { proposal: "/workspace", quotation: "/quotations" };
export const viewReferenceChanged = "cachesec-view-reference-changed";

export function readViewReference(view: View): string | null {
  const url = new URL(location.href), value = url.searchParams.get(view);
  return Object.values(routes).includes(url.pathname) && value && uuid.test(value) ? value : null;
}
export function writeViewReference(view: View, value: string | null) {
  const url = new URL(location.href);
  if (!Object.values(routes).includes(url.pathname) || (value !== null && !uuid.test(value))) return;
  if (value) url.searchParams.set(view, value); else url.searchParams.delete(view);
  if (url.href !== location.href) history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  window.dispatchEvent(new CustomEvent(viewReferenceChanged, { detail: { view, value } }));
}
