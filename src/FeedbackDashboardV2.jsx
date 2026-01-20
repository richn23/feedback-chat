import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const SHEET_ID = import.meta.env.VITE_FEEDBACK_V2_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const SECTIONS = {
  env: { label: 'Environment', questions: ['classroom', 'facilities', 'location', 'schedule'], color: '#3B82F6' },
  exp: { label: 'Experience', questions: ['activities', 'homework', 'materials', 'progress'], color: '#10B981' },
  teach: { label: 'Teaching', questions: ['explanations', 'preparation', 'methods', 'speaking'], color: '#8B5CF6' },
  support: { label: 'Support', questions: ['help', 'feedback', 'encouragement', 'atmosphere'], color: '#F59E0B' },
  mgmt: { label: 'Management', questions: ['timing', 'fairness', 'organization', 'rules'], color: '#EF4444' }
};

const QUESTION_LABELS = {
  env_classroom: 'Classroom comfort',
  env_facilities: 'Facilities',
  env_location: 'Location',
  env_schedule: 'Schedule',
  exp_activities: 'Activities',
  exp_homework: 'Homework',
  exp_materials: 'Materials',
  exp_progress: 'Progress',
  teach_explanations: 'Explanations',
  teach_preparation: 'Preparation',
  teach_methods: 'Methods',
  teach_speaking: 'Speaking practice',
  support_help: 'Help availability',
  support_feedback: 'Feedback quality',
  support_encouragement: 'Encouragement',
  support_atmosphere: 'Atmosphere',
  mgmt_timing: 'Time management',
  mgmt_fairness: 'Fairness',
  mgmt_organization: 'Organization',
  mgmt_rules: 'Rules'
};

const fetchSheetData = async () => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Student%20Feedback%20V2!A:AL?key=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.values || data.values.length < 2) {
    return [];
  }
  
  const headers = data.values[0];
  const rows = data.values.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      const val = row[i] || '';
      if (['env_classroom', 'env_facilities', 'env_location', 'env_schedule',
           'exp_activities', 'exp_homework', 'exp_materials', 'exp_progress',
           'teach_explanations', 'teach_preparation', 'teach_methods', 'teach_speaking',
           'support_help', 'support_feedback', 'support_encouragement', 'support_atmosphere',
           'mgmt_timing', 'mgmt_fairness', 'mgmt_organization', 'mgmt_rules',
           'env_avg', 'exp_avg', 'teach_avg', 'support_avg', 'mgmt_avg', 'overall_avg'].includes(header)) {
        obj[header] = val !== '' ? parseFloat(val) : 0;
      } else {
        obj[header] = val;
      }
    });
    return obj;
  });
};

// Generate AI Summary
const generateAISummary = async (data, comments) => {
  const commentsList = comments.slice(0, 30).map(c => `- ${c.comment} (${c.section})`).join('\n');
  
  const prompt = `You are analyzing student feedback for ES World language school.

DATA:
- Total responses: ${data.length}
- Overall average score: ${(data.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / data.length).toFixed(2)}/3

RECENT COMMENTS:
${commentsList || 'No comments'}

TASK:
Write a brief executive summary (3-4 sentences) that:
1. Summarizes overall satisfaction
2. Highlights what's working well
3. Notes any areas needing attention
4. Gives one actionable recommendation

Use simple, professional language. Be specific where possible.`;

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
        max_tokens: 300,
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

const getScoreColor = (score) => {
  if (score >= 2.5) return '#22C55E';
  if (score >= 1.5) return '#EAB308';
  return '#EF4444';
};

const getScoreBg = (score) => {
  if (score >= 2.5) return '#22C55E';
  if (score >= 1.5) return '#EAB308';
  return '#EF4444';
};

// Time period filters
const getThisMonthData = (data) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return data.filter(r => new Date(r.timestamp) >= startOfMonth);
};

const getLastMonthData = (data) => {
  const now = new Date();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  return data.filter(r => {
    const date = new Date(r.timestamp);
    return date >= startOfLastMonth && date <= endOfLastMonth;
  });
};

const getThisYearData = (data) => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  return data.filter(r => new Date(r.timestamp) >= startOfYear);
};

const calcAvgForData = (data) => {
  if (data.length === 0) return null;
  return data.reduce((sum, r) => sum + (parseFloat(r.overall_avg) || 0), 0) / data.length;
};

