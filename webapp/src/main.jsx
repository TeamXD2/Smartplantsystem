import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/source-sans-3/wght-italic.css';
import '@fontsource/ibm-plex-mono/500.css';
import './index.css';
import App from './App';

// A data router (instead of <BrowserRouter>) so pages can warn about unsaved
// changes before navigating away. The one splat route hands everything to <App>.
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
