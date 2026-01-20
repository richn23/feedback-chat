import React, { useState, useRef, useEffect } from 'react';

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are a friendly feedback assistant for ES World English school (Dubai and London). Collect student feedback in a warm, natural way.

CRITICAL LANGUAGE RULE:
After user selects a language, you MUST respond ONLY in that language for ALL text.

CONVERSATION FLOW:
1. LANGUAGE - Already selected via buttons
2. CAMPUS - Ask which campus. Set current_step: "campus"
3. TEACHER - Ask teacher's name. Set current_step: "teacher"
4. DURATION - Ask how long studying. Set current_step: "duration"
5. LEARNING ENVIRONMENT section - Set current_step: "env"
6. ENV FOLLOW-UP - Brief summary, ask if anything to add. Set current_step: "env_comment"
7. LEARNING EXPERIENCE section - Set current_step: "exp"
8. EXP FOLLOW-UP - Set current_step: "exp_comment"
9. TEACHING QUALITY section - Set current_step: "teach"
10. TEACH FOLLOW-UP - Set current_step: "teach_comment"
11. STUDENT SUPPORT section - Set current_step: "support"
12. SUPPORT FOLLOW-UP - Set current_step: "support_comment"
13. CLASS MANAGEMENT section - Set current_step: "mgmt"
14. MGMT FOLLOW-UP - Set current_step: "mgmt_comment"
15. FINAL - "Any other comments?" Set current_step: "final"
16. THANK YOU - Short thanks, set is_complete: true

STYLE GUIDE:
- ONE short sentence summaries only
- Don't repeat what they said
- Don't be overly enthusiastic
- Translate comments to English when storing

