export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
  TIMEOUT: 60000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000,
} as const;

export const API_ENDPOINTS = {
  DATASET: {
    UPLOAD: '/dataset/upload',
    ANALYZE: '/dataset/analyze',
    INFO: '/dataset/info',
  },
  PREPROCESSING: {
    MISSING_VALUES: '/preprocessing/missing-values',
    DETECT_OUTLIERS: '/preprocessing/detect-outliers',
    OUTLIERS: '/preprocessing/outliers',
    ENCODING: '/preprocessing/encoding',
    SCALING: '/preprocessing/scaling',
    CORRELATION: '/preprocessing/correlation',
  },
  MODEL: {
    TRAIN: '/model/train',
    EVALUATE: '/model/evaluate',
    OPTIMIZE: '/model/optimize',
    PREDICT: '/model/predict',
  },
  SESSION: {
    CREATE: '/session/create',
    GET: '/session/:id',
    UPDATE: '/session/:id',
    SNAPSHOT: '/session/:id/snapshot',
    UNDO: '/session/:id/undo',
    DELETE: '/session/:id',
  },
} as const;

export const buildUrl = (endpoint: string, params?: Record<string, string>): string => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });
  }

  return url;
};
