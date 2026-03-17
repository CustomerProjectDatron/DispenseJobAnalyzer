export type IssueLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  level: IssueLevel;
  code: string;
  message: string;
  path?: string;
}

export interface SectionStats {
  sectionName: string;
  columns: number;
  totalPoints: number;
  emptyColumns: number;
  columnNames: string[];
  pointLengths: number[];
}

export interface ContourStats {
  index: number;
  settingsWrapperCount: number;
  path: SectionStats;
  scanData: SectionStats;
  qsHeightData: SectionStats;
}

export interface RootMetadata {
  programName?: string;
  machineNumber?: string;
  partId?: string;
  productionDate?: string;
  geometryFile?: string;
}

export interface FieldTypeStat {
  path: string;
  types: string[];
  samples: string[];
}

export interface StructureNode {
  key: string;
  type: string;
  sample?: string;
  children?: StructureNode[];
}

export interface AnalysisReport {
  metadata: RootMetadata;
  contourCount: number;
  contourStats: ContourStats[];
  fieldStats: FieldTypeStat[];
  structureTree: StructureNode;
  issues: ValidationIssue[];
}
