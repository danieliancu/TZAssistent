import { Course, SearchLocalResult, SearchCriteriaSource, SearchAttempt } from '../types';

const PROD_API_URL = 'https://targetzerotraining.co.uk/wp-json/custom/v1/products';
const DEV_API_URL = '/api/products';
const API_URL = import.meta.env.PROD ? PROD_API_URL : DEV_API_URL;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function asYesNoBoolean(value: unknown): boolean {
  const normalized = asString(value).toLowerCase();
  return normalized === 'yes' || normalized === 'true' || normalized === '1';
}

function normalizeCourseName(value: string): string {
  // Fix broken names coming from wrapped text like "Co | ordinator" -> "Coordinator"
  // while keeping valid separators such as "Course Name | 2026-03-24".
  let normalized = value;
  const intrawordPipePattern = /([A-Za-z]{2,})\s*\|\s*([a-z]{2,})/g;

  // Apply repeatedly in case a title contains multiple wrapped breaks.
  while (intrawordPipePattern.test(normalized)) {
    normalized = normalized.replace(intrawordPipePattern, '$1$2');
    intrawordPipePattern.lastIndex = 0;
  }

  return normalized;
}

function parseIsoDateLocal(dateStr: string): Date | null {
  if (!ISO_DATE_RE.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseCourseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const isoDate = parseIsoDateLocal(dateStr);
  if (isoDate) return isoDate;

  try {
    const cleaned = dateStr
      .replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, '')
      .replace(/(\d+)(st|nd|rd|th)/, '$1');
    const date = new Date(cleaned);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch (_e) {
    return null;
  }
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeCourse(raw: any): Course {
  const isOnline = asYesNoBoolean(raw?.is_online);
  const venueValue = asString(raw?.venue) || asString(raw?.venue_name) || (isOnline ? 'Online' : '');
  const referenceValue = asString(raw?.reference) || asString(raw?.course_reference);
  const firstDateValue = asString(raw?.first_date) || asString(raw?.start_date);
  const startDateValue = asString(raw?.start_date) || firstDateValue;
  const endDateValue = asString(raw?.end_date) || asString(raw?.last_date);
  const priceValue = asString(raw?.price_ex_vat) || asString(raw?.price);

  return {
    id: asNumber(raw?.id),
    course_id: asString(raw?.course_id),
    name: normalizeCourseName(asString(raw?.name)),
    price: priceValue,
    venue: venueValue,
    reference: referenceValue,
    start_time: asString(raw?.start_time),
    start_date: startDateValue,
    end_date: endDateValue,
    dates_list: asString(raw?.dates_list),
    available_spaces: asNumber(raw?.available_spaces),
    updated_at_days: asString(raw?.updated_at_days),
    updated_at_venue: asString(raw?.updated_at_venue),
    all_sessions_ids: asString(raw?.all_sessions_ids),
    session_id: asString(raw?.session_id),
    link: asString(raw?.link),
    course_title: asString(raw?.course_title),
    course_reference: asString(raw?.course_reference),
    venue_id: asString(raw?.venue_id),
    venue_name: asString(raw?.venue_name),
    venue_full_address: asString(raw?.venue_full_address),
    venue_city: asString(raw?.venue_city),
    venue_postcode: asString(raw?.venue_postcode),
    venue_country: asString(raw?.venue_country),
    trainer_name: asString(raw?.trainer_name),
    trainer_email: asString(raw?.trainer_email),
    first_date: firstDateValue,
    last_date: asString(raw?.last_date),
    total_days: asString(raw?.total_days),
    total_hours: asString(raw?.total_hours),
    session_days: asString(raw?.session_days),
    delivery_type: asString(raw?.delivery_type),
    delivery_type_code: asString(raw?.delivery_type_code),
    price_ex_vat: asString(raw?.price_ex_vat),
    price_inc_vat: asString(raw?.price_inc_vat),
    vat_amount: asString(raw?.vat_amount),
    currency: asString(raw?.currency),
    price_display: asString(raw?.price_display),
    is_full: asYesNoBoolean(raw?.is_full),
    is_nearly_full: asYesNoBoolean(raw?.is_nearly_full),
    is_online: isOnline,
    is_closed: asYesNoBoolean(raw?.is_closed),
    mmc_checkout_url: asString(raw?.mmc_checkout_url),
    attributes: raw?.attributes && typeof raw.attributes === 'object' ? raw.attributes : undefined,
  };
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
    let rawCourses: any[] = [];

    if (Array.isArray(data)) {
      rawCourses = data;
    } else if (typeof data === 'object' && data !== null) {
      rawCourses = Object.values(data);
    }

    const courses = rawCourses.map(normalizeCourse);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const validCourses = courses.filter(course => {
      const dateToCheck = course.first_date || course.start_date;
      const courseDate = parseCourseDate(dateToCheck);
      return !!courseDate && courseDate >= now && !course.is_closed;
    });

    validCourses.sort((a, b) => {
      const da = parseCourseDate(a.first_date || a.start_date) || new Date(0);
      const db = parseCourseDate(b.first_date || b.start_date) || new Date(0);
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
      const dateObj = parseCourseDate(c.first_date || c.start_date);
      const formattedDate = dateObj
        ? `${formatDateLocal(dateObj)} (${dateObj.toLocaleDateString('en-GB', { weekday: 'long' })})`
        : (c.first_date || c.start_date);

      return {
        id: c.id,
        ref: c.reference ? c.reference.toUpperCase() : '',
        name: c.name.split('|')[0].trim(),
        date: formattedDate,
        venue: c.venue,
        price: c.price_display || c.price,
        available_spaces: c.available_spaces,
        duration: c.total_days ? `${c.total_days} days` : '',
        delivery_type: c.delivery_type || '',
        is_online: !!c.is_online,
        is_nearly_full: !!c.is_nearly_full,
        is_full: !!c.is_full,
      };
    })
  );
};

const MAX_RESULTS = 25;

const QUERY_RELAX_MAP: Array<{ pattern: RegExp; relaxed: string[] }> = [
  { pattern: /nebosh.*national.*general.*certificate/i, relaxed: ['NEBOSH General', 'NEBOSH'] },
  { pattern: /nebosh.*construction/i, relaxed: ['NEBOSH Construction', 'NEBOSH'] },
  { pattern: /temporary works coordinator refresher/i, relaxed: ['TWC REFRESHER', 'TWC'] },
  { pattern: /temporary works coordinator/i, relaxed: ['TWC'] },
  { pattern: /temporary works supervisor/i, relaxed: ['TWS'] },
  { pattern: /site management safety training scheme/i, relaxed: ['SMSTS'] },
  { pattern: /site supervisor.*safety training scheme/i, relaxed: ['SSSTS'] },
];

const toResponseCourse = (c: Course) => {
  const dateObj = parseCourseDate(c.first_date || c.start_date);
  const formattedDate = dateObj
    ? `${formatDateLocal(dateObj)} (${dateObj.toLocaleDateString('en-GB', { weekday: 'long' })})`
    : (c.first_date || c.start_date);

  return {
    id: c.id,
    ref: c.reference ? c.reference.toUpperCase() : '',
    name: c.name.split('|')[0].trim(),
    date: formattedDate,
    venue: c.venue,
    price: c.price,
    price_display: c.price_display || '',
    available_spaces: c.available_spaces,
    total_days: c.total_days || '',
    total_hours: c.total_hours || '',
    delivery_type: c.delivery_type || '',
    is_online: !!c.is_online,
    is_full: !!c.is_full,
    is_nearly_full: !!c.is_nearly_full,
    is_closed: !!c.is_closed,
    link: c.link,
  };
};

const relaxQueryVariants = (query?: string): string[] => {
  if (!query || !query.trim()) return [];
  const normalized = query.trim();
  const variants: string[] = [];

  for (const rule of QUERY_RELAX_MAP) {
    if (rule.pattern.test(normalized)) {
      variants.push(...rule.relaxed);
    }
  }

  const sanitized = normalized
    .replace(/\b(training|course|certificate|scheme|national|in occupational health and safety)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (sanitized && sanitized.toLowerCase() !== normalized.toLowerCase()) {
    variants.push(sanitized);
  }

  return [...new Set(variants)].filter(v => v.toLowerCase() !== normalized.toLowerCase());
};

const runCourseFilter = (
  allCourses: Course[],
  criteria: { query?: string; location?: string; dateStart?: string; dateEnd?: string }
): { filtered: Course[]; preDateFiltered: Course[] } => {
  const { query, location, dateStart, dateEnd } = criteria;
  let filtered = allCourses;

  if (query && query.trim() !== '') {
    const q = query.toLowerCase().trim();
    filtered = filtered.filter(c => {
      const cleanName = c.name.toLowerCase();
      const title = (c.course_title || '').toLowerCase();
      const ref = (c.reference || '').toLowerCase();
      const courseRef = (c.course_reference || '').toLowerCase();
      return cleanName.includes(q) || title.includes(q) || ref.includes(q) || courseRef.includes(q);
    });
  }

  if (location && location.trim() !== '') {
    const locationTerms = location.split(',').map(l => l.trim().toLowerCase()).filter(l => l.length > 0);
    if (locationTerms.length > 0) {
      filtered = filtered.filter(c => {
        const venueLower = c.venue.toLowerCase();
        const isOnline = !!c.is_online || venueLower.includes('online');
        return locationTerms.some(term => {
          if (term === 'online') return isOnline;
          return venueLower.includes(term);
        });
      });
    }
  }

  const preDateFiltered = filtered;

  if (dateStart || dateEnd) {
    let start: Date | null = null;
    if (dateStart) start = parseIsoDateLocal(dateStart);

    let end: Date | null = null;
    if (dateEnd) {
      end = parseIsoDateLocal(dateEnd);
      if (end) end.setHours(23, 59, 59, 999);
    }

    filtered = filtered.filter(c => {
      const cDate = parseCourseDate(c.first_date || c.start_date);
      if (!cDate) return false;
      if (start && cDate < start) return false;
      if (end && cDate > end) return false;
      return true;
    });
  }

  return { filtered, preDateFiltered };
};

// SEARCH FUNCTION FOR AI TOOL USE
export const searchLocalCourses = (
  allCourses: Course[],
  criteria: {
    query?: string;
    location?: string;
    dateStart?: string;
    dateEnd?: string;
    criteriaSource?: Partial<SearchCriteriaSource>;
  }
): SearchLocalResult => {
  const baseCriteria = {
    query: criteria.query?.trim() || undefined,
    location: criteria.location?.trim() || undefined,
    dateStart: criteria.dateStart?.trim() || undefined,
    dateEnd: criteria.dateEnd?.trim() || undefined,
  };

  const criteriaSource: SearchCriteriaSource = {
    query: criteria.criteriaSource?.query || (baseCriteria.query ? 'current_message' : 'none'),
    location: criteria.criteriaSource?.location || (baseCriteria.location ? 'current_message' : 'none'),
    dateStart: criteria.criteriaSource?.dateStart || (baseCriteria.dateStart ? 'current_message' : 'none'),
    dateEnd: criteria.criteriaSource?.dateEnd || (baseCriteria.dateEnd ? 'current_message' : 'none'),
  };

  const attempts: SearchAttempt[] = [];

  const runStage = (
    stage: string,
    stageCriteria: { query?: string; location?: string; dateStart?: string; dateEnd?: string }
  ) => {
    const { filtered, preDateFiltered } = runCourseFilter(allCourses, stageCriteria);
    const limitedResults = filtered.slice(0, MAX_RESULTS);
    attempts.push({
      stage,
      criteria: {
        query: stageCriteria.query,
        location: stageCriteria.location,
        dateStart: stageCriteria.dateStart,
        dateEnd: stageCriteria.dateEnd,
      },
      result_count: limitedResults.length,
    });
    return { limitedResults, preDateFiltered };
  };

  // 1) Strict search
  let activeCriteria = { ...baseCriteria };
  let { limitedResults, preDateFiltered } = runStage('strict', activeCriteria);
  if (limitedResults.length > 0) {
    return {
      courses: limitedResults.map(toResponseCourse),
      message: 'OK',
      applied_criteria: { ...activeCriteria, criteria_source: criteriaSource },
      attempts,
    };
  }

  // 2) Drop stale location first
  if (activeCriteria.location && criteriaSource.location === 'history') {
    activeCriteria = { ...activeCriteria, location: undefined };
    ({ limitedResults, preDateFiltered } = runStage('drop_stale_location', activeCriteria));
    if (limitedResults.length > 0) {
      return {
        courses: limitedResults.map(toResponseCourse),
        message: 'FALLBACK_DROPPED_STALE_LOCATION',
        applied_criteria: { ...activeCriteria, criteria_source: { ...criteriaSource, location: 'none' } },
        attempts,
      };
    }
  }

  // 3) Query relaxation
  const relaxedQueries = relaxQueryVariants(activeCriteria.query);
  for (const relaxedQuery of relaxedQueries) {
    const relaxedCriteria = { ...activeCriteria, query: relaxedQuery };
    ({ limitedResults, preDateFiltered } = runStage('query_relaxed', relaxedCriteria));
    if (limitedResults.length > 0) {
      activeCriteria = relaxedCriteria;
      return {
        courses: limitedResults.map(toResponseCourse),
        message: 'FALLBACK_QUERY_RELAXED',
        applied_criteria: { ...activeCriteria, criteria_source: { ...criteriaSource, query: 'inferred' } },
        attempts,
      };
    }
  }

  // 4) Online fallback (only if a location exists and it's not already online)
  if (activeCriteria.location && !activeCriteria.location.toLowerCase().includes('online')) {
    console.log(`No courses found in ${activeCriteria.location}. Trying fallback to 'Online'...`);
    activeCriteria = { ...activeCriteria, location: 'Online' };
    ({ limitedResults, preDateFiltered } = runStage('online_fallback', activeCriteria));
    if (limitedResults.length > 0) {
      return {
        courses: limitedResults.map(toResponseCourse),
        message: 'FALLBACK_TO_ONLINE',
        applied_criteria: { ...activeCriteria, criteria_source: { ...criteriaSource, location: 'inferred' } },
        attempts,
      };
    }
  }

  // 5) Nearest dates fallback
  if (activeCriteria.dateStart || activeCriteria.dateEnd) {
    const anchorDate = parseIsoDateLocal(activeCriteria.dateEnd || activeCriteria.dateStart || '');
    const anchor = anchorDate || new Date();

    const nearestFuture = preDateFiltered
      .map(c => ({ course: c, date: parseCourseDate(c.first_date || c.start_date) }))
      .filter(item => !!item.date && item.date >= anchor)
      .sort((a, b) => a.date!.getTime() - b.date!.getTime())
      .slice(0, 3)
      .map(item => item.course);

    attempts.push({
      stage: 'nearest_dates',
      criteria: {
        query: activeCriteria.query,
        location: activeCriteria.location,
        dateStart: activeCriteria.dateStart,
        dateEnd: activeCriteria.dateEnd,
      },
      result_count: nearestFuture.length,
    });

    if (nearestFuture.length > 0) {
      return {
        courses: nearestFuture.map(toResponseCourse),
        message: 'FALLBACK_TO_NEAREST_DATES',
        applied_criteria: { ...activeCriteria, criteria_source: criteriaSource },
        attempts,
      };
    }
  }

  // 6) No results
  return {
    courses: [],
    message: 'NO_RESULTS',
    applied_criteria: { ...activeCriteria, criteria_source: criteriaSource },
    attempts,
  };
};
