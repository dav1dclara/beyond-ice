/**
 * Utility functions for formatting chart values and labels
 */

/**
 * Formats a numeric value for display in tooltips
 * @param {number} value - The value to format
 * @returns {string} Formatted value string
 */
export function formatValue(value) {
  if (value === null || value === undefined || value === 0) {
    return '0';
  }

  if (value < 0.01) {
    return value.toExponential(2);
  } else if (value < 1) {
    return value.toFixed(3);
  } else if (value < 100) {
    return value.toFixed(2);
  } else {
    return value.toFixed(1);
  }
}

/**
 * Formats a percentage change value
 * @param {number|null|undefined} change - The change percentage
 * @returns {string} Formatted change string with sign
 */
export function formatChange(change) {
  if (change === null || change === undefined) return '';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Formats a value for Y-axis display
 * @param {number} value - The value to format
 * @returns {string} Formatted Y-axis value
 */
export function formatYAxisValue(value) {
  if (value < 0.01) {
    return value.toExponential(1);
  } else if (value < 1) {
    return value.toFixed(2);
  } else if (value < 100) {
    return value.toFixed(1);
  } else {
    return Math.round(value).toLocaleString();
  }
}

/**
 * Gets the unit string for the selected metric
 * @param {string} metric - The metric type ('area' or 'volume')
 * @returns {string} Unit string ('km²' or 'km³')
 */
export function getTooltipUnit(metric) {
  return metric === 'area' ? 'km²' : 'km³';
}
