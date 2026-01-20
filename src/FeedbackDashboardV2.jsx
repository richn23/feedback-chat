import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const SHEET_ID = import.meta.env.VITE_FEEDBACK_V2_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const SECTIONS = {
  env: { label: 'Learning Environment', icon: '🏫', questions: ['classroom', 'facilities', 'location', 'schedule'], color: '#3B82F6' },
  exp: { label: 'Learning Experience', icon: '📚', questions: ['activities', 'homework', 'materials', 'progress'], color: '#10B981' },
  teach: { label: 'Teaching Quality', icon: '👨‍🏫', questions: ['explanations', 'preparation', 'methods', 'speaking'], color: '#8B5CF6' },
  support: { label: 'Student Support', icon: '🤝', questions: ['help', 'feedback', 'encouragement', 'atmosphere'], color: '#F59E0B' },
  mgmt: { label: 'Class Management', icon: '📋', questions: ['timing', 'fairness', 'organization', 'rules'], color: '#EF4444' }
};

const QUESTION_LABELS = {
  env_classroom: 'Classroom comfort', env_facilities: 'Facilities', env_location: 'Location', env_schedule: 'Schedule',
  exp_activities: 'Activities', exp_homework: 'Homework', exp_materials: 'Materials', exp_progress: 'Progress',
  teach_explanations: 'Explanations', teach_preparation: 'Preparation', teach_methods: 'Methods', teach_speaking: 'Speaking practice',
  support_help: 'Help availability', support_feedback: 'Feedback quality', support_encouragement: 'Encouragement', support_atmosphere: 'Atmosphere',
  mgmt_timing: 'Time management', mgmt_fairness: 'Fairness', mgmt_organization: 'Organization', mgmt_rules: 'Rules'
};

const fetchSheetData = async () => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Student%20Feedback%20V2!A:AL?key=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.values || data.values.length < 2) return [];
  const headers = data.values[0];
  return data.values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const val = row[i] || '';
      const numericFields = ['env_classroom', 'env_facilities', 'env_location', 'env_schedule', 'exp_activities', 'exp_homework', 'exp_materials', 'exp_progress', 'teach_explanations', 'teach_preparation', 'teach_methods', 'teach_speaking', 'support_help', 'support_feedback', 'support_encouragement', 'support_atmosphere', 'mgmt_timing', 'mgmt_fairness', 'mgmt_organization', 'mgmt_rules', 'env_avg', 'exp_avg', 'teach_avg', 'support_avg', 'mgmt_avg', 'overall_avg'];
      obj[h] = numericFields.includes(h) && val !== '' ? parseFloat(val) : val;
    });
    return obj;
  });
};

const translateComments = async (comments) => {
  if (!ANTHROPIC_API_KEY || comments.length === 0) return comments;
  const nonEnglish = comments.filter(c => c.comment && /[^\u0000-\u007F]/.test(c.comment));
  if (nonEnglish.length === 0) return comments;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2048, messages: [{ role: 'user', content: `Translate to English. Return JSON array:\n${nonEnglish.map((c,i) => `${i+1}. ${c.comment}`).join('\n')}` }] })
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    const jsonMatch = result.content[0].text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const translations = JSON.parse(jsonMatch[0]);
      const map = {};
      nonEnglish.forEach((c, i) => { if (translations[i]) map[c.comment] = translations[i]; });
      return comments.map(c => ({ ...c, originalComment: map[c.comment] ? c.comment : null, comment: map[c.comment] || c.comment }));
    }
  } catch (e) { console.error(e); }
  return comments;
};

