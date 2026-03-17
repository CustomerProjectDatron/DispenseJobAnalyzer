import type {
  AnalysisReport,
  ContourStats,
  FieldTypeStat,
  SectionStats,
  StructureNode,
  ValidationIssue
} from "../types/analysis";

interface UnknownRecord {
  [key: string]: unknown;
}

const SAMPLE_LIMIT = 3;
const MAX_TREE_DEPTH = 5;
const MAX_TREE_CHILDREN = 20;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function primitiveType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function toSample(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (isRecord(value)) return "{object}";
  return "unknown";
}

function collectFieldStats(
  value: unknown,
  path: string,
  map: Map<string, { types: Set<string>; samples: Set<string> }>
): void {
  const entry = map.get(path) ?? { types: new Set<string>(), samples: new Set<string>() };
  entry.types.add(primitiveType(value));
  entry.samples.add(toSample(value));
  map.set(path, entry);

  if (Array.isArray(value)) {
    value.slice(0, MAX_TREE_CHILDREN).forEach((item, index) => {
      collectFieldStats(item, `${path}[${index}]`, map);
    });
    return;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, nested]) => {
      collectFieldStats(nested, `${path}.${key}`, map);
    });
  }
}

function buildStructureTree(value: unknown, key: string, depth = 0): StructureNode {
  const node: StructureNode = { key, type: primitiveType(value), sample: toSample(value) };
  if (depth >= MAX_TREE_DEPTH) {
    return node;
  }

  if (Array.isArray(value)) {
    const children: StructureNode[] = [];
    if (value.length > 0) {
      children.push(buildStructureTree(value[0], "[0]", depth + 1));
    }
    if (value.length > 1) {
      children.push({ key: "[...]", type: `+${value.length - 1} weitere`, sample: undefined });
    }
    node.children = children;
    return node;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).slice(0, MAX_TREE_CHILDREN);
    node.children = entries.map(([nestedKey, nestedValue]) =>
      buildStructureTree(nestedValue, nestedKey, depth + 1)
    );
  }

  return node;
}

function collectSectionStats(sectionName: string, section: unknown): SectionStats {
  if (!Array.isArray(section)) {
    return {
      sectionName,
      columns: 0,
      totalPoints: 0,
      emptyColumns: 0,
      columnNames: [],
      pointLengths: []
    };
  }

  const columnNames: string[] = [];
  const pointLengths: number[] = [];

  section.forEach((column) => {
    if (!isRecord(column)) return;
    const name = typeof column.columnName === "string" ? column.columnName : "(ohne Name)";
    const data = Array.isArray(column.data) ? column.data : [];
    columnNames.push(name);
    pointLengths.push(data.length);
  });

  return {
    sectionName,
    columns: columnNames.length,
    totalPoints: pointLengths.reduce((sum, len) => sum + len, 0),
    emptyColumns: pointLengths.filter((len) => len === 0).length,
    columnNames,
    pointLengths
  };
}

function countSettingsWrappers(value: unknown): number {
  if (!isRecord(value)) return 0;

  const keys = Object.keys(value);
  const isWrapper =
    keys.includes("isSet") && keys.includes("isImplicitlySet") && keys.includes("value");

  let total = isWrapper ? 1 : 0;
  Object.values(value).forEach((nested) => {
    if (Array.isArray(nested)) {
      nested.forEach((item) => {
        total += countSettingsWrappers(item);
      });
      return;
    }
    total += countSettingsWrappers(nested);
  });

  return total;
}

function uniqueCount(values: number[]): number {
  return new Set(values).size;
}

export function analyzeDispenseJson(input: unknown): AnalysisReport {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      metadata: {},
      contourCount: 0,
      contourStats: [],
      fieldStats: [],
      structureTree: buildStructureTree(input, "root"),
      issues: [
        {
          level: "error",
          code: "ROOT_NOT_OBJECT",
          message: "Die JSON-Datei muss ein Objekt auf Root-Ebene enthalten.",
          path: "root"
        }
      ]
    };
  }

  const metadata = {
    programName: typeof input.programName === "string" ? input.programName : undefined,
    machineNumber: typeof input.machineNumber === "string" ? input.machineNumber : undefined,
    partId: typeof input.partId === "string" ? input.partId : undefined,
    productionDate: typeof input.productionDate === "string" ? input.productionDate : undefined,
    geometryFile: typeof input.geometryFile === "string" ? input.geometryFile : undefined
  };

  if (!metadata.programName) {
    issues.push({
      level: "warning",
      code: "MISSING_PROGRAM_NAME",
      message: "Feld programName fehlt oder ist nicht vom Typ String.",
      path: "programName"
    });
  }

  if (!metadata.machineNumber) {
    issues.push({
      level: "warning",
      code: "MISSING_MACHINE_NUMBER",
      message: "Feld machineNumber fehlt oder ist nicht vom Typ String.",
      path: "machineNumber"
    });
  }

  if (metadata.partId === "") {
    issues.push({
      level: "info",
      code: "PART_ID_EMPTY",
      message: "partId ist leer. Das kann absichtlich sein, sollte aber geprüft werden.",
      path: "partId"
    });
  }

  const contours = Array.isArray(input.contours) ? input.contours : [];
  if (!Array.isArray(input.contours)) {
    issues.push({
      level: "error",
      code: "CONTOURS_NOT_ARRAY",
      message: "Feld contours fehlt oder ist kein Array.",
      path: "contours"
    });
  }

  const contourStats: ContourStats[] = contours.map((contour, index) => {
    const contourObject = isRecord(contour) ? contour : {};
    const path = collectSectionStats("path", contourObject.path);
    const scanData = collectSectionStats("scanData", contourObject.scanData);
    const qsHeightData = collectSectionStats("qsHeightData", contourObject.qsHeightData);

    if (path.columns === 0) {
      issues.push({
        level: "warning",
        code: "PATH_EMPTY",
        message: `Contour ${index} hat keine path-Spalten.`,
        path: `contours[${index}].path`
      });
    }

    if (uniqueCount(path.pointLengths.filter((len) => len > 0)) > 1) {
      issues.push({
        level: "warning",
        code: "PATH_LENGTH_MISMATCH",
        message: `Contour ${index} hat inkonsistente Punktlängen in path-Spalten.`,
        path: `contours[${index}].path`
      });
    }

    if (scanData.totalPoints === 0) {
      issues.push({
        level: "info",
        code: "SCANDATA_EMPTY",
        message: `Contour ${index} enthält keine scanData Messwerte.`,
        path: `contours[${index}].scanData`
      });
    }

    if (qsHeightData.totalPoints === 0) {
      issues.push({
        level: "info",
        code: "QS_EMPTY",
        message: `Contour ${index} enthält keine qsHeightData Messwerte.`,
        path: `contours[${index}].qsHeightData`
      });
    }

    return {
      index,
      settingsWrapperCount: countSettingsWrappers(contourObject.settings),
      path,
      scanData,
      qsHeightData
    };
  });

  const fieldStatMap = new Map<string, { types: Set<string>; samples: Set<string> }>();
  collectFieldStats(input, "root", fieldStatMap);
  const fieldStats: FieldTypeStat[] = Array.from(fieldStatMap.entries())
    .map(([path, value]) => ({
      path,
      types: Array.from(value.types),
      samples: Array.from(value.samples).slice(0, SAMPLE_LIMIT)
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    metadata,
    contourCount: contours.length,
    contourStats,
    fieldStats,
    structureTree: buildStructureTree(input, "root"),
    issues
  };
}
