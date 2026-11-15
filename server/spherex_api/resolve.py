# Turns an object name into a sky position with motion, through the Sesame name resolver
# (SIMBAD, NED, and VizieR behind one door). CDS mirrors are tried in order, because the
# main CDS site has been unreliable. The five NASA test targets resolve even with no network.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import re
import urllib.parse
import warnings
import xml.etree.ElementTree as ElementTree

import astropy.units as u
from astropy.coordinates import SkyCoord
from astropy.time import Time

from . import cache, distance, net

# The SIMBAD page of one object: identifiers, measurements, and every paper that mentions it.
SIMBAD_PAGE = "https://simbad.cfa.harvard.edu/simbad/sim-id?Ident="

# Sesame endpoints, fastest and most reliable first.
SESAME = (
    "https://vizier.cfa.harvard.edu/viz-bin/nph-sesame/-oxp/SNV?",
    "https://vizier.idia.ac.za/viz-bin/nph-sesame/-oxp/SNV?",
    "https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?",
)

# Positions are reported at this epoch, close to the SPHEREx data, so the browser
# only has to carry motion across a year or two.
REFERENCE_EPOCH = 2026.0

# SIMBAD object type codes in plain words.
KINDS = {
    "*": "Star", "**": "Double star", "PM*": "Fast-moving star", "BD*": "Brown dwarf", "LM*": "Low-mass star",
    "WD*": "White dwarf", "N*": "Neutron star", "Psr": "Pulsar", "BH": "Black hole", "BH?": "Black hole candidate",
    "V*": "Variable star", "Mi*": "Pulsating red giant (Mira variable)", "LP*": "Long-period variable star",
    "Ce*": "Cepheid variable star", "RR*": "RR Lyrae variable star", "BY*": "Spotted variable star",
    "Er*": "Flare star", "Ir*": "Irregular variable star", "Or*": "Young variable star",
    "TT*": "Young star (T Tauri)", "Y*O": "Young star still forming", "Ae*": "Young star (Herbig Ae/Be)",
    "Em*": "Emission-line star", "Be*": "Be star", "C*": "Carbon star", "S*": "S-type star",
    "RG*": "Red giant", "AB*": "Evolved giant (AGB star)", "s*r": "Red supergiant", "s*b": "Blue supergiant",
    "sg*": "Supergiant", "WR*": "Wolf-Rayet star", "HB*": "Horizontal-branch star", "pA*": "Post-AGB star",
    "SB*": "Spectroscopic binary", "EB*": "Eclipsing binary", "XB*": "X-ray binary", "HXB": "High-mass X-ray binary",
    "LXB": "Low-mass X-ray binary", "CV*": "Cataclysmic variable", "No*": "Nova", "SN*": "Supernova",
    "Pl": "Planet", "Pl?": "Planet candidate",
    "PN": "Planetary nebula", "SNR": "Supernova remnant", "HII": "Glowing gas cloud (H II region)",
    "MoC": "Molecular cloud", "DNe": "Dark nebula", "RNe": "Reflection nebula", "Cld": "Interstellar cloud",
    "SFR": "Star-forming region", "ISM": "Interstellar matter", "HH": "Jet from a young star",
    "OpC": "Open star cluster", "GlC": "Globular star cluster", "Cl*": "Star cluster", "As*": "Stellar association",
    "G": "Galaxy", "GiG": "Galaxy in a group", "GiC": "Galaxy in a cluster", "GiP": "Galaxy in a pair",
    "BiC": "Brightest cluster galaxy", "IG": "Interacting galaxies", "PaG": "Pair of galaxies",
    "GrG": "Group of galaxies", "ClG": "Cluster of galaxies", "SCG": "Supercluster of galaxies",
    "SBG": "Starburst galaxy", "EmG": "Emission-line galaxy", "H2G": "Star-forming galaxy", "LSB": "Faint diffuse galaxy",
    "rG": "Radio galaxy", "AGN": "Galaxy with an active black hole", "Sy1": "Seyfert galaxy (active black hole)",
    "Sy2": "Seyfert galaxy (active black hole)", "SyG": "Seyfert galaxy (active black hole)",
    "LIN": "Galaxy with a mildly active nucleus", "QSO": "Quasar", "BLL": "Blazar", "Bla": "Blazar",
    "gLe": "Gravitational lens", "IR": "Infrared source", "NIR": "Near-infrared source", "X": "X-ray source",
    "Rad": "Radio source",
    "dS*": "Pulsating star (Delta Scuti)", "RS*": "Active binary star", "a2*": "Magnetic variable star",
    "bC*": "Pulsating hot star (Beta Cephei)", "gD*": "Pulsating star (Gamma Doradus)", "SX*": "Pulsating star (SX Phoenicis)",
    "RV*": "Pulsating supergiant (RV Tauri)", "WV*": "Pulsating star (W Virginis)", "cC*": "Cepheid variable star",
    "Pu*": "Pulsating star", "Ro*": "Rotating variable star", "El*": "Ellipsoidal variable star",
    "HV*": "High-velocity star", "HS*": "Hot subdwarf star", "MS*": "Main-sequence star", "Ma*": "Massive star",
    "Ev*": "Evolved star", "Sy*": "Symbiotic star", "RC*": "R Coronae Borealis variable star",
    "bL*": "Eclipsing binary", "WU*": "Contact binary", "Al*": "Eclipsing binary (Algol type)",
    "smm": "Submillimeter source", "FIR": "Far-infrared source", "MIR": "Mid-infrared source",
    "gam": "Gamma-ray source", "gB": "Gamma-ray burst", "Mas": "Maser", "Opt": "Optical source", "UV": "Ultraviolet source",
}


