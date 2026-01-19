import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const SHEET_ID = import.meta.env.VITE_FEEDBACK_V2_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;

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
      // Convert numeric fields
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

function FeedbackDashboardV2() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterCampus, setFilterCampus] = useState('all');
  const [filterTeacher, setFilterTeacher] = useState('all');

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
      marginBottom: '16px'
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
      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      gap: '12px',
      marginTop: '16px'
    },
    statCard: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '16px',
      textAlign: 'center',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
          {['overview', 'heatmap', 'trends', 'comments'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={styles.tab(activeTab === tab)}
            >
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

            {/* Quick Stats */}
            <div style={styles.statsGrid}>
              {sectionAverages.map(s => (
                <div key={s.section} style={styles.statCard}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{s.section}</p>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: getScoreColor(s.average), margin: 0 }}>
                    {s.average.toFixed(1)}
                  </p>
                </div>
              ))}
            </div>
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
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
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
