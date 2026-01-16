import React, { useState, useEffect } from 'react';

const SHEET_ID = import.meta.env.VITE_SUGGESTIONS_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// Fetch data from Google Sheets
const fetchSheetData = async () => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:E?key=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.values || data.values.length < 2) {
    return [];
  }
  
  const rows = data.values.slice(1).filter(row => row[0] && !row[0].startsWith('DEBUG') && !row[0].startsWith('ERROR'));
  
  return rows.map(row => ({
    timestamp: row[0] || '',
    language: row[1] || '',
    suggestion: row[2] || '',
    follow_up: row[3] || '',
    anything_else: row[4] || ''
  }));
};

// Generate AI summary of suggestions
const generateSummary = async (suggestions) => {
  const suggestionList = suggestions.slice(0, 50).map(s => 
    `- ${s.suggestion}${s.follow_up ? ` (${s.follow_up})` : ''}`
  ).join('\n');
  
  const prompt = `You are analyzing student suggestions for ES World language school.

Here are the recent suggestions:
${suggestionList}

TASK:
Write a brief executive summary (4-5 sentences) that:
1. Identifies the main themes/categories of suggestions
2. Highlights the most frequently requested items
3. Notes any urgent or safety-related concerns
4. Gives a prioritized recommendation for what to address first

Be specific and actionable. Use a professional but friendly tone.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error('API error');
    const result = await response.json();
    return result.content[0].text;
  } catch (error) {
    console.error('Error generating summary:', error);
    return null;
  }
};

// Group suggestions by theme
const groupByTheme = (suggestions) => {
  const themes = {};
  
  suggestions.forEach(s => {
    const text = s.suggestion.toLowerCase();
    let theme = 'Other';
    
    if (text.includes('wifi') || text.includes('internet') || text.includes('computer')) {
      theme = 'Technology';
    } else if (text.includes('chair') || text.includes('table') || text.includes('room') || text.includes('air') || text.includes('temperature') || text.includes('light')) {
      theme = 'Facilities';
    } else if (text.includes('coffee') || text.includes('food') || text.includes('snack') || text.includes('water') || text.includes('kitchen')) {
      theme = 'Food & Drink';
    } else if (text.includes('class') || text.includes('lesson') || text.includes('teacher') || text.includes('homework') || text.includes('grammar') || text.includes('speaking') || text.includes('practice')) {
      theme = 'Learning';
    } else if (text.includes('event') || text.includes('activity') || text.includes('trip') || text.includes('party') || text.includes('social') || text.includes('club')) {
      theme = 'Activities';
    } else if (text.includes('schedule') || text.includes('time') || text.includes('hour') || text.includes('break')) {
      theme = 'Scheduling';
    }
    
    if (!themes[theme]) themes[theme] = [];
    themes[theme].push(s);
  });
  
  return themes;
};

function SuggestionsDashboard() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchSheetData();
      setSuggestions(data);
      setError(null);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    const result = await generateSummary(suggestions);
    setSummary(result);
    setSummaryLoading(false);
  };

  const themes = groupByTheme(suggestions);
  const themeNames = Object.keys(themes).sort((a, b) => themes[b].length - themes[a].length);
  
  const filteredSuggestions = selectedTheme === 'all' 
    ? suggestions 
    : themes[selectedTheme] || [];

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif'
      }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
        color: '#ef4444'
      }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f2f2f7',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        padding: '20px 32px',
        borderBottom: '1px solid #e5e5e5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px'
          }}>
            💡
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Suggestions Dashboard</h1>
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Student ideas and feedback</p>
          </div>
        </div>
        <button
          onClick={loadData}
          style={{
            background: '#f0f0f0',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          ↻ Refresh
        </button>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Stats Cards */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            flex: 1,
            minWidth: '150px'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Total Suggestions</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#333' }}>{suggestions.length}</div>
          </div>
          
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            flex: 1,
            minWidth: '150px'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>This Week</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#333' }}>
              {suggestions.filter(s => {
                const date = new Date(s.timestamp);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return date >= weekAgo;
              }).length}
            </div>
          </div>
          
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            flex: 1,
            minWidth: '150px'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Categories</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#333' }}>{themeNames.length}</div>
          </div>
        </div>

        {/* AI Summary */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>📊 AI Summary</h3>
            {!summary && !summaryLoading && (
              <button
                onClick={handleGenerateSummary}
                style={{
                  background: '#8B5CF6',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Generate Summary
              </button>
            )}
          </div>
          
          {summaryLoading ? (
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Analyzing suggestions...</p>
          ) : summary ? (
            <div style={{ 
              background: '#f8fafc', 
              borderRadius: '8px', 
              padding: '16px',
              borderLeft: '4px solid #8B5CF6'
            }}>
              <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.7', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {summary}
              </p>
            </div>
          ) : (
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              Click "Generate Summary" to get an AI analysis of all suggestions.
            </p>
          )}
        </div>

        {/* Theme Filter */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '14px', color: '#666', marginRight: '8px' }}>Filter by theme:</span>
          <button
            onClick={() => setSelectedTheme('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '16px',
              border: 'none',
              background: selectedTheme === 'all' ? '#8B5CF6' : '#f0f0f0',
              color: selectedTheme === 'all' ? '#fff' : '#333',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            All ({suggestions.length})
          </button>
          {themeNames.map(theme => (
            <button
              key={theme}
              onClick={() => setSelectedTheme(theme)}
              style={{
                padding: '6px 14px',
                borderRadius: '16px',
                border: 'none',
                background: selectedTheme === theme ? '#8B5CF6' : '#f0f0f0',
                color: selectedTheme === theme ? '#fff' : '#333',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {theme} ({themes[theme].length})
            </button>
          ))}
        </div>

        {/* Suggestions List */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>
            {selectedTheme === 'all' ? 'All Suggestions' : `${selectedTheme} Suggestions`}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredSuggestions.length === 0 ? (
              <p style={{ color: '#999', fontSize: '14px' }}>No suggestions yet.</p>
            ) : (
              filteredSuggestions
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '16px',
                      background: '#f9f9f9',
                      borderRadius: '8px',
                      borderLeft: '3px solid #8B5CF6'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: '500', color: '#1e293b' }}>
                        {s.suggestion}
                      </p>
                      <span style={{ fontSize: '12px', color: '#999', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                        {new Date(s.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    {s.follow_up && (
                      <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b' }}>
                        → {s.follow_up}
                      </p>
                    )}
                    {s.anything_else && s.anything_else.toLowerCase() !== 'no' && s.anything_else.toLowerCase() !== 'nope' && (
                      <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>
                        → {s.anything_else}
                      </p>
                    )}
                    {s.language && s.language !== 'English' && (
                      <span style={{ 
                        display: 'inline-block',
                        marginTop: '8px',
                        padding: '2px 8px',
                        background: '#e9e9eb',
                        borderRadius: '10px',
                        fontSize: '11px',
                        color: '#666'
                      }}>
                        {s.language}
                      </span>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SuggestionsDashboard;
