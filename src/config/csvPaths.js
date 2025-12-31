/**
 * Maps scenario names to CSV file prefixes
 */
const SCENARIO_TO_CSV_PREFIX = {
  'SSP1-2.6': 'SSP126',
  'SSP2-4.5': 'SSP245',
  'SSP3-7.0': 'SSP370',
  'SSP5-8.5': 'SSP585',
};

/**
 * CSV data file paths and utilities
 */
export const CSV_PATHS = {
  DATA_DIR: 'data',
  GLACIER_INDEX: 'glacier_index.csv',
  getTotalsPath: (scenario) => {
    const prefix = SCENARIO_TO_CSV_PREFIX[scenario];
    if (!prefix) {
      return null;
    }
    return `${prefix}_totals.csv`;
  },
  getTotalsUrl: (scenario) => {
    const path = CSV_PATHS.getTotalsPath(scenario);
    if (!path) {
      return null;
    }
    return `${import.meta.env.BASE_URL}${CSV_PATHS.DATA_DIR}/${path}`;
  },
  getGlacierIndexUrl: () => {
    return `${import.meta.env.BASE_URL}${CSV_PATHS.DATA_DIR}/${CSV_PATHS.GLACIER_INDEX}`;
  },
};

