export interface ParsedCSV {
  data: any[][];
  columns: string[];
  shape: [number, number];
  missingValues: Record<string, number>;
}

export const parseCSV = (csvText: string): ParsedCSV => {
  const rows = csvText.split('\n').filter(row => row.trim());

  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = rows[0].split(',').map(h => h.trim());

  if (headers.length === 0) {
    throw new Error('No columns found in CSV');
  }

  const data = rows.slice(1).map(row => {
    const values = row.split(',').map(v => v.trim());
    return headers.map((_, idx) => {
      const val = values[idx];
      if (!val || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? val : num;
    });
  });

  const missingValues: Record<string, number> = {};
  headers.forEach((col, idx) => {
    const missing = data.filter(row => row[idx] === null).length;
    missingValues[col] = missing;
  });

  return {
    data,
    columns: headers,
    shape: [data.length, headers.length],
    missingValues,
  };
};

export const validateCSV = (file: File): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!file.name.endsWith('.csv')) {
    return { valid: false, error: 'File must be a CSV' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (file.size > 50 * 1024 * 1024) {
    return { valid: false, error: 'File size exceeds 50MB limit' };
  }

  return { valid: true };
};
