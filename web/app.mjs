import { describe, findService, formatWhen, pointsFor, publishedEnds, shortService } from "./model.mjs";

const serviceInput = document.querySelector("#service");
const serviceList = document.querySelector("#service-list");
const offenceSelect = document.querySelector("#offence");
const presets = document.querySelector("#presets");
const finding = document.querySelector("#finding");
const chart = document.querySelector("#chart");
const rows = document.querySelector("#rows");
const caption = document.querySelector("#table-caption");
const state = { sheet: null, config: { services: [], violation: "" } };

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function remember(key, value) {
  try { localStorage.setItem(`coolcode:violationsheet:${key}`, value); } catch { /* private mode */ }
}

function recall(key) {
  try { return localStorage.getItem(`coolcode:violationsheet:${key}`) || ""; } catch { return ""; }
}

function selectedService() {
  return findService(state.sheet?.services || [], serviceInput.value);
}

function selectedOffence() {
  return (state.sheet?.violations || []).find((item) => item.id === offenceSelect.value) || null;
}

function bcService() {
  return findService(state.sheet?.services || [], "British Columbia");
}

function formatCount(value) {
  if (value == null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(value);
}

function drawChart(points) {
  clear(chart);
  const published = points.filter((point) => point.rate != null);
  if (published.length < 2) return;
  const width = 720;
  const height = 220;
  const pad = 28;
  const min = Math.min(...published.map((point) => point.rate));
  const max = Math.max(...published.map((point) => point.rate));
  const span = max - min || 1;
  const years = points.map((point) => point.year);
  const xFor = (year) => pad + ((year - years[0]) / (years.at(-1) - years[0] || 1)) * (width - pad * 2);
  const yFor = (rate) => pad + (1 - (rate - min) / span) * (height - pad * 2);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  let moved = false;
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  let d = "";
  for (const point of points) {
    if (point.rate == null) {
      moved = false;
      continue;
    }
    const command = moved ? "L" : "M";
    d += `${command}${xFor(point.year).toFixed(1)} ${yFor(point.rate).toFixed(1)} `;
    moved = true;
  }
  line.setAttribute("d", d.trim());
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "currentColor");
  line.setAttribute("stroke-width", "2.5");
  svg.append(line);
  const start = document.createElementNS("http://www.w3.org/2000/svg", "text");
  start.setAttribute("x", pad);
  start.setAttribute("y", height - 6);
  start.setAttribute("fill", "currentColor");
  start.setAttribute("font-size", "14");
  start.textContent = String(years[0]);
  const end = document.createElementNS("http://www.w3.org/2000/svg", "text");
  end.setAttribute("x", width - pad);
  end.setAttribute("y", height - 6);
  end.setAttribute("text-anchor", "end");
  end.setAttribute("fill", "currentColor");
  end.setAttribute("font-size", "14");
  end.textContent = String(years.at(-1));
  svg.append(start, end);
  chart.append(svg);
}

function render() {
  const service = selectedService();
  const offence = selectedOffence();
  if (!service || !offence) {
    finding.textContent = service
      ? "Choose an offence group. The list comes from the extract, not from the starter shortcuts."
      : "Type a police service. Any service in the StatCan extract works, not only the shortcuts.";
    clear(rows);
    clear(chart);
    return;
  }
  const points = pointsFor(state.sheet, service.id, offence.id);
  const bc = bcService();
  const bcPoints = bc ? pointsFor(state.sheet, bc.id, offence.id) : [];
  const { latest, previous } = publishedEnds(points);
  const bcLatest = bcPoints.find((point) => latest && point.year === latest.year);
  finding.textContent = `${describe(service.name, offence.name, latest, previous, bcLatest ? bcLatest.rate : null)} The extract was saved ${formatWhen(state.sheet.retrieved)} and covers through ${state.sheet.years.at(-1)}.`;
  caption.textContent = `${shortService(service.name)} · ${offence.name}`;
  clear(rows);
  const recent = points.filter((point) => point.year >= (state.sheet.years.at(-1) - 14));
  for (const point of recent) {
    const bcPoint = bcPoints.find((item) => item.year === point.year);
    const tr = document.createElement("tr");
    const values = [
      String(point.year),
      formatCount(point.incidents) || "Not published",
      formatCount(point.rate) || "Not published",
      formatCount(bcPoint?.rate) || "Not published",
    ];
    values.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (index > 0 && value === "Not published") td.className = "missing";
      tr.append(td);
    });
    rows.append(tr);
  }
  drawChart(points);
  for (const button of presets.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", service.name.toLowerCase().includes(button.dataset.query.toLowerCase()) ? "true" : "false");
  }
  remember("service", serviceInput.value);
  remember("offence", offenceSelect.value);
}

async function main() {
  try {
    const [config, sheet] = await Promise.all([
      fetch(new URL("./config.json", import.meta.url)).then((response) => response.json()),
      fetch(new URL("./data/sheet.json", import.meta.url)).then((response) => response.json()),
    ]);
    state.config = config;
    state.sheet = sheet;
  } catch {
    finding.textContent = "The StatCan extract is not in this copy yet. A failed refresh does not replace a good file.";
    return;
  }
  clear(serviceList);
  for (const service of state.sheet.services || []) {
    const option = document.createElement("option");
    option.value = service.name;
    serviceList.append(option);
  }
  clear(offenceSelect);
  for (const offence of state.sheet.violations || []) {
    const option = document.createElement("option");
    option.value = offence.id;
    option.textContent = offence.name;
    offenceSelect.append(option);
  }
  for (const name of state.config.services || []) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.query = name;
    button.textContent = name
      .replace(", British Columbia, municipal", "")
      .replace(" [59]", "");
    button.addEventListener("click", () => {
      const found = findService(state.sheet.services, name);
      if (found) serviceInput.value = found.name;
      render();
    });
    presets.append(button);
  }
  const savedOffence = recall("offence");
  offenceSelect.value = [...offenceSelect.options].some((option) => option.value === savedOffence)
    ? savedOffence
    : (state.config.violation || offenceSelect.value);
  const savedService = recall("service");
  const initial = findService(state.sheet.services, savedService)
    || findService(state.sheet.services, state.config.services?.[0] || "Langley");
  if (initial) serviceInput.value = initial.name;
  serviceInput.addEventListener("input", render);
  serviceInput.addEventListener("change", render);
  offenceSelect.addEventListener("change", render);
  render();
}

main();
