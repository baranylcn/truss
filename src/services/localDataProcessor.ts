export interface ProcessedData {
  data: any[][];
  columns: string[];
  shape: [number, number];
  dtypes?: Record<string, string>;
  missingValues?: Record<string, number>;
}

export class LocalDataProcessor {
  static calculateStatistics(data: any[][], columnIndex: number) {
    const values = data
      .map(row => row[columnIndex])
      .filter(val => val !== null && val !== undefined && typeof val === 'number');

    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        std: 0,
        min: 0,
        max: 0,
        q1: 0,
        q3: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    return {
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      std,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      q1: sorted[Math.floor(sorted.length * 0.25)],
      q3: sorted[Math.floor(sorted.length * 0.75)],
    };
  }

  static detectOutliers(data: any[][], columnIndex: number, method: 'iqr' | 'zscore' = 'iqr') {
    const values = data
      .map((row, idx) => ({ value: row[columnIndex], rowIndex: idx }))
      .filter(item => item.value !== null && item.value !== undefined && typeof item.value === 'number');

    if (values.length === 0) return { outlierIndices: [], stats: null };

    const numericValues = values.map(item => item.value as number);
    const sorted = [...numericValues].sort((a, b) => a - b);

    if (method === 'iqr') {
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      const outlierIndices = values
        .filter(item => (item.value as number) < lowerBound || (item.value as number) > upperBound)
        .map(item => item.rowIndex);

      return {
        outlierIndices,
        stats: { q1, q3, iqr, lowerBound, upperBound },
      };
    } else {
      const mean = numericValues.reduce((acc, val) => acc + val, 0) / numericValues.length;
      const std = Math.sqrt(
        numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length
      );

      const outlierIndices = values
        .filter(item => Math.abs((item.value as number) - mean) > 3 * std)
        .map(item => item.rowIndex);

      return {
        outlierIndices,
        stats: { mean, std, threshold: 3 * std },
      };
    }
  }

  static removeOutliers(data: any[][], columnIndices: number[], method: 'iqr' | 'zscore' = 'iqr') {
    const allOutlierIndices = new Set<number>();

    columnIndices.forEach(colIdx => {
      const { outlierIndices } = this.detectOutliers(data, colIdx, method);
      outlierIndices.forEach(idx => allOutlierIndices.add(idx));
    });

    return data.filter((_, idx) => !allOutlierIndices.has(idx));
  }

  static calculateCorrelation(values1: number[], values2: number[]): number {
    if (values1.length !== values2.length || values1.length === 0) return 0;

    const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
    const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;

    const covariance = values1.reduce((sum, v1, i) =>
      sum + (v1 - mean1) * (values2[i] - mean2), 0) / values1.length;

    const std1 = Math.sqrt(values1.reduce((sum, v) =>
      sum + Math.pow(v - mean1, 2), 0) / values1.length);
    const std2 = Math.sqrt(values2.reduce((sum, v) =>
      sum + Math.pow(v - mean2, 2), 0) / values2.length);

    return std1 === 0 || std2 === 0 ? 0 : covariance / (std1 * std2);
  }

  static normalizeColumn(data: any[][], columnIndex: number): any[][] {
    const values = data.map(row => row[columnIndex]).filter(val =>
      val !== null && val !== undefined && typeof val === 'number'
    ) as number[];

    if (values.length === 0) return data;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) return data;

    return data.map(row => {
      const newRow = [...row];
      const val = row[columnIndex];
      if (val !== null && val !== undefined && typeof val === 'number') {
        newRow[columnIndex] = (val - min) / range;
      }
      return newRow;
    });
  }

  static standardizeColumn(data: any[][], columnIndex: number): any[][] {
    const values = data.map(row => row[columnIndex]).filter(val =>
      val !== null && val !== undefined && typeof val === 'number'
    ) as number[];

    if (values.length === 0) return data;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, v) =>
      sum + Math.pow(v - mean, 2), 0) / values.length);

    if (std === 0) return data;

    return data.map(row => {
      const newRow = [...row];
      const val = row[columnIndex];
      if (val !== null && val !== undefined && typeof val === 'number') {
        newRow[columnIndex] = (val - mean) / std;
      }
      return newRow;
    });
  }

  static fillMissingValues(
    data: any[][],
    columnIndex: number,
    method: 'mean' | 'median' | 'mode' | 'forward' | 'backward'
  ): any[][] {
    const column = data.map(row => row[columnIndex]);
    const nonNullValues = column.filter(val => val !== null && val !== undefined);

    if (nonNullValues.length === 0) return data;

    let fillValue: any;

    if (method === 'mean') {
      const numericValues = nonNullValues.filter(v => typeof v === 'number') as number[];
      fillValue = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    } else if (method === 'median') {
      const numericValues = nonNullValues.filter(v => typeof v === 'number') as number[];
      const sorted = [...numericValues].sort((a, b) => a - b);
      fillValue = sorted[Math.floor(sorted.length / 2)];
    } else if (method === 'mode') {
      const frequency: Record<string, number> = {};
      nonNullValues.forEach(v => {
        const key = String(v);
        frequency[key] = (frequency[key] || 0) + 1;
      });
      const mode = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0];
      fillValue = mode ? mode[0] : null;
    }

    return data.map((row, idx) => {
      const newRow = [...row];
      const val = row[columnIndex];

      if (val === null || val === undefined) {
        if (method === 'forward') {
          if (idx > 0) {
            newRow[columnIndex] = data[idx - 1][columnIndex];
          }
        } else if (method === 'backward') {
          if (idx < data.length - 1) {
            newRow[columnIndex] = data[idx + 1][columnIndex];
          }
        } else {
          newRow[columnIndex] = fillValue;
        }
      }

      return newRow;
    });
  }

  static oneHotEncode(data: any[][], columnIndex: number, columnName: string): {
    data: any[][],
    newColumns: string[]
  } {
    const uniqueValues = [...new Set(data.map(row => row[columnIndex]))]
      .filter(v => v !== null && v !== undefined);

    const newColumns = uniqueValues.map(val => `${columnName}_${val}`);

    const newData = data.map(row => {
      const newRow = [...row];
      newRow.splice(columnIndex, 1);

      const encodedValues = uniqueValues.map(val =>
        row[columnIndex] === val ? 1 : 0
      );

      return [...newRow.slice(0, columnIndex), ...encodedValues, ...newRow.slice(columnIndex)];
    });

    return { data: newData, newColumns };
  }

  static labelEncode(data: any[][], columnIndex: number): any[][] {
    const uniqueValues = [...new Set(data.map(row => row[columnIndex]))]
      .filter(v => v !== null && v !== undefined);

    const labelMap = Object.fromEntries(
      uniqueValues.map((val, idx) => [val, idx])
    );

    return data.map(row => {
      const newRow = [...row];
      const val = row[columnIndex];
      if (val !== null && val !== undefined) {
        newRow[columnIndex] = labelMap[val];
      }
      return newRow;
    });
  }
}
