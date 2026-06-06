export interface Project {
  id: string
  user_id: string
  name: string
  filename: string | null
  status: 'active' | 'completed' | 'failed'
  current_step: PipelineStep
  columns: string[] | null
  shape: [number, number] | null
  dtypes: Record<string, string> | null
  created_at: string
  updated_at: string
}

export interface DatasetInfo {
  project_id: string
  data: unknown[][]
  columns: string[]
  shape: [number, number]
  missing_values: Record<string, number>
  categorical_columns: string[] | null
}

export interface ColumnAnalysis {
  column: string
  type: 'numeric' | 'categorical'
  count: number
  mean?: number
  std?: number
  min?: number
  max?: number
  quartiles?: [number, number, number]
  unique_values?: number
  most_frequent?: string | number
  frequency?: number
}

export interface TrainMetrics {
  accuracy: number
  precision?: number
  recall?: number
  f1_score?: number
  r2?: number
  rmse?: number
  mae?: number
}

export type PipelineStep =
  | 'upload'
  | 'analyze'
  | 'missing-values'
  | 'outliers'
  | 'encoding'
  | 'correlation'
  | 'scaling'
  | 'training'
  | 'evaluation'
  | 'optimization'
  | 'export';

export type AppPage = 'dashboard' | 'pipeline' | 'projects' | 'settings';

export type StepStatus = 'completed' | 'active' | 'pending';

export interface PipelineStepConfig {
  id: PipelineStep;
  label: string;
  status: StepStatus;
}
