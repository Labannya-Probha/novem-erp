/* ------------------------------------------------------------------ */
/*  APP ENTRY POINT                                                     */
/* ------------------------------------------------------------------ */
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import AppSession from './AppSession'

export default function App() {
  return (
    <BrowserRouter>
      <AppSession />
      <Analytics />
    </BrowserRouter>
  )
}
