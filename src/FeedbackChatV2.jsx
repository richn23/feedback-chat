import { useState, useRef, useEffect } from 'react';

const LANGUAGES = [
  'English', 'العربية', 'Español', '中文', 'Português', 'Türkçe',
  'Русский', 'ไทย', 'فارسی', '한국어', '日本語', 'Tiếng Việt',
  'Français', 'Deutsch', 'Italiano', 'Other...'
];

const TEACHERS = ['Richard', 'Ryan', 'Majid', 'Tom', 'Scott', 'Gemma', 'Jenna', 'Danya', 'Mariam', 'Moe'];

const DURATION_OPTIONS = ['1-2 weeks', '3-4 weeks', '1-2 months', '2+ months'];

const RATING_SECTIONS = {
  env: {
    title: 'Environment',
    questions: [
      { key: 'classroom', en: 'Classroom comfort', options: ['Very comfortable', 'Comfortable enough', 'Sometimes uncomfortable', 'Often uncomfortable'] },
      { key: 'facilities', en: 'Facilities quality', options: ['Excellent', 'Good', 'Adequate', 'Poor'] },
      { key: 'location', en: 'Location convenience', options: ['Very convenient', 'Convenient enough', 'Somewhat inconvenient', 'Very inconvenient'] },
      { key: 'schedule', en: 'Schedule suitability', options: ['Works perfectly', 'Works well', 'Some issues', "Doesn't work"] }
    ]
  },
  exp: {
    title: 'Experience',
    questions: [
      { key: 'activities', en: 'Class activities', options: ['Very engaging', 'Engaging enough', 'Sometimes boring', 'Often boring'] },
      { key: 'homework', en: 'Homework usefulness', options: ['Very useful', 'Useful enough', 'Sometimes useful', 'Not useful'] },
      { key: 'materials', en: 'Learning materials', options: ['Excellent', 'Good', 'Adequate', 'Poor'] },
      { key: 'progress', en: 'Your progress', options: ['Great progress', 'Good progress', 'Some progress', 'Little progress'] }
    ]
  },
  teach: {
    title: 'Teaching',
    questions: [
      { key: 'explanations', en: 'Clear explanations', options: ['Always clear', 'Usually clear', 'Sometimes unclear', 'Often unclear'] },
      { key: 'preparation', en: 'Lesson preparation', options: ['Always prepared', 'Usually prepared', 'Sometimes unprepared', 'Often unprepared'] },
      { key: 'methods', en: 'Teaching methods', options: ['Very effective', 'Effective enough', 'Sometimes ineffective', 'Often ineffective'] },
      { key: 'speaking', en: 'Speaking practice', options: ['Plenty of practice', 'Enough practice', 'Need more practice', 'Very little practice'] }
    ]
  },
  support: {
    title: 'Support',
    questions: [
      { key: 'help', en: 'Help availability', options: ['Always available', 'Usually available', 'Sometimes available', 'Rarely available'] },
      { key: 'feedback', en: 'Feedback quality', options: ['Very helpful', 'Helpful enough', 'Sometimes helpful', 'Not helpful'] },
      { key: 'encouragement', en: 'Encouragement', options: ['Very encouraging', 'Encouraging enough', 'Sometimes encouraging', 'Not encouraging'] },
      { key: 'atmosphere', en: 'Class atmosphere', options: ['Very welcoming', 'Welcoming enough', 'Sometimes unwelcoming', 'Often unwelcoming'] }
    ]
  },
  mgmt: {
    title: 'Management',
    questions: [
      { key: 'timing', en: 'Class timing', options: ['Always on time', 'Usually on time', 'Sometimes late', 'Often late'] },
      { key: 'fairness', en: 'Fairness to all', options: ['Very fair', 'Fair enough', 'Sometimes unfair', 'Often unfair'] },
      { key: 'organization', en: 'Organization', options: ['Very organized', 'Organized enough', 'Sometimes disorganized', 'Often disorganized'] },
      { key: 'rules', en: 'Clear rules', options: ['Very clear', 'Clear enough', 'Sometimes unclear', 'Often unclear'] }
    ]
  }
};

