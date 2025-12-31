import { ref } from 'vue';
import { CSV_PATHS } from '../config/csvPaths.js';
import { parseCSVLine } from '../utils/csvParser.js';

/**
 * Composable for glacier search functionality
 * Handles loading search index from CSV and performing searches
 *
 * @returns {Object} Search state and functions
 */
export function useGlacierSearch() {
  const searchQuery = ref('');
  const searchResults = ref([]);
  const showSearchResults = ref(false);
  const glacierSearchIndex = ref([]);

  // Load glacier search index from CSV
  const loadGlacierSearchIndex = async () => {
    try {
      const csvUrl = CSV_PATHS.getGlacierIndexUrl();
      const response = await fetch(csvUrl);

      if (!response.ok) {
        console.error(
          `[useGlacierSearch] Could not load glacier search index: ${response.status} ${response.statusText}`
        );
        return;
      }

      const text = await response.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        console.warn('[useGlacierSearch] Search index CSV is empty or invalid');
        return;
      }

      // Parse header to find column indices
      const headerParts = parseCSVLine(lines[0].toLowerCase());

      // Find column indices
      const mapboxIdIdx = headerParts.findIndex(
        (col) => col === 'mapbox-id' || col === 'mapbox_id'
      );
      const nameIdx = headerParts.findIndex((col) => col === 'name');
      const sgiIdIdx = headerParts.findIndex(
        (col) => col === 'sgi_id' || col === 'sgi-id'
      );
      const minLngIdx = headerParts.findIndex((col) => col === 'min_lng');
      const minLatIdx = headerParts.findIndex((col) => col === 'min_lat');
      const maxLngIdx = headerParts.findIndex((col) => col === 'max_lng');
      const maxLatIdx = headerParts.findIndex((col) => col === 'max_lat');
      const slopeDegIdx = headerParts.findIndex(
        (col) => col === 'slope_deg' || col === 'slope-deg'
      );
      const aspectDegIdx = headerParts.findIndex(
        (col) => col === 'aspect_deg' || col === 'aspect-deg'
      );

      if (mapboxIdIdx === -1 || nameIdx === -1) {
        console.error(
          '[useGlacierSearch] Required columns not found in CSV. Header:',
          headerParts
        );
        return;
      }

      const index = [];
      // Parse data rows (skip header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);

        const maxIdx = Math.max(
          mapboxIdIdx,
          nameIdx,
          sgiIdIdx >= 0 ? sgiIdIdx : -1,
          minLngIdx >= 0 ? minLngIdx : -1,
          minLatIdx >= 0 ? minLatIdx : -1,
          maxLngIdx >= 0 ? maxLngIdx : -1,
          maxLatIdx >= 0 ? maxLatIdx : -1,
          slopeDegIdx >= 0 ? slopeDegIdx : -1,
          aspectDegIdx >= 0 ? aspectDegIdx : -1
        );

        if (values.length <= maxIdx) continue;

        const mapboxId = parseInt(values[mapboxIdIdx]);
        if (isNaN(mapboxId)) continue;

        const entry = {
          mapbox_id: mapboxId,
          name: values[nameIdx] || '',
          sgi_id: sgiIdIdx >= 0 ? values[sgiIdIdx] || '' : '',
        };

        // Add bounds if available
        if (
          minLngIdx >= 0 &&
          minLatIdx >= 0 &&
          maxLngIdx >= 0 &&
          maxLatIdx >= 0
        ) {
          const minLng = parseFloat(values[minLngIdx]);
          const minLat = parseFloat(values[minLatIdx]);
          const maxLng = parseFloat(values[maxLngIdx]);
          const maxLat = parseFloat(values[maxLatIdx]);

          if (
            !isNaN(minLng) &&
            !isNaN(minLat) &&
            !isNaN(maxLng) &&
            !isNaN(maxLat)
          ) {
            entry.bounds = {
              min_lng: minLng,
              min_lat: minLat,
              max_lng: maxLng,
              max_lat: maxLat,
            };
          }
        }

        // Add slope and aspect if available
        if (slopeDegIdx >= 0 && values.length > slopeDegIdx) {
          const slopeDeg = parseFloat(values[slopeDegIdx]);
          if (!isNaN(slopeDeg)) {
            entry.slope_deg = slopeDeg;
          }
        }

        if (aspectDegIdx >= 0 && values.length > aspectDegIdx) {
          const aspectDeg = parseFloat(values[aspectDegIdx]);
          if (!isNaN(aspectDeg)) {
            entry.aspect_deg = aspectDeg;
          }
        }

        index.push(entry);
      }

      glacierSearchIndex.value = index;
      const entriesWithBounds = index.filter((e) => e.bounds).length;
      if (entriesWithBounds === 0 && index.length > 0) {
        console.warn(
          '[useGlacierSearch] No entries have bounds! Check if CSV has min_lng, min_lat, max_lng, max_lat columns'
        );
      }
    } catch (error) {
      console.error(
        '[useGlacierSearch] Error loading glacier search index:',
        error
      );
    }
  };

  // Perform search on glacier index
  const handleSearch = async (query) => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      searchResults.value = [];
      showSearchResults.value = false;
      return;
    }

    // Load index if not already loaded
    if (glacierSearchIndex.value.length === 0) {
      await loadGlacierSearchIndex();

      if (glacierSearchIndex.value.length === 0) {
        console.warn(
          '[useGlacierSearch] Search index not available after loading attempt'
        );
        searchResults.value = [];
        showSearchResults.value = false;
        return;
      }
    }

    // Search through index (name only)
    const matches = glacierSearchIndex.value
      .filter((glacier) => {
        const name = (glacier.name || '').toLowerCase();
        return name.includes(trimmedQuery);
      })
      .slice(0, 10)
      .map((glacier) => ({
        id: glacier.mapbox_id,
        name: glacier.name || 'Unnamed Glacier',
        'sgi-id': glacier.sgi_id || null,
        'mapbox-id': glacier.mapbox_id,
        bounds: glacier.bounds || null,
      }));

    searchResults.value = matches;
    showSearchResults.value = matches.length > 0;
  };

  // Clear search query and results
  const handleSearchClear = () => {
    searchQuery.value = '';
    searchResults.value = [];
    showSearchResults.value = false;
  };

  return {
    searchQuery,
    searchResults,
    showSearchResults,
    glacierSearchIndex,

    loadGlacierSearchIndex,
    handleSearch,
    handleSearchClear,
  };
}
