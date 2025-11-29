import { AnalyticsSession, SearchIntent } from "../types";
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'targetzero_analytics_v1';
let currentSessionId: string | null = null;

// Mock IP generator since we are client-side only
const getMockIP = () => {
  const savedIp = localStorage.getItem('mock_user_ip');
  if (savedIp) return savedIp;
  const ip = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 100)}`;
  localStorage.setItem('mock_user_ip', ip);
  return ip;
};

const getSessions = (): AnalyticsSession[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveSessions = (sessions: AnalyticsSession[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
};

export const analytics = {
  // Start a tracking session
  initSession: () => {
    if (currentSessionId) return; // Already initialized

    const sessions = getSessions();
    const newSession: AnalyticsSession = {
      sessionId: uuidv4(),
      ip: getMockIP(),
      startTime: Date.now(),
      durationSeconds: 0,
      searches: [],
      converted: false
    };
    
    currentSessionId = newSession.sessionId;
    sessions.push(newSession);
    saveSessions(sessions);
  },

  // Log a search action (extracted from Gemini tools)
  logSearch: (query: string, dateInfo?: string) => {
    if (!currentSessionId) return;
    
    const sessions = getSessions();
    const sessionIndex = sessions.findIndex(s => s.sessionId === currentSessionId);
    
    if (sessionIndex !== -1) {
      const search: SearchIntent = {
        term: query || "General Inquiry",
        period: dateInfo || "Not specified",
        timestamp: new Date().toISOString()
      };
      
      // Avoid duplicate consecutive logs
      const lastSearch = sessions[sessionIndex].searches[sessions[sessionIndex].searches.length - 1];
      if (!lastSearch || lastSearch.term !== search.term || lastSearch.period !== search.period) {
        sessions[sessionIndex].searches.push(search);
        saveSessions(sessions);
      }
    }
  },

  // Log when user clicks "See Details"
  logConversion: (courseName: string) => {
    if (!currentSessionId) return;

    const sessions = getSessions();
    const sessionIndex = sessions.findIndex(s => s.sessionId === currentSessionId);
    
    if (sessionIndex !== -1) {
      sessions[sessionIndex].converted = true;
      sessions[sessionIndex].clickedCourseId = courseName;
      saveSessions(sessions);
    }
  },

  // Update duration (called on unload or interval)
  updateDuration: () => {
    if (!currentSessionId) return;

    const sessions = getSessions();
    const sessionIndex = sessions.findIndex(s => s.sessionId === currentSessionId);
    
    if (sessionIndex !== -1) {
      const now = Date.now();
      sessions[sessionIndex].endTime = now;
      sessions[sessionIndex].durationSeconds = Math.floor((now - sessions[sessionIndex].startTime) / 1000);
      saveSessions(sessions);
    }
  },

  // Get all data for Admin Dashboard
  getAllData: () => {
    return getSessions().sort((a, b) => b.startTime - a.startTime); // Newest first
  },

  clearData: () => {
    localStorage.removeItem(STORAGE_KEY);
    currentSessionId = null; // Reset current session
  }
};