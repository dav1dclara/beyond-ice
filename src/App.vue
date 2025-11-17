<template>
  <!-- <Map /> -->
  <MapboxViewer />
</template>

<script setup>
import MapboxViewer from "./components/MapboxViewer.vue";
// import Map from "./components/Map.vue";

// Hot module replacement for development
// This will ensure the page is fully (and not just partially) reloaded when the src/App.vue file is changed.

import.meta.hot?.on("vite:beforeUpdate", (e) => {
  if (e.updates.some(({ path }) => path === "/src/App.vue"))
    location.reload();
});
</script>

<style>
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
</style>