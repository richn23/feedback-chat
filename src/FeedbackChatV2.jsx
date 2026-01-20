import React, { useState, useRef, useEffect } from 'react';

const SYSTEM_PROMPT = `You are a friendly feedback assistant for ES World English school (Dubai and London). Collect student feedback in a warm, natural way.

LANGUAGE RULES:
- After language selection, speak ONLY in that language
- Use simple words (CEFR B1 level)
- Keep sentences short
- Be warm but brief

CONVERSATION FLOW:

1. LANGUAGE - Already selected via buttons

2. CAMPUS - Ask which campus
   Set current_step: "campus"

3. TEACHER - Ask teacher's name  
   Set current_step: "teacher"

4. DURATION - Ask how long studying
   Set current_step: "duration"

5. LEARNING ENVIRONMENT section
   Set current_step: "env"
   
6. ENV FOLLOW-UP - Brief summary (1 sentence max), ask "Anything to add?"
   Set current_step: "env_comment"

7. LEARNING EXPERIENCE section
   Set current_step: "exp"

8. EXP FOLLOW-UP
   Set current_step: "exp_comment"

9. TEACHING QUALITY section
   Set current_step: "teach"

10. TEACH FOLLOW-UP
    Set current_step: "teach_comment"

11. STUDENT SUPPORT section
    Set current_step: "support"

12. SUPPORT FOLLOW-UP
    Set current_step: "support_comment"

13. CLASS MANAGEMENT section
    Set current_step: "mgmt"

14. MGMT FOLLOW-UP
    Set current_step: "mgmt_comment"

15. FINAL - "Any other comments?" 
    Set current_step: "final"

16. THANK YOU - Short thanks, set is_complete: true

STYLE GUIDE:
- Summaries: ONE short sentence only. Example: "Good to hear the classroom works for you."
- Don't repeat what they said back to them
- Don't be overly enthusiastic 
- Sound like a real person, not a robot
- Translate comments to English when storing

BAD: "That's wonderful to hear! It sounds like you're really enjoying the comfortable classroom environment and finding the facilities quite satisfactory!"
GOOD: "Great, thanks. Anything else about the environment?"

BAD: "Thank you so much for sharing that valuable feedback about your learning experience!"  
GOOD: "Thanks. Let's talk about your classes next."

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

const HARDCODED_OPTIONS = {
  campus: {
    type: 'campus',
    options: [
      { label: 'Dubai', value: 'Dubai' },
      { label: 'London', value: 'London' }
    ]
  },
  teacher: {
    type: 'teacher',
    options: [
      { label: 'Richard', value: 'Richard' },
      { label: 'Ryan', value: 'Ryan' },
      { label: 'Majid', value: 'Majid' },
      { label: 'Tom', value: 'Tom' },
      { label: 'Scott', value: 'Scott' },
      { label: 'Gemma', value: 'Gemma' },
      { label: 'Jenna', value: 'Jenna' },
      { label: 'Danya', value: 'Danya' },
      { label: 'Mariam', value: 'Mariam' },
      { label: 'Moe', value: 'Moe' }
    ]
  },
  duration: {
    type: 'duration',
    options: [
      { label: '1-2 weeks', value: '1-2 weeks' },
      { label: '3-4 weeks', value: '3-4 weeks' },
      { label: '1-2 months', value: '1-2 months' },
      { label: '2+ months', value: '2+ months' }
    ]
  }
};

const HARDCODED_SECTIONS = {
  env: {
    section: 'env',
    title: 'Learning Environment',
    questions: [
      { key: 'env_classroom', question: 'How comfortable is your classroom?', options: [
        { label: 'Very comfortable', value: 3 },
        { label: 'Comfortable enough', value: 2 },
        { label: 'Sometimes uncomfortable', value: 1 },
        { label: 'Often uncomfortable', value: 0 }
      ]},
      { key: 'env_facilities', question: 'Are the school facilities good?', options: [
        { label: 'Excellent', value: 3 },
        { label: 'Good', value: 2 },
        { label: 'Adequate', value: 1 },
        { label: 'Poor', value: 0 }
      ]},
      { key: 'env_location', question: 'How convenient is the location?', options: [
        { label: 'Very convenient', value: 3 },
        { label: 'Convenient enough', value: 2 },
        { label: 'Somewhat inconvenient', value: 1 },
        { label: 'Very inconvenient', value: 0 }
      ]},
      { key: 'env_schedule', question: 'Does your class schedule work for you?', options: [
        { label: 'Works perfectly', value: 3 },
        { label: 'Works well', value: 2 },
        { label: 'Some issues', value: 1 },
        { label: "Doesn't work", value: 0 }
      ]}
    ]
  },
  exp: {
    section: 'exp',
    title: 'Learning Experience',
    questions: [
      { key: 'exp_activities', question: 'Are class activities helpful?', options: [
        { label: 'Very helpful', value: 3 },
        { label: 'Helpful', value: 2 },
        { label: 'Somewhat helpful', value: 1 },
        { label: 'Not helpful', value: 0 }
      ]},
      { key: 'exp_homework', question: 'Is the homework right for you?', options: [
        { label: 'Perfect amount', value: 3 },
        { label: 'About right', value: 2 },
        { label: 'Too much/little', value: 1 },
        { label: 'Not appropriate', value: 0 }
      ]},
      { key: 'exp_materials', question: 'Do the materials help you learn?', options: [
        { label: 'Very helpful', value: 3 },
        { label: 'Helpful', value: 2 },
        { label: 'Somewhat helpful', value: 1 },
        { label: 'Not helpful', value: 0 }
      ]},
      { key: 'exp_progress', question: 'How much is your English improving?', options: [
        { label: 'A lot', value: 3 },
        { label: 'Some improvement', value: 2 },
        { label: 'A little', value: 1 },
        { label: 'Not improving', value: 0 }
      ]}
    ]
  },
  teach: {
    section: 'teach',
    title: 'Teaching Quality',
    questions: [
      { key: 'teach_explanations', question: 'Are explanations clear?', options: [
        { label: 'Very clear', value: 3 },
        { label: 'Clear', value: 2 },
        { label: 'Sometimes unclear', value: 1 },
        { label: 'Often unclear', value: 0 }
      ]},
      { key: 'teach_preparation', question: 'Is the teacher prepared?', options: [
        { label: 'Always prepared', value: 3 },
        { label: 'Usually prepared', value: 2 },
        { label: 'Sometimes unprepared', value: 1 },
        { label: 'Often unprepared', value: 0 }
      ]},
      { key: 'teach_methods', question: 'Are teaching methods effective?', options: [
        { label: 'Very effective', value: 3 },
        { label: 'Effective', value: 2 },
        { label: 'Somewhat effective', value: 1 },
        { label: 'Not effective', value: 0 }
      ]},
      { key: 'teach_speaking', question: 'Do you get speaking practice?', options: [
        { label: 'Plenty', value: 3 },
        { label: 'Enough', value: 2 },
        { label: 'Not enough', value: 1 },
        { label: 'Very little', value: 0 }
      ]}
    ]
  },
  support: {
    section: 'support',
    title: 'Student Support',
    questions: [
      { key: 'support_help', question: 'Do you get help when needed?', options: [
        { label: 'Always', value: 3 },
        { label: 'Usually', value: 2 },
        { label: 'Sometimes', value: 1 },
        { label: 'Rarely', value: 0 }
      ]},
      { key: 'support_feedback', question: 'Is feedback on your work helpful?', options: [
        { label: 'Very helpful', value: 3 },
        { label: 'Helpful', value: 2 },
        { label: 'Somewhat helpful', value: 1 },
        { label: 'Not helpful', value: 0 }
      ]},
      { key: 'support_encouragement', question: 'Does the teacher encourage you?', options: [
        { label: 'Very encouraging', value: 3 },
        { label: 'Encouraging', value: 2 },
        { label: 'Somewhat', value: 1 },
        { label: 'Not encouraging', value: 0 }
      ]},
      { key: 'support_atmosphere', question: 'Is the learning atmosphere good?', options: [
        { label: 'Excellent', value: 3 },
        { label: 'Good', value: 2 },
        { label: 'Okay', value: 1 },
        { label: 'Poor', value: 0 }
      ]}
    ]
  },
  mgmt: {
    section: 'mgmt',
    title: 'Class Management',
    questions: [
      { key: 'mgmt_timing', question: 'Is class time managed well?', options: [
        { label: 'Very well', value: 3 },
        { label: 'Well', value: 2 },
        { label: 'Could be better', value: 1 },
        { label: 'Poorly', value: 0 }
      ]},
      { key: 'mgmt_fairness', question: 'Does everyone get equal attention?', options: [
        { label: 'Yes, always', value: 3 },
        { label: 'Usually', value: 2 },
        { label: 'Sometimes', value: 1 },
        { label: 'No', value: 0 }
      ]},
      { key: 'mgmt_organization', question: 'Are lessons well organized?', options: [
        { label: 'Very organized', value: 3 },
        { label: 'Organized', value: 2 },
        { label: 'Somewhat', value: 1 },
        { label: 'Disorganized', value: 0 }
      ]},
      { key: 'mgmt_rules', question: 'Are classroom rules clear and fair?', options: [
        { label: 'Very clear & fair', value: 3 },
        { label: 'Clear & fair', value: 2 },
        { label: 'Somewhat', value: 1 },
        { label: 'Unclear/unfair', value: 0 }
      ]}
    ]
  }
};

const LANGUAGES = [
  { label: 'English', value: 'English' },
  { label: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', value: 'Arabic' },
  { label: 'EspaÃ±ol', value: 'Spanish' },
  { label: 'ä¸­æ–‡', value: 'Chinese' },
  { label: 'PortuguÃªs', value: 'Portuguese' },
  { label: 'TÃ¼rkÃ§e', value: 'Turkish' },
  { label: 'Ð ÑƒÑÑÐºÐ¸Ð¹', value: 'Russian' },
  { label: 'à¹„à¸—à¸¢', value: 'Thai' },
  { label: 'ÙØ§Ø±Ø³ÛŒ', value: 'Farsi' },
  { label: 'í•œêµ­ì–´', value: 'Korean' },
  { label: 'æ—¥æœ¬èªž', value: 'Japanese' },
  { label: 'Tiáº¿ng Viá»‡t', value: 'Vietnamese' },
  { label: 'FranÃ§ais', value: 'French' },
  { label: 'Deutsch', value: 'German' },
  { label: 'Italiano', value: 'Italian' },
  { label: 'Other...', value: 'OTHER' }
];

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

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

  console.log('=== FINAL DATA FOR SHEET ===', rowData);

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
      form.style.display = 'none';
      form.acceptCharset = 'UTF-8';

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

      setTimeout(() => {
        if (form.parentNode) form.parentNode.removeChild(form);
      }, 1000);

      console.log('Data sent to Google Sheet');
    } catch (error) {
      console.error('Error saving to Google Sheet:', error);
    }
  }
};

function FeedbackChatV2() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [collectedData, setCollectedData] = useState({});
  const [currentStep, setCurrentStep] = useState('language');
  const [buttonOptions, setButtonOptions] = useState(null);
  const [sectionQuestions, setSectionQuestions] = useState(null);
  const [sectionAnswers, setSectionAnswers] = useState({});
  const [customLangMode, setCustomLangMode] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sectionQuestions]);

  useEffect(() => {
    setMessages([{ type: 'bot', text: "Hi! ðŸ‘‹ Please choose your language." }]);
  }, []);

  const parseResponse = (text) => {
    const jsonMatch = text.match(/\|\|\|JSON\|\|\|([\s\S]*?)\|\|\|END\|\|\|/);
    let displayText = text.replace(/\|\|\|JSON\|\|\|[\s\S]*?\|\|\|END\|\|\|/, '').trim();
    let data = null;
    if (jsonMatch) {
      try {
        data = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }
    return { displayText, data };
  };

  const callClaude = async (conversationHistory) => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: conversationHistory
      })
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.content[0].text;
  };

  const startAfterLanguage = async (language) => {
    setIsLoading(true);
    setCollectedData({ language });
    setCurrentStep('campus');
    try {
      const response = await callClaude([{ role: 'user', content: `I want to give feedback in ${language}. Let's start.` }]);
      const { displayText, data } = parseResponse(response);
      setMessages(prev => [...prev, { type: 'bot', text: displayText }]);
      if (data) {
        setCollectedData(prev => ({ ...prev, ...data }));
        
        // Use hardcoded options if Claude doesn't provide them
        if (data.button_options && data.button_options.options) {
          setButtonOptions(data.button_options);
        } else if (HARDCODED_OPTIONS[data.current_step]) {
          setButtonOptions(HARDCODED_OPTIONS[data.current_step]);
        } else if (HARDCODED_OPTIONS['campus']) {
          // Default to campus options after language selection
          setButtonOptions(HARDCODED_OPTIONS['campus']);
        }
        
        if (data.current_step) setCurrentStep(data.current_step);
      } else {
        // Fallback - show campus options
        setButtonOptions(HARDCODED_OPTIONS['campus']);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { type: 'bot', text: "Let's start! Which campus do you study at?" }]);
      setButtonOptions(HARDCODED_OPTIONS['campus']);
    }
    setIsLoading(false);
  };

  const sendMessage = async (userMessage) => {
    const newMessages = [...messages, { type: 'user', text: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);
    setButtonOptions(null);
    setSectionQuestions(null);

    try {
      const conversationHistory = newMessages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));
      const response = await callClaude(conversationHistory);
      const { displayText, data } = parseResponse(response);
      setMessages([...newMessages, { type: 'bot', text: displayText }]);

      if (data) {
        setCollectedData(prev => ({ ...prev, ...data }));
        if (data.current_step) setCurrentStep(data.current_step);
        
        // Use hardcoded options if Claude doesn't provide them
        if (data.button_options && data.button_options.options) {
          setButtonOptions(data.button_options);
        } else if (HARDCODED_OPTIONS[data.current_step]) {
          setButtonOptions(HARDCODED_OPTIONS[data.current_step]);
        } else {
          setButtonOptions(null);
        }
        
        // Use hardcoded sections if Claude doesn't provide them
        if (data.section_questions && data.section_questions.questions) {
          setSectionQuestions(data.section_questions);
          setSectionAnswers({});
        } else if (HARDCODED_SECTIONS[data.current_step]) {
          setSectionQuestions(HARDCODED_SECTIONS[data.current_step]);
          setSectionAnswers({});
        }
        
        if (data.is_complete) {
          setIsComplete(true);
          saveToGoogleSheet({ ...collectedData, ...data });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages([...newMessages, { type: 'bot', text: "Sorry, could you try again?" }]);
    }
    setIsLoading(false);
  };

  const handleLanguageSelect = (language) => {
    if (language === 'OTHER') {
      setCustomLangMode(true);
      return;
    }
    if (isLoading) return;
    setMessages(prev => [...prev, { type: 'user', text: language }]);
    setCurrentStep('starting');
    startAfterLanguage(language);
  };

  const handleSectionSubmit = () => {
    const answerText = sectionQuestions.questions.map(q => {
      const opt = q.options.find(o => o.value === sectionAnswers[q.key]);
      return `${q.question}: ${opt?.label || 'N/A'}`;
    }).join('\n');
    
    // Store the numeric values in collectedData
    const sectionData = {};
    sectionQuestions.questions.forEach(q => {
      sectionData[q.key] = sectionAnswers[q.key];
    });
    setCollectedData(prev => ({ ...prev, ...sectionData }));
    
    sendMessage(answerText);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      if (currentStep === 'language' && customLangMode) {
        handleLanguageSelect(inputValue.trim());
        setCustomLangMode(false);
      } else {
        sendMessage(inputValue.trim());
      }
      setInputValue('');
    }
  };

  const allAnswered = sectionQuestions?.questions.every(q => sectionAnswers[q.key] !== undefined);

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
    headerTitle: {
      margin: 0,
      fontSize: '16px',
      fontWeight: '600'
    },
    headerSubtitle: {
      margin: 0,
      fontSize: '12px',
      opacity: 0.8
    },
    messagesContainer: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    messageRow: (isUser) => ({
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start'
    }),
    messageBubble: (isUser) => ({
      maxWidth: '85%',
      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
      padding: '10px 14px',
      fontSize: '14px',
      whiteSpace: 'pre-line',
      backgroundColor: isUser ? '#f97316' : 'white',
      color: isUser ? 'white' : '#1f2937',
      boxShadow: isUser ? 'none' : '0 1px 2px rgba(0,0,0,0.1)'
    }),
    sectionCard: {
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    sectionTitle: {
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: '12px',
      fontSize: '15px'
    },
    questionBlock: {
      marginBottom: '16px'
    },
    questionText: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '8px'
    },
    optionsGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '6px'
    },
    optionButton: (isSelected, value) => ({
      fontSize: '12px',
      padding: '8px',
      borderRadius: '8px',
      border: '1px solid',
      cursor: 'pointer',
      transition: 'all 0.15s',
      backgroundColor: isSelected
        ? (value >= 2 ? '#dcfce7' : '#fef3c7')
        : '#f9fafb',
      borderColor: isSelected
        ? (value >= 2 ? '#86efac' : '#fcd34d')
        : '#e5e7eb',
      color: isSelected
        ? (value >= 2 ? '#166534' : '#92400e')
        : '#374151'
    }),
    submitButton: (enabled) => ({
      width: '100%',
      marginTop: '12px',
      padding: '10px',
      borderRadius: '12px',
      border: 'none',
      fontWeight: '500',
      cursor: enabled ? 'pointer' : 'default',
      backgroundColor: enabled ? '#f97316' : '#f3f4f6',
      color: enabled ? 'white' : '#9ca3af'
    }),
    typingIndicator: {
      display: 'flex',
      justifyContent: 'flex-start'
    },
    typingBubble: {
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '12px 16px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      display: 'flex',
      gap: '4px'
    },
    typingDot: (delay) => ({
      width: '8px',
      height: '8px',
      backgroundColor: '#9ca3af',
      borderRadius: '50%',
      animation: 'bounce 1.4s infinite ease-in-out',
      animationDelay: delay
    }),
    inputArea: {
      padding: '12px',
      backgroundColor: '#f9fafb',
      borderTop: '1px solid #e5e7eb'
    },
    completedText: {
      textAlign: 'center',
      color: '#6b7280',
      fontSize: '14px'
    },
    languageGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '8px',
      marginBottom: '8px'
    },
    languageButton: {
      padding: '8px 12px',
      borderRadius: '12px',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.15s'
    },
    customLangLink: {
      width: '100%',
      padding: '8px',
      fontSize: '14px',
      color: '#6b7280',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    },
    customLangInput: {
      display: 'flex',
      gap: '8px'
    },
    textInput: {
      flex: 1,
      padding: '8px 12px',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      fontSize: '14px',
      outline: 'none'
    },
    goButton: (enabled) => ({
      padding: '8px 16px',
      backgroundColor: enabled ? '#f97316' : '#e5e7eb',
      color: enabled ? 'white' : '#9ca3af',
      border: 'none',
      borderRadius: '12px',
      fontSize: '14px',
      cursor: enabled ? 'pointer' : 'default'
    }),
    buttonOptionsGrid: (isTeacher) => ({
      display: 'grid',
      gridTemplateColumns: isTeacher ? '1fr 1fr' : '1fr',
      gap: '8px'
    }),
    optionBtn: {
      padding: '12px 16px',
      borderRadius: '12px',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.15s'
    },
    inputRow: {
      display: 'flex',
      gap: '8px'
    },
    sendButton: (enabled) => ({
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: enabled ? '#f97316' : '#e5e7eb',
      color: 'white',
      border: 'none',
      cursor: enabled ? 'pointer' : 'default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }),
    skipButton: {
      width: '100%',
      marginTop: '8px',
      padding: '8px',
      fontSize: '14px',
      color: '#6b7280',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxWidth: '448px',
      margin: '0 auto',
      backgroundColor: '#f3f4f6',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
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
          <h1 style={styles.headerTitle}>ES Feedback</h1>
          <p style={styles.headerSubtitle}>Tell us about your experience</p>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.map((msg, idx) => (
          <div key={idx} style={styles.messageRow(msg.type === 'user')}>
            <div style={styles.messageBubble(msg.type === 'user')}>{msg.text}</div>
          </div>
        ))}

        {/* Section Questions Card */}
        {sectionQuestions && (
          <div style={styles.sectionCard}>
            <h3 style={styles.sectionTitle}>{sectionQuestions.title}</h3>
            {sectionQuestions.questions.map(q => (
              <div key={q.key} style={styles.questionBlock}>
                <p style={styles.questionText}>{q.question}</p>
                <div style={styles.optionsGrid}>
                  {q.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setSectionAnswers(prev => ({ ...prev, [q.key]: opt.value }))}
                      style={styles.optionButton(sectionAnswers[q.key] === opt.value, opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={handleSectionSubmit}
              disabled={!allAnswered}
              style={styles.submitButton(allAnswered)}
            >
              {allAnswered ? 'Continue â†’' : 'Answer all questions'}
            </button>
          </div>
        )}

        {/* Typing Indicator */}
        {isLoading && (
          <div style={styles.typingIndicator}>
            <div style={styles.typingBubble}>
              <span style={styles.typingDot('0ms')} />
              <span style={styles.typingDot('150ms')} />
              <span style={styles.typingDot('300ms')} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={styles.inputArea}>
        {isComplete ? (
          <p style={styles.completedText}>âœ“ Feedback submitted</p>
        ) : currentStep === 'language' ? (
          <>
            <div style={styles.languageGrid}>
              {LANGUAGES.map((lang, i) => (
                <button
                  key={i}
                  onClick={() => handleLanguageSelect(lang.value)}
                  disabled={isLoading}
                  style={{
                    ...styles.languageButton,
                    opacity: isLoading ? 0.5 : 1,
                    cursor: isLoading ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.target.style.backgroundColor = '#f97316';
                      e.target.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'white';
                    e.target.style.color = 'black';
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            {customLangMode && (
              <div style={styles.customLangInput}>
                <input
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your language..."
                  style={styles.textInput}
                  autoFocus
                />
                <button
                  onClick={() => {
                    handleLanguageSelect(inputValue.trim());
                    setInputValue('');
                    setCustomLangMode(false);
                  }}
                  disabled={!inputValue.trim()}
                  style={styles.goButton(!!inputValue.trim())}
                >
                  Go
                </button>
              </div>
            )}
          </>
        ) : buttonOptions && buttonOptions.options ? (
          buttonOptions.type === 'teacher' ? (
            <select
              onChange={(e) => e.target.value && sendMessage(e.target.value)}
              defaultValue=""
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                backgroundColor: isLoading ? '#f3f4f6' : 'white',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="" disabled>Select your teacher...</option>
              {buttonOptions.options.map((opt, i) => (
                <option key={i} value={opt.label}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <div style={styles.buttonOptionsGrid(false)}>
              {buttonOptions.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(opt.label)}
                  disabled={isLoading}
                  style={{
                    ...styles.optionBtn,
                    opacity: isLoading ? 0.5 : 1,
                    cursor: isLoading ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.target.style.backgroundColor = '#f97316';
                      e.target.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'white';
                    e.target.style.color = 'black';
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )
        ) : !sectionQuestions && (
          <>
            <div style={styles.inputRow}>
              <input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your response..."
                style={styles.textInput}
              />
              <button
                onClick={() => {
                  sendMessage(inputValue.trim());
                  setInputValue('');
                }}
                disabled={!inputValue.trim() || isLoading}
                style={styles.sendButton(inputValue.trim() && !isLoading)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => sendMessage("Nothing to add")}
              disabled={isLoading}
              style={styles.skipButton}
            >
              Nothing to add â†’
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default FeedbackChatV2;
