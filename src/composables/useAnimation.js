import { ref, watch, onBeforeUnmount } from 'vue';

/**
 * Composable for animation/playback functionality
 * Handles play/pause animation with interval-based stepping
 *
 * @param {Ref<number>|ComputedRef<number>} currentValue - Current value (e.g., current year)
 * @param {number} minValue - Minimum value
 * @param {number} maxValue - Maximum value
 * @param {number} step - Step size for each animation frame
 * @param {number} speed - Animation speed in milliseconds per step
 * @param {Function} onStep - Callback function called on each step with new value
 * @param {boolean|Ref<boolean>} disabled - Whether animation is disabled
 * @returns {Object} Animation state and control functions
 */
export function useAnimation(
  currentValue,
  minValue,
  maxValue,
  step,
  speed,
  onStep,
  disabled = false
) {
  const isPlaying = ref(false);
  let playInterval = null;

  const startAnimation = () => {
    const isDisabled = typeof disabled === 'object' ? disabled.value : disabled;
    if (isPlaying.value || isDisabled) return;

    isPlaying.value = true;
    let currentValueLocal = currentValue.value;

    playInterval = setInterval(() => {
      const nextValue = currentValueLocal + step;

      if (nextValue > maxValue) {
        currentValueLocal = maxValue;
        stopAnimation();
        onStep(currentValueLocal);
        return;
      }

      currentValueLocal = nextValue;
      onStep(currentValueLocal);
    }, speed);
  };

  const stopAnimation = () => {
    isPlaying.value = false;
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
  };

  const togglePlay = () => {
    const isDisabled = typeof disabled === 'object' ? disabled.value : disabled;
    if (isDisabled) return;
    if (isPlaying.value) {
      stopAnimation();
    } else {
      startAnimation();
    }
  };

  // Stop animation when reaching max value
  watch(
    () => currentValue.value,
    (newValue) => {
      if (newValue >= maxValue && isPlaying.value) {
        stopAnimation();
      }
    }
  );

  // Cleanup on unmount
  onBeforeUnmount(() => {
    stopAnimation();
  });

  return {
    isPlaying,
    startAnimation,
    stopAnimation,
    togglePlay,
  };
}
