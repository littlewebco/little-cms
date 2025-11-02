import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';
import './components/fonts/fonts.css';

// Initialize theme before React renders
const THEME_STORAGE_KEY = 'littlecms-theme';
const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
const root = document.documentElement;

if (storedTheme === 'dark') {
  root.classList.add('dark');
} else if (storedTheme === 'light') {
  root.classList.remove('dark');
} else {
  // Use system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

