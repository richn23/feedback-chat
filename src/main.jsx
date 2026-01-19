import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Dashboard from './Dashboard.jsx'
import SuggestionsChat from './SuggestionsChat.jsx'
import SuggestionsDashboard from './SuggestionsDashboard.jsx'
import FeedbackChatV2 from './FeedbackChatV2.jsx'
import FeedbackDashboardV2 from './FeedbackDashboardV2.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/suggestions" element={<SuggestionsChat />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/suggestions-dashboard" element={<SuggestionsDashboard />} />
        <Route path="/feedback-v2" element={<FeedbackChatV2 />} />
        <Route path="/dashboard-v2" element={<FeedbackDashboardV2 />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)