import { apiClient, ApiResponse } from '../utils/apiClient';
import { parseCSV } from '../utils/csvParser';
import { API_ENDPOINTS, buildUrl } from '../config/api';

const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true';

class ApiService {
  private sessionData: any = null;
  private sessionHistory: any[] = [];
  public currentSessionId: string = '';

  async uploadDataset(file: File): Promise<ApiResponse> {
    if (USE_BACKEND) {
      return this.uploadDatasetToBackend(file);
    }
    return this.uploadDatasetLocally(file);
  }

  private async uploadDatasetToBackend(file: File): Promise<ApiResponse> {
    try {
      console.log('[ApiService] Uploading to backend:', file.name);
      const response = await apiClient.uploadFile(API_ENDPOINTS.DATASET.UPLOAD, file);

      if (response.error) {
        console.error('[ApiService] Upload error:', response.error);
        return { error: response.error };
      }

      console.log('[ApiService] Upload successful, setting session data');
      this.sessionData = response.data;
      this.currentSessionId = (response.data as any)?.session_id || '';
      this.sessionHistory = [{ ...this.sessionData }];

      return { data: this.sessionData };
    } catch (error: any) {
      console.error('[ApiService] Upload exception:', error);
      return { error: error.message || 'Failed to upload dataset' };
    }
  }

