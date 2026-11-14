// The tray: a wide panel above the bottom bar for charts and findings. Its tab strip is always
// in view. Choosing a tab opens the tray, and choosing it again closes it.
// Written with Claude Code (Anthropic) assistance.
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  DATA_CREDIT,
  LINE_FAMILIES,
  LightCurvePlot,
  OrbitView,
  SpectrumPlot,
  Timeline,
  actions,
  compass,
  formatDate,
  useStore,
} from "../../core";
import { ChangesPanel } from "../ChangesPanel";
import { FeaturesList } from "../FeaturesList";
import { layout, useLayout, type TrayTab } from "../layout";

const TABS: { id: TrayTab; label: string; hint: string; needsTarget: boolean }[] = [
  { id: "spectrum", label: "Spectrum", hint: "Brightness at each wavelength, and what it reveals", needsTarget: true },
  { id: "changes", label: "What changed", hint: "Find anything in the field that moved, brightened, or faded", needsTarget: true },
  { id: "brightness", label: "Brightness over time", hint: "Is the target getting brighter or fainter?", needsTarget: true },
  { id: "motion", label: "Motion", hint: "Measure how fast the target crosses the sky", needsTarget: true },
  { id: "timeline", label: "Timeline", hint: "When SPHEREx looked, and at which wavelength", needsTarget: true },
  { id: "telescopes", label: "Other telescopes", hint: "The same field seen by Canada's NEOSSat", needsTarget: true },
  { id: "spacecraft", label: "Spacecraft", hint: "Where SPHEREx is right now", needsTarget: false },
  { id: "about", label: "About", hint: "Who made this, where the data comes from, and how to cite it", needsTarget: false },
];

function SpectrumTab() {
  const settings = useStore((s) => s.spectrum);
  const count = useStore((s) => s.sequence.length);
  return (
    <section className="tab split" aria-label="Spectrum">
      <div className="plot"><SpectrumPlot /></div>
      <div className="side">
        <p className="muted">
          Brightness of the {settings.probe ? "selected spot" : "target"} at each wavelength. Dips and bumps reveal what it is made of. Click a point to see its image.
        </p>
        <div className="row wrap">
          <label className="check"><input type="checkbox" checked={settings.perVisit} onChange={(e) => actions.setSpectrum({ perVisit: e.target.checked })} /> Compare visits</label>
          <label className="check"><input type="checkbox" checked={settings.showPoints} onChange={(e) => actions.setSpectrum({ showPoints: e.target.checked })} /> Every measurement</label>
          <label className="check"><input type="checkbox" checked={settings.log} onChange={(e) => actions.setSpectrum({ log: e.target.checked })} /> Log scale</label>
          <label className="check"><input type="checkbox" checked={settings.showSurveys} onChange={(e) => actions.setSpectrum({ showSurveys: e.target.checked })} /> 2MASS and WISE</label>
        </div>
        <label>
          Measure
          <select value={settings.aperture === null ? "fit" : String(settings.aperture)} onChange={(e) => actions.setSpectrum({ aperture: e.target.value === "fit" ? null : Number(e.target.value) })}>
            <option value="fit">A point (best for stars)</option>
            <option value="8">A small circle, 8″</option>
            <option value="12">A circle, 12″</option>
            <option value="20">A wide circle, 20″</option>
            <option value="40">A very wide circle, 40″</option>
            {settings.aperture !== null && ![8, 12, 20, 40].includes(settings.aperture) && (
              <option value={String(settings.aperture)}>A circle, {settings.aperture.toFixed(0)}″</option>
            )}
          </select>
        </label>
        {settings.probe && <button onClick={() => actions.probe(null)}>Back to the target</button>}
        <label>
          Redshift {settings.redshift.toFixed(2)}
          <input type="range" min={0} max={8} step={0.01} value={settings.redshift} onChange={(e) => actions.setSpectrum({ redshift: Number(e.target.value) })} />
        </label>
        <p className="group">Mark where these would show</p>
        <div className="choices" aria-label="Mark features of">
          {LINE_FAMILIES.map((family) => (
            <button key={family.id} className={settings.families.includes(family.id) ? "on" : ""} aria-pressed={settings.families.includes(family.id)} title={family.about} onClick={() => actions.toggleFamily(family.id)}>
              {family.name}
            </button>
          ))}
        </div>
        <FeaturesList />
        <button onClick={() => actions.saveSpectrum()} disabled={!count}>Save spectrum table</button>
      </div>
    </section>
  );
}

