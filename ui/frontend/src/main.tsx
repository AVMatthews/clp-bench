import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ReCharts from './ReCharts.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReCharts />
  </StrictMode>,
)