  private async uploadDatasetLocally(file: File): Promise<ApiResponse> {
    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      const dtypes: Record<string, string> = {};
      parsed.columns.forEach((col: string, idx: number) => {
        const columnValues = parsed.data.map((row: any[]) => row[idx]).filter((v: any) => v !== null);
        if (columnValues.length === 0) {
          dtypes[col] = 'object';
        } else {
          const allNumeric = columnValues.every((v: any) => typeof v === 'number');
          dtypes[col] = allNumeric ? 'float64' : 'object';
        }
      });

      this.currentSessionId = `session-${Date.now()}`;
      this.sessionData = {
        data: parsed.data,
        columns: parsed.columns,
        shape: parsed.shape,
        missing_values: parsed.missingValues,
        dtypes: dtypes,
        session_id: this.currentSessionId,
      };

      this.sessionHistory = [{ ...this.sessionData }];

      return { data: this.sessionData };
    } catch (error: any) {
      return { error: error.message || 'Failed to upload dataset' };
    }
  }

  async getSessionData(): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const endpoint = buildUrl(API_ENDPOINTS.SESSION.GET, {
        id: this.currentSessionId,
      });
      return apiClient.get(endpoint);
    }

    if (!this.sessionData) {
      return { error: 'No session data available' };
    }
    return { data: this.sessionData };
  }

  async snapshotStep(params: { step_id: number }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const endpoint = buildUrl(API_ENDPOINTS.SESSION.SNAPSHOT, {
        id: this.currentSessionId,
      });
      return apiClient.post(endpoint, params);
    }

    try {
      this.sessionHistory.push({ ...this.sessionData });
      return { data: { success: true } };
    } catch (error: any) {
      return { error: error.message || 'Snapshot failed' };
    }
  }

  async undoStep(params: { step_id: number }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const endpoint = buildUrl(API_ENDPOINTS.SESSION.UNDO, {
        id: this.currentSessionId,
      });
      return apiClient.post(endpoint, params);
    }

    try {
      if (this.sessionHistory.length > 1) {
        this.sessionHistory.pop();
        this.sessionData = { ...this.sessionHistory[this.sessionHistory.length - 1] };
        return { data: this.sessionData };
      }
      return { error: 'No history to undo' };
    } catch (error: any) {
      return { error: error.message || 'Undo failed' };
    }
  }

  async dropColumns(params: { columns: string[] }): Promise<ApiResponse> {
    try {
      const { columns: dropCols } = params;
      const newColumns = this.sessionData.columns.filter((col: string) => !dropCols.includes(col));
      const colIndices = this.sessionData.columns.map((col: string, idx: number) =>
        dropCols.includes(col) ? -1 : idx
      ).filter((idx: number) => idx !== -1);

      const newData = this.sessionData.data.map((row: any[]) =>
        colIndices.map((idx: number) => row[idx])
      );

      this.sessionData = {
        ...this.sessionData,
        columns: newColumns,
        data: newData,
        shape: [newData.length, newColumns.length] as [number, number],
      };

      return { data: this.sessionData };
    } catch (error: any) {
      return { error: error.message || 'Failed to drop columns' };
    }
  }

  async analyzeDataset(params?: { target?: string }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const response = await apiClient.post(API_ENDPOINTS.DATASET.ANALYZE, params ?? {});
      if (response.error) return response;

      const backendData = response.data as any;
      const datasetInfo = backendData?.dataset_info || backendData;
      return {
        data: {
          analysis: backendData?.analysis,
          dataset_info: datasetInfo,
          missing_values: datasetInfo?.missing_values,
          data: datasetInfo?.data,
          columns: datasetInfo?.columns,
          shape: datasetInfo?.shape,
        }
      };
    }

    try {
      const { data, columns } = this.sessionData;

      const analysis = columns.map((col: string, idx: number) => {
        const values = data.map((row: any[]) => row[idx]).filter((v: any) => v !== null);
        const numericValues = values.filter((v: any) => typeof v === 'number');

        if (numericValues.length > 0) {
          const sorted = [...numericValues].sort((a, b) => a - b);
          const sum = numericValues.reduce((a: number, b: number) => a + b, 0);
          const mean = sum / numericValues.length;
          const variance = numericValues.reduce((acc: number, val: number) =>
            acc + Math.pow(val - mean, 2), 0) / numericValues.length;

          return {
            column: col,
            type: 'numeric',
            count: numericValues.length,
            mean: mean,
            std: Math.sqrt(variance),
            min: sorted[0],
            max: sorted[sorted.length - 1],
            quartiles: [
              sorted[Math.floor(sorted.length * 0.25)],
              sorted[Math.floor(sorted.length * 0.5)],
              sorted[Math.floor(sorted.length * 0.75)],
            ],
          };
        } else {
          const uniqueValues = [...new Set(values)];
          const frequency = values.reduce((acc: any, val: any) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
          }, {});
          const mostFrequent = Object.entries(frequency).sort((a: any, b: any) => b[1] - a[1])[0];

          return {
            column: col,
            type: 'categorical',
            count: values.length,
            unique_values: uniqueValues.length,
            most_frequent: mostFrequent?.[0],
            frequency: mostFrequent?.[1],
          };
        }
      });

      const missing_values: Record<string, number> = {};
      columns.forEach((col: string, idx: number) => {
        const nullCount = data.filter((row: any[]) => row[idx] === null).length;
        missing_values[col] = nullCount;
      });

      return { data: { ...this.sessionData, analysis, missing_values } };
    } catch (error: any) {
      return { error: error.message || 'Analysis failed' };
    }
  }

  async handleMissingValues(params: {
    numerical_method?: string;
    categorical_method?: string;
    method?: string;
    columns?: string[] | null
  }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const backendParams: any = {
        columns: params.columns && params.columns.length > 0 ? params.columns : null
      };

      if (params.numerical_method !== undefined) {
        backendParams.numerical_method = params.numerical_method;
        backendParams.categorical_method = params.categorical_method || 'mode';
      } else if (params.method !== undefined) {
        backendParams.method = params.method;
      }

      console.log('Sending to backend:', backendParams);
      const response = await apiClient.post(API_ENDPOINTS.PREPROCESSING.MISSING_VALUES, backendParams);
      console.log('Backend response:', response);
      return response;
    }

    try {
      if (!this.sessionData) {
        return { error: 'No session data available' };
      }
      const { method, numerical_method, categorical_method, columns: paramCols } = params;
      const { data, columns } = this.sessionData;

      const targetCols = (paramCols && paramCols.length > 0) ? paramCols : undefined;
      const numMethod = numerical_method || method;
      const catMethod = categorical_method || method;

      const newData = data.map((row: any[]) => {
        return row.map((val: any, idx: number) => {
          const col = columns[idx];
          if (val !== null && val !== undefined) return val;
          if (targetCols && !targetCols.includes(col)) return val;

          const colDtype = this.sessionData.dtypes?.[col] || '';
          const isNumeric = colDtype.includes('int') || colDtype.includes('float') || colDtype.includes('double');
          const effectiveMethod = isNumeric ? numMethod : catMethod;

          if (effectiveMethod === 'drop') {
            return val;
          } else if (effectiveMethod === 'mean' || effectiveMethod === 'median') {
            const colValues = data.map((r: any[]) => r[idx]).filter((v: any) =>
              v !== null && typeof v === 'number'
            );
            if (colValues.length === 0) return 0;

            if (effectiveMethod === 'mean') {
              return colValues.reduce((a: number, b: number) => a + b, 0) / colValues.length;
            } else {
              const sorted = [...colValues].sort((a, b) => a - b);
              return sorted[Math.floor(sorted.length / 2)];
            }
          } else if (effectiveMethod === 'mode' || effectiveMethod === 'constant') {
            const colValues = data.map((r: any[]) => r[idx]).filter((v: any) => v !== null);
            const frequency = colValues.reduce((acc: any, v: any) => {
              acc[v] = (acc[v] || 0) + 1;
              return acc;
            }, {});
            const mode = Object.entries(frequency).sort((a: any, b: any) => b[1] - a[1])[0];
            return mode?.[0] || null;
          }
          return val;
        });
      });

      const filteredData = (numMethod === 'drop' || catMethod === 'drop')
        ? newData.filter((row: any[]) => !row.some((v: any) => v === null))
        : newData;

      const missing_values: Record<string, number> = {};
      columns.forEach((col: string, idx: number) => {
        const nullCount = filteredData.filter((row: any[]) => row[idx] === null).length;
        missing_values[col] = nullCount;
      });

      this.sessionData = {
        ...this.sessionData,
        data: filteredData,
        shape: [filteredData.length, columns.length] as [number, number],
      };

      return { data: { ...this.sessionData, missing_values } };
    } catch (error: any) {
      return { error: error.message || 'Failed to handle missing values' };
    }
  }

  async handleOutliers(params: { method: string; columns?: string[] | null }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const backendParams = {
        method: params.method,
        columns: params.columns && params.columns.length > 0 ? params.columns : null
      };
      return apiClient.post(API_ENDPOINTS.PREPROCESSING.OUTLIERS, backendParams);
    }

    try {
      if (!this.sessionData) {
        return { error: 'No session data available' };
      }
      const { method, columns: paramCols } = params;
      const { data, columns } = this.sessionData;

      const targetCols = (paramCols && paramCols.length > 0)
        ? paramCols
        : columns.filter((_col: string, idx: number) => {
          const colData = data.map((r: any[]) => r[idx]);
          return colData.some((v: any) => typeof v === 'number');
        });

      const newData = data.map((row: any[]) => [...row]);

      if (method === 'iqr') {
        for (const colName of targetCols) {
          const colIdx = columns.indexOf(colName);
          if (colIdx === -1) continue;

          const colData = newData.map((r: any[]) => r[colIdx]).filter((v: any) => typeof v === 'number') as number[];
          if (colData.length === 0) continue;

          const sorted = [...colData].sort((a, b) => a - b);
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const iqr = q3 - q1;
          const lower = q1 - 1.5 * iqr;
          const upper = q3 + 1.5 * iqr;

          newData.forEach((row: any[]) => {
            if (typeof row[colIdx] === 'number') {
              if (row[colIdx] < lower) row[colIdx] = lower;
              if (row[colIdx] > upper) row[colIdx] = upper;
            }
          });
        }
      }
      else if (method === 'zscore') {
        let rowsToRemove = new Set<number>();

        for (const colName of targetCols) {
          const colIdx = columns.indexOf(colName);
          if (colIdx === -1) continue;

          const colData = newData.map((r: any[]) => r[colIdx]).filter((v: any) => typeof v === 'number') as number[];
          if (colData.length === 0) continue;

          const mean = colData.reduce((a, b) => a + b, 0) / colData.length;
          const variance = colData.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / colData.length;
          const std = Math.sqrt(variance);

          if (std === 0) continue;

          newData.forEach((row: any[], idx: number) => {
            if (typeof row[colIdx] === 'number') {
              const z = Math.abs((row[colIdx] - mean) / std);
              if (z > 3) {
                rowsToRemove.add(idx);
              }
            }
          });
        }

        const filteredData = newData.filter((_: any, idx: any) => !rowsToRemove.has(idx));
        this.sessionData = {
          ...this.sessionData,
          data: filteredData,
          shape: [filteredData.length, columns.length] as [number, number],
        };
      } else {
        this.sessionData = {
          ...this.sessionData,
          data: newData,
        };
      }

      const missing_values: Record<string, number> = {};
      columns.forEach((col: string, idx: number) => {
        const nullCount = this.sessionData.data.filter((row: any[]) => row[idx] === null).length;
        missing_values[col] = nullCount;
      });

      return { data: { ...this.sessionData, missing_values } };
    } catch (error: any) {
      return { error: error.message || 'Failed to handle outliers' };
    }
  }

  async detectOutliers(params: { method: string; columns?: string[] }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const backendParams = {
        method: params.method,
        columns: params.columns && params.columns.length > 0 ? params.columns : undefined
      };
      return apiClient.post(API_ENDPOINTS.PREPROCESSING.DETECT_OUTLIERS, backendParams);
    }

    try {
      if (!this.sessionData) {
        return { error: 'No session data available' };
      }
      const { method, columns: targetCols } = params;
      const { data, columns } = this.sessionData;
      const outlierResults: Record<string, { count: number; indices: number[] }> = {};

      const colsToCheck = targetCols || columns;

      for (const colName of colsToCheck) {
        const colIdx = columns.indexOf(colName);
        if (colIdx === -1) continue;

        const colData = data.map((row: any[]) => row[colIdx]).filter((v: any) => typeof v === 'number');
        let outlierIndices: number[] = [];

        if (method === 'iqr') {
          const sorted = [...colData].sort((a: any, b: any) => a - b);
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const iqr = q3 - q1;
          const lowerBound = q1 - 1.5 * iqr;
          const upperBound = q3 + 1.5 * iqr;
          outlierIndices = (data as any[])
            .map((row: any, idx: number) => (typeof row[colIdx] === 'number' && (row[colIdx] < lowerBound || row[colIdx] > upperBound)) ? idx : -1)
            .filter((idx: number) => idx !== -1);
        } else if (method === 'zscore') {
          const numericVals = data.map((r: any[]) => r[colIdx]).filter((v: any) => typeof v === 'number') as number[];
          const mean = numericVals.reduce((a: number, b: number) => a + b, 0) / numericVals.length;
          const variance = numericVals.reduce((a: number, v: number) => a + Math.pow(v - mean, 2), 0) / numericVals.length;
          const std = Math.sqrt(variance);
          outlierIndices = (data as any[])
            .map((row: any, idx: number) => (typeof row[colIdx] === 'number' && Math.abs((row[colIdx] - mean) / std) > 3) ? idx : -1)
            .filter((idx: number) => idx !== -1);
        }

        outlierResults[colName] = { count: outlierIndices.length, indices: outlierIndices };
      }

      return { data: { outlier_results: outlierResults } };
    } catch (error: any) {
      return { error: error.message || 'Outlier detection failed' };
    }
  }

  async removeOutliers(params: { method: string; columns?: string[] | null }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const backendParams = {
        method: params.method,
        columns: params.columns && params.columns.length > 0 ? params.columns : null
      };
      return apiClient.post(API_ENDPOINTS.PREPROCESSING.OUTLIERS, backendParams);
    }

    try {
      if (!this.sessionData) {
        return { error: 'No session data available' };
      }
      const { method, columns: paramCols } = params;
      const { data, columns } = this.sessionData;

      const targetCols = (paramCols && paramCols.length > 0)
        ? paramCols
        : columns.filter((_col: string, idx: number) => {
          const colData = data.map((r: any[]) => r[idx]);
          return colData.some((v: any) => typeof v === 'number');
        });

      const newData = data.map((row: any[]) => [...row]);
      let rowsToRemove = new Set<number>();

      if (method === 'iqr') {
        for (const colName of targetCols) {
          const colIdx = columns.indexOf(colName);
          if (colIdx === -1) continue;

          const colData = newData.map((r: any[]) => r[colIdx]).filter((v: any) => typeof v === 'number') as number[];
          if (colData.length === 0) continue;

          const sorted = [...colData].sort((a, b) => a - b);
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const iqr = q3 - q1;
          const lower = q1 - 1.5 * iqr;
          const upper = q3 + 1.5 * iqr;

          newData.forEach((row: any[], idx: number) => {
            if (typeof row[colIdx] === 'number' && (row[colIdx] < lower || row[colIdx] > upper)) {
              rowsToRemove.add(idx);
            }
          });
        }
      } else if (method === 'zscore') {
        for (const colName of targetCols) {
          const colIdx = columns.indexOf(colName);
          if (colIdx === -1) continue;

          const colData = newData.map((r: any[]) => r[colIdx]).filter((v: any) => typeof v === 'number') as number[];
          if (colData.length === 0) continue;

          const mean = colData.reduce((a, b) => a + b, 0) / colData.length;
          const variance = colData.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / colData.length;
          const std = Math.sqrt(variance);

          if (std === 0) continue;

          newData.forEach((row: any[], idx: number) => {
            if (typeof row[colIdx] === 'number') {
              const z = Math.abs((row[colIdx] - mean) / std);
              if (z > 3) {
                rowsToRemove.add(idx);
              }
            }
          });
        }
      }

      const filteredData = newData.filter((_: any, idx: any) => !rowsToRemove.has(idx));

      const missing_values: Record<string, number> = {};
      columns.forEach((col: string, idx: number) => {
        const nullCount = filteredData.filter((row: any[]) => row[idx] === null).length;
        missing_values[col] = nullCount;
      });

      this.sessionData = {
        ...this.sessionData,
        data: filteredData,
        shape: [filteredData.length, columns.length] as [number, number],
      };

      return { data: { ...this.sessionData, missing_values } };
    } catch (error: any) {
      return { error: error.message || 'Failed to remove outliers' };
    }
  }

  async encodeFeatures(params: { method: string; columns: string[] | null }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const backendParams = {
        method: params.method,
        columns: params.columns && params.columns.length > 0 ? params.columns : null
      };
      return apiClient.post(API_ENDPOINTS.PREPROCESSING.ENCODING, backendParams);
    }

    try {
      if (!this.sessionData) {
        return { error: 'No session data available for encoding' };
      }
      const { method, columns: targetCols } = params;
      const { data, columns } = this.sessionData;

      const categorialColumns = targetCols || columns.filter((col: string) => {
        const dtype = this.sessionData.dtypes?.[col] || '';
        return !dtype.includes('int') && !dtype.includes('float') && !dtype.includes('double');
      });

      let newData = data.map((row: any[]) => [...row]);
      let newColumns = [...columns];

      if (method === 'label' || method === 'ordinal') {
        for (const colName of categorialColumns) {
          const colIdx = newColumns.indexOf(colName);
          if (colIdx === -1) continue;

          const uniqueVals = [...new Set(newData.map((r: any[]) => r[colIdx]))];
          const mapping: Record<any, number> = {};
          uniqueVals.forEach((val: any, idx: number) => {
            mapping[String(val)] = idx;
          });

          newData = newData.map((row: any[]) => {
            const newRow = [...row];
            newRow[colIdx] = mapping[String(row[colIdx])];
            return newRow;
          });
        }
      } else if (method === 'onehot') {
        for (let i = categorialColumns.length - 1; i >= 0; i--) {
          const colName = categorialColumns[i];
          const colIdx = newColumns.indexOf(colName);
          if (colIdx === -1) continue;

          const uniqueVals = [...new Set(newData.map((r: any[]) => r[colIdx]))];

          const newCols: any[][] = [];
          for (const val of uniqueVals) {
            newCols.push(
              newData.map((row: any[]) => (row[colIdx] === val ? 1 : 0))
            );
          }

          newData = newData.map((row: any[], rowIdx: number) => {
            const newRow = [...row];
            newRow.splice(colIdx, 1);
            for (const colData of newCols) {
              newRow.splice(colIdx, 0, colData[rowIdx]);
            }
            return newRow;
          });

          const baseName = colName;
          newColumns.splice(colIdx, 1);
          const newColNames = uniqueVals.map((val: any) => `${baseName}_${val}`);
          newColumns.splice(colIdx, 0, ...newColNames);
        }
      }

      const missing_values: Record<string, number> = {};
      newColumns.forEach((col: string, idx: number) => {
        const nullCount = newData.filter((row: any[]) => row[idx] === null).length;
        missing_values[col] = nullCount;
      });

      this.sessionData = {
        ...this.sessionData,
        data: newData,
        columns: newColumns,
        shape: [newData.length, newColumns.length] as [number, number],
      };

      return { data: { ...this.sessionData, missing_values } };
    } catch (error: any) {
      return { error: error.message || 'Encoding failed' };
    }
  }

  async encodeColumns(params: { columns: string[]; method: string }): Promise<ApiResponse> {
    return this.encodeFeatures({ method: params.method, columns: params.columns });
  }

  async scaleData(params: { method: string; columns?: string[] | null }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const backendParams = {
        method: params.method,
        columns: params.columns && params.columns.length > 0 ? params.columns : null
      };
      return apiClient.post(API_ENDPOINTS.PREPROCESSING.SCALING, backendParams);
    }

    try {
      if (!this.sessionData) {
        return { error: 'No session data available' };
      }
      const { method, columns: paramCols } = params;
      const { data, columns } = this.sessionData;

      const targetCols = (paramCols && paramCols.length > 0)
        ? paramCols
        : columns.filter((_col: string, idx: number) => {
          const colData = data.map((r: any[]) => r[idx]);
          return colData.some((v: any) => typeof v === 'number');
        });

      const newData = data.map((row: any[]) => [...row]);

      if (method === 'standard') {
        for (const colName of targetCols) {
          const colIdx = columns.indexOf(colName);
          if (colIdx === -1) continue;

          const colData = newData.map((r: any[]) => r[colIdx]).filter((v: any) => typeof v === 'number') as number[];
          if (colData.length === 0) continue;

          const mean = colData.reduce((a, b) => a + b, 0) / colData.length;
          const variance = colData.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / colData.length;
          const std = Math.sqrt(variance);

          if (std === 0) continue;

          newData.forEach((row: any[]) => {
            if (typeof row[colIdx] === 'number') {
              row[colIdx] = (row[colIdx] - mean) / std;
            }
          });
        }
      } else if (method === 'minmax') {
        for (const colName of targetCols) {
          const colIdx = columns.indexOf(colName);
          if (colIdx === -1) continue;

          const colData = newData.map((r: any[]) => r[colIdx]).filter((v: any) => typeof v === 'number') as number[];
          if (colData.length === 0) continue;

          const min = Math.min(...colData);
          const max = Math.max(...colData);
          const range = max - min;

          if (range === 0) continue;

          newData.forEach((row: any[]) => {
            if (typeof row[colIdx] === 'number') {
              row[colIdx] = (row[colIdx] - min) / range;
            }
          });
        }
      } else if (method === 'robust') {
        for (const colName of targetCols) {
          const colIdx = columns.indexOf(colName);
          if (colIdx === -1) continue;

          const colData = newData.map((r: any[]) => r[colIdx]).filter((v: any) => typeof v === 'number') as number[];
          if (colData.length === 0) continue;

          const sorted = [...colData].sort((a, b) => a - b);
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const iqr = q3 - q1;
          const median = sorted[Math.floor(sorted.length * 0.5)];

          if (iqr === 0) continue;

          newData.forEach((row: any[]) => {
            if (typeof row[colIdx] === 'number') {
              row[colIdx] = (row[colIdx] - median) / iqr;
            }
          });
        }
      }

      const missing_values: Record<string, number> = {};
      columns.forEach((col: string, idx: number) => {
        const nullCount = newData.filter((row: any[]) => row[idx] === null).length;
        missing_values[col] = nullCount;
      });

      this.sessionData = {
        ...this.sessionData,
        data: newData,
      };

      return { data: { ...this.sessionData, missing_values } };
    } catch (error: any) {
      return { error: error.message || 'Scaling failed' };
    }
  }

  async scaleFeatures(params: any): Promise<ApiResponse> {
    return this.scaleData(params);
  }

  async trainModel(params: { model_type: string; target_column: string; test_size: number }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      return apiClient.post(API_ENDPOINTS.MODEL.TRAIN, params);
    }

    try {
      return {
        data: {
          success: true,
          model_type: params.model_type,
          target_column: params.target_column,
        }
      };
    } catch (error: any) {
      return { error: error.message || 'Training failed' };
    }
  }

  async trainModels(params: {
    model_type?: string;
    model_names?: string[];
    target_column: string;
    test_size?: number;
    problem_type?: string;
  }): Promise<ApiResponse> {
    if (USE_BACKEND) {
      const modelType = params.model_type || params.model_names?.[0] || 'random_forest';
      return apiClient.post(API_ENDPOINTS.MODEL.TRAIN, {
        model_type: modelType,
        target_column: params.target_column,
        test_size: params.test_size || 0.2,
      });
    }

    try {
      if (!this.sessionData) {
        return { error: 'No session data available' };
      }

      const { data, columns } = this.sessionData;
      const targetIdx = columns.indexOf(params.target_column);
      if (targetIdx === -1) {
        return { error: 'Target column not found' };
      }

      let task_type = params.problem_type;
      if (!task_type) {
        const targetValues = data.map((r: any[]) => r[targetIdx]).filter((v: any) => v !== null);
        const allNumeric = targetValues.every((v: any) => typeof v === 'number');
        task_type = allNumeric ? 'regression' : 'classification';
      }

      const metrics = {
        accuracy: task_type === 'classification' ? 0.85 : 0.82,
        precision: task_type === 'classification' ? 0.83 : 0.81,
        recall: task_type === 'classification' ? 0.87 : 0.79,
        f1_score: task_type === 'classification' ? 0.85 : 0.80,
      };

      return {
        data: {
          success: true,
          model_type: params.model_type || params.model_names?.[0] || 'random_forest',
          target_column: params.target_column,
          task_type: task_type,
          metrics: metrics,
        }
      };
    } catch (error: any) {
      return { error: error.message || 'Training failed' };
    }
  }

  async evaluateModel(): Promise<ApiResponse> {
    if (USE_BACKEND) {
      return apiClient.get(API_ENDPOINTS.MODEL.EVALUATE);
    }

    try {
      return {
        data: {
          accuracy: 0.85,
          precision: 0.83,
          recall: 0.87,
          f1_score: 0.85,
        }
      };
    } catch (error: any) {
      return { error: error.message || 'Evaluation failed' };
    }
  }

  async evaluateModels(): Promise<ApiResponse> {
    return this.evaluateModel();
  }

  async optimizeModel(params: any): Promise<ApiResponse> {
    if (USE_BACKEND) {
      return apiClient.post(API_ENDPOINTS.MODEL.OPTIMIZE, params);
    }

    try {
      return {
        data: {
          success: true,
          best_params: params,
        }
      };
    } catch (error: any) {
      return { error: error.message || 'Optimization failed' };
    }
  }

  async exportModel(params: {
    selected_model: string;
    model_name: string;
    format: 'joblib' | 'pkl' | 'onnx';
  }): Promise<ApiResponse<{ blob: Blob; filename: string }>> {
    if (USE_BACKEND) {
      return {
        error: 'Model export is not implemented on the backend yet.',
      };
    }

    try {
      const content = JSON.stringify(
        {
          note: 'This is a dummy exported model placeholder (frontend-only).',
          selected_model: params.selected_model,
          format: params.format,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      );

      const blob = new Blob([content], { type: 'application/json' });
      const filename = `${params.model_name || 'model'}.${params.format}`;

      return {
        data: {
          blob,
          filename,
        },
      };
    } catch (error: any) {
      return {
        error: error.message || 'Model export failed',
      };
    }
  }

  async correlationAnalysis(params: {
    threshold: number;
    preview_only?: boolean;
    columns_to_drop?: string[];
  }): Promise<ApiResponse> {
    try {
      const { threshold, preview_only, columns_to_drop } = params;

      const corrRes = await this.getCorrelationMatrix();
      if (corrRes.error) {
        return { error: corrRes.error };
      }

      const corrData = corrRes.data as {
        correlation_matrix: Record<string, Record<string, number>>;
        columns: string[];
      };

      const matrix = corrData?.correlation_matrix || {};
      const cols: string[] = corrData?.columns || [];

      const highly_correlated: { col1: string; col2: string; correlation: number }[] = [];

      for (let i = 0; i < cols.length; i++) {
        for (let j = i + 1; j < cols.length; j++) {
          const c1 = cols[i];
          const c2 = cols[j];
          const val = matrix[c1]?.[c2];
          const corr = typeof val === 'number' ? val : 0;

          if (Math.abs(corr) >= threshold) {
            highly_correlated.push({ col1: c1, col2: c2, correlation: corr });
          }
        }
      }

      if (preview_only) {
        return { data: { highly_correlated } };
      }

      const dropped_columns = columns_to_drop ?? [];

      if (dropped_columns.length > 0 && this.sessionData) {
        const current = this.sessionData;

        const newColumns = current.columns.filter(
          (col: string) => !dropped_columns.includes(col)
        );
        const colIndices = current.columns
          .map((col: string, idx: number) =>
            dropped_columns.includes(col) ? -1 : idx
          )
          .filter((idx: number) => idx !== -1);

        const newData = current.data.map((row: any[]) =>
          colIndices.map((idx: number) => row[idx])
        );

        const next = {
          ...current,
          columns: newColumns,
          data: newData,
          shape: [newData.length, newColumns.length] as [number, number],
        };

        this.sessionData = next;

        return {
          data: {
            ...next,
            dropped_columns,
            highly_correlated,
          },
        };
      }

      return {
        data: {
          dropped_columns,
          highly_correlated,
        },
      };
    } catch (error: any) {
      return {
        error: error.message || 'Correlation analysis failed',
      };
    }
  }

  async getCorrelationMatrix(): Promise<ApiResponse> {
    if (USE_BACKEND) {
      return apiClient.get(API_ENDPOINTS.PREPROCESSING.CORRELATION);
    }

    try {
      if (!this.sessionData) {
        return { error: 'No session data available' };
      }
      const { data, columns } = this.sessionData;
      const numericColumns = columns.filter((_col: string, idx: number) => {
        const values = data.map((row: any[]) => row[idx]);
        return values.some((v: any) => typeof v === 'number');
      });

      const matrix: Record<string, Record<string, number>> = {};

      numericColumns.forEach((_col1: string, _idx1: number) => {
        matrix[_col1] = {};
        numericColumns.forEach((_col2: string, _idx2: number) => {
          const values1 = data.map((row: any[]) => row[columns.indexOf(_col1)]).filter((v: any) => typeof v === 'number');
          const values2 = data.map((row: any[]) => row[columns.indexOf(_col2)]).filter((v: any) => typeof v === 'number');

          if (_col1 === _col2) {
            matrix[_col1][_col2] = 1;
          } else {
            const mean1 = values1.reduce((a: number, b: number) => a + b, 0) / values1.length;
            const mean2 = values2.reduce((a: number, b: number) => a + b, 0) / values2.length;

            const covariance = values1.reduce((sum: number, v1: number, i: number) =>
              sum + (v1 - mean1) * (values2[i] - mean2), 0) / values1.length;

            const std1 = Math.sqrt(values1.reduce((sum: number, v: number) =>
              sum + Math.pow(v - mean1, 2), 0) / values1.length);
            const std2 = Math.sqrt(values2.reduce((sum: number, v: number) =>
              sum + Math.pow(v - mean2, 2), 0) / values2.length);

            matrix[_col1][_col2] = covariance / (std1 * std2);
          }
        });
      });

      return { data: { correlation_matrix: matrix, columns: numericColumns } };
    } catch (error: any) {
      return { error: error.message || 'Correlation calculation failed' };
    }
  }
}

export const apiService = new ApiService();
