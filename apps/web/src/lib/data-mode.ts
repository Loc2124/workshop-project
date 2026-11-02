const configuredDataMode = import.meta.env.VITE_DATA_MODE ?? 'api';

if (configuredDataMode !== 'api' && configuredDataMode !== 'demo') {
  throw new Error('VITE_DATA_MODE must be either "api" or "demo".');
}

export const isDemoDataMode = configuredDataMode === 'demo';
