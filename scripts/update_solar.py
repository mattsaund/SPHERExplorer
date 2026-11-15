#!/usr/bin/env python3
# Rebuilds web/src/core/sky/solarBodies.ts: the orbit of every solar system body the sky map
# shows, as JPL Horizons has it on the day this is run, plus where JPL says each body will be
# a month later, which the tests use as the answer to check against.
# The browser moves each body along its orbit with Kepler's equation, so the map needs no
# service to place them. Run this again every few months to keep the orbits fresh:
#   python3 scripts/update_solar.py
# Written with Claude Code (Anthropic) assistance.

import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "src" / "core" / "sky" / "solarBodies.ts"
SBDB = "https://ssd-api.jpl.nasa.gov/sbdb.api"
HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
AGENT = "spherex-viewer/0.1"
CHECK_DAYS = 30  # how far past the orbits' date the check positions are

# Planets by their Horizons number. Each is the center of mass of the planet and its moons,
# which moves more smoothly than the planet itself. 3 is the Earth and Moon together.
MAJOR = [
    ("mercury", "Mercury", "Planet", "199", "The smallest planet, and the closest to the Sun."),
    ("venus", "Venus", "Planet", "299", "The hottest planet, wrapped in thick clouds."),
    ("mars", "Mars", "Planet", "4", "The red planet, with the largest volcano in the solar system."),
    ("jupiter", "Jupiter", "Planet", "5", "The largest planet, a gas giant with a storm wider than Earth."),
    ("saturn", "Saturn", "Planet", "6", "The ringed gas giant."),
    ("uranus", "Uranus", "Planet", "7", "An ice giant that spins on its side."),
    ("neptune", "Neptune", "Planet", "8", "The farthest planet, an ice giant with the fastest winds."),
    ("pluto", "Pluto", "Dwarf planet", "9", "A dwarf planet in the Kuiper belt, visited by New Horizons in 2015."),
]
EARTH = "3"

# Small bodies by the name JPL's Small-Body Database finds them under.
# (search text, kind, note). The display name comes from the database.
SMALL = [
    ("1", "Dwarf planet", "The largest object in the asteroid belt and the nearest dwarf planet. Visited by Dawn."),
    ("136199", "Dwarf planet", "A dwarf planet about as large as Pluto, far beyond it."),
    ("136108", "Dwarf planet", "A fast-spinning, egg-shaped dwarf planet with a ring."),
    ("136472", "Dwarf planet", "A dwarf planet in the Kuiper belt."),
    ("225088", "Likely dwarf planet", "A large body beyond Neptune, likely a dwarf planet."),
    ("50000", "Likely dwarf planet", "A large body beyond Neptune, likely a dwarf planet. It has a ring."),
    ("90377", "Likely dwarf planet", "One of the most distant known bodies, on a very long orbit."),
    ("90482", "Likely dwarf planet", "A large body beyond Neptune, likely a dwarf planet."),
    ("120347", "Likely dwarf planet", "A large body beyond Neptune, likely a dwarf planet."),
    ("4", "Asteroid", "The brightest asteroid. Visited by Dawn."),
    ("2", "Asteroid", "One of the largest asteroids in the main belt."),
    ("10", "Asteroid", "One of the largest asteroids in the main belt."),
    ("3", "Asteroid", "One of the largest asteroids in the main belt."),
    ("704", "Asteroid", "One of the largest asteroids in the main belt."),
    ("52", "Asteroid", "One of the largest asteroids in the main belt."),
    ("511", "Asteroid", "One of the largest asteroids in the main belt."),
    ("15", "Asteroid", "One of the largest asteroids in the main belt."),
    ("16", "Asteroid", "A metal-rich asteroid, the target of NASA's Psyche mission."),
    ("433", "Near-Earth asteroid", "The first asteroid to be orbited and landed on, by NEAR Shoemaker."),
    ("99942", "Near-Earth asteroid", "It passes close to Earth in April 2029."),
    ("101955", "Near-Earth asteroid", "Sampled by NASA's OSIRIS-REx."),
    ("162173", "Near-Earth asteroid", "Sampled by Japan's Hayabusa2."),
    ("1P", "Comet", "The most famous comet. It returns about every 76 years, next in 2061."),
    ("2P", "Comet", "The comet with the shortest known period, 3.3 years."),
    ("12P", "Comet", "It returns about every 71 years, and last came by in 2024."),
    ("67P", "Comet", "The comet that Rosetta orbited and landed on."),
    ("109P", "Comet", "The parent of the Perseid meteor shower."),
    ("29P", "Comet", "A comet beyond Jupiter, known for its outbursts."),
    ("3I", "Interstellar comet", "The third known visitor from another star, found in 2025."),
    ("2I", "Interstellar comet", "The second known visitor from another star, found in 2019."),
    ("1I", "Interstellar object", "The first known visitor from another star, found in 2017."),
]


