import React, { useState, useRef, useEffect } from 'react';

const SYSTEM_PROMPT = `You are a friendly feedback assistant for ES World, an English language school with campuses in Dubai and London. Your job is to collect feedback from students in a warm, conversational way.

IMPORTANT: Respond in the language the student chooses. If they say "Arabic" or "عربي", respond in Arabic. If they say "Hindi", respond in Hindi. And so on.

You need to collect the following information through natural conversation. For questions with fixed options, the UI will show buttons - you must provide translated labels for these buttons.

DATA TO COLLECT:

1. LANGUAGE (ask first, in English)
   - Ask: "What language would you like to chat in?"
   - Store whatever they choose

2. CAMPUS (buttons will show)
   - Just ask naturally: "Which campus are you studying at?"
   - Don't list the options - buttons will appear
   - Store as: "Dubai" or "London"
   - Provide translated button labels in "button_options"

3. TEACHER NAME (free text)
   - Ask for their teacher's name
   - Store exactly what they say

4. DURATION (buttons will show)
   - Just ask naturally: "How long have you been studying with us?"
   - Don't list the options - buttons will appear
   - Store as one of: "It's my first week", "1-2 weeks", "3-4 weeks", "1-2 months", "2 months+"
   - Provide translated button labels in "button_options"

5. LESSONS RATING (emoji buttons will show)
   - Ask softly: "How are you finding your lessons so far?"
   - Don't mention 0-5 - emoji buttons will appear
   - Store the number 0-5

6. LESSONS COMMENT (free text)
   - Follow up based on their rating:
     * 0-2: "Thanks for being honest. What's the main issue?"
     * 3: "Okay, sounds like there's room to improve. What would help?"
     * 4-5: "That's lovely to hear! What's working well?"
   - Store their comment (translate to English for storage)

7. TEACHER RATING (emoji buttons will show)
   - Ask softly: "How do you feel about your teacher?"
   - Don't mention 0-5 - emoji buttons will appear
   - Store the number 0-5

8. TEACHER COMMENT (free text)
   - Follow up based on their rating (same approach as lessons)
   - Store their comment (translate to English for storage)

9. WORKING WELL (free text)
   - Ask: "What's been working well for you?"
   - Store their response (translate to English for storage)

10. IMPROVE (free text)
    - Ask: "Is there anything we could do better?"
    - Store their response (translate to English for storage)

11. OTHER (free text)
    - Ask: "Anything else you'd like to share?"
    - Store their response (translate to English for storage)

GUIDELINES:
- Be warm and empathetic, not robotic
- Keep responses short (1-2 sentences max)
- Don't ask multiple questions at once
- DON'T list options for campus, duration, or ratings - the UI handles that with buttons
- When storing comments, translate them to English for the database but keep chatting in their language
- After collecting all feedback, thank them warmly and mention they can visit the office to discuss further

After EVERY response, include a JSON block with collected data. Format exactly like this:

|||JSON|||
{
  "language": null,
  "campus": null,
  "teacher": null,
  "duration": null,
  "lessons_rating": null,
  "lessons_comment": null,
  "teacher_rating": null,
  "teacher_comment": null,
  "working_well": null,
  "improve": null,
  "other": null,
  "is_complete": false,
  "button_options": null
}
|||END|||

IMPORTANT FOR JSON:
- "campus" must be exactly "Dubai" or "London"
- "duration" must be exactly one of: "It's my first week", "1-2 weeks", "3-4 weeks", "1-2 months", "2 months+"
- "lessons_rating" and "teacher_rating" must be numbers 0-5
- All comments should be stored in English (translated if needed)
- Set "is_complete": true only after thanking the student

BUTTON OPTIONS FORMAT:
When asking about campus or duration, include "button_options" with translated labels:

For CAMPUS question:
"button_options": {
  "type": "campus",
  "options": [
    {"label": "Dubai (translated)", "value": "Dubai"},
    {"label": "London (translated)", "value": "London"}
  ]
}

For DURATION question:
"button_options": {
  "type": "duration",
  "options": [
    {"label": "It's my first week (translated)", "value": "It's my first week"},
    {"label": "1-2 weeks (translated)", "value": "1-2 weeks"},
    {"label": "3-4 weeks (translated)", "value": "3-4 weeks"},
    {"label": "1-2 months (translated)", "value": "1-2 months"},
    {"label": "2 months+ (translated)", "value": "2 months+"}
  ]
}

For example, in French:
"button_options": {
  "type": "duration",
  "options": [
    {"label": "C'est ma première semaine", "value": "It's my first week"},
    {"label": "1-2 semaines", "value": "1-2 weeks"},
    {"label": "3-4 semaines", "value": "3-4 weeks"},
    {"label": "1-2 mois", "value": "1-2 months"},
    {"label": "Plus de 2 mois", "value": "2 months+"}
  ]
}

The "value" is always in English (for database storage), but the "label" is translated for display.

Start by greeting warmly and asking what language they'd like to chat in.`;

