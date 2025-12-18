<template>
  <div class="top-left-visualization">
    <div class="visualization-dropdown-wrapper">
      <div class="visualization-dropdown" @click.stop="showVisualizationDropdown = !showVisualizationDropdown">
        <button class="visualization-dropdown-button">
          <span>{{ getVisualizationLabel(modelValue) }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ rotated: showVisualizationDropdown }">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <Transition name="dropdown">
          <div v-if="showVisualizationDropdown" class="visualization-dropdown-menu" @click.stop>
            <button
              @click.stop="handleVisualizationChange('uniform')"
              :class="{ active: modelValue === 'uniform' }"
              class="visualization-dropdown-item"
            >
              Uniform
            </button>
            <button
              @click.stop="handleVisualizationChange('area-change')"
              :class="{ active: modelValue === 'area-change' }"
              class="visualization-dropdown-item"
            >
              Area Change
            </button>
            <button
              @click.stop="handleVisualizationChange('volume-change')"
              :class="{ active: modelValue === 'volume-change' }"
              class="visualization-dropdown-item"
            >
              Volume Change
            </button>
            <button
              @click.stop="handleVisualizationChange('bivariate')"
              :class="{ active: modelValue === 'bivariate' }"
              class="visualization-dropdown-item"
            >
              Bivariate (Area & Volume)
            </button>
          </div>
        </Transition>
      </div>
      <!-- Legend attached below dropdown -->
      <div class="visualization-legend">
        <div v-if="modelValue === 'uniform'" class="legend-content">
          <div class="legend-item">
            <div class="legend-color" :style="{ backgroundColor: COLORS.glacier.default }"></div>
            <span class="legend-label">Glacier</span>
          </div>
        </div>
        <div v-else-if="modelValue === 'area-change'" class="legend-content">
          <div class="legend-gradient-bar-horizontal">
            <div class="legend-labels-horizontal">
              <span class="legend-label-left">0%</span>
              <span class="legend-label-right">-100%</span>
            </div>
            <div 
              class="legend-gradient-horizontal" 
              :style="{
                background: `linear-gradient(to right, ${COLORS.visualization.neutral} 0%, ${COLORS.visualization.negativeLight} 50%, ${COLORS.visualization.negative} 100%)`
              }"
            ></div>
          </div>
        </div>
        <div v-else-if="modelValue === 'volume-change'" class="legend-content">
          <div class="legend-gradient-bar-horizontal">
            <div class="legend-labels-horizontal">
              <span class="legend-label-left">0%</span>
              <span class="legend-label-right">-100%</span>
            </div>
            <div 
              class="legend-gradient-horizontal" 
              :style="{
                background: `linear-gradient(to right, ${COLORS.visualization.neutral} 0%, ${COLORS.visualization.negativeLight} 50%, ${COLORS.visualization.negative} 100%)`
              }"
            ></div>
          </div>
        </div>
        <div v-else-if="modelValue === 'bivariate'" class="legend-content">
          <div class="legend-bivariate" style="--canvas-size: 160px;">
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <div>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <canvas 
                    ref="bivariateCanvas" 
                    class="legend-bivariate-canvas"
                    :width="160"
                    :height="160"
                  ></canvas>
                  <div class="legend-bivariate-axis-container-vertical">
                    <div class="legend-bivariate-axis-vertical">
                      <span class="legend-label-top">0%</span>
                      <span class="legend-label-bottom">-100%</span>
                    </div>
                    <div class="legend-bivariate-axis-label-vertical">
                      <span class="legend-label">Area change since 2020</span>
                    </div>
                  </div>
                </div>
                <div class="legend-bivariate-axis-container-horizontal">
                  <div class="legend-bivariate-axis" style="margin-top: 4px;">
                    <span class="legend-label-top">0%</span>
                    <span class="legend-label-bottom">-100%</span>
                  </div>
                  <div class="legend-bivariate-axis-label" style="margin-top: 4px; text-align: center;">
                    <span class="legend-label">Volume change since 2020</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { COLORS } from '../config/colors.js'

const props = defineProps({
  modelValue: {
    type: String,
    default: 'uniform'
  }
})

const emit = defineEmits(['update:modelValue'])

const showVisualizationDropdown = ref(false)
const bivariateCanvas = ref(null)

// Get visualization label for dropdown button
const getVisualizationLabel = (mode) => {
  const labels = {
    'uniform': 'Uniform',
    'area-change': 'Area Change',
    'volume-change': 'Volume Change',
    'bivariate': 'Bivariate (Area & Volume)'
  }
  return labels[mode] || 'Uniform'
}

