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
  available_spaces: number;
  updated_at_days: string;
  updated_at_venue: string;
  all_sessions_ids: string;
  session_id: string;
  link: string;
  course_title?: string;
  course_reference?: string;
  venue_id?: string;
  venue_name?: string;
  venue_full_address?: string;
  venue_city?: string;
  venue_postcode?: string;
  venue_country?: string;
  trainer_name?: string;
  trainer_email?: string;
  first_date?: string;
  last_date?: string;
  total_days?: string;
  total_hours?: string;
  session_days?: string;
  delivery_type?: string;
  delivery_type_code?: string;
  price_ex_vat?: string;
  price_inc_vat?: string;
  vat_amount?: string;
  currency?: string;
  price_display?: string;
  is_full?: boolean;
  is_nearly_full?: boolean;
  is_online?: boolean;
  is_closed?: boolean;
  mmc_checkout_url?: string;
  attributes?: Record<string, string>;
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

export type CriteriaFieldSource = 'current_message' | 'history' | 'inferred' | 'none';

export interface SearchCriteriaSource {
  query: CriteriaFieldSource;
  location: CriteriaFieldSource;
  dateStart: CriteriaFieldSource;
  dateEnd: CriteriaFieldSource;
}

export interface SearchCriteria {
  query?: string;
  location?: string;
  dateStart?: string;
  dateEnd?: string;
  criteria_source: SearchCriteriaSource;
}

export interface SearchAttempt {
  stage: string;
  criteria: Omit<SearchCriteria, 'criteria_source'>;
  result_count: number;
}

export interface SearchLocalResult {
  courses: any[];
  message?: string;
  applied_criteria: SearchCriteria;
  attempts: SearchAttempt[];
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
