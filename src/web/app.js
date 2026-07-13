const configForm = document.querySelector("#config-form");
const configIndex = document.querySelector("#config-index");
const styleIndex = document.querySelector("#style-index");
const styleEditor = document.querySelector("#style-editor");
const styleSearch = document.querySelector("#style-search");
const status = document.querySelector("#status");
const statusIndicator = document.querySelector("#status-indicator");
const saveButton = document.querySelector("#save-button");
const resetButton = document.querySelector("#reset-button");
const previewButton = document.querySelector("#preview-button");

let activeView = "config";
let schema;
let originalConfig;
let currentConfig;
let originalStyles;
let currentStyles;
let styleCatalog;
let styleRevision;
let selectedStyle = { kind: "default" };

const styleFields = [
  { section: "文字", label: "中文字体", path: ["run", "font", "eastAsia"], type: "text" },
  {
    section: "文字",
    label: "西文字体",
    path: ["run", "font", "ascii"],
    type: "text",
    mirror: ["run", "font", "hAnsi"],
  },
  {
    section: "文字",
    label: "字号",
    path: ["run", "size"],
    type: "number",
    unit: "pt",
    scale: 2,
    min: 1,
    step: 0.5,
    mirror: ["run", "sizeComplexScript"],
  },
  { section: "文字", label: "文字颜色", path: ["run", "color"], type: "color" },
  { section: "文字", label: "加粗", path: ["run", "bold"], type: "boolean" },
  { section: "文字", label: "斜体", path: ["run", "italics"], type: "boolean" },
  {
    section: "段落",
    label: "对齐方式",
    path: ["paragraph", "alignment"],
    type: "select",
    options: [
      ["left", "左对齐"],
      ["center", "居中"],
      ["right", "右对齐"],
      ["both", "两端对齐"],
    ],
  },
  {
    section: "段落",
    label: "段前间距",
    path: ["paragraph", "spacing", "before"],
    type: "number",
    unit: "pt",
    scale: 20,
    min: 0,
    step: 1,
  },
  {
    section: "段落",
    label: "段后间距",
    path: ["paragraph", "spacing", "after"],
    type: "number",
    unit: "pt",
    scale: 20,
    min: 0,
    step: 1,
  },
  {
    section: "段落",
    label: "行距",
    path: ["paragraph", "spacing", "line"],
    type: "select-number",
    options: [
      [240, "单倍"],
      [300, "1.25 倍"],
      [360, "1.5 倍"],
      [480, "2 倍"],
    ],
  },
  {
    section: "段落",
    label: "首行缩进",
    path: ["paragraph", "indent", "firstLineChars"],
    type: "number",
    unit: "字符",
    scale: 100,
    min: 0,
    step: 0.5,
  },
  { section: "分页", label: "与下段同页", path: ["paragraph", "keepNext"], type: "boolean" },
  { section: "分页", label: "段中不分页", path: ["paragraph", "keepLines"], type: "boolean" },
  { section: "分页", label: "段前分页", path: ["paragraph", "pageBreakBefore"], type: "boolean" },
];

const propertySectionDescriptions = {
  文字: "字体、字号与字形",
  段落: "对齐、间距与缩进",
  分页: "段落分页行为",
  表格: "字体、对齐与单元格留白",
};

initialize();
document.body.dataset.view = activeView;

styleSearch.addEventListener("input", filterStyleIndex);

