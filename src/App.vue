<template>
  <Map />
</template>

<script setup>
import Map from "./components/Map.vue";

// Hot module replacement for development
// This will ensure the page is fully (and not just partially) reloaded when the src/App.vue file is changed.

import.meta.hot?.on("vite:beforeUpdate", (e) => {
  if (e.updates.some(({ path }) => path === "/src/App.vue"))
    location.reload();
});
</script>

<style>
/* Color variables - defined in src/config/colors.js */
:root {
  --color-glacier-default: #87CEEB;
  --color-glacier-selected: #1E90FF;
  --color-glacier-current-year: #4682B4;
  --color-glacier-outline: #87CEEB;
  --color-visualization-negative: #1E3A8A;
  --color-visualization-negative-light: #3B82F6;
  --color-visualization-neutral: #FFFFFF;
  --color-visualization-positive-light: #F87171;
  --color-visualization-positive: #DC2626;
  --color-visualization-missing: #E5E5E5;
}

/* Reset default browser styles */
body, html {
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

#app {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Hide Mapbox logo watermark */
.mapboxgl-ctrl-logo {
  display: none !important;
}
</style>