const generateAISummary = async (data, sectionAverages, overallAvg) => {
  if (!ANTHROPIC_API_KEY || data.length === 0) return null;
  const allComments = [];
  data.forEach(row => {
    ['env', 'exp', 'teach', 'support', 'mgmt', 'final'].forEach(s => {
      if (row[`${s}_comment`]) allComments.push({ text: row[`${s}_comment`], section: SECTIONS[s]?.label || 'General', teacher: row.teacher_name });
    });
  });
  const teacherStats = {};
  data.forEach(row => {
    if (!row.teacher_name) return;
    if (!teacherStats[row.teacher_name]) teacherStats[row.teacher_name] = { scores: [], count: 0 };
    if (row.overall_avg) { teacherStats[row.teacher_name].scores.push(row.overall_avg); teacherStats[row.teacher_name].count++; }
  });
  const teacherSummary = Object.entries(teacherStats).map(([n, s]) => `${n}: ${s.scores.length ? (s.scores.reduce((a,b)=>a+b,0)/s.scores.length).toFixed(2) : 'N/A'}/3 (${s.count})`).join('\n');

  const prompt = `Analyze feedback for ES World. Data: ${data.length} responses, ${overallAvg.toFixed(2)}/3 overall.
Sections: ${sectionAverages.map(s => `${s.section}: ${s.average.toFixed(2)}`).join(', ')}
Teachers: ${teacherSummary}
Comments: ${allComments.slice(0,30).map(c => `"${c.text}" (${c.section})`).join('\n')}

Return JSON: {"overview":"One sentence summary","positive":[{"theme":"X","count":N,"evidence":["quote"]}],"negative":[{"theme":"X","count":N,"evidence":["quote"]}],"teacherHighlights":{"top":"Name (X/3)","needsSupport":"Name or null"},"recommendation":"One action"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    const jsonMatch = result.content[0].text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) { console.error(e); }
  return null;
};

const generateSectionSummary = async (sectionKey, sectionData, comments) => {
  if (!ANTHROPIC_API_KEY) return null;
  const section = SECTIONS[sectionKey];
  const avg = sectionData.length ? sectionData.reduce((s, r) => s + (r[`${sectionKey}_avg`] || 0), 0) / sectionData.length : 0;
  const questionScores = section.questions.map(q => {
    const key = `${sectionKey}_${q}`;
    const qAvg = sectionData.length ? sectionData.reduce((s, r) => s + (r[key] || 0), 0) / sectionData.length : 0;
    return `${QUESTION_LABELS[key]}: ${qAvg.toFixed(2)}/3`;
  }).join(', ');

  const prompt = `Analyze ${section.label} feedback. Score: ${avg.toFixed(2)}/3. Questions: ${questionScores}
Comments: ${comments.slice(0,15).map(c => `"${c.comment}"`).join('\n')}

Write 2 sentences: 1) Assessment (2.5+ good, 2-2.4 satisfactory, <2 needs work), 2) Key insight with evidence.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    return result.content[0].text;
  } catch (e) { console.error(e); }
  return null;
};

const generateTeacherSummary = async (name, data) => {
  if (!ANTHROPIC_API_KEY || !data.length) return null;
  const avg = data.reduce((s, r) => s + (r.overall_avg || 0), 0) / data.length;
  const comments = data.flatMap(r => [r.teach_comment, r.support_comment, r.final_comment].filter(Boolean)).slice(0, 15);
  const prompt = `Teacher "${name}" feedback. Score: ${avg.toFixed(2)}/3 (${data.length} responses). Comments: ${comments.map(c => `"${c}"`).join('\n')}
Write 2 sentences: assessment + key insight.`;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) throw new Error();
    return (await response.json()).content[0].text;
  } catch (e) { console.error(e); }
  return null;
};

