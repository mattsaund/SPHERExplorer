// Suggestions for the search box: what to offer as a person types. Local matches come at once
// from the list of well-known objects, recent searches, and typed coordinates. The server adds
// asteroids and comets by name, and says whether the typed text itself is a known name.
// Written with Claude Code (Anthropic) assistance.
import { formatDec, formatRa, parseCoordinates } from "./astro";
import { FAMOUS, NASA_TARGETS } from "./famous";

/** One row of the search box dropdown. */
export interface Suggestion {
  /** What to show, for example "Andromeda Galaxy (M 31)". */
  label: string;
  /** A few words about it, for example "Nearest large galaxy". */
  detail: string;
  /** What to pass to actions.search when the row is chosen. */
  query: string;
  /**
   * Where the row came from, for grouping or icons: a recent search, a NASA test target,
   * typed coordinates, a well-known object, a solar system body, or a name the lookup knows.
   */
  group: "recent" | "nasa" | "place" | "famous" | "solar" | "match";
}

/** A search a person ran before, kept in the browser. */
export interface Recent {
  label: string;
  query: string;
}

/** Most rows the dropdown shows. */
export const MAX_SUGGESTIONS = 9;
const MAX_RECENT = 8;
const SHOWN_RECENT = 4;
const STORE_KEY = "spherexplorer.recent";

/** Lower case, no accents or apostrophes, and single spaces in place of other punctuation. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9+.*]+/g, " ")
    .trim();
}

/**
 * How well some names match what was typed: 3 when a name starts with it, 2 when a word in a
 * name starts with it, 1 when it appears anywhere (three letters or more), 0 for no match.
 * Spaces are optional, so "m31" finds "M 31".
 */
export function matchScore(names: string[], typed: string): number {
  const text = fold(typed);
  if (!text) return 0;
  const tight = text.replace(/ /g, "");
  let best = 0;
  for (const name of names) {
    const folded = fold(name);
    if (!folded) continue;
    if (folded.startsWith(text) || folded.replace(/ /g, "").startsWith(tight)) return 3;
    if (folded.split(" ").some((word) => word.startsWith(text)) || folded.includes(" " + text)) best = Math.max(best, 2);
    else if (text.length >= 3 && folded.includes(text)) best = Math.max(best, 1);
  }
  return best;
}

/**
 * The well-known object that a typed name means, for names the catalogs do not hold. The
 * typed words must be found whole and in order in the object's label or its other names, so
 * "Pillars of Creation" means the Eagle Nebula. Very short text means nothing.
 * Returns [what to search for, what to call it], or null.
 */
export function famousMatch(typed: string): [string, string] | null {
  const text = fold(typed);
  if (text.length < 5) return null;
  for (const [query, label, , also] of FAMOUS) {
    if ([label, also].some((name) => ` ${fold(name)} `.includes(` ${text} `))) return [query, label];
  }
  return null;
}

/** Rows that need no network: recent searches, typed coordinates, and well-known objects. */
export function localSuggestions(typed: string, recent: Recent[]): Suggestion[] {
  const text = typed.trim();
  const rows: Suggestion[] = [];
  const add = (row: Suggestion) => {
    if (rows.length < MAX_SUGGESTIONS && !rows.some((other) => fold(other.query) === fold(row.query))) rows.push(row);
  };
  if (!text) {
    // Nothing typed yet: offer what was searched before, then NASA's test targets.
    for (const entry of recent.slice(0, SHOWN_RECENT)) add({ label: entry.label, detail: "Searched before", query: entry.query, group: "recent" });
    for (const [query, label, detail] of FAMOUS.slice(0, NASA_TARGETS)) add({ label, detail, query, group: "nasa" });
    return rows;
  }
  const position = parseCoordinates(text);
  if (position) add({ label: `${formatRa(position.ra)} ${formatDec(position.dec)}`, detail: "Go to these coordinates (J2000)", query: text, group: "place" });
  for (const entry of recent) {
    if (matchScore([entry.label, entry.query], text) >= 2) add({ label: entry.label, detail: "Searched before", query: entry.query, group: "recent" });
  }
  // Best matches first. Rows that match equally well keep the order of the list.
  const scored = FAMOUS.map((row, index) => ({ row, index, score: matchScore([row[1], row[0], row[3]], text) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  for (const { row, index } of scored) add({ label: row[1], detail: row[2], query: row[0], group: index < NASA_TARGETS ? "nasa" : /^(asteroid|comet) |^(Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|3I\/ATLAS)$/.test(row[0]) ? "solar" : "famous" });
  return rows;
}

/** Local rows followed by the server's, without repeats. */
export function mergeSuggestions(local: Suggestion[], remote: Suggestion[]): Suggestion[] {
  const rows = local.slice();
  for (const row of remote) {
    if (rows.length >= MAX_SUGGESTIONS) break;
    const same = (other: Suggestion) => fold(other.query) === fold(row.query) || fold(other.label) === fold(row.label);
    if (!rows.some(same)) rows.push(row);
  }
  return rows;
}

/** Recent searches, newest first. Empty when the browser does not allow storage. */
export function loadRecent(): Recent[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter((entry): entry is Recent => typeof entry?.label === "string" && typeof entry?.query === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Put a search at the top of the recent list. Returns the new list. */
export function rememberSearch(recent: Recent[], entry: Recent): Recent[] {
  const next = [entry, ...recent.filter((other) => fold(other.query) !== fold(entry.query) && fold(other.label) !== fold(entry.label))].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // Storage is off or full. The list still works for this visit.
  }
  return next;
}