async function apiFetch(url, body) {
  const response = await fetch(
    url,
    body
      ? {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : void 0,
  );
  const result = body ? await response.json().catch(() => ({})) : void 0;
  if (!response.ok) throw new Error(result?.error ?? `${response.status} ${response.statusText}`);
  return result;
}

async function initialize() {
  try {
    const [configResponse, stylesResponse] = await Promise.all([
      fetch("/api/config"),
      fetch("/api/styles"),
    ]);
    if (!configResponse.ok) throw new Error("无法读取转换配置");
    if (!stylesResponse.ok) throw new Error("无法读取文档样式");
    ({ schema, config: originalConfig } = await configResponse.json());
    const styleData = await stylesResponse.json();
    delete originalConfig.$schema;
    currentConfig = structuredClone(originalConfig);
    originalStyles = styleData.styles;
    currentStyles = structuredClone(originalStyles);
    styleCatalog = styleData.catalog;
    styleRevision = styleData.revision;
    enforceHeadingDependency(originalConfig);
    enforceHeadingDependency(currentConfig);
    renderConfigForm();
    renderStyleIndex();
    selectFirstStyle();
    updateProof();
    updateView();
  } catch (error) {
    configForm.innerHTML = `<div class="loading error-copy">${escapeHtml(error.message)}</div>`;
    styleEditor.innerHTML = `<div class="loading error-copy">${escapeHtml(error.message)}</div>`;
    setStatus(error.message, true);
  }
}

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

function switchView(view) {
  activeView = view;
  document.body.dataset.view = view;
  document
    .querySelectorAll(".mode-tab")
    .forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".view").forEach((panel) => {
    const active = panel.id === `${view}-view`;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  previewButton.hidden = view !== "styles";
  saveButton.textContent = view === "styles" ? "保存文档样式" : "保存转换配置";
  saveButton.removeAttribute("form");
  if (view === "config") saveButton.setAttribute("form", "config-form");
  updateView();
}

function renderConfigForm() {
  configForm.innerHTML = "";
  configIndex.innerHTML = "";
  for (const [groupName, groupSchema] of Object.entries(schema.properties)) {
    const title = groupSchema.description ?? groupName;
    const sectionId = `section-${groupName}`;
    const link = document.createElement("a");
    link.href = `#${sectionId}`;
    link.textContent = title;
    configIndex.append(link);

    const group = document.createElement("section");
    group.className = "config-group";
    group.id = sectionId;
    group.innerHTML = `<header><p>转换规则</p><h2>${escapeHtml(title)}</h2></header><div class="config-fields"></div>`;
    const fields = group.querySelector(".config-fields");
    for (const [name, fieldSchema] of Object.entries(groupSchema.properties)) {
      fields.append(createConfigField(groupName, name, fieldSchema));
    }
    configForm.append(group);
  }
}

function createConfigField(group, name, field) {
  const path = `${group}.${name}`;
  const div = document.createElement("div");
  div.className = "config-field";
  const description = field.description ?? name;
  div.innerHTML = `<label for="${path}">${escapeHtml(description)}</label>`;
  let input;
  if (field.type === "boolean") {
    const checked = currentConfig[group][name];
    div.innerHTML += `<label class="switch"><input type="checkbox" id="${path}" ${checked ? "checked" : ""}><span class="switch-track"></span></label>`;
    input = div.querySelector("input");
    input.addEventListener("change", () => {
      currentConfig[group][name] = input.checked;
      enforceHeadingDependency(currentConfig);
      syncHeadingDependencyControls();
      updateView();
    });
  } else {
    const wrapper = document.createElement("div");
    wrapper.className = "property-control";
    if (field.type === "string" || field.type === "text") {
      input = document.createElement("input");
      input.type = "text";
      input.id = path;
      input.value = currentConfig[group][name] ?? "";
      input.addEventListener("input", () => {
        currentConfig[group][name] = input.value;
        updateView();
      });
    } else {
      input = document.createElement("select");
      input.id = path;
      if (field.enum) {
        for (const option of field.enum) {
          const opt = document.createElement("option");
          opt.value = option;
          opt.textContent = option;
          if (currentConfig[group][name] === option) opt.selected = true;
          input.append(opt);
        }
        input.addEventListener("change", () => {
          currentConfig[group][name] = input.value;
          updateView();
        });
      } else if (field.type === "integer") {
        input = document.createElement("input");
        input.type = "number";
        input.id = path;
        input.min = field.minimum ?? 0;
        input.value = currentConfig[group][name] ?? "";
        input.addEventListener("input", () => {
          currentConfig[group][name] = input.value === "" ? "" : Number(input.value);
          updateView();
        });
      }
    }
    wrapper.append(input);
    div.append(wrapper);
  }
  return div;
}

function renderStyleIndex() {
  styleIndex.innerHTML = "";
  const bySection = {};
  for (const entry of styleCatalog ?? []) {
    const section = entry.section ?? "其他";
    if (!bySection[section]) bySection[section] = [];
    bySection[section].push(entry);
  }
  for (const [section, entries] of Object.entries(bySection)) {
    const group = document.createElement("div");
    group.className = section === "其他" ? "style-nav-group advanced-nav" : "style-nav-group";
    group.innerHTML = `<h2>${escapeHtml(section)}</h2><div></div>`;
    const list = group.querySelector("div");
    for (const entry of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.kind = entry.kind;
      button.dataset.key = entry.key;
      button.dataset.collection = entry.collection ?? "";
      button.dataset.id = entry.id ?? "";
      button.textContent = entry.label;
      button.addEventListener("click", () => selectStyle(button));
      list.append(button);
    }
    styleIndex.append(group);
  }
  document.querySelectorAll(`.style-nav-group button`).forEach((b) => b.classList.remove("active"));
}

function filterStyleIndex() {
  const query = styleSearch.value.toLowerCase();
  document.querySelectorAll(".style-nav-group").forEach((group) => {
    const match =
      query === "" ||
      Array.from(group.querySelectorAll("button")).some((btn) =>
        btn.textContent.toLowerCase().includes(query),
      );
    group.hidden = !match;
  });
}

function selectFirstStyle() {
  const first = styleIndex.querySelector("button");
  if (first) selectStyle(first);
}

function selectStyle(button) {
  selectedStyle = {
    kind: button.dataset.kind,
    collection: button.dataset.collection,
    id: button.dataset.id,
    key: button.dataset.key,
  };
  document.querySelectorAll(".style-nav-group button").forEach((b) => b.classList.remove("active"));
  button.classList.add("active");
  renderStyleEditor();
  updateProof();
}

function renderStyleEditor() {
  styleEditor.innerHTML = "";
  if (!selectedStyle) return;
  const entry = selectedEntry();
  const name = selectedStyle.key ?? "";
  const label = styleCatalog?.find((c) => c.key === name)?.label ?? name;
  const inheritedFrom = entry?.basedOn ? styleNameById(entry.basedOn) : null;

  const container = document.createElement("div");
  container.innerHTML = `<div class="editor-heading"><div><p class="eyebrow">正在编辑</p><h1>${escapeHtml(label)}</h1>${inheritedFrom ? `<p>基于 <strong>${escapeHtml(displayStyleName(inheritedFrom))}</strong></p>` : `<p>文档默认样式</p>`}</div>${inheritedFrom ? '<span class="inherit-chip">继承样式</span>' : ""}</div>`;

  if (selectedStyle.collection === "tableStyles") {
    container.append(createTableFields());
  } else {
    const groups = {};
    for (const field of styleFields) {
      if (!groups[field.section]) groups[field.section] = [];
      groups[field.section].push(field);
    }
    for (const [section, fields] of Object.entries(groups)) {
      const fieldset = createPropertyGroup(section, fields, entry);
      if (fieldset) container.append(fieldset);
    }
  }
  styleEditor.append(container);
}

function createStyleField(field, entry) {
  const explicit = deepGet(entry, field.path);
  const effective = effectiveValue(entry, field.path);
  const row = document.createElement("div");
  row.className = "property-row";
  const inherited = effective.source !== (entry.name ? displayStyleName(entry.name) : "文档默认");

  row.innerHTML = `<div class="property-label"><label for="${field.path.join(".")}">${escapeHtml(field.label)}</label><small>${inherited ? `继承自 ${escapeHtml(effective.source)}` : " "}</small></div>`;
  const control = document.createElement("div");
  control.className = "property-control";
  const input = makeStyleInput(field, entry);
  control.append(input);
  row.append(control);
  const reset = document.createElement("button");
  reset.className = "reset-property";
  reset.type = "button";
  reset.disabled = explicit === undefined;
  reset.textContent = "↺";
  reset.title = "恢复继承值";
  reset.addEventListener("click", () => {
    deepDelete(entry, field.path);
    renderStyleEditor();
    updateProof();
    updateView();
  });
  row.append(reset);
  return row;
}

function makeStyleInput(field, entry) {
  let input;
  const value = deepGet(entry, field.path);
  if (field.type === "boolean") {
    const wrapper = document.createElement("label");
    wrapper.className = "check-control";
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value ?? false;
    input.addEventListener("change", () => {
      deepSet(entry, field.path, input.checked);
      renderStyleEditor();
      updateProof();
      updateView();
    });
    wrapper.append(
      input,
      field.mirror
        ? document.createTextNode("同步到等宽字号")
        : document.createTextNode(field.label),
    );
    return wrapper;
  }
  if (field.type === "color") {
    const wrapper = document.createElement("div");
    wrapper.className = "color-control";
    input = document.createElement("input");
    input.type = "color";
    input.value = normalizeColor(value);
    const text = document.createElement("input");
    text.type = "text";
    text.value = value ?? "";
    text.placeholder = "无";
    const apply = () => {
      deepSet(entry, field.path, text.value.toUpperCase());
      renderStyleEditor();
      updateProof();
      updateView();
    };
    input.addEventListener("input", () => {
      text.value = input.value.slice(1);
      apply();
    });
    text.addEventListener("change", apply);
    wrapper.append(input, text);
    return wrapper;
  }
  if (field.type === "select") {
    input = document.createElement("select");
    for (const [val, label] of field.options) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      if (value === val || (!value && val === field.default)) opt.selected = true;
      input.append(opt);
    }
    input.addEventListener("change", () => {
      deepSet(entry, field.path, input.value || undefined);
      renderStyleEditor();
      updateProof();
      updateView();
    });
    return input;
  }
  if (field.type === "select-number") {
    input = document.createElement("select");
    for (const [val, label] of field.options) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      if (value == val) opt.selected = true;
      input.append(opt);
    }
    const customOpt = document.createElement("option");
    customOpt.value = "custom";
    customOpt.textContent = "自定义";
    input.append(customOpt);
    input.addEventListener("change", () => {
      if (input.value !== "custom") deepSet(entry, field.path, Number(input.value));
      renderStyleEditor();
      updateProof();
      updateView();
    });
    // Show custom input if current value not in options
    const inOptions = field.options.some(([v]) => v == value);
    if (value !== undefined && !inOptions) {
      const wrapper = document.createElement("div");
      wrapper.className = "unit-control";
      wrapper.append(input);
      const customInput = document.createElement("input");
      customInput.type = "number";
      customInput.value = value;
      customInput.step = field.step ?? 1;
      customInput.addEventListener("change", () => {
        deepSet(entry, field.path, Number(customInput.value));
        renderStyleEditor();
        updateProof();
        updateView();
      });
      wrapper.append(customInput);
      if (field.unit) {
        const unit = document.createElement("span");
        unit.textContent = field.unit;
        wrapper.append(unit);
      }
      return wrapper;
    }
    return input;
  }
  if (field.unit) {
    const wrapper = document.createElement("div");
    wrapper.className = "unit-control";
    input = document.createElement("input");
    input.type = "number";
    input.min = field.min;
    input.step = field.step ?? 1;
    input.placeholder = "无";
    const raw = value !== undefined ? value / field.scale : "";
    // Preserve decimals for small values
    input.value = field.scale === 100 && raw === 0 ? "0" : raw === "" ? "" : String(raw);
    const apply = () => {
      const v = input.value === "" ? undefined : Math.round(Number(input.value) * field.scale);
      deepSet(entry, field.path, v);
      updateProof();
      updateView();
    };
    input.addEventListener("change", apply);
    wrapper.append(input);
    if (field.unit) {
      const unit = document.createElement("span");
      unit.textContent = field.unit;
      wrapper.append(unit);
    }
    return wrapper;
  }
  input = document.createElement("input");
  input.type = "text";
  input.value = value ?? "";
  input.placeholder = "继承";
  input.addEventListener("change", () => {
    deepSet(entry, field.path, input.value || undefined);
    renderStyleEditor();
    updateProof();
    updateView();
  });
  return input;
}

