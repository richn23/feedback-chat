import React, { useState, useRef, useEffect } from 'react';

// Simple B1-level prompts for Claude - translation + empathy only
const getClaudePrompt = (step, language, context = {}) => {
  const baseInstruction = `You are a friendly assistant for ES World English school. 
RULES:
- Respond in ${language}
- Use simple words (CEFR B1 level)
- Keep responses to 1-2 short sentences
- Be warm but brief
- Never ask questions - just make a statement or react`;

  const prompts = {
    welcome: `${baseInstruction}
Say a brief welcome and tell them to choose their campus (Dubai or London).`,
    
    campus_selected: `${baseInstruction}
They chose ${context.campus}. React briefly and ask for their teacher's name.`,
    
    teacher_selected: `${baseInstruction}
Their teacher is ${context.teacher}. React briefly and ask how long they have been studying.`,
    
    duration_selected: `${baseInstruction}
They have been studying for ${context.duration}. React briefly and say "Now some questions about the classroom and school."`,
    
    env_intro: `${baseInstruction}
Introduce the environment section. Say something like "Let's talk about your classroom and the school."`,
    
    env_done: `${baseInstruction}
They rated the environment. Their scores: classroom=${context.env_classroom}/3, facilities=${context.env_facilities}/3, location=${context.env_location}/3, schedule=${context.env_schedule}/3.
React briefly based on scores (if low, show understanding; if high, show happiness). Then ask if they want to add anything.`,
    
    env_comment_done: `${baseInstruction}
${context.comment ? `They said: "${context.comment}"` : 'They had nothing to add.'}
React briefly with empathy if they shared something. Then say "Now about your learning experience."`,
    
    exp_done: `${baseInstruction}
They rated learning experience. Scores: activities=${context.exp_activities}/3, homework=${context.exp_homework}/3, materials=${context.exp_materials}/3, progress=${context.exp_progress}/3.
React briefly based on scores. Ask if they want to add anything.`,
    
    exp_comment_done: `${baseInstruction}
${context.comment ? `They said: "${context.comment}"` : 'They had nothing to add.'}
React briefly. Then say "Now about your teacher's teaching."`,
    
    teach_done: `${baseInstruction}
They rated teaching. Scores: explanations=${context.teach_explanations}/3, preparation=${context.teach_preparation}/3, methods=${context.teach_methods}/3, speaking=${context.teach_speaking}/3.
React briefly based on scores. Ask if they want to add anything.`,
    
    teach_comment_done: `${baseInstruction}
${context.comment ? `They said: "${context.comment}"` : 'They had nothing to add.'}
React briefly. Then say "Now about help and support."`,
    
    support_done: `${baseInstruction}
They rated support. Scores: help=${context.support_help}/3, feedback=${context.support_feedback}/3, encouragement=${context.support_encouragement}/3, atmosphere=${context.support_atmosphere}/3.
React briefly based on scores. Ask if they want to add anything.`,
    
    support_comment_done: `${baseInstruction}
${context.comment ? `They said: "${context.comment}"` : 'They had nothing to add.'}
React briefly. Then say "Last section - about how the class is organized."`,
    
    mgmt_done: `${baseInstruction}
They rated class management. Scores: timing=${context.mgmt_timing}/3, fairness=${context.mgmt_fairness}/3, organization=${context.mgmt_organization}/3, rules=${context.mgmt_rules}/3.
React briefly based on scores. Ask if they want to add anything.`,
    
    mgmt_comment_done: `${baseInstruction}
${context.comment ? `They said: "${context.comment}"` : 'They had nothing to add.'}
React briefly. Then ask "Any other comments or ideas for us?"`,
    
    final_done: `${baseInstruction}
${context.comment ? `Their final comment: "${context.comment}"` : 'They had no final comments.'}
Thank them warmly for their feedback. Tell them it helps the school. Keep it short and friendly.`,
  };

  return prompts[step] || prompts.welcome;
};

// Translate comment to English for storage
const getTranslationPrompt = (comment, fromLanguage) => {
  if (fromLanguage === 'English') return null;
  return `Translate this student feedback from ${fromLanguage} to English. Only respond with the translation, nothing else.

"${comment}"`;
};

