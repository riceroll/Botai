import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ReactDOM.createRoot(document.getElementById('root')).render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>
// );


import { ManifoldProvider } from './ManifoldProvider';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ManifoldProvider>
      <App />
    </ManifoldProvider>
  </React.StrictMode>
);