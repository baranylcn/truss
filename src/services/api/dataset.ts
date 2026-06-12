import { apiRequest } from './client'
import type { DatasetInfo, ColumnAnalysis } from '../../types'

interface AnalyzeResponse {
  analysis: ColumnAnalysis[]
  dataset_info: DatasetInfo
}

export const datasetApi = {
  upload: (projectId: string, file: File) => {
    const form = new FormData()
    form.append('project_id', projectId)
    form.append('file', file)
    return apiRequest<DatasetInfo>('/dataset/upload', { method: 'POST', body: form })
  },

  analyze: (projectId: string) =>
    apiRequest<AnalyzeResponse>(`/dataset/analyze/${projectId}`),

  info: (projectId: string) =>
    apiRequest<DatasetInfo>(`/dataset/info/${projectId}`),
}
