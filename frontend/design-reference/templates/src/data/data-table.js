import { base, el } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function DataTable(options = {}) {
  const root = base("div", "nui-table-wrap"),
    table = el("table", "nui-table"),
    head = el("thead"),
    body = el("tbody"),
    instance = life(root);
  root.tabIndex = 0;
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", options.caption || "Bảng dữ liệu");
  table.append(el("caption", "", options.caption || "Dữ liệu"), head, body);
  root.append(table);
  const columns = options.columns || [];
  const tr = el("tr");
  columns.forEach((c) => {
    const th = el("th", "", c.label);
    th.scope = "col";
    tr.append(th);
  });
  head.append(tr);
  instance.setData = (rows) => {
    body.replaceChildren();
    if (!rows?.length) {
      const row = el("tr"),
        td = el("td", "nui-empty", "Chưa có dữ liệu.");
      td.colSpan = Math.max(1, columns.length);
      row.append(td);
      body.append(row);
      return;
    }
    rows.forEach((item) => {
      const row = el("tr");
      columns.forEach((c, i) => {
        const cell = el(i === 0 ? "th" : "td", "", item[c.key] ?? "—");
        if (i === 0) cell.scope = "row";
        row.append(cell);
      });
      body.append(row);
    });
  };
  instance.setData(options.rows || []);
  return instance;
}