def kind_of(code: str) -> str | None:
    """Plain words for a SIMBAD type code, with a general fallback for rare codes."""
    if not code:
        return None
    if code in KINDS:
        return KINDS[code]
    if code.endswith("*"):
        return "Star"
    if code.endswith("G") or code.startswith("G"):
        return "Galaxy"
    return "Astronomical object"

# The NASA test targets at epoch 2026.0, with the spellings people are likely to type.
BUILT_IN = [
    (("barnardsstar", "barnardstar", "barnard", "gj699", "gl699"),
     {"name": "Barnard's Star", "ra": 269.446267, "dec": 4.768222, "pmRa": -801.551, "pmDec": 10362.394, "parallax": 546.976, "kind": "Fast-moving star", "simbad": "NAME Barnard's star"}),
    (("epsilonindib", "epsindb", "epsindib", "epsilonindb", "epsindiba"),
     {"name": "Epsilon Indi B", "ra": 331.096656, "dec": -56.800664, "pmRa": 3981.977, "pmDec": -2466.832, "parallax": 274.843, "kind": "Brown dwarf", "simbad": "* eps Ind B"}),
    (("wise0855", "wise08550714", "wisej08550714", "wise0855071442", "wisej085510.83071442.5", "wiseaj085510.74071442.5", "w0855"),
     {"name": "WISE 0855-0714", "ra": 133.759765, "dec": -7.242182, "pmRa": -8123.7, "pmDec": 673.2, "parallax": 439.0, "kind": "Brown dwarf", "simbad": "WISEA J085510.74-071442.5"}),
    (("rwaurigae", "rwaur", "rwaura"),
     {"name": "RW Aurigae", "ra": 76.956083, "dec": 30.401139, "kind": "Young star (T Tauri)", "simbad": "V* RW Aur"}),
    (("rdraconis", "rdra"),
     {"name": "R Draconis", "ra": 248.167233, "dec": 66.755024, "kind": "Pulsating red giant (Mira variable)", "simbad": "V* R Dra"}),
]

_memory: dict[str, dict | None] = {}


def normalize(name: str) -> str:
    """Lowercase with spaces and punctuation removed, for matching and cache keys."""
    return re.sub(r"[\s'’`_,+\-]+", "", name.strip().lower())


