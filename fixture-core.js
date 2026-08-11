export const FALLBACK_DATA = { fixtures: [], updatedAt: null };

const COMPETITION_LOGOS = {
  "premier-league": "/assets/competitions/premier-league.png",
  "champions-league": "/assets/competitions/champions-league.png",
  "europa-league": "/assets/competitions/europa-league.png",
  "conference-league": "/assets/competitions/conference-league.png",
  "fa-cup": "/assets/competitions/fa-cup.png",
  "league-cup": "/assets/competitions/league-cup.png",
  "efl": "/assets/competitions/league-cup.png",
  "uefa-super-cup": "/assets/competitions/uefa-super-cup.png",
  "club-world-cup": "/assets/competitions/club-world-cup.png"
};

export function tidyName(name = "") {
  const aliases = {
    "newcastle united": "NEWCASTLE", "newcastle united fc": "NEWCASTLE",
    "tottenham hotspur": "TOTTENHAM", "tottenham hotspur fc": "TOTTENHAM",
    "afc bournemouth": "BOURNEMOUTH", "brighton and hove albion": "BRIGHTON",
    "brighton & hove albion": "BRIGHTON", "wolverhampton wanderers": "WOLVES",
    "manchester united": "MAN UTD", "manchester city": "MAN CITY",
    "nottingham forest": "NOTT'M FOREST", "west ham united": "WEST HAM"
  };
  const clean = String(name).trim().replace(/\s+fc$/i, "").replace(/\s+/g, " ");
  return (aliases[clean.toLowerCase()] || clean).toUpperCase();
}

export function kickoffOf(fixture) {
  if (fixture.dateMode === "window") return new Date(`${fixture.date}T00:00:00`);
  const time = fixture.time || "23:59";
  return new Date(`${fixture.date}T${time}:00`);
}

export function eligibleFixtures(fixtures, now = new Date()) {
  return fixtures.filter(f => {
    if (f.hidden || !f.date) return false;
    if (f.dateMode === "window") {
      const end = new Date(`${f.date}T00:00:00`);
      end.setDate(end.getDate() + 7);
      return end > now;
    }
    if (!f.time) return new Date(`${f.date}T23:59:59`) >= now;
    return kickoffOf(f).getTime() + 45 * 60 * 1000 > now.getTime();
  }).sort((a, b) => kickoffOf(a) - kickoffOf(b));
}

export function selectFixtures(fixtures, now = new Date()) {
  const eligible = eligibleFixtures(fixtures, now);
  const pinned = eligible.find(f => f.pinned);
  const featured = pinned || eligible[0] || null;
  return { featured, upcoming: eligible.filter(f => !featured || f.id !== featured.id).slice(0, 3) };
}

export function formatWhen(fixture) {
  const date = new Date(`${fixture.date}T12:00:00`);
  if (fixture.dateMode === "window") {
    const windowStart = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date).toUpperCase();
    return `W/C ${windowStart} TBC`;
  }
  if (!fixture.time) return "TBC";
  const bits = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date).replace(",", "").toUpperCase();
  return `${bits} ${fixture.time}`;
}

export function renderScreen(target, data, now = new Date()) {
  const { featured, upcoming } = selectFixtures(data.fixtures || [], now);
  if (!featured) {
    target.innerHTML = `<section class="fallback-message" aria-label="Every televised Toon game"><span>EVERY TELEVISED</span><strong>TOON GAME</strong></section>`;
    return;
  }
  target.innerHTML = `<section class="featured">${fixtureMarkup(featured, true)}</section><section class="upcoming count-${upcoming.length}">${upcoming.map(f => fixtureMarkup(f, false)).join("")}</section>`;
}

function fixtureMarkup(f, featured) {
  const teams = f.venue === "away" ? [tidyName(f.opponent), "NEWCASTLE"] : ["NEWCASTLE", tidyName(f.opponent)];
  const competition = escapeHtml(f.competition || "other");
  return `<article class="fixture ${featured ? "fixture-featured" : "fixture-small"}"><div class="teams"><strong>${escapeHtml(teams[0])}</strong><b>V</b><strong>${escapeHtml(teams[1])}</strong></div><div class="competition competition-${competition}" aria-label="${escapeHtml(competition.replaceAll("-", " "))}">${competitionLogo(f.competition)}</div><time>${formatWhen(f)}</time></article>`;
}

function competitionLogo(competition) {
  const src = COMPETITION_LOGOS[competition];
  return src ? `<img class="competition-logo" src="${src}" alt="">` : "";
}

function escapeHtml(value) { const d = document.createElement("div"); d.textContent = value; return d.innerHTML; }