function createTableFields() {
  const fieldset = document.createElement("div");
  const entry = selectedEntry();
  if (!entry) return fieldset;

  const definitions = [
    { label: "中文字体", path: ["run", "font", "eastAsia"], type: "text" },
    {
      label: "西文字体",
      path: ["run", "font", "ascii"],
      type: "text",
      mirror: ["run", "font", "hAnsi"],
    },
    {
      label: "字号",
      path: ["run", "size"],
      type: "number",
      unit: "pt",
      scale: 2,
      min: 1,
      step: 0.5,
      mirror: ["run", "sizeComplexScript"],
    },
    {
      label: "表格对齐",
      path: ["table", "alignment"],
      type: "select",
      options: [
        ["left", "左对齐"],
        ["center", "居中"],
        ["right", "右对齐"],
      ],
    },
    {
      label: "表格字号",
      path: ["run", "size"],
      type: "number",
      unit: "pt",
      scale: 2,
      min: 1,
      step: 0.5,
      mirror: ["run", "sizeComplexScript"],
    },
    {
      label: "上边距",
      path: ["table", "cellMargin", "top"],
      type: "number",
      unit: "pt",
      scale: 20,
      min: 0,
      step: 1,
      default: 0,
    },
    {
      label: "下边距",
      path: ["table", "cellMargin", "bottom"],
      type: "number",
      unit: "pt",
      scale: 20,
      min: 0,
      step: 1,
      default: 0,
    },
    {
      label: "左边距",
      path: ["table", "cellMargin", "left"],
      type: "number",
      unit: "pt",
      scale: 20,
      min: 0,
      step: 1,
      default: 0,
    },
    {
      label: "右边距",
      path: ["table", "cellMargin", "right"],
      type: "number",
      unit: "pt",
      scale: 20,
      min: 0,
      step: 1,
      default: 0,
    },
  ];
  for (const def of definitions) {
    const field = createStyleField(def, entry);
    if (field) fieldset.append(field);
  }
  return fieldset;
}

