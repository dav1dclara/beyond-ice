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
  visualization: {
    negative: '#1E3A8A',     // Dark blue for negative changes
    negativeLight: '#3B82F6', // Light blue for -25%
    neutral: '#FFFFFF',      // White for 0%
    positiveLight: '#F87171', // Light red for +25%
    positive: '#DC2626',     // Red for +50%
    missing: '#E5E5E5',      // Gray for missing data
  }
}
