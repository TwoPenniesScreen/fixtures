import { renderScreen } from "./fixture-core.js";
import { fitOfferCanvas, normaliseOffer, renderOfferScreen } from "./offer-core.js";

const $ = selector => document.querySelector(selector);
let data = { fixtures: [], updatedAt: null };
let offer = normaliseOffer();
let offerPreviewMode = "normal";
let password = "";
let afterUnlock = null;

const editor = $("#editor");
const form = $("#fixture-form");
const login = $("#login");
const shell = $("#admin-shell");
fitOfferCanvas($("#offer-preview"), $("#offer-preview-frame"));

async function request(method = "GET", body, requestedAction = "") {
  const actionName = method === "POST" && body?.action ? body.action : requestedAction;
  const action = actionName ? `?action=${encodeURIComponent(actionName)}` : "";
  const payload = body?.action ? undefined : body;
  const response = await fetch(`/api/fixtures${action}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(password ? { "X-Admin-Password": password } : {})
    },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store"
  });
  if (response.status === 401) throw new Error("UNAUTHORISED");
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Request failed");
  return response.json();
}

async function verifyPassword(candidate = "") {
  password = candidate;
  try { await request("POST"); }
  finally { password = ""; }
}
async function load() {
  [data, offer] = await Promise.all([request(), request("GET", undefined, "offer")]);
  draw();
  populateOfferForm();
}

function draw() {
  const list = $("#fixture-list");
  const sorted = [...data.fixtures].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  list.innerHTML = sorted.length ? sorted.map(f => `<article class="admin-fixture ${f.hidden ? "is-hidden" : ""}"><button class="fixture-edit" data-edit="${escapeHtml(f.id)}"><span class="admin-date">${escapeHtml(adminWhen(f))}${f.source === "calendar" ? " · TV calendar" : ""}</span><strong>${escapeHtml(f.venue === "away" ? f.opponent + " v Newcastle" : "Newcastle v " + f.opponent)}</strong><small>${escapeHtml(f.competition.replaceAll("-", " "))}${f.hidden ? " · hidden from screen" : ""}</small></button><button class="pin ${f.pinned ? "active" : ""}" data-pin="${escapeHtml(f.id)}" title="${f.pinned ? "Unpin" : "Feature this fixture"}" aria-label="${f.pinned ? "Unpin" : "Feature"} ${escapeHtml(f.opponent)}">★</button></article>`).join("") : `<div class="empty"><p>No fixtures yet.</p><button class="primary" data-add>Add the first fixture</button></div>`;
  const synced = data.calendar?.lastSyncedAt ? new Date(data.calendar.lastSyncedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "not synced yet";
  $("#calendar-state").textContent = `TV calendar: ${synced}`;
  renderScreen($("#preview"), data);
  renderOfferPreview();
}

function populateOfferForm() {
  const offerForm = $("#offer-form");
  offerForm.elements.enabled.checked = offer.enabled;
  offerForm.elements.price.value = offer.price;
  offerForm.elements.terms.value = offer.terms;
  offerForm.elements.beforeMinutes.value = offer.beforeMinutes;
  offerForm.elements.afterMinutes.value = offer.afterMinutes;
  renderOfferLogoBank();
  renderOfferPreview();
}

function offerFromForm() {
  const offerForm = $("#offer-form");
  return normaliseOffer({
    ...offer,
    enabled: offerForm.elements.enabled.checked,
    price: offerForm.elements.price.value,
    terms: offerForm.elements.terms.value,
    beforeMinutes: offerForm.elements.beforeMinutes.value,
    afterMinutes: offerForm.elements.afterMinutes.value
  });
}

function renderOfferPreview() {
  const target = $("#offer-preview");
  if (!target) return;
  const previewOffer = $("#offer-form") ? offerFromForm() : offer;
  renderOfferScreen(target, data.fixtures, previewOffer, new Date(), offerPreviewMode);
}

function renderOfferLogoBank() {
  const bank = $("#offer-logo-bank");
  bank.replaceChildren();
  for (const logo of offer.logos) {
    const card = document.createElement("article");
    card.className = `offer-logo-card ${logo.id === offer.selectedLogoId ? "active" : ""}`;
    const choose = document.createElement("button");
    choose.type = "button";
    choose.className = "offer-logo-choice";
    choose.dataset.logoSelect = logo.id;
    choose.innerHTML = `<img alt=""><strong></strong><span>${logo.id === offer.selectedLogoId ? "Selected" : "Use this"}</span>`;
    choose.querySelector("img").src = logo.src;
    choose.querySelector("img").alt = logo.name;
    choose.querySelector("strong").textContent = logo.name;
    card.append(choose);
    if (offer.logos.length > 1) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "offer-logo-remove";
      remove.dataset.logoRemove = logo.id;
      remove.textContent = "Remove";
      card.append(remove);
    }
    bank.append(card);
  }
}

async function readLogoFile(file) {
  if (!file) throw new Error("Choose a logo image first.");
  if (!/^image\/(png|webp|jpeg)$/.test(file.type)) throw new Error("Use a PNG, WebP or JPEG image.");
  if (file.size > 750_000) throw new Error("Keep the logo under 750 KB.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.readAsDataURL(file);
  });
}

function logoId(name) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "drink";
  let id = base;
  let suffix = 2;
  while (offer.logos.some(logo => logo.id === id)) id = `${base}-${suffix++}`;
  return id;
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value);
  return element.innerHTML;
}

function adminWhen(fixture) {
  if (fixture.dateMode !== "window") return `${fixture.date} · ${fixture.time || "TBC"}`;
  const date = new Date(`${fixture.date}T12:00:00`);
  const label = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  return `W/C ${label} · date and time TBC`;
}

function updateScheduleFields() {
  const isWindow = form.elements.dateMode.value === "window";
  $("#date-caption").textContent = isWindow ? "Week commencing" : "Date";
  $("#date-help").textContent = isWindow ? "First day of the playing window" : "Confirmed match date";
  $("#time-help").textContent = isWindow ? "Not required for a playing window" : "Leave blank for TBC";
  form.elements.time.disabled = isWindow;
  if (isWindow) form.elements.time.value = "";
}

function openEditor(fixture = {}) {
  form.reset();
  form.elements.id.value = fixture.id || "";
  $("#editor-title").textContent = fixture.id ? "Edit fixture" : "Add fixture";
  for (const [key, value] of Object.entries(fixture)) {
    if (!form.elements[key]) continue;
    if (form.elements[key].type === "checkbox") form.elements[key].checked = value;
    else form.elements[key].value = value;
  }
  updateScheduleFields();
  $("#delete").hidden = !fixture.id;
  $("#calendar-note").hidden = fixture.source !== "calendar";
  editor.showModal();
}

function showAdmin() {
  shell.hidden = false;
  if (login.open) login.close();
}

function showLogin(next = null) {
  afterUnlock = next;
  password = "";
  shell.hidden = true;
  $("#login-error").textContent = "";
  $("#login-form").reset();
  if (!login.open) login.showModal();
}

async function lockAdmin(next = null) {
  await request("DELETE").catch(() => {});
  showLogin(next);
}

async function save(next) {
  $("#save-state").textContent = "Saving…";
  try {
    data = await request("PUT", next);
    $("#save-state").textContent = "Saved";
    draw();
  } catch (error) {
    if (error.message === "UNAUTHORISED") return showLogin(() => save(next));
    $("#save-state").textContent = "Not saved";
    alert(error.message);
  }
}

$("#add").onclick = () => openEditor();
form.elements.dateMode.addEventListener("change", updateScheduleFields);
$("#sync").onclick = async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Syncing…";
  try {
    data = await request("POST", { action: "sync" });
    $("#save-state").textContent = "Calendar synced";
    draw();
  } catch (error) {
    if (error.message === "UNAUTHORISED") return showLogin(() => button.click());
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Sync TV calendar";
  }
};
$("#lock").onclick = () => lockAdmin();
$("#fixture-list").onclick = async event => {
  const add = event.target.closest("[data-add]");
  if (add) return openEditor();
  const edit = event.target.closest("[data-edit]");
  if (edit) return openEditor(data.fixtures.find(f => f.id === edit.dataset.edit));
  const pin = event.target.closest("[data-pin]");
  if (pin) {
    const fixtures = data.fixtures.map(f => ({ ...f, pinned: f.id === pin.dataset.pin ? !f.pinned : false }));
    await save({ ...data, fixtures });
  }
};

$("#close").onclick = $("#cancel").onclick = () => editor.close();
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (event.submitter?.value !== "save") return;
  const values = Object.fromEntries(new FormData(form));
  values.hidden = form.elements.hidden.checked;
  values.dateMode = form.elements.dateMode.value;
  if (values.dateMode === "window") values.time = "";
  values.id ||= crypto.randomUUID();
  const existing = data.fixtures.find(f => f.id === values.id);
  values.pinned = existing?.pinned || false;
  const fixtures = existing ? data.fixtures.map(f => f.id === values.id ? values : f) : [...data.fixtures, values];
  editor.close();
  await save({ ...data, fixtures });
});

$("#delete").onclick = async () => {
  const id = form.elements.id.value;
  const fixture = data.fixtures.find(value => value.id === id);
  const message = fixture?.source === "calendar" ? "Delete this imported fixture permanently? Use ‘Hide this fixture’ if you may want it back later." : "Delete this fixture?";
  if (!confirm(message)) return;
  editor.close();
  await save({ ...data, fixtures: data.fixtures.filter(f => f.id !== id) });
};

$("#offer-form").addEventListener("input", renderOfferPreview);
$("#offer-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const state = $("#offer-save-state");
  state.textContent = "Saving…";
  try {
    offer = await request("PUT", offerFromForm(), "offer");
    populateOfferForm();
    state.textContent = "Saved";
  } catch (error) {
    if (error.message === "UNAUTHORISED") return showLogin(() => form.requestSubmit());
    state.textContent = "Not saved";
    alert(error.message);
  }
});

$("#offer-logo-bank").addEventListener("click", event => {
  const choose = event.target.closest("[data-logo-select]");
  if (choose) {
    offer = normaliseOffer({ ...offerFromForm(), logos: offer.logos, selectedLogoId: choose.dataset.logoSelect });
    renderOfferLogoBank();
    renderOfferPreview();
    return;
  }
  const remove = event.target.closest("[data-logo-remove]");
  if (!remove || offer.logos.length < 2) return;
  const logos = offer.logos.filter(logo => logo.id !== remove.dataset.logoRemove);
  offer = normaliseOffer({ ...offerFromForm(), logos, selectedLogoId: offer.selectedLogoId === remove.dataset.logoRemove ? logos[0].id : offer.selectedLogoId });
  renderOfferLogoBank();
  renderOfferPreview();
});

$("#offer-add-logo").onclick = async () => {
  const nameInput = $("#offer-logo-name");
  const fileInput = $("#offer-logo-file");
  const name = nameInput.value.trim();
  if (!name) return alert("Give the drink logo a name.");
  try {
    const dataUrl = await readLogoFile(fileInput.files[0]);
    const uploaded = await request("PUT", { dataUrl }, "logo");
    const existing = offer.logos.find(logo => logo.name.toLowerCase() === name.toLowerCase());
    if (!existing && offer.logos.length >= 12) throw new Error("The logo bank can hold up to 12 drinks.");
    const id = existing?.id || logoId(name);
    const logos = existing
      ? offer.logos.map(logo => logo.id === id ? { id, name, src: uploaded.src, originalSrc: uploaded.originalSrc, assetId: uploaded.id } : logo)
      : [...offer.logos, { id, name, src: uploaded.src, originalSrc: uploaded.originalSrc, assetId: uploaded.id }];
    offer = normaliseOffer({ ...offerFromForm(), logos, selectedLogoId: id });
    nameInput.value = "";
    fileInput.value = "";
    renderOfferLogoBank();
    renderOfferPreview();
  } catch (error) {
    alert(error.message);
  }
};

$("#offer-preview-toolbar").addEventListener("click", event => {
  const button = event.target.closest("[data-offer-preview]");
  if (!button) return;
  offerPreviewMode = button.dataset.offerPreview;
  for (const item of event.currentTarget.querySelectorAll("[data-offer-preview]")) item.classList.toggle("active", item === button);
  renderOfferPreview();
});

login.addEventListener("cancel", event => event.preventDefault());
$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const candidate = String(new FormData(event.currentTarget).get("password") || "");
  try {
    await verifyPassword(candidate);
    $("#login-error").textContent = "";
    showAdmin();
    const next = afterUnlock;
    afterUnlock = null;
    if (next) await next();
    else await load();
  } catch (error) {
    password = "";
    $("#login-error").textContent = error.message === "UNAUTHORISED" ? "That password was not accepted." : "The admin service is unavailable. Try again.";
  }
});

async function start() {
  try {
    await verifyPassword();
    showAdmin();
    await load();
  } catch {
    showLogin();
  }
}

start();
