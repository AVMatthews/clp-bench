import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import BarCharts from './BarCharts.tsx'
import ReCharts from './ReCharts.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReCharts />
    {/* <BarCharts /> */}
    {/* <App /> */}
  </StrictMode>,
)
