export interface Course {
  id: number;
  course_id: string;
  name: string;
  price: string;
  venue: string;
  reference: string;
  start_time: string;
  start_date: string;
  end_date: string;
  dates_list: string;
  available_spaces: string;
  updated_at_days: string;
  updated_at_venue: string;
  all_sessions_ids: string;
  session_id: string;
  link: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  courseIds?: number[]; // IDs of courses to display with this message
  disambiguationOptions?: string[]; // List of specific terms if the query was broad
  timestamp: Date;
}

export interface AIResponseSchema {
  reply: string;
  suggested_course_ids: number[];
  disambiguation_options: string[];
}

// Analytics Types
export interface SearchIntent {
  term: string; // The course looked for
  location?: string; // Currently inferred from query if present, or venue
  period?: string; // "Next week", "December", "2025-01-01"
  timestamp: string;
}

export interface AnalyticsSession {
  sessionId: string;
  ip: string; // Mocked for frontend-only
  startTime: number;
  endTime?: number;
  durationSeconds: number;
  searches: SearchIntent[];
  converted: boolean; // True if clicked a course
  clickedCourseId?: string;
}