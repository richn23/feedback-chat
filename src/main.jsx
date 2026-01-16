import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Dashboard from './Dashboard.jsx'
import SuggestionsChat from './SuggestionsChat.jsx'
import SuggestionsDashboard from './SuggestionsDashboard.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/suggestions" element={<SuggestionsChat />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/suggestions-dashboard" element={<SuggestionsDashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
