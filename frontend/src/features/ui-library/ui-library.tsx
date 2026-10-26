"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { TextInput, Select } from "@/components/ui/fields";
import { catalogItems } from "./catalog-data";
import { catalogExamples } from "./catalog-examples";
import { TemplatePreview } from "./template-preview";

const groupNames = {
  controls: "Nhập liệu & hành động",
  navigation: "Điều hướng",
  feedback: "Phản hồi",
  data: "Dữ liệu",
  charts: "Biểu đồ",
  diagrams: "Sơ đồ",
};
const tokens = [
  { label: "Primary", color: "#185ADB" },
  { label: "Text", color: "#17263C" },
  { label: "Muted", color: "#526176" },
  { label: "Tint", color: "#EBF2FF" },
  { label: "Background", color: "#F5F7FA" },
];

export function UiLibrary() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const search = query.trim().toLocaleLowerCase("vi");
  const matches = (item: (typeof catalogItems)[number]) =>
    (group === "all" || item.group === group) &&
    `${item.name} ${item.description} ${item.variants}`
      .toLocaleLowerCase("vi")
      .includes(search);
  const count = catalogItems.filter(matches).length;

  return (
    <div className="page">
      <div className="intro">
        <div>
          <div className="eyebrow">Nói / Template library</div>
          <h1>UI templates</h1>
          <p>
            Component có tên, có API, sẵn sàng đưa vào app. Dùng riêng từng mẫu
            hoặc kết hợp qua cùng hệ token.
          </p>
        </div>
        <Link className="btn" href="/chat">
          Mở chat mẫu →
        </Link>
      </div>
      <div className="catalog-guide panel">
        <div>
          <strong>Thành phần dùng chung</strong>
          <p className="small muted">
            React / TypeScript · CSS thuần · Cùng hệ thiết kế với màn chat
          </p>
        </div>
        <a className="btn" href="#template-Button">
          Xem component ↓
        </a>
      </div>
      <section className="catalog-foundation" aria-labelledby="tokens-heading">
        <div className="section-head">
          <h2 id="tokens-heading">Design tokens</h2>
          <code>styles/tokens.css</code>
        </div>
        <div className="catalog-tokens">
          {tokens.map((token) => (
            <div key={token.label}>
              <span style={{ background: token.color }} />
              <strong>{token.label}</strong>
              <code>{token.color}</code>
            </div>
          ))}
        </div>
        <p className="small muted">
          Khung ngoài 0px · Control 8px · Badge 4px · Body 16px / 1,6 · Nhịp
          khoảng cách 8px
        </p>
      </section>
      <div className="catalog-toolbar">
        <TextInput
          label="Tìm template"
          type="search"
          placeholder="Tên hoặc chức năng…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          label="Nhóm component"
          value={group}
          onChange={(event) => setGroup(event.target.value)}
          options={[
            { value: "all", label: "Tất cả" },
            ...Object.entries(groupNames).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
      </div>
      <p className="small muted catalog-count" role="status">
        {count} / {catalogItems.length} templates · Các giá trị và dữ liệu hiển
        thị là minh họa
      </p>
      <div className="catalog-grid">
        {catalogItems.map((item, index) => (
          <article
            key={item.name}
            className="catalog-item"
            id={`template-${item.name}`}
            hidden={!matches(item)}
          >
            <header className="catalog-item-heading">
              <div>
                <span className="eyebrow">
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {groupNames[item.group]}
                </span>
                <h2>{item.name}</h2>
                <p className="small muted">{item.description}</p>
              </div>
              <a
                className="btn tertiary"
                href={`#template-${item.name}`}
                aria-label={`Liên kết đến ${item.name}`}
              >
                #
              </a>
            </header>
            <p className="catalog-variants">{item.variants}</p>
            <div className="catalog-preview">
              <TemplatePreview item={item} />
            </div>
            <details className="catalog-code">
              <summary>Mã tích hợp</summary>
              <pre>
                <code>{catalogExamples[item.name]}</code>
              </pre>
            </details>
            <footer className="catalog-item-footer">
              <code>{`<${item.name} />`}</code>
              <CopyButton
                text={catalogExamples[item.name]}
                label="Sao chép mã"
              />
            </footer>
          </article>
        ))}
      </div>
      {count === 0 && (
        <div className="panel">
          Không tìm thấy template. Hãy thử tên khác hoặc chọn Tất cả.
        </div>
      )}
      <footer className="footer-note">
        <span>Nói / Bộ giao diện CacheSec</span>
        <span>Dữ liệu minh họa · Không phải kết quả benchmark</span>
      </footer>
    </div>
  );
}
