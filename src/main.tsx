import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { createRuntime, RuntimeProvider } from './app/runtime';
import { AppRoutes } from './app/router';
import { ErrorBoundary } from './components/states';
import './app/styles.css';
const runtime = createRuntime();
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><RuntimeProvider runtime={runtime}><BrowserRouter><AppRoutes/></BrowserRouter></RuntimeProvider></ErrorBoundary></StrictMode>);
