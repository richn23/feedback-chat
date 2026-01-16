import React, { useState, useEffect } from 'react';

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// Generate AI summary with evidence
const generateAISummary = async (name, type, mss, lessonsAvg, teacherAvg, responseCount, positiveComments, negativeComments) => {
  const positiveList = positiveComments.slice(0, 15).map(c => `"${c.text}" (${c.count})`).join('\n');
  const negativeList = negativeComments.slice(0, 15).map(c => `"${c.text}" (${c.count})`).join('\n');
  
  const prompt = `You are analyzing student feedback for ${type === 'teacher' ? 'a teacher named' : 'the'} ${name}.

DATA:
- MSS (satisfaction score): ${mss || 'N/A'}/5
- Lessons Average: ${lessonsAvg || 'N/A'}/5  
- Teacher Average: ${teacherAvg || 'N/A'}/5
- Total Responses: ${responseCount}

RATING SCALE (use this to calibrate your language):
- 4.5+ = Exceptional (outstanding, standout performer)
- 4.0-4.4 = Good (solid, performing well)
- 3.5-3.9 = Satisfactory (meeting expectations, room for growth)
- 3.0-3.4 = Needs attention (below expectations, support recommended)
- Below 3.0 = Serious concerns (requires intervention, urgent support needed)

POSITIVE COMMENTS (with frequency):
${positiveList || 'None'}

NEGATIVE COMMENTS / IMPROVEMENT SUGGESTIONS (with frequency):
${negativeList || 'None'}

TASK:
1. Write a 2-3 sentence management summary that:
   - Uses language calibrated to the rating scale above (don't call 4.1 "exceptional")
   - Highlights specific strengths with evidence
   - If there are concerns, frame constructively (focus on support/development opportunities, not blame)
   - Is professional and factual, not accusatory

2. For each claim you make, cite the specific comments that support it.

TONE GUIDELINES:
- Celebrate high performers by name with specifics
- For concerns, use phrases like "may benefit from additional support", "development opportunities identified", "review individual feedback"
- Never use accusatory language like "dragging down", "poor performance", "failing"
- Let the data speak - don't editorialize
- Be specific, not generic

RESPOND IN THIS EXACT JSON FORMAT:
{
  "summary": "Your 2-3 sentence summary here",
  "evidence": [
    {
      "claim": "the specific claim you made",
      "type": "positive" or "negative",
      "quotes": ["exact quote 1", "exact quote 2"]
    }
  ]
}

IMPORTANT: 
- Only reference comments that actually appear in the data above
- Match your language to the actual MSS score using the scale
- Be constructive and professional throughout`;

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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.content[0].text;
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error('Error generating summary:', error);
    return null;
  }
};

// Fetch data from Google Sheets
const fetchSheetData = async () => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:L?key=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.values || data.values.length < 2) {
    return [];
  }
  
  const rows = data.values.slice(1);
  
  return rows.map(row => ({
    timestamp: row[0] || '',
    language: row[1] || '',
    campus: row[2] || '',
    teacher: row[3] || '',
    duration: row[4] || '',
    lessons_rating: row[5] !== '' && row[5] !== undefined ? Number(row[5]) : null,
    lessons_comment: row[6] || '',
    teacher_rating: row[7] !== '' && row[7] !== undefined ? Number(row[7]) : null,
    teacher_comment: row[8] || '',
    working_well: row[9] || '',
    improve: row[10] || '',
    other: row[11] || ''
  }));
};

// Calculate MSS (Monthly Satisfaction Score)
const calculateMSS = (responses) => {
  const validResponses = responses.filter(r => 
    r.lessons_rating !== null && r.teacher_rating !== null
  );
  if (validResponses.length === 0) return null;
  
  const total = validResponses.reduce((sum, r) => 
    sum + (r.lessons_rating + r.teacher_rating) / 2, 0
  );
  return (total / validResponses.length).toFixed(1);
};

// Calculate average for a single rating field
const calculateAvg = (responses, field) => {
  const valid = responses.filter(r => r[field] !== null);
  if (valid.length === 0) return null;
  const total = valid.reduce((sum, r) => sum + r[field], 0);
  return (total / valid.length).toFixed(1);
};

