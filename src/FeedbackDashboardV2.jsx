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
  
  if (!data.values || data.values.length < 2) return [];
  
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

// Translate comments using Claude API
const translateComments = async (comments) => {
  if (!ANTHROPIC_API_KEY || comments.length === 0) return comments;
  
  const nonEnglishComments = comments.filter(c => {
    const text = c.comment;
    if (!text) return false;
    const nonLatin = /[^\u0000-\u007F]/.test(text);
    const seemsNonEnglish = nonLatin || /^(très|magnifique|parfait|عالی|ممتاز|完美|非常|很好|excelente|perfecto|отлично)/i.test(text);
    return seemsNonEnglish;
  });
  
  if (nonEnglishComments.length === 0) return comments;
  
  try {
    const textsToTranslate = nonEnglishComments.map(c => c.comment);
    
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
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Translate each comment to English. Keep order. If already English, keep as is.

Comments:
${textsToTranslate.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Respond with ONLY a JSON array:
["translation 1", "translation 2", ...]`
        }]
      })
    });

    if (!response.ok) throw new Error('Translation API error');
    
    const result = await response.json();
    const text = result.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const translations = JSON.parse(jsonMatch[0]);
      const translationMap = {};
      nonEnglishComments.forEach((c, i) => {
        if (translations[i]) translationMap[c.comment] = translations[i];
      });
      
      return comments.map(c => ({
        ...c,
        originalComment: translationMap[c.comment] ? c.comment : null,
        comment: translationMap[c.comment] || c.comment
      }));
    }
  } catch (error) {
    console.error('Translation error:', error);
  }
  
  return comments;
};

// Generate AI Summary with evidence
const generateAISummary = async (data, sectionAverages, overallAvg) => {
  if (!ANTHROPIC_API_KEY || data.length === 0) return null;
  
  const allComments = [];
  data.forEach(row => {
    if (row.env_comment) allComments.push({ text: row.env_comment, section: 'Environment', teacher: row.teacher_name });
    if (row.exp_comment) allComments.push({ text: row.exp_comment, section: 'Experience', teacher: row.teacher_name });
    if (row.teach_comment) allComments.push({ text: row.teach_comment, section: 'Teaching', teacher: row.teacher_name });
    if (row.support_comment) allComments.push({ text: row.support_comment, section: 'Support', teacher: row.teacher_name });
    if (row.mgmt_comment) allComments.push({ text: row.mgmt_comment, section: 'Management', teacher: row.teacher_name });
    if (row.final_comment) allComments.push({ text: row.final_comment, section: 'General', teacher: row.teacher_name });
  });
  
  const teacherStats = {};
  data.forEach(row => {
    const teacher = row.teacher_name;
    if (!teacher) return;
    if (!teacherStats[teacher]) teacherStats[teacher] = { scores: [], count: 0 };
    if (row.overall_avg) {
      teacherStats[teacher].scores.push(row.overall_avg);
      teacherStats[teacher].count++;
    }
  });
  
  const teacherSummary = Object.entries(teacherStats).map(([name, stats]) => {
    const avg = stats.scores.length > 0 ? (stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length).toFixed(2) : 'N/A';
    return `${name}: ${avg}/3 (${stats.count} responses)`;
  }).join('\n');

  const prompt = `Analyze student feedback for ES World language school.

DATA:
- Total: ${data.length} responses
- Overall: ${overallAvg.toFixed(2)}/3

SECTIONS:
${sectionAverages.map(s => `- ${s.section}: ${s.average.toFixed(2)}/3`).join('\n')}

TEACHERS:
${teacherSummary}

COMMENTS (sample):
${allComments.slice(0, 30).map(c => `"${c.text}" (${c.section}, ${c.teacher})`).join('\n')}

Return this EXACT JSON:
{
  "overview": "One sentence: X/3 overall from Y responses. [Best section] scores highest (X), [worst section] needs attention (X).",
  "positive": [{"theme": "Theme name", "count": N, "evidence": ["quote1", "quote2"]}],
  "negative": [{"theme": "Theme name", "count": N, "evidence": ["quote1", "quote2"]}],
  "teacherHighlights": {"top": "Name (X/3)", "needsSupport": "Name (X/3) or null"},
  "recommendation": "One specific action"
}

RULES: Use ACTUAL quotes only. Be specific with numbers. Be constructive.`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error('API error');
    const result = await response.json();
    const text = result.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating summary:', error);
  }
  return null;
};

// Generate Teacher Summary
const generateTeacherSummary = async (teacherName, teacherData) => {
  if (!ANTHROPIC_API_KEY || teacherData.length === 0) return null;
  
  const avg = teacherData.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / teacherData.length;
  const comments = [];
  teacherData.forEach(row => {
    if (row.teach_comment) comments.push(row.teach_comment);
    if (row.support_comment) comments.push(row.support_comment);
    if (row.final_comment) comments.push(row.final_comment);
  });
  
  const prompt = `Analyze feedback for teacher "${teacherName}".

Score: ${avg.toFixed(2)}/3 (${teacherData.length} responses)

Comments:
${comments.slice(0, 15).map(c => `"${c}"`).join('\n')}

Write 2 sentences:
1. Assessment (2.5+ good, 2.0-2.4 satisfactory, <2.0 needs support)
2. Key strength OR development area with evidence

Be specific and constructive.`;

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
    console.error('Error:', error);
  }
  return null;
};

const getScoreColor = (score) => score >= 2.5 ? '#22C55E' : score >= 1.5 ? '#EAB308' : '#EF4444';
const getScoreBg = (score) => score >= 2.5 ? '#22C55E' : score >= 1.5 ? '#EAB308' : '#EF4444';

function FeedbackDashboardV2() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterCampus, setFilterCampus] = useState('all');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [teacherSummaries, setTeacherSummaries] = useState({});
  const [loadingTeacher, setLoadingTeacher] = useState(null);
  const [translatedComments, setTranslatedComments] = useState([]);
  const [translating, setTranslating] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const sheetData = await fetchSheetData();
      setData(sheetData);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const filteredData = data.filter(row => {
    if (filterCampus !== 'all' && row.campus !== filterCampus) return false;
    if (filterTeacher !== 'all' && row.teacher_name !== filterTeacher) return false;
    return true;
  });

  const teachers = [...new Set(data.map(d => d.teacher_name).filter(Boolean))];
  const calcAvg = (key) => filteredData.length === 0 ? 0 : filteredData.reduce((sum, row) => sum + (parseFloat(row[key]) || 0), 0) / filteredData.length;

  const sectionAverages = Object.keys(SECTIONS).map(key => ({
    section: SECTIONS[key].label,
    average: calcAvg(`${key}_avg`),
    color: SECTIONS[key].color
  }));

  const overallAvg = calcAvg('overall_avg');

  const heatmapData = Object.entries(SECTIONS).map(([sectionKey, section]) => ({
    section: section.label,
    sectionKey,
    questions: section.questions.map(q => {
      const key = `${sectionKey}_${q}`;
      const avg = filteredData.length > 0 ? filteredData.reduce((sum, row) => sum + (row[key] || 0), 0) / filteredData.length : 0;
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

  const rawComments = filteredData.flatMap(row => {
    const c = [];
    if (row.env_comment) c.push({ section: 'Environment', comment: row.env_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.exp_comment) c.push({ section: 'Experience', comment: row.exp_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.teach_comment) c.push({ section: 'Teaching', comment: row.teach_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.support_comment) c.push({ section: 'Support', comment: row.support_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.mgmt_comment) c.push({ section: 'Management', comment: row.mgmt_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.final_comment) c.push({ section: 'General', comment: row.final_comment, date: row.timestamp, teacher: row.teacher_name });
    return c;
  });

  const comments = translatedComments.length > 0 ? translatedComments : rawComments;

  const teacherData = {};
  data.forEach(row => {
    const teacher = row.teacher_name;
    if (!teacher) return;
    if (!teacherData[teacher]) teacherData[teacher] = [];
    teacherData[teacher].push(row);
  });

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    const summary = await generateAISummary(filteredData, sectionAverages, overallAvg);
    setAiSummary(summary);
    setSummaryLoading(false);
  };

  const handleTranslateComments = async () => {
    setTranslating(true);
    const translated = await translateComments(rawComments);
    setTranslatedComments(translated);
    setTranslating(false);
  };

  const handleTeacherSummary = async (teacherName) => {
    if (teacherSummaries[teacherName]) return;
    setLoadingTeacher(teacherName);
    const summary = await generateTeacherSummary(teacherName, teacherData[teacherName]);
    setTeacherSummaries(prev => ({ ...prev, [teacherName]: summary }));
    setLoadingTeacher(null);
  };

  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    maxWidth: { maxWidth: '1200px', margin: '0 auto' },
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    header: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
    title: { fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 },
    subtitle: { color: '#6b7280', fontSize: '14px', margin: '4px 0 0' },
    filterRow: { display: 'flex', gap: '12px' },
    select: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', backgroundColor: 'white' },
    tabs: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
    tab: (active) => ({ padding: '8px 16px', borderRadius: '8px', fontWeight: '500', fontSize: '14px', border: 'none', cursor: 'pointer', backgroundColor: active ? '#f97316' : 'white', color: active ? 'white' : '#4b5563' }),
    overallScore: { textAlign: 'center' },
    scoreCircle: (score) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '96px', height: '96px', borderRadius: '50%', backgroundColor: getScoreBg(score) }),
    scoreText: { fontSize: '30px', fontWeight: 'bold', color: 'white' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginTop: '16px' },
    statCard: { backgroundColor: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    heatmapSection: { marginBottom: '16px' },
    heatmapGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
    heatmapCell: (score) => ({ padding: '12px', borderRadius: '8px', backgroundColor: getScoreBg(score), color: 'white', textAlign: 'center' }),
    legend: { display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '24px', fontSize: '12px', color: '#6b7280' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '4px' },
    legendDot: (color) => ({ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: color }),
    comment: { borderLeft: '4px solid #fb923c', paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px', marginBottom: '12px' },
    commentText: { fontSize: '14px', color: '#1f2937', margin: 0 },
    commentMeta: { fontSize: '12px', color: '#9ca3af', marginTop: '4px' },
    loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: '#6b7280' },
    refreshBtn: { padding: '8px 16px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
    generateBtn: { padding: '8px 16px', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
    summaryCard: { backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '1px solid #e2e8f0' },
    evidenceList: { margin: '8px 0 0 16px', padding: 0, listStyle: 'none' },
    evidenceItem: { fontSize: '13px', color: '#64748b', fontStyle: 'italic', marginBottom: '4px' },
    teacherCard: { backgroundColor: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    teacherScore: (score) => ({ padding: '8px 16px', borderRadius: '20px', backgroundColor: getScoreBg(score), color: 'white', fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap' })
  };

  if (loading) return <div style={styles.container}><div style={styles.loading}>Loading...</div></div>;

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
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

        <div style={styles.tabs}>
          {['overview', 'teachers', 'heatmap', 'trends', 'comments'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={styles.tab(activeTab === tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div>
            <div style={{ ...styles.card, ...styles.overallScore }}>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>Overall Score</p>
              <div style={styles.scoreCircle(overallAvg)}><span style={styles.scoreText}>{overallAvg.toFixed(1)}</span></div>
              <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>out of 3.0</p>
            </div>

            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontWeight: '600', color: '#1f2937', margin: 0 }}>📊 AI Summary</h2>
                {!aiSummary && !summaryLoading && <button onClick={handleGenerateSummary} style={styles.generateBtn}>Generate Summary</button>}
              </div>
              
              {summaryLoading ? <p style={{ color: '#64748b' }}>Analyzing feedback...</p> : aiSummary ? (
                <div>
                  <div style={{ ...styles.summaryCard, borderLeft: '4px solid #f97316' }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '500', color: '#1e293b' }}>{aiSummary.overview}</p>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ ...styles.summaryCard, borderLeft: '4px solid #22C55E' }}>
                      <h4 style={{ margin: '0 0 12px', color: '#166534', fontSize: '14px' }}>✓ What's Working</h4>
                      {aiSummary.positive?.length > 0 ? aiSummary.positive.map((item, i) => (
                        <div key={i} style={{ marginBottom: '12px' }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                            {item.theme} <span style={{ color: '#22C55E', fontSize: '12px' }}>({item.count}x)</span>
                          </p>
                          <ul style={styles.evidenceList}>
                            {item.evidence?.slice(0, 2).map((quote, j) => <li key={j} style={styles.evidenceItem}>"{quote}"</li>)}
                          </ul>
                        </div>
                      )) : <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No positive themes</p>}
                    </div>
                    
                    <div style={{ ...styles.summaryCard, borderLeft: '4px solid #EAB308' }}>
                      <h4 style={{ margin: '0 0 12px', color: '#92400e', fontSize: '14px' }}>△ Needs Attention</h4>
                      {aiSummary.negative?.length > 0 ? aiSummary.negative.map((item, i) => (
                        <div key={i} style={{ marginBottom: '12px' }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                            {item.theme} <span style={{ color: '#EAB308', fontSize: '12px' }}>({item.count}x)</span>
                          </p>
                          <ul style={styles.evidenceList}>
                            {item.evidence?.slice(0, 2).map((quote, j) => <li key={j} style={styles.evidenceItem}>"{quote}"</li>)}
                          </ul>
                        </div>
                      )) : <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No concerns</p>}
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                    {aiSummary.teacherHighlights && (
                      <div style={styles.summaryCard}>
                        <h4 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '14px' }}>👤 Teacher Highlights</h4>
                        {aiSummary.teacherHighlights.top && <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#166534' }}>⭐ Top: {aiSummary.teacherHighlights.top}</p>}
                        {aiSummary.teacherHighlights.needsSupport && <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>📋 May need support: {aiSummary.teacherHighlights.needsSupport}</p>}
                      </div>
                    )}
                    {aiSummary.recommendation && (
                      <div style={{ ...styles.summaryCard, borderLeft: '4px solid #3B82F6' }}>
                        <h4 style={{ margin: '0 0 8px', color: '#1e40af', fontSize: '14px' }}>💡 Recommendation</h4>
                        <p style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>{aiSummary.recommendation}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : <p style={{ color: '#64748b', fontSize: '14px' }}>Click "Generate Summary" for AI analysis with evidence.</p>}
            </div>

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

            <div style={styles.statsGrid}>
              {sectionAverages.map(s => (
                <div key={s.section} style={styles.statCard}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{s.section}</p>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: getScoreColor(s.average), margin: 0 }}>{s.average.toFixed(1)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'teachers' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Teacher Performance</h2>
            {Object.entries(teacherData)
              .map(([name, rows]) => ({ name, avg: rows.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / rows.length, count: rows.length }))
              .sort((a, b) => b.avg - a.avg)
              .map(teacher => (
                <div key={teacher.name} style={styles.teacherCard}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{teacher.name}</h3>
                      <span style={styles.teacherScore(teacher.avg)}>{teacher.avg.toFixed(2)}/3</span>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>({teacher.count} responses)</span>
                    </div>
                    {teacherSummaries[teacher.name] ? (
                      <p style={{ margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: '1.5' }}>{teacherSummaries[teacher.name]}</p>
                    ) : loadingTeacher === teacher.name ? (
                      <p style={{ margin: 0, fontSize: '14px', color: '#9ca3af' }}>Generating summary...</p>
                    ) : (
                      <button onClick={() => handleTeacherSummary(teacher.name)} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}>
                        Generate AI Summary
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {activeTab === 'heatmap' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Question Heatmap</h2>
            {heatmapData.map(section => (
              <div key={section.sectionKey} style={styles.heatmapSection}>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>{section.section}</p>
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

        {activeTab === 'trends' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Trends Over Time</h2>
            {trendData.length === 0 ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>Not enough data</p> : (
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

        {activeTab === 'comments' && (
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontWeight: '600', color: '#1f2937', margin: 0 }}>Student Comments ({comments.length})</h2>
              {!translating && translatedComments.length === 0 && <button onClick={handleTranslateComments} style={styles.generateBtn}>🌐 Translate All</button>}
              {translating && <span style={{ color: '#64748b', fontSize: '14px' }}>Translating...</span>}
              {translatedComments.length > 0 && <span style={{ color: '#22C55E', fontSize: '14px' }}>✓ Translated</span>}
            </div>
            
            {comments.length === 0 ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>No comments</p> : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {comments.map((c, i) => (
                  <div key={i} style={styles.comment}>
                    <p style={styles.commentText}>{c.comment}</p>
                    {c.originalComment && <p style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0 0' }}>Original: {c.originalComment}</p>}
                    <p style={styles.commentMeta}>{c.section} • {c.teacher} • {new Date(c.date).toLocaleDateString()}</p>
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
