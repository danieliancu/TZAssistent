import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatInterface } from './components/ChatInterface';
import { AdminDashboard } from './components/AdminDashboard'; // Import Admin
import { Course, ChatMessage } from './types';
import { fetchCourses } from './services/dataService';
import { sendMessageToGemini } from './services/geminiService';
import { analytics } from './services/analyticsService'; // Import Analytics

// Helper for ID generation
const generateId = () => Math.random().toString(36).substr(2, 9);

// Type definition for Web Speech API
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Routing State
  const [currentView, setCurrentView] = useState<'chat' | 'admin'>('chat');

  // Language State
  const [language, setLanguage] = useState('en-US');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const languages = [
    { code: 'en-US', name: 'English', label: 'ENGLISH' },
    { code: 'ro-RO', name: 'Română', label: 'ROMÂNĂ' },
    { code: 'pl-PL', name: 'Polski', label: 'POLSKI' },
    { code: 'bg-BG', name: 'Български', label: 'БЪLGAR' },
    { code: 'hu-HU', name: 'Magyar', label: 'MAGYAR' },
    { code: 'cs-CZ', name: 'Čeština', label: 'ČEŠTINA' },
  ];

  const recognitionRef = useRef<any>(null);
  const sessionInitRef = useRef(false);

  // Update Speech Recognition Language dynamically
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
      console.log("🎤 Speech Recognition Language updated to:", language);

      // If currently listening, restart to apply change immediately
      if (isListening) {
        recognitionRef.current.stop();
        // It will auto-restart if user clicks again, or we could force it.
        // For now, stopping is safer to reset the engine.
        setIsListening(false);
      }
    }
  }, [language]);

  // Initial Data Load & Analytics Init
  useEffect(() => {
    const loadData = async () => {
      const data = await fetchCourses();
      setCourses(data);
      setDataLoaded(true);
    };
    loadData();

    // Initialize Analytics Session only once
    if (!sessionInitRef.current) {
      analytics.initSession();
      sessionInitRef.current = true;
    }

    // Update duration on unmount/close
    const handleUnload = () => {
      analytics.updateDuration();
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      // Also update on component unmount (e.g. dev hot reload)
      analytics.updateDuration();
    };
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechRecognitionApi = SpeechRecognition || webkitSpeechRecognition;

    if (SpeechRecognitionApi) {
      const recognition = new SpeechRecognitionApi();
      recognition.continuous = true; // Keep listening even if user pauses
      recognition.interimResults = true; // Show results while speaking
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        try {
          const currentTranscript = Array.from(event.results)
            .map((result: any) => result[0] ? result[0].transcript : '')
            .join('');

          setInputValue(currentTranscript);
        } catch (e) {
          console.error("Error processing speech result", e);
        }
      };

      recognition.onend = () => {
        // Only set listening to false if we didn't manually stop it (e.g. timeout)
        // However, React state updates can be asynchronous, so we trust the user interaction mostly.
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const handleSendMessage = async (textOverride?: string) => {
    // If textOverride is provided, use it. Otherwise use inputValue.
    const textToSend = textOverride !== undefined ? textOverride : inputValue;

    if (!textToSend.trim() || !dataLoaded) return;

    // Stop listening if sending
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    if (textOverride === undefined) {
      setInputValue(''); // Clear input if it came from the input field
    }

    // Add User Message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    // Optimistic update
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // PERFORMANCE OPTIMIZATION: 
      // Only send the last 10 messages to the AI for context retention.
      const historyContext = newMessages.slice(-10);

      const response = await sendMessageToGemini(textToSend, historyContext, courses);

      const botMsg: ChatMessage = {
        id: generateId(),
        role: 'model',
        text: response.reply,
        courseIds: response.suggested_course_ids,
        disambiguationOptions: response.disambiguation_options,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
      console.error("Chat Error:", error);

      let errorText = "Could not process request. Please check your internet connection.";
      if (error.message === "QUOTA_EXCEEDED") {
        errorText = "I'm receiving too many messages right now. Please wait a moment and try again.";
      } else if (error.status === 403 || error.status === 400) {
        errorText = "Service Unavailable: Configuration Error (API Key)";
      }

      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'model',
        text: errorText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech to Text is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputValue('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
        // Usually implies it's already started, so we ignore or ensure state sync
        setIsListening(true);
      }
    }
  };

  const handleRestart = () => {
    setMessages([]);
    setIsMenuOpen(false);
    setInputValue('');
    analytics.initSession(); // Optionally re-init session or keep adding to current
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Render Admin View if selected
  if (currentView === 'admin') {
    return <AdminDashboard onClose={() => setCurrentView('chat')} />;
  }

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#d1d7db] flex justify-center overflow-hidden">
      {/* Main Content Area - Constrained width for desktop aesthetics */}
      <div className="w-full max-w-[800px] h-full bg-[#efeae2] relative flex flex-col shadow-xl chat-bg overflow-hidden">

        {/* Header */}
        <div className="bg-[#00a884] px-4 py-3 flex items-center justify-between shadow-md z-30 shrink-0 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#00a884] font-bold text-xl">
              TZ
            </div>
            <div className="flex flex-col">
              <span className="text-white font-semibold text-md leading-tight">TargetZero Agent</span>
              <span className="text-white/80 text-xs">
                {dataLoaded ? 'Online' : 'Connecting...'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="bg-white text-[#00a884] hover:bg-gray-100 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
              >
                {languages.find(l => l.code === language)?.label || 'ENGLISH'}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>

              {isLangMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsLangMenuOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-lg shadow-xl z-50 py-1 overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-100">
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setIsLangMenuOpen(false);
                        }}
                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${language === lang.code ? 'text-[#00a884] font-bold' : 'text-gray-700'}`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Menu Button & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors focus:outline-none"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"></path></svg>
              </button>


              {isMenuOpen && (
                <>
                  {/* Backdrop to close menu when clicking outside */}
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsMenuOpen(false)}></div>

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl z-50 py-1 overflow-hidden origin-top-right border border-gray-100 animate-in fade-in zoom-in-95 duration-100">
                    <a
                      href="https://targetzerotraining.co.uk/"
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 border-b border-gray-100 transition-colors"
                    >
                      Close
                    </a>
                    <button
                      onClick={handleRestart}
                      className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 border-b border-gray-100 transition-colors"
                    >
                      Restart
                    </button>
                    <button
                      onClick={() => {
                        setCurrentView('admin');
                        setIsMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 border-b border-gray-100 transition-colors"
                    >
                      Admin
                    </button>
                    <a
                      href="tel:01245379496"
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      Call us
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <ChatInterface
          messages={messages}
          allCourses={courses}
          isLoading={isLoading}
          onOptionClick={(option) => handleSendMessage(option)}
        />

        {/* Input Area */}
        <div className="bg-[#f0f2f5] p-2 md:p-3 flex items-center gap-2 md:gap-4 shrink-0 z-20">
          {/* Input Wrapper */}
          <div className="flex-1 bg-white rounded-lg flex items-center px-4 py-2 md:py-3 shadow-sm border border-gray-100">
            <input
              type="text"
              className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm md:text-base"
              placeholder={isListening ? "Listening... (Speak now)" : "Type a message..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />

            {/* Clear Button */}
            {inputValue && (
              <button
                onClick={() => setInputValue('')}
                className="ml-2 text-gray-300 hover:text-gray-500 transition-colors focus:outline-none p-1"
                aria-label="Clear input"
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* Mic / Send Button Logic */}
          {(inputValue.trim()) ? (
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-[#00a884] text-white hover:bg-[#008f6f] transition-all shadow-sm"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6 transform" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
            </button>
          ) : (
            <button
              onClick={toggleListening}
              disabled={isLoading}
              className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all shadow-sm ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-[#00a884] hover:bg-[#008f6f]'} text-white`}
            >
              {isListening ? (
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              ) : (
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 2.34 9 4v6c0 1.66 1.34 3 3 3z"></path><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path></svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;