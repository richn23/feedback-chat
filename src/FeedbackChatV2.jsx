import React, { useState, useRef, useEffect } from 'react';

// Simple prompts for Claude - SHORT responses only
const getClaudePrompt = (step, language, context = {}) => {
  const baseInstruction = `You are a feedback assistant for ES World English school.
RULES:
- Respond in ${language}
- Use simple words (CEFR B1)
- ONE sentence only - be brief
- Be warm but not overly friendly
- No exclamation marks
- Never say "wonderful", "amazing", "fantastic"`;

  const prompts = {
    welcome: `${baseInstruction}
Say briefly: welcome, which campus (Dubai or London)?`,
    
    campus_selected: `${baseInstruction}
They chose ${context.campus}. Brief reaction, ask teacher's name.`,
    
    teacher_selected: `${baseInstruction}
Teacher is ${context.teacher}. Brief reaction, ask how long studying.`,
    
    duration_selected: `${baseInstruction}
Studying for ${context.duration}. Say "Now some questions about the classroom."`,
    
    env_done: `${baseInstruction}
Environment scores: classroom=${context.env_classroom}/3, facilities=${context.env_facilities}/3.
${context.env_classroom <= 1 || context.env_facilities <= 1 ? 'Show understanding for low scores.' : 'Brief thanks.'}
Ask: anything to add?`,
    
    env_comment_done: `${baseInstruction}
${context.comment ? `They said: "${context.comment}". Brief acknowledgment.` : 'Nothing to add.'}
Say: "Now about your classes."`,
    
    exp_done: `${baseInstruction}
Experience scores: activities=${context.exp_activities}/3, progress=${context.exp_progress}/3.
${context.exp_progress <= 1 ? 'Show understanding.' : 'Brief thanks.'}
Ask: anything to add?`,
    
    exp_comment_done: `${baseInstruction}
${context.comment ? `They said: "${context.comment}". Brief acknowledgment.` : 'Nothing to add.'}
Say: "Now about your teacher."`,
    
    teach_done: `${baseInstruction}
Teaching scores: explanations=${context.teach_explanations}/3, methods=${context.teach_methods}/3.
${context.teach_explanations <= 1 ? 'Show understanding.' : 'Brief thanks.'}
Ask: anything to add?`,
    
    teach_comment_done: `${baseInstruction}
${context.comment ? `They said: "${context.comment}". Brief acknowledgment.` : 'Nothing to add.'}
Say: "Now about help and support."`,
    
    support_done: `${baseInstruction}
Support scores: help=${context.support_help}/3, atmosphere=${context.support_atmosphere}/3.
Brief thanks. Ask: anything to add?`,
    
    support_comment_done: `${baseInstruction}
${context.comment ? `They said: "${context.comment}". Brief acknowledgment.` : 'Nothing to add.'}
Say: "Last section - class organization."`,
    
    mgmt_done: `${baseInstruction}
Management scores: timing=${context.mgmt_timing}/3, organization=${context.mgmt_organization}/3.
Brief thanks. Ask: anything to add?`,
    
    mgmt_comment_done: `${baseInstruction}
${context.comment ? `They said: "${context.comment}". Brief acknowledgment.` : 'Nothing to add.'}
Ask: "Any other feedback?"`,
    
    final_done: `${baseInstruction}
${context.comment ? `Final comment: "${context.comment}"` : 'No final comment.'}
Thank them briefly. Say it helps the school.`,
  };

  return prompts[step] || prompts.welcome;
};

// Translate comment to English
const getTranslationPrompt = (comment, fromLanguage) => {
  if (fromLanguage === 'English') return null;
  return `Translate to English. Only the translation, nothing else: "${comment}"`;
};

// Primary languages (top 6)
const PRIMARY_LANGUAGES = [
  { label: 'English', value: 'English' },
  { label: 'العربية', value: 'Arabic' },
  { label: 'Español', value: 'Spanish' },
  { label: '中文', value: 'Chinese' },
  { label: 'Português', value: 'Portuguese' },
  { label: 'Français', value: 'French' }
];

