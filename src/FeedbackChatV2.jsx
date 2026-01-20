import React, { useState, useRef, useEffect } from 'react';

const SYSTEM_PROMPT = `You are a friendly feedback assistant for ES World English school (Dubai and London). Collect student feedback in a warm, natural way.

LANGUAGE RULES:
- After language selection, speak ONLY in that language
- Use simple words (CEFR B1 level)
- Keep sentences short
- Be warm but brief

CONVERSATION FLOW:

1. LANGUAGE - Already selected via buttons or typed by user

2. CAMPUS - Ask which campus
   Set current_step: "campus"

3. TEACHER - Ask teacher's name  
   Set current_step: "teacher"

4. DURATION - Ask how long studying
   Set current_step: "duration"

5. LEARNING ENVIRONMENT section
   Say ONLY: "Now let's talk about your learning environment." (or similar short intro)
   Set current_step: "env"
   DO NOT ask for ratings or list questions - the UI shows sliders automatically!
   
6. ENV FOLLOW-UP - Look at their actual ratings and respond naturally
   Set current_step: "env_comment"
   
   IMPORTANT: Your follow-up should be REACTIVE to their specific answers:
   - If they rated something low (0-1), ask about that specifically: "I see the schedule is difficult. What would work better?"
   - If everything is high (2-3), just say: "Great! Anything else about the environment?"
   - Don't list all the topics - focus on what matters based on their ratings

7. LEARNING EXPERIENCE section
   Say ONLY: "Next, your learning experience." (or similar short intro)
   Set current_step: "exp"
   DO NOT ask for ratings - UI handles it!

8. EXP FOLLOW-UP - React to their specific ratings
   Set current_step: "exp_comment"

9. TEACHING QUALITY section
   Say ONLY: "Now about your teacher and classes." (or similar)
   Set current_step: "teach"
   DO NOT ask for ratings!

10. TEACH FOLLOW-UP - React to their specific ratings
    Set current_step: "teach_comment"

11. STUDENT SUPPORT section
    Say ONLY: "How about the support you receive?" (or similar)
    Set current_step: "support"
    DO NOT ask for ratings!

12. SUPPORT FOLLOW-UP - React to their specific ratings
    Set current_step: "support_comment"

13. CLASS MANAGEMENT section
    Say ONLY: "Finally, about how classes are managed." (or similar)
    Set current_step: "mgmt"
    DO NOT ask for ratings!

14. MGMT FOLLOW-UP - React to their specific ratings
    Set current_step: "mgmt_comment"

15. FINAL - "Any other comments?" 
    Set current_step: "final"

16. THANK YOU - Short thanks, set is_complete: true

CRITICAL RULES FOR SECTION INTROS (env, exp, teach, support, mgmt):
- Say ONE short sentence to introduce the topic
- DO NOT list questions
- DO NOT ask them to rate anything
- DO NOT mention numbers or scales
- The UI will automatically show rating sliders - you just introduce the section!

BAD: "Now I'd like to ask about your learning environment. Please rate each from 0-3: Classroom comfort? School facilities?"
GOOD: "Now let's talk about your learning environment."

BAD: "Rate these from 0-3: **Classroom comfort** (space, temperature)..."
GOOD: "Next up - your classroom and facilities."

CRITICAL STYLE RULES FOR FOLLOW-UPS:
- NEVER list the topics (classroom, facilities, location, schedule, etc.)
- NEVER use template phrases
- Keep follow-ups SHORT and SIMPLE (5-10 words max)
- VARY your responses - don't repeat the same phrase twice in a conversation

FOR LOW/MIXED SCORES, vary between these styles:
- "What are the main issues for you?"
- "What could be better?"
- "Tell me more about that."
- "What's not working?"
- "Anything specific?"
- "What would help?"

FOR GOOD SCORES, vary between these styles:
- "Great! Anything to add?"
- "Good to hear. Anything else?"
- "Nice. Anything to add?"
- "Thanks! Anything else?"
- "Okay, moving on..." (if they seem to want to go fast)

IMPORTANT: Pick DIFFERENT phrases each time. Don't use the same follow-up twice.

STYLE GUIDE:
- Sound like a real person, not a survey bot
- ONE short sentence max
- No exclamation marks overuse
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

// Common languages with native labels
const COMMON_LANGUAGES = [
  { label: 'English', value: 'English' },
  { label: 'العربية', value: 'Arabic' },
  { label: 'Español', value: 'Spanish' },
  { label: '中文', value: 'Chinese' },
  { label: 'Português', value: 'Portuguese' },
  { label: 'Türkçe', value: 'Turkish' },
  { label: 'Русский', value: 'Russian' },
  { label: 'ไทย', value: 'Thai' },
  { label: 'فارسی', value: 'Farsi' }
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
  const [showCustomLangInput, setShowCustomLangInput] = useState(false);
  const messagesEndRef = useRef(null);
  const customLangInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sectionQuestions]);

  useEffect(() => {
    setMessages([{ type: 'bot', text: "Hi! 👋 What language would you like to use?" }]);
  }, []);

  // Focus custom language input when shown
  useEffect(() => {
    if (showCustomLangInput && customLangInputRef.current) {
      customLangInputRef.current.focus();
    }
  }, [showCustomLangInput]);

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
        
        if (data.button_options && data.button_options.options) {
          setButtonOptions(data.button_options);
        } else if (HARDCODED_OPTIONS[data.current_step]) {
          setButtonOptions(HARDCODED_OPTIONS[data.current_step]);
        } else if (HARDCODED_OPTIONS['campus']) {
          setButtonOptions(HARDCODED_OPTIONS['campus']);
        }
        
        if (data.current_step) setCurrentStep(data.current_step);
      } else {
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
        
        if (data.button_options && data.button_options.options) {
          setButtonOptions(data.button_options);
        } else if (HARDCODED_OPTIONS[data.current_step]) {
          setButtonOptions(HARDCODED_OPTIONS[data.current_step]);
        } else {
          setButtonOptions(null);
        }
        
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
    setMessages(prev => [...prev, { type: 'user', text: language }]);
    setCurrentStep('starting');
    setShowCustomLangInput(false);
    startAfterLanguage(language);
  };

  const handleSectionSubmit = () => {
    const answerText = sectionQuestions.questions.map(q => {
      const opt = q.options.find(o => o.value === sectionAnswers[q.key]);
      return `${q.question}: ${opt?.label || 'N/A'}`;
    }).join('\n');
    
    const sectionData = {};
    sectionQuestions.questions.forEach(q => {
      sectionData[q.key] = sectionAnswers[q.key];
    });
    setCollectedData(prev => ({ ...prev, ...sectionData }));
    
    sendMessage(answerText);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      if (currentStep === 'language' && showCustomLangInput) {
        handleLanguageSelect(inputValue.trim());
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
      marginTop: '16px',
      padding: '12px',
      borderRadius: '12px',
      border: 'none',
      fontWeight: '500',
      cursor: enabled ? 'pointer' : 'default',
      backgroundColor: enabled ? '#f97316' : '#f3f4f6',
      color: enabled ? 'white' : '#9ca3af'
    }),
    // Slider styles
    sliderContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '8px 0'
    },
    sliderLabels: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '11px',
      color: '#9ca3af'
    },
    sliderLabelLeft: {
      textAlign: 'left'
    },
    sliderLabelRight: {
      textAlign: 'right'
    },
    sliderWrapper: {
      position: 'relative',
      width: '100%',
      height: '24px',
      display: 'flex',
      alignItems: 'center'
    },
    tickMarks: {
      position: 'absolute',
      top: '50%',
      left: '0',
      right: '0',
      transform: 'translateY(-50%)',
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0 2px',
      pointerEvents: 'none',
      zIndex: 0
    },
    tick: {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      border: '2px solid white',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    slider: {
      width: '100%',
      height: '8px',
      borderRadius: '4px',
      appearance: 'none',
      cursor: 'pointer',
      outline: 'none',
      position: 'relative',
      zIndex: 1,
      background: 'transparent'
    },
    sliderValueDisplay: {
      textAlign: 'center',
      minHeight: '20px'
    },
    sliderValueText: {
      fontSize: '13px',
      fontWeight: '500'
    },
    sliderPlaceholder: {
      fontSize: '12px',
      color: '#9ca3af',
      fontStyle: 'italic'
    },
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
    // Language selection styles
    languageSection: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    languageGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '8px'
    },
    languageButton: {
      padding: '10px 8px',
      borderRadius: '10px',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.15s'
    },
    customLangContainer: {
      marginTop: '4px',
      padding: '12px',
      backgroundColor: '#f0f9ff',
      borderRadius: '10px',
      border: '1px solid #bae6fd'
    },
    customLangLabel: {
      fontSize: '13px',
      color: '#0369a1',
      marginBottom: '8px',
      fontWeight: '500'
    },
    customLangInputRow: {
      display: 'flex',
      gap: '8px'
    },
    textInput: {
      flex: 1,
      padding: '10px 12px',
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      fontSize: '14px',
      outline: 'none'
    },
    goButton: (enabled) => ({
      padding: '10px 20px',
      backgroundColor: enabled ? '#f97316' : '#e5e7eb',
      color: enabled ? 'white' : '#9ca3af',
      border: 'none',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: enabled ? 'pointer' : 'default'
    }),
    orDivider: {
      textAlign: 'center',
      color: '#9ca3af',
      fontSize: '12px',
      margin: '8px 0'
    },
    buttonOptionsGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '8px'
    },
    dropdownContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    dropdown: {
      width: '100%',
      padding: '14px 16px',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      fontSize: '16px',
      backgroundColor: 'white',
      color: '#374151',
      cursor: 'pointer',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 16px center',
      outline: 'none'
    },
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
        
        /* Slider thumb styling */
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 8px;
          border-radius: 4px;
        }
        
        /* Active slider - orange thumb */
        input[type="range"].slider-active::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          margin-top: -8px;
        }
        input[type="range"].slider-active::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        
        /* Inactive slider - gray smaller thumb */
        input[type="range"].slider-inactive::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #d1d5db;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          margin-top: -6px;
        }
        input[type="range"].slider-inactive::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #d1d5db;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        
        input[type="range"]::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 4px;
        }
        input[type="range"]::-moz-range-track {
          height: 8px;
          border-radius: 4px;
        }
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
            {sectionQuestions.questions.map(q => {
              const currentValue = sectionAnswers[q.key];
              const hasValue = currentValue !== undefined;
              // Get label for current value
              const currentLabel = hasValue ? q.options.find(o => o.value === currentValue)?.label : null;
              
              return (
                <div key={q.key} style={styles.questionBlock}>
                  <p style={styles.questionText}>{q.question}</p>
                  
                  {/* Slider container */}
                  <div style={styles.sliderContainer}>
                    {/* Labels above slider */}
                    <div style={styles.sliderLabels}>
                      <span style={styles.sliderLabelLeft}>{q.options[q.options.length - 1]?.label}</span>
                      <span style={styles.sliderLabelRight}>{q.options[0]?.label}</span>
                    </div>
                    
                    {/* Slider with tick marks */}
                    <div style={styles.sliderWrapper}>
                      {/* Tick marks */}
                      <div style={styles.tickMarks}>
                        {[0, 1, 2, 3].map(tick => (
                          <div 
                            key={tick} 
                            style={{
                              ...styles.tick,
                              backgroundColor: hasValue && currentValue >= tick ? '#f97316' : '#d1d5db'
                            }}
                          />
                        ))}
                      </div>
                      
                      {/* The slider */}
                      <input
                        type="range"
                        min="0"
                        max="3"
                        step="1"
                        value={hasValue ? currentValue : 1}
                        onChange={(e) => setSectionAnswers(prev => ({ ...prev, [q.key]: parseInt(e.target.value) }))}
                        className={hasValue ? 'slider-active' : 'slider-inactive'}
                        style={{
                          ...styles.slider,
                          background: hasValue 
                            ? `linear-gradient(to right, #f97316 0%, #f97316 ${(currentValue / 3) * 100}%, #e5e7eb ${(currentValue / 3) * 100}%, #e5e7eb 100%)`
                            : '#e5e7eb'
                        }}
                      />
                    </div>
                    
                    {/* Current selection indicator */}
                    <div style={styles.sliderValueDisplay}>
                      {hasValue ? (
                        <span style={{
                          ...styles.sliderValueText,
                          color: currentValue >= 2 ? '#16a34a' : currentValue >= 1 ? '#ca8a04' : '#dc2626'
                        }}>
                          {currentLabel}
                        </span>
                      ) : (
                        <span style={styles.sliderPlaceholder}>Slide to rate</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              onClick={handleSectionSubmit}
              disabled={!allAnswered}
              style={styles.submitButton(allAnswered)}
            >
              {allAnswered ? 'Continue →' : 'Answer all questions'}
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
          <p style={styles.completedText}>✓ Feedback submitted</p>
        ) : currentStep === 'language' ? (
          <div style={styles.languageSection}>
            {/* Common languages grid */}
            <div style={styles.languageGrid}>
              {COMMON_LANGUAGES.map((lang, i) => (
                <button
                  key={i}
                  onClick={() => handleLanguageSelect(lang.value)}
                  style={styles.languageButton}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#f97316';
                    e.target.style.color = 'white';
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
            
            {/* Custom language input - always visible */}
            <div style={styles.customLangContainer}>
              <div style={styles.customLangLabel}>
                🌍 Don't see your language? Type it here:
              </div>
              <div style={styles.customLangInputRow}>
                <input
                  ref={customLangInputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g. Hindi, Korean, Japanese..."
                  style={styles.textInput}
                />
                <button
                  onClick={() => {
                    if (inputValue.trim()) {
                      handleLanguageSelect(inputValue.trim());
                      setInputValue('');
                    }
                  }}
                  disabled={!inputValue.trim()}
                  style={styles.goButton(!!inputValue.trim())}
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        ) : buttonOptions && buttonOptions.options ? (
          buttonOptions.type === 'teacher' ? (
            // Teacher dropdown
            <div style={styles.dropdownContainer}>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    sendMessage(e.target.value);
                  }
                }}
                style={styles.dropdown}
              >
                <option value="" disabled>Select your teacher...</option>
                {buttonOptions.options.map((opt, i) => (
                  <option key={i} value={opt.label}>{opt.label}</option>
                ))}
              </select>
            </div>
          ) : (
            // Regular buttons for campus, duration, etc.
            <div style={styles.buttonOptionsGrid}>
              {buttonOptions.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(opt.label)}
                  style={styles.optionBtn}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#f97316';
                    e.target.style.color = 'white';
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
              style={styles.skipButton}
            >
              Nothing to add →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default FeedbackChatV2;
