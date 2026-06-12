import { apiRequest } from './client'
import type { DatasetInfo } from '../../types'

interface MissingValuesConfig {
  numerical_method?: string
  categorical_method?: string
  column_methods?: Record<string, string> | null
  columns?: string[] | null
}

interface OutliersConfig {
  method: string
  action?: string
  columns?: string[] | null
  factor?: number | null
}

interface EncodingConfig {
  method: string
  column_methods?: Record<string, string> | null
  columns?: string[] | null
}

interface ScalingConfig {
  method: string
  column_methods?: Record<string, string> | null
  columns?: string[] | null
}

interface OutlierResult {
  count: number
  values: number[]
  method: string
}

interface DetectOutliersResponse {
  outlier_results: Record<string, OutlierResult>
}

interface CorrelationResponse {
  correlation_matrix: Record<string, Record<string, number>>
  columns: string[]
  method?: string
}

export const preprocessingApi = {
  missingValues: (projectId: string, config: MissingValuesConfig) =>
    apiRequest<DatasetInfo>(`/preprocessing/missing-values/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  detectOutliers: (projectId: string, config: OutliersConfig) =>
    apiRequest<DetectOutliersResponse>(`/preprocessing/detect-outliers/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  outliers: (projectId: string, config: OutliersConfig) =>
    apiRequest<DatasetInfo>(`/preprocessing/outliers/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  encoding: (projectId: string, config: EncodingConfig) =>
    apiRequest<DatasetInfo>(`/preprocessing/encoding/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  scaling: (projectId: string, config: ScalingConfig) =>
    apiRequest<DatasetInfo>(`/preprocessing/scaling/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  correlation: (projectId: string, method = 'pearson') =>
    apiRequest<CorrelationResponse>(`/preprocessing/correlation/${projectId}?method=${method}`),

  dropColumns: (projectId: string, columns: string[]) =>
    apiRequest<DatasetInfo>(`/preprocessing/drop-columns/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ columns }),
    }),

  renameColumn: (projectId: string, oldName: string, newName: string) =>
    apiRequest<DatasetInfo>(`/preprocessing/rename-column/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ old_name: oldName, new_name: newName }),
    }),

  dropDuplicates: (projectId: string) =>
    apiRequest<DatasetInfo>(`/preprocessing/filter-rows/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ operation: 'drop_duplicates' }),
    }),

  filterRows: (projectId: string, column: string, operator: string, value: string) =>
    apiRequest<DatasetInfo>(`/preprocessing/filter-rows/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ operation: 'filter', column, operator, value }),
    }),

  featureEngineering: (projectId: string, body: Record<string, unknown>) =>
    apiRequest<DatasetInfo>(`/preprocessing/feature-engineering/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  featureSelection: (projectId: string, varianceThreshold = 0, correlationThreshold = 0.95) =>
    apiRequest<{
      low_variance_cols: string[]
      high_correlation_pairs: { col_a: string; col_b: string; correlation: number }[]
      suggested_drop: string[]
      variance_threshold: number
      correlation_threshold: number
    }>(`/preprocessing/feature-selection/${projectId}?variance_threshold=${varianceThreshold}&correlation_threshold=${correlationThreshold}`),

  castColumn: (projectId: string, column: string, dtype: string) =>
    apiRequest<import('../../types').DatasetInfo>(`/preprocessing/cast-column/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ column, dtype }),
    }),

  replaceValues: (projectId: string, column: string, oldValue: unknown, newValue: unknown) =>
    apiRequest<import('../../types').DatasetInfo>(`/preprocessing/replace-values/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ column, old_value: oldValue, new_value: newValue }),
    }),

  pipelineHistory: (projectId: string) =>
    apiRequest<{
      history: { id: string; step_name: string; config: Record<string, unknown> | null; created_at: string }[]
    }>(`/preprocessing/pipeline-history/${projectId}`),

  restoreSnapshot: (projectId: string, stateId: string) =>
    apiRequest<import('../../types').DatasetInfo>(`/preprocessing/restore/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ state_id: stateId }),
    }),
}
