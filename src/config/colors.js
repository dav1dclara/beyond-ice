/**
 * Color configuration for the application
 * Centralized color definitions for consistent use across components
 */

export const COLORS = {
  // Glacier colors
  glacier: {
    default: '#A8DCF0',      // Sky blue - default glacier color
    selected: '#51B8E1',      // Dodger blue - selected/highlighted glacier
    currentYear: '#51B8E1',  // Steel blue - current year bars
    outline: '#A8DCF0',       // Sky blue - glacier outlines
  },
  
  // UI colors
  ui: {
    primary: '#87CEEB',      // Primary UI color (matches glacier default)
    border: '#87CEEB',       // Border color for UI elements
    background: '#FFFFFF',   // White background
    text: '#333333',         // Dark text
    textSecondary: '#666666', // Secondary text
  },
  
  // Chart colors
  chart: {
    barDefault: '#e5e5e5',   // Default bar color
    barCurrentYear: '#A8DCF0', // Current year bar color
  },
  
  // Visualization colors (for percentage changes)
  // Scale goes from blue (0% change, less concerning) to red (maximum negative change, most concerning)
  visualization: {
    negative: '#EF4444',     // Red for maximum negative changes (-100%)
    negativeLight: '#F472B6', // Pink/purple for -50%
    neutral: '#60A5FA',       // Blue for 0% change
    missing: '#E5E5E5',      // Gray for missing data
  },
  
  // Bivariate choropleth colors
  // Area change (X-axis): controls red/orange dimension
  // Volume change (Y-axis): controls blue/cyan dimension
  // Creates a smooth, perceptually uniform color space with clear distinction between quadrants
  bivariate: {
    // Low area change, Low volume change (minimal change in both)
    lowLow: '#E8F4F8',      // Very light blue-gray - minimal change
    // High area change, Low volume change (high area loss, low volume loss)
    highLow: '#E74C3C',      // Bright red - emphasizes area loss
    // Low area change, High volume change (low area loss, high volume loss)
    lowHigh: '#3498DB',      // Bright blue - emphasizes volume loss
    // High area change, High volume change (high loss in both)
    highHigh: '#2C3E50',     // Dark slate blue-gray - emphasizes combined high loss
  }
}
