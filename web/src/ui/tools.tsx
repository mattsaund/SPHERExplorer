// The tools in the bottom dock, one per tab. To add a tool, write its component and add one entry to TOOLS.
// Written with Claude Code (Anthropic) assistance.
import { useState, type ComponentType, type ReactNode } from "react";
import {
  LINE_FAMILIES,
  LightCurvePlot,
  OrbitView,
  SpectrumPlot,
  Timeline,
  actions,
  compass,
  distanceMethod,
  formatAu,
  formatDate,
  formatDistance,
  formatFlux,
  formatWavelength,
  useStore,
} from "../core";

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

function Details({ showImages }: ToolProps) {
  const target = useStore((s) => s.target);
  const movers = useStore((s) => s.movers);
  const frame = useStore((s) => {
    const item = s.sequence[s.player.index];
    return item && item.frameIds.length === 1 ? s.frames[item.frameIds[0]] : null;
  });
  // The first image of the step on screen, for distances that change from image to image.
  const shown = useStore((s) => {
    const item = s.sequence[s.player.index];
    return item ? s.frames[item.frameIds[0]] : null;
  });
  if (!target) return <NoTarget then="Facts about it appear here." />;
  return (
    <div className="tool columns">
      <section>
        <h2>{target.name ?? "Custom position"}</h2>
        {target.kind && <p>{target.kind}</p>}
        {target.distance && <p>Distance: {formatDistance(target.distance)}, {distanceMethod(target.distance.method)}.</p>}
        {target.moving && shown?.earthDistance != null && (
          <p>
            Distance at this image: {formatAu(shown.earthDistance)} from Earth
            {shown.sunDistance != null && `, ${formatAu(shown.sunDistance)} from the Sun`}.
          </p>
        )}
        {target.url && (
          <p>
            <a href={target.url} target="_blank" rel="noreferrer">Full details{target.moving ? " at NASA JPL" : " in the SIMBAD database"}</a>
            {target.moving ? " (orbit, size, and discovery)" : " (names, measurements, and research papers)"}
          </p>
        )}
      </section>
      <section>
        <h2>Image on screen</h2>
        {frame ? (
          <p>
            {formatDate(frame.mjd)}. Detector {frame.detector}. {formatWavelength(frame.wavelength)}.
            {frame.phot?.flux != null && frame.phot.err != null && ` Brightness ${formatFlux(frame.phot.flux)} ± ${formatFlux(frame.phot.err)}.`}
          </p>
        ) : (
          <p className="muted">Single images show their date, detector, wavelength, and brightness here. Sums of several images do not.</p>
        )}
        {movers.slice(0, 2).map((mover) => (
          <p key={mover.id} className="hint">
            {mover.name}{mover.kind ? ` (${mover.kind.toLowerCase()})` : ""} moves quickly across the sky and is near these coordinates. It may have moved since they were measured.{" "}
            <button onClick={() => { actions.studyObject(mover); showImages(); }}>Follow {mover.name}</button>
          </p>
        ))}
      </section>
    </div>
  );
}

function Spectrum() {
  const settings = useStore((s) => s.spectrum);
  return (
    <NeedsTarget then="Its spectrum appears here.">
      <div className="tool split">
        <div className="tool-main">
          <p className="muted">Brightness of the target at each wavelength. Dips and bumps reveal what it is made of. Click a point to see its image.</p>
          <div className="plot"><SpectrumPlot /></div>
        </div>
        <div className="tool-side">
          <label className="check"><input type="checkbox" checked={settings.perVisit} onChange={(e) => actions.setSpectrum({ perVisit: e.target.checked })} /> Compare visits</label>
          <label className="check"><input type="checkbox" checked={settings.showPoints} onChange={(e) => actions.setSpectrum({ showPoints: e.target.checked })} /> Every measurement</label>
          <label className="check"><input type="checkbox" checked={settings.log} onChange={(e) => actions.setSpectrum({ log: e.target.checked })} /> Log scale</label>
          <label className="check"><input type="checkbox" checked={settings.showSurveys} onChange={(e) => actions.setSpectrum({ showSurveys: e.target.checked })} /> 2MASS and WISE</label>
          <label className="field">
            <span>Measure</span>
            <select value={settings.aperture === null ? "fit" : String(settings.aperture)} onChange={(e) => actions.setSpectrum({ aperture: e.target.value === "fit" ? null : Number(e.target.value) })}>
              <option value="fit">A point (best for stars)</option>
              <option value="8">A small circle, 8″</option>
              <option value="12">A circle, 12″</option>
              <option value="20">A wide circle, 20″</option>
              <option value="40">A very wide circle, 40″</option>
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
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(which);
        setTimeout(() => setCopied(null), 2500);
      },
      () => {},
    );
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

export const TOOLS: { id: string; label: string; Panel: ComponentType<ToolProps> }[] = [
  { id: "details", label: "Details", Panel: Details },
  { id: "spectrum", label: "Spectrum", Panel: Spectrum },
  { id: "motion", label: "Motion", Panel: Motion },
  { id: "brightness", label: "Brightness over time", Panel: Brightness },
  { id: "timeline", label: "Timeline", Panel: When },
  { id: "partner", label: "Other telescopes", Panel: Partner },
  { id: "spacecraft", label: "Spacecraft", Panel: Spacecraft },
  { id: "save", label: "Save and share", Panel: SaveAndShare },
];
