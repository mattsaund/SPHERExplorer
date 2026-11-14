# Fixed facts about the SPHEREx instrument: detectors, the 102 spectral channels, and flag bits.
# Sources: SPHEREx Explanatory Supplement, and the properties file of the IRSA all-sky cube
# (https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube/properties).
# Written with Claude Code (Anthropic) assistance.

import numpy as np

# Wavelength range (microns) and resolving power of each detector array.
DETECTORS = {
    1: {"min": 0.744, "max": 1.116, "r": 39},
    2: {"min": 1.099, "max": 1.651, "r": 41},
    3: {"min": 1.636, "max": 2.421, "r": 41},
    4: {"min": 2.423, "max": 3.822, "r": 35},
    5: {"min": 3.809, "max": 4.420, "r": 112},
    6: {"min": 4.412, "max": 5.002, "r": 128},
}

# Central wavelength (microns) of the 102 channels, 17 per detector, in ascending order.
CHANNELS = np.array([
    0.753, 0.771, 0.790, 0.809, 0.828, 0.848, 0.868, 0.889, 0.910, 0.932, 0.955, 0.978, 1.001, 1.025, 1.050, 1.075, 1.102,
    1.113, 1.139, 1.167, 1.195, 1.224, 1.254, 1.284, 1.315, 1.346, 1.378, 1.412, 1.446, 1.481, 1.517, 1.554, 1.592, 1.631,
    1.656, 1.695, 1.735, 1.775, 1.818, 1.861, 1.905, 1.949, 1.995, 2.041, 2.089, 2.139, 2.189, 2.240, 2.292, 2.345, 2.399,
    2.445, 2.506, 2.575, 2.646, 2.719, 2.794, 2.871, 2.951, 3.033, 3.118, 3.204, 3.293, 3.383, 3.476, 3.570, 3.667, 3.768,
    3.833, 3.867, 3.901, 3.935, 3.970, 4.005, 4.040, 4.076, 4.112, 4.148, 4.184, 4.220, 4.257, 4.294, 4.331, 4.368, 4.405,
    4.435, 4.467, 4.500, 4.533, 4.566, 4.600, 4.635, 4.669, 4.704, 4.739, 4.773, 4.808, 4.843, 4.879, 4.915, 4.951, 4.988,
])
CHANNELS_PER_DETECTOR = 17


def channel_index(detector, wavelength):
    """Index (0 to 101) of the channel of a detector nearest to a wavelength in microns."""
    detector = np.asarray(detector)
    wavelength = np.asarray(wavelength, dtype=float)
    first = (detector - 1) * CHANNELS_PER_DETECTOR
    offsets = np.arange(CHANNELS_PER_DETECTOR)
    centers = CHANNELS[first[..., None] + offsets]
    return first + np.argmin(np.abs(centers - wavelength[..., None]), axis=-1)


# FLAGS extension bits. "mask" marks bits that make a pixel unusable for photometry.
FLAG_BITS = [
    {"bit": 0, "name": "TRANSIENT", "text": "Cosmic ray or sudden charge", "mask": False},
    {"bit": 1, "name": "OVERFLOW", "text": "Very bright. Reached about half of full well", "mask": False},
    {"bit": 2, "name": "SUR_ERROR", "text": "Onboard readout error", "mask": True},
    {"bit": 6, "name": "NONFUNC", "text": "Dead pixel", "mask": True},
    {"bit": 7, "name": "DICHROIC", "text": "Low throughput near the dichroic edge", "mask": False},
    {"bit": 9, "name": "MISSING_DATA", "text": "Data lost before processing", "mask": True},
    {"bit": 10, "name": "HOT", "text": "Hot pixel in this exposure", "mask": True},
    {"bit": 11, "name": "COLD", "text": "Abnormally low pixel in this exposure", "mask": True},
    {"bit": 12, "name": "FULLSAMPLE", "text": "Full sample recorded (informational)", "mask": False},
    {"bit": 14, "name": "PHANMISS", "text": "Phantom pixel correction not applied", "mask": False},
    {"bit": 15, "name": "NONLINEAR", "text": "Nonlinearity correction unreliable", "mask": True},
    {"bit": 17, "name": "PERSIST", "text": "Leftover charge from an earlier bright source", "mask": True},
    {"bit": 19, "name": "OUTLIER", "text": "Flagged by outlier detection", "mask": False},
    {"bit": 20, "name": "CROSSTALK", "text": "Electrical crosstalk from a bright source", "mask": False},
    {"bit": 21, "name": "SOURCE", "text": "Inside the mask of a known source (normal)", "mask": False},
    {"bit": 22, "name": "GHOST", "text": "Optical ghost of a bright source in the frame", "mask": False},
    {"bit": 24, "name": "GHOST_EXT", "text": "Optical ghost of a source outside the frame", "mask": False},
    {"bit": 25, "name": "STREAK", "text": "Satellite streak", "mask": False},
    {"bit": 26, "name": "BLOOM", "text": "Charge bloom from a saturated source", "mask": True},
    {"bit": 27, "name": "SNOWBALL", "text": "Snowball artifact", "mask": True},
    {"bit": 28, "name": "HALO", "text": "Halo around a cosmic ray hit", "mask": True},
    {"bit": 29, "name": "SATELLITE_HALO", "text": "Halo around a satellite streak", "mask": True},
]
BAD_MASK = sum(1 << flag["bit"] for flag in FLAG_BITS if flag["mask"])
SOURCE_MASK = 1 << 21
