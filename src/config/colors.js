/**
 * Color configuration for the application
 * Centralized color definitions for consistent use across components
 */

export const COLORS = {
  // General UI colors
  background: { 
    default: '#FFFFFF',           // White background
    hover: '#f5f5f5',            // Light gray hover background
    active: '#e8e8e8',           // Slightly darker gray active background
    tooltip: '#e8e8e8',          // Slightly darker gray tooltip background
  },
  border: {
    default: '#e5e5e5',          // Light gray border
    hover: '#d0d0d0',            // Darker gray hover border
    // active: '#555555',           // Dark gray active border
    // colorIndicator: '#555555',    // Dark gray border for color indicators
  },
  shadow: {
    light: 'rgba(0, 0, 0, 0.15)',  // Light shadow
    medium: 'rgba(0, 0, 0, 0.3)',  // Medium shadow
  },


  // Glacier colors
  glacier: {
    default: '#3B82F6',      // Blue - default glacier color (matches area change 0% color)
    selected: '#51B8E1',      // Dodger blue - selected/highlighted glacier
    currentYear: '#51B8E1',  // Steel blue - current year bars
    outline: '#3B82F6',       // Blue - glacier outlines (matches default)
  },
  
  // UI colors
  ui: {
    primary: '#87CEEB',      // Primary UI color (matches glacier default)
    border: '#87CEEB',       // Border color for UI elements
    background: '#FFFFFF',   // White background
    text: {
      primary: '#333333',      // Dark text
      secondary: '#666666',     // Medium gray text
      tertiary: '#888888',      // Light gray text (labels)
      tooltip: '#333333',       // Tooltip text
    },
  },
  
  // Chart colors
  chart: {
    barDefault: '#e5e5e5',   // Default bar color
    barCurrentYear: '#A8DCF0', // Current year bar color
  },
  
  // Visualization colors (for percentage changes)
  // Scale goes from blue (0% change, less concerning) to orange (maximum negative change, most concerning)
  visualization: {
    negative: '#F97316',     // Orange for maximum negative changes (-100%)
    negativeLight: '#F472B6', // Pink/purple for -50%
    neutral: '#3B82F6',       // Blue for 0% change
    missing: '#E5E5E5',      // Gray for missing data
    // Scenario comparison colors
    reference: 'rgba(59, 130, 246, 0.6)',   // Blue for reference scenario
    comparison: 'rgba(249, 115, 22, 0.6)', // Orange for comparison scenario
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