// Hardcoded options
const CAMPUS_OPTIONS = [
  { label: 'Dubai', value: 'Dubai' },
  { label: 'London', value: 'London' }
];

const TEACHER_OPTIONS = [
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
];

const DURATION_OPTIONS = [
  { label: '1-2 weeks', value: '1-2 weeks' },
  { label: '3-4 weeks', value: '3-4 weeks' },
  { label: '1-2 months', value: '1-2 months' },
  { label: '2+ months', value: '2+ months' }
];

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

// Section definitions
const SECTIONS = {
  env: {
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
      { key: 'env_location', question: 'Is the location convenient?', options: [
        { label: 'Very convenient', value: 3 },
        { label: 'Convenient enough', value: 2 },
        { label: 'A bit inconvenient', value: 1 },
        { label: 'Very inconvenient', value: 0 }
      ]},
      { key: 'env_schedule', question: 'Does your class schedule work for you?', options: [
        { label: 'Works perfectly', value: 3 },
        { label: 'Works well', value: 2 },
        { label: 'Some problems', value: 1 },
        { label: 'Does not work', value: 0 }
      ]}
    ]
  },
  exp: {
    title: 'Learning Experience',
    questions: [
      { key: 'exp_activities', question: 'Are class activities helpful?', options: [
        { label: 'Very helpful', value: 3 },
        { label: 'Helpful', value: 2 },
        { label: 'A little helpful', value: 1 },
        { label: 'Not helpful', value: 0 }
      ]},
      { key: 'exp_homework', question: 'Is the homework right for you?', options: [
        { label: 'Perfect amount', value: 3 },
        { label: 'About right', value: 2 },
        { label: 'Too much or too little', value: 1 },
        { label: 'Not good', value: 0 }
      ]},
      { key: 'exp_materials', question: 'Do the materials help you learn?', options: [
        { label: 'Very helpful', value: 3 },
        { label: 'Helpful', value: 2 },
        { label: 'A little helpful', value: 1 },
        { label: 'Not helpful', value: 0 }
      ]},
      { key: 'exp_progress', question: 'Is your English getting better?', options: [
        { label: 'A lot better', value: 3 },
        { label: 'Better', value: 2 },
        { label: 'A little better', value: 1 },
        { label: 'Not better', value: 0 }
      ]}
    ]
  },
  teach: {
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
        { label: 'Sometimes not prepared', value: 1 },
        { label: 'Often not prepared', value: 0 }
      ]},
      { key: 'teach_methods', question: 'Do the teaching methods work?', options: [
        { label: 'Very well', value: 3 },
        { label: 'Well', value: 2 },
        { label: 'A little', value: 1 },
        { label: 'Not well', value: 0 }
      ]},
      { key: 'teach_speaking', question: 'Do you get enough speaking practice?', options: [
        { label: 'Plenty', value: 3 },
        { label: 'Enough', value: 2 },
        { label: 'Not enough', value: 1 },
        { label: 'Very little', value: 0 }
      ]}
    ]
  },
  support: {
    title: 'Student Support',
    questions: [
      { key: 'support_help', question: 'Do you get help when you need it?', options: [
        { label: 'Always', value: 3 },
        { label: 'Usually', value: 2 },
        { label: 'Sometimes', value: 1 },
        { label: 'Rarely', value: 0 }
      ]},
      { key: 'support_feedback', question: 'Is feedback on your work helpful?', options: [
        { label: 'Very helpful', value: 3 },
        { label: 'Helpful', value: 2 },
        { label: 'A little helpful', value: 1 },
        { label: 'Not helpful', value: 0 }
      ]},
      { key: 'support_encouragement', question: 'Does the teacher encourage you?', options: [
        { label: 'Very much', value: 3 },
        { label: 'Yes', value: 2 },
        { label: 'A little', value: 1 },
        { label: 'No', value: 0 }
      ]},
      { key: 'support_atmosphere', question: 'Is the class atmosphere good?', options: [
        { label: 'Excellent', value: 3 },
        { label: 'Good', value: 2 },
        { label: 'Okay', value: 1 },
        { label: 'Not good', value: 0 }
      ]}
    ]
  },
  mgmt: {
    title: 'Class Management',
    questions: [
      { key: 'mgmt_timing', question: 'Is class time used well?', options: [
        { label: 'Very well', value: 3 },
        { label: 'Well', value: 2 },
        { label: 'Could be better', value: 1 },
        { label: 'Not well', value: 0 }
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
        { label: 'A bit messy', value: 1 },
        { label: 'Disorganized', value: 0 }
      ]},
      { key: 'mgmt_rules', question: 'Are class rules clear and fair?', options: [
        { label: 'Very clear and fair', value: 3 },
        { label: 'Clear and fair', value: 2 },
        { label: 'Somewhat', value: 1 },
        { label: 'Not clear or fair', value: 0 }
      ]}
    ]
  }
};

