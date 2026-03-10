import React, { useEffect, useRef } from 'react';
import { ChatMessage, Course } from '../types';
import { CourseCard } from './CourseCard';
import { analytics } from '../services/analyticsService';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  allCourses: Course[];
  isLoading: boolean;
  onOptionClick: (option: string) => void;
  language: string;
}

// Internal component to handle the scroll logic and refs for each message's course list
const CourseCarousel: React.FC<{ courseIds: number[], allCourses: Course[], language: string }> = ({ courseIds, allCourses, language }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Retrieve and Deduplicate Courses
  const uniqueCourses = React.useMemo(() => {
    const relevantCourses = courseIds
      .map(id => allCourses.find(c => c.id === id))
      .filter((c): c is Course => !!c);

    const seen = new Set();
    return relevantCourses.filter(course => {
      const cleanName = course.name.split('|')[0].trim();
      const key = `${cleanName}|${course.start_date}|${course.venue}`;

      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [courseIds, allCourses]);

  // Scroll Handler
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 280; // Approximate card width + gap
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Analytics handler
  const handleCardClick = (courseName: string) => {
    analytics.logConversion(courseName);
  };

  if (uniqueCourses.length === 0) return null;

  return (
    <div className="relative group w-full mt-3">
      {/* Left Button - Only show if enough items to potentially scroll */}
      {uniqueCourses.length > 1 && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 z-10 bg-white/90 hover:bg-white text-gray-600 hover:text-[#00a884] rounded-full p-2 shadow-md border border-gray-100 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hidden md:flex items-center justify-center"
          aria-label="Scroll left"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
      )}

      {/* Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 px-1 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory relative z-0"
      >
        {uniqueCourses.map(course => (
          <div key={course.id} className="snap-start flex-shrink-0">
            <CourseCard course={course} onVisit={handleCardClick} language={language} />
          </div>
        ))}
      </div>

      {/* Right Button */}
      {uniqueCourses.length > 1 && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 z-10 bg-white/90 hover:bg-white text-gray-600 hover:text-[#00a884] rounded-full p-2 shadow-md border border-gray-100 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hidden md:flex items-center justify-center"
          aria-label="Scroll right"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
      )}
    </div>
  );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, allCourses, isLoading, onOptionClick, language }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const introByLanguage: Record<string, string> = {
    'en-US': 'Hi! I am your TargetZero agent. Ask me about available courses (e.g., SMSTS, First Aid) and I will help you find the best option.',
    'ro-RO': 'Salut! Sunt agentul tau TargetZero. Intreaba-ma despre cursurile disponibile (ex: SMSTS, First Aid) si te ajut sa gasesti cea mai buna optiune.',
    'pl-PL': 'Czesc! Jestem Twoim agentem TargetZero. Zapytaj mnie o dostepne kursy (np. SMSTS, First Aid), a pomoge Ci wybrac najlepsza opcje.',
    'bg-BG': 'Zdravei! Az sam tvoiat TargetZero agent. Popitai me za nalichni kursove (napr. SMSTS, First Aid) i shte ti pomogna da izberesh nai-dobriia variant.',
    'hu-HU': 'Szia! En vagyok a TargetZero asszisztensed. Kerdezz a rendelkezesre allo tanfolyamokrol (pl. SMSTS, First Aid), es segitek a legjobb opcio kivalasztasaban.',
    'cs-CZ': 'Ahoj! Jsem tvuj TargetZero asistent. Zeptej se me na dostupne kurzy (napr. SMSTS, First Aid) a pomohu ti vybrat nejlepsi moznost.',
  };
  const introText = introByLanguage[language] || introByLanguage['en-US'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Helper to format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
      {/* Intro Message */}
      {messages.length === 0 && (
        <div className="flex justify-center my-8">
          <div className="bg-[#fff5c4] text-gray-800 text-xs md:text-sm px-4 py-2 rounded-lg shadow-sm text-center max-w-sm">
            {introText}
          </div>
        </div>
      )}

      {messages.map((msg) => {
        const isUser = msg.role === 'user';

        return (
          <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            {/* Bubble */}
            <div
              className={`relative max-w-[90%] md:max-w-[70%] rounded-lg px-4 py-2 shadow-sm text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap ${isUser
                  ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none'
                  : 'bg-white text-gray-900 rounded-tl-none'
                }`}
            >
              {msg.text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
              <div className={`leading-[1] text-[10px] mt-1 text-right ${isUser ? 'text-gray-500' : 'text-gray-400'}`}>
                {formatTime(msg.timestamp)}
              </div>
            </div>

            {/* Disambiguation Options (Chips) */}
            {!isUser && msg.disambiguationOptions && msg.disambiguationOptions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 ml-1 max-w-[90%]">
                {msg.disambiguationOptions.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => onOptionClick(option)}
                    className="bg-white text-gray-700 hover:text-[#00a884] text-xs md:text-sm font-medium py-1.5 px-3 rounded-full shadow-sm border border-gray-200 hover:border-[#00a884] hover:bg-gray-50 transition-colors text-left"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {/* Course Cards Container (Carousel) */}
            {msg.courseIds && msg.courseIds.length > 0 && (
              <CourseCarousel courseIds={msg.courseIds} allCourses={allCourses} language={language} />
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex items-start">
          <div className="bg-white rounded-lg rounded-tl-none px-4 py-3 shadow-sm">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