const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycby7cn2og8X1L9Ga2Nz2bj4_Jsr7rhmW07lVMQE4H_e8oDSRG0VBoeg22LfoZ-fs_6Q9/exec';

const saveToGoogleSheet = async (data) => {
  try {
    // Create hidden iframe if it doesn't exist
    let iframe = document.getElementById('hidden_iframe_feedback');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.name = 'hidden_iframe_feedback';
      iframe.id = 'hidden_iframe_feedback';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }
    
    // Create form
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = GOOGLE_SHEET_URL;
    form.target = 'hidden_iframe_feedback';
    form.style.display = 'none';
    
    // Add data as hidden input
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify(data);
    form.appendChild(input);
    
    // Submit form
    document.body.appendChild(form);
    form.submit();
    
    // Clean up form after short delay
    setTimeout(() => {
      if (form.parentNode) {
        form.parentNode.removeChild(form);
      }
    }, 1000);
    
    console.log('Data saved to Google Sheet');
  } catch (error) {
    console.error('Error saving to Google Sheet:', error);
  }
};

const FIXED_OPTIONS = {
  campus: [
    { label: 'Dubai', value: 'Dubai' },
    { label: 'London', value: 'London' }
  ],
  duration: [
    { label: "It's my first week", value: "It's my first week" },
    { label: "1-2 weeks", value: "1-2 weeks" },
    { label: "3-4 weeks", value: "3-4 weeks" },
    { label: "1-2 months", value: "1-2 months" },
    { label: "2 months+", value: "2 months+" }
  ],
  rating: [
    { label: "0", emoji: "😟", value: "0" },
    { label: "1", emoji: "😕", value: "1" },
    { label: "2", emoji: "😐", value: "2" },
    { label: "3", emoji: "🙂", value: "3" },
    { label: "4", emoji: "😊", value: "4" },
    { label: "5", emoji: "😄", value: "5" }
  ]
};