function FeedbackDashboardV2() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterCampus, setFilterCampus] = useState('all');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const sheetData = await fetchSheetData();
      setData(sheetData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const filteredData = data.filter(row => {
    if (filterCampus !== 'all' && row.campus !== filterCampus) return false;
    if (filterTeacher !== 'all' && row.teacher_name !== filterTeacher) return false;
    return true;
  });

  const teachers = [...new Set(data.map(d => d.teacher_name).filter(Boolean))];

  const calcAvg = (key) => {
    if (filteredData.length === 0) return 0;
    return filteredData.reduce((sum, row) => sum + (parseFloat(row[key]) || 0), 0) / filteredData.length;
  };

  const sectionAverages = Object.keys(SECTIONS).map(key => ({
    section: SECTIONS[key].label,
    average: calcAvg(`${key}_avg`),
    color: SECTIONS[key].color
  }));

  const overallAvg = calcAvg('overall_avg');

  // Time period scores
  const thisMonthData = getThisMonthData(filteredData);
  const lastMonthData = getLastMonthData(filteredData);
  const thisYearData = getThisYearData(filteredData);
  
  const thisMonthAvg = calcAvgForData(thisMonthData);
  const lastMonthAvg = calcAvgForData(lastMonthData);
  const thisYearAvg = calcAvgForData(thisYearData);

  // Teacher stats
  const teacherStats = teachers.map(teacher => {
    const teacherData = filteredData.filter(r => r.teacher_name === teacher);
    const avg = teacherData.length > 0 
      ? teacherData.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / teacherData.length 
      : 0;
    return { name: teacher, avg, count: teacherData.length };
  }).sort((a, b) => b.avg - a.avg);

  // Concerns - questions with avg < 2
  const concerns = [];
  Object.entries(SECTIONS).forEach(([sectionKey, section]) => {
    section.questions.forEach(q => {
      const key = `${sectionKey}_${q}`;
      const avg = filteredData.length > 0
        ? filteredData.reduce((sum, row) => sum + (row[key] || 0), 0) / filteredData.length
        : 0;
      if (avg < 2 && filteredData.length > 0) {
        concerns.push({ key, label: QUESTION_LABELS[key], section: section.label, avg });
      }
    });
  });

  const heatmapData = Object.entries(SECTIONS).map(([sectionKey, section]) => ({
    section: section.label,
    sectionKey,
    questions: section.questions.map(q => {
      const key = `${sectionKey}_${q}`;
      const avg = filteredData.length > 0
        ? filteredData.reduce((sum, row) => sum + (row[key] || 0), 0) / filteredData.length
        : 0;
      return { key, label: QUESTION_LABELS[key], avg };
    })
  }));

  const trendData = filteredData
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-20)
    .map(row => ({
      date: new Date(row.timestamp).toLocaleDateString(),
      Environment: parseFloat(row.env_avg) || 0,
      Experience: parseFloat(row.exp_avg) || 0,
      Teaching: parseFloat(row.teach_avg) || 0,
      Support: parseFloat(row.support_avg) || 0,
      Management: parseFloat(row.mgmt_avg) || 0
    }));

  const comments = filteredData.flatMap(row => {
    const c = [];
    if (row.env_comment) c.push({ section: 'Environment', comment: row.env_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.exp_comment) c.push({ section: 'Experience', comment: row.exp_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.teach_comment) c.push({ section: 'Teaching', comment: row.teach_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.support_comment) c.push({ section: 'Support', comment: row.support_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.mgmt_comment) c.push({ section: 'Management', comment: row.mgmt_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.final_comment) c.push({ section: 'General', comment: row.final_comment, date: row.timestamp, teacher: row.teacher_name });
    return c;
  });

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    const summary = await generateAISummary(filteredData, comments);
    setAiSummary(summary);
    setSummaryLoading(false);
  };

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    maxWidth: {
      maxWidth: '1200px',
      margin: '0 auto'
    },
    card: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    header: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#1f2937',
      margin: 0
    },
    subtitle: {
      color: '#6b7280',
      fontSize: '14px',
      margin: '4px 0 0'
    },
    filterRow: {
      display: 'flex',
      gap: '12px'
    },
    select: {
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      backgroundColor: 'white'
    },
    tabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '16px',
      flexWrap: 'wrap'
    },
    tab: (active) => ({
      padding: '8px 16px',
      borderRadius: '8px',
      fontWeight: '500',
      fontSize: '14px',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: active ? '#f97316' : 'white',
      color: active ? 'white' : '#4b5563',
      transition: 'all 0.15s'
    }),
    overallScore: {
      textAlign: 'center'
    },
    scoreCircle: (score) => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '96px',
      height: '96px',
      borderRadius: '50%',
      backgroundColor: getScoreBg(score)
    }),
    scoreText: {
      fontSize: '30px',
      fontWeight: 'bold',
      color: 'white'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '12px',
      marginTop: '16px'
    },
    statCard: {
      backgroundColor: '#f9fafb',
      borderRadius: '12px',
      padding: '16px',
      textAlign: 'center'
    },
    heatmapSection: {
      marginBottom: '16px'
    },
    heatmapGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '8px'
    },
    heatmapCell: (score) => ({
      padding: '12px',
      borderRadius: '8px',
      backgroundColor: getScoreBg(score),
      color: 'white',
      textAlign: 'center'
    }),
    legend: {
      display: 'flex',
      justifyContent: 'center',
      gap: '16px',
      marginTop: '24px',
      fontSize: '12px',
      color: '#6b7280'
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    legendDot: (color) => ({
      width: '12px',
      height: '12px',
      borderRadius: '4px',
      backgroundColor: color
    }),
    comment: {
      borderLeft: '4px solid #fb923c',
      paddingLeft: '12px',
      paddingTop: '8px',
      paddingBottom: '8px',
      marginBottom: '12px'
    },
    commentText: {
      fontSize: '14px',
      color: '#1f2937',
      margin: 0
    },
    commentMeta: {
      fontSize: '12px',
      color: '#9ca3af',
      marginTop: '4px'
    },
    loading: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      color: '#6b7280'
    },
    refreshBtn: {
      padding: '8px 16px',
      backgroundColor: '#f3f4f6',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      cursor: 'pointer'
    },
    summaryBox: {
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      padding: '16px',
      borderLeft: '4px solid #f97316',
      marginTop: '16px'
    },
    generateBtn: {
      padding: '8px 16px',
      backgroundColor: '#f97316',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer'
    },
    teacherRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid #f3f4f6'
    },
    concernItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      backgroundColor: '#fef2f2',
      borderRadius: '8px',
      marginBottom: '8px'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        {/* Header */}
        <div style={styles.card}>
          <div style={styles.header}>
            <div>
              <h1 style={styles.title}>Feedback Dashboard V2</h1>
              <p style={styles.subtitle}>{filteredData.length} responses</p>
            </div>
            <div style={styles.filterRow}>
              <select value={filterCampus} onChange={e => setFilterCampus(e.target.value)} style={styles.select}>
                <option value="all">All Campuses</option>
                <option value="Dubai">Dubai</option>
                <option value="London">London</option>
              </select>
              <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={styles.select}>
                <option value="all">All Teachers</option>
                {teachers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={loadData} style={styles.refreshBtn}>↻ Refresh</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {['overview', 'concerns', 'teachers', 'heatmap', 'trends', 'comments'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={styles.tab(activeTab === tab)}
            >
              {tab === 'concerns' && '⚠️ '}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            {/* Overall Score */}
            <div style={{ ...styles.card, ...styles.overallScore }}>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>Overall Score</p>
              <div style={styles.scoreCircle(overallAvg)}>
                <span style={styles.scoreText}>{overallAvg.toFixed(1)}</span>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>out of 3.0</p>
            </div>

            {/* Time Period Scores */}
            <div style={styles.card}>
              <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Score Trends</h2>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>This Month</p>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: thisMonthAvg ? getScoreColor(thisMonthAvg) : '#9ca3af', margin: 0 }}>
                    {thisMonthAvg ? thisMonthAvg.toFixed(1) : '-'}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{thisMonthData.length} responses</p>
                </div>
                <div style={styles.statCard}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Last Month</p>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: lastMonthAvg ? getScoreColor(lastMonthAvg) : '#9ca3af', margin: 0 }}>
                    {lastMonthAvg ? lastMonthAvg.toFixed(1) : '-'}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{lastMonthData.length} responses</p>
                </div>
                <div style={styles.statCard}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>This Year</p>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: thisYearAvg ? getScoreColor(thisYearAvg) : '#9ca3af', margin: 0 }}>
                    {thisYearAvg ? thisYearAvg.toFixed(1) : '-'}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{thisYearData.length} responses</p>
                </div>
                <div style={styles.statCard}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>All Time</p>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: getScoreColor(overallAvg), margin: 0 }}>
                    {overallAvg.toFixed(1)}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{filteredData.length} responses</p>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontWeight: '600', color: '#1f2937', margin: 0 }}>📊 AI Summary</h2>
                {!aiSummary && !summaryLoading && (
                  <button onClick={handleGenerateSummary} style={styles.generateBtn}>
                    Generate Summary
                  </button>
                )}
              </div>
              {summaryLoading && (
                <p style={{ color: '#6b7280', marginTop: '16px' }}>Analyzing feedback...</p>
              )}
              {aiSummary && (
                <div style={styles.summaryBox}>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#1f2937' }}>{aiSummary}</p>
                </div>
              )}
              {!aiSummary && !summaryLoading && (
                <p style={{ color: '#9ca3af', marginTop: '16px', fontSize: '14px' }}>
                  Click "Generate Summary" to get an AI analysis of the feedback.
                </p>
              )}
            </div>

            {/* Section Averages Chart */}
            <div style={styles.card}>
              <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Section Averages</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sectionAverages} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 3]} />
                  <YAxis type="category" dataKey="section" width={100} />
                  <Tooltip formatter={(val) => val.toFixed(2)} />
                  <Bar dataKey="average" fill="#F97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Concerns Tab */}
        {activeTab === 'concerns' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
              ⚠️ Areas Needing Attention
            </h2>
            {concerns.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#22c55e', padding: '32px' }}>
                ✓ No major concerns - all areas scoring above 2.0
              </p>
            ) : (
              <div>
                {concerns.sort((a, b) => a.avg - b.avg).map((c, i) => (
                  <div key={i} style={styles.concernItem}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '500', color: '#991b1b' }}>{c.label}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>{c.section}</p>
                    </div>
                    <div style={{ 
                      backgroundColor: '#ef4444', 
                      color: 'white', 
                      padding: '4px 12px', 
                      borderRadius: '12px',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}>
                      {c.avg.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Teachers Tab */}
        {activeTab === 'teachers' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
              Teacher Rankings
            </h2>
            {teacherStats.map((t, i) => (
              <div key={t.name} style={styles.teacherRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ 
                    width: '28px', 
                    height: '28px', 
                    borderRadius: '50%', 
                    backgroundColor: i < 3 ? '#f97316' : '#e5e7eb',
                    color: i < 3 ? 'white' : '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {i + 1}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontWeight: '500' }}>{t.name}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{t.count} responses</p>
                  </div>
                </div>
                <div style={{ 
                  backgroundColor: getScoreBg(t.avg), 
                  color: 'white', 
                  padding: '4px 12px', 
                  borderRadius: '12px',
                  fontWeight: '600'
                }}>
                  {t.avg.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Heatmap Tab */}
        {activeTab === 'heatmap' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Question Heatmap</h2>
            {heatmapData.map(section => (
              <div key={section.sectionKey} style={styles.heatmapSection}>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  {section.section}
                </p>
                <div style={styles.heatmapGrid}>
                  {section.questions.map(q => (
                    <div key={q.key} style={styles.heatmapCell(q.avg)}>
                      <p style={{ fontSize: '12px', opacity: 0.9, margin: '0 0 4px' }}>{q.label}</p>
                      <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{q.avg.toFixed(1)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={styles.legend}>
              <span style={styles.legendItem}><span style={styles.legendDot('#22C55E')}/> 2.5-3.0 Good</span>
              <span style={styles.legendItem}><span style={styles.legendDot('#EAB308')}/> 1.5-2.4 Needs attention</span>
              <span style={styles.legendItem}><span style={styles.legendDot('#EF4444')}/> 0-1.4 Problem</span>
            </div>
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Trends Over Time</h2>
            {trendData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>Not enough data for trends</p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 3]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Environment" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Experience" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Teaching" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Support" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Management" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
              Student Comments ({comments.length})
            </h2>
            {comments.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>No comments yet</p>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {comments.map((c, i) => (
                  <div key={i} style={styles.comment}>
                    <p style={styles.commentText}>{c.comment}</p>
                    <p style={styles.commentMeta}>
                      {c.section} • {c.teacher} • {new Date(c.date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FeedbackDashboardV2;
