<script setup lang="ts">
import { computed, ref } from "vue";

interface UnknownRecord {
  [key: string]: unknown;
}

interface Point {
  x: number;
  y: number;
}

interface RenderedContour {
  index: number;
  color: string;
  points: Point[];
  pointsText: string;
}

const props = defineProps<{
  contours: unknown[];
  selectedIndex: number | null;
}>();

const emit = defineEmits<{
  select: [index: number];
}>();

const svgElement = ref<SVGSVGElement | null>(null);

const palette = [
  "#0e9f6e",
  "#d16f32",
  "#3367d6",
  "#9a3baa",
  "#b03f63",
  "#417a2d",
  "#8b4a20",
  "#177a8f"
];

const width = 1800;
const height = 620;
const padding = 28;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "number" && Number.isFinite(entry));
}

function extractXYPoints(contour: unknown): Point[] {
  if (!isRecord(contour) || !Array.isArray(contour.path)) return [];

  const xColumn = contour.path.find(
    (entry) => isRecord(entry) && entry.columnName === "x" && Array.isArray(entry.data)
  ) as UnknownRecord | undefined;
  const yColumn = contour.path.find(
    (entry) => isRecord(entry) && entry.columnName === "y" && Array.isArray(entry.data)
  ) as UnknownRecord | undefined;

  const xValues = asNumberArray(xColumn?.data);
  const yValues = asNumberArray(yColumn?.data);
  const pointCount = Math.min(xValues.length, yValues.length);

  const points: Point[] = [];
  for (let i = 0; i < pointCount; i += 1) {
    points.push({ x: xValues[i], y: yValues[i] });
  }
  return points;
}

const rawContours = computed(() => {
  return props.contours.map((contour, index) => ({
    index,
    color: palette[index % palette.length],
    points: extractXYPoints(contour)
  }));
});

const bounds = computed(() => {
  const allPoints = rawContours.value.flatMap((contour) => contour.points);
  if (allPoints.length === 0) {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  allPoints.forEach((point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });

  if (minX === maxX) maxX = minX + 1;
  if (minY === maxY) maxY = minY + 1;

  return { minX, maxX, minY, maxY };
});

const renderedContours = computed<RenderedContour[]>(() => {
  const xRange = bounds.value.maxX - bounds.value.minX;
  const yRange = bounds.value.maxY - bounds.value.minY;
  const drawableWidth = width - 2 * padding;
  const drawableHeight = height - 2 * padding;
  const uniformScale = Math.min(drawableWidth / xRange, drawableHeight / yRange);
  const offsetX = (drawableWidth - xRange * uniformScale) / 2;
  const offsetY = (drawableHeight - yRange * uniformScale) / 2;

  const projectWithUniformScale = (point: Point): Point => ({
    x: padding + offsetX + (point.x - bounds.value.minX) * uniformScale,
    y: padding + offsetY + (bounds.value.maxY - point.y) * uniformScale
  });

  return rawContours.value.map((contour) => {
    const projected = contour.points.map(projectWithUniformScale);
    return {
      index: contour.index,
      color: contour.color,
      points: projected,
      pointsText: projected.map((point) => `${point.x},${point.y}`).join(" ")
    };
  });
});

const hasDrawableData = computed(() => renderedContours.value.some((contour) => contour.points.length > 0));

function selectContour(index: number): void {
  emit("select", index);
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared === 0) {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    return Math.hypot(dx, dy);
  }

  const projection =
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  const nearestX = start.x + t * segmentX;
  const nearestY = start.y + t * segmentY;
  return Math.hypot(point.x - nearestX, point.y - nearestY);
}

function contourDistance(point: Point, contour: RenderedContour): number {
  if (contour.points.length === 0) return Number.POSITIVE_INFINITY;
  if (contour.points.length === 1) {
    return Math.hypot(point.x - contour.points[0].x, point.y - contour.points[0].y);
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < contour.points.length - 1; i += 1) {
    const segmentDistance = distanceToSegment(point, contour.points[i], contour.points[i + 1]);
    if (segmentDistance < bestDistance) {
      bestDistance = segmentDistance;
    }
  }
  return bestDistance;
}

