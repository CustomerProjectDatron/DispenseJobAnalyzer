<script setup lang="ts">
import type { StructureNode } from "../types/analysis";

defineProps<{ node: StructureNode; depth?: number }>();
</script>

<template>
  <li class="node-item" :style="{ '--depth': String(depth ?? 0) }">
    <div class="node-row">
      <span class="node-key">{{ node.key }}</span>
      <span class="node-type">{{ node.type }}</span>
      <span v-if="node.sample" class="node-sample">{{ node.sample }}</span>
    </div>
    <ul v-if="node.children?.length" class="node-children">
      <StructureTree
        v-for="child in node.children"
        :key="`${node.key}-${child.key}`"
        :node="child"
        :depth="(depth ?? 0) + 1"
      />
    </ul>
  </li>
</template>

<style scoped>
.node-item {
  list-style: none;
  margin-left: calc((var(--depth) * 0.35rem));
}

.node-row {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1.2fr;
  gap: 0.5rem;
  font-size: 0.86rem;
  padding: 0.35rem 0.45rem;
  border-bottom: 1px dashed rgba(63, 83, 62, 0.18);
}

.node-key {
  font-weight: 600;
  color: #133020;
}

.node-type {
  color: #35563f;
}

.node-sample {
  color: #6d3a1f;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.node-children {
  margin: 0;
  padding: 0.15rem 0 0.15rem 0.55rem;
}
</style>
