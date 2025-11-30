<template>
  <div class="glacier-info">
    <div class="info-item">
      <span class="info-label">Name:</span>
      <span class="info-value">{{ selectedGlacier.name || "N/A" }}</span>
    </div>
    <div v-if="selectedGlacier['sgi-id']" class="info-item">
      <span class="info-label">SGI-ID:</span>
      <span class="info-value">{{ selectedGlacier['sgi-id'] }}</span>
    </div>
    <div v-if="selectedGlacier['mapbox-id']" class="info-item">
      <span class="info-label">Mapbox-ID:</span>
      <span class="info-value">{{ selectedGlacier['mapbox-id'] }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  selectedGlacier: {
    type: Object,
    required: true
  }
})
</script>

<style scoped>
.glacier-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}
</style>
