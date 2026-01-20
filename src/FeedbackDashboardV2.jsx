import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const SHEET_ID = import.meta.env.VITE_FEEDBACK_V2_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// Sections the teacher CAN control vs CANNOT control
const TEACHER_CONTROLLED = ['teach', 'support', 'mgmt', 'exp']; // Teaching, Support, Management, Experience
const NOT_TEACHER_CONTROLLED = ['env']; // Environment (facilities, location, etc.)

const SECTIONS = {
  env: { label: 'Environment', questions: ['classroom', 'facilities', 'location', 'schedule'], color: '#3B82F6', teacherControlled: false },
  exp: { label: 'Experience', questions: ['activities', 'homework', 'materials', 'progress'], color: '#10B981', teacherControlled: true },
  teach: { label: 'Teaching', questions: ['explanations', 'preparation', 'methods', 'speaking'], color: '#8B5CF6', teacherControlled: true },
  support: { label: 'Support', questions: ['help', 'feedback', 'encouragement', 'atmosphere'], color: '#F59E0B', teacherControlled: true },
  mgmt: { label: 'Management', questions: ['timing', 'fairness', 'organization', 'rules'], color: '#EF4444', teacherControlled: true }
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

// Generate AI summary for a teacher
const generateTeacherSummary = async (teacherName, teacherData, allTeachersData, allData) => {
  // Calculate teacher's scores
  const teacherScores = {
    teach: teacherData.reduce((sum, r) => sum + (r.teach_avg || 0), 0) / teacherData.length,
    support: teacherData.reduce((sum, r) => sum + (r.support_avg || 0), 0) / teacherData.length,
    mgmt: teacherData.reduce((sum, r) => sum + (r.mgmt_avg || 0), 0) / teacherData.length,
    exp: teacherData.reduce((sum, r) => sum + (r.exp_avg || 0), 0) / teacherData.length,
    env: teacherData.reduce((sum, r) => sum + (r.env_avg || 0), 0) / teacherData.length,
    overall: teacherData.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / teacherData.length
  };
  
  // Calculate school-wide averages for comparison
  const schoolAvg = {
    teach: allData.reduce((sum, r) => sum + (r.teach_avg || 0), 0) / allData.length,
    support: allData.reduce((sum, r) => sum + (r.support_avg || 0), 0) / allData.length,
    mgmt: allData.reduce((sum, r) => sum + (r.mgmt_avg || 0), 0) / allData.length,
    exp: allData.reduce((sum, r) => sum + (r.exp_avg || 0), 0) / allData.length,
    overall: allData.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / allData.length
  };
  
  // Rank among teachers and calculate quartile
  const teacherRankings = Object.entries(allTeachersData)
    .map(([name, data]) => ({
      name,
      overall: data.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / data.length
    }))
    .sort((a, b) => b.overall - a.overall);
  
  const rank = teacherRankings.findIndex(t => t.name === teacherName) + 1;
  const totalTeachers = teacherRankings.length;
  const percentile = ((totalTeachers - rank + 1) / totalTeachers) * 100;
  
  // Determine quartile description
  let quartileDesc;
  if (percentile >= 75) {
    quartileDesc = 'in the top quartile (top 25%)';
  } else if (percentile >= 50) {
    quartileDesc = 'above average (top 50%)';
  } else if (percentile >= 25) {
    quartileDesc = 'below average';
  } else {
    quartileDesc = 'in the bottom quartile - support recommended';
  }
  
  // Get this month vs last month (if data exists)
  const now = new Date();
  const thisMonth = teacherData.filter(r => {
    const d = new Date(r.timestamp);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = teacherData.filter(r => {
    const d = new Date(r.timestamp);
    const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lastM.getMonth() && d.getFullYear() === lastM.getFullYear();
  });
  
  const thisMonthAvg = thisMonth.length > 0 
    ? thisMonth.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / thisMonth.length 
    : null;
  const lastMonthAvg = lastMonth.length > 0 
    ? lastMonth.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / lastMonth.length 
    : null;
  
  // Get ALL comments, grouped by type
  const teachingComments = teacherData.map(r => r.teach_comment).filter(Boolean);
  const supportComments = teacherData.map(r => r.support_comment).filter(Boolean);
  const mgmtComments = teacherData.map(r => r.mgmt_comment).filter(Boolean);
  const expComments = teacherData.map(r => r.exp_comment).filter(Boolean);
  const finalComments = teacherData.map(r => r.final_comment).filter(Boolean);
  
  const allComments = [...teachingComments, ...supportComments, ...mgmtComments, ...expComments, ...finalComments];
  
  // Find lowest scoring areas (teacher-controlled only)
  const teacherControlledScores = [
    { area: 'Teaching', score: teacherScores.teach, vsSchool: teacherScores.teach - schoolAvg.teach },
    { area: 'Support', score: teacherScores.support, vsSchool: teacherScores.support - schoolAvg.support },
    { area: 'Management', score: teacherScores.mgmt, vsSchool: teacherScores.mgmt - schoolAvg.mgmt },
    { area: 'Experience', score: teacherScores.exp, vsSchool: teacherScores.exp - schoolAvg.exp }
  ].sort((a, b) => a.score - b.score);
  
  const prompt = `You are a school management consultant analyzing teacher performance data.

TEACHER: ${teacherName}
RESPONSES: ${teacherData.length}

SCORES (out of 3.0):
- Teaching: ${teacherScores.teach.toFixed(2)} (school avg: ${schoolAvg.teach.toFixed(2)}) ${teacherScores.teach > schoolAvg.teach ? '↑ above' : '↓ below'} average
- Support: ${teacherScores.support.toFixed(2)} (school avg: ${schoolAvg.support.toFixed(2)}) ${teacherScores.support > schoolAvg.support ? '↑ above' : '↓ below'} average
- Management: ${teacherScores.mgmt.toFixed(2)} (school avg: ${schoolAvg.mgmt.toFixed(2)}) ${teacherScores.mgmt > schoolAvg.mgmt ? '↑ above' : '↓ below'} average
- Experience: ${teacherScores.exp.toFixed(2)} (school avg: ${schoolAvg.exp.toFixed(2)}) ${teacherScores.exp > schoolAvg.exp ? '↑ above' : '↓ below'} average
- Overall: ${teacherScores.overall.toFixed(2)} (school avg: ${schoolAvg.overall.toFixed(2)})

PERFORMANCE LEVEL: ${quartileDesc}

TREND: ${thisMonthAvg && lastMonthAvg 
    ? `This month: ${thisMonthAvg.toFixed(2)} vs Last month: ${lastMonthAvg.toFixed(2)} (${thisMonthAvg > lastMonthAvg ? '↑ improving' : thisMonthAvg < lastMonthAvg ? '↓ declining' : '→ stable'})`
    : 'Not enough data for trend'}

LOWEST AREA: ${teacherControlledScores[0].area} at ${teacherControlledScores[0].score.toFixed(2)}

STUDENT COMMENTS (analyze these carefully for themes):

Teaching comments:
${teachingComments.length > 0 ? teachingComments.map(c => `- "${c}"`).join('\n') : '- None'}

Support comments:
${supportComments.length > 0 ? supportComments.map(c => `- "${c}"`).join('\n') : '- None'}

Management comments:
${mgmtComments.length > 0 ? mgmtComments.map(c => `- "${c}"`).join('\n') : '- None'}

Experience comments:
${expComments.length > 0 ? expComments.map(c => `- "${c}"`).join('\n') : '- None'}

General/final comments:
${finalComments.length > 0 ? finalComments.map(c => `- "${c}"`).join('\n') : '- None'}

IMPORTANT CONTEXT:
- Environment scores (classroom, facilities, location) are NOT in teacher's control - don't mention these
- Focus only on Teaching, Support, Management, and Experience
- Rating scale: 2.5+ = Good, 1.5-2.4 = Needs work, <1.5 = Concern
- DO NOT mention specific rankings like "2nd of 8" - use quartile descriptions instead

TASK: Write a summary with TWO parts:

**PART 1 - SUMMARY (3-4 sentences):**
- State their performance level (use quartile: "top quartile", "above average", "below average", etc.)
- Summarize what students are saying in comments - identify themes, recurring praise or complaints
- Note trend vs last month if available
- Give 1-2 specific ACTION POINTS based on comments and lowest scores

**PART 2 - EVIDENCE:**
After the summary, add a line break and then "Evidence:" followed by 3-5 direct quotes from the comments that support your summary. Pick the most insightful/representative ones.

Example format:
"${teacherName} performs above average among colleagues. Students consistently praise [theme from comments]. However, several students mentioned [concern from comments]. Scores are stable vs last month. ACTION: [specific recommendation based on feedback].

---
Evidence: "[quote 1]", "[quote 2]", "[quote 3]""

Keep the summary direct and actionable. The evidence section should be brief - just the quotes.`;

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
        max_tokens: 700,
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

function FeedbackDashboardV2() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterCampus, setFilterCampus] = useState('all');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [teacherSummaries, setTeacherSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});

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

  // Group data by teacher
  const byTeacher = data.reduce((acc, row) => {
    const name = row.teacher_name;
    if (!name) return acc;
    if (!acc[name]) acc[name] = [];
    acc[name].push(row);
    return acc;
  }, {});

  // Generate summary for a specific teacher
  const handleGenerateSummary = async (teacherName) => {
    setSummaryLoading(prev => ({ ...prev, [teacherName]: true }));
    const summary = await generateTeacherSummary(
      teacherName,
      byTeacher[teacherName],
      byTeacher,
      data
    );
    setTeacherSummaries(prev => ({ ...prev, [teacherName]: summary }));
    setSummaryLoading(prev => ({ ...prev, [teacherName]: false }));
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

  // === CONCERNS CALCULATIONS ===
  const CONCERN_THRESHOLD = 2.0; // Below this is a concern
  const WARNING_THRESHOLD = 2.3; // Below this is a warning
  
  // School-wide averages for comparison
  const schoolAvg = {
    overall: data.length > 0 ? data.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / data.length : 0,
    teach: data.length > 0 ? data.reduce((sum, r) => sum + (r.teach_avg || 0), 0) / data.length : 0,
    support: data.length > 0 ? data.reduce((sum, r) => sum + (r.support_avg || 0), 0) / data.length : 0,
    mgmt: data.length > 0 ? data.reduce((sum, r) => sum + (r.mgmt_avg || 0), 0) / data.length : 0,
    exp: data.length > 0 ? data.reduce((sum, r) => sum + (r.exp_avg || 0), 0) / data.length : 0,
    env: data.length > 0 ? data.reduce((sum, r) => sum + (r.env_avg || 0), 0) / data.length : 0
  };

  // Find underperforming teachers (below school average by > 0.3 OR below concern threshold)
  const teacherPerformance = Object.entries(byTeacher).map(([name, teacherData]) => {
    const scores = {
      overall: teacherData.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / teacherData.length,
      teach: teacherData.reduce((sum, r) => sum + (r.teach_avg || 0), 0) / teacherData.length,
      support: teacherData.reduce((sum, r) => sum + (r.support_avg || 0), 0) / teacherData.length,
      mgmt: teacherData.reduce((sum, r) => sum + (r.mgmt_avg || 0), 0) / teacherData.length,
      exp: teacherData.reduce((sum, r) => sum + (r.exp_avg || 0), 0) / teacherData.length
    };
    
    const concerns = [];
    
    // Check each teacher-controlled area
    ['teach', 'support', 'mgmt', 'exp'].forEach(area => {
      const areaLabel = SECTIONS[area].label;
      if (scores[area] < CONCERN_THRESHOLD) {
        concerns.push({ area: areaLabel, score: scores[area], severity: 'critical', reason: `Below ${CONCERN_THRESHOLD}` });
      } else if (scores[area] < WARNING_THRESHOLD) {
        concerns.push({ area: areaLabel, score: scores[area], severity: 'warning', reason: `Below ${WARNING_THRESHOLD}` });
      } else if (scores[area] < schoolAvg[area] - 0.3) {
        concerns.push({ area: areaLabel, score: scores[area], severity: 'below-avg', reason: `${(schoolAvg[area] - scores[area]).toFixed(2)} below school avg` });
      }
    });
    
    return {
      name,
      count: teacherData.length,
      scores,
      concerns,
      hasCritical: concerns.some(c => c.severity === 'critical'),
      hasWarning: concerns.some(c => c.severity === 'warning' || c.severity === 'below-avg')
    };
  }).filter(t => t.concerns.length > 0).sort((a, b) => {
    // Sort by severity first, then by number of concerns
    if (a.hasCritical && !b.hasCritical) return -1;
    if (!a.hasCritical && b.hasCritical) return 1;
    return b.concerns.length - a.concerns.length;
  });

  // Find low-scoring questions across the school
  const questionConcerns = [];
  Object.entries(SECTIONS).forEach(([sectionKey, section]) => {
    section.questions.forEach(q => {
      const key = `${sectionKey}_${q}`;
      const avg = data.length > 0 
        ? data.reduce((sum, row) => sum + (row[key] || 0), 0) / data.length 
        : 0;
      
      if (avg < CONCERN_THRESHOLD) {
        questionConcerns.push({
          question: QUESTION_LABELS[key],
          section: section.label,
          score: avg,
          severity: 'critical',
          teacherControlled: section.teacherControlled
        });
      } else if (avg < WARNING_THRESHOLD) {
        questionConcerns.push({
          question: QUESTION_LABELS[key],
          section: section.label,
          score: avg,
          severity: 'warning',
          teacherControlled: section.teacherControlled
        });
      }
    });
  });

  // Campus comparison
  const campusPerformance = ['Dubai', 'London'].map(campus => {
    const campusData = data.filter(r => r.campus === campus);
    if (campusData.length === 0) return null;
    
    const avg = campusData.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / campusData.length;
    return { campus, avg, count: campusData.length };
  }).filter(Boolean);

  const campusConcerns = campusPerformance.filter(c => c.avg < WARNING_THRESHOLD);

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
              <button onClick={loadData} style={styles.refreshBtn}>â†» Refresh</button>
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
              {tab === 'concerns' ? '⚠️ Concerns' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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

        {/* Concerns Tab */}
        {activeTab === 'concerns' && (
          <div>
            {/* Summary stats */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div style={{
                ...styles.card,
                flex: 1,
                minWidth: '150px',
                borderLeft: teacherPerformance.filter(t => t.hasCritical).length > 0 ? '4px solid #ef4444' : '4px solid #22c55e'
              }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Teachers with Concerns</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: teacherPerformance.length > 0 ? '#ef4444' : '#22c55e' }}>
                  {teacherPerformance.length}
                </div>
              </div>
              <div style={{
                ...styles.card,
                flex: 1,
                minWidth: '150px',
                borderLeft: questionConcerns.filter(q => q.severity === 'critical').length > 0 ? '4px solid #ef4444' : '4px solid #22c55e'
              }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Low-Scoring Areas</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: questionConcerns.length > 0 ? '#f59e0b' : '#22c55e' }}>
                  {questionConcerns.length}
                </div>
              </div>
            </div>

            {/* No concerns message */}
            {teacherPerformance.length === 0 && questionConcerns.length === 0 && (
              <div style={{
                ...styles.card,
                textAlign: 'center',
                padding: '48px 24px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                <h3 style={{ margin: '0 0 8px', color: '#22c55e' }}>No Major Concerns</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>All teachers and areas are performing at acceptable levels.</p>
              </div>
            )}

            {/* Teachers needing attention */}
            {teacherPerformance.length > 0 && (
              <div style={{ ...styles.card, marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                  👤 Teachers Needing Attention
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
                  Teachers with scores below {WARNING_THRESHOLD} or significantly below school average
                </p>
                
                {teacherPerformance.map(teacher => (
                  <div key={teacher.name} style={{
                    padding: '16px',
                    marginBottom: '12px',
                    borderRadius: '8px',
                    backgroundColor: teacher.hasCritical ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${teacher.hasCritical ? '#fecaca' : '#fde68a'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{teacher.name}</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                          Overall: {teacher.scores.overall.toFixed(2)} • {teacher.count} responses
                        </p>
                      </div>
                      {teacher.hasCritical && (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          CRITICAL
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {teacher.concerns.map((concern, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px'
                        }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: concern.severity === 'critical' ? '#ef4444' : '#f59e0b'
                          }} />
                          <span style={{ fontWeight: '500' }}>{concern.area}:</span>
                          <span style={{ color: getScoreColor(concern.score), fontWeight: '600' }}>
                            {concern.score.toFixed(2)}
                          </span>
                          <span style={{ color: '#6b7280', fontSize: '12px' }}>({concern.reason})</span>
                        </div>
                      ))}
                    </div>
                    
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Suggested action: </span>
                      <span style={{ fontSize: '12px', color: '#1f2937' }}>
                        Schedule 1:1 review to discuss {teacher.concerns[0]?.area.toLowerCase()} feedback
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Low-scoring areas school-wide */}
            {questionConcerns.length > 0 && (
              <div style={{ ...styles.card, marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                  📊 Low-Scoring Areas (School-wide)
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
                  Questions scoring below {WARNING_THRESHOLD} across all teachers
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {questionConcerns.sort((a, b) => a.score - b.score).map((q, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: q.severity === 'critical' ? '#fef2f2' : '#fffbeb'
                    }}>
                      <div>
                        <span style={{ fontWeight: '500' }}>{q.question}</span>
                        <span style={{ 
                          marginLeft: '8px', 
                          fontSize: '12px', 
                          color: '#6b7280',
                          padding: '2px 6px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '4px'
                        }}>
                          {q.section}
                        </span>
                        {!q.teacherControlled && (
                          <span style={{ 
                            marginLeft: '8px', 
                            fontSize: '11px', 
                            color: '#6b7280',
                            fontStyle: 'italic'
                          }}>
                            (facilities issue)
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontWeight: '700',
                        fontSize: '18px',
                        color: getScoreColor(q.score)
                      }}>
                        {q.score.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Campus comparison */}
            {campusPerformance.length > 1 && (
              <div style={styles.card}>
                <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                  🏫 Campus Comparison
                </h2>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {campusPerformance.map(c => (
                    <div key={c.campus} style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '16px',
                      borderRadius: '8px',
                      backgroundColor: c.avg < WARNING_THRESHOLD ? '#fef2f2' : '#f0fdf4',
                      border: `1px solid ${c.avg < WARNING_THRESHOLD ? '#fecaca' : '#bbf7d0'}`
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>{c.campus}</div>
                      <div style={{ 
                        fontSize: '28px', 
                        fontWeight: '700', 
                        color: getScoreColor(c.avg)
                      }}>
                        {c.avg.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{c.count} responses</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teachers Tab */}
        {activeTab === 'teachers' && (
          <div>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
              Click "Generate Summary" for AI-powered performance analysis comparing each teacher to colleagues.
            </p>
            {Object.entries(byTeacher)
              .map(([name, teacherData]) => ({
                name,
                overall: teacherData.reduce((sum, r) => sum + (r.overall_avg || 0), 0) / teacherData.length,
                count: teacherData.length,
                data: teacherData
              }))
              .sort((a, b) => b.overall - a.overall)
              .map((teacher, index) => (
                <div key={teacher.name} style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: index < 3 ? '#f97316' : '#e5e7eb',
                          color: index < 3 ? 'white' : '#6b7280',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          {index + 1}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{teacher.name}</h3>
                      </div>
                      <p style={{ margin: '4px 0 0 40px', color: '#6b7280', fontSize: '13px' }}>
                        {teacher.count} responses
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: getScoreColor(teacher.overall)
                      }}>
                        {teacher.overall.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>out of 3.0</div>
                    </div>
                  </div>
                  
                  {/* Section scores */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {['teach', 'support', 'mgmt', 'exp'].map(section => {
                      const avg = teacher.data.reduce((sum, r) => sum + (r[`${section}_avg`] || 0), 0) / teacher.data.length;
                      return (
                        <div key={section} style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          backgroundColor: '#f3f4f6',
                          fontSize: '12px'
                        }}>
                          <span style={{ color: '#6b7280' }}>{SECTIONS[section].label}: </span>
                          <span style={{ fontWeight: '600', color: getScoreColor(avg) }}>{avg.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* AI Summary */}
                  {teacherSummaries[teacher.name] ? (
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      borderLeft: '4px solid #f97316',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: '#1e293b',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {teacherSummaries[teacher.name]}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateSummary(teacher.name)}
                      disabled={summaryLoading[teacher.name]}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: summaryLoading[teacher.name] ? '#e5e7eb' : '#f97316',
                        color: summaryLoading[teacher.name] ? '#9ca3af' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: summaryLoading[teacher.name] ? 'default' : 'pointer'
                      }}
                    >
                      {summaryLoading[teacher.name] ? 'Analyzing...' : 'Generate Summary'}
                    </button>
                  )}
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
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {comments.map((c, i) => (
                  <div key={i} style={styles.comment}>
                    <p style={styles.commentText}>{c.comment}</p>
                    <p style={styles.commentMeta}>
                      {c.section} â€¢ {c.teacher} â€¢ {new Date(c.date).toLocaleDateString()}
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
