import React, { useState, useRef, useEffect } from 'react';

const SYSTEM_PROMPT = `You are a friendly suggestions assistant for ES World, an English language school. Students scan a QR code on posters to share ideas, suggestions, or feedback.

IMPORTANT: Respond in the language the student chooses. Keep it simple and warm.

CONVERSATION FLOW (only 4 steps):

1. LANGUAGE (ask first, in English)
   - "Hi! 👋 What language would you like to chat in?"
   
2. SUGGESTION (free text)
   - Ask warmly: "Great! What would you like to share with us? It could be an idea, suggestion, or any feedback."
   - Store their response (translate to English for storage)

3. FOLLOW UP (free text) 
   - Ask ONE follow-up question to get more detail based on what they said
   - For example: "That's interesting! Can you tell me a bit more about that?" or "Thanks for sharing! What made you think of this?"
   - Store their response (translate to English for storage)

4. ANYTHING ELSE (free text)
   - Ask: "Anything else you'd like to add?"
   - If they say no/nothing, that's fine
   - Store their response (translate to English for storage)

5. THANK THEM
   - "Thank you for sharing! We really appreciate your input and will look into this. 🙏"
   - Set is_complete to true

GUIDELINES:
- Be warm and friendly
- Keep responses short (1 sentence max)
- Don't be formal or corporate
- Translate all responses to English for storage

After EVERY response, include a JSON block:

|||JSON|||
{
  "language": null,
  "suggestion": null,
  "follow_up": null,
  "anything_else": null,
  "is_complete": false
}
|||END|||

Start by greeting and asking what language they'd like to use.`;

const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycby2cxlpQKg1NbU1k8uA3XE47_IVaW3BaesNcSMR_K9j-qLCc79Iyf_LBEKfgQ8IiKSgUA/exec';

const saveToGoogleSheet = async (data) => {
  try {
    // Create hidden iframe if it doesn't exist
    let iframe = document.getElementById('hidden_iframe_suggestions');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.name = 'hidden_iframe_suggestions';
      iframe.id = 'hidden_iframe_suggestions';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }
    
    // Create form with UTF-8 encoding
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = GOOGLE_SHEET_URL;
    form.target = 'hidden_iframe_suggestions';
    form.style.display = 'none';
    form.acceptCharset = 'UTF-8';
    
    // Add data as hidden input - encode properly for Unicode
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    // Use encodeURIComponent to handle Unicode, then decode on server
    input.value = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    form.appendChild(input);
    
    // Add flag to indicate base64 encoding
    const encodingInput = document.createElement('input');
    encodingInput.type = 'hidden';
    encodingInput.name = 'encoding';
    encodingInput.value = 'base64';
    form.appendChild(encodingInput);
    
    // Submit form
    document.body.appendChild(form);
    form.submit();
    
    // Clean up form after short delay
    setTimeout(() => {
      if (form.parentNode) {
        form.parentNode.removeChild(form);
      }
    }, 1000);
    
    console.log('Suggestion saved to Google Sheet');
  } catch (error) {
    console.error('Error saving to Google Sheet:', error);
  }
};

function SuggestionsChat() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [collectedData, setCollectedData] = useState({});
  const [hasStarted, setHasStarted] = useState(false);
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
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      setMessages([{ type: 'bot', text: "Hi! 👋 What language would you like to chat in?" }]);
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

      setMessages([...newMessages, { 
        type: 'bot', 
        text: displayText, 
        rawJson: response.includes('|||JSON|||') ? response.match(/\|\|\|JSON\|\|\|[\s\S]*?\|\|\|END\|\|\|/)?.[0] || '' : '' 
      }]);
      
      if (data) {
        setCollectedData(data);
        console.log('Collected data:', data);
        if (data.is_complete) {
          setIsComplete(true);
          console.log('=== FINAL SUGGESTION DATA ===');
          console.log(JSON.stringify(data, null, 2));
          saveToGoogleSheet(data);
        }
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
        height: '600px',
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
            background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            💡
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: '#000' }}>Suggestions Box</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#8e8e93' }}>Share your ideas with us</p>
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
                  ? '#8B5CF6'
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
        {!isComplete ? (
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
                  placeholder="Type your message..."
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
                  background: inputValue.trim() && !isLoading ? '#8B5CF6' : '#e5e5e5',
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
        ) : (
          <div style={{
            padding: '16px',
            background: '#f9f9f9',
            borderTop: '1px solid #e5e5e5',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: '#8e8e93', fontSize: '14px' }}>
              ✓ Suggestion submitted
            </p>
          </div>
        )}
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

export default SuggestionsChat;
