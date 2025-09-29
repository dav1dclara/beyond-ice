<template>
  <div class="cesium-scene">
    <div id="cesium"></div>
  </div>
</template>

<script setup>
import { Viewer } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { ref, onMounted, onBeforeUnmount } from "vue";

const _cesium = {
  viewer: null,
};

const viewerObserver = ref(null);
const viewerWidth = ref(0);
const viewerHeight = ref(0);

function createViewer() {
  _cesium.viewer = new Viewer("cesium", {
    // add cesium options here
  });
  if (window) {
    window.viewer = _cesium.viewer;
  }
}

function observeSize() {
  viewerObserver.value = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const { width, height } = entry.contentRect;
      viewerWidth.value = width;
      viewerHeight.value = height;
      onResize();
    });
  });
  viewerObserver.value.observe(document.querySelector(".cesium-scene"));
}

function onResize() {
  if (_cesium.viewer) {
    _cesium.viewer.resize();
  }
}

async function loadScene() {
  console.log(`START: loadScene`);
  try {
    await import(/* @vite-ignore */ `../cesium.js`);
  } catch (error) {
    console.log(`ERROR: loadScene`, error);
  } finally {
    console.log(`END: loadScene`);
  }
}

onMounted(() => {
  if (_cesium.viewer === null) {
    createViewer();
    observeSize();
    loadScene();
  }
});

onBeforeUnmount(() => {
  if (viewerObserver.value) {
    viewerObserver.value.disconnect();
  }
});
</script>

<style scoped>
.cesium-scene,
#cesium {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
</style>