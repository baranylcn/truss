import { apiRequest, apiDownload } from './client'
import type { TrainMetrics } from '../../types'

interface TrainConfig {
  model_type: string
  target_column: string
  test_size: number
  hyperparameters?: Record<string, unknown>
  task_type?: string | null
}

interface TrainResponse {
  success: boolean
  model_type: string
  target_column: string
  task_type: string
  metrics: TrainMetrics
}

interface ModelResult {
  model: string
  metrics: TrainMetrics
  task_type: string
}

export interface EvaluateResponse {
  accuracy: number
  precision: number | null
  recall: number | null
  f1_score: number | null
  problem_type: string | null
  best_model: string | null
  target_column: string | null
  trained_models: string[]
  results: ModelResult[]
  confusion_matrix: number[][] | null
  class_names: string[] | null
  feature_importance: Record<string, number> | null
}

export interface OptimizeResponse {
  success: boolean
  best_params: Record<string, unknown>
  best_score: number
  baseline_score: number
  improvement: number
  trials_run: number
  model_type: string
  strategy: string
}

export const modelApi = {
  train: (projectId: string, config: TrainConfig) =>
    apiRequest<TrainResponse>(`/model/train/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  evaluate: (projectId: string) =>
    apiRequest<EvaluateResponse>(`/model/evaluate/${projectId}`),

  optimize: (projectId: string, config: {
    strategy: string
    n_trials: number
    test_size?: number
    param_ranges?: Record<string, [number, number]>
    param_choices?: Record<string, string[]>
  }) =>
    apiRequest<OptimizeResponse>(`/model/optimize/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  exportPredictions: (projectId: string) =>
    apiDownload(`/model/export/predictions/${projectId}`, `predictions_${projectId.slice(0, 8)}.csv`),

  exportModel: (projectId: string, modelType: string) =>
    apiDownload(`/model/export/model/${projectId}`, `${modelType}_${projectId.slice(0, 8)}.pkl`),
}