function MotionTab() {
  const motion = useStore((s) => s.motion);
  const visits = useStore((s) => s.visits);
  const moving = useStore((s) => !!s.target?.moving);
  const [tried, setTried] = useState(false);
  if (moving) return <section className="tab" aria-label="Motion"><p className="muted">A solar system body is already followed image by image, from its orbit.</p></section>;
  if (visits.length < 2) return <section className="tab" aria-label="Motion"><p className="muted">SPHEREx has looked here during one visit only so far. Motion needs two.</p></section>;
  return (
    <section className="tab" aria-label="Motion">
      <p className="muted">Finds the source at the target in each visit and measures how fast it crosses the sky. Uses the detectors that are switched on.</p>
      <div className="row wrap">
        <button
          className="primary"
          onClick={() => {
            actions.measureMotion();
            setTried(true);
          }}
        >
          Measure motion
        </button>
      </div>
      {motion && (
        <>
          <p>
            <strong>{motion.speed.toFixed(2)} ± {motion.speedErr.toFixed(2)} arcseconds per year</strong>, toward the {compass(motion.angle)} (direction {motion.angle.toFixed(0)}°).
            {motion.speed < 3 * motion.speedErr && " That is too small to tell from standing still."}
          </p>
          {motion.catalog && <p className="muted">Catalog value: {motion.catalog.speed.toFixed(2)} arcseconds per year, direction {motion.catalog.angle.toFixed(0)}°.</p>}
          {motion.saturated && <p className="muted">This source is too bright for the detector (saturated), so its position is less certain.</p>}
          <p className="muted">{motion.points.map((p) => `${visits[p.season]?.label ?? "Visit"}: ${p.east.toFixed(1)}″ east, ${p.north.toFixed(1)}″ north`).join(". ")}.</p>
        </>
      )}
      {tried && !motion && <p className="problem">The source was not found in two visits. Try other detectors or a brighter source.</p>}
    </section>
  );
}

/** Up to `count` items taken evenly across a list, so a long run of one night does not fill the row. */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, i) => items[Math.round((i * (items.length - 1)) / (count - 1))]);
}

function TelescopesTab() {
  const partner = useStore((s) => s.partner);
  if (!partner) return <section className="tab" aria-label="Other telescopes"><p className="muted">Looking for images of this field from other telescopes.</p></section>;
  if (partner.count === 0) return <section className="tab" aria-label="Other telescopes"><p className="muted">{partner.mission} has no images of this field.</p></section>;
  return (
    <section className="tab" aria-label="Other telescopes">
      <p>
        <strong>Seen in visible light by {partner.mission}.</strong> {partner.agency}. {partner.count.toLocaleString("en-US")} images of this field
        {partner.first != null && partner.last != null && `, from ${formatDate(partner.first)} to ${formatDate(partner.last)}`}. Each covers 0.85 degrees.
      </p>
      <div className="thumbs">
        {spread(partner.images, 12).map((image) => (
          <a key={image.id} href={image.preview} target="_blank" rel="noreferrer" title={`Open the full picture from ${formatDate(image.mjd)}`}>
            <img src={image.thumbnail} alt={`NEOSSat image from ${formatDate(image.mjd)}`} loading="lazy" width={128} height={128} />
            <span>{formatDate(image.mjd)}</span>
          </a>
        ))}
      </div>
      <p className="muted">{partner.credit}</p>
    </section>
  );
}

function SpacecraftTab() {
  const info = useStore((s) => s.spacecraft);
  const now = useStore((s) => s.spacecraftNow);
  const newest = info?.archive?.newest;
  return (
    <section className="tab split" aria-label="The spacecraft">
      <div className="orbit"><OrbitView /></div>
      <div className="side">
        <p><strong>Where is SPHEREx right now?</strong></p>
        <p className="muted">The telescope circles the Earth from pole to pole about every 98 minutes, riding the line between day and night.</p>
        {now && (
          <p>
            Over latitude {now.latitude.toFixed(1)}°, longitude {now.longitude.toFixed(1)}°. {Math.round(now.altitude)} km up, moving at {now.speed.toFixed(2)} km per
            second. One lap takes {now.period.toFixed(1)} minutes. {now.sunlit ? "In sunlight." : "In the Earth's shadow."}
          </p>
        )}
        {info?.archive && (
          <p className="muted">
            {info.archive.exposures.toLocaleString("en-US")} exposures are public
            {newest != null && `. The newest is from ${formatDate(newest)}`}. Launched {info.launched}.
          </p>
        )}
        {info && info.recent.length > 0 && (
          <button
            onClick={() => {
              actions.flyTo(info.recent[0], 25);
              if (useLayout.getState().stage === "images") layout.setStage("map");
            }}
          >
            Show where the newest public image looked
          </button>
        )}
      </div>
    </section>
  );
}

