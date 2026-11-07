import { base, el, uid, fmt } from "../core/dom.js";
import { life } from "../core/lifecycle.js";
import { svgNode } from "../core/svg.js";
import { DataTable } from "../data/data-table.js";

export function Chart(kind, options = {}) {
  const root = base("figure", "nui-chart-shell"),
    instance = life(root);
  root.style.margin = "0";
  let tableApi;
  const colors = [
    "var(--nui-primary)",
    "var(--nui-muted)",
    "var(--nui-danger)",
    "var(--nui-success)",
  ];
  instance.setData = (rows) => {
    tableApi?.destroy();
    root.replaceChildren(el("figcaption", "nui-label", options.title || kind));
    const clean = (rows || [])
      .filter((r) => Number.isFinite(Number(r.value)) && Number(r.value) >= 0)
      .map((r) => ({ label: String(r.label ?? ""), value: Number(r.value) }));
    if (
      !clean.length ||
      (kind === "DonutChart" && clean.every((r) => r.value === 0))
    ) {
      root.append(el("p", "nui-empty", "Chưa có dữ liệu để vẽ biểu đồ."));
      return;
    }
    const svg = svgNode("svg", {
        class: "nui-chart",
        viewBox: kind === "DonutChart" ? "0 0 280 240" : "0 0 640 280",
        role: "img",
      }),
      title = svgNode("title", {}, options.title || kind),
      desc = svgNode(
        "desc",
        {},
        "Số liệu đầy đủ có trong bảng dữ liệu phía dưới.",
      );
    title.id = uid();
    desc.id = uid();
    svg.setAttribute("aria-labelledby", title.id + " " + desc.id);
    svg.append(title, desc);
    if (kind === "DonutChart") {
      svg.setAttribute("viewBox", "0 0 480 300");
      const total = clean.reduce((sum, row) => sum + row.value, 0),
        point = (radius, theta) => [
          240 + radius * Math.cos(theta),
          150 + radius * Math.sin(theta),
        ],
        bounds = [],
        outside = [],
        legend = el("ul", "nui-chart-legend");
      const percent = (value) =>
        new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
          value * 100,
        ) + "%";
      let angle = -Math.PI / 2;
      clean.forEach((row, i) => {
        const color = colors[i % colors.length],
          share = row.value / total,
          end = angle + share * Math.PI * 2,
          mid = (angle + end) / 2;
        if (share > 0) {
          if (share >= 1) {
            svg.append(
              svgNode("circle", {
                cx: 240,
                cy: 150,
                r: 87,
                fill: "none",
                stroke: color,
                "stroke-width": 46,
                "stroke-linecap": "butt",
              }),
            );
          } else {
            const large = share > 0.5 ? 1 : 0,
              d = `M ${point(110, angle)} A 110 110 0 ${large} 1 ${point(110, end)} L ${point(64, end)} A 64 64 0 ${large} 0 ${point(64, angle)} Z`;
            const sector = svgNode("path", { d, fill: color, stroke: "none" });
            sector.append(
              svgNode(
                "title",
                {},
                `${row.label}: ${fmt.format(row.value)} (${percent(share)})`,
              ),
            );
            svg.append(sector);
            bounds.push(angle);
          }
          if (share >= 0.12) {
            const p = point(87, mid);
            svg.append(
              svgNode(
                "text",
                {
                  x: p[0],
                  y: p[1] + 5,
                  "text-anchor": "middle",
                  class: "nui-slice-number",
                },
                percent(share),
              ),
            );
          } else
            outside.push({
              row,
              share,
              mid,
              side: Math.cos(mid) >= 0 ? 1 : -1,
            });
        }
        const item = el("li"),
          key = el("span", "nui-key");
        key.style.background = color;
        item.append(
          key,
          document.createTextNode(
            `${row.label}: ${fmt.format(row.value)} · ${percent(share)}`,
          ),
        );
        legend.append(item);
        angle = end;
      });
      bounds.forEach((theta) => {
        const p = point(64, theta),
          q = point(110, theta);
        svg.append(
          svgNode("line", {
            x1: p[0],
            y1: p[1],
            x2: q[0],
            y2: q[1],
            stroke: "var(--nui-surface)",
            "stroke-width": 2,
            "stroke-linecap": "butt",
          }),
        );
      });
      [-1, 1].forEach((side) => {
        const labels = outside
          .filter((label) => label.side === side)
          .sort((instance, b) => Math.sin(instance.mid) - Math.sin(b.mid));
        labels.forEach((label, index) => {
          const p = point(111, label.mid),
            q = point(124, label.mid),
            y =
              labels.length === 1
                ? Math.max(40, Math.min(260, q[1]))
                : 40 + (index * 220) / (labels.length - 1),
            lineX = side === 1 ? 376 : 104,
            textX = side === 1 ? 384 : 96,
            anchor = side === 1 ? "start" : "end";
          svg.append(
            svgNode("polyline", {
              points: `${p} ${q} ${lineX},${y}`,
              fill: "none",
              stroke: "var(--nui-muted)",
              "stroke-width": 1.5,
              "stroke-linecap": "butt",
            }),
            svgNode(
              "text",
              {
                x: textX,
                y: y - 4,
                "text-anchor": anchor,
                class: "nui-callout-value",
              },
              fmt.format(label.row.value),
            ),
            svgNode(
              "text",
              {
                x: textX,
                y: y + 16,
                "text-anchor": anchor,
                class: "nui-callout-percent",
              },
              percent(label.share),
            ),
          );
        });
      });
      svg.append(
        svgNode(
          "text",
          {
            x: 240,
            y: 149,
            "text-anchor": "middle",
            class: "nui-center-number",
          },
          fmt.format(total),
        ),
        svgNode(
          "text",
          { x: 240, y: 174, "text-anchor": "middle" },
          options.unit || "Tổng",
        ),
      );
      root.append(svg, legend);
    } else {
      const max = Math.max(...clean.map((r) => r.value), 1),
        step = Math.pow(10, Math.floor(Math.log10(max))),
        ceiling = Math.ceil(max / step) * step,
        left = 80,
        right = 616,
        top = 24,
        bottom = 216;
      for (let i = 0; i <= 4; i++) {
        const y = bottom - (i * (bottom - top)) / 4;
        svg.append(
          svgNode("line", {
            x1: left,
            y1: y,
            x2: right,
            y2: y,
            class: "nui-gridline",
          }),
          svgNode(
            "text",
            { x: left - 12, y: y + 5, "text-anchor": "end" },
            new Intl.NumberFormat("vi-VN", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format((ceiling * i) / 4),
          ),
        );
      }
      const slot = (right - left) / clean.length,
        points = clean.map((r, i) => [
          kind === "BarChart"
            ? left + slot * (i + 0.5)
            : clean.length === 1
              ? (left + right) / 2
              : left + (i * (right - left)) / (clean.length - 1),
          bottom - (r.value / ceiling) * (bottom - top),
        ]);
      if (kind === "LineChart")
        svg.append(
          svgNode("polyline", {
            points: points.map((p) => p.join(",")).join(" "),
            class: "nui-data-line",
          }),
        );
      clean.forEach((r, i) => {
        const [x, y] = points[i],
          shape =
            kind === "LineChart"
              ? svgNode("circle", {
                  cx: x,
                  cy: y,
                  r: 4,
                  class: "nui-chart-point",
                })
              : svgNode("rect", {
                  x: x - slot * 0.3,
                  y,
                  width: slot * 0.6,
                  height: bottom - y,
                  class: "nui-data-bar",
                });
        shape.append(svgNode("title", {}, `${r.label}: ${r.value}`));
        svg.append(shape);
        const label = clean.length <= 8 ? r.label : String(i + 1);
        if (
          clean.length <= 8 ||
          i % Math.ceil(clean.length / 8) === 0 ||
          i === clean.length - 1
        )
          svg.append(
            svgNode(
              "text",
              { x, y: 248, "text-anchor": "middle" },
              label.length > 10 ? String(i + 1) : label,
            ),
          );
      });
      root.append(
        svg,
        el(
          "p",
          "nui-help",
          (options.unit ? "Đơn vị: " + options.unit + ". " : "") +
            "Xem đầy đủ nhãn trong bảng dữ liệu.",
        ),
      );
    }
    const details = el("details"),
      summary = el("summary", "", "Xem dữ liệu");
    tableApi = DataTable({
      caption: options.title || kind,
      columns: [
        { key: "label", label: "Nhãn" },
        { key: "value", label: options.unit || "Giá trị" },
      ],
      rows: clean,
    });
    details.append(summary, tableApi.element);
    root.append(details);
  };
  instance.cleanup(() => tableApi?.destroy());
  instance.setData(options.data || []);
  return instance;
}
