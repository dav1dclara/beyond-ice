/**
 * Piecewise angular bivariate choropleth color mapping
 * 
 * Encoding:
 * 1. Angle (θ) controls hue via piecewise interpolation between anchor colors
 * 2. Radius (r) controls lightness (inverted: r=0 → dark, r=1 → light)
 * 
 * @param {number} areaChange - Area change (relative, range [-1, 0] or percentage [-100, 0])
 * @param {number} volumeChange - Volume change (relative, range [-1, 0] or percentage [-100, 0])
 * @returns {Object} RGB color object with r, g, b properties (0-255)
 */
export function getBivariateColor(areaChange, volumeChange) {
  // Handle missing data
  if (areaChange == null || volumeChange == null) {
    return { r: 229, g: 229, b: 229 } // #E5E5E5 (gray for missing data)
  }
  
  // STEP 1: Normalize inputs
  // Normalize from percentage [-100, 0] to relative [-1, 0] if needed
  const areaRel = Math.abs(areaChange) > 1 ? areaChange / 100 : areaChange
  const volumeRel = Math.abs(volumeChange) > 1 ? volumeChange / 100 : volumeChange
  
  // STEP 2: Compute coordinates
  // x = -volume_change, y = -area_change (both in [0, 1])
  const x = -volumeRel // x ∈ [0, 1]
  const y = -areaRel   // y ∈ [0, 1]
  
  // STEP 3: Compute angle from downward axis
  // θ = atan2(x, y) in radians, then convert to degrees
  const thetaRad = Math.atan2(x, y) // ∈ [0, π/2]
  const thetaDeg = thetaRad * 180 / Math.PI // ∈ [0, 90]
  
  // STEP 4: Define angular anchor colors
  // 0° → C0 (orange, area axis)
  // 35° → C1 (yellow-orange)
  // 55° → C2 (cyan/light blue)
  // 90° → C3 (blue, volume axis)
  const C0 = { r: 255, g: 165, b: 0 }   // Orange
  const C1 = { r: 255, g: 220, b: 100 } // Yellow-orange
  const C2 = { r: 100, g: 200, b: 255 } // Cyan/light blue
  const C3 = { r: 0, g: 100, b: 255 }   // Blue
  
  // STEP 5: Piecewise angular interpolation
  // Narrower central section (35-55°) to make diagonal transition thinner
  let baseR, baseG, baseB
  if (thetaDeg <= 35) {
    // 0-35°: lerp(C0, C1)
    const t = thetaDeg / 35 // ∈ [0, 1]
    baseR = C0.r + (C1.r - C0.r) * t
    baseG = C0.g + (C1.g - C0.g) * t
    baseB = C0.b + (C1.b - C0.b) * t
  } else if (thetaDeg <= 55) {
    // 35-55°: lerp(C1, C2) - narrower central section
    const t = (thetaDeg - 35) / 20 // ∈ [0, 1]
    baseR = C1.r + (C2.r - C1.r) * t
    baseG = C1.g + (C2.g - C1.g) * t
    baseB = C1.b + (C2.b - C1.b) * t
  } else {
    // 55-90°: lerp(C2, C3)
    const t = (thetaDeg - 55) / 35 // ∈ [0, 1]
    baseR = C2.r + (C3.r - C2.r) * t
    baseG = C2.g + (C3.g - C2.g) * t
    baseB = C2.b + (C3.b - C2.b) * t
  }
  
  // STEP 6: Compute radius and lightness
  // r = sqrt(x² + y²) / sqrt(2) ∈ [0, 1]
  const radius = Math.sqrt(x * x + y * y)
  const rNormalized = Math.min(radius / Math.sqrt(2), 1)
  
  // Smooth compression: m = 1 - exp(-r / r0)
  // r0 controls the compression rate
  const r0 = 0.4
  const m = 1 - Math.exp(-rNormalized / r0) // ∈ [0, 1)
  
  // Apply lightness (inverted: r=0 → dark, r=1 → light)
  // Interpolate from dark (black) to base_color using m
  const dark = { r: 0, g: 0, b: 0 }
  const finalR = dark.r + (baseR - dark.r) * m
  const finalG = dark.g + (baseG - dark.g) * m
  const finalB = dark.b + (baseB - dark.b) * m
  
  return { 
    r: Math.round(Math.max(0, Math.min(255, finalR))), 
    g: Math.round(Math.max(0, Math.min(255, finalG))), 
    b: Math.round(Math.max(0, Math.min(255, finalB))) 
  }
}

/**
 * Get RGB color as a string for use in CSS/HTML
 * @param {number} areaChange - Area change (relative [-1, 0] or percentage [-100, 0])
 * @param {number} volumeChange - Volume change (relative [-1, 0] or percentage [-100, 0])
 * @returns {string} RGB color string (e.g., "rgb(123, 45, 67)")
 */
export function getBivariateColorString(areaChange, volumeChange) {
  const rgb = getBivariateColor(areaChange, volumeChange)
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}
