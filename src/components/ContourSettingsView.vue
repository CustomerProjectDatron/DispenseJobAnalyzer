<script setup lang="ts">
import { computed, ref, watch } from "vue";

interface UnknownRecord {
  [key: string]: unknown;
}

interface PropertyRow {
  property: string;
  isSet: string;
  isImplicitlySet: string;
  value: string;
}

interface SettingsGroup {
  name: string;
  rows: PropertyRow[];
}

const groupExpandedState = ref<Record<string, boolean>>({});

const props = defineProps<{
  contour: unknown | null;
  contourIndex: number | null;
}>();

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWrapper(value: unknown): value is UnknownRecord {
  if (!isRecord(value)) return false;
  return "isSet" in value && ("value" in value || "limits" in value);
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (isRecord(value)) return JSON.stringify(value);
  return "-";
}

function toBoolText(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return "-";
}

function flattenRows(value: unknown, path = ""): PropertyRow[] {
  if (isWrapper(value)) {
    const wrappedValue = "value" in value ? value.value : value.limits;
    return [
      {
        property: path || "value",
        isSet: toBoolText(value.isSet),
        isImplicitlySet: toBoolText(value.isImplicitlySet),
        value: stringifyValue(wrappedValue)
      }
    ];
  }

  if (Array.isArray(value)) {
    return [
      {
        property: path || "array",
        isSet: "-",
        isImplicitlySet: "-",
        value: `[${value.length} items]`
      }
    ];
  }

  if (!isRecord(value)) {
    return [
      {
        property: path || "value",
        isSet: "-",
        isImplicitlySet: "-",
        value: stringifyValue(value)
      }
    ];
  }

  const rows: PropertyRow[] = [];
  Object.entries(value).forEach(([key, nestedValue]) => {
    const nextPath = path ? `${path}.${key}` : key;

    if (isWrapper(nestedValue)) {
      const wrappedValue = "value" in nestedValue ? nestedValue.value : nestedValue.limits;
      rows.push({
        property: nextPath,
        isSet: toBoolText(nestedValue.isSet),
        isImplicitlySet: toBoolText(nestedValue.isImplicitlySet),
        value: stringifyValue(wrappedValue)
      });
      return;
    }

    if (isRecord(nestedValue) || Array.isArray(nestedValue)) {
      rows.push(...flattenRows(nestedValue, nextPath));
      return;
    }

    rows.push({
      property: nextPath,
      isSet: "-",
      isImplicitlySet: "-",
      value: stringifyValue(nestedValue)
    });
  });

  return rows;
}

const settingsGroups = computed<SettingsGroup[]>(() => {
  if (!isRecord(props.contour) || !isRecord(props.contour.settings)) {
    return [];
  }

  return Object.entries(props.contour.settings).map(([groupName, groupValue]) => {
    return {
      name: groupName,
      rows: flattenRows(groupValue)
    };
  });
});

watch(
  settingsGroups,
  (groups) => {
    groups.forEach((group) => {
      if (!(group.name in groupExpandedState.value)) {
        groupExpandedState.value[group.name] = true;
      }
    });
  },
  { immediate: true }
);

function isGroupExpanded(groupName: string): boolean {
  return groupExpandedState.value[groupName] ?? true;
}

function toggleGroup(groupName: string): void {
  groupExpandedState.value[groupName] = !isGroupExpanded(groupName);
}
</script>

<template>
  <article class="card">
    <h2>Selected contour settings</h2>
    <p class="subtitle" v-if="contourIndex !== null">Selection: Contour {{ contourIndex }}</p>
    <p v-else class="subtitle">No contour selected</p>

    <div v-if="settingsGroups.length === 0" class="empty">
      No settings were found for the current selection.
    </div>

    <div class="table-wrap" v-if="settingsGroups.length > 0">
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>isSet</th>
            <th>isImplicitlySet</th>
            <th>value</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in settingsGroups" :key="group.name">
            <tr class="group-row">
              <td colspan="4">
                <button class="group-toggle" type="button" @click="toggleGroup(group.name)">
                  <span class="caret">{{ isGroupExpanded(group.name) ? "▼" : "▶" }}</span>
                  <span>{{ group.name }}</span>
                  <span class="group-count">({{ group.rows.length }} rows)</span>
                </button>
              </td>
            </tr>

            <tr
              v-for="row in group.rows"
              v-show="isGroupExpanded(group.name)"
              :key="`${group.name}-${row.property}`"
            >
              <td>{{ row.property }}</td>
              <td>{{ row.isSet }}</td>
              <td>{{ row.isImplicitlySet }}</td>
              <td>{{ row.value }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </article>
</template>

<style scoped>
.subtitle {
  color: #9eb8ab;
  font-size: 0.88rem;
  margin-bottom: 0.8rem;
}

.empty {
  border: 1px dashed #3d5e4e;
  border-radius: 10px;
  padding: 0.8rem;
  color: #9eb8ab;
  font-size: 0.88rem;
}

.table-wrap {
  overflow: auto;
}

.group-row td {
  background: rgba(28, 53, 40, 0.72);
  padding: 0;
}

.group-toggle {
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.5rem 0.55rem;
  text-align: left;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  font-weight: 650;
  color: #d7e7de;
}

.caret {
  width: 1rem;
  display: inline-flex;
  justify-content: center;
}

.group-count {
  color: #8daf9e;
  font-weight: 500;
}

td {
  word-break: break-word;
}

@media (max-width: 760px) {
  table {
    font-size: 0.78rem;
  }
}
</style>