// Other languages
const OTHER_LANGUAGES = [
  { label: 'Türkçe', value: 'Turkish' },
  { label: 'Русский', value: 'Russian' },
  { label: 'ไทย', value: 'Thai' },
  { label: 'فارسی', value: 'Farsi' },
  { label: '한국어', value: 'Korean' },
  { label: '日本語', value: 'Japanese' },
  { label: 'Tiếng Việt', value: 'Vietnamese' },
  { label: 'Deutsch', value: 'German' },
  { label: 'Italiano', value: 'Italian' }
];

const CAMPUS_OPTIONS = [
  { label: 'Dubai', value: 'Dubai' },
  { label: 'London', value: 'London' }
];

const TEACHER_OPTIONS = [
  'Richard', 'Ryan', 'Majid', 'Tom', 'Scott', 
  'Gemma', 'Jenna', 'Danya', 'Mariam', 'Moe'
];

const DURATION_OPTIONS = [
  { label: '1-2 weeks', value: '1-2 weeks' },
  { label: '3-4 weeks', value: '3-4 weeks' },
  { label: '1-2 months', value: '1-2 months' },
  { label: '2+ months', value: '2+ months' }
];

// Section definitions with specific labels per question
const SECTIONS = {
  env: {
    title: 'Learning Environment',
    icon: '🏫',
    color: '#3B82F6',
    questions: [
      { key: 'env_classroom', label: 'Classroom comfort', labels: ['Often uncomfortable', 'Sometimes uncomfortable', 'Comfortable enough', 'Very comfortable'] },
      { key: 'env_facilities', label: 'School facilities', labels: ['Need major improvement', 'Need some improvement', 'Good enough', 'Very good'] },
      { key: 'env_location', label: 'Location', labels: ['Very inconvenient', 'Sometimes inconvenient', 'Convenient enough', 'Very convenient'] },
      { key: 'env_schedule', label: 'Class schedule', labels: ['Very difficult', 'Sometimes difficult', 'Works well enough', 'Works very well'] }
    ]
  },
  exp: {
    title: 'Learning Experience',
    icon: '📚',
    color: '#10B981',
    questions: [
      { key: 'exp_activities', label: 'Class activities', labels: ['Not very helpful', 'Sometimes helpful', 'Helpful enough', 'Very helpful'] },
      { key: 'exp_homework', label: 'Homework', labels: ['Not right for me', 'A bit too much/easy', 'About right', 'Just right'] },
      { key: 'exp_materials', label: 'Materials', labels: ['Not very helpful', 'Sometimes helpful', 'Helpful enough', 'Very helpful'] },
      { key: 'exp_progress', label: 'Your progress', labels: ['Not improving much', 'Improving a little', 'Improving enough', 'Improving a lot'] }
    ]
  },
  teach: {
    title: 'Teaching Quality',
    icon: '👩‍🏫',
    color: '#8B5CF6',
    questions: [
      { key: 'teach_explanations', label: 'Explanations', labels: ['Often unclear', 'Sometimes unclear', 'Usually clear', 'Always clear'] },
      { key: 'teach_preparation', label: 'Preparation', labels: ['Often unprepared', 'Sometimes unprepared', 'Usually prepared', 'Always prepared'] },
      { key: 'teach_methods', label: 'Teaching methods', labels: ['Need improvement', 'Could be better', 'Good methods', 'Very good methods'] },
      { key: 'teach_speaking', label: 'Speaking practice', labels: ['Not enough', 'Sometimes', 'Often enough', 'Very often'] }
    ]
  },
  support: {
    title: 'Student Support',
    icon: '🤝',
    color: '#F59E0B',
    questions: [
      { key: 'support_help', label: 'Getting help', labels: ['Rarely helps', 'Sometimes helps', 'Usually helps', 'Always helps'] },
      { key: 'support_feedback', label: 'Feedback quality', labels: ['Not very helpful', 'Sometimes helpful', 'Helpful enough', 'Very helpful'] },
      { key: 'support_encouragement', label: 'Encouragement', labels: ['Rarely encourages', 'Sometimes encourages', 'Usually encourages', 'Always encourages'] },
      { key: 'support_atmosphere', label: 'Class atmosphere', labels: ['Poor atmosphere', 'OK atmosphere', 'Good atmosphere', 'Very good atmosphere'] }
    ]
  },
  mgmt: {
    title: 'Class Management',
    icon: '📋',
    color: '#EF4444',
    questions: [
      { key: 'mgmt_timing', label: 'Time management', labels: ['Often poorly managed', 'Sometimes poorly managed', 'Usually well managed', 'Always well managed'] },
      { key: 'mgmt_fairness', label: 'Fairness', labels: ['Often unfair', 'Sometimes unfair', 'Usually fair', 'Always fair'] },
      { key: 'mgmt_organization', label: 'Organization', labels: ['Often disorganized', 'Sometimes disorganized', 'Usually organized', 'Always organized'] },
      { key: 'mgmt_rules', label: 'Class rules', labels: ['Poor rules', 'Rules need improvement', 'Good rules', 'Very good rules'] }
    ]
  }
};