function detectQuestionType(message, collectedData) {
  const lowerMsg = message.toLowerCase();
  
  // Check if asking about campus (and campus not yet collected)
  if (!collectedData.campus && (
    lowerMsg.includes('campus') ||
    lowerMsg.includes('dubai') ||
    lowerMsg.includes('london') ||
    lowerMsg.includes('دبي') ||
    lowerMsg.includes('لندن') ||
    lowerMsg.includes('which branch') ||
    lowerMsg.includes('quelle branche') ||
    lowerMsg.includes('किस कैंपस')
  )) {
    return 'campus';
  }
  
  // Check if asking about duration (and duration not yet collected)
  if (!collectedData.duration && (
    lowerMsg.includes('how long') ||
    lowerMsg.includes('studying with us') ||
    lowerMsg.includes('been studying') ||
    lowerMsg.includes('منذ متى') ||
    lowerMsg.includes('combien de temps') ||
    lowerMsg.includes('depuis combien') ||
    lowerMsg.includes('कितने समय')
  )) {
    return 'duration';
  }
  
  // Check if asking about lessons rating (and lessons_rating not yet collected)
  if (!collectedData.lessons_rating && collectedData.duration && (
    lowerMsg.includes('lessons') ||
    lowerMsg.includes('classes') ||
    lowerMsg.includes('finding your') ||
    lowerMsg.includes('الدروس') ||
    lowerMsg.includes('cours') ||
    lowerMsg.includes('पाठ')
  )) {
    return 'rating';
  }
  
  // Check if asking about teacher rating (and teacher_rating not yet collected, but lessons done)
  if (!collectedData.teacher_rating && collectedData.lessons_rating !== null && collectedData.lessons_comment && (
    lowerMsg.includes('teacher') ||
    lowerMsg.includes('instructor') ||
    lowerMsg.includes('المعلم') ||
    lowerMsg.includes('المدرس') ||
    lowerMsg.includes('professeur') ||
    lowerMsg.includes('enseignant') ||
    lowerMsg.includes('शिक्षक') ||
    lowerMsg.includes('feel about')
  )) {
    return 'rating';
  }
  
  return 'text';
}

