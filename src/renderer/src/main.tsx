import './main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

import _icon from './assets/icon.png';
export const icon = _icon;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
