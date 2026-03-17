<script setup lang="ts">
import { computed, ref } from "vue";
import ContourPathView from "./components/ContourPathView.vue";
import ContourSettingsView from "./components/ContourSettingsView.vue";
import { analyzeDispenseJson } from "./lib/jsonAnalyzer";
import type { AnalysisReport } from "./types/analysis";

interface UnknownRecord {
  [key: string]: unknown;
}

const fileName = ref<string>("");
const report = ref<AnalysisReport | null>(null);
const sourceData = ref<UnknownRecord | null>(null);
const parseError = ref<string>("");
const isLoading = ref(false);
const selectedContourIndex = ref<number | null>(null);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const contours = computed<unknown[]>(() => {
  if (!sourceData.value || !Array.isArray(sourceData.value.contours)) return [];
  return sourceData.value.contours;
});

const selectedContour = computed<unknown | null>(() => {
  if (selectedContourIndex.value === null) return null;
  return contours.value[selectedContourIndex.value] ?? null;
});

async function processFile(file: File): Promise<void> {
  isLoading.value = true;
  parseError.value = "";
  report.value = null;

  try {
    const rawText = await file.text();
    const parsed = JSON.parse(rawText) as unknown;
    sourceData.value = isRecord(parsed) ? parsed : null;
    report.value = analyzeDispenseJson(parsed);
    selectedContourIndex.value = Array.isArray(sourceData.value?.contours) ? 0 : null;
    fileName.value = file.name;
  } catch (error) {
    sourceData.value = null;
    selectedContourIndex.value = null;
    parseError.value =
      error instanceof Error
        ? `Could not process JSON: ${error.message}`
        : "Unknown error while reading the JSON file.";
  } finally {
    isLoading.value = false;
  }
}

function handleDrop(event: DragEvent): void {
  event.preventDefault();
  const droppedFile = event.dataTransfer?.files?.[0];
  if (!droppedFile) return;
  processFile(droppedFile);
}

function handleFileInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const selectedFile = target.files?.[0];
  if (!selectedFile) return;
  processFile(selectedFile);
}

async function loadSampleData(): Promise<void> {
  isLoading.value = true;
  parseError.value = "";
  report.value = null;

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}sample-data.json`);
    const data = (await response.json()) as unknown;
    sourceData.value = isRecord(data) ? data : null;
    report.value = analyzeDispenseJson(data);
    selectedContourIndex.value = Array.isArray(sourceData.value?.contours) ? 0 : null;
    fileName.value = "sample-data.json";
  } catch (error) {
    sourceData.value = null;
    selectedContourIndex.value = null;
    parseError.value =
      error instanceof Error
        ? `Could not load sample data: ${error.message}`
        : "Unknown error while loading sample data.";
  } finally {
    isLoading.value = false;
  }
}

function selectContour(index: number): void {
  selectedContourIndex.value = index;
}
</script>

<template>
  <main class="app-shell">
    <header class="hero">
      <p class="kicker">Client-side JSON Analyzer</p>
      <h1>Dispense Job Analyzer</h1>
      <p class="hero-copy">
        Drop a JSON file to analyze it locally in your browser. No user data is uploaded to any
        server.
      </p>
    </header>

    <section class="meta-grid top-grid">
      <article class="card">
        <h2>Job info</h2>
        <p><strong>File:</strong> {{ fileName || "-" }}</p>
        <p><strong>Program:</strong> {{ report?.metadata.programName ?? "-" }}</p>
        <p><strong>Machine:</strong> {{ report?.metadata.machineNumber ?? "-" }}</p>
        <p><strong>Part ID:</strong> {{ report?.metadata.partId ?? "-" }}</p>
        <p><strong>Date:</strong> {{ report?.metadata.productionDate ?? "-" }}</p>
      </article>

      <section
        class="dropzone"
        @dragover.prevent
        @drop="handleDrop"
        aria-label="Drop file here"
      >
        <p class="dropzone-title">Drop JSON here</p>
        <p class="dropzone-sub">or choose a file manually</p>
        <input type="file" accept="application/json,.json" @change="handleFileInput" />
        <button type="button" class="sample-btn" @click="loadSampleData">Load sample data</button>
        <p class="privacy-note">Privacy: user data is processed locally and never uploaded.</p>
      </section>
    </section>

    <section v-if="isLoading" class="status-card">Analyzing file ...</section>
    <section v-if="parseError" class="status-card error">{{ parseError }}</section>

    <template v-if="report">
      <section class="analysis-layout">
        <div class="analysis-preview">
          <ContourPathView
            :contours="contours"
            :selected-index="selectedContourIndex"
            @select="selectContour"
          />
        </div>
        <div class="analysis-settings">
          <ContourSettingsView :contour="selectedContour" :contour-index="selectedContourIndex" />
        </div>
      </section>
    </template>
  </main>
</template>