// Steps
const STEPS = {
  LANGUAGE: 'language',
  CAMPUS: 'campus',
  TEACHER: 'teacher',
  DURATION: 'duration',
  ENV_SECTION: 'env_section',
  ENV_COMMENT: 'env_comment',
  EXP_SECTION: 'exp_section',
  EXP_COMMENT: 'exp_comment',
  TEACH_SECTION: 'teach_section',
  TEACH_COMMENT: 'teach_comment',
  SUPPORT_SECTION: 'support_section',
  SUPPORT_COMMENT: 'support_comment',
  MGMT_SECTION: 'mgmt_section',
  MGMT_COMMENT: 'mgmt_comment',
  FINAL_COMMENT: 'final_comment',
  COMPLETE: 'complete'
};

const STEP_ORDER = [
  STEPS.LANGUAGE, STEPS.CAMPUS, STEPS.TEACHER, STEPS.DURATION,
  STEPS.ENV_SECTION, STEPS.ENV_COMMENT,
  STEPS.EXP_SECTION, STEPS.EXP_COMMENT,
  STEPS.TEACH_SECTION, STEPS.TEACH_COMMENT,
  STEPS.SUPPORT_SECTION, STEPS.SUPPORT_COMMENT,
  STEPS.MGMT_SECTION, STEPS.MGMT_COMMENT,
  STEPS.FINAL_COMMENT, STEPS.COMPLETE
];

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

const generateResponseId = () => 'FB' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();

