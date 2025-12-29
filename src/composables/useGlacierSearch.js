import { ref } from 'vue'

/**
 * Composable for glacier search functionality
 * Handles loading search index from CSV and performing searches
 * 
 * @returns {Object} Search state and functions
 */
export function useGlacierSearch() {
  // Search state
  const searchQuery = ref('')
  const searchResults = ref([])
  const showSearchResults = ref(false)
  const glacierSearchIndex = ref([])

  /**
   * Load glacier search index from CSV
   */
  const loadGlacierSearchIndex = async () => {
    try {
      // Use BASE_URL like the overall CSV files do (works in both dev and production)
      const csvUrl = `${import.meta.env.BASE_URL}data/glacier_index.csv`
      console.log('[useGlacierSearch] Loading glacier search index from', csvUrl)
      const response = await fetch(csvUrl)
      
      if (!response.ok) {
        console.error(`[useGlacierSearch] Could not load glacier search index: ${response.status} ${response.statusText}`)
        console.error(`[useGlacierSearch] Tried path: ${csvUrl}`)
        return
      }
      
      console.log('[useGlacierSearch] Successfully loaded glacier_index.csv')
      const text = await response.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      console.log(`[useGlacierSearch] CSV loaded: ${lines.length} lines`)
      
      if (lines.length < 2) {
        console.warn('[useGlacierSearch] Search index CSV is empty or invalid')
        return
      }
      
      // Parse header to find column indices
      const header = lines[0].toLowerCase()
      const headerParts = []
      let current = ''
      let inQuotes = false
      for (let j = 0; j < header.length; j++) {
        const char = header[j]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          headerParts.push(current.trim().toLowerCase())
          current = ''
        } else {
          current += char
        }
      }
      headerParts.push(current.trim().toLowerCase())
      
      // Find column indices
      const mapboxIdIdx = headerParts.findIndex(col => col === 'mapbox-id' || col === 'mapbox_id')
      const nameIdx = headerParts.findIndex(col => col === 'name')
      const sgiIdIdx = headerParts.findIndex(col => col === 'sgi_id' || col === 'sgi-id')
      const minLngIdx = headerParts.findIndex(col => col === 'min_lng')
      const minLatIdx = headerParts.findIndex(col => col === 'min_lat')
      const maxLngIdx = headerParts.findIndex(col => col === 'max_lng')
      const maxLatIdx = headerParts.findIndex(col => col === 'max_lat')
      const slopeDegIdx = headerParts.findIndex(col => col === 'slope_deg' || col === 'slope-deg')
      const aspectDegIdx = headerParts.findIndex(col => col === 'aspect_deg' || col === 'aspect-deg')
      
      console.log('[useGlacierSearch] CSV columns found:', { mapboxIdIdx, nameIdx, sgiIdIdx, minLngIdx, minLatIdx, maxLngIdx, maxLatIdx, slopeDegIdx, aspectDegIdx, headerParts })
      
      if (mapboxIdIdx === -1 || nameIdx === -1) {
        console.error('[useGlacierSearch] Required columns not found in CSV. Header:', headerParts)
        return
      }
      
      const index = []
      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        // Simple CSV parsing (handles quoted values)
        const values = []
        current = ''
        inQuotes = false
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        values.push(current.trim()) // Add last value
        
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
        )
        
        if (values.length > maxIdx) {
          const mapboxId = parseInt(values[mapboxIdIdx])
          if (!isNaN(mapboxId)) {
            const entry = {
              mapbox_id: mapboxId,
              name: values[nameIdx] || '',
              sgi_id: sgiIdIdx >= 0 ? (values[sgiIdIdx] || '') : ''
            }
            
            // Add bounds if available
            if (minLngIdx >= 0 && minLatIdx >= 0 && maxLngIdx >= 0 && maxLatIdx >= 0) {
              const minLng = parseFloat(values[minLngIdx])
              const minLat = parseFloat(values[minLatIdx])
              const maxLng = parseFloat(values[maxLngIdx])
              const maxLat = parseFloat(values[maxLatIdx])
              
              if (!isNaN(minLng) && !isNaN(minLat) && !isNaN(maxLng) && !isNaN(maxLat)) {
                entry.bounds = {
                  min_lng: minLng,
                  min_lat: minLat,
                  max_lng: maxLng,
                  max_lat: maxLat
                }
              } else {
                // Log if bounds couldn't be parsed for debugging
                if (index.length < 5) { // Only log first few to avoid spam
                  console.warn(`[useGlacierSearch] Could not parse bounds for glacier ${mapboxId}:`, {
                    minLng: values[minLngIdx],
                    minLat: values[minLatIdx],
                    maxLng: values[maxLngIdx],
                    maxLat: values[maxLatIdx]
                  })
                }
              }
            } else {
              // Log if bounds columns not found
              if (index.length < 5) {
                console.warn(`[useGlacierSearch] Bounds columns not found. Indices:`, {
                  minLngIdx, minLatIdx, maxLngIdx, maxLatIdx
                })
              }
            }
            
            // Add slope_deg and aspect_deg if available
            if (slopeDegIdx >= 0 && values.length > slopeDegIdx) {
              const slopeDeg = parseFloat(values[slopeDegIdx])
              if (!isNaN(slopeDeg)) {
                entry.slope_deg = slopeDeg
              }
            }
            
            if (aspectDegIdx >= 0 && values.length > aspectDegIdx) {
              const aspectDeg = parseFloat(values[aspectDegIdx])
              if (!isNaN(aspectDeg)) {
                entry.aspect_deg = aspectDeg
              }
            }
            
            index.push(entry)
          }
        }
      }
      
      glacierSearchIndex.value = index
      console.log(`[useGlacierSearch] ✓ Successfully loaded ${index.length} glaciers into search index`)
      if (index.length > 0) {
        console.log('[useGlacierSearch] Sample entry:', index[0])
        // Check how many entries have bounds
        const entriesWithBounds = index.filter(e => e.bounds).length
        console.log(`[useGlacierSearch] Entries with bounds: ${entriesWithBounds} out of ${index.length}`)
        if (entriesWithBounds === 0) {
          console.warn('[useGlacierSearch] ⚠️ No entries have bounds! Check if CSV has min_lng, min_lat, max_lng, max_lat columns')
        }
      }
    } catch (error) {
      console.error('[useGlacierSearch] Error loading glacier search index:', error)
      console.error('[useGlacierSearch] Error details:', error.message, error.stack)
    }
  }

  /**
   * Handle search query
   */
  const handleSearch = async (query) => {
    const trimmedQuery = query.trim().toLowerCase()
    
    if (!trimmedQuery) {
      searchResults.value = []
      showSearchResults.value = false
      return
    }
    
    // If search index is not loaded, try loading it
    if (glacierSearchIndex.value.length === 0) {
      console.log('[useGlacierSearch] Search index not loaded, attempting to load...')
      await loadGlacierSearchIndex()
      
      if (glacierSearchIndex.value.length === 0) {
        console.warn('[useGlacierSearch] Search index still not available after loading attempt')
        searchResults.value = []
        showSearchResults.value = false
        return
      }
    }
    
    // Search through the index
    const matches = glacierSearchIndex.value
      .filter(glacier => {
        const name = (glacier.name || '').toLowerCase()
        const sgiId = (glacier.sgi_id || '').toLowerCase()
        return name.includes(trimmedQuery) || sgiId.includes(trimmedQuery)
      })
      .slice(0, 10) // Limit to 10 results
      .map(glacier => ({
        id: glacier.mapbox_id,
        name: glacier.name || 'Unnamed Glacier',
        'sgi-id': glacier.sgi_id || null,
        'mapbox-id': glacier.mapbox_id,
        bounds: glacier.bounds || null
      }))
    
    searchResults.value = matches
    showSearchResults.value = matches.length > 0
    console.log(`[useGlacierSearch] Search for "${query}" found ${matches.length} results`)
  }

  /**
   * Clear search
   */
  const handleSearchClear = () => {
    searchQuery.value = ''
    searchResults.value = []
    showSearchResults.value = false
  }

  return {
    // State
    searchQuery,
    searchResults,
    showSearchResults,
    glacierSearchIndex,
    
    // Functions
    loadGlacierSearchIndex,
    handleSearch,
    handleSearchClear
  }
}