function createPropertyGroup(section, fields, entry) {
  if (!fields.length) return null;
  const fieldset = document.createElement("fieldset");
  fieldset.className = "property-group";
  fieldset.innerHTML = `<legend>${escapeHtml(section)}</legend><p class="group-note">${escapeHtml(propertySectionDescriptions[section] ?? "")}</p>`;
  for (const field of fields) fieldset.append(createStyleField(field, entry));
  return fieldset;
}

// Event listeners
resetButton.addEventListener("click", () => {
  if (activeView === "config") {
    currentConfig = structuredClone(originalConfig);
    renderConfigForm();
  } else {
    currentStyles = structuredClone(originalStyles);
    renderStyleIndex();
    selectFirstStyle();
    updateProof();
  }
  updateView();
});

saveButton.addEventListener("click", async (event) => {
  if (activeView === "styles") {
    event.preventDefault();
    setBusy(true, "正在验证样式并重建 Word 模板…");
    try {
      const result = await apiFetch("/api/styles", {
        styles: currentStyles,
        revision: styleRevision,
      });
      originalStyles = structuredClone(currentStyles);
      styleRevision = result.revision;
      setStatus("文档样式已保存，Word 模板已重建");
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
      updateView();
    }
  }
});

document.querySelector("#config-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true, "正在保存转换配置…");
  try {
    await apiFetch("/api/config", currentConfig);
    originalConfig = structuredClone(currentConfig);
    setStatus("转换配置已保存");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
    updateView();
  }
});