def propagate(ra, dec, pm_ra, pm_dec, from_year=2000.0, to_year=REFERENCE_EPOCH):
    """Carry a position from one epoch to another along its proper motion. Returns (ra, dec, pm_ra, pm_dec).

    SIMBAD lists Gaia proper motions with positions already carried back to J2000 along that
    same motion. Moving forward the same way lands on the Gaia position. Adding a radial-velocity
    term here would count the perspective change twice (0.4 arcsec for Barnard's Star).
    """
    if not pm_ra and not pm_dec:
        return ra, dec, pm_ra, pm_dec
    start = SkyCoord(
        ra=ra * u.deg,
        dec=dec * u.deg,
        pm_ra_cosdec=(pm_ra or 0.0) * u.mas / u.yr,
        pm_dec=(pm_dec or 0.0) * u.mas / u.yr,
        obstime=Time(from_year, format="jyear"),
        frame="icrs",
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # ERFA notes that no distance was given, which is intended
        moved = start.apply_space_motion(new_obstime=Time(to_year, format="jyear"))
    return (
        float(moved.ra.deg),
        float(moved.dec.deg),
        float(moved.pm_ra_cosdec.to_value(u.mas / u.yr)),
        float(moved.pm_dec.to_value(u.mas / u.yr)),
    )


# A number from one field of the Sesame answer, or None when it is missing.
def _number(node, path: str):
    found = node.find(path)
    try:
        return float(found.text) if found is not None and found.text else None
    except ValueError:
        return None


def parse_sesame(text: str) -> dict | None:
    """Pull the first resolved position out of a Sesame XML answer."""
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError:
        return None
    for resolver in root.iter("Resolver"):
        ra = _number(resolver, "jradeg")
        dec = _number(resolver, "jdedeg")
        if ra is None or dec is None:
            continue
        code = (resolver.findtext("otype") or "").strip()
        service = (resolver.get("name") or "").split("=", 1)[-1].split(" ", 1)[0]
        oid = _number(resolver, "oid")
        return {
            "name": (resolver.findtext("oname") or "").strip() or None,
            "oid": int(oid) if oid is not None else None,
            "ra": ra,
            "dec": dec,
            "pmRa": _number(resolver, "pm/pmRA"),
            "pmDec": _number(resolver, "pm/pmDE"),
            "parallax": _number(resolver, "plx/v"),
            "parallaxError": _number(resolver, "plx/e"),
            "velocity": _number(resolver, "Vel/v"),
            "redshift": _number(resolver, "z/v"),
            "kind": kind_of(code),
            "spectralType": (resolver.findtext("spType") or "").strip() or None,
            "source": service or "Sesame",
        }
    return None


# Ask one Sesame mirror for a name. None when it does not know the name.
async def _ask(base: str, name: str) -> dict | None:
    response = await net.client().get(base + urllib.parse.quote(name), timeout=8)
    response.raise_for_status()
    return parse_sesame(response.text)


def _finish(found: dict, asked: str) -> dict:
    """Move a J2000 catalog position to the reference epoch and shape the answer."""
    ra, dec, pm_ra, pm_dec = propagate(found["ra"], found["dec"], found["pmRa"], found["pmDec"])
    return {
        "name": _tidy(found["name"]) if found["name"] else asked.strip(),
        "ra": ra,
        "dec": dec,
        "epoch": REFERENCE_EPOCH,
        "pmRa": pm_ra,
        "pmDec": pm_dec,
        "parallax": found["parallax"],
        "kind": found["kind"],
        "spectralType": found.get("spectralType"),
        "source": found["source"],
        # The page that lists everything known about the object.
        "url": SIMBAD_PAGE + urllib.parse.quote(found["name"]) if found["name"] else None,
        # Where catalogs list the object, for reference.
        "raJ2000": found["ra"],
        "decJ2000": found["dec"],
    }


def _tidy(name: str) -> str:
    """Drop SIMBAD's padding and prefixes ("* eps Ind B", "NAME Barnard's star", "M  31")."""
    name = re.sub(r"\s+", " ", name).strip()
    for prefix in ("NAME ", "* ", "V* ", "EM* ", "** "):
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


# A target from the short list kept in the code, so NASA's test targets resolve without any service.
def built_in(name: str) -> dict | None:
    token = normalize(name)
    for aliases, target in BUILT_IN:
        # Match the spellings people type, and the name SIMBAD itself uses.
        if token in aliases or token == normalize(target["simbad"]):
            facts = {key: value for key, value in target.items() if key != "simbad"}
            return {
                "epoch": REFERENCE_EPOCH,
                "source": "Built in",
                "simbadId": target["simbad"],
                "url": SIMBAD_PAGE + urllib.parse.quote(target["simbad"]),
                "distance": distance.from_parallax(target.get("parallax")),
                **facts,
            }
    return None


async def _distance_from_simbad(simbad_id: str) -> dict | None:
    """Look up the distance of an object by its SIMBAD name. Used when the built-in table has none."""
    for base in SESAME:
        try:
            found = await _ask(base, simbad_id)
        except Exception:  # noqa: BLE001 (try the next mirror)
            continue
        if found:
            return await distance.best(found["parallax"], found["parallaxError"], found["redshift"], found["velocity"], found["oid"])
        return None
    return None


async def resolve(name: str) -> dict | None:
    """Find an object by name. Returns None when no resolver knows it."""
    token = normalize(name)
    if not token:
        return None
    if token in _memory:
        return _memory[token]
    stored = cache.load_json("resolve", token)
    if stored:
        _memory[token] = stored
        return stored

    # The NASA test targets use vetted positions. SIMBAD lists some fast movers (WISE 0855 among
    # them) at the epoch they were observed, not at J2000, so its position can't be carried forward blindly.
    answer = built_in(name)
    if answer is not None and answer["distance"] is None:
        answer["distance"] = await _distance_from_simbad(answer["simbadId"])
    reached = False
    for base in SESAME if answer is None else ():
        try:
            found = await _ask(base, name)
            reached = True
        except Exception:  # noqa: BLE001 (try the next mirror)
            continue
        if found:
            answer = _finish(found, name)
            answer["distance"] = await distance.best(
                found["parallax"], found["parallaxError"], found["redshift"], found["velocity"], found["oid"],
            )
        break  # a mirror answered, found or not
    if answer is not None:
        _memory[token] = answer
        cache.save_json("resolve", token, answer)
    elif reached:
        _memory[token] = None  # a real "not found", worth remembering for this run
    return answer


async def warm() -> None:
    """Resolve nothing, but make sure Astropy's time and coordinate machinery is loaded."""
    await asyncio.to_thread(propagate, 10.0, 10.0, 100.0, 100.0)
