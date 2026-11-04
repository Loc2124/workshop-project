import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { shouldRetryApiQuery } from './lib/api-client';
import { installSessionLifecycle } from './lib/session-cache';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppToaster } from './components/ui/AppToaster';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetryApiQuery,
      refetchOnWindowFocus: false,
    },
  },
});
const disposeSessionLifecycle = installSessionLifecycle(queryClient);
if (import.meta.hot) import.meta.hot.dispose(disposeSessionLifecycle);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
      <AppToaster />
    </QueryClientProvider>
  </React.StrictMode>,
);
