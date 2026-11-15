# Glossary

The terms used in the app and in these docs, in plain words.

## Measuring the sky

| Term | Meaning |
|---|---|
| RA and Dec | Right ascension and declination, the sky's longitude and latitude. RA is often written in hours, minutes, and seconds, and Dec in degrees. |
| J2000 | The standard reference frame for coordinates, fixed at the start of the year 2000. The app treats it as the same as ICRS. |
| Degree, arcminute, arcsecond | Angles on the sky. An arcminute (′) is 1/60 of a degree and an arcsecond (″) is 1/3600. The full Moon is about 30 arcminutes across. |
| Field | The square patch of sky being studied, 1 to 50 arcminutes wide. |
| Proper motion | How fast a star crosses the sky, in arcseconds a year. Nearby stars move the most. |
| Parallax | The small yearly wobble of a nearby star caused by Earth's orbit. It gives the star's distance. |
| Light-year | The distance light travels in a year. |

## Light and brightness

| Term | Meaning |
|---|---|
| Infrared | Light with longer wavelengths than red, invisible to the eye. SPHEREx sees 0.75 to 5.0 microns. |
| Micron (µm) | A millionth of a meter, the unit for wavelength here. |
| Band, channel | One narrow slice of wavelength. SPHEREx splits its range into 102 of them. |
| Spectrum | Brightness at each wavelength. Dips and bumps show what an object is made of. |
| Feature | A dip or bump in a spectrum caused by a substance, such as water or methane. |
| Redshift | The stretching of light from distant galaxies, which moves every feature to longer wavelengths. |
| Jansky (Jy), mJy, µJy | Units of brightness. A millijansky (mJy) is a thousandth of a jansky. |
| Sigma (σ) | How sure a measurement is. "5 sigma" means five times larger than its uncertainty. |
| Saturated | So bright that the detector's pixels filled up. The app measures such stars from the halo around them. |

## SPHEREx and its data

| Term | Meaning |
|---|---|
| SPHEREx | A NASA space telescope that maps the whole sky in 102 infrared bands, about every six months. |
| Detector | One of the six light-sensing arrays on SPHEREx. Each covers part of the wavelength range. |
| Linear variable filter | The filter over each detector. Its wavelength changes across the detector, so each exposure of a place lands at a different wavelength. |
| Exposure, image | One picture from one detector. |
| Visit | One pass over a place. SPHEREx sees each place about twice a year, and a pass covers all its wavelengths within about two weeks. |
| Deep field | An area near the ecliptic poles that SPHEREx observes far more often than the rest of the sky. |
| DR1, QR3 | Data Release 1 and Quick Release 3, the public SPHEREx collections the app reads. |
| Level 2 file | One calibrated SPHEREx image file, about 65 MB, with the image, quality flags, noise (variance), and calibration tables. |
| Flags | Marks on pixels that are bad, saturated, or hit by a cosmic ray. |
| PSF | Point spread function, the shape a single point of light takes on the detector. |
| Blink | Switching between two pictures of the same sky, so anything that moved appears to jump. |

## File formats and services

| Term | Meaning |
|---|---|
| FITS | The standard file format of astronomy. The app saves images in it. |
| WCS | World coordinate system, the information in a FITS file that ties pixels to sky positions. TAN-SIP is the form SPHEREx uses, with a polynomial (SIP) for lens distortion. |
| HiPS | Hierarchical Progressive Survey, a way to serve a whole-sky image as tiles, used by the sky map. |
| MOC | Multi-Order Coverage map, a description of which parts of the sky a survey covers. |
| IRSA | The NASA/IPAC Infrared Science Archive, which serves the SPHEREx data. |
| CDS, SIMBAD, VizieR | The Strasbourg astronomical data center, its database of named objects, and its catalog service. |
| MAST, CADC | The archives that serve Gaia data and NEOSSat images. |
| JPL Horizons, SkyBoT | Services that give the positions of planets, asteroids, and comets. |
