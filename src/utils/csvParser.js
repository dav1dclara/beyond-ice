/**
 * Utility functions for parsing CSV data
 */

/**
 * Parses a single CSV line, handling quoted values.
 * @param {string} line - The CSV line to parse.
 * @returns {Array<string>} An array of parsed values.
 */
export function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}