JSON FORMAT - include after EVERY response:
|||JSON|||
{
  "language": null,
  "campus": null,
  "teacher_name": null,
  "duration": null,
  "env_classroom": null,
  "env_facilities": null,
  "env_location": null,
  "env_schedule": null,
  "env_comment": null,
  "exp_activities": null,
  "exp_homework": null,
  "exp_materials": null,
  "exp_progress": null,
  "exp_comment": null,
  "teach_explanations": null,
  "teach_preparation": null,
  "teach_methods": null,
  "teach_speaking": null,
  "teach_comment": null,
  "support_help": null,
  "support_feedback": null,
  "support_encouragement": null,
  "support_atmosphere": null,
  "support_comment": null,
  "mgmt_timing": null,
  "mgmt_fairness": null,
  "mgmt_organization": null,
  "mgmt_rules": null,
  "mgmt_comment": null,
  "final_comment": null,
  "is_complete": false,
  "current_step": "campus"
}
|||END|||`;

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

// Default English UI text
const DEFAULT_UI = {
  sectionTitles: {
    env: 'Learning Environment',
    exp: 'Learning Experience', 
    teach: 'Teaching Quality',
    support: 'Student Support',
    mgmt: 'Class Management'
  },
  questions: {
    env_classroom: 'Classroom comfort',
    env_facilities: 'Facilities',
    env_location: 'Location',
    env_schedule: 'Schedule',
    exp_activities: 'Class activities',
    exp_homework: 'Homework',
    exp_materials: 'Materials',
    exp_progress: 'Your progress',
    teach_explanations: 'Explanations',
    teach_preparation: 'Preparation',
    teach_methods: 'Teaching methods',
    teach_speaking: 'Speaking practice',
    support_help: 'Getting help',
    support_feedback: 'Feedback quality',
    support_encouragement: 'Encouragement',
    support_atmosphere: 'Atmosphere',
    mgmt_timing: 'Time management',
    mgmt_fairness: 'Fairness',
    mgmt_organization: 'Organization',
    mgmt_rules: 'Rules'
  },
  options: {
    env_classroom: ['Very comfortable', 'Comfortable enough', 'Sometimes uncomfortable', 'Often uncomfortable'],
    env_facilities: ['Excellent', 'Good', 'Adequate', 'Poor'],
    env_location: ['Very convenient', 'Convenient enough', 'Somewhat inconvenient', 'Very inconvenient'],
    env_schedule: ['Works perfectly', 'Works well', 'Some issues', "Doesn't work"],
    exp_activities: ['Very helpful', 'Helpful enough', 'Somewhat helpful', 'Not helpful'],
    exp_homework: ['Perfect amount', 'About right', 'Too much/little', 'Not appropriate'],
    exp_materials: ['Very helpful', 'Helpful enough', 'Somewhat helpful', 'Not helpful'],
    exp_progress: ['Improving a lot', 'Improving enough', 'Improving a little', 'Not improving'],
    teach_explanations: ['Very clear', 'Clear enough', 'Sometimes unclear', 'Often unclear'],
    teach_preparation: ['Always prepared', 'Usually prepared', 'Sometimes unprepared', 'Often unprepared'],
    teach_methods: ['Very effective', 'Effective enough', 'Somewhat effective', 'Not effective'],
    teach_speaking: ['Plenty of practice', 'Enough practice', 'Not enough', 'Very little'],
    support_help: ['Always available', 'Usually available', 'Sometimes available', 'Rarely available'],
    support_feedback: ['Very helpful', 'Helpful enough', 'Somewhat helpful', 'Not helpful'],
    support_encouragement: ['Very encouraging', 'Encouraging enough', 'Somewhat encouraging', 'Not encouraging'],
    support_atmosphere: ['Excellent', 'Good', 'Okay', 'Poor'],
    mgmt_timing: ['Very well managed', 'Well managed', 'Could be better', 'Poorly managed'],
    mgmt_fairness: ['Yes, always', 'Usually', 'Sometimes', 'No'],
    mgmt_organization: ['Very organized', 'Organized enough', 'Somewhat organized', 'Disorganized'],
    mgmt_rules: ['Very clear & fair', 'Clear & fair', 'Somewhat clear', 'Unclear/unfair']
  },
  buttons: {
    continue: 'Continue →',
    nothingToAdd: 'Nothing to add →',
    send: 'Send',
    placeholder: 'Type your comment...',
    submitted: '✓ Feedback submitted',
    answerAll: 'Answer all questions'
  },
  duration: ['1-2 weeks', '3-4 weeks', '1-2 months', '2+ months']
};

// Get translations from Claude
const getTranslations = async (language) => {
  if (language === 'English') return DEFAULT_UI;
  
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
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Translate this UI text to ${language}. Keep it simple (B1 level). Return ONLY valid JSON, no other text.

${JSON.stringify(DEFAULT_UI, null, 2)}`
        }]
      })
    });

    if (!response.ok) throw new Error('Translation failed');
    const result = await response.json();
    const text = result.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Translation error:', error);
  }
  return DEFAULT_UI;
};

const generateResponseId = () => 'FB' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();

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

  if (GOOGLE_SCRIPT_URL) {
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
      form.acceptCharset = 'UTF-8';
      form.style.display = 'none';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'data';
      input.value = btoa(unescape(encodeURIComponent(JSON.stringify(rowData))));
      form.appendChild(input);

      const encodingInput = document.createElement('input');
      encodingInput.type = 'hidden';
      encodingInput.name = 'encoding';
      encodingInput.value = 'base64';
      form.appendChild(encodingInput);

      document.body.appendChild(form);
      form.submit();
      setTimeout(() => { if (form.parentNode) form.parentNode.removeChild(form); }, 1000);
    } catch (error) {
      console.error('Error saving:', error);
    }
  }
};

const LANGUAGES = [
  { label: 'English', value: 'English' },
  { label: 'العربية', value: 'Arabic' },
  { label: 'Español', value: 'Spanish' },
  { label: '中文', value: 'Chinese' },
  { label: 'Português', value: 'Portuguese' },
  { label: 'Türkçe', value: 'Turkish' },
  { label: 'Русский', value: 'Russian' },
  { label: 'ไทย', value: 'Thai' },
  { label: 'فارسی', value: 'Farsi' },
  { label: '한국어', value: 'Korean' },
  { label: '日本語', value: 'Japanese' },
  { label: 'Tiếng Việt', value: 'Vietnamese' },
  { label: 'Français', value: 'French' },
  { label: 'Deutsch', value: 'German' },
  { label: 'Italiano', value: 'Italian' }
];

