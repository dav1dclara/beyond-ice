/**
 * Bivariate choropleth color mapping utilities
 *
 * Piecewise angular bivariate choropleth:
 * - Angle (θ) controls hue via piecewise interpolation between anchor colors
 * - Radius (r) controls lightness (inverted: r=0 → dark, r=1 → light)
 */

/**
 * Get bivariate color as RGB object for JavaScript/Canvas rendering
 * @param {number} areaChange - Area change (relative [-1, 0] or percentage [-100, 0])
 * @param {number} volumeChange - Volume change (relative [-1, 0] or percentage [-100, 0])
 * @returns {Object} RGB color object with r, g, b properties (0-255)
 */
export function getBivariateColor(areaChange, volumeChange) {
  if (areaChange == null || volumeChange == null) {
    return { r: 229, g: 229, b: 229 };
  }

  const areaRel = Math.abs(areaChange) > 1 ? areaChange / 100 : areaChange;
  const volumeRel =
    Math.abs(volumeChange) > 1 ? volumeChange / 100 : volumeChange;

  const x = -volumeRel;
  const y = -areaRel;

  const thetaRad = Math.atan2(x, y);
  const thetaDeg = (thetaRad * 180) / Math.PI;

  // Angular anchor colors: 0° → orange, 35° → yellow-orange, 55° → cyan, 90° → blue
  const C0 = { r: 255, g: 165, b: 0 };
  const C1 = { r: 255, g: 220, b: 100 };
  const C2 = { r: 100, g: 200, b: 255 };
  const C3 = { r: 0, g: 100, b: 255 };

  // Piecewise angular interpolation (narrower 35-55° section for thinner diagonal transition)
  let baseR, baseG, baseB;
  if (thetaDeg <= 35) {
    const t = thetaDeg / 35;
    baseR = C0.r + (C1.r - C0.r) * t;
    baseG = C0.g + (C1.g - C0.g) * t;
    baseB = C0.b + (C1.b - C0.b) * t;
  } else if (thetaDeg <= 55) {
    const t = (thetaDeg - 35) / 20;
    baseR = C1.r + (C2.r - C1.r) * t;
    baseG = C1.g + (C2.g - C1.g) * t;
    baseB = C1.b + (C2.b - C1.b) * t;
  } else {
    const t = (thetaDeg - 55) / 35;
    baseR = C2.r + (C3.r - C2.r) * t;
    baseG = C2.g + (C3.g - C2.g) * t;
    baseB = C2.b + (C3.b - C2.b) * t;
  }

  // Radius and lightness: r = sqrt(x² + y²) / sqrt(2), m = 1 - exp(-r / r0)
  const radius = Math.sqrt(x * x + y * y);
  const rNormalized = Math.min(radius / Math.sqrt(2), 1);
  const r0 = 0.4;
  const m = 1 - Math.exp(-rNormalized / r0);

  // Interpolate from black to base color using m (inverted: r=0 → dark, r=1 → light)
  const dark = { r: 0, g: 0, b: 0 };
  const finalR = dark.r + (baseR - dark.r) * m;
  const finalG = dark.g + (baseG - dark.g) * m;
  const finalB = dark.b + (baseB - dark.b) * m;

  return {
    r: Math.round(Math.max(0, Math.min(255, finalR))),
    g: Math.round(Math.max(0, Math.min(255, finalG))),
    b: Math.round(Math.max(0, Math.min(255, finalB))),
  };
}

/**
 * Get RGB color as a string for use in CSS/HTML
 * @param {number} areaChange - Area change (relative [-1, 0] or percentage [-100, 0])
 * @param {number} volumeChange - Volume change (relative [-1, 0] or percentage [-100, 0])
 * @returns {string} RGB color string (e.g., "rgb(123, 45, 67)")
 */