function onSvgClick(event: MouseEvent): void {
  if (!svgElement.value) return;

  const svgPoint = svgElement.value.createSVGPoint();
  svgPoint.x = event.clientX;
  svgPoint.y = event.clientY;

  const matrix = svgElement.value.getScreenCTM();
  if (!matrix) return;
  const transformed = svgPoint.matrixTransform(matrix.inverse());
  const clickPoint: Point = { x: transformed.x, y: transformed.y };

  let nearestIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  renderedContours.value.forEach((contour) => {
    const distance = contourDistance(clickPoint, contour);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = contour.index;
    }
  });

  if (nearestIndex !== null) {
    selectContour(nearestIndex);
  }
}
</script>

<template>
  <article class="card">
    <h2>XY path preview (SVG)</h2>

    <div class="legend">
      <button
        v-for="contour in renderedContours"
        :key="contour.index"
        class="legend-item"
        :class="{ active: contour.index === selectedIndex }"
        type="button"
        @click="selectContour(contour.index)"
      >
        <span class="dot" :style="{ backgroundColor: contour.color }" />
        Contour {{ contour.index }}
      </button>
    </div>

    <div v-if="!hasDrawableData" class="empty">
      No X/Y points found. Expected path columns with columnName x and y.
    </div>

    <svg
      ref="svgElement"
      v-else
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet"
      class="path-svg"
      role="img"
      aria-label="Contour paths in XY"
      @click="onSvgClick"
    >
      <defs>
        <marker
          v-for="contour in renderedContours"
          :key="`marker-${contour.index}`"
          :id="`arrow-${contour.index}`"
          markerWidth="10"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" :fill="contour.color" />
        </marker>
      </defs>

      <rect
        x="0"
        y="0"
        :width="width"
        :height="height"
        fill="var(--plot-bg)"
        stroke="var(--plot-border)"
      />
      <line
        :x1="padding"
        :x2="padding"
        :y1="padding"
        :y2="height - padding"
        stroke="var(--plot-axis)"
        stroke-width="1"
      />
      <line
        :x1="padding"
        :x2="width - padding"
        :y1="height - padding"
        :y2="height - padding"
        stroke="var(--plot-axis)"
        stroke-width="1"
      />

      <g v-for="contour in renderedContours" :key="`path-${contour.index}`">
        <polyline
          v-if="contour.points.length > 1"
          :points="contour.pointsText"
          fill="none"
          :stroke="contour.color"
          :stroke-width="contour.index === selectedIndex ? 4 : 2"
          :opacity="contour.index === selectedIndex ? 1 : 0.74"
          :marker-end="`url(#arrow-${contour.index})`"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="contour-line"
          @click.stop="selectContour(contour.index)"
        />
        <circle
          v-if="contour.points.length > 0"
          :cx="contour.points[0].x"
          :cy="contour.points[0].y"
          :r="contour.index === selectedIndex ? 7 : 5"
          :fill="contour.color"
          :stroke="contour.index === selectedIndex ? '#0f2c1f' : '#ffffff'"
          :stroke-width="contour.index === selectedIndex ? 2 : 1.2"
          class="start-point"
          @click.stop="selectContour(contour.index)"
        />
      </g>
    </svg>
  </article>
</template>

<style scoped>
.card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.path-svg {
  width: 100%;
  min-height: clamp(320px, 56vh, 760px);
  border-radius: 10px;
  cursor: crosshair;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.6rem;
}

.legend-item {
  border: 1px solid rgba(123, 156, 139, 0.28);
  background: rgba(17, 26, 22, 0.92);
  border-radius: 999px;
  padding: 0.22rem 0.62rem;
  font-size: 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  color: #d8e6de;
}

.legend-item.active {
  border-color: #4ca679;
  background: rgba(27, 54, 40, 0.92);
}

.dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
}

.contour-line {
  transition: opacity 180ms ease, stroke-width 180ms ease;
}

.start-point {
  transition: r 180ms ease;
}

.empty {
  border: 1px dashed #3d5e4e;
  border-radius: 10px;
  padding: 0.8rem;
  color: #9eb8ab;
  font-size: 0.88rem;
}

@media (min-width: 1180px) and (orientation: landscape) {
  .path-svg {
    min-height: calc(100vh - 12rem);
  }
}
</style>