// Function to draw continuous bivariate color field on canvas
const drawBivariateLegend = () => {
  if (!bivariateCanvas.value) return
  
  const canvas = bivariateCanvas.value
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  
  // Corner colors as RGB
  const lowLow = { r: 232, g: 244, b: 248 }   // #E8F4F8
  const highLow = { r: 231, g: 76, b: 60 }   // #E74C3C
  const lowHigh = { r: 52, g: 152, b: 219 }  // #3498DB
  const highHigh = { r: 44, g: 62, b: 80 }   // #2C3E50
  
  // Bilinear interpolation function
  const interpolateColor = (x, y) => {
    // x and y are normalized 0-1 (x = area, y = volume)
    const r = Math.round(
      (1 - x) * (1 - y) * lowLow.r +
      x * (1 - y) * highLow.r +
      (1 - x) * y * lowHigh.r +
      x * y * highHigh.r
    )
    const g = Math.round(
      (1 - x) * (1 - y) * lowLow.g +
      x * (1 - y) * highLow.g +
      (1 - x) * y * lowHigh.g +
      x * y * highHigh.g
    )
    const b = Math.round(
      (1 - x) * (1 - y) * lowLow.b +
      x * (1 - y) * highLow.b +
      (1 - x) * y * lowHigh.b +
      x * y * highHigh.b
    )
    return `rgb(${r}, ${g}, ${b})`
  }
  
  // Draw each pixel with interpolated color
  const imageData = ctx.createImageData(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const normalizedX = x / width  // 0 to 1 (area change: left = low, right = high)
      const normalizedY = y / height // 0 to 1 (volume change: top = low, bottom = high)
      
      const color = interpolateColor(normalizedX, normalizedY)
      const rgb = color.match(/\d+/g)
      const r = parseInt(rgb[0])
      const g = parseInt(rgb[1])
      const b = parseInt(rgb[2])
      
      const index = (y * width + x) * 4
      imageData.data[index] = r
      imageData.data[index + 1] = g
      imageData.data[index + 2] = b
      imageData.data[index + 3] = 255
    }
  }
  
  ctx.putImageData(imageData, 0, 0)
}

// Handle visualization change
const handleVisualizationChange = (mode) => {
  // Close dropdown immediately
  showVisualizationDropdown.value = false
  
  if (props.modelValue === mode) {
    return // Already in this mode
  }
  
  emit('update:modelValue', mode)
  
  // Redraw bivariate legend if switching to bivariate mode
  if (mode === 'bivariate') {
    nextTick(() => {
      drawBivariateLegend()
    })
  }
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (!event.target.closest('.visualization-dropdown-wrapper')) {
    showVisualizationDropdown.value = false
  }
}

// Setup click outside handler for dropdown
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  
  // Draw bivariate legend if in bivariate mode
  if (props.modelValue === 'bivariate') {
    nextTick(() => {
      drawBivariateLegend()
    })
  }
})

// Watch for visualization changes to redraw legend
watch(() => props.modelValue, (newVal) => {
  if (newVal === 'bivariate') {
    nextTick(() => {
      drawBivariateLegend()
    })
  }
})

// Cleanup on unmount
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.top-left-visualization {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
}

.visualization-dropdown-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 250px;
}

.visualization-dropdown {
  position: relative;
}

.visualization-dropdown-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  height: 40px;
  width: 100%;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.visualization-dropdown-button:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
}

.visualization-dropdown-button svg {
  transition: transform 0.2s;
  flex-shrink: 0;
}

.visualization-dropdown-button svg.rotated {
  transform: rotate(180deg);
}

.visualization-dropdown-menu {
  position: absolute;
  top: 0;
  left: calc(100% + 8px);
  width: 160px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1001;
}

.visualization-dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
  font-family: inherit;
}

.visualization-dropdown-item:hover {
  background: #f5f5f5;
  color: #333;
}

.visualization-dropdown-item.active {
  background: #e8f4f8;
  color: #333;
  font-weight: 600;
}

.visualization-legend {
  margin-top: 0;
  background: white;
  border: 1px solid #e5e5e5;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 12px;
  width: 100%;
  box-sizing: border-box;
  z-index: 1000;
}

.legend-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.legend-label {
  font-size: 12px;
  color: #666;
}

.legend-gradient-bar-horizontal {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.legend-gradient-horizontal {
  width: 100%;
  height: 20px;
  border-radius: 4px;
  border: none;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.legend-labels-horizontal {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  padding: 0 2px;
}

.legend-label-left,
.legend-label-right {
  font-size: 12px;
  color: #666;
}

.legend-bivariate {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* outline: red solid 1px; */
}

.legend-bivariate-canvas {
  width: var(--canvas-size, 160px);
  height: var(--canvas-size, 160px);
  /* border: 1px solid rgba(0, 0, 0, 0.1); */
  /* border-radius: 4px; */
  display: block;
  box-sizing: border-box;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  /* outline: blue solid 1px; */
}

.legend-bivariate-axis-container-horizontal {
  display: flex;
  flex-direction: column;
  width: var(--canvas-size, 160px);
  box-sizing: border-box;
  /* outline: green solid 1px; */
}

.legend-bivariate-axis {
  display: flex;
  justify-content: space-between;
  /* padding: 0 2px; */
  width: 100%;
  /* outline: grey solid 1px; */
}

.legend-bivariate-axis-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
  text-align: center;
  width: 100%;
  /* outline: orange solid 1px; */
}

.legend-bivariate-axis-container-vertical {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: var(--canvas-size, 160px);
  box-sizing: border-box;
  /* outline: green solid 1px; */
}

.legend-bivariate-axis-vertical {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  /* padding: 2px 0; */
  align-items: flex-start;
  /* outline: grey solid 1px; */
}

.legend-bivariate-axis-label-vertical {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--canvas-size, 160px);
  font-size: 12px;
  color: #666;
  font-weight: 500;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  /* outline: orange solid 1px; */
}

.legend-label-top,
.legend-label-bottom {
  font-size: 12px;
  color: #666;
}

/* Dropdown transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateX(0);
}
</style>
