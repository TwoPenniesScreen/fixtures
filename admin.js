import { renderScreen } from "./fixture-core.js";

const $ = selector => document.querySelector(selector);
let data = { fixtures: [], updatedAt: null };
let password = "";
let afterUnlock = null;

const editor = $("#editor");
const form = $("#fixture-form");
const login = $("#login");
const shell = $("#admin-shell");

async function request(method = "GET", body) {
  const action = method === "POST" && body?.action ? `?action=${encodeURIComponent(body.action)}` : "";
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
async function load() { data = await request(); draw(); }

function draw() {
  const list = $("#fixture-list");
  const sorted = [...data.fixtures].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  list.innerHTML = sorted.length ? sorted.map(f => `<article class="admin-fixture ${f.hidden ? "is-hidden" : ""}"><button class="fixture-edit" data-edit="${escapeHtml(f.id)}"><span class="admin-date">${escapeHtml(f.date)} · ${escapeHtml(f.time || "TBC")}${f.source === "calendar" ? " · TV calendar" : ""}</span><strong>${escapeHtml(f.venue === "away" ? f.opponent + " v Newcastle" : "Newcastle v " + f.opponent)}</strong><small>${escapeHtml(f.competition.replaceAll("-", " "))}${f.hidden ? " · hidden from screen" : ""}</small></button><button class="pin ${f.pinned ? "active" : ""}" data-pin="${escapeHtml(f.id)}" title="${f.pinned ? "Unpin" : "Feature this fixture"}" aria-label="${f.pinned ? "Unpin" : "Feature"} ${escapeHtml(f.opponent)}">★</button></article>`).join("") : `<div class="empty"><p>No fixtures yet.</p><button class="primary" data-add>Add the first fixture</button></div>`;
  const synced = data.calendar?.lastSyncedAt ? new Date(data.calendar.lastSyncedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "not synced yet";
  $("#calendar-state").textContent = `TV calendar: ${synced}`;
  renderScreen($("#preview"), data);
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value);
  return element.innerHTML;
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