previewButton.addEventListener("click", async () => {
  setBusy(true, "正在生成真实 DOCX 校样…");
  try {
    const response = await fetch("/api/styles/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ styles: currentStyles }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error ?? "预览生成失败");
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "md2docx-style-preview.docx";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("真实 DOCX 校样已生成");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
    updateView();
  }
});

function updateView() {
  if (!originalConfig || !originalStyles) return;
  const changed =
    activeView === "config"
      ? JSON.stringify(originalConfig) !== JSON.stringify(currentConfig)
      : JSON.stringify(originalStyles) !== JSON.stringify(currentStyles);
  saveButton.disabled = !changed;
  resetButton.disabled = !changed;
  if (changed)
    setStatus(activeView === "config" ? "转换配置有尚未保存的修改" : "文档样式有尚未保存的修改");
  else if (!status.textContent.includes("已保存") && !status.textContent.includes("已生成"))
    setStatus(activeView === "config" ? "转换配置尚未修改" : "文档样式尚未修改");
}

function updateProof() {
  if (!currentStyles) return;
  document
    .querySelectorAll("[data-proof]")
    .forEach((node) => applyProofStyle(node, node.dataset.proof));
}

function applyProofStyle(node, name) {
  const style = findStyleAny(name);
  if (!style) return;
  const font =
    effectiveValue(style, ["run", "font", "eastAsia"]).value ??
    effectiveValue(style, ["run", "font", "ascii"]).value;
  const size = effectiveValue(style, ["run", "size"]).value;
  const color = effectiveValue(style, ["run", "color"]).value;
  const bold = effectiveValue(style, ["run", "bold"]).value;
  const italics = effectiveValue(style, ["run", "italics"]).value;
  const align = effectiveValue(style, ["paragraph", "alignment"]).value;
  const line = effectiveValue(style, ["paragraph", "spacing", "line"]).value;
  const before = effectiveValue(style, ["paragraph", "spacing", "before"]).value;
  const after = effectiveValue(style, ["paragraph", "spacing", "after"]).value;
  const indent = effectiveValue(style, ["paragraph", "indent", "firstLineChars"]).value;
  node.style.fontFamily = font ? `"${font}", serif` : "";
  node.style.fontSize = size ? `${size / 2}pt` : "";
  node.style.color = color && color !== "auto" ? `#${color}` : "";
  node.style.fontWeight = bold ? "700" : "400";
  node.style.fontStyle = italics ? "italic" : "normal";
  node.style.textAlign = align === "both" ? "justify" : (align ?? "");
  node.style.lineHeight = line ? String(line / 240) : "";
  node.style.marginTop = before !== undefined ? `${before / 20}pt` : "";
  node.style.marginBottom = after !== undefined ? `${after / 20}pt` : "";
  node.style.textIndent = indent ? `${indent / 100}em` : "";
}

function selectedEntry() {
  if (selectedStyle.kind === "default") return currentStyles.default?.document;
  if (selectedStyle.kind === "style")
    return collectionEntries(selectedStyle.collection).find(
      (entry) => entry.id === selectedStyle.id,
    );
  return null;
}

function findStyleAny(name) {
  return ["paragraphStyles", "characterStyles", "tableStyles"]
    .flatMap(collectionEntries)
    .find((entry) => entry.name === name);
}
function collectionEntries(collection) {
  return Array.isArray(currentStyles?.[collection]) ? currentStyles[collection] : [];
}
function styleNameById(id) {
  return (
    ["paragraphStyles", "characterStyles", "tableStyles"]
      .flatMap(collectionEntries)
      .find((entry) => entry.id === id)?.name ?? id
  );
}

function effectiveValue(entry, path, visited = new Set()) {
  const explicit = deepGet(entry, path);
  if (explicit !== undefined)
    return { value: explicit, source: displayStyleName(entry.name ?? "文档默认") };
  if (entry.basedOn && !visited.has(entry.basedOn)) {
    visited.add(entry.basedOn);
    const parent = ["paragraphStyles", "characterStyles", "tableStyles"]
      .flatMap(collectionEntries)
      .find((candidate) => candidate.id === entry.basedOn);
    if (parent) {
      const inherited = effectiveValue(parent, path, visited);
      if (inherited.value !== undefined) return inherited;
    }
  }
  const fallback = deepGet(currentStyles.default?.document, path);
  return { value: fallback, source: "文档默认" };
}

function displayStyleName(name) {
  const labels = {
    "heading 1": "一级标题",
    "heading 2": "二级标题",
    "heading 3": "三级标题",
    "heading 4": "四级标题",
    "heading 5": "五级标题",
    "heading 6": "六级标题",
    "TOC Heading": "目录标题",
    "Body Text": "正文",
    "First Paragraph": "首段正文",
    "Block Text": "块引用",
    "Source Code": "代码块",
    "Inline Code": "行内代码",
    "Table Caption": "表格题注",
    "Image Caption": "图片题注",
    "Captioned Figure": "带题注图片",
    "footnote text": "脚注正文",
    "footnote reference": "脚注引用",
    header: "页眉",
    footer: "页脚",
    caption: "通用题注",
  };
  return labels[name] ?? name;
}

function deepGet(source, path) {
  return path.reduce((value, key) => value?.[key], source);
}
function deepSet(source, path, value) {
  let current = source;
  for (const key of path.slice(0, -1)) {
    if (!current[key] || typeof current[key] !== "object") current[key] = {};
    current = current[key];
  }
  current[path.at(-1)] = value;
}
function deepDelete(source, path) {
  const parents = [source];
  let current = source;
  for (const key of path.slice(0, -1)) {
    current = current?.[key];
    if (!current) return;
    parents.push(current);
  }
  delete current[path.at(-1)];
  for (let index = path.length - 2; index >= 0; index--) {
    const parent = parents[index];
    const key = path[index];
    if (parent[key] && Object.keys(parent[key]).length === 0) delete parent[key];
    else break;
  }
}
function normalizeColor(value) {
  return typeof value === "string" && /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : "#202B3C";
}
function enforceHeadingDependency(config) {
  if (config.numberHeadings.enabled) config.normalizeHeadings.enabled = true;
}
function syncHeadingDependencyControls() {
  const input = document.getElementById("normalizeHeadings.enabled");
  input.checked = currentConfig.normalizeHeadings.enabled;
  input.disabled = currentConfig.numberHeadings.enabled;
  input.title = currentConfig.numberHeadings.enabled ? "标题编号开启时无法关闭" : "";
}
function setBusy(busy, message) {
  saveButton.disabled = busy;
  resetButton.disabled = busy;
  previewButton.disabled = busy;
  if (message) setStatus(message);
}
function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error-copy", error);
  statusIndicator.classList.toggle("error", error);
}
function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}
