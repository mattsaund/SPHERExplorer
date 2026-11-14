// The tools in the bottom dock, one per tab. To add a tool, write its component and add one entry to TOOLS.
// Written with Claude Code (Anthropic) assistance.
import { useState, type ComponentType, type ReactNode } from "react";
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
  spectrumTrust,
  useStore,
} from "../core";
import { ChangesPanel } from "./ChangesPanel";
import { copyText } from "./copy";
import { FeaturesList } from "./FeaturesList";

export interface ToolProps {
  /** Bring the sky map to the front, for tools that move the map. */
  showMap(): void;
  /** Bring the images to the front, for tools that start studying a new target. */
  showImages(): void;
}

function NoTarget({ then }: { then: string }) {
  return <p className="muted">Pick a target first, with the Find box or the Examples. {then}</p>;
}

/** Tools about the current target say so when there is none yet. */
function NeedsTarget({ children, then }: { children: ReactNode; then: string }) {
  const hasTarget = useStore((s) => s.target !== null);
  return hasTarget ? <>{children}</> : <NoTarget then={then} />;
}

function Spectrum() {
  const settings = useStore((s) => s.spectrum);
  // Most measurements untrusted means the source is too bright for the detector.
  const tooBright = useStore((s) => s.framesState === "ready" && !s.spectrum.halo && !s.target?.moving && s.loaded > 20 && spectrumTrust(s) < 0.6);
  const measure = settings.halo ? "halo" : settings.aperture === null ? "fit" : String(settings.aperture);
  return (
    <NeedsTarget then="Its spectrum appears here.">
      <div className="tool split">
        <div className="tool-main">
          <p className="muted">
            Brightness of the {settings.probe ? "selected spot" : "target"} at each wavelength. Dips and bumps reveal what it is made of. Click a point to see its image.
          </p>
          {tooBright && (
            <p className="hint">
              This source is too bright for the detector in most images, so its spectrum has gaps.{" "}
              <button onClick={() => actions.setSpectrum({ halo: true })}>Measure its halo instead</button>
            </p>
          )}
          {settings.halo && (
            <p className="hint">
              Measuring the ring of light around the source. This is a rough measure, best for changes over time and for wide dips. Its overall level is only
              the halo's, so it reads lower than the star's true brightness.
            </p>
          )}
          <div className="plot"><SpectrumPlot /></div>
        </div>
        <div className="tool-side">
          <FeaturesList />
          <p className="side-heading">Plot settings</p>
          <label className="check"><input type="checkbox" checked={settings.perVisit} onChange={(e) => actions.setSpectrum({ perVisit: e.target.checked })} /> Compare visits</label>
          <label className="check"><input type="checkbox" checked={settings.showPoints} onChange={(e) => actions.setSpectrum({ showPoints: e.target.checked })} /> Every measurement</label>
          <label className="check"><input type="checkbox" checked={settings.log} onChange={(e) => actions.setSpectrum({ log: e.target.checked })} /> Log scale</label>
          <label className="check"><input type="checkbox" checked={settings.showSurveys} onChange={(e) => actions.setSpectrum({ showSurveys: e.target.checked })} /> 2MASS and WISE</label>
          <label className="field">
            <span>Measure</span>
            <select
              value={measure}
              onChange={(e) => actions.setSpectrum(e.target.value === "halo" ? { halo: true } : { halo: false, aperture: e.target.value === "fit" ? null : Number(e.target.value) })}
            >
              <option value="fit">A point (best for stars)</option>
              <option value="8">A small circle, 8″</option>
              <option value="12">A circle, 12″</option>
              <option value="20">A wide circle, 20″</option>
              <option value="40">A very wide circle, 40″</option>
              <option value="halo">The halo, for a star too bright for the detector</option>
              {/* The circle can also be resized by dragging its edge on the image, so its size joins the list. */}
              {settings.aperture !== null && ![8, 12, 20, 40].includes(settings.aperture) && (
                <option value={String(settings.aperture)}>A circle, {settings.aperture.toFixed(0)}″</option>
              )}
            </select>
          </label>
          {settings.probe && <button onClick={() => actions.probe(null)}>Back to the target</button>}
          <label className="field">
            <span>Redshift <output>{settings.redshift.toFixed(2)}</output></span>
            <input type="range" min={0} max={8} step={0.01} value={settings.redshift} onChange={(e) => actions.setSpectrum({ redshift: Number(e.target.value) })} />
          </label>
          <p className="side-heading">Mark features of</p>
          <div className="chips" aria-label="Mark features of">
            {LINE_FAMILIES.map((family) => (
              <button key={family.id} className={settings.families.includes(family.id) ? "on" : ""} aria-pressed={settings.families.includes(family.id)} title={family.about} onClick={() => actions.toggleFamily(family.id)}>
                {family.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </NeedsTarget>
  );
}

/** Everything in the field that moved, brightened, or faded. "Show" brings the images forward. */
function Changes({ showImages }: ToolProps) {
  return (
    <NeedsTarget then="Anything in its field that moved or changed brightness is listed here.">
      <div className="tool"><ChangesPanel onShow={showImages} /></div>
    </NeedsTarget>
  );
}

function Motion() {
  const motion = useStore((s) => s.motion);
  const visits = useStore((s) => s.visits);
  const moving = useStore((s) => !!s.target?.moving);
  const session = useStore((s) => s.session);
  // Remember which load the button was pressed for, so a new target starts clean.
  const [triedIn, setTriedIn] = useState<number | null>(null);
  const tried = triedIn === session;
  let blocked: string | null = null;
  if (moving) blocked = "Motion is measured for stars and other targets outside the solar system. Planets, asteroids, and comets are already followed along their path.";
  else if (visits.length < 2) blocked = "Motion needs images from at least two visits. This target has fewer so far.";
  return (
    <NeedsTarget then="Its motion can be measured here.">
      <div className="tool">
        <h2>Is it moving?</h2>
        <p className="muted">Finds the source in each visit and measures how fast it crosses the sky. Uses the detectors that are switched on.</p>
        {blocked ? (
          <p>{blocked}</p>
        ) : (
          <>
            <div className="row wrap">
              <button className="primary" onClick={() => { actions.measureMotion(); setTriedIn(session); }}>Measure motion</button>
            </div>
            {motion && (
              <>
                <p>
                  <strong>{motion.speed.toFixed(2)} ± {motion.speedErr.toFixed(2)} arcseconds per year</strong>, toward the {compass(motion.angle)} (direction {motion.angle.toFixed(0)}°).
                  {motion.speed < 3 * motion.speedErr && " That is too small to tell from standing still."}
                </p>
                {motion.catalog && (
                  <p className="muted">Catalog value: {motion.catalog.speed.toFixed(2)} arcseconds per year, direction {motion.catalog.angle.toFixed(0)}°.</p>
                )}
                {motion.saturated && <p className="muted">This source is too bright for the detector (saturated), so its position is less certain.</p>}
                <p className="muted">
                  {motion.points.map((p) => `${visits[p.season]?.label ?? "Visit"}: ${p.east.toFixed(1)}″ east, ${p.north.toFixed(1)}″ north`).join(". ")}.
                </p>
              </>
            )}
            {tried && !motion && <p className="problem">The source was not found in two visits. Try other detectors or a brighter source.</p>}
          </>
        )}
      </div>
    </NeedsTarget>
  );
}

function Brightness() {
  return (
    <NeedsTarget then="Its brightness over time appears here.">
      <div className="tool">
        <p className="muted">Is it getting brighter or fainter? Each point compares one image with the target's usual brightness at that wavelength.</p>
        <div className="plot"><LightCurvePlot /></div>
      </div>
    </NeedsTarget>
  );
}

function When() {
  return (
    <NeedsTarget then="The dates of its images appear here.">
      <div className="tool">
        <p className="muted">When SPHEREx looked. Each dot is one image. On every visit the telescope steps the target through all its colors. Click a dot to see that image.</p>
        <div className="plot"><Timeline /></div>
      </div>
    </NeedsTarget>
  );
}

/** Up to `count` items taken evenly across a list, so a long run of one night does not fill the row. */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, i) => items[Math.round((i * (items.length - 1)) / (count - 1))]);
}

function Partner() {
  const partner = useStore((s) => s.partner);
  const moving = useStore((s) => !!s.target?.moving);
  let empty: string | null = null;
  if (moving) empty = "Images from other telescopes are matched to a fixed field, so they are not shown for planets, asteroids, and comets.";
  else if (!partner) empty = "No images from other telescopes for this field yet.";
  else if (partner.count === 0) empty = `${partner.mission} has no images of this field.`;
  return (
    <NeedsTarget then="Images of the same field from other telescopes appear here.">
      {empty || !partner ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="tool">
          <h2>Seen in visible light by {partner.mission}</h2>
          <p className="muted">
            {partner.agency}. {partner.count.toLocaleString("en-US")} images of this field
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
        </div>
      )}
    </NeedsTarget>
  );
}