# Fetch a page as text, with a few retries, since JPL sometimes takes a moment.
def fetch(url: str, params: dict) -> str:
    request = urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers={"User-Agent": AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read().decode()
        except Exception as error:  # noqa: BLE001
            last = error
            time.sleep(2 + 2 * attempt)
    raise RuntimeError(f"{url} did not answer: {last}")


def horizons(command: str, extra: dict) -> list[str]:
    """One Horizons table. Returns the cells of its first data row."""
    params = {"format": "text", "COMMAND": f"'{command}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "CSV_FORMAT": "'YES'"}
    params.update(extra)
    text = fetch(HORIZONS, params)
    block = re.search(r"\$\$SOE\n(.*?)\n\$\$EOE", text, re.S)
    if not block:
        raise RuntimeError(f"Horizons gave no table for {command}:\n{text[-600:]}")
    return [cell.strip() for cell in block.group(1).splitlines()[0].split(",")]


def orbit(command: str, jd: float) -> dict:
    """The orbit around the Sun on one date, in the plane of the ecliptic of J2000."""
    row = horizons(command, {
        "EPHEM_TYPE": "'ELEMENTS'", "CENTER": "'500@10'", "TLIST": f"'{jd}'",
        "REF_PLANE": "'ECLIPTIC'", "REF_SYSTEM": "'ICRF'", "OUT_UNITS": "'AU-D'", "TP_TYPE": "'ABSOLUTE'",
    })
    # JDTDB, date, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
    e, q, i, node, peri, tp, n = (float(value) for value in row[2:9])
    return {"e": e, "q": q, "i": i, "node": node, "peri": peri, "tp": tp, "n": n}


def place(command: str, jd: float) -> tuple[float, float]:
    """Where the body is in the sky from the center of the Earth: RA and Dec, J2000, in degrees."""
    row = horizons(command, {
        "EPHEM_TYPE": "'OBSERVER'", "CENTER": "'500@399'", "TLIST": f"'{jd}'",
        "QUANTITIES": "'1'", "ANG_FORMAT": "'DEG'", "CAL_FORMAT": "'JD'",
    })
    numbers = [float(cell) for cell in row[1:] if re.fullmatch(r"-?\d+\.\d+", cell)]
    return numbers[0], numbers[1]


# Fetch every orbit and every check position, then write the generated file.
def main() -> int:
    # Midnight UTC today, as a Julian date.
    jd = int(time.time() // 86400) + 2440587.5
    check = jd + CHECK_DAYS
    bodies = []
    answers = {}

    print("Earth")
    earth = orbit(EARTH, jd)
    for ident, name, kind, command, note in MAJOR:
        print(name)
        page = "dwarf-planets/pluto" if ident == "pluto" else ident
        bodies.append({"id": ident, "name": name, "kind": kind, "query": f"planet {name}", "url": f"https://science.nasa.gov/{page}/", "note": note, "orbit": orbit(command, jd)})
        answers[ident] = place(command, check)
    for search, kind, note in SMALL:
        data = json.loads(fetch(SBDB, {"sstr": search}))
        body = data["object"]
        comet = str(body.get("kind", "")).startswith("c")
        # Comets have one orbit solution per return. CAP picks the one closest to today.
        command = f"DES={body['des']}; CAP;" if comet else f"DES={body['spkid']};"
        full = re.sub(r"\s+", " ", body["fullname"]).strip()
        # "1 Ceres (A801 AA)" reads better as "Ceres". Comets keep their designation.
        short = re.sub(r"\s*\(.*\)$", "", full)
        name = short if comet else re.sub(r"^\d+\s+", "", short)
        if search in ("3I", "2I", "1I"):
            name = {"3I": "3I/ATLAS", "2I": "2I/Borisov", "1I": "1I/'Oumuamua"}[search]
        print(name)
        ident = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        prefix = "comet" if comet else "asteroid"
        bodies.append({
            "id": ident, "name": name, "kind": kind, "query": f"{prefix} {body['des']}",
            "url": "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=" + urllib.parse.quote(str(body["des"])),
            "note": note, "orbit": orbit(command, jd),
        })
        answers[ident] = place(command, check)
    print("Sun and Moon")
    answers["sun"] = place("10", check)
    answers["moon"] = place("301", check)

    stamp = time.strftime("%Y-%m-%d", time.gmtime((jd - 2440587.5) * 86400))
    lines = [
        "// Orbits of the solar system bodies shown on the sky map. Made by scripts/update_solar.py",
        f"// from JPL Horizons and the JPL Small-Body Database on {stamp}. Do not edit by hand.",
        "// Each orbit is the body's path around the Sun on that date (osculating elements, ecliptic",
        "// of J2000). It stays good to a fraction of a degree for months. Run the script to renew it.",
        "// Written with Claude Code (Anthropic) assistance.",
        'import type { SolarOrbit, SolarSource } from "./solar";',
        "",
        "/** The date the orbits belong to, as a Julian date. */",
        f"export const SOLAR_EPOCH = {jd};",
        "",
        "/** The Earth and Moon together, around the Sun. Everything is seen from here. */",
        f"export const EARTH_ORBIT: SolarOrbit = {json.dumps(earth)};",
        "",
        "export const SOLAR_BODIES: SolarSource[] = [",
    ]
    for body in bodies:
        lines.append("  " + json.dumps(body, ensure_ascii=False) + ",")
    lines += [
        "];",
        "",
        f"/** Where JPL Horizons puts each body {CHECK_DAYS} days after SOLAR_EPOCH, seen from the center of the Earth: [RA, Dec] in degrees, J2000. For the tests. */",
        f"export const SOLAR_CHECK = {{ jd: {check}, places: {json.dumps(answers)} as Record<string, [number, number]> }};",
        "",
    ]
    OUT.write_text("\n".join(lines))
    print(f"Wrote {OUT.relative_to(ROOT)} with {len(bodies)} bodies.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
