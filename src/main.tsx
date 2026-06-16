import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    if (event.message && (
      event.message.includes("Cannot set property fetch") || 
      event.message.includes("only a getter")
    )) {
      event.preventDefault();
      console.warn("Sidelined external sandbox error: window.fetch assignment.");
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
