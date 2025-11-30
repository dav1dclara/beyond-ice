import { ref } from 'vue'
import { PROJECTION_CONFIG } from '../config/projections.js'
import { DEFAULT_VISUALIZATION } from '../config/visualization.js'

/**
 * Composable for managing all map-related state
 * Includes projection, year, visualization, selection, and search state
 * 
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance (optional, for search)
 * @param {Ref<string>} activeLayerId - Active layer ID ref (optional, for search)
 * @returns {Object} All map-related reactive state and functions
 */
export function useMapState(map = null, activeLayerId = null) {
  // Projection and visualization state
  const currentYear = ref(PROJECTION_CONFIG.DEFAULT_YEAR)
  const projection = ref(PROJECTION_CONFIG.DEFAULT_PROJECTION)
  const visualization = ref(DEFAULT_VISUALIZATION)
  
  // Selection state
  const selectedGlacier = ref(null)
  const selectedGlacierId = ref(null)
  const isFilterActive = ref(false)
  
  // Search state
  const searchQuery = ref('')
  const searchResults = ref([])
  const showSearchResults = ref(false)
  
  /**
   * Clear search state
   */
  const clearSearch = () => {
    searchQuery.value = ''
    searchResults.value = []
    showSearchResults.value = false
  }
  
  /**
   * Search for glaciers by name
   * @param {string} query - Search query string
   */
  const search = (query) => {
    if (!map?.value || !activeLayerId?.value) {
      showSearchResults.value = false
      searchResults.value = []
      return
    }
    
    const trimmedQuery = query.trim()
    
    // Hide dropdown if query is empty
    if (!trimmedQuery) {
      showSearchResults.value = false
      searchResults.value = []
      return
    }
    
    try {
      // Get all features from the active layer
      const features = map.value.querySourceFeatures(activeLayerId.value)
      
      if (!features || features.length === 0) {
        showSearchResults.value = false
        searchResults.value = []
        return
      }
      
      // Search for matching glaciers by name (case-insensitive, partial match)
      const searchQueryLower = trimmedQuery.toLowerCase()
      const matches = features
        .filter(feature => {
          const name = feature.properties?.name
          if (!name) return false
          return name.toLowerCase().includes(searchQueryLower)
        })
        .slice(0, 10) // Limit to 10 results
        .map(feature => {
          // Extract feature ID - use mapbox-id as primary
          const mapboxId = feature.id || feature.properties?.['mapbox-id']
          
          return {
            id: mapboxId,
            name: feature.properties.name,
            'sgi-id': feature.properties['sgi-id'] || null,
            'mapbox-id': mapboxId,
            feature: feature
          }
        })
      
      searchResults.value = matches
      showSearchResults.value = true
    } catch (error) {
      console.error('[useMapState] Error searching:', error)
      showSearchResults.value = false
      searchResults.value = []
    }
  }
  
  return {
    // Projection and visualization
    currentYear,
    projection,
    visualization,
    
    // Selection
    selectedGlacier,
    selectedGlacierId,
    isFilterActive,
    
    // Search
    searchQuery,
    searchResults,
    showSearchResults,
    search,
    clearSearch
  }
}