export function getBivariateColorString(areaChange, volumeChange) {
  const rgb = getBivariateColor(areaChange, volumeChange);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Generate Mapbox expression for bivariate choropleth color mapping
 * Returns a Mapbox expression array that can be used in paint properties
 * @returns {Array} Mapbox expression for bivariate color calculation
 */
export function getBivariateColorExpression() {
  const areaChange = ['get', 'Area change (%)'];
  const volumeChange = ['get', 'Volume change (%)'];

  const areaRel = ['/', areaChange, 100];
  const volumeRel = ['/', volumeChange, 100];

  const x = ['*', volumeRel, -1];
  const y = ['*', areaRel, -1];

  // Approximate atan2(x, y) using ratio (Mapbox doesn't support atan2)
  const pi = 3.141592653589793;
  const piOver2 = 1.5707963267948966;
  const isYZero = ['==', y, 0];
  const isXZero = ['==', x, 0];
  const ratio = ['/', x, ['+', x, y]];
  const thetaRadApprox = ['*', ratio, piOver2];

  const thetaRad = ['case', isYZero, piOver2, isXZero, 0, thetaRadApprox];
  const thetaDeg = ['*', ['/', thetaRad, pi], 180];

  // Angular anchor colors: 0° → orange, 35° → yellow-orange, 55° → cyan, 90° → blue
  const C0R = 255;
  const C0G = 165;
  const C0B = 0;
  const C1R = 255;
  const C1G = 220;
  const C1B = 100;
  const C2R = 100;
  const C2G = 200;
  const C2B = 255;
  const C3R = 0;
  const C3G = 100;
  const C3B = 255;

  // Piecewise angular interpolation (narrower 35-55° section)
  const t0_35 = ['/', thetaDeg, 35];
  const t35_55 = ['/', ['-', thetaDeg, 35], 20];
  const t55_90 = ['/', ['-', thetaDeg, 55], 35];

  const baseR = [
    'case',
    ['<=', thetaDeg, 35],
    ['+', C0R, ['*', ['-', C1R, C0R], t0_35]],
    ['<=', thetaDeg, 55],
    ['+', C1R, ['*', ['-', C2R, C1R], t35_55]],
    ['+', C2R, ['*', ['-', C3R, C2R], t55_90]],
  ];
  const baseG = [
    'case',
    ['<=', thetaDeg, 35],
    ['+', C0G, ['*', ['-', C1G, C0G], t0_35]],
    ['<=', thetaDeg, 55],
    ['+', C1G, ['*', ['-', C2G, C1G], t35_55]],
    ['+', C2G, ['*', ['-', C3G, C2G], t55_90]],
  ];
  const baseB = [
    'case',
    ['<=', thetaDeg, 35],
    ['+', C0B, ['*', ['-', C1B, C0B], t0_35]],
    ['<=', thetaDeg, 55],
    ['+', C1B, ['*', ['-', C2B, C1B], t35_55]],
    ['+', C2B, ['*', ['-', C3B, C2B], t55_90]],
  ];

  // Radius and lightness: r = sqrt(x² + y²) / sqrt(2), m = 1 - exp(-r / r0)
  const radius = ['sqrt', ['+', ['*', x, x], ['*', y, y]]];
  const sqrt2 = 1.4142135623730951;
  const rNormalized = ['min', ['/', radius, sqrt2], 1];
  const r0 = 0.4;
  const rOverR0 = ['/', rNormalized, r0];
  const rOverR0Squared = ['*', rOverR0, rOverR0];
  const denominator = ['+', 1, ['+', rOverR0, ['*', 0.5, rOverR0Squared]]];
  const expNeg = ['/', 1, denominator];
  const m = ['-', 1, expNeg];

  // Interpolate from black to base color using m
  const darkR = 0;
  const darkG = 0;
  const darkB = 0;
  const finalR = ['+', darkR, ['*', ['-', baseR, darkR], m]];
  const finalG = ['+', darkG, ['*', ['-', baseG, darkG], m]];
  const finalB = ['+', darkB, ['*', ['-', baseB, darkB], m]];

  const r = ['round', ['max', 0, ['min', 255, finalR]]];
  const g = ['round', ['max', 0, ['min', 255, finalG]]];
  const b = ['round', ['max', 0, ['min', 255, finalB]]];

  return [
    'case',
    ['all', ['has', 'Area change (%)'], ['has', 'Volume change (%)']],
    ['rgb', r, g, b],
    '#E5E5E5',
  ];
}
