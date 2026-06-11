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
}
