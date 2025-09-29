<template>
  <CesiumViewer />
</template>

<script setup>
import CesiumViewer from "./components/CesiumViewer.vue";

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
}
</style>