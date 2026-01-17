export interface DatasetInfo {
  name: string;
  shape: [number, number];
  columns: string[];
  dtypes: Record<string, string>;
  missing_values: Record<string, number>;
  memory_usage: string;
}

export interface ColumnAnalysis {
  column: string;
  type: string;
  unique_values?: number;
  most_frequent?: any;
  frequency?: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  quartiles?: number[];
}

export interface MLStep {
  id: number;
  name: string;
  completed: boolean;
  active: boolean;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export interface TooltipInfo {
  title: string;
  description: string;
}