// Get responses from this month
const getThisMonthResponses = (responses) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return responses.filter(r => new Date(r.timestamp) >= startOfMonth);
};

// Get responses from last month
const getLastMonthResponses = (responses) => {
  const now = new Date();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  return responses.filter(r => {
    const date = new Date(r.timestamp);
    return date >= startOfLastMonth && date <= endOfLastMonth;
  });
};

// Get responses from this week
const getThisWeekResponses = (responses) => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return responses.filter(r => new Date(r.timestamp) >= startOfWeek);
};

// Filter responses by date range
const filterByDateRange = (responses, startDate, endDate) => {
  return responses.filter(r => {
    const date = new Date(r.timestamp);
    if (startDate && date < new Date(startDate)) return false;
    if (endDate && date > new Date(endDate + 'T23:59:59')) return false;
    return true;
  });
};

// Get unique values for a field
const getUniqueValues = (responses, field) => {
  return [...new Set(responses.map(r => r[field]).filter(Boolean))];
};

// Group responses by field
const groupBy = (responses, field) => {
  return responses.reduce((acc, r) => {
    const key = r[field] || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});
};

// Check if text is primarily English
const isEnglish = (text) => {
  if (!text) return false;
  // Check if most characters are basic Latin
  const latinChars = text.match(/[a-zA-Z]/g) || [];
  return latinChars.length > text.length * 0.5;
};

// Words to filter out (not actionable feedback)
const NOISE_WORDS = [
  'nothing', 'none', 'n/a', 'na', 'no', 'yes', 'ok', 'okay', 'fine',
  'change', 'improvement', 'improve', 'better', 'more', 'less',
  'good', 'bad', 'great', 'nice', 'everything', 'anything',
  'teacher', 'lessons', 'class', 'classes'
];

// Check if comment is just noise
const isNoiseComment = (text) => {
  const normalized = text.toLowerCase().trim();
  // Check if it's just a noise word or very short
  if (normalized.length < 4) return true;
  if (NOISE_WORDS.includes(normalized)) return true;
  // Check if it's just "nothing" with punctuation
  if (normalized.replace(/[^a-z]/g, '') === 'nothing') return true;
  return false;
};

