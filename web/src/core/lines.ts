// A library of spectral features that fall in the SPHEREx range (0.75 to 5.0 microns),
// grouped by what they reveal. Wavelengths are vacuum rest wavelengths in microns.
// Sources: NIST Atomic Spectra Database for atomic lines, Gibb et al. 2004 (ApJS 151, 35)
// and Boogert et al. 2015 (ARA&A 53, 541) for ices, and standard near-infrared references
// for molecular bands. See docs/references.md.
// Written with Claude Code (Anthropic) assistance.

export interface SpectralFeature {
  /** Short label for the plot, for example "Pa α". */
  label: string;
  /** Rest wavelength in microns. For a band, its center. */
  wavelength: number;
  /** Full width in microns for broad bands. Omitted for narrow lines. */
  width?: number;
}

export interface LineFamily {
  id: string;
  /** Plain name, for example "Water". */
  name: string;
  /** One sentence on what seeing it means. */
  about: string;
  features: SpectralFeature[];
}

export const LINE_FAMILIES: LineFamily[] = [
  {
    id: "hydrogen",
    name: "Hydrogen",
    about: "Glowing hydrogen gas. Marks star-forming regions, young stars, and gas near black holes.",
    features: [
      { label: "Pa ε", wavelength: 0.9549 },
      { label: "Pa δ", wavelength: 1.0052 },
      { label: "Pa γ", wavelength: 1.0941 },
      { label: "Pa β", wavelength: 1.2822 },
      { label: "Pa α", wavelength: 1.8756 },
      { label: "Br δ", wavelength: 1.9451 },
      { label: "Br γ", wavelength: 2.1661 },
      { label: "Br β", wavelength: 2.6259 },
      { label: "Pf γ", wavelength: 3.7406 },
      { label: "Br α", wavelength: 4.0523 },
      { label: "Pf β", wavelength: 4.6538 },
    ],
  },
  {
    id: "helium",
    name: "Helium",
    about: "Hot helium gas. Seen in winds from hot stars and in nebulae.",
    features: [
      { label: "He I", wavelength: 1.0833 },
      { label: "He I", wavelength: 2.0587 },
      { label: "He II", wavelength: 1.0126 },
    ],
  },
  {
    id: "h2",
    name: "Molecular hydrogen",
    about: "Warm hydrogen molecules. A sign of shocks and of gas lit by young stars.",
    features: [
      { label: "H₂ 1-0 S(2)", wavelength: 2.0338 },
      { label: "H₂ 1-0 S(1)", wavelength: 2.1218 },
      { label: "H₂ 1-0 S(0)", wavelength: 2.2233 },
      { label: "H₂ 1-0 Q(1)", wavelength: 2.4066 },
      { label: "H₂ 1-0 O(3)", wavelength: 2.8025 },
      { label: "H₂ 0-0 S(9)", wavelength: 4.6947 },
    ],
  },
  {
    id: "oxygen",
    name: "Oxygen",
    about: "Oxygen atoms. In distant galaxies the bright visible oxygen lines shift into this range.",
    features: [
      { label: "O I", wavelength: 0.8446 },
      { label: "O I", wavelength: 1.1287 },
      { label: "O I", wavelength: 1.3165 },
    ],
  },
  {
    id: "water",
    name: "Water",
    about: "Water ice on dust grains and steam in cool atmospheres. Ice makes a wide dip near 3 microns.",
    features: [
      { label: "H₂O", wavelength: 1.4, width: 0.12 },
      { label: "H₂O", wavelength: 1.9, width: 0.16 },
      { label: "H₂O", wavelength: 2.7, width: 0.25 },
      { label: "H₂O ice", wavelength: 3.05, width: 0.45 },
    ],
  },
  {
    id: "co2",
    name: "Carbon dioxide",
    about: "Carbon dioxide ice and gas. A sharp, deep dip near 4.27 microns.",
    features: [
      { label: "CO₂", wavelength: 2.7, width: 0.08 },
      { label: "CO₂", wavelength: 4.27, width: 0.1 },
      { label: "¹³CO₂", wavelength: 4.39, width: 0.04 },
    ],
  },
  {
    id: "co",
    name: "Carbon monoxide",
    about: "Carbon monoxide. Band heads near 2.3 microns mark cool giant stars. Ice absorbs at 4.67.",
    features: [
      { label: "CO 2-0", wavelength: 2.2935 },
      { label: "CO 3-1", wavelength: 2.3227 },
      { label: "CO 4-2", wavelength: 2.3525 },
      { label: "CO", wavelength: 4.67, width: 0.5 },
    ],
  },
  {
    id: "methane",
    name: "Methane",
    about: "Methane gas. The mark of the coolest brown dwarfs and giant planets.",
    features: [
      { label: "CH₄", wavelength: 1.66, width: 0.12 },
      { label: "CH₄", wavelength: 2.3, width: 0.2 },
      { label: "CH₄", wavelength: 3.32, width: 0.3 },
    ],
  },
  {
    id: "ammonia",
    name: "Ammonia",
    about: "Ammonia gas and ice. Found in very cold atmospheres and icy clouds.",
    features: [
      { label: "NH₃", wavelength: 1.5, width: 0.06 },
      { label: "NH₃", wavelength: 2.0, width: 0.08 },
      { label: "NH₃", wavelength: 2.96, width: 0.1 },
    ],
  },
  {
    id: "organics",
    name: "Organic molecules and dust",
    about: "Carbon-rich molecules and ices in space, including the 3.3 micron glow of soot-like grains.",
    features: [
      { label: "PAH", wavelength: 3.29, width: 0.06 },
      { label: "C-H", wavelength: 3.4, width: 0.08 },
      { label: "CH₃OH", wavelength: 3.53, width: 0.06 },
      { label: "OCN⁻", wavelength: 4.62, width: 0.05 },
      { label: "OCS", wavelength: 4.9, width: 0.05 },
    ],
  },
  {
    id: "metals",
    name: "Metals and stellar bands",
    about: "Heavier elements and molecules in stars. They tell a star's temperature and type.",
    features: [
      { label: "Ca II", wavelength: 0.8498 },
      { label: "Ca II", wavelength: 0.8542 },
      { label: "Ca II", wavelength: 0.8662 },
      { label: "[S III]", wavelength: 0.9071 },
      { label: "[S III]", wavelength: 0.9533 },
      { label: "FeH", wavelength: 0.9896 },
      { label: "VO", wavelength: 1.05, width: 0.04 },
      { label: "K I", wavelength: 1.2477 },
      { label: "[Fe II]", wavelength: 1.257 },
      { label: "[Fe II]", wavelength: 1.644 },
      { label: "Na I", wavelength: 2.2076 },
    ],
  },
  {
    id: "galaxy",
    name: "Galaxy lines (use with redshift)",
    about: "Bright visible-light lines of galaxies. Raise the redshift until they line up with bumps.",
    features: [
      { label: "[O II]", wavelength: 0.3728 },
      { label: "H β", wavelength: 0.4863 },
      { label: "[O III]", wavelength: 0.4960 },
      { label: "[O III]", wavelength: 0.5008 },
      { label: "H α", wavelength: 0.6565 },
      { label: "[N II]", wavelength: 0.6585 },
      { label: "[S II]", wavelength: 0.6725 },
    ],
  },
];
