import { ref, nextTick } from 'vue';

// Delay before showing tooltip on hover (ms)
const TOOLTIP_DELAY = 500;

/**
 * Composable for glacier tooltip functionality
 * Handles tooltip visibility, positioning, and display timing
 *
 * @param {Ref<HTMLElement>} mapboxCanvas - The Mapbox canvas element
 * @param {Ref} tooltipElement - Vue component ref for the tooltip element
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @returns {Object} Tooltip state and control functions
 */
export function useGlacierTooltip(mapboxCanvas, tooltipElement, map) {
  const tooltip = ref({
    visible: false,
    feature: null,
    x: 0,
    y: 0,
  });

  let tooltipTimer = null;

  // Calculate tooltip position to keep it within canvas bounds
  const calculateTooltipPosition = (pointX, pointY) => {
    if (!mapboxCanvas.value || !map.value) {
      return { x: pointX + 10, y: pointY - 10 };
    }

    const canvas = mapboxCanvas.value;
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;

    let tooltipWidth = 200;
    let tooltipHeight = 100;

    if (tooltipElement.value?.$el) {
      const tooltipEl = tooltipElement.value.$el;
      if (tooltipEl.offsetWidth > 0 && tooltipEl.offsetHeight > 0) {
        tooltipWidth = tooltipEl.offsetWidth;
        tooltipHeight = tooltipEl.offsetHeight;
      }
    }

    let x = pointX;
    let y = pointY;

    const wouldOverflowRight = x + tooltipWidth > canvasWidth;
    if (wouldOverflowRight) {
      x = pointX - tooltipWidth;
    } else {
      if (pointX < 50) {
        x = pointX + 50;
      }
    }

    if (y + tooltipHeight > canvasHeight) {
      y = pointY - tooltipHeight;
    }

    if (x < 0) {
      x = 0;
    }
    if (x + tooltipWidth > canvasWidth) {
      x = canvasWidth - tooltipWidth;
    }
    if (y < 0) {
      y = 0;
    }
    if (y + tooltipHeight > canvasHeight) {
      y = canvasHeight - tooltipHeight;
    }

    return { x, y };
  };

  // Show tooltip after delay, recalculating position after render
  const showTooltip = (feature, pointX, pointY) => {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
    }

    tooltipTimer = setTimeout(() => {
      const position = calculateTooltipPosition(pointX, pointY);
      tooltip.value = {
        visible: true,
        feature: feature,
        x: position.x,
        y: position.y,
      };
      tooltipTimer = null;
      nextTick(() => {
        if (tooltip.value.visible) {
          const actualPosition = calculateTooltipPosition(pointX, pointY);
          tooltip.value.x = actualPosition.x;
          tooltip.value.y = actualPosition.y;
        }
      });
    }, TOOLTIP_DELAY);
  };

  // Hide tooltip and clear pending timer
  const hideTooltip = () => {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
    tooltip.value.visible = false;
    tooltip.value.feature = null;
  };

  // Cleanup timer on unmount
  const cleanup = () => {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
  };

  return {
    tooltip,
    calculateTooltipPosition,
    showTooltip,
    hideTooltip,
    cleanup,
    TOOLTIP_DELAY,
  };
}