function Spacecraft({ showMap }: ToolProps) {
  const info = useStore((s) => s.spacecraft);
  const now = useStore((s) => s.spacecraftNow);
  const newest = info?.archive?.newest;
  return (
    <div className="tool spacecraft">
      <div className="orbit"><OrbitView /></div>
      <div className="tool-main">
        <h2>Where is SPHEREx right now?</h2>
        <p className="muted">The telescope circles the Earth from pole to pole about every 98 minutes, riding the line between day and night.</p>
        {now && (
          <p>
            Over latitude {now.latitude.toFixed(1)}°, longitude {now.longitude.toFixed(1)}°. {Math.round(now.altitude)} km up, moving at{" "}
            {now.speed.toFixed(2)} km per second. One lap takes {now.period.toFixed(1)} minutes. {now.sunlit ? "In sunlight." : "In the Earth's shadow."}
          </p>
        )}
        {info?.archive && (
          <p className="muted">
            {info.archive.exposures.toLocaleString("en-US")} exposures are public
            {newest != null && `. The newest is from ${formatDate(newest)}`}. Launched {info.launched}.
          </p>
        )}
        {info && info.recent.length > 0 && (
          <div className="row wrap">
            <button onClick={() => { actions.flyTo(info.recent[0], 25); showMap(); }}>Show where the newest public image looked</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SaveAndShare() {
  const count = useStore((s) => s.sequence.length);
  const exporting = useStore((s) => s.exporting);
  // Which copy button just succeeded, so it can say so for a moment.
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  function copy(text: string, which: "link" | "embed") {
    // The browser may refuse the clipboard. Then the button simply does not claim success.
    void copyText(text).then((worked) => {
      if (!worked) return;
      setCopied(which);
      setTimeout(() => setCopied(null), 2500);
    });
  }
  return (
    <NeedsTarget then="Pictures, animations, spectrum tables, and links can be saved here.">
      <div className="tool">
        <dl className="save-list">
          <dt><button onClick={() => void actions.saveImage()} disabled={!count}>Save picture</button></dt>
          <dd>The image on screen, with its marks, as a PNG file.</dd>
          <dt>
            <button onClick={() => void actions.saveAnimation()} disabled={count < 2 || exporting !== null}>
              {exporting !== null ? `Saving animation ${Math.round(exporting * 100)}%` : "Save animation"}
            </button>
          </dt>
          <dd>Every step of the player as an animated GIF.</dd>
          <dt><button onClick={() => actions.saveSpectrum()} disabled={!count}>Save spectrum table</button></dt>
          <dd>Every brightness measurement as a CSV table, one row per image.</dd>
          <dt><button onClick={() => copy(actions.shareLink(), "link")} disabled={!count}>{copied === "link" ? "Link copied" : "Copy link"}</button></dt>
          <dd>A link that reopens this target with these settings.</dd>
          <dt><button onClick={() => copy(actions.embedCode(), "embed")} disabled={!count}>{copied === "embed" ? "Embed code copied" : "Copy embed code"}</button></dt>
          <dd>HTML that shows this view inside another web page.</dd>
        </dl>
      </div>
    </NeedsTarget>
  );
}

const REPO = "https://github.com/mattsaund/SPHERExplorer";

/** Who made this, whose data it shows, and what it is not. */
function About() {
  const archive = useStore((s) => s.meta?.index);
  return (
    <div className="tool about">
      <p>
        <strong>SPHERExplorer</strong> shows every public SPHEREx image of any place in the sky as a short film, with tools to see what moved, what changed
        brightness, and what the light is made of. Built by team Turing Complete (Matt and Austin) for the NASA Space Apps Challenge 2026, challenge
        "Planet X and SPHEREx".
      </p>
      <p>
        <strong>Not a NASA product.</strong> This is an independent team project. It is not an official NASA product and is not endorsed by NASA.
      </p>
      <p>
        <strong>Data.</strong> {DATA_CREDIT.replace(/^Data: /, "")}. This tool makes use of data products from the Spectro-Photometer for the History of the
        Universe, Epoch of Reionization and Ices Explorer (SPHEREx), a joint project of the Jet Propulsion Laboratory and the California Institute of
        Technology, funded by the National Aeronautics and Space Administration. It also uses the NASA/IPAC Infrared Science Archive.
        {archive && ` ${archive.exposures.toLocaleString("en-US")} exposures are indexed, from releases ${archive.releases.map((release) => release.toUpperCase()).join(" and ")}.`}
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
    </div>
  );
}

export const TOOLS: { id: string; label: string; Panel: ComponentType<ToolProps> }[] = [
  { id: "spectrum", label: "Spectrum", Panel: Spectrum },
  { id: "changes", label: "What changed", Panel: Changes },
  { id: "motion", label: "Motion", Panel: Motion },
  { id: "brightness", label: "Brightness over time", Panel: Brightness },
  { id: "timeline", label: "Timeline", Panel: When },
  { id: "partner", label: "Other telescopes", Panel: Partner },
  { id: "spacecraft", label: "Spacecraft", Panel: Spacecraft },
  { id: "save", label: "Save and share", Panel: SaveAndShare },
  { id: "about", label: "About", Panel: About },
];