// Normalize comment for grouping (lowercase, trim, remove punctuation)
const normalizeComment = (text) => {
  return text.toLowerCase().trim().replace(/[.,!?;:'"]/g, '');
};

// Group and count similar comments
const groupComments = (comments) => {
  const groups = {};
  
  comments.forEach(comment => {
    if (!comment || !isEnglish(comment) || isNoiseComment(comment)) return;
    
    const normalized = normalizeComment(comment);
    if (normalized.length < 4) return; // Skip very short
    
    // Try to find similar existing group
    let foundGroup = null;
    for (const key of Object.keys(groups)) {
      // Check if comments are similar (one contains the other, or very close)
      if (key.includes(normalized) || normalized.includes(key) || 
          levenshteinSimilar(key, normalized)) {
        foundGroup = key;
        break;
      }
    }
    
    if (foundGroup) {
      groups[foundGroup].count++;
      // Keep the shorter/cleaner version as the display text
      if (comment.length < groups[foundGroup].display.length) {
        groups[foundGroup].display = comment;
      }
    } else {
      groups[normalized] = { display: comment, count: 1 };
    }
  });
  
  // Convert to array and sort by count
  return Object.values(groups)
    .sort((a, b) => b.count - a.count)
    .map(g => ({ text: g.display, count: g.count }));
};

// Generate executive summary for overall dashboard
const generateExecutiveSummary = async (responses, byCampus, byTeacher) => {
  // Calculate stats
  const overallMSS = calculateMSS(responses);
  
  const campusStats = Object.entries(byCampus).map(([name, items]) => ({
    name,
    mss: calculateMSS(items),
    count: items.length
  })).sort((a, b) => parseFloat(b.mss || 0) - parseFloat(a.mss || 0));
  
  const teacherStats = Object.entries(byTeacher).map(([name, items]) => ({
    name,
    mss: calculateMSS(items),
    campus: items[0]?.campus || '',
    count: items.length
  })).sort((a, b) => parseFloat(b.mss || 0) - parseFloat(a.mss || 0));
  
  const topPerformers = teacherStats.filter(t => parseFloat(t.mss) >= 4.0).slice(0, 3);
  const needsSupport = teacherStats.filter(t => parseFloat(t.mss) < 3.5);
  
  const prompt = `You are writing an executive summary of student feedback for ES World language school.

OVERALL DATA:
- Overall MSS: ${overallMSS}/5
- Total Responses: ${responses.length}

CAMPUS BREAKDOWN:
${campusStats.map(c => `- ${c.name}: MSS ${c.mss}, ${c.count} responses`).join('\n')}

TEACHER PERFORMANCE (sorted by MSS):
${teacherStats.map(t => `- ${t.name} (${t.campus}): MSS ${t.mss}`).join('\n')}

RATING SCALE:
- 4.5+ = Exceptional
- 4.0-4.4 = Good  
- 3.5-3.9 = Satisfactory
- 3.0-3.4 = Needs attention
- Below 3.0 = Serious concerns

TASK:
Write a 4-5 sentence executive summary that:
1. Opens with overall satisfaction level (calibrated to the scale)
2. Compares campus performance factually
3. Highlights top performers by name with their scores
4. Notes if any teachers may benefit from additional support (constructive tone, no blame)
5. Ends with a forward-looking recommendation

TONE:
- Professional and factual
- Celebrate successes with specifics
- Frame concerns as "development opportunities" or "may benefit from support"
- Never accusatory or blaming
- Let data speak for itself

Respond with just the summary text, no JSON needed.`;

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

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    return result.content[0].text;
  } catch (error) {
    console.error('Error generating executive summary:', error);
    return null;
  }
};

// Simple similarity check (for grouping similar comments)
const levenshteinSimilar = (a, b) => {
  if (Math.abs(a.length - b.length) > 5) return false;
  
  // Check word overlap
  const wordsA = a.split(' ').filter(w => w.length > 2);
  const wordsB = b.split(' ').filter(w => w.length > 2);
  
  let matches = 0;
  wordsA.forEach(word => {
    if (wordsB.includes(word)) matches++;
  });
  
  return matches >= Math.min(wordsA.length, wordsB.length) * 0.6;
};

// Extract positive comments
const getPositiveComments = (responses) => {
  const comments = [];
  responses.forEach(r => {
    if (r.working_well) comments.push(r.working_well);
    if (r.lessons_rating >= 4 && r.lessons_comment) comments.push(r.lessons_comment);
    if (r.teacher_rating >= 4 && r.teacher_comment) comments.push(r.teacher_comment);
  });
  return groupComments(comments);
};

// Extract negative comments
const getNegativeComments = (responses) => {
  const comments = [];
  responses.forEach(r => {
    if (r.improve) comments.push(r.improve);
    if (r.lessons_rating !== null && r.lessons_rating <= 2 && r.lessons_comment) comments.push(r.lessons_comment);
    if (r.teacher_rating !== null && r.teacher_rating <= 2 && r.teacher_comment) comments.push(r.teacher_comment);
  });
  return groupComments(comments);
};

// Rating display component
const RatingDisplay = ({ value, showEmoji = true }) => {
  if (value === null) return <span style={{ color: '#999' }}>-</span>;
  const emojis = ['😟', '😕', '😐', '🙂', '😊', '😄'];
  const numValue = parseFloat(value);
  const emoji = emojis[Math.round(numValue)] || '';
  return (
    <span>
      {value} {showEmoji && <span style={{ marginLeft: '4px' }}>{emoji}</span>}
    </span>
  );
};

// Trend indicator component
const TrendArrow = ({ current, previous }) => {
  if (current === null || previous === null) return <span style={{ color: '#999', marginLeft: '8px' }}>—</span>;
  const diff = parseFloat(current) - parseFloat(previous);
  if (diff > 0.1) return <span style={{ color: '#22c55e', marginLeft: '8px', fontSize: '18px' }}>↑</span>;
  if (diff < -0.1) return <span style={{ color: '#ef4444', marginLeft: '8px', fontSize: '18px' }}>↓</span>;
  return <span style={{ color: '#999', marginLeft: '8px', fontSize: '18px' }}>→</span>;
};

// Summary Card component
const SummaryCard = ({ title, value, subtitle, trend, previousValue }) => (
  <div style={{
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    flex: 1,
    minWidth: '150px'
  }}>
    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{title}</div>
    <div style={{ fontSize: '28px', fontWeight: '600', color: '#333', display: 'flex', alignItems: 'center' }}>
      {value}
      {trend && <TrendArrow current={previousValue !== undefined ? value : null} previous={previousValue} />}
    </div>
    {subtitle && <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{subtitle}</div>}
  </div>
);

// Data Table component
const DataTable = ({ columns, data, onRowClick }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} style={{
              textAlign: 'left',
              padding: '12px 16px',
              borderBottom: '2px solid #e5e5e5',
              fontWeight: '600',
              color: '#333',
              background: '#f9f9f9'
            }}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr 
            key={i} 
            onClick={() => onRowClick && onRowClick(row)}
            style={{ 
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {columns.map((col, j) => (
              <td key={j} style={{
                padding: '12px 16px',
                borderBottom: '1px solid #eee',
                color: '#555'
              }}>
                {col.render ? col.render(row) : row[col.field]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Modal component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#999',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Generate text summary from grouped comments
const generateSummary = (items, type) => {
  if (items.length === 0) return null;
  
  // Get top themes (items with most mentions)
  const topItems = items.slice(0, 5);
  const themes = topItems.map(item => item.text.toLowerCase());
  
  if (type === 'positive') {
    if (themes.length === 1) {
      return `Students particularly appreciate: ${themes[0]}.`;
    }
    const lastTheme = themes.pop();
    return `Students particularly appreciate: ${themes.join(', ')}${themes.length > 0 ? ' and ' : ''}${lastTheme}.`;
  } else {
    if (themes.length === 1) {
      return `Main area for improvement: ${themes[0]}.`;
    }
    const lastTheme = themes.pop();
    return `Key areas for improvement: ${themes.join(', ')}${themes.length > 0 ? ' and ' : ''}${lastTheme}.`;
  }
};

// Comments Summary component
const CommentsSummary = ({ positive, negative }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    <div>
      <h4 style={{ margin: '0 0 12px', color: '#22c55e', fontSize: '15px', fontWeight: '600' }}>
        ✓ What's Working Well
      </h4>
      {positive.length > 0 ? (
        <>
          <p style={{ 
            margin: '0 0 16px', 
            padding: '12px 16px', 
            background: '#f0fdf4', 
            borderRadius: '8px',
            color: '#166534',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            {generateSummary(positive, 'positive')}
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', fontSize: '14px', lineHeight: '1.8' }}>
            {positive.slice(0, 6).map((item, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>
                {item.text}
                {item.count > 1 && (
                  <span style={{ 
                    marginLeft: '8px', 
                    background: '#dcfce7', 
                    color: '#166534',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {item.count}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p style={{ color: '#999', margin: 0, fontSize: '14px' }}>No positive comments yet</p>
      )}
    </div>
    
    <div>
      <h4 style={{ margin: '0 0 12px', color: '#f59e0b', fontSize: '15px', fontWeight: '600' }}>
        △ Needs Improvement
      </h4>
      {negative.length > 0 ? (
        <>
          <p style={{ 
            margin: '0 0 16px', 
            padding: '12px 16px', 
            background: '#fffbeb', 
            borderRadius: '8px',
            color: '#92400e',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            {generateSummary(negative, 'negative')}
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', fontSize: '14px', lineHeight: '1.8' }}>
            {negative.slice(0, 6).map((item, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>
                {item.text}
                {item.count > 1 && (
                  <span style={{ 
                    marginLeft: '8px', 
                    background: '#fef3c7', 
                    color: '#92400e',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {item.count}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p style={{ color: '#999', margin: 0, fontSize: '14px' }}>No improvement suggestions yet</p>
      )}
    </div>
  </div>
);

// Main Dashboard Component
function Dashboard() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('home');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ title: '', type: '', data: [] });
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  
  // Filters
  const [campusFilter, setCampusFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Executive summary state
  const [executiveSummary, setExecutiveSummary] = useState(null);
  const [executiveSummaryLoading, setExecutiveSummaryLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchSheetData();
      setResponses(data);
      setError(null);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const getFilteredResponses = () => {
    let filtered = responses;
    
    if (campusFilter !== 'all') {
      filtered = filtered.filter(r => r.campus === campusFilter);
    }
    if (teacherFilter !== 'all') {
      filtered = filtered.filter(r => r.teacher === teacherFilter);
    }
    if (startDate || endDate) {
      filtered = filterByDateRange(filtered, startDate, endDate);
    }
    
    return filtered;
  };

  const filteredResponses = getFilteredResponses();
  const thisMonthResponses = getThisMonthResponses(filteredResponses);
  const lastMonthResponses = getLastMonthResponses(filteredResponses);
  const thisWeekResponses = getThisWeekResponses(filteredResponses);
  const campuses = getUniqueValues(responses, 'campus');
  const teachers = getUniqueValues(responses, 'teacher');

  // MSS calculations for trend
  const currentMSS = calculateMSS(thisMonthResponses);
  const lastMSS = calculateMSS(lastMonthResponses);

  // Open campus modal
  const openCampusModal = async (campusName, campusResponses) => {
    const stats = {
      mss: calculateMSS(campusResponses),
      lessons: calculateAvg(campusResponses, 'lessons_rating'),
      teacher: calculateAvg(campusResponses, 'teacher_rating'),
      count: campusResponses.length
    };
    const positive = getPositiveComments(campusResponses);
    const negative = getNegativeComments(campusResponses);
    
    setModalData({
      title: `${campusName} Campus`,
      type: 'campus',
      data: campusResponses,
      stats,
      positive,
      negative
    });
    setAiSummary(null);
    setModalOpen(true);
    
    // Generate AI summary
    setSummaryLoading(true);
    const summary = await generateAISummary(
      campusName, 'campus', stats.mss, stats.lessons, stats.teacher, stats.count, positive, negative
    );
    setAiSummary(summary);
    setSummaryLoading(false);
  };

  // Open teacher modal
  const openTeacherModal = async (teacherName, teacherResponses) => {
    const stats = {
      mss: calculateMSS(teacherResponses),
      lessons: calculateAvg(teacherResponses, 'lessons_rating'),
      teacher: calculateAvg(teacherResponses, 'teacher_rating'),
      count: teacherResponses.length,
      campus: teacherResponses[0]?.campus || ''
    };
    const positive = getPositiveComments(teacherResponses);
    const negative = getNegativeComments(teacherResponses);
    
    setModalData({
      title: teacherName,
      type: 'teacher',
      data: teacherResponses,
      stats,
      positive,
      negative
    });
    setAiSummary(null);
    setModalOpen(true);
    
    // Generate AI summary
    setSummaryLoading(true);
    const summary = await generateAISummary(
      teacherName, 'teacher', stats.mss, stats.lessons, stats.teacher, stats.count, positive, negative
    );
    setAiSummary(summary);
    setSummaryLoading(false);
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Date', 'Language', 'Campus', 'Teacher', 'Duration', 'Lessons Rating', 'Lessons Comment', 'Teacher Rating', 'Teacher Comment', 'Working Well', 'Improve', 'Other'];
    const rows = filteredResponses.map(r => [
      new Date(r.timestamp).toLocaleDateString(),
      r.language,
      r.campus,
      r.teacher,
      r.duration,
      r.lessons_rating,
      r.lessons_comment,
      r.teacher_rating,
      r.teacher_comment,
      r.working_well,
      r.improve,
      r.other
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif'
      }}>
        <div>Loading...</div>
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
        <div>{error}</div>
      </div>
    );
  }

  // Teacher Detail View
  if (view === 'teacher' && selectedTeacher) {
    const teacherResponses = responses.filter(r => r.teacher === selectedTeacher);
    const teacherThisMonth = getThisMonthResponses(teacherResponses);
    const teacherLastMonth = getLastMonthResponses(teacherResponses);

    const currentTeacherMSS = calculateMSS(teacherThisMonth);
    const lastTeacherMSS = calculateMSS(teacherLastMonth);

    const positiveComments = getPositiveComments(teacherResponses);
    const negativeComments = getNegativeComments(teacherResponses);

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
          gap: '16px'
        }}>
          <button
            onClick={() => { setView('survey'); setSelectedTeacher(null); }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ←
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>{selectedTeacher}</h1>
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Teacher Performance</p>
          </div>
        </div>

        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Summary Cards */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <SummaryCard 
              title="MSS (This Month)" 
              value={currentTeacherMSS ? `${currentTeacherMSS} ⭐` : '-'}
              trend={true}
              previousValue={lastTeacherMSS}
            />
            <SummaryCard 
              title="MSS (Last Month)" 
              value={lastTeacherMSS ? `${lastTeacherMSS} ⭐` : '-'} 
            />
            <SummaryCard 
              title="Lessons Avg" 
              value={calculateAvg(teacherResponses, 'lessons_rating') || '-'} 
            />
            <SummaryCard 
              title="Teacher Avg" 
              value={calculateAvg(teacherResponses, 'teacher_rating') || '-'} 
            />
            <SummaryCard 
              title="Total Responses" 
              value={teacherResponses.length} 
            />
          </div>

          {/* Comments Summary */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Feedback Summary</h3>
            <CommentsSummary positive={positiveComments} negative={negativeComments} />
          </div>

          {/* All Responses */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>All Responses</h3>
            <DataTable
              columns={[
                { header: 'Date', render: (r) => new Date(r.timestamp).toLocaleDateString() },
                { header: 'Lessons', render: (r) => <RatingDisplay value={r.lessons_rating} /> },
                { header: 'Teacher', render: (r) => <RatingDisplay value={r.teacher_rating} /> },
                { header: 'Comment', field: 'lessons_comment' }
              ]}
              data={teacherResponses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))}
            />
          </div>
        </div>
      </div>
    );
  }

  // Survey View (Level 2)
  if (view === 'survey') {
    const byCampus = groupBy(filteredResponses, 'campus');
    const byTeacher = groupBy(filteredResponses, 'teacher');

    // Get overall positive and negative comments
    const allPositive = getPositiveComments(filteredResponses);
    const allNegative = getNegativeComments(filteredResponses);

    return (
      <div style={{
        minHeight: '100vh',
        background: '#f2f2f7',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif'
      }}>
        {/* Modal */}
        <Modal 
          isOpen={modalOpen} 
          onClose={() => { setModalOpen(false); setAiSummary(null); }}
          title={modalData.title}
        >
          {modalData.stats && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>MSS</div>
                  <div style={{ fontSize: '24px', fontWeight: '600' }}>{modalData.stats.mss || '-'} ⭐</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Lessons</div>
                  <div style={{ fontSize: '24px', fontWeight: '600' }}><RatingDisplay value={modalData.stats.lessons} /></div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Teacher</div>
                  <div style={{ fontSize: '24px', fontWeight: '600' }}><RatingDisplay value={modalData.stats.teacher} /></div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Responses</div>
                  <div style={{ fontSize: '24px', fontWeight: '600' }}>{modalData.stats.count}</div>
                </div>
              </div>
              
              {/* AI Summary Section */}
              <div style={{ 
                background: '#f8fafc', 
                borderRadius: '12px', 
                padding: '20px',
                marginBottom: '20px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                  📊 Analysis Summary
                </h4>
                
                {summaryLoading ? (
                  <div style={{ color: '#64748b', fontSize: '14px' }}>
                    Analyzing feedback...
                  </div>
                ) : aiSummary ? (
                  <>
                    <p style={{ 
                      margin: '0 0 20px', 
                      fontSize: '15px', 
                      lineHeight: '1.6',
                      color: '#1e293b'
                    }}>
                      {aiSummary.summary}
                    </p>
                    
                    {/* Evidence Table */}
                    {aiSummary.evidence && aiSummary.evidence.length > 0 && (
                      <div>
                        <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>
                          Evidence
                        </h5>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px 0 0 0' }}>Claim</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f1f5f9', borderRadius: '0 6px 0 0' }}>Supporting Comments</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aiSummary.evidence.map((item, i) => (
                              <tr key={i}>
                                <td style={{ 
                                  padding: '10px 12px', 
                                  borderBottom: '1px solid #e2e8f0',
                                  verticalAlign: 'top',
                                  fontWeight: '500',
                                  color: item.type === 'positive' ? '#166534' : '#92400e'
                                }}>
                                  {item.type === 'positive' ? '✓' : '△'} {item.claim}
                                </td>
                                <td style={{ 
                                  padding: '10px 12px', 
                                  borderBottom: '1px solid #e2e8f0',
                                  color: '#64748b'
                                }}>
                                  {item.quotes.map((quote, j) => (
                                    <span key={j}>
                                      "{quote}"{j < item.quotes.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '14px' }}>
                    Unable to generate summary
                  </div>
                )}
              </div>
            </div>
          )}
          <CommentsSummary 
            positive={modalData.positive || []} 
            negative={modalData.negative || []} 
          />
        </Modal>

        {/* Header */}
        <div style={{
          background: '#fff',
          padding: '20px 32px',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setView('home')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ←
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Class Feedback</h1>
              <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Survey Results</p>
            </div>
          </div>
          <button
            onClick={exportCSV}
            style={{
              background: '#FF9500',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Export CSV
          </button>
        </div>

        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Filters */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Campus</label>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  minWidth: '120px'
                }}
              >
                <option value="all">All Campuses</option>
                {campuses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Teacher</label>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  minWidth: '120px'
                }}
              >
                <option value="all">All Teachers</option>
                {teachers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>
            <button
              onClick={() => { setCampusFilter('all'); setTeacherFilter('all'); setStartDate(''); setEndDate(''); }}
              style={{
                padding: '8px 16px',
                background: '#f0f0f0',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                marginTop: '18px'
              }}
            >
              Clear
            </button>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <SummaryCard 
              title="Total Responses" 
              value={filteredResponses.length}
              subtitle={`${thisWeekResponses.length} this week`}
            />
            <SummaryCard 
              title="MSS (This Month)" 
              value={currentMSS ? `${currentMSS} ⭐` : '-'}
              trend={true}
              previousValue={lastMSS}
              subtitle={lastMSS ? `Last month: ${lastMSS}` : ''}
            />
            <SummaryCard 
              title="Lessons Avg" 
              value={calculateAvg(filteredResponses, 'lessons_rating') || '-'} 
            />
            <SummaryCard 
              title="Teacher Avg" 
              value={calculateAvg(filteredResponses, 'teacher_rating') || '-'} 
            />
          </div>

          {/* Executive Summary */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                📊 Executive Summary
              </h3>
              {!executiveSummary && !executiveSummaryLoading && (
                <button
                  onClick={async () => {
                    setExecutiveSummaryLoading(true);
                    const summary = await generateExecutiveSummary(filteredResponses, byCampus, byTeacher);
                    setExecutiveSummary(summary);
                    setExecutiveSummaryLoading(false);
                  }}
                  style={{
                    background: '#FF9500',
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
            
            {executiveSummaryLoading ? (
              <div style={{ color: '#64748b', fontSize: '14px', padding: '20px 0' }}>
                Analyzing feedback data...
              </div>
            ) : executiveSummary ? (
              <div style={{ 
                background: '#f8fafc', 
                borderRadius: '8px', 
                padding: '20px',
                borderLeft: '4px solid #FF9500'
              }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: '15px', 
                  lineHeight: '1.7',
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap'
                }}>
                  {executiveSummary}
                </p>
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                Click "Generate Summary" to create an AI-powered executive overview of all feedback.
              </p>
            )}
          </div>

          {/* By Campus */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>By Campus</h3>
            <DataTable
              columns={[
                { header: 'Campus', field: 'campus' },
                { header: 'Responses', field: 'count' },
                { header: 'MSS', render: (r) => r.mss ? `${r.mss} ⭐` : '-' },
                { header: 'Lessons', render: (r) => <RatingDisplay value={r.lessons} /> },
                { header: 'Teacher', render: (r) => <RatingDisplay value={r.teacherAvg} /> }
              ]}
              data={Object.entries(byCampus).map(([campus, items]) => ({
                campus,
                count: items.length,
                mss: calculateMSS(items),
                lessons: calculateAvg(items, 'lessons_rating'),
                teacherAvg: calculateAvg(items, 'teacher_rating'),
                items
              })).sort((a, b) => parseFloat(b.mss || 0) - parseFloat(a.mss || 0))}
              onRowClick={(row) => openCampusModal(row.campus, row.items)}
            />
          </div>

          {/* By Teacher - sorted by MSS */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>By Teacher (sorted by MSS)</h3>
            <DataTable
              columns={[
                { header: 'Teacher', field: 'teacherName' },
                { header: 'Campus', field: 'campus' },
                { header: 'Responses', field: 'count' },
                { header: 'MSS', render: (r) => r.mss ? `${r.mss} ⭐` : '-' },
                { header: 'Lessons', render: (r) => <RatingDisplay value={r.lessons} /> },
                { header: 'Teacher Rating', render: (r) => <RatingDisplay value={r.teacherRating} /> }
              ]}
              data={Object.entries(byTeacher).map(([teacher, items]) => ({
                teacherName: teacher,
                campus: items[0]?.campus || '',
                count: items.length,
                mss: calculateMSS(items),
                lessons: calculateAvg(items, 'lessons_rating'),
                teacherRating: calculateAvg(items, 'teacher_rating'),
                items
              })).sort((a, b) => parseFloat(b.mss || 0) - parseFloat(a.mss || 0))}
              onRowClick={(row) => openTeacherModal(row.teacherName, row.items)}
            />
          </div>

          {/* Recent Responses */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Recent Responses</h3>
            <DataTable
              columns={[
                { header: 'Date', render: (r) => new Date(r.timestamp).toLocaleDateString() },
                { header: 'Campus', field: 'campus' },
                { header: 'Teacher', field: 'teacher' },
                { header: 'Lessons', render: (r) => <RatingDisplay value={r.lessons_rating} /> },
                { header: 'Teacher', render: (r) => <RatingDisplay value={r.teacher_rating} /> },
                { header: 'Working Well', render: (r) => r.working_well?.substring(0, 50) + (r.working_well?.length > 50 ? '...' : '') }
              ]}
              data={filteredResponses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 20)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Home View (Level 1)
  const thisMonthAll = getThisMonthResponses(responses);
  const lastMonthAll = getLastMonthResponses(responses);
  const homeMSS = calculateMSS(thisMonthAll);
  const homeLastMSS = calculateMSS(lastMonthAll);

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
            background: 'linear-gradient(135deg, #FF9500 0%, #FFAD33 100%)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: '600',
            fontSize: '16px'
          }}>
            ES
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Feedback Dashboard</h1>
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>ES World Survey Management</p>
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
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ↻ Refresh
        </button>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Overview Cards */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <SummaryCard 
            title="Active Surveys" 
            value="1" 
            subtitle="Class Feedback"
          />
          <SummaryCard 
            title="Responses This Week" 
            value={getThisWeekResponses(responses).length} 
          />
          <SummaryCard 
            title="Overall MSS (This Month)" 
            value={homeMSS ? `${homeMSS} ⭐` : '-'}
            trend={true}
            previousValue={homeLastMSS}
            subtitle={homeLastMSS ? `Last month: ${homeLastMSS}` : ''}
          />
          <SummaryCard 
            title="Total Responses" 
            value={responses.length} 
          />
        </div>

        {/* Surveys List */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Surveys</h3>
          <DataTable
            columns={[
              { header: 'Survey Name', field: 'name' },
              { header: 'Status', render: (r) => (
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  background: r.status === 'Active' ? '#dcfce7' : '#f3f4f6',
                  color: r.status === 'Active' ? '#166534' : '#6b7280'
                }}>
                  {r.status}
                </span>
              )},
              { header: 'Responses', field: 'responses' },
              { header: 'MSS', render: (r) => r.mss ? `${r.mss} ⭐` : '-' },
              { header: 'This Week', field: 'thisWeek' }
            ]}
            data={[
              {
                name: 'Class Feedback',
                status: 'Active',
                responses: responses.length,
                mss: homeMSS,
                thisWeek: getThisWeekResponses(responses).length
              }
            ]}
            onRowClick={() => setView('survey')}
          />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
