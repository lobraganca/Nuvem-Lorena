import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'
import { startOverIfAsked } from './lib/startOver'
import { reloadOnNewVersion } from './lib/swUpdate'

// The single-file build is opened straight from disk, where there is no server
// to answer /destination — so routes live in the URL hash instead.
const Router = __SINGLE_FILE__ ? HashRouter : BrowserRouter

// On GitHub Pages the site lives under /<repo>/, so every route needs that
// prefix. Vite bakes the value in; on the real domain it is just "/".
const basename = __SINGLE_FILE__ ? undefined : import.meta.env.BASE_URL

// Before anything reads storage: ?recomecar=1 opens the app as a new phone.
startOverIfAsked()

// The installed copy must not outlive the version it came from.
reloadOnNewVersion()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router basename={basename}>
      <App />
    </Router>
  </StrictMode>,
)