// Save to Google Sheet
const saveToGoogleSheet = async (data) => {
  const env_avg = ((data.env_classroom || 0) + (data.env_facilities || 0) + (data.env_location || 0) + (data.env_schedule || 0)) / 4;
  const exp_avg = ((data.exp_activities || 0) + (data.exp_homework || 0) + (data.exp_materials || 0) + (data.exp_progress || 0)) / 4;
  const teach_avg = ((data.teach_explanations || 0) + (data.teach_preparation || 0) + (data.teach_methods || 0) + (data.teach_speaking || 0)) / 4;
  const support_avg = ((data.support_help || 0) + (data.support_feedback || 0) + (data.support_encouragement || 0) + (data.support_atmosphere || 0)) / 4;
  const mgmt_avg = ((data.mgmt_timing || 0) + (data.mgmt_fairness || 0) + (data.mgmt_organization || 0) + (data.mgmt_rules || 0)) / 4;
  const overall_avg = (env_avg + exp_avg + teach_avg + support_avg + mgmt_avg) / 5;

  const rowData = {
    timestamp: new Date().toISOString(),
    response_id: generateResponseId(),
    language: data.language,
    campus: data.campus,
    teacher_name: data.teacher_name,
    duration: data.duration,
    env_classroom: data.env_classroom,
    env_facilities: data.env_facilities,
    env_location: data.env_location,
    env_schedule: data.env_schedule,
    env_comment: data.env_comment || '',
    exp_activities: data.exp_activities,
    exp_homework: data.exp_homework,
    exp_materials: data.exp_materials,
    exp_progress: data.exp_progress,
    exp_comment: data.exp_comment || '',
    teach_explanations: data.teach_explanations,
    teach_preparation: data.teach_preparation,
    teach_methods: data.teach_methods,
    teach_speaking: data.teach_speaking,
    teach_comment: data.teach_comment || '',
    support_help: data.support_help,
    support_feedback: data.support_feedback,
    support_encouragement: data.support_encouragement,
    support_atmosphere: data.support_atmosphere,
    support_comment: data.support_comment || '',
    mgmt_timing: data.mgmt_timing,
    mgmt_fairness: data.mgmt_fairness,
    mgmt_organization: data.mgmt_organization,
    mgmt_rules: data.mgmt_rules,
    mgmt_comment: data.mgmt_comment || '',
    final_comment: data.final_comment || '',
    env_avg: env_avg.toFixed(2),
    exp_avg: exp_avg.toFixed(2),
    teach_avg: teach_avg.toFixed(2),
    support_avg: support_avg.toFixed(2),
    mgmt_avg: mgmt_avg.toFixed(2),
    overall_avg: overall_avg.toFixed(2)
  };

  console.log('=== SAVING TO SHEET ===', rowData);

  if (!GOOGLE_SCRIPT_URL) {
    console.error('GOOGLE_SCRIPT_URL not set');
    return;
  }

  // Use hidden form submission (works with Apps Script)
  try {
    let iframe = document.getElementById('hidden_iframe_feedback');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.name = 'hidden_iframe_feedback';
      iframe.id = 'hidden_iframe_feedback';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = GOOGLE_SCRIPT_URL;
    form.target = 'hidden_iframe_feedback';
    form.style.display = 'none';

    // Data field (base64 encoded for Unicode)
    const dataInput = document.createElement('input');
    dataInput.type = 'hidden';
    dataInput.name = 'data';
    dataInput.value = btoa(unescape(encodeURIComponent(JSON.stringify(rowData))));
    form.appendChild(dataInput);

    // Encoding flag
    const encodingInput = document.createElement('input');
    encodingInput.type = 'hidden';
    encodingInput.name = 'encoding';
    encodingInput.value = 'base64';
    form.appendChild(encodingInput);

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      if (form.parentNode) form.parentNode.removeChild(form);
    }, 1000);

    console.log('Data sent via form');
  } catch (error) {
    console.error('Save error:', error);
  }
};