const REPO = "https://github.com/mattsaund/SPHERExplorer";

/** Who made this, whose data it shows, and what it is not. */
function AboutTab() {
  const archive = useStore((s) => s.meta?.index);
  return (
    <section className="tab about" aria-label="About">
      <p>
        <strong>SPHERExplorer</strong> shows every public SPHEREx image of any place in the sky as a short film, with tools to see what moved, what changed
        brightness, and what the light is made of. Built by team Turing Complete (Matt and Austin) for the NASA Space Apps Challenge 2026, challenge
        "Planet X and SPHEREx".
      </p>
      <p>
        <strong>Not a NASA product.</strong> This is an independent team project. It is not an official NASA product and is not endorsed by NASA.
      </p>
      <p>
        <strong>Data.</strong> {DATA_CREDIT}. This tool makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of
        Reionization and Ices Explorer (SPHEREx), a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, funded by the
        National Aeronautics and Space Administration. It also uses the NASA/IPAC Infrared Science Archive.
        {archive && ` ${archive.exposures.toLocaleString("en-US")} exposures are indexed, from releases ${archive.releases.join(" and ").toUpperCase()}.`}
      </p>
      <p>
        <strong>Other sources.</strong> Object names and facts from SIMBAD (CDS, Strasbourg). Star positions from Gaia DR3 (ESA). Brightness from 2MASS and
        AllWISE through VizieR. Planets, asteroids, and comets from JPL Horizons and the Small-Body Database. Visible-light images from NEOSSat (Canadian
        Space Agency). Spacecraft position from CelesTrak. Sky map by Aladin Lite (CDS), with survey tiles served by IRSA.
      </p>
      <p>
        <strong>Made with SI.</strong> The team set the idea and the features. The code, tests, and documentation were written with Claude Code
        (Anthropic), a Super Intelligence (SI) tool, and are labeled as such.
      </p>
      <p>
        <a href={REPO} target="_blank" rel="noreferrer">Source code, methods, and every reference</a> (Apache License 2.0).{" "}
        <a href={`${REPO}/blob/main/docs/methods.md`} target="_blank" rel="noreferrer">How each result is computed and checked</a>.{" "}
        <a href={`${REPO}/blob/main/docs/embedding.md`} target="_blank" rel="noreferrer">Link to it or embed it in your page</a>.
      </p>
    </section>
  );
}

function Content({ tab }: { tab: TrayTab }) {
  if (tab === "spectrum") return <SpectrumTab />;
  if (tab === "changes") return <div className="tab"><ChangesPanel /></div>;
  if (tab === "brightness") {
    return (
      <section className="tab chart" aria-label="Brightness over time">
        <p className="muted">Is it getting brighter or fainter? Each point compares one image with the target's usual brightness at that wavelength.</p>
        <div className="plot"><LightCurvePlot /></div>
      </section>
    );
  }
  if (tab === "motion") return <MotionTab />;
  if (tab === "timeline") {
    return (
      <section className="tab chart" aria-label="Timeline">
        <p className="muted">Each dot is one image. On every visit the telescope steps the target through all its colors. Click a dot to see that image.</p>
        <div className="plot"><Timeline /></div>
      </section>
    );
  }
  if (tab === "telescopes") return <TelescopesTab />;
  if (tab === "about") return <AboutTab />;
  return <SpacecraftTab />;
}

export function Tray() {
  const open = useLayout((s) => s.tray);
  const height = useLayout((s) => s.trayHeight);
  const hasTarget = useStore((s) => s.target !== null);
  const drag = useRef<{ y: number; height: number } | null>(null);

  // Dragging the top edge of the tray makes it taller or shorter.
  function onDown(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = { y: event.clientY, height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current) layout.setTrayHeight(drag.current.height + (drag.current.y - event.clientY));
  }
  function onUp() {
    drag.current = null;
  }

  return (
    <div className={`tray ${open ? "open" : ""}`}>
      {open && <div className="tray-grip" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="separator" aria-orientation="horizontal" aria-label="Drag to resize the panel" />}
      <div className="tray-tabs" role="tablist" aria-label="Charts and findings">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={open === tab.id}
            className={open === tab.id ? "on" : ""}
            title={tab.hint}
            disabled={tab.needsTarget && !hasTarget}
            onClick={() => layout.toggleTray(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        {open && <button className="tray-close" onClick={() => layout.closeTray()} aria-label="Close the panel">Close</button>}
      </div>
      {open && (
        <div className="tray-body" style={{ height }} role="tabpanel">
          <Content tab={open} />
        </div>
      )}
    </div>
  );
}
