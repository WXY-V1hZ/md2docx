const form = document.querySelector("#config-form");
const index = document.querySelector("#config-index");
const status = document.querySelector("#status");
const saveButton = document.querySelector("#save-button");
const resetButton = document.querySelector("#reset-button");

let schema;
let originalConfig;
let currentConfig;

initialize();

async function initialize() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error("无法读取配置");
    ({ schema, config: originalConfig } = await response.json());
    delete originalConfig.$schema;
    currentConfig = structuredClone(originalConfig);
    enforceHeadingDependency(originalConfig);
    enforceHeadingDependency(currentConfig);
    renderForm();
    updateView();
  } catch (error) {
    form.innerHTML = `<div class="loading">${escapeHtml(error.message)}</div>`;
    setStatus(error.message, true);
  }
}

function renderForm() {
  form.innerHTML = "";
  index.innerHTML = "";
  for (const [groupName, groupSchema] of Object.entries(schema.properties)) {
    const title = groupSchema.description ?? groupName;
    const sectionId = `section-${groupName}`;
    const link = document.createElement("a");
    link.href = `#${sectionId}`;
    link.textContent = title;
    index.append(link);

    const group = document.createElement("section");
    group.className = "group";
    group.id = sectionId;
    group.innerHTML = `<header class="group-title"><h2>${escapeHtml(title)}</h2></header><div class="fields"></div>`;
    const fields = group.querySelector(".fields");
    for (const [name, fieldSchema] of Object.entries(groupSchema.properties)) {
      fields.append(createField(groupName, name, fieldSchema));
    }
    form.append(group);
  }
}

function createField(groupName, name, fieldSchema) {
  const path = `${groupName}.${name}`;
  const field = document.createElement("div");
  field.className = "field";
  field.innerHTML = `<label for="${path}">${escapeHtml(fieldSchema.description ?? name)}</label>`;

  let input;
  if (fieldSchema.type === "boolean") {
    const wrapper = document.createElement("label");
    wrapper.className = "switch";
    wrapper.innerHTML = `<input id="${path}" type="checkbox" ${getPath(currentConfig, path) ? "checked" : ""}><span class="switch-track"></span>`;
    input = wrapper.querySelector("input");
    if (path === "normalizeHeadings.enabled" && currentConfig.numberHeadings.enabled) {
      input.disabled = true;
      input.title = "标题编号开启时无法关闭";
    }
    field.append(wrapper);
  } else if (fieldSchema.enum) {
    input = document.createElement("select");
    input.id = path;
    for (const value of fieldSchema.enum) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = fieldSchema.enumDescriptions?.[value] ?? value;
      option.selected = value === getPath(currentConfig, path);
      input.append(option);
    }
    field.append(input);
  } else {
    input = document.createElement("input");
    input.id = path;
    input.type =
      fieldSchema.type === "integer" || fieldSchema.type === "number" ? "number" : "text";
    input.value = getPath(currentConfig, path) ?? "";
    if (fieldSchema.minimum !== undefined) input.min = fieldSchema.minimum;
    if (fieldSchema.type === "integer") input.step = "1";
    field.append(input);
  }

  input.addEventListener("input", () => {
    const value =
      fieldSchema.type === "boolean"
        ? input.checked
        : fieldSchema.type === "integer"
          ? Number.parseInt(input.value, 10)
          : fieldSchema.type === "number"
            ? Number(input.value)
            : input.value;
    setPath(currentConfig, path, value);
    if (path === "numberHeadings.enabled") {
      enforceHeadingDependency(currentConfig);
      renderForm();
    }
    updateView();
  });
  return field;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveButton.disabled = true;
  setStatus("正在保存配置…");
  try {
    const response = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentConfig),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "保存失败");
    originalConfig = structuredClone(currentConfig);
    updateView();
    setStatus("默认配置已保存");
  } catch (error) {
    setStatus(error.message, true);
    saveButton.disabled = false;
  }
});

resetButton.addEventListener("click", () => {
  currentConfig = structuredClone(originalConfig);
  renderForm();
  updateView();
});

function updateView() {
  const changes = countChanges(originalConfig, currentConfig);
  saveButton.disabled = changes === 0;
  resetButton.disabled = changes === 0;
  if (changes) setStatus("有尚未保存的修改");
  else if (status.textContent !== "默认配置已保存") setStatus("配置尚未修改");
}

function countChanges(before, after) {
  return Object.keys(schema.properties).reduce(
    (total, group) =>
      total +
      Object.keys(schema.properties[group].properties).filter(
        (name) => before[group][name] !== after[group][name],
      ).length,
    0,
  );
}

function getPath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}
function setPath(source, path, value) {
  const [group, name] = path.split(".");
  source[group][name] = value;
}
function enforceHeadingDependency(config) {
  if (config.numberHeadings.enabled) config.normalizeHeadings.enabled = true;
}
function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}
function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}
