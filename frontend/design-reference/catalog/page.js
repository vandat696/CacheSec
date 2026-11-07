// Catalog DOM composition; reusable components live in templates/src/.
const catalogLibrary = document.getElementById("library");
catalogLibrary.replaceChildren();
const catalogHeader = document.createElement("div");
catalogHeader.className = "intro";
catalogHeader.innerHTML =
  '<div><div class="eyebrow">NÓI / TEMPLATE LIBRARY</div><h1>UI templates</h1><p>Component có tên, có API, sẵn sàng đưa vào app. Dùng riêng từng mẫu hoặc kết hợp qua cùng hệ token.</p></div><button class="btn" id="try-chat">Mở chat mẫu →</button>';
catalogLibrary.append(catalogHeader);
document.getElementById("try-chat").onclick = () => navigate("chat");
const catalogGuide = document.createElement("div");
catalogGuide.className = "catalog-guide panel";
catalogGuide.innerHTML =
  '<div><strong>Tài nguyên độc lập · v2.0.0</strong><p class="small muted">HTML / CSS / JavaScript thuần · Không cần build · Không phụ thuộc trang mẫu</p></div><a class="btn" href="templates/README.md" target="_blank" rel="noopener">Hướng dẫn tích hợp ↗</a>';
catalogLibrary.append(catalogGuide);
const catalogFoundation = document.createElement("section");
catalogFoundation.className = "catalog-foundation";
catalogFoundation.innerHTML =
  '<div class="section-head"><h2>Design tokens</h2><code>templates/tokens.css</code></div><div class="catalog-tokens"><div><span style="background:#185ADB"></span><strong>Primary</strong><code>#185ADB</code></div><div><span style="background:#17263C"></span><strong>Text</strong><code>#17263C</code></div><div><span style="background:#526176"></span><strong>Muted</strong><code>#526176</code></div><div><span style="background:#EBF2FF"></span><strong>Tint</strong><code>#EBF2FF</code></div><div><span style="background:#F5F7FA"></span><strong>Background</strong><code>#F5F7FA</code></div></div><p class="small muted">Khung ngoài 0px · Control 8px · Badge 4px · Body 16px / 1,6 · Nhịp khoảng cách 8px</p>';
catalogLibrary.append(catalogFoundation);
const catalogToolbar = document.createElement("div");
catalogToolbar.className = "catalog-toolbar";
catalogToolbar.innerHTML =
  '<div class="field"><label for="template-search">Tìm template</label><input id="template-search" type="search" placeholder="Tên hoặc chức năng…"></div><div class="field"><label for="template-group">Nhóm component</label><select id="template-group"><option value="all">Tất cả</option><option value="controls">Nhập liệu & hành động</option><option value="navigation">Điều hướng</option><option value="feedback">Phản hồi</option><option value="data">Dữ liệu</option><option value="charts">Biểu đồ</option><option value="diagrams">Sơ đồ</option></select></div>';
catalogLibrary.append(catalogToolbar);
const catalogCount = document.createElement("p");
catalogCount.className = "small muted catalog-count";
catalogCount.setAttribute("role", "status");
catalogLibrary.append(catalogCount);
const catalogGrid = document.createElement("div");
catalogGrid.className = "catalog-grid";
catalogLibrary.append(catalogGrid);
const catalogEmpty = document.createElement("div");
catalogEmpty.className = "panel";
catalogEmpty.hidden = true;
catalogEmpty.textContent =
  "Không tìm thấy template. Hãy thử tên khác hoặc chọn Tất cả.";
