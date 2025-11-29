import { Course } from '../types';

const API_URL = 'https://targetzerotraining.co.uk/wp-json/custom/v1/products';

// Helper to parse "Mon 15th December 2025" to a Date object
// Returns null if invalid
function parseCourseDate(dateStr: string): Date | null {
  try {
    // Remove day name (Mon, Tue) and ordinal suffixes (st, nd, rd, th)
    // Example: "Mon 15th December 2025" -> "15 December 2025"
    const cleaned = dateStr
      .replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, '')
      .replace(/(\d+)(st|nd|rd|th)/, '$1');
    
    const date = new Date(cleaned);
    return isNaN(date.getTime()) ? null : date;
  } catch (e) {
    return null;
  }
}

export const fetchCourses = async (): Promise<Course[]> => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    
    // The API might return an object with keys or an array. 
    // Based on the prompt description, it's likely an array of objects.
    // If it's an object with numeric keys, we convert to array.
    let courses: Course[] = [];
    
    if (Array.isArray(data)) {
      courses = data;
    } else if (typeof data === 'object' && data !== null) {
      courses = Object.values(data);
    }

    // Filter out past courses
    const now = new Date();
    // Reset time to midnight for accurate day comparison
    now.setHours(0, 0, 0, 0);

    const validCourses = courses.filter(course => {
      const courseDate = parseCourseDate(course.start_date);
      // Keep if date is valid and is today or in the future
      return courseDate && courseDate >= now;
    });

    // Sort by date ascending
    validCourses.sort((a, b) => {
       const da = parseCourseDate(a.start_date) || new Date(0);
       const db = parseCourseDate(b.start_date) || new Date(0);
       return da.getTime() - db.getTime();
    });

    return validCourses;
  } catch (error) {
    console.error("Error fetching courses:", error);
    return [];
  }
};

// Create a simplified version of the courses for the AI context to save tokens
export const getSimplifiedCourseContext = (courses: Course[]): string => {
  return JSON.stringify(
    courses.map(c => {
      // Convert to ISO string for easier LLM reasoning (YYYY-MM-DD)
      const dateObj = parseCourseDate(c.start_date);
      const formattedDate = dateObj 
        ? `${dateObj.toISOString().split('T')[0]} (${dateObj.toLocaleDateString('en-GB', { weekday: 'long' })})` 
        : c.start_date;

      return {
        id: c.id,
        ref: c.reference ? c.reference.toUpperCase() : '', // Uppercase for consistent acronym matching
        name: c.name.split('|')[0].trim(), // Only the main name part
        date: formattedDate,
        venue: c.venue,
        price: c.price
      };
    })
  );
};

// SEARCH FUNCTION FOR AI TOOL USE
export const searchLocalCourses = (
  allCourses: Course[], 
  criteria: { query?: string; dateStart?: string; dateEnd?: string }
): string => {
  const { query, dateStart, dateEnd } = criteria;
  
  let filtered = allCourses;

  // 1. Filter by Text (Name or Reference)
  if (query && query.trim() !== '') {
    const q = query.toLowerCase().trim();
    filtered = filtered.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const refMatch = c.reference && c.reference.toLowerCase().includes(q);
      return nameMatch || refMatch;
    });
  }

  // 2. Filter by Date Range
  if (dateStart || dateEnd) {
    const start = dateStart ? new Date(dateStart) : null;
    const end = dateEnd ? new Date(dateEnd) : null;
    
    // Adjust logic to be inclusive
    if (end) end.setHours(23, 59, 59, 999);

    filtered = filtered.filter(c => {
      const cDate = parseCourseDate(c.start_date);
      if (!cDate) return false;
      
      if (start && cDate < start) return false;
      if (end && cDate > end) return false;
      
      return true;
    });
  }

  // Limit results to prevent token overflow if search is too broad
  const MAX_RESULTS = 25; 
  const limitedResults = filtered.slice(0, MAX_RESULTS);

  if (limitedResults.length === 0) {
    return "No courses found matching the criteria.";
  }

  return getSimplifiedCourseContext(limitedResults);
};