// Slider component
const RatingSlider = ({ question, value, onChange }) => {
  const [localValue, setLocalValue] = useState(value ?? 2);

  useEffect(() => {
    if (value !== undefined) setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const newValue = parseInt(e.target.value);
    setLocalValue(newValue);
    onChange(newValue);
  };

  const getTrackColor = () => {
    if (localValue >= 2.5) return '#22C55E';
    if (localValue >= 1.5) return '#EAB308';
    if (localValue >= 0.5) return '#F97316';
    return '#EF4444';
  };

  const getEmoji = () => {
    if (localValue >= 2.5) return '😊';
    if (localValue >= 1.5) return '🙂';
    if (localValue >= 0.5) return '😐';
    return '😟';
  };

  // Use question-specific label
  const getLabel = () => {
    return question.labels[localValue] || '';
  };

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>{question.label}</span>
        <span style={{ fontSize: '13px', color: getTrackColor(), fontWeight: '500' }}>{getEmoji()} {getLabel()}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            value={localValue}
            onChange={handleChange}
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              appearance: 'none',
              WebkitAppearance: 'none',
              background: `linear-gradient(to right, ${getTrackColor()} 0%, ${getTrackColor()} ${(localValue/3)*100}%, #E5E7EB ${(localValue/3)*100}%, #E5E7EB 100%)`,
              cursor: 'pointer',
            }}
          />
          <style>{`
            input[type="range"]::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: white;
              border: 3px solid ${getTrackColor()};
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            input[type="range"]::-moz-range-thumb {
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: white;
              border: 3px solid ${getTrackColor()};
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
          `}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 4px' }}>
            {[0, 1, 2, 3].map(n => (
              <div
                key={n}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: localValue >= n ? getTrackColor() : '#D1D5DB'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Section card with sliders
const SectionCard = ({ section, values, onChange, onSubmit }) => {
  const [localValues, setLocalValues] = useState(() => {
    const initial = {};
    section.questions.forEach(q => { initial[q.key] = values[q.key] ?? 2; });
    return initial;
  });

  const handleSliderChange = (key, value) => {
    setLocalValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    onChange(localValues);
    onSubmit(localValues);
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      border: `2px solid ${section.color}30`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: `2px solid ${section.color}20` }}>
        <span style={{ fontSize: '24px' }}>{section.icon}</span>
        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: section.color }}>{section.title}</h3>
      </div>

      {section.questions.map(q => (
        <RatingSlider
          key={q.key}
          question={q}
          value={localValues[q.key]}
          onChange={(val) => handleSliderChange(q.key, val)}
        />
      ))}

      <button
        onClick={handleSubmit}
        style={{
          width: '100%',
          padding: '14px',
          marginTop: '8px',
          borderRadius: '12px',
          border: 'none',
          backgroundColor: section.color,
          color: 'white',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        Continue →
      </button>
    </div>
  );
};

function FeedbackChatV2() {
  const [currentStep, setCurrentStep] = useState(STEPS.LANGUAGE);
  const [messages, setMessages] = useState([{ type: 'bot', text: "Hi 👋 Choose your language." }]);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState({});
  const [sectionAnswers, setSectionAnswers] = useState({});
  const [inputValue, setInputValue] = useState('');
  const [showOtherLangs, setShowOtherLangs] = useState(false);
  const [customLangMode, setCustomLangMode] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStep]);

  // Call Claude
  const callClaude = async (prompt) => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 150,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!response.ok) throw new Error('API error');
      const result = await response.json();
      return result.content[0].text;
    } catch (error) {
      console.error('Claude error:', error);
      return null;
    }
  };

  const translateToEnglish = async (comment, language) => {
    if (!comment || language === 'English') return comment;
    const prompt = getTranslationPrompt(comment, language);
    const translated = await callClaude(prompt);
    return translated || comment;
  };

  const getClaudeResponse = async (step, context = {}) => {
    const prompt = getClaudePrompt(step, data.language || 'English', context);
    const response = await callClaude(prompt);
    return response || getFallbackMessage(step);
  };

  const getFallbackMessage = (step) => {
    const fallbacks = {
      welcome: "Which campus - Dubai or London?",
      campus_selected: "Got it. Who is your teacher?",
      teacher_selected: "How long have you been studying?",
      duration_selected: "Now some questions about the classroom.",
      env_done: "Thanks. Anything to add?",
      env_comment_done: "Now about your classes.",
      exp_done: "Thanks. Anything to add?",
      exp_comment_done: "Now about the teaching.",
      teach_done: "Thanks. Anything to add?",
      teach_comment_done: "Now about support.",
      support_done: "Thanks. Anything to add?",
      support_comment_done: "Last section.",
      mgmt_done: "Thanks. Anything to add?",
      mgmt_comment_done: "Any other feedback?",
      final_done: "Thank you. This helps us improve."
    };
    return fallbacks[step] || "Thank you.";
  };

  const goToNextStep = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx < STEP_ORDER.length - 1) setCurrentStep(STEP_ORDER[idx + 1]);
  };

  // Handlers
  const handleLanguageSelect = async (language) => {
    setMessages(prev => [...prev, { type: 'user', text: language }]);
    setData({ language });
    setIsLoading(true);
    const response = await getClaudeResponse('welcome', {});
    setMessages(prev => [...prev, { type: 'bot', text: response }]);
    setIsLoading(false);
    setCurrentStep(STEPS.CAMPUS);
  };

  const handleCampusSelect = async (campus) => {
    setMessages(prev => [...prev, { type: 'user', text: campus }]);
    setData(prev => ({ ...prev, campus }));
    setIsLoading(true);
    const response = await getClaudeResponse('campus_selected', { campus });
    setMessages(prev => [...prev, { type: 'bot', text: response }]);
    setIsLoading(false);
    setCurrentStep(STEPS.TEACHER);
  };

  const handleTeacherSelect = async (teacher) => {
    setMessages(prev => [...prev, { type: 'user', text: teacher }]);
    setData(prev => ({ ...prev, teacher_name: teacher }));
    setIsLoading(true);
    const response = await getClaudeResponse('teacher_selected', { teacher });
    setMessages(prev => [...prev, { type: 'bot', text: response }]);
    setIsLoading(false);
    setCurrentStep(STEPS.DURATION);
  };

  const handleDurationSelect = async (duration) => {
    setMessages(prev => [...prev, { type: 'user', text: duration }]);
    setData(prev => ({ ...prev, duration }));
    setIsLoading(true);
    const response = await getClaudeResponse('duration_selected', { duration });
    setMessages(prev => [...prev, { type: 'bot', text: response }]);
    setIsLoading(false);
    setCurrentStep(STEPS.ENV_SECTION);
  };

  const handleSectionSubmit = async (sectionKey, values) => {
    // Show a simple "Done ✓" message instead of listing all answers
    setMessages(prev => [...prev, { type: 'user', text: '✓ Submitted' }]);
    setData(prev => ({ ...prev, ...values }));
    setSectionAnswers({});
    setIsLoading(true);
    const response = await getClaudeResponse(`${sectionKey}_done`, values);
    setMessages(prev => [...prev, { type: 'bot', text: response }]);
    setIsLoading(false);
    goToNextStep();
  };

  const handleCommentSubmit = async (commentKey, comment) => {
    setMessages(prev => [...prev, { type: 'user', text: comment || 'Nothing to add' }]);
    setIsLoading(true);
    const translated = await translateToEnglish(comment, data.language);
    setData(prev => ({ ...prev, [commentKey]: translated }));
    const response = await getClaudeResponse(`${commentKey}_done`, { comment });
    setMessages(prev => [...prev, { type: 'bot', text: response }]);
    setIsLoading(false);

    if (commentKey === 'final_comment') {
      const finalData = { ...data, [commentKey]: translated };
      await saveToGoogleSheet(finalData);
      setCurrentStep(STEPS.COMPLETE);
    } else {
      goToNextStep();
    }
  };

  const handleSkip = (commentKey) => handleCommentSubmit(commentKey, '');

  // Get current section
  const getCurrentSection = () => {
    switch (currentStep) {
      case STEPS.ENV_SECTION: return { key: 'env', ...SECTIONS.env };
      case STEPS.EXP_SECTION: return { key: 'exp', ...SECTIONS.exp };
      case STEPS.TEACH_SECTION: return { key: 'teach', ...SECTIONS.teach };
      case STEPS.SUPPORT_SECTION: return { key: 'support', ...SECTIONS.support };
      case STEPS.MGMT_SECTION: return { key: 'mgmt', ...SECTIONS.mgmt };
      default: return null;
    }
  };

  const getCommentKey = () => {
    switch (currentStep) {
      case STEPS.ENV_COMMENT: return 'env_comment';
      case STEPS.EXP_COMMENT: return 'exp_comment';
      case STEPS.TEACH_COMMENT: return 'teach_comment';
      case STEPS.SUPPORT_COMMENT: return 'support_comment';
      case STEPS.MGMT_COMMENT: return 'mgmt_comment';
      case STEPS.FINAL_COMMENT: return 'final_comment';
      default: return null;
    }
  };

  const currentSection = getCurrentSection();
  const commentKey = getCommentKey();

  // Styles
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxWidth: '448px',
      margin: '0 auto',
      backgroundColor: '#f3f4f6',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    header: {
      backgroundColor: '#f97316',
      color: 'white',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    logo: {
      width: '40px',
      height: '40px',
      backgroundColor: 'white',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f97316',
      fontWeight: 'bold',
      fontSize: '14px'
    },
    messagesContainer: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    botMessage: {
      maxWidth: '85%',
      padding: '12px 16px',
      borderRadius: '18px 18px 18px 4px',
      backgroundColor: 'white',
      color: '#1f2937',
      fontSize: '15px',
      lineHeight: '1.4',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    userMessage: {
      maxWidth: '85%',
      padding: '12px 16px',
      borderRadius: '18px 18px 4px 18px',
      backgroundColor: '#f97316',
      color: 'white',
      fontSize: '15px',
      lineHeight: '1.4'
    },
    inputArea: {
      padding: '16px',
      backgroundColor: 'white',
      borderTop: '1px solid #e5e7eb'
    },
    langGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '10px'
    },
    langButton: {
      padding: '14px 12px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      backgroundColor: 'white',
      fontSize: '15px',
      cursor: 'pointer',
      transition: 'all 0.15s'
    },
    otherLangGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '8px',
      marginTop: '10px'
    },
    otherLangBtn: {
      padding: '10px 6px',
      borderRadius: '10px',
      border: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb',
      fontSize: '13px',
      cursor: 'pointer'
    },
    linkButton: {
      width: '100%',
      padding: '10px',
      marginTop: '8px',
      backgroundColor: 'transparent',
      border: 'none',
      color: '#6b7280',
      fontSize: '14px',
      cursor: 'pointer'
    },
    campusGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '10px'
    },
    selectButton: {
      padding: '14px 16px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      backgroundColor: 'white',
      fontSize: '15px',
      cursor: 'pointer',
      transition: 'all 0.15s'
    },
    dropdown: {
      width: '100%',
      padding: '14px 16px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      backgroundColor: 'white',
      fontSize: '15px',
      cursor: 'pointer'
    },
    textInput: {
      width: '100%',
      padding: '14px 16px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      fontSize: '15px',
      marginBottom: '10px',
      outline: 'none'
    },
    sendButton: {
      width: '100%',
      padding: '14px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: '#f97316',
      color: 'white',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer'
    },
    skipButton: {
      width: '100%',
      padding: '10px',
      marginTop: '8px',
      backgroundColor: 'transparent',
      border: 'none',
      color: '#6b7280',
      fontSize: '14px',
      cursor: 'pointer'
    },
    typingDots: {
      display: 'flex',
      gap: '4px',
      padding: '12px 16px',
      backgroundColor: 'white',
      borderRadius: '18px 18px 18px 4px',
      width: 'fit-content',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    complete: {
      textAlign: 'center',
      padding: '20px',
      color: '#059669',
      fontSize: '15px',
      fontWeight: '500'
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>ES</div>
        <div>
          <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '600' }}>ES Feedback</h1>
          <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>Tell us about your experience</p>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={msg.type === 'user' ? styles.userMessage : styles.botMessage}>{msg.text}</div>
          </div>
        ))}

        {/* Section Card with Sliders */}
        {currentSection && (
          <SectionCard
            section={currentSection}
            values={sectionAnswers}
            onChange={setSectionAnswers}
            onSubmit={(values) => handleSectionSubmit(currentSection.key, values)}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <div style={styles.typingDots}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#9ca3af', animation: 'bounce 1.4s infinite ease-in-out' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#9ca3af', animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0.15s' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#9ca3af', animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0.3s' }} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={styles.inputArea}>
        {/* Language Selection - 6 primary + Other */}
        {currentStep === STEPS.LANGUAGE && (
          <>
            <div style={styles.langGrid}>
              {PRIMARY_LANGUAGES.map((lang, i) => (
                <button
                  key={i}
                  onClick={() => handleLanguageSelect(lang.value)}
                  style={styles.langButton}
                  onMouseEnter={e => { e.target.style.borderColor = '#f97316'; e.target.style.backgroundColor = '#fff7ed'; }}
                  onMouseLeave={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = 'white'; }}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {!showOtherLangs && !customLangMode && (
              <button onClick={() => setShowOtherLangs(true)} style={styles.linkButton}>
                Other language...
              </button>
            )}

            {showOtherLangs && !customLangMode && (
              <>
                <div style={styles.otherLangGrid}>
                  {OTHER_LANGUAGES.map((lang, i) => (
                    <button
                      key={i}
                      onClick={() => handleLanguageSelect(lang.value)}
                      style={styles.otherLangBtn}
                      onMouseEnter={e => { e.target.style.borderColor = '#f97316'; }}
                      onMouseLeave={e => { e.target.style.borderColor = '#e5e7eb'; }}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setCustomLangMode(true)} style={styles.linkButton}>
                  Type another language...
                </button>
              </>
            )}

            {customLangMode && (
              <div style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="Type your language..."
                  style={styles.textInput}
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (inputValue.trim()) {
                      handleLanguageSelect(inputValue.trim());
                      setInputValue('');
                    }
                  }}
                  style={{ ...styles.sendButton, opacity: inputValue.trim() ? 1 : 0.5 }}
                  disabled={!inputValue.trim()}
                >
                  Continue
                </button>
              </div>
            )}
          </>
        )}

        {/* Campus */}
        {currentStep === STEPS.CAMPUS && !isLoading && (
          <div style={styles.campusGrid}>
            {CAMPUS_OPTIONS.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleCampusSelect(opt.value)}
                style={styles.selectButton}
                onMouseEnter={e => { e.target.style.borderColor = '#f97316'; e.target.style.backgroundColor = '#fff7ed'; }}
                onMouseLeave={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = 'white'; }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Teacher - Dropdown */}
        {currentStep === STEPS.TEACHER && !isLoading && (
          <select
            onChange={(e) => { if (e.target.value) handleTeacherSelect(e.target.value); }}
            defaultValue=""
            style={styles.dropdown}
          >
            <option value="" disabled>Select your teacher...</option>
            {TEACHER_OPTIONS.map((t, i) => (
              <option key={i} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* Duration */}
        {currentStep === STEPS.DURATION && !isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {DURATION_OPTIONS.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleDurationSelect(opt.value)}
                style={styles.selectButton}
                onMouseEnter={e => { e.target.style.borderColor = '#f97316'; e.target.style.backgroundColor = '#fff7ed'; }}
                onMouseLeave={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = 'white'; }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Comment Input */}
        {commentKey && !isLoading && (
          <>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={e => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  handleCommentSubmit(commentKey, inputValue.trim());
                  setInputValue('');
                }
              }}
              placeholder="Type your comment..."
              style={styles.textInput}
            />
            <button
              onClick={() => {
                if (inputValue.trim()) {
                  handleCommentSubmit(commentKey, inputValue.trim());
                  setInputValue('');
                }
              }}
              style={{ ...styles.sendButton, opacity: inputValue.trim() ? 1 : 0.5 }}
              disabled={!inputValue.trim()}
            >
              Send
            </button>
            <button onClick={() => handleSkip(commentKey)} style={styles.skipButton}>
              Nothing to add →
            </button>
          </>
        )}

        {/* Complete */}
        {currentStep === STEPS.COMPLETE && (
          <div style={styles.complete}>✓ Feedback submitted</div>
        )}
      </div>
    </div>
  );
}

export default FeedbackChatV2;
