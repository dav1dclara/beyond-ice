import { ref } from 'vue';
import { YEAR_CONFIG } from '../config/years.js';
import { CSV_PATHS } from '../config/csvPaths.js';
import { parseCSVLine } from '../utils/csvParser.js';

/**
 * Composable for managing evolution graph data loading
 * Handles CSV and tileset data loading for overall and individual glacier views
 *
 * @param {Object} props - Component props
 * @param {ComputedRef<boolean>} isComparisonMode - Whether comparison mode is active
 * @returns {Object} Chart data state and loading functions
 */
export function useEvolutionGraphData(props, isComparisonMode) {
  const chartData = ref([]);
  const comparisonChartData = ref([]);
  const chartLoaded = ref(false);
  const chartLoading = ref(false);
  const lastLoadedGlacierId = ref(null);
  const lastLoadedProjection = ref(null);

  const isSourceReady = (projection) => {
    if (!props.map || !props.getSourceId) return false;

    const sourceId = props.getSourceId(projection);
    const source = props.map.getSource(sourceId);
    if (!source) return false;

    if (source.type === 'vector') {
      if (source.loaded && typeof source.loaded === 'function') {
        return source.loaded();
      }
      return true;
    }

    return false;
  };

  const queryTilesetFeatures = (projection, year) => {
    if (!props.map || !props.getSourceId) {
      console.warn(
        '[EvolutionGraph] Cannot query: map or getSourceId not available'
      );
      return [];
    }

    const sourceId = props.getSourceId(projection);
    const source = props.map.getSource(sourceId);
    if (!source) {
      console.warn(
        `[EvolutionGraph] Source not found: ${sourceId} for projection: ${projection}`
      );
      return [];
    }

    if (source.type === 'vector') {
      const sourceLayerName = year.toString();
      try {
        const features = props.map.querySourceFeatures(sourceId, {
          sourceLayer: sourceLayerName,
        });
        return features || [];
      } catch (error) {
        console.warn(
          `[EvolutionGraph] Error querying features for ${projection}/${year}:`,
          error
        );
        return [];
      }
    }

    return [];
  };

  const extractAreaVolume = (featureProps) => {
    let areaValue =
      featureProps['Area (km2)'] ??
      featureProps['area_km2'] ??
      featureProps['Area'] ??
      null;

    if (areaValue == null) {
      const areaKey = Object.keys(featureProps).find(
        (key) =>
          key.toLowerCase().includes('area') &&
          (key.includes('km2') || key.includes('km²'))
      );
      areaValue = areaKey ? featureProps[areaKey] : 0;
    }

    const volumeValue =
      featureProps['Volume (km3)'] ??
      featureProps['volume_km3'] ??
      featureProps['Volume'] ??
      featureProps['volume'] ??
      0;

    return {
      area: areaValue ?? 0,
      volume: volumeValue ?? 0,
    };
  };

  const loadOverallDataFromCSV = async (projection) => {
    const csvUrl = CSV_PATHS.getTotalsUrl(projection);
    if (!csvUrl) {
      console.warn(`[EvolutionGraph] Unknown projection: ${projection}`);
      return null;
    }

    try {
      const response = await fetch(csvUrl);

      if (!response.ok) {
        console.error(`[EvolutionGraph] CSV not found at ${csvUrl}`);
        return null;
      }

      const csvText = await response.text();
      const lines = csvText
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const headers = parseCSVLine(lines[0]);

      const yearIndex = headers.findIndex((h) => h.toLowerCase() === 'year');
      const areaIndex = headers.findIndex((h) =>
        h.toLowerCase().includes('area')
      );
      const volumeIndex = headers.findIndex((h) =>
        h.toLowerCase().includes('volume')
      );

      if (yearIndex === -1 || areaIndex === -1 || volumeIndex === -1) {
        console.warn('[EvolutionGraph] CSV missing required columns');
        return null;
      }

      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const year = parseInt(values[yearIndex]);
        const area = parseFloat(values[areaIndex]) || 0;
        const volume = parseFloat(values[volumeIndex]) || 0;

        if (!isNaN(year)) {
          data.push({ year, area, volume });
        }
      }

      const baseline = data.find((d) => d.year === YEAR_CONFIG.MIN_YEAR);
      if (baseline) {
        return data.map((d) => ({
          year: d.year,
          area: d.area,
          volume: d.volume,
          areaChange:
            baseline.area > 0
              ? ((d.area - baseline.area) / baseline.area) * 100
              : null,
          volumeChange:
            baseline.volume > 0
              ? ((d.volume - baseline.volume) / baseline.volume) * 100
              : null,
        }));
      }

      return data.map((d) => ({
        year: d.year,
        area: d.area,
        volume: d.volume,
        areaChange: null,
        volumeChange: null,
      }));
    } catch (error) {
      console.warn('[EvolutionGraph] Error loading CSV:', error);
      return null;
    }
  };

  const resetChartState = () => {
    chartData.value = [];
    comparisonChartData.value = [];
    chartLoaded.value = false;
    chartLoading.value = false;
  };

  const loadChartData = async () => {
    if (isComparisonMode.value) {
      if (!props.referenceScenario || !props.comparisonScenario) {
        resetChartState();
        return;
      }
    } else {
      if (!props.selectedProjection) {
        resetChartState();
        return;
      }
    }

    chartData.value = [];
    comparisonChartData.value = [];
    chartLoaded.value = false;
    chartLoading.value = true;

    try {
      const years = Array.from(
        {
          length: Math.floor((props.maxYear - props.minYear) / props.step) + 1,
        },
        (_, i) => props.minYear + i * props.step
      );

      const glacierId = props.selectedGlacier?.id ?? null;
      const isOverallView = !glacierId;

      const loadDataForScenario = async (projection) => {
        if (isOverallView) {
          const csvData = await loadOverallDataFromCSV(projection);

          if (csvData && csvData.length > 0) {
            return csvData
              .filter((d) => years.includes(d.year))
              .sort((a, b) => a.year - b.year);
          }

          return [];
        }

        if (!props.map || !props.getSourceId) {
          return [];
        }

        let retries = 0;
        const maxRetries = 10;
        const retryDelay = 100;

        while (!isSourceReady(projection) && retries < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          retries++;
        }

        if (!isSourceReady(projection)) {
          console.warn(
            `[EvolutionGraph] Source not ready after ${maxRetries} retries for ${projection}`
          );
          return [];
        }

        const dataPoints = [];
        for (const year of years) {
          const features = queryTilesetFeatures(projection, year);

          const glacierFeature = features.find((f) => {
            const fId = f.id ?? f.properties?.['mapbox-id'] ?? String(f.id);
            return String(fId) === String(glacierId);
          });

          if (glacierFeature) {
            const { area, volume } = extractAreaVolume(
              glacierFeature.properties
            );
            dataPoints.push({
              year,
              area,
              volume,
              exists: true,
            });
          } else {
            dataPoints.push({
              year,
              area: 0,
              volume: 0,
              exists: false,
            });
          }
        }

        return dataPoints;
      };

      if (isComparisonMode.value) {
        const [refData, compData] = await Promise.all([
          loadDataForScenario(props.referenceScenario),
          loadDataForScenario(props.comparisonScenario),
        ]);

        chartData.value = refData;
        comparisonChartData.value = compData;
      } else {
        const data = await loadDataForScenario(props.selectedProjection);
        chartData.value = data;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      chartLoaded.value = true;
      chartLoading.value = false;
      lastLoadedGlacierId.value = glacierId;
      lastLoadedProjection.value = isComparisonMode.value
        ? `${props.referenceScenario}-${props.comparisonScenario}`
        : props.selectedProjection;
    } catch (error) {
      console.error('[EvolutionGraph] Error loading chart data:', error);
      resetChartState();
    }
  };

  const triggerChartLoad = async (force = false) => {
    const glacierId = props.selectedGlacier?.id ?? null;
    const projectionKey = isComparisonMode.value
      ? `${props.referenceScenario}-${props.comparisonScenario}`
      : props.selectedProjection;

    if (
      !force &&
      lastLoadedGlacierId.value === glacierId &&
      lastLoadedProjection.value === projectionKey
    ) {
      return;
    }

    loadChartData();
  };

  return {
    chartData,
    comparisonChartData,
    chartLoaded,
    chartLoading,
    triggerChartLoad,
  };
}