catalogLibrary.append(catalogEmpty);
const catalogInstances = [];
const groupNames = {
  controls: "Nhập liệu & hành động",
  navigation: "Điều hướng",
  feedback: "Phản hồi",
  data: "Dữ liệu",
  charts: "Biểu đồ",
  diagrams: "Sơ đồ",
};
templateCatalog.forEach(
  ([name, group, description, variants, options], index) => {
    const article = document.createElement("article");
    article.className = "catalog-item";
    article.id = "template-" + name;
    article.dataset.group = group;
    article.dataset.search = (
      name +
      " " +
      description +
      " " +
      variants
    ).toLocaleLowerCase("vi");
    const heading = document.createElement("header");
    heading.className = "catalog-item-heading";
    const text = document.createElement("div"),
      num = document.createElement("span");
    num.className = "eyebrow";
    num.textContent =
      String(index + 1).padStart(2, "0") + " / " + groupNames[group];
    const title = document.createElement("h2");
    title.textContent = name;
    const desc = document.createElement("p");
    desc.className = "small muted";
    desc.textContent = description;
    text.append(num, title, desc);
    const link = document.createElement("a");
    link.className = "btn tertiary";
    link.href = "#template-" + name;
    link.textContent = "#";
    link.setAttribute("aria-label", "Liên kết đến " + name);
    heading.append(text, link);
    const variant = document.createElement("p");
    variant.className = "catalog-variants";
    variant.textContent = variants;
    const preview = document.createElement("div");
    preview.className = "catalog-preview";
    const config = { ...options };
    let api;
    if (name === "Button")
      config.onClick = () => toast("Button: onClick được gọi");
    if (name === "Dropdown")
      config.onSelect = (value) => toast("onSelect: " + value);
    if (name === "Dialog")
      config.onConfirm = () => toast("Dialog: onConfirm được gọi");
    api = NoiUI.create(name, config);
    catalogInstances.push(api);
    if (name === "Dialog" || name === "Toast") {
      const open = NoiUI.Button({
        label: name === "Dialog" ? "Mở Dialog" : "Hiển thị Toast",
        variant: "secondary",
        onClick: () => (name === "Dialog" ? api.open() : api.show()),
      });
      catalogInstances.push(open);
      preview.append(open.element, api.element);
    } else preview.append(api.element);
    if (name === "Button") {
      ["secondary", "tertiary", "danger"].forEach((v) => {
        const item = NoiUI.Button({
          label: v,
          variant: v,
          onClick: () => toast("Button / " + v),
        });
        preview.append(item.element);
        catalogInstances.push(item);
      });
      const disabled = NoiUI.Button({ label: "Disabled", disabled: true });
      catalogInstances.push(disabled);
      preview.append(disabled.element);
      const loading = NoiUI.Button({
        label: "Thử loading",
        variant: "secondary",
        onClick: (_, component) => {
          component.setLoading(true);
          setTimeout(() => component.setLoading(false), 900);
        },
      });
      catalogInstances.push(loading);
      preview.append(loading.element);
    }
    if (name === "Badge") {
      ["primary", "neutral", "danger"].forEach((tone) => {
        const item = NoiUI.Badge({ label: tone, tone });
        catalogInstances.push(item);
        preview.append(item.element);
      });
    }
    if (["LineChart", "BarChart", "DonutChart", "DataTable"].includes(name)) {
      const toggle = NoiUI.Button({
        label: "Thử dữ liệu rỗng",
        variant: "tertiary",
        onClick: () => {
          const empty = toggle.element.dataset.empty !== "true";
          api.setData(empty ? [] : options.data || options.rows);
          toggle.element.dataset.empty = String(empty);
          toggle.element.textContent = empty
            ? "Khôi phục dữ liệu mẫu"
            : "Thử dữ liệu rỗng";
        },
      });
      catalogInstances.push(toggle);
      preview.append(toggle.element);
    }
    const codeDetails = document.createElement("details");
    codeDetails.className = "catalog-code";
    const summary = document.createElement("summary");
    summary.textContent = "Mã tích hợp";
    const pre = document.createElement("pre"),
      code = document.createElement("code");
    const extra =
      name === "Dialog"
        ? "\ncomponent.open();"
        : name === "Toast"
          ? "\ncomponent.show();"
          : "";
    const snippet = `const component = NoiUI.${name}(${JSON.stringify(options, null, 2)});\ndocument.querySelector('#target').append(component.element);${extra}\n\n// Khi tháo component khỏi app:\n// component.destroy();`;
    code.textContent = snippet;
    pre.append(code);
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "btn";
    copy.textContent = "Sao chép mã";
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(snippet);
        toast("Đã sao chép " + name);
      } catch {
        codeDetails.open = true;
        const selection = window.getSelection(),
          range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
        toast("Đã chọn mã. Nhấn Ctrl+C hoặc giữ để sao chép.");
      }
    };
    codeDetails.append(summary, pre);
    const footer = document.createElement("div");
    footer.className = "catalog-item-footer";
    const apiName = document.createElement("code");
    apiName.textContent = "NoiUI." + name + "(options)";
    footer.append(apiName, copy);
    article.append(heading, variant, preview, codeDetails, footer);
    catalogGrid.append(article);
  },
);
function filterTemplates() {
  const query = document
      .getElementById("template-search")
      .value.trim()
      .toLocaleLowerCase("vi"),
    group = document.getElementById("template-group").value;
  let count = 0;
  catalogGrid.querySelectorAll(".catalog-item").forEach((item) => {
    const show =
      (group === "all" || item.dataset.group === group) &&
      item.dataset.search.includes(query);
    item.hidden = !show;
    if (show) count++;
  });
  catalogCount.textContent =
    count +
    " / " +
    templateCatalog.length +
    " templates · Các giá trị và dữ liệu hiển thị là minh họa";
  catalogEmpty.hidden = count !== 0;
}
document.getElementById("template-search").oninput = filterTemplates;
document.getElementById("template-group").onchange = filterTemplates;
filterTemplates();
const catalogFooter = document.createElement("footer");
catalogFooter.className = "footer-note";
catalogFooter.innerHTML =
  '<span>Nói UI templates / v2.0.0</span><span><a href="templates/manifest.json" target="_blank" rel="noopener">manifest.json</a> · <a href="templates/README.md" target="_blank" rel="noopener">README.md</a></span>';
catalogLibrary.append(catalogFooter);
if (location.hash.startsWith("#template-"))
  requestAnimationFrame(() =>
    document.getElementById(location.hash.slice(1))?.scrollIntoView(),
  );
window.addEventListener(
  "pagehide",
  () => catalogInstances.forEach((instance) => instance.destroy()),
  { once: true },
);
