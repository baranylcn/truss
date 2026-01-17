export const APP_NAME = 'GroveML';

export const STORAGE_KEYS = {
  CURRENT_VIEW: 'GroveML-current-view',
  SESSION_DATA: 'GroveML-session-data',
  LANGUAGE: 'GroveML-language',
  THEME: 'GroveML-theme',
} as const;

export const ML_STEPS = {
  UPLOAD: 0,
  ANALYSIS: 1,
  MISSING_VALUES: 2,
  OUTLIERS: 3,
  ENCODING: 4,
  CORRELATION: 5,
  SCALING: 6,
  TRAINING: 7,
  EVALUATION: 8,
  OPTIMIZATION: 9,
} as const;

export const SUPPORTED_FILE_TYPES = {
  CSV: 'text/csv',
  EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const DEFAULT_LANGUAGE = 'en';

export const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ku', name: 'کوردی', flag: '🏳️' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
] as const;

export const ENCODING_METHODS = {
  ONE_HOT: 'one_hot',
  LABEL: 'label',
  ORDINAL: 'ordinal',
} as const;

export const SCALING_METHODS = {
  STANDARD: 'standard',
  MIN_MAX: 'minmax',
  ROBUST: 'robust',
} as const;

export const MISSING_VALUE_METHODS = {
  DROP: 'drop',
  MEAN: 'mean',
  MEDIAN: 'median',
  MODE: 'mode',
  FORWARD_FILL: 'forward',
  BACKWARD_FILL: 'backward',
} as const;

export const OUTLIER_METHODS = {
  IQR: 'iqr',
  Z_SCORE: 'zscore',
} as const;

export const MODEL_TYPES = {
  LINEAR_REGRESSION: 'linear_regression',
  LOGISTIC_REGRESSION: 'logistic_regression',
  DECISION_TREE: 'decision_tree',
  RANDOM_FOREST: 'random_forest',
  SVM: 'svm',
  KNN: 'knn',
  NEURAL_NETWORK: 'neural_network',
} as const;