const TEACHERS = ['Richard', 'Ryan', 'Majid', 'Tom', 'Scott', 'Gemma', 'Jenna', 'Danya', 'Mariam', 'Moe'];

const SECTION_ICONS = {
  env: '🏫',
  exp: '📚',
  teach: '👨‍🏫',
  support: '🤝',
  mgmt: '📋'
};

function FeedbackChatV2() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [collectedData, setCollectedData] = useState({});
  const [currentStep, setCurrentStep] = useState('language');
  const [sectionAnswers, setSectionAnswers] = useState({});
  const [ui, setUi] = useState(DEFAULT_UI);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStep]);

  useEffect(() => {
    setMessages([{ type: 'bot', text: "Hi! 👋 Choose your language." }]);
  }, []);

  const parseResponse = (text) => {
    const jsonMatch = text.match(/\|\|\|JSON\|\|\|([\s\S]*?)\|\|\|END\|\|\|/);
    let displayText = text.replace(/\|\|\|JSON\|\|\|[\s\S]*?\|\|\|END\|\|\|/, '').trim();
    let data = null;
    if (jsonMatch) {
      try { data = JSON.parse(jsonMatch[1]); } catch (e) { console.error('JSON error:', e); }
    }
    return { displayText, data };
  };

  const callClaude = async (conversationHistory) => {
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
        system: SYSTEM_PROMPT,
        messages: conversationHistory
      })
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.content[0].text;
  };

  const handleLanguageSelect = async (language) => {
    setSelectedLanguage(language);
    setMessages(prev => [...prev, { type: 'user', text: language }]);
    setIsLoading(true);
    
    // Get translations
    const translations = await getTranslations(language);
    setUi(translations);
    
    setCollectedData({ language });
    setCurrentStep('campus');
    
    try {
      const response = await callClaude([{ 
        role: 'user', 
        content: `User selected ${language}. Ask which campus (Dubai or London) IN ${language}. Remember to respond ONLY in ${language} from now on.` 
      }]);
      const { displayText, data } = parseResponse(response);
      setMessages(prev => [...prev, { type: 'bot', text: displayText }]);
      if (data) {
        setCollectedData(prev => ({ ...prev, ...data }));
        if (data.current_step) setCurrentStep(data.current_step);
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setIsLoading(false);
  };

  const sendMessage = async (userMessage, storeAs = null) => {
    const newMessages = [...messages, { type: 'user', text: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const conversationHistory = newMessages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));
      
      // Add reminder about language
      if (selectedLanguage !== 'English') {
        conversationHistory[conversationHistory.length - 1].content += ` [Remember: respond in ${selectedLanguage}]`;
      }

      const response = await callClaude(conversationHistory);
      const { displayText, data } = parseResponse(response);
      setMessages([...newMessages, { type: 'bot', text: displayText }]);

      if (data) {
        const updatedData = { ...collectedData, ...data };
        if (storeAs) updatedData[storeAs] = userMessage;
        setCollectedData(updatedData);
        
        if (data.current_step) setCurrentStep(data.current_step);
        
        if (data.is_complete) {
          setIsComplete(true);
          saveToGoogleSheet(updatedData);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages([...newMessages, { type: 'bot', text: "Sorry, please try again." }]);
    }
    setIsLoading(false);
  };

  const handleSectionSubmit = (section) => {
    const sectionData = {};
    const keys = Object.keys(sectionAnswers);
    keys.forEach(key => {
      sectionData[key] = sectionAnswers[key];
    });
    
    setCollectedData(prev => ({ ...prev, ...sectionData }));
    
    // Build summary for Claude
    const summary = keys.map(key => {
      const q = ui.questions[key] || key;
      const optIndex = 3 - sectionAnswers[key]; // Convert 0-3 to index
      const opts = ui.options[key] || DEFAULT_UI.options[key];
      return `${q}: ${opts[optIndex] || sectionAnswers[key]}`;
    }).join(', ');
    
    setSectionAnswers({});
    sendMessage(summary);
  };

  const getCurrentSection = () => {
    if (['env', 'exp', 'teach', 'support', 'mgmt'].includes(currentStep)) {
      return currentStep;
    }
    return null;
  };

  const section = getCurrentSection();
  const sectionKeys = section ? {
    env: ['env_classroom', 'env_facilities', 'env_location', 'env_schedule'],
    exp: ['exp_activities', 'exp_homework', 'exp_materials', 'exp_progress'],
    teach: ['teach_explanations', 'teach_preparation', 'teach_methods', 'teach_speaking'],
    support: ['support_help', 'support_feedback', 'support_encouragement', 'support_atmosphere'],
    mgmt: ['mgmt_timing', 'mgmt_fairness', 'mgmt_organization', 'mgmt_rules']
  }[section] : [];

  const allAnswered = section && sectionKeys.every(key => sectionAnswers[key] !== undefined);

  const styles = {
    container: { display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '448px', margin: '0 auto', backgroundColor: '#f3f4f6', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    header: { backgroundColor: '#f97316', color: 'white', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' },
    logo: { width: '40px', height: '40px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', fontWeight: 'bold', fontSize: '14px' },
    messagesContainer: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
    messageBubble: (isUser) => ({ maxWidth: '85%', borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px', fontSize: '14px', whiteSpace: 'pre-line', backgroundColor: isUser ? '#f97316' : 'white', color: isUser ? 'white' : '#1f2937', boxShadow: isUser ? 'none' : '0 1px 2px rgba(0,0,0,0.1)', alignSelf: isUser ? 'flex-end' : 'flex-start' }),
    inputArea: { padding: '12px', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' },
    languageGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' },
    langBtn: { padding: '10px', borderRadius: '12px', backgroundColor: 'white', border: '1px solid #e5e7eb', fontSize: '14px', cursor: 'pointer' },
    optionBtn: { padding: '12px 16px', borderRadius: '12px', backgroundColor: 'white', border: '1px solid #e5e7eb', fontSize: '14px', cursor: 'pointer', width: '100%', marginBottom: '8px', textAlign: 'left' },
    sectionCard: { backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
    sectionTitle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: '600', color: '#10B981', marginBottom: '20px' },
    questionRow: { marginBottom: '20px' },
    questionLabel: { fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' },
    slider: { width: '100%', height: '8px', borderRadius: '4px', appearance: 'none', background: 'linear-gradient(to right, #fbbf24, #10B981)', cursor: 'pointer' },
    sliderLabel: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#f97316', fontWeight: '500' },
    continueBtn: (enabled) => ({ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: '600', cursor: enabled ? 'pointer' : 'default', backgroundColor: enabled ? '#10B981' : '#e5e7eb', color: enabled ? 'white' : '#9ca3af' }),
    skipBtn: { width: '100%', padding: '10px', marginTop: '8px', background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer' },
    inputRow: { display: 'flex', gap: '8px' },
    textInput: { flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '14px', outline: 'none' },
    sendBtn: (enabled) => ({ padding: '12px 20px', borderRadius: '12px', border: 'none', backgroundColor: enabled ? '#f97316' : '#e5e7eb', color: 'white', fontSize: '14px', fontWeight: '500', cursor: enabled ? 'pointer' : 'default' })
  };

  const getOptionLabel = (key, value) => {
    const opts = ui.options[key] || DEFAULT_UI.options[key];
    const index = 3 - value;
    return opts[index] || '';
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; background: white; border: 3px solid #f97316; border-radius: 50%; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
      `}</style>

      <div style={styles.header}>
        <div style={styles.logo}>ES</div>
        <div>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>ES Feedback</h1>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>Tell us about your experience</p>
        </div>
      </div>

      <div style={styles.messagesContainer}>
        {messages.map((msg, idx) => (
          <div key={idx} style={styles.messageBubble(msg.type === 'user')}>{msg.text}</div>
        ))}

        {/* Section Rating Card */}
        {section && (
          <div style={styles.sectionCard}>
            <div style={styles.sectionTitle}>
              <span>{SECTION_ICONS[section]}</span>
              <span>{ui.sectionTitles[section]}</span>
            </div>
            
            {sectionKeys.map(key => (
              <div key={key} style={styles.questionRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={styles.questionLabel}>{ui.questions[key]}</span>
                  {sectionAnswers[key] !== undefined && (
                    <span style={styles.sliderLabel}>
                      <span>😊</span>
                      <span>{getOptionLabel(key, sectionAnswers[key])}</span>
                    </span>
                  )}
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  value={sectionAnswers[key] ?? 2}
                  onChange={(e) => setSectionAnswers(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                  style={styles.slider}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: (sectionAnswers[key] ?? 2) === i ? '#f97316' : '#e5e7eb' }} />
                  ))}
                </div>
              </div>
            ))}
            
            <button
              onClick={() => handleSectionSubmit(section)}
              disabled={!allAnswered}
              style={styles.continueBtn(allAnswered)}
            >
              {ui.buttons.continue}
            </button>
          </div>
        )}

        {isLoading && (
          <div style={{ display: 'flex', gap: '4px', padding: '12px', backgroundColor: 'white', borderRadius: '16px', width: 'fit-content', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: '8px', height: '8px', backgroundColor: '#9ca3af', borderRadius: '50%', animation: 'bounce 1.4s infinite', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        {isComplete ? (
          <p style={{ textAlign: 'center', color: '#10B981', fontWeight: '500' }}>{ui.buttons.submitted}</p>
        ) : currentStep === 'language' ? (
          <div style={styles.languageGrid}>
            {LANGUAGES.map((lang, i) => (
              <button key={i} onClick={() => handleLanguageSelect(lang.value)} style={styles.langBtn}
                onMouseEnter={(e) => { e.target.style.backgroundColor = '#f97316'; e.target.style.color = 'white'; }}
                onMouseLeave={(e) => { e.target.style.backgroundColor = 'white'; e.target.style.color = 'black'; }}>
                {lang.label}
              </button>
            ))}
          </div>
        ) : currentStep === 'campus' ? (
          <div>
            {['Dubai', 'London'].map(campus => (
              <button key={campus} onClick={() => sendMessage(campus)} style={styles.optionBtn}
                onMouseEnter={(e) => { e.target.style.backgroundColor = '#f97316'; e.target.style.color = 'white'; }}
                onMouseLeave={(e) => { e.target.style.backgroundColor = 'white'; e.target.style.color = 'black'; }}>
                {campus}
              </button>
            ))}
          </div>
        ) : currentStep === 'teacher' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {TEACHERS.map(teacher => (
              <button key={teacher} onClick={() => sendMessage(teacher)} style={{ ...styles.optionBtn, marginBottom: 0 }}
                onMouseEnter={(e) => { e.target.style.backgroundColor = '#f97316'; e.target.style.color = 'white'; }}
                onMouseLeave={(e) => { e.target.style.backgroundColor = 'white'; e.target.style.color = 'black'; }}>
                {teacher}
              </button>
            ))}
          </div>
        ) : currentStep === 'duration' ? (
          <div>
            {ui.duration.map(dur => (
              <button key={dur} onClick={() => sendMessage(dur)} style={styles.optionBtn}
                onMouseEnter={(e) => { e.target.style.backgroundColor = '#f97316'; e.target.style.color = 'white'; }}
                onMouseLeave={(e) => { e.target.style.backgroundColor = 'white'; e.target.style.color = 'black'; }}>
                {dur}
              </button>
            ))}
          </div>
        ) : !section && (
          <>
            <div style={styles.inputRow}>
              <input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter' && inputValue.trim()) { sendMessage(inputValue.trim()); setInputValue(''); } }}
                placeholder={ui.buttons.placeholder}
                style={styles.textInput}
              />
              <button
                onClick={() => { sendMessage(inputValue.trim()); setInputValue(''); }}
                disabled={!inputValue.trim() || isLoading}
                style={styles.sendBtn(inputValue.trim() && !isLoading)}
              >
                {ui.buttons.send}
              </button>
            </div>
            <button onClick={() => sendMessage(ui.buttons.nothingToAdd)} style={styles.skipBtn}>
              {ui.buttons.nothingToAdd}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default FeedbackChatV2;