// Steps enum
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

// Step flow
const STEP_ORDER = [
  STEPS.LANGUAGE,
  STEPS.CAMPUS,
  STEPS.TEACHER,
  STEPS.DURATION,
  STEPS.ENV_SECTION,
  STEPS.ENV_COMMENT,
  STEPS.EXP_SECTION,
  STEPS.EXP_COMMENT,
  STEPS.TEACH_SECTION,
  STEPS.TEACH_COMMENT,
  STEPS.SUPPORT_SECTION,
  STEPS.SUPPORT_COMMENT,
  STEPS.MGMT_SECTION,
  STEPS.MGMT_COMMENT,
  STEPS.FINAL_COMMENT,
  STEPS.COMPLETE
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
    console.error('GOOGLE_SCRIPT_URL not set!');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('data', btoa(unescape(encodeURIComponent(JSON.stringify(rowData)))));
    formData.append('encoding', 'base64');

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: formData
    });
    
    console.log('Data sent to Google Sheet');
  } catch (error) {
    console.error('Error saving:', error);
  }
};

function FeedbackChatV2() {
  const [currentStep, setCurrentStep] = useState(STEPS.LANGUAGE);
  const [messages, setMessages] = useState([{ type: 'bot', text: "Hi! 👋 Please choose your language." }]);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState({});
  const [sectionAnswers, setSectionAnswers] = useState({});
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Call Claude API
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
          max_tokens: 256,
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

  // Translate comment to English
  const translateToEnglish = async (comment, language) => {
    if (!comment || language === 'English') return comment;
    const prompt = getTranslationPrompt(comment, language);
    const translated = await callClaude(prompt);
    return translated || comment;
  };

  // Get Claude response for a step
  const getClaudeResponse = async (step, context = {}) => {
    const prompt = getClaudePrompt(step, data.language || 'English', context);
    const response = await callClaude(prompt);
    return response || getFallbackMessage(step);
  };

  // Fallback messages if Claude fails
  const getFallbackMessage = (step) => {
    const fallbacks = {
      welcome: "Which campus do you study at?",
      campus_selected: "Great! Who is your teacher?",
      teacher_selected: "How long have you been studying with us?",
      duration_selected: "Now some questions about your classroom.",
      env_done: "Thanks! Anything to add?",
      env_comment_done: "Now about your learning experience.",
      exp_done: "Thanks! Anything to add?",
      exp_comment_done: "Now about the teaching.",
      teach_done: "Thanks! Anything to add?",
      teach_comment_done: "Now about help and support.",
      support_done: "Thanks! Anything to add?",
      support_comment_done: "Last section - class management.",
      mgmt_done: "Thanks! Anything to add?",
      mgmt_comment_done: "Any other comments?",
      final_done: "Thank you for your feedback! It helps us a lot."
    };
    return fallbacks[step] || "Thank you!";
  };

  // Move to next step
  const goToNextStep = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentIndex + 1]);
    }
  };

  // Handle language selection
  const handleLanguageSelect = async (language) => {
    setData({ language });
    setIsLoading(true);
    
    const response = await getClaudeResponse('welcome', {});
    setMessages(prev => [...prev, { type: 'bot', text: response }]);
    
    setIsLoading(false);
    setCurrentStep(STEPS.CAMPUS);
  };

  // Handle campus selection
  const handleCampusSelect = async (campus) => {
    setData(prev => ({ ...prev, campus }));
    setIsLoading(true);
    
    const response = await getClaudeResponse('campus_selected', { campus });
    setMessages(prev => [...prev, { type: 'bot', text: response }]);
    
    setIsLoading(false);
    setCurrentStep(STEPS.TEACHER);
  };

  // Handle teacher selection
  const handleTeacherSelect = async (teacher) => {
    setData(prev => ({ ...prev, teacher_name: teacher }));
    setIsLoading(true);
    
    const response = await getClaudeResponse('teacher_selected', { teacher });
    setMessages(prev => [...prev, { type: 'bot', text: response }]);
    
    setIsLoading(false);
    setCurrentStep(STEPS.DURATION);
  };

  // Handle duration selection
  const handleDurationSelect = async (duration) => {
    setData(prev => ({ ...prev, duration }));
    setIsLoading(true);
    
    const response = await getClaudeResponse('duration_selected', { duration });
    setMessages(prev => [...prev, { type: 'bot', text: response }]);
    
    setIsLoading(false);
    setCurrentStep(STEPS.ENV_SECTION);
  };

  // Handle section submit
  const handleSectionSubmit = async (sectionKey) => {
    const sectionData = { ...sectionAnswers };
    setData(prev => ({ ...prev, ...sectionData }));
    setSectionAnswers({});
    setIsLoading(true);

    const promptKey = `${sectionKey}_done`;
    const response = await getClaudeResponse(promptKey, sectionData);
    setMessages(prev => [...prev, { type: 'bot', text: response }]);

    setIsLoading(false);
    goToNextStep();
  };

  // Handle comment submit
  const handleCommentSubmit = async (commentKey, comment) => {
    setIsLoading(true);
    
    // Translate if needed
    const translatedComment = await translateToEnglish(comment, data.language);
    setData(prev => ({ ...prev, [commentKey]: translatedComment }));

    const promptKey = `${commentKey}_done`;
    const response = await getClaudeResponse(promptKey, { comment });
    setMessages(prev => [...prev, { type: 'bot', text: response }]);

    setIsLoading(false);
    
    // If final comment, save and complete
    if (commentKey === 'final_comment') {
      const finalData = { ...data, [commentKey]: translatedComment };
      await saveToGoogleSheet(finalData);
      setCurrentStep(STEPS.COMPLETE);
    } else {
      goToNextStep();
    }
  };

  // Handle skip (no comment)
  const handleSkip = async (commentKey) => {
    await handleCommentSubmit(commentKey, '');
  };

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

  // Get current comment key
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
  const allAnswered = currentSection?.questions.every(q => sectionAnswers[q.key] !== undefined);

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
    sectionCard: {
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    sectionTitle: {
      fontSize: '17px',
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: '16px'
    },
    questionBlock: {
      marginBottom: '20px'
    },
    questionText: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '10px'
    },
    optionsGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px'
    },
    optionButton: (isSelected) => ({
      padding: '10px 12px',
      borderRadius: '10px',
      border: '2px solid',
      borderColor: isSelected ? '#f97316' : '#e5e7eb',
      backgroundColor: isSelected ? '#fff7ed' : 'white',
      color: isSelected ? '#ea580c' : '#374151',
      fontSize: '13px',
      fontWeight: isSelected ? '600' : '400',
      cursor: 'pointer',
      transition: 'all 0.15s'
    }),
    submitButton: (enabled) => ({
      width: '100%',
      marginTop: '8px',
      padding: '14px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: enabled ? '#f97316' : '#e5e7eb',
      color: enabled ? 'white' : '#9ca3af',
      fontSize: '15px',
      fontWeight: '600',
      cursor: enabled ? 'pointer' : 'default'
    }),
    inputArea: {
      padding: '16px',
      backgroundColor: 'white',
      borderTop: '1px solid #e5e7eb'
    },
    languageGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '8px'
    },
    languageButton: {
      padding: '10px 8px',
      borderRadius: '10px',
      border: '1px solid #e5e7eb',
      backgroundColor: 'white',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.15s'
    },
    buttonGrid: (columns) => ({
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: '8px'
    }),
    selectButton: {
      padding: '12px 16px',
      borderRadius: '10px',
      border: '1px solid #e5e7eb',
      backgroundColor: 'white',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.15s'
    },
    textInput: {
      width: '100%',
      padding: '12px 16px',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      fontSize: '15px',
      marginBottom: '8px',
      outline: 'none'
    },
    row: {
      display: 'flex',
      gap: '8px'
    },
    sendButton: {
      padding: '12px 20px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: '#f97316',
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer'
    },
    skipButton: {
      width: '100%',
      padding: '10px',
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
      width: 'fit-content'
    },
    dot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: '#9ca3af',
      animation: 'bounce 1.4s infinite ease-in-out'
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
          <div key={idx} style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={styles.botMessage}>{msg.text}</div>
          </div>
        ))}

        {/* Section Card */}
        {currentSection && (
          <div style={styles.sectionCard}>
            <h3 style={styles.sectionTitle}>{currentSection.title}</h3>
            {currentSection.questions.map(q => (
              <div key={q.key} style={styles.questionBlock}>
                <p style={styles.questionText}>{q.question}</p>
                <div style={styles.optionsGrid}>
                  {q.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setSectionAnswers(prev => ({ ...prev, [q.key]: opt.value }))}
                      style={styles.optionButton(sectionAnswers[q.key] === opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => handleSectionSubmit(currentSection.key)}
              disabled={!allAnswered}
              style={styles.submitButton(allAnswered)}
            >
              {allAnswered ? 'Continue →' : 'Answer all questions'}
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div style={styles.typingDots}>
            <span style={{ ...styles.dot, animationDelay: '0ms' }} />
            <span style={{ ...styles.dot, animationDelay: '150ms' }} />
            <span style={{ ...styles.dot, animationDelay: '300ms' }} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={styles.inputArea}>
        {/* Language Selection */}
        {currentStep === STEPS.LANGUAGE && (
          <div style={styles.languageGrid}>
            {LANGUAGES.map((lang, i) => (
              <button
                key={i}
                onClick={() => handleLanguageSelect(lang.value)}
                style={styles.languageButton}
                onMouseEnter={e => { e.target.style.backgroundColor = '#f97316'; e.target.style.color = 'white'; }}
                onMouseLeave={e => { e.target.style.backgroundColor = 'white'; e.target.style.color = 'black'; }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        )}

        {/* Campus Selection */}
        {currentStep === STEPS.CAMPUS && !isLoading && (
          <div style={styles.buttonGrid(2)}>
            {CAMPUS_OPTIONS.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleCampusSelect(opt.value)}
                style={styles.selectButton}
                onMouseEnter={e => { e.target.style.backgroundColor = '#f97316'; e.target.style.color = 'white'; }}
                onMouseLeave={e => { e.target.style.backgroundColor = 'white'; e.target.style.color = 'black'; }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Teacher Selection */}
        {currentStep === STEPS.TEACHER && !isLoading && (
          <div style={styles.buttonGrid(2)}>
            {TEACHER_OPTIONS.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleTeacherSelect(opt.value)}
                style={styles.selectButton}
                onMouseEnter={e => { e.target.style.backgroundColor = '#f97316'; e.target.style.color = 'white'; }}
                onMouseLeave={e => { e.target.style.backgroundColor = 'white'; e.target.style.color = 'black'; }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Duration Selection */}
        {currentStep === STEPS.DURATION && !isLoading && (
          <div style={styles.buttonGrid(2)}>
            {DURATION_OPTIONS.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleDurationSelect(opt.value)}
                style={styles.selectButton}
                onMouseEnter={e => { e.target.style.backgroundColor = '#f97316'; e.target.style.color = 'white'; }}
                onMouseLeave={e => { e.target.style.backgroundColor = 'white'; e.target.style.color = 'black'; }}
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
            <div style={styles.row}>
              <button
                onClick={() => {
                  if (inputValue.trim()) {
                    handleCommentSubmit(commentKey, inputValue.trim());
                    setInputValue('');
                  }
                }}
                style={{ ...styles.sendButton, flex: 1, opacity: inputValue.trim() ? 1 : 0.5 }}
                disabled={!inputValue.trim()}
              >
                Send
              </button>
            </div>
            <button
              onClick={() => handleSkip(commentKey)}
              style={styles.skipButton}
            >
              Nothing to add →
            </button>
          </>
        )}

        {/* Complete */}
        {currentStep === STEPS.COMPLETE && (
          <div style={styles.complete}>
            ✓ Feedback submitted
          </div>
        )}
      </div>
    </div>
  );
}

export default FeedbackChatV2;