function ESFeedbackChat() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [collectedData, setCollectedData] = useState({});
  const [hasStarted, setHasStarted] = useState(false);
  const [currentQuestionType, setCurrentQuestionType] = useState('text');
  const [translatedOptions, setTranslatedOptions] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (hasStarted) return;
    setHasStarted(true);
    startConversation();
  }, [hasStarted]);

  const parseResponse = (text) => {
    const jsonMatch = text.match(/\|\|\|JSON\|\|\|([\s\S]*?)\|\|\|END\|\|\|/);
    let displayText = text;
    let data = null;

    if (jsonMatch) {
      displayText = text.replace(/\|\|\|JSON\|\|\|[\s\S]*?\|\|\|END\|\|\|/, '').trim();
      try {
        data = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('Failed to parse JSON:', e);
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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: conversationHistory
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    return result.content[0].text;
  };

  const startConversation = async () => {
    setIsLoading(true);
    try {
      const response = await callClaude([
        { role: 'user', content: 'Hi' }
      ]);
      const { displayText, data } = parseResponse(response);
      
      setMessages([{ type: 'bot', text: displayText }]);
      if (data) {
        setCollectedData(data);
        if (data.is_complete) setIsComplete(true);
        if (data.button_options) {
          setTranslatedOptions(data.button_options);
          setCurrentQuestionType(data.button_options.type);
        } else {
          setCurrentQuestionType(detectQuestionType(displayText, data || {}));
        }
      } else {
        setCurrentQuestionType(detectQuestionType(displayText, {}));
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      setMessages([{ type: 'bot', text: "Hi! 👋 Thanks for taking a moment to share your feedback. What language would you like to chat in?" }]);
    }
    setIsLoading(false);
  };

  const sendMessage = async (userMessage) => {
    const newMessages = [...messages, { type: 'user', text: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const conversationHistory = newMessages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.type === 'bot' ? msg.text + (msg.rawJson || '') : msg.text
      }));

      const response = await callClaude(conversationHistory);
      const { displayText, data } = parseResponse(response);

      setMessages([...newMessages, { type: 'bot', text: displayText, rawJson: response.includes('|||JSON|||') ? response.match(/\|\|\|JSON\|\|\|[\s\S]*?\|\|\|END\|\|\|/)[0] : '' }]);
      
      if (data) {
        setCollectedData(data);
        console.log('Collected data:', data);
        if (data.is_complete) {
          setIsComplete(true);
          console.log('=== FINAL FEEDBACK DATA ===');
          console.log(JSON.stringify(data, null, 2));
          saveToGoogleSheet(data);
        }
        if (data.button_options) {
          setTranslatedOptions(data.button_options);
          setCurrentQuestionType(data.button_options.type);
        } else {
          setTranslatedOptions(null);
          setCurrentQuestionType(detectQuestionType(displayText, data));
        }
      } else {
        setTranslatedOptions(null);
        setCurrentQuestionType('text');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages([...newMessages, { type: 'bot', text: "Sorry, I had trouble processing that. Could you try again?" }]);
    }
    
    setIsLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleOptionClick = (value) => {
    if (!isLoading) {
      sendMessage(value);
    }
  };

  const renderInputArea = () => {
    if (isComplete) {
      return (
        <div style={{
          padding: '16px',
          background: '#f9f9f9',
          borderTop: '1px solid #e5e5e5',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, color: '#8e8e93', fontSize: '14px' }}>
            ✓ Feedback submitted
          </p>
        </div>
      );
    }

    // Rating buttons (emoji row)
    if (currentQuestionType === 'rating') {
      return (
        <div style={{
          padding: '12px 16px',
          background: '#f9f9f9',
          borderTop: '1px solid #e5e5e5'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            {FIXED_OPTIONS.rating.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleOptionClick(option.value)}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  border: 'none',
                  borderRadius: '12px',
                  background: isLoading ? '#e5e5e5' : '#e9e9eb',
                  cursor: isLoading ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = '#FF9500';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#e9e9eb';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span style={{ fontSize: '24px' }}>{option.emoji}</span>
                <span style={{ fontSize: '12px', color: '#666' }}>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Campus or Duration buttons (stacked)
    if (currentQuestionType === 'campus' || currentQuestionType === 'duration') {
      // Use translated options if available, otherwise fall back to defaults
      const options = translatedOptions?.options || FIXED_OPTIONS[currentQuestionType];
      return (
        <div style={{
          padding: '12px 16px',
          background: '#f9f9f9',
          borderTop: '1px solid #e5e5e5'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleOptionClick(option.value || option.label)}
                disabled={isLoading}
                style={{
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '20px',
                  background: isLoading ? '#e5e5e5' : '#e9e9eb',
                  color: '#000',
                  fontSize: '15px',
                  fontWeight: '400',
                  cursor: isLoading ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.target.style.background = '#FF9500';
                    e.target.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#e9e9eb';
                  e.target.style.color = '#000';
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Default text input
    return (
      <div style={{
        padding: '12px 16px',
        background: '#f9f9f9',
        borderTop: '1px solid #e5e5e5'
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <div style={{
            flex: 1,
            background: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e5e5e5',
            overflow: 'hidden'
          }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your response..."
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                fontSize: '16px',
                outline: 'none',
                background: 'transparent'
              }}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: inputValue.trim() && !isLoading ? '#FF9500' : '#e5e5e5',
              color: '#fff',
              fontSize: '18px',
              cursor: inputValue.trim() && !isLoading ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f2f2f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        height: '700px',
        background: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: '#f9f9f9',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            background: 'linear-gradient(135deg, #FF9500 0%, #FFAD33 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            color: 'white',
            fontWeight: '600'
          }}>
            ES
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: '#000' }}>ES Feedback</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#8e8e93' }}>We'd love to hear from you</p>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: '#ffffff'
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                animation: 'fadeIn 0.25s ease'
              }}
            >
              <div style={{
                maxWidth: '75%',
                padding: '10px 14px',
                borderRadius: msg.type === 'user' 
                  ? '18px 18px 4px 18px' 
                  : '18px 18px 18px 4px',
                background: msg.type === 'user' 
                  ? '#FF9500'
                  : '#e9e9eb',
                color: msg.type === 'user' ? '#ffffff' : '#000000',
                fontSize: '16px',
                lineHeight: '1.4',
                wordBreak: 'break-word'
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          
          {/* Typing indicator */}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '18px 18px 18px 4px',
                background: '#e9e9eb'
              }}>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#8e8e93',
                        animation: `typingBounce 1.4s infinite ease-in-out`,
                        animationDelay: `${i * 0.2}s`
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {renderInputArea()}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        * {
          box-sizing: border-box;
        }
        input::placeholder {
          color: #8e8e93;
        }
      `}</style>
    </div>
  );
}

export default ESFeedbackChat;