const STEPS = ['language', 'campus', 'teacher', 'duration', 'env', 'env_comment', 'exp', 'exp_comment', 'teach', 'teach_comment', 'support', 'support_comment', 'mgmt', 'mgmt_comment', 'final', 'complete'];

export default function FeedbackChatV2() {
  const [messages, setMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState('language');
  const [loading, setLoading] = useState(false);
  const [feedbackData, setFeedbackData] = useState({
    response_id: 'FB' + Date.now() + Math.random().toString(36).substr(2, 6),
    language: null,
    campus: null,
    teacher_name: null,
    duration: null,
    env_classroom: null, env_facilities: null, env_location: null, env_schedule: null, env_comment: null,
    exp_activities: null, exp_homework: null, exp_materials: null, exp_progress: null, exp_comment: null,
    teach_explanations: null, teach_preparation: null, teach_methods: null, teach_speaking: null, teach_comment: null,
    support_help: null, support_feedback: null, support_encouragement: null, support_atmosphere: null, support_comment: null,
    mgmt_timing: null, mgmt_fairness: null, mgmt_organization: null, mgmt_rules: null, mgmt_comment: null,
    final_comment: null,
    is_complete: false
  });
  const [customLanguage, setCustomLanguage] = useState('');
  const [showCustomLanguage, setShowCustomLanguage] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [translatedUI, setTranslatedUI] = useState(null);
  const [currentRatings, setCurrentRatings] = useState({});
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Initial greeting
    addBotMessage("Welcome to ES World! Please choose your language. 🌍");
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (currentStep.endsWith('_comment') || currentStep === 'final') {
      inputRef.current?.focus();
    }
  }, [currentStep]);

  const addBotMessage = (text, ui = null) => {
    setMessages(prev => [...prev, { role: 'bot', text, ui }]);
  };

  const addUserMessage = (text) => {
    setMessages(prev => [...prev, { role: 'user', text }]);
  };

  const callClaude = async (prompt, systemPrompt) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    return data.content[0].text;
  };

  const translateUI = async (language, retryCount = 0) => {
    setLoading(true);
    try {
      const uiElements = {
        campusQuestion: "Which campus do you study at?",
        dubai: "Dubai",
        london: "London",
        teacherQuestion: "Who is your teacher?",
        selectTeacher: "Select your teacher",
        durationQuestion: "How long have you been studying with us?",
        durations: DURATION_OPTIONS,
        ratingInstructions: "Please rate each aspect:",
        commentPrompt: "Would you like to add anything about this?",
        nothingToAdd: "Nothing to add",
        submit: "Submit",
        finalQuestion: "Any other feedback you'd like to share?",
        thankYou: "Thank you for your feedback! Your responses have been saved.",
        feedbackSent: "Feedback sent",
        translationFailed: "Could not translate. Continuing in English.",
        sections: {}
      };

      // Add rating sections
      for (const [key, section] of Object.entries(RATING_SECTIONS)) {
        uiElements.sections[key] = {
          title: section.title,
          questions: section.questions.map(q => ({
            label: q.en,
            options: q.options
          }))
        };
      }

      const prompt = `Translate this UI to ${language}. Keep it simple (B1 level). Return ONLY valid JSON, no markdown, no explanation, no code blocks:
${JSON.stringify(uiElements)}`;

      const result = await callClaude(prompt, `You are a translator. Translate to ${language}. Return ONLY the raw JSON object. No markdown code blocks, no backticks, no explanation.`);
      
      // Clean the response - remove any markdown, whitespace, or extra text
      let cleanResult = result.trim();
      
      // Remove markdown code blocks if present
      if (cleanResult.startsWith('```')) {
        cleanResult = cleanResult.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
      }
      
      // Find the JSON object - look for first { and last }
      const firstBrace = cleanResult.indexOf('{');
      const lastBrace = cleanResult.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanResult = cleanResult.slice(firstBrace, lastBrace + 1);
      }
      
      const translated = JSON.parse(cleanResult);
      setTranslatedUI(translated);
      return translated;
    } catch (error) {
      console.error('Translation error:', error);
      
      // Retry once if first attempt failed
      if (retryCount < 1) {
        console.log('Retrying translation...');
        return translateUI(language, retryCount + 1);
      }
      
      // Show user-friendly message on failure
      addBotMessage("⚠️ Could not translate. Continuing in English.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateBotResponse = async (context, language) => {
    setLoading(true);
    try {
      const result = await callClaude(
        context,
        `You are a friendly feedback assistant for ES World language school. Respond in ${language}. Keep responses SHORT (1 sentence max). Be warm but brief. Use simple language (B1 level). Never be overly enthusiastic.`
      );
      return result;
    } catch (error) {
      console.error('Response error:', error);
      return language === 'English' ? "Thanks! Let's continue." : "👍";
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageSelect = async (lang) => {
    if (lang === 'Other...') {
      setShowCustomLanguage(true);
      return;
    }
    
    setLoading(true);
    addUserMessage(lang);
    
    const newData = { ...feedbackData, language: lang };
    setFeedbackData(newData);
    
    if (lang !== 'English') {
      await translateUI(lang);
    }
    
    const response = await generateBotResponse(`User selected ${lang} as their language. Ask which campus they study at.`, lang);
    addBotMessage(response);
    setCurrentStep('campus');
    setLoading(false);
  };

  const handleCustomLanguageSubmit = async () => {
    if (!customLanguage.trim()) return;
    
    const lang = customLanguage.trim();
    setShowCustomLanguage(false);
    setLoading(true);
    addUserMessage(lang);
    
    const newData = { ...feedbackData, language: lang };
    setFeedbackData(newData);
    
    await translateUI(lang);
    
    const response = await generateBotResponse(`User selected ${lang} as their language. Ask which campus they study at.`, lang);
    addBotMessage(response);
    setCurrentStep('campus');
    setCustomLanguage('');
    setLoading(false);
  };

  const handleCampusSelect = async (campus) => {
    addUserMessage(campus);
    const newData = { ...feedbackData, campus };
    setFeedbackData(newData);
    
    const response = await generateBotResponse(`User studies at ${campus} campus. Ask who their teacher is.`, feedbackData.language);
    addBotMessage(response);
    setCurrentStep('teacher');
  };

  const handleTeacherSelect = async (teacher) => {
    if (!teacher) return;
    addUserMessage(teacher);
    const newData = { ...feedbackData, teacher_name: teacher };
    setFeedbackData(newData);
    
    const response = await generateBotResponse(`User's teacher is ${teacher}. Ask how long they've been studying.`, feedbackData.language);
    addBotMessage(response);
    setCurrentStep('duration');
  };

  const handleDurationSelect = async (duration) => {
    addUserMessage(duration);
    const newData = { ...feedbackData, duration };
    setFeedbackData(newData);
    
    const response = await generateBotResponse(`User has been studying for ${duration}. Now ask them to rate the classroom environment.`, feedbackData.language);
    addBotMessage(response);
    setCurrentStep('env');
    setCurrentRatings({});
  };

  const handleRatingChange = (questionKey, value) => {
    setCurrentRatings(prev => ({ ...prev, [questionKey]: value }));
  };

  const handleRatingsSubmit = async (section) => {
    // Check all questions are answered
    const sectionQuestions = RATING_SECTIONS[section].questions;
    const allAnswered = sectionQuestions.every(q => currentRatings[q.key] !== undefined);
    
    if (!allAnswered) {
      return; // Don't submit if not all answered
    }
    
    // Build display text for user message
    const displayParts = sectionQuestions.map(q => {
      const value = currentRatings[q.key];
      const optionIndex = 3 - value; // Convert 3,2,1,0 back to index
      const optionText = translatedUI?.sections?.[section]?.questions?.find(
        tq => tq.label === (translatedUI?.sections?.[section]?.questions?.[sectionQuestions.indexOf(q)]?.label)
      )?.options?.[optionIndex] || q.options[optionIndex];
      return `${q.en}: ${optionText}`;
    });
    addUserMessage(displayParts.join('\n'));
    
    // Save to feedback data
    const updates = {};
    sectionQuestions.forEach(q => {
      updates[`${section}_${q.key}`] = currentRatings[q.key];
    });
    const newData = { ...feedbackData, ...updates };
    setFeedbackData(newData);
    
    const response = await generateBotResponse(
      `User completed ${RATING_SECTIONS[section].title} ratings. Ask if they want to add any comments about this.`,
      feedbackData.language
    );
    addBotMessage(response);
    setCurrentStep(`${section}_comment`);
    setCurrentRatings({});
  };

  const handleCommentSubmit = async (comment, section) => {
    const hasComment = comment && comment.trim();
    addUserMessage(hasComment ? comment : (translatedUI?.nothingToAdd || 'Nothing to add'));
    
    const commentKey = `${section}_comment`;
    const newData = { ...feedbackData, [commentKey]: hasComment ? comment.trim() : null };
    setFeedbackData(newData);
    
    // Determine next step
    const sectionKeys = ['env', 'exp', 'teach', 'support', 'mgmt'];
    const currentIndex = sectionKeys.indexOf(section);
    
    if (currentIndex < sectionKeys.length - 1) {
      const nextSection = sectionKeys[currentIndex + 1];
      const response = await generateBotResponse(
        `User ${hasComment ? 'added a comment' : 'skipped commenting'}. Now ask them to rate ${RATING_SECTIONS[nextSection].title}.`,
        feedbackData.language
      );
      addBotMessage(response);
      setCurrentStep(nextSection);
    } else {
      const response = await generateBotResponse(
        `User finished all ratings. Ask if they have any final feedback.`,
        feedbackData.language
      );
      addBotMessage(response);
      setCurrentStep('final');
    }
    setTextInput('');
  };

  const handleFinalSubmit = async (comment) => {
    const hasComment = comment && comment.trim();
    addUserMessage(hasComment ? comment : (translatedUI?.nothingToAdd || 'Nothing to add'));
    
    const newData = { 
      ...feedbackData, 
      final_comment: hasComment ? comment.trim() : null,
      is_complete: true 
    };
    setFeedbackData(newData);
    
    // Calculate averages
    const envAvg = average([newData.env_classroom, newData.env_facilities, newData.env_location, newData.env_schedule]);
    const expAvg = average([newData.exp_activities, newData.exp_homework, newData.exp_materials, newData.exp_progress]);
    const teachAvg = average([newData.teach_explanations, newData.teach_preparation, newData.teach_methods, newData.teach_speaking]);
    const supportAvg = average([newData.support_help, newData.support_feedback, newData.support_encouragement, newData.support_atmosphere]);
    const mgmtAvg = average([newData.mgmt_timing, newData.mgmt_fairness, newData.mgmt_organization, newData.mgmt_rules]);
    const overallAvg = average([envAvg, expAvg, teachAvg, supportAvg, mgmtAvg]);
    
    // Send to Google Sheets
    await sendToGoogleSheets({
      ...newData,
      env_avg: envAvg,
      exp_avg: expAvg,
      teach_avg: teachAvg,
      support_avg: supportAvg,
      mgmt_avg: mgmtAvg,
      overall_avg: overallAvg,
      timestamp: new Date().toISOString()
    });
    
    addBotMessage(translatedUI?.thankYou || "Thank you for your feedback! Your responses have been saved. ✓");
    setCurrentStep('complete');
    setTextInput('');
  };

  const average = (values) => {
    const valid = values.filter(v => v !== null && v !== undefined);
    return valid.length ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : null;
  };

  const sendToGoogleSheets = async (data) => {
    const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
    if (!scriptUrl) {
      console.warn('Google Script URL not configured');
      return;
    }
    
    try {
      // Use hidden iframe + form submission for reliable cross-origin POST
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
      form.action = scriptUrl;
      form.target = 'hidden_iframe_feedback';
      form.style.display = 'none';
      form.acceptCharset = 'UTF-8';

      // Encode data as base64 to handle unicode properly
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'data';
      input.value = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      form.appendChild(input);

      const encodingInput = document.createElement('input');
      encodingInput.type = 'hidden';
      encodingInput.name = 'encoding';
      encodingInput.value = 'base64';
      form.appendChild(encodingInput);

      document.body.appendChild(form);
      form.submit();

      // Cleanup
      setTimeout(() => {
        if (form.parentNode) form.parentNode.removeChild(form);
      }, 1000);
      
      console.log('Feedback submitted successfully');
    } catch (error) {
      console.error('Failed to send to Google Sheets:', error);
    }
  };

  const renderLanguageSelector = () => (
    <div style={styles.buttonGrid}>
      {LANGUAGES.map(lang => (
        <button
          key={lang}
          onClick={() => handleLanguageSelect(lang)}
          disabled={loading}
          style={{
            ...styles.langButton,
            ...(loading ? styles.disabledButton : {})
          }}
        >
          {lang}
        </button>
      ))}
      {showCustomLanguage && (
        <div style={styles.customLangContainer}>
          <input
            type="text"
            value={customLanguage}
            onChange={(e) => setCustomLanguage(e.target.value)}
            placeholder="Type your language..."
            style={styles.textInput}
            onKeyPress={(e) => e.key === 'Enter' && handleCustomLanguageSubmit()}
          />
          <button
            onClick={handleCustomLanguageSubmit}
            disabled={loading || !customLanguage.trim()}
            style={{
              ...styles.submitButton,
              ...(loading || !customLanguage.trim() ? styles.disabledButton : {})
            }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );

  const renderCampusSelector = () => (
    <div style={styles.twoButtonRow}>
      <button
        onClick={() => handleCampusSelect('Dubai')}
        disabled={loading}
        style={{
          ...styles.campusButton,
          ...(loading ? styles.disabledButton : {})
        }}
      >
        🏙️ {translatedUI?.dubai || 'Dubai'}
      </button>
      <button
        onClick={() => handleCampusSelect('London')}
        disabled={loading}
        style={{
          ...styles.campusButton,
          ...(loading ? styles.disabledButton : {})
        }}
      >
        🎡 {translatedUI?.london || 'London'}
      </button>
    </div>
  );

  const renderTeacherSelector = () => (
    <div style={styles.dropdownContainer}>
      <select
        onChange={(e) => handleTeacherSelect(e.target.value)}
        disabled={loading}
        defaultValue=""
        style={{
          ...styles.dropdown,
          ...(loading ? styles.disabledButton : {})
        }}
      >
        <option value="" disabled>{translatedUI?.selectTeacher || 'Select your teacher'}</option>
        {TEACHERS.map(teacher => (
          <option key={teacher} value={teacher}>{teacher}</option>
        ))}
      </select>
    </div>
  );

  const renderDurationSelector = () => (
    <div style={styles.durationGrid}>
      {(translatedUI?.durations || DURATION_OPTIONS).map((duration, idx) => (
        <button
          key={idx}
          onClick={() => handleDurationSelect(DURATION_OPTIONS[idx])}
          disabled={loading}
          style={{
            ...styles.durationButton,
            ...(loading ? styles.disabledButton : {})
          }}
        >
          {duration}
        </button>
      ))}
    </div>
  );

  const renderRatingCard = (sectionKey) => {
    const section = RATING_SECTIONS[sectionKey];
    const translated = translatedUI?.sections?.[sectionKey];
    
    return (
      <div style={styles.ratingCard}>
        <div style={styles.ratingCardTitle}>
          {translated?.title || section.title}
        </div>
        {section.questions.map((q, qIdx) => {
          const translatedQ = translated?.questions?.[qIdx];
          return (
            <div key={q.key} style={styles.ratingQuestion}>
              <div style={styles.ratingLabel}>
                {translatedQ?.label || q.en}
              </div>
              <div style={styles.ratingOptions}>
                {(translatedQ?.options || q.options).map((option, optIdx) => {
                  const value = 3 - optIdx; // 3, 2, 1, 0
                  const isSelected = currentRatings[q.key] === value;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleRatingChange(q.key, value)}
                      disabled={loading}
                      style={{
                        ...styles.ratingOption,
                        ...(isSelected ? styles.ratingOptionSelected : {}),
                        ...(loading ? styles.disabledButton : {})
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <button
          onClick={() => handleRatingsSubmit(sectionKey)}
          disabled={loading || !section.questions.every(q => currentRatings[q.key] !== undefined)}
          style={{
            ...styles.submitButton,
            marginTop: '16px',
            ...(loading || !section.questions.every(q => currentRatings[q.key] !== undefined) ? styles.disabledButton : {})
          }}
        >
          {translatedUI?.submit || 'Submit'}
        </button>
      </div>
    );
  };

  const renderCommentInput = (section) => (
    <div style={styles.commentContainer}>
      <input
        ref={inputRef}
        type="text"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        placeholder={translatedUI?.commentPrompt || "Add a comment..."}
        style={styles.textInput}
        disabled={loading}
        onKeyPress={(e) => e.key === 'Enter' && handleCommentSubmit(textInput, section)}
      />
      <div style={styles.commentButtons}>
        <button
          onClick={() => handleCommentSubmit(textInput, section)}
          disabled={loading || !textInput.trim()}
          style={{
            ...styles.smallButton,
            ...(loading || !textInput.trim() ? styles.disabledButton : {})
          }}
        >
          {translatedUI?.submit || 'Submit'}
        </button>
        <button
          onClick={() => handleCommentSubmit(null, section)}
          disabled={loading}
          style={{
            ...styles.skipButton,
            ...(loading ? styles.disabledButton : {})
          }}
        >
          {translatedUI?.nothingToAdd || 'Nothing to add'}
        </button>
      </div>
    </div>
  );

  const renderFinalInput = () => (
    <div style={styles.commentContainer}>
      <input
        ref={inputRef}
        type="text"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        placeholder={translatedUI?.finalQuestion || "Any other feedback?"}
        style={styles.textInput}
        disabled={loading}
        onKeyPress={(e) => e.key === 'Enter' && handleFinalSubmit(textInput)}
      />
      <div style={styles.commentButtons}>
        <button
          onClick={() => handleFinalSubmit(textInput)}
          disabled={loading || !textInput.trim()}
          style={{
            ...styles.smallButton,
            ...(loading || !textInput.trim() ? styles.disabledButton : {})
          }}
        >
          {translatedUI?.submit || 'Submit'}
        </button>
        <button
          onClick={() => handleFinalSubmit(null)}
          disabled={loading}
          style={{
            ...styles.skipButton,
            ...(loading ? styles.disabledButton : {})
          }}
        >
          {translatedUI?.nothingToAdd || 'Nothing to add'}
        </button>
      </div>
    </div>
  );

  const renderCurrentUI = () => {
    if (loading && !['env', 'exp', 'teach', 'support', 'mgmt'].includes(currentStep)) {
      return (
        <div style={styles.loadingContainer}>
          <div style={styles.typingIndicator}>
            <span style={styles.dot}></span>
            <span style={{ ...styles.dot, animationDelay: '0.2s' }}></span>
            <span style={{ ...styles.dot, animationDelay: '0.4s' }}></span>
          </div>
        </div>
      );
    }
    
    switch (currentStep) {
      case 'language': return renderLanguageSelector();
      case 'campus': return renderCampusSelector();
      case 'teacher': return renderTeacherSelector();
      case 'duration': return renderDurationSelector();
      case 'env': return renderRatingCard('env');
      case 'env_comment': return renderCommentInput('env');
      case 'exp': return renderRatingCard('exp');
      case 'exp_comment': return renderCommentInput('exp');
      case 'teach': return renderRatingCard('teach');
      case 'teach_comment': return renderCommentInput('teach');
      case 'support': return renderRatingCard('support');
      case 'support_comment': return renderCommentInput('support');
      case 'mgmt': return renderRatingCard('mgmt');
      case 'mgmt_comment': return renderCommentInput('mgmt');
      case 'final': return renderFinalInput();
      case 'complete': return (
        <div style={styles.completeMessage}>
          {translatedUI?.feedbackSent || '✓ Feedback sent'}
        </div>
      );
      default: return null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>ES World</h1>
        <p style={styles.headerSubtitle}>Student Feedback</p>
      </div>
      
      <div style={styles.chatContainer}>
        <div style={styles.messagesContainer}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                ...styles.messageBubble,
                ...(msg.role === 'user' ? styles.userBubble : styles.botBubble)
              }}
            >
              {msg.text}
            </div>
          ))}
          
          {loading && (
            <div style={{ ...styles.messageBubble, ...styles.botBubble }}>
              <div style={styles.typingIndicator}>
                <span style={styles.dot}></span>
                <span style={{ ...styles.dot, animationDelay: '0.2s' }}></span>
                <span style={{ ...styles.dot, animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div style={styles.inputArea}>
          {renderCurrentUI()}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '448px',
    margin: '0 auto',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f9fafb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    backgroundColor: '#f97316',
    color: 'white',
    padding: '16px 20px',
    textAlign: 'center'
  },
  headerTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700'
  },
  headerSubtitle: {
    margin: '4px 0 0',
    fontSize: '14px',
    opacity: 0.9
  },
  chatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  messageBubble: {
    padding: '12px 16px',
    borderRadius: '18px',
    maxWidth: '85%',
    lineHeight: '1.4',
    fontSize: '15px',
    whiteSpace: 'pre-wrap'
  },
  botBubble: {
    backgroundColor: 'white',
    alignSelf: 'flex-start',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  userBubble: {
    backgroundColor: '#f97316',
    color: 'white',
    alignSelf: 'flex-end'
  },
  inputArea: {
    padding: '16px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: 'white'
  },
  buttonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px'
  },
  langButton: {
    padding: '12px 8px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      borderColor: '#f97316',
      backgroundColor: '#fff7ed'
    }
  },
  twoButtonRow: {
    display: 'flex',
    gap: '12px'
  },
  campusButton: {
    flex: 1,
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  dropdownContainer: {
    width: '100%'
  },
  dropdown: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    fontSize: '15px',
    cursor: 'pointer'
  },
  durationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px'
  },
  durationButton: {
    padding: '14px 12px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  ratingCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid #e5e7eb'
  },
  ratingCardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#1f2937'
  },
  ratingQuestion: {
    marginBottom: '16px'
  },
  ratingLabel: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#374151'
  },
  ratingOptions: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap'
  },
  ratingOption: {
    flex: '1 1 auto',
    minWidth: '80px',
    padding: '8px 6px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center'
  },
  ratingOptionSelected: {
    backgroundColor: '#f97316',
    color: 'white',
    borderColor: '#f97316'
  },
  commentContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  textInput: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  commentButtons: {
    display: 'flex',
    gap: '8px'
  },
  smallButton: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#f97316',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  skipButton: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    fontSize: '14px',
    cursor: 'pointer'
  },
  submitButton: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#f97316',
    color: 'white',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  customLangContainer: {
    gridColumn: '1 / -1',
    display: 'flex',
    gap: '8px',
    marginTop: '8px'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '20px'
  },
  typingIndicator: {
    display: 'flex',
    gap: '4px',
    padding: '4px 0'
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#9ca3af',
    animation: 'bounce 1s infinite'
  },
  completeMessage: {
    textAlign: 'center',
    padding: '20px',
    fontSize: '18px',
    fontWeight: '500',
    color: '#10b981'
  }
};
