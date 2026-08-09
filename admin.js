import { renderScreen } from "./fixture-core.js";

const $ = s => document.querySelector(s);
let data = { fixtures: [], updatedAt: null };
let password = sessionStorage.getItem("fixtures-admin-password") || "";
const editor = $("#editor"), form = $("#fixture-form"), login = $("#login");

async function request(method = "GET", body) {
  const response = await fetch("/api/fixtures", { method, headers: { "Content-Type": "application/json", ...(password ? { Authorization: `Bearer ${password}` } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  if (response.status === 401) throw new Error("UNAUTHORISED");
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Request failed");
  return response.json();
}

async function load() { data = await request(); draw(); }
function draw() {
  const list = $("#fixture-list");
  const sorted = [...data.fixtures].sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  list.innerHTML = sorted.length ? sorted.map(f => `<article class="admin-fixture ${f.hidden ? "is-hidden" : ""}"><button class="fixture-edit" data-edit="${escapeHtml(f.id)}"><span class="admin-date">${escapeHtml(f.date)} · ${escapeHtml(f.time || "TBC")}</span><strong>${escapeHtml(f.venue === "away" ? f.opponent + " v Newcastle" : "Newcastle v " + f.opponent)}</strong><small>${escapeHtml(f.competition.replaceAll("-", " "))}${f.hidden ? " · hidden" : ""}</small></button><button class="pin ${f.pinned ? "active" : ""}" data-pin="${escapeHtml(f.id)}" title="${f.pinned ? "Unpin" : "Feature this fixture"}">★</button></article>`).join("") : `<div class="empty"><p>No fixtures yet.</p><button class="primary" data-add>Add the first fixture</button></div>`;
  renderScreen($("#preview"), data);
}
function escapeHtml(value) { const element = document.createElement("div"); element.textContent = String(value); return element.innerHTML; }

function openEditor(fixture = {}) {
  form.reset();
  $("#editor-title").textContent = fixture.id ? "Edit fixture" : "Add fixture";
  for (const [key, value] of Object.entries(fixture)) if (form.elements[key]) form.elements[key].type === "checkbox" ? form.elements[key].checked = value : form.elements[key].value = value;
  $("#delete").hidden = !fixture.id;
  editor.showModal();
}

async function save(next) {
  $("#save-state").textContent = "Saving…";
  try { data = await request("PUT", next); $("#save-state").textContent = "Saved"; draw(); }
  catch (e) { if (e.message === "UNAUTHORISED") return unlock(() => save(next)); alert(e.message); }
}
function unlock(after) { login.showModal(); login.dataset.after = after ? "yes" : ""; window.afterLogin = after; }

$("#add").onclick = () => openEditor();
$("#fixture-list").onclick = async e => {
  const add = e.target.closest("[data-add]"); if (add) return openEditor();
  const edit = e.target.closest("[data-edit]"); if (edit) return openEditor(data.fixtures.find(f => f.id === edit.dataset.edit));
  const pin = e.target.closest("[data-pin]"); if (pin) { const fixtures = data.fixtures.map(f => ({...f, pinned: f.id === pin.dataset.pin ? !f.pinned : false})); await save({...data, fixtures}); }
};
$("#close").onclick = $("#cancel").onclick = () => editor.close();
form.addEventListener("submit", async e => {
  e.preventDefault(); if (e.submitter?.value !== "save") return;
  const values = Object.fromEntries(new FormData(form)); values.hidden = form.elements.hidden.checked; values.id ||= crypto.randomUUID();
  const existing = data.fixtures.find(f => f.id === values.id); values.pinned = existing?.pinned || false;
  const fixtures = existing ? data.fixtures.map(f => f.id === values.id ? values : f) : [...data.fixtures, values];
  editor.close(); await save({...data, fixtures});
});
$("#delete").onclick = async () => { if (!confirm("Delete this fixture?")) return; const id = form.elements.id.value; editor.close(); await save({...data, fixtures: data.fixtures.filter(f => f.id !== id)}); };
$("#login-form").addEventListener("submit", async e => { e.preventDefault(); password = new FormData(e.currentTarget).get("password"); sessionStorage.setItem("fixtures-admin-password", password); try { await request("PUT", data); login.close(); $("#login-error").textContent = ""; if (window.afterLogin) window.afterLogin(); } catch { $("#login-error").textContent = "That password was not accepted."; } });

load().catch(e => alert(e.message));