const getScoreColor = (s) => s >= 2.5 ? '#22C55E' : s >= 1.5 ? '#EAB308' : '#EF4444';
const getScoreBg = (s) => s >= 2.5 ? '#22C55E' : s >= 1.5 ? '#EAB308' : '#EF4444';

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
  const [sectionSummaries, setSectionSummaries] = useState({});
  const [loadingSection, setLoadingSection] = useState(null);
  const [translatedComments, setTranslatedComments] = useState([]);
  const [translating, setTranslating] = useState(false);
  const [selectedSection, setSelectedSection] = useState('env');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try { setData(await fetchSheetData()); } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filteredData = data.filter(row => {
    if (filterCampus !== 'all' && row.campus !== filterCampus) return false;
    if (filterTeacher !== 'all' && row.teacher_name !== filterTeacher) return false;
    return true;
  });

  const teachers = [...new Set(data.map(d => d.teacher_name).filter(Boolean))];
  const calcAvg = (key) => filteredData.length ? filteredData.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0) / filteredData.length : 0;

  const sectionAverages = Object.keys(SECTIONS).map(key => ({
    section: SECTIONS[key].label, sectionKey: key, average: calcAvg(`${key}_avg`), color: SECTIONS[key].color, icon: SECTIONS[key].icon
  }));

  const overallAvg = calcAvg('overall_avg');

  const heatmapData = Object.entries(SECTIONS).map(([sectionKey, section]) => ({
    section: section.label, sectionKey, icon: section.icon,
    questions: section.questions.map(q => {
      const key = `${sectionKey}_${q}`;
      return { key, label: QUESTION_LABELS[key], avg: filteredData.length ? filteredData.reduce((s, r) => s + (r[key] || 0), 0) / filteredData.length : 0 };
    })
  }));

  const trendData = filteredData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-20).map(row => ({
    date: new Date(row.timestamp).toLocaleDateString(),
    Environment: parseFloat(row.env_avg) || 0, Experience: parseFloat(row.exp_avg) || 0,
    Teaching: parseFloat(row.teach_avg) || 0, Support: parseFloat(row.support_avg) || 0, Management: parseFloat(row.mgmt_avg) || 0
  }));

  const rawComments = filteredData.flatMap(row => {
    const c = [];
    if (row.env_comment) c.push({ section: 'env', sectionLabel: 'Environment', comment: row.env_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.exp_comment) c.push({ section: 'exp', sectionLabel: 'Experience', comment: row.exp_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.teach_comment) c.push({ section: 'teach', sectionLabel: 'Teaching', comment: row.teach_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.support_comment) c.push({ section: 'support', sectionLabel: 'Support', comment: row.support_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.mgmt_comment) c.push({ section: 'mgmt', sectionLabel: 'Management', comment: row.mgmt_comment, date: row.timestamp, teacher: row.teacher_name });
    if (row.final_comment) c.push({ section: 'final', sectionLabel: 'General', comment: row.final_comment, date: row.timestamp, teacher: row.teacher_name });
    return c;
  });

  const comments = translatedComments.length > 0 ? translatedComments : rawComments;

  const teacherData = {};
  data.forEach(row => { if (row.teacher_name) { if (!teacherData[row.teacher_name]) teacherData[row.teacher_name] = []; teacherData[row.teacher_name].push(row); } });

  const handleGenerateSummary = async () => { setSummaryLoading(true); setAiSummary(await generateAISummary(filteredData, sectionAverages, overallAvg)); setSummaryLoading(false); };
  const handleTranslate = async () => { setTranslating(true); setTranslatedComments(await translateComments(rawComments)); setTranslating(false); };
  const handleTeacherSummary = async (name) => { 
    if (teacherSummaries[name]) return; 
    setLoadingTeacher(name); 
    const summary = await generateTeacherSummary(name, teacherData[name]);
    setTeacherSummaries(p => ({ ...p, [name]: summary })); 
    setLoadingTeacher(null); 
  };
  const handleSectionSummary = async (sectionKey) => {
    if (sectionSummaries[sectionKey]) return;
    setLoadingSection(sectionKey);
    const sectionComments = comments.filter(c => c.section === sectionKey);
    const summary = await generateSectionSummary(sectionKey, filteredData, sectionComments);
    setSectionSummaries(p => ({ ...p, [sectionKey]: summary }));
    setLoadingSection(null);
  };

  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    maxWidth: { maxWidth: '1200px', margin: '0 auto' },
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    tabs: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
    tab: (active) => ({ padding: '8px 16px', borderRadius: '8px', fontWeight: '500', fontSize: '14px', border: 'none', cursor: 'pointer', backgroundColor: active ? '#f97316' : 'white', color: active ? 'white' : '#4b5563' }),
    scoreCircle: (score) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '96px', height: '96px', borderRadius: '50%', backgroundColor: getScoreBg(score) }),
    heatmapCell: (score) => ({ padding: '12px', borderRadius: '8px', backgroundColor: getScoreBg(score), color: 'white', textAlign: 'center' }),
    sectionTab: (active) => ({ padding: '12px 20px', borderRadius: '8px', border: active ? '2px solid #f97316' : '1px solid #e5e7eb', backgroundColor: active ? '#fff7ed' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }),
    comment: { borderLeft: '4px solid #fb923c', paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px', marginBottom: '12px' },
    btn: { padding: '8px 16px', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
    smallBtn: { background: 'none', border: '1px solid #e5e7eb', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }
  };

  if (loading) return <div style={styles.container}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>Loading...</div></div>;

  const currentSectionData = heatmapData.find(s => s.sectionKey === selectedSection);
  const currentSectionComments = comments.filter(c => c.section === selectedSection);
  const currentSectionAvg = sectionAverages.find(s => s.sectionKey === selectedSection);

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        <div style={styles.card}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Feedback Dashboard V2</h1>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }}>{filteredData.length} responses</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select value={filterCampus} onChange={e => setFilterCampus(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}>
                <option value="all">All Campuses</option><option value="Dubai">Dubai</option><option value="London">London</option>
              </select>
              <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}>
                <option value="all">All Teachers</option>
                {teachers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={loadData} style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>↻ Refresh</button>
            </div>
          </div>
        </div>

        <div style={styles.tabs}>
          {['overview', 'sections', 'teachers', 'heatmap', 'trends', 'comments'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={styles.tab(activeTab === tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div>
            <div style={{ ...styles.card, textAlign: 'center' }}>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>Overall Score</p>
              <div style={styles.scoreCircle(overallAvg)}><span style={{ fontSize: '30px', fontWeight: 'bold', color: 'white' }}>{overallAvg.toFixed(1)}</span></div>
              <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>out of 3.0</p>
            </div>

            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontWeight: '600', color: '#1f2937', margin: 0 }}>📊 AI Summary</h2>
                {!aiSummary && !summaryLoading && <button onClick={handleGenerateSummary} style={styles.btn}>Generate Summary</button>}
              </div>
              {summaryLoading ? <p style={{ color: '#64748b' }}>Analyzing...</p> : aiSummary ? (
                <div>
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', marginBottom: '16px', borderLeft: '4px solid #f97316' }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '500', color: '#1e293b' }}>{aiSummary.overview}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #22C55E' }}>
                      <h4 style={{ margin: '0 0 12px', color: '#166534', fontSize: '14px' }}>✓ What's Working</h4>
                      {aiSummary.positive?.map((item, i) => (
                        <div key={i} style={{ marginBottom: '12px' }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>{item.theme} <span style={{ color: '#22C55E', fontSize: '12px' }}>({item.count}x)</span></p>
                          <ul style={{ margin: '8px 0 0 16px', padding: 0, listStyle: 'none' }}>
                            {item.evidence?.slice(0, 2).map((q, j) => <li key={j} style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>"{q}"</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #EAB308' }}>
                      <h4 style={{ margin: '0 0 12px', color: '#92400e', fontSize: '14px' }}>△ Needs Attention</h4>
                      {aiSummary.negative?.map((item, i) => (
                        <div key={i} style={{ marginBottom: '12px' }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>{item.theme} <span style={{ color: '#EAB308', fontSize: '12px' }}>({item.count}x)</span></p>
                          <ul style={{ margin: '8px 0 0 16px', padding: 0, listStyle: 'none' }}>
                            {item.evidence?.slice(0, 2).map((q, j) => <li key={j} style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>"{q}"</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                  {aiSummary.recommendation && (
                    <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '20px', marginTop: '16px', borderLeft: '4px solid #3B82F6' }}>
                      <h4 style={{ margin: '0 0 8px', color: '#1e40af', fontSize: '14px' }}>💡 Recommendation</h4>
                      <p style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>{aiSummary.recommendation}</p>
                    </div>
                  )}
                </div>
              ) : <p style={{ color: '#64748b', fontSize: '14px' }}>Click "Generate Summary" for AI analysis.</p>}
            </div>

            <div style={styles.card}>
              <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Section Averages</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sectionAverages} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 3]} /><YAxis type="category" dataKey="section" width={120} />
                  <Tooltip formatter={(val) => val.toFixed(2)} /><Bar dataKey="average" fill="#F97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'sections' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {Object.entries(SECTIONS).map(([key, sec]) => (
                <button key={key} onClick={() => setSelectedSection(key)} style={styles.sectionTab(selectedSection === key)}>
                  <span>{sec.icon}</span>
                  <span style={{ fontWeight: selectedSection === key ? '600' : '400' }}>{sec.label}</span>
                </button>
              ))}
            </div>

            {currentSectionData && (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '32px' }}>{SECTIONS[selectedSection].icon}</span>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>{SECTIONS[selectedSection].label}</h2>
                      <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>{currentSectionComments.length} comments</p>
                    </div>
                  </div>
                  <div style={{ padding: '12px 24px', borderRadius: '12px', backgroundColor: getScoreBg(currentSectionAvg?.average || 0) }}>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>{(currentSectionAvg?.average || 0).toFixed(1)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginLeft: '4px' }}>/3</span>
                  </div>
                </div>

                {/* AI Summary for Section */}
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  {sectionSummaries[selectedSection] ? (
                    <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', lineHeight: '1.6' }}>{sectionSummaries[selectedSection]}</p>
                  ) : loadingSection === selectedSection ? (
                    <p style={{ margin: 0, color: '#64748b' }}>Generating summary...</p>
                  ) : (
                    <button onClick={() => handleSectionSummary(selectedSection)} style={styles.smallBtn}>Generate AI Summary</button>
                  )}
                </div>

                {/* Question Scores */}
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Question Breakdown</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {currentSectionData.questions.map(q => (
                    <div key={q.key} style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', borderLeft: `4px solid ${getScoreColor(q.avg)}` }}>
                      <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280' }}>{q.label}</p>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: getScoreColor(q.avg) }}>{q.avg.toFixed(1)}</p>
                    </div>
                  ))}
                </div>

                {/* Comments for this Section */}
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Comments ({currentSectionComments.length})</h3>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {currentSectionComments.length === 0 ? (
                    <p style={{ color: '#9ca3af' }}>No comments for this section</p>
                  ) : currentSectionComments.map((c, i) => (
                    <div key={i} style={styles.comment}>
                      <p style={{ fontSize: '14px', color: '#1f2937', margin: 0 }}>{c.comment}</p>
                      {c.originalComment && <p style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0 0' }}>Original: {c.originalComment}</p>}
                      <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{c.teacher} • {new Date(c.date).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'teachers' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Teacher Performance</h2>
            {Object.entries(teacherData).map(([name, rows]) => ({ name, avg: rows.reduce((s, r) => s + (r.overall_avg || 0), 0) / rows.length, count: rows.length }))
              .sort((a, b) => b.avg - a.avg).map(t => (
                <div key={t.name} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{t.name}</h3>
                    <span style={{ padding: '8px 16px', borderRadius: '20px', backgroundColor: getScoreBg(t.avg), color: 'white', fontWeight: '600', fontSize: '14px' }}>{t.avg.toFixed(2)}/3</span>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>({t.count} responses)</span>
                  </div>
                  {teacherSummaries[t.name] ? (
                    <p style={{ margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: '1.5' }}>{teacherSummaries[t.name]}</p>
                  ) : loadingTeacher === t.name ? (
                    <p style={{ margin: 0, fontSize: '14px', color: '#9ca3af' }}>Generating...</p>
                  ) : (
                    <button onClick={() => handleTeacherSummary(t.name)} style={styles.smallBtn}>Generate AI Summary</button>
                  )}
                </div>
              ))}
          </div>
        )}

        {activeTab === 'heatmap' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Question Heatmap</h2>
            {heatmapData.map(sec => (
              <div key={sec.sectionKey} style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>{sec.icon} {sec.section}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                  {sec.questions.map(q => (
                    <div key={q.key} style={styles.heatmapCell(q.avg)}>
                      <p style={{ fontSize: '12px', opacity: 0.9, margin: '0 0 4px' }}>{q.label}</p>
                      <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{q.avg.toFixed(1)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '24px', fontSize: '12px', color: '#6b7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#22C55E' }}/> 2.5-3.0 Good</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#EAB308' }}/> 1.5-2.4 Needs attention</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#EF4444' }}/> 0-1.4 Problem</span>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Trends Over Time</h2>
            {trendData.length === 0 ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>Not enough data</p> : (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis domain={[0, 3]} /><Tooltip /><Legend />
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
              {!translating && translatedComments.length === 0 && <button onClick={handleTranslate} style={styles.btn}>🌐 Translate All</button>}
              {translating && <span style={{ color: '#64748b', fontSize: '14px' }}>Translating...</span>}
              {translatedComments.length > 0 && <span style={{ color: '#22C55E', fontSize: '14px' }}>✓ Translated</span>}
            </div>
            {comments.length === 0 ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>No comments</p> : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {comments.map((c, i) => (
                  <div key={i} style={styles.comment}>
                    <p style={{ fontSize: '14px', color: '#1f2937', margin: 0 }}>{c.comment}</p>
                    {c.originalComment && <p style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0 0' }}>Original: {c.originalComment}</p>}
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{c.sectionLabel} • {c.teacher} • {new Date(c.date).toLocaleDateString()}</p>
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
