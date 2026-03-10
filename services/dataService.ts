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
const DATE_EXPANSION_DAYS = 45;
const MIN_RESULTS_TARGET = 3;
const FUTURE_TOPUP_DAYS = 120;

const QUERY_RELAX_MAP: Array<{ pattern: RegExp; relaxed: string[] }> = [
  { pattern: /nebosh.*national.*general.*certificate/i, relaxed: ['NEBOSH General', 'NEBOSH'] },
  { pattern: /nebosh.*construction/i, relaxed: ['NEBOSH Construction', 'NEBOSH'] },
  { pattern: /temporary works coordinator refresher/i, relaxed: ['TWC REFRESHER', 'TWC'] },
  { pattern: /temporary works coordinator/i, relaxed: ['TWC'] },
  { pattern: /temporary works supervisor/i, relaxed: ['TWS'] },
  { pattern: /site management safety training scheme/i, relaxed: ['SMSTS'] },
  { pattern: /site supervisor.*safety training scheme/i, relaxed: ['SSSTS'] },
];

const normalizeDeliveryType = (value?: string): string | undefined => {
  const v = (value || '').trim().toLowerCase();
  if (!v) return undefined;

  if (/(day[\s-]?release|weekly|once a week|one day a week|saptaman|saptamana|saptamanal)/i.test(v)) return 'day_release';
  if (/weekend/i.test(v)) return 'weekend';
  if (/block|consecutive|intensiv|intensive/i.test(v)) return 'block';
  if (/online/i.test(v)) return 'online';

  return v.replace(/\s+/g, '_');
};

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

const isCourseBookable = (course: Course): boolean => {
  if (course.is_closed) return false;
  if (course.is_full) return false;
  return course.available_spaces > 0;
};

const sortCoursesByUsefulness = (courses: Course[]): Course[] => {
  return [...courses].sort((a, b) => {
    const aBookable = isCourseBookable(a);
    const bBookable = isCourseBookable(b);
    if (aBookable !== bBookable) return aBookable ? -1 : 1;

    const aSpaces = a.available_spaces || 0;
    const bSpaces = b.available_spaces || 0;
    if (aSpaces !== bSpaces) return bSpaces - aSpaces;

    const da = parseCourseDate(a.first_date || a.start_date) || new Date(8640000000000000);
    const db = parseCourseDate(b.first_date || b.start_date) || new Date(8640000000000000);
    return da.getTime() - db.getTime();
  });
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
  criteria: { query?: string; location?: string; dateStart?: string; dateEnd?: string; deliveryType?: string; courseVariant?: string }
): { filtered: Course[]; preDateFiltered: Course[] } => {
  const { query, location, dateStart, dateEnd, deliveryType, courseVariant } = criteria;
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

  const normalizedDeliveryType = normalizeDeliveryType(deliveryType);
  if (normalizedDeliveryType) {
    filtered = filtered.filter(c => {
      const code = normalizeDeliveryType(c.delivery_type_code || '');
      const label = normalizeDeliveryType(c.delivery_type || '');

      if (normalizedDeliveryType === 'online') {
        return !!c.is_online || (c.venue || '').toLowerCase().includes('online');
      }

      return code === normalizedDeliveryType || label === normalizedDeliveryType;
    });
  }

  if (courseVariant === 'refresher' || courseVariant === 'standard') {
    filtered = filtered.filter(c => {
      const name = `${c.name || ''} ${c.course_title || ''}`.toLowerCase();
      const isRefresher = /\brefresher\b/.test(name);
      return courseVariant === 'refresher' ? isRefresher : !isRefresher;
    });
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
    deliveryType?: string;
    courseVariant?: string;
    criteriaSource?: Partial<SearchCriteriaSource>;
  }
): SearchLocalResult => {
  const baseCriteria = {
    query: criteria.query?.trim() || undefined,
    location: criteria.location?.trim() || undefined,
    dateStart: criteria.dateStart?.trim() || undefined,
    dateEnd: criteria.dateEnd?.trim() || undefined,
    deliveryType: normalizeDeliveryType(criteria.deliveryType?.trim() || undefined),
    courseVariant: criteria.courseVariant?.trim() || undefined,
  };

  const criteriaSource: SearchCriteriaSource = {
    query: criteria.criteriaSource?.query || (baseCriteria.query ? 'current_message' : 'none'),
    location: criteria.criteriaSource?.location || (baseCriteria.location ? 'current_message' : 'none'),
    dateStart: criteria.criteriaSource?.dateStart || (baseCriteria.dateStart ? 'current_message' : 'none'),
    dateEnd: criteria.criteriaSource?.dateEnd || (baseCriteria.dateEnd ? 'current_message' : 'none'),
    deliveryType: criteria.criteriaSource?.deliveryType || (baseCriteria.deliveryType ? 'current_message' : 'none'),
    courseVariant: criteria.criteriaSource?.courseVariant || (baseCriteria.courseVariant ? 'current_message' : 'none'),
  };

  const attempts: SearchAttempt[] = [];
  let bestUnavailableCandidates: Course[] = [];
  const hasAnyDateFilter = !!(baseCriteria.dateStart || baseCriteria.dateEnd);

  const runStage = (
    stage: string,
    stageCriteria: { query?: string; location?: string; dateStart?: string; dateEnd?: string; deliveryType?: string; courseVariant?: string }
  ) => {
    const { filtered, preDateFiltered } = runCourseFilter(allCourses, stageCriteria);
    const sorted = sortCoursesByUsefulness(filtered);
    const bookable = sorted.filter(isCourseBookable);
    const limitedBookable = bookable.slice(0, MAX_RESULTS);
    const limitedAny = sorted.slice(0, MAX_RESULTS);
    if (bestUnavailableCandidates.length === 0 && limitedAny.length > 0) {
      bestUnavailableCandidates = limitedAny;
    }
    attempts.push({
      stage,
      criteria: {
        query: stageCriteria.query,
        location: stageCriteria.location,
        dateStart: stageCriteria.dateStart,
        dateEnd: stageCriteria.dateEnd,
        deliveryType: stageCriteria.deliveryType,
        courseVariant: stageCriteria.courseVariant,
      },
      result_count: limitedBookable.length,
    });
    return { limitedBookable, limitedAny, preDateFiltered };
  };

  const ensureMinimumBookable = (
    baseCourses: Course[],
    currentCriteria: { query?: string; location?: string; dateStart?: string; dateEnd?: string; deliveryType?: string; courseVariant?: string }
  ): {
    courses: Course[];
    messageSuffix?: string;
    criteria: { query?: string; location?: string; dateStart?: string; dateEnd?: string; deliveryType?: string; courseVariant?: string };
    criteriaSourcePatch?: Partial<SearchCriteriaSource>;
  } => {
    if (baseCourses.length >= MIN_RESULTS_TARGET) {
      return { courses: baseCourses, criteria: currentCriteria };
    }

    const anchorFromCriteria = parseIsoDateLocal(currentCriteria.dateEnd || currentCriteria.dateStart || '');
    const anchorFromResults = baseCourses.length > 0
      ? parseCourseDate(baseCourses[baseCourses.length - 1].first_date || baseCourses[baseCourses.length - 1].start_date)
      : null;
    const anchor = anchorFromCriteria || anchorFromResults || new Date();

    const topupStart = new Date(anchor);
    topupStart.setDate(topupStart.getDate() + 1);
    const topupEnd = new Date(topupStart);
    topupEnd.setDate(topupEnd.getDate() + FUTURE_TOPUP_DAYS);

    const topupCriteria = {
      ...currentCriteria,
      dateStart: formatDateLocal(topupStart),
      dateEnd: formatDateLocal(topupEnd),
    };

    const { limitedBookable } = runStage('topup_future_dates', topupCriteria);
    if (limitedBookable.length === 0) {
      return { courses: baseCourses, criteria: currentCriteria };
    }

    const existingIds = new Set(baseCourses.map(c => c.id));
    const extras = limitedBookable.filter(c => !existingIds.has(c.id));
    if (extras.length === 0) {
      return { courses: baseCourses, criteria: currentCriteria };
    }

    const merged = [...baseCourses, ...extras].slice(0, MIN_RESULTS_TARGET);
    return {
      courses: merged,
      messageSuffix: 'FALLBACK_TOPUP_FUTURE_DATES',
      criteria: topupCriteria,
      criteriaSourcePatch: {
        dateStart: hasAnyDateFilter ? 'history' : 'inferred',
        dateEnd: 'inferred',
      },
    };
  };

  const appendMessage = (baseMessage: string, suffix?: string): string => {
    if (!suffix) return baseMessage;
    return `${baseMessage}|${suffix}`;
  };

  // 1) Strict search
  let activeCriteria = { ...baseCriteria };
  let { limitedBookable, limitedAny, preDateFiltered } = runStage('strict', activeCriteria);
  if (limitedBookable.length > 0) {
    const topped = ensureMinimumBookable(limitedBookable, activeCriteria);
    return {
      courses: topped.courses.map(toResponseCourse),
      message: appendMessage('OK', topped.messageSuffix),
      applied_criteria: {
        ...topped.criteria,
        criteria_source: { ...criteriaSource, ...(topped.criteriaSourcePatch || {}) }
      },
      attempts,
    };
  }

  // 1b) Relax delivery type if it was explicitly requested and no strict matches
  if (activeCriteria.deliveryType) {
    const relaxedDeliveryCriteria = { ...activeCriteria, deliveryType: undefined };
    ({ limitedBookable, limitedAny, preDateFiltered } = runStage('delivery_type_relaxed', relaxedDeliveryCriteria));
    if (limitedBookable.length > 0) {
      activeCriteria = relaxedDeliveryCriteria;
      const topped = ensureMinimumBookable(limitedBookable, activeCriteria);
      return {
        courses: topped.courses.map(toResponseCourse),
        message: appendMessage('FALLBACK_RELAXED_DELIVERY_TYPE', topped.messageSuffix),
        applied_criteria: {
          ...topped.criteria,
          criteria_source: { ...criteriaSource, deliveryType: 'none', ...(topped.criteriaSourcePatch || {}) }
        },
        attempts,
      };
    }
  }

  // 2) Drop stale location first
  if (activeCriteria.location && criteriaSource.location === 'history') {
    activeCriteria = { ...activeCriteria, location: undefined };
    ({ limitedBookable, limitedAny, preDateFiltered } = runStage('drop_stale_location', activeCriteria));
    if (limitedBookable.length > 0) {
      const topped = ensureMinimumBookable(limitedBookable, activeCriteria);
      return {
        courses: topped.courses.map(toResponseCourse),
        message: appendMessage('FALLBACK_DROPPED_STALE_LOCATION', topped.messageSuffix),
        applied_criteria: {
          ...topped.criteria,
          criteria_source: { ...criteriaSource, location: 'none', ...(topped.criteriaSourcePatch || {}) }
        },
        attempts,
      };
    }
  }

  // 3) Query relaxation
  const relaxedQueries = relaxQueryVariants(activeCriteria.query);
  for (const relaxedQuery of relaxedQueries) {
      const relaxedCriteria = { ...activeCriteria, query: relaxedQuery };
    ({ limitedBookable, limitedAny, preDateFiltered } = runStage('query_relaxed', relaxedCriteria));
    if (limitedBookable.length > 0) {
      activeCriteria = relaxedCriteria;
      const topped = ensureMinimumBookable(limitedBookable, activeCriteria);
      return {
        courses: topped.courses.map(toResponseCourse),
        message: appendMessage('FALLBACK_QUERY_RELAXED', topped.messageSuffix),
        applied_criteria: {
          ...topped.criteria,
          criteria_source: { ...criteriaSource, query: 'inferred', ...(topped.criteriaSourcePatch || {}) }
        },
        attempts,
      };
    }
  }

  // 4) Expanded date window fallback
  if (activeCriteria.dateStart || activeCriteria.dateEnd) {
    const dateAnchor = parseIsoDateLocal(activeCriteria.dateEnd || activeCriteria.dateStart || '');
    if (dateAnchor) {
      const expandedEnd = new Date(dateAnchor);
      expandedEnd.setDate(expandedEnd.getDate() + DATE_EXPANSION_DAYS);
      const expandedCriteria = {
        ...activeCriteria,
        dateEnd: formatDateLocal(expandedEnd),
      };
      ({ limitedBookable, limitedAny, preDateFiltered } = runStage('date_expanded', expandedCriteria));
      if (limitedBookable.length > 0) {
        activeCriteria = expandedCriteria;
        const topped = ensureMinimumBookable(limitedBookable, activeCriteria);
        return {
          courses: topped.courses.map(toResponseCourse),
          message: appendMessage('FALLBACK_EXPANDED_DATES', topped.messageSuffix),
          applied_criteria: {
            ...topped.criteria,
            criteria_source: { ...criteriaSource, dateEnd: 'inferred', ...(topped.criteriaSourcePatch || {}) }
          },
          attempts,
        };
      }
    }
  }

  // 5) Expanded location fallback (drop location constraint)
  if (activeCriteria.location) {
    const expandedLocationCriteria = { ...activeCriteria, location: undefined };
    ({ limitedBookable, limitedAny, preDateFiltered } = runStage('location_expanded', expandedLocationCriteria));
    if (limitedBookable.length > 0) {
      activeCriteria = expandedLocationCriteria;
      const topped = ensureMinimumBookable(limitedBookable, activeCriteria);
      return {
        courses: topped.courses.map(toResponseCourse),
        message: appendMessage('FALLBACK_EXPANDED_LOCATION', topped.messageSuffix),
        applied_criteria: {
          ...topped.criteria,
          criteria_source: { ...criteriaSource, location: 'inferred', ...(topped.criteriaSourcePatch || {}) }
        },
        attempts,
      };
    }
  }

  // 6) Online fallback (only if a location exists and it's not already online)
  if (activeCriteria.location && !activeCriteria.location.toLowerCase().includes('online')) {
    console.log(`No courses found in ${activeCriteria.location}. Trying fallback to 'Online'...`);
    activeCriteria = { ...activeCriteria, location: 'Online' };
    ({ limitedBookable, limitedAny, preDateFiltered } = runStage('online_fallback', activeCriteria));
    if (limitedBookable.length > 0) {
      const topped = ensureMinimumBookable(limitedBookable, activeCriteria);
      return {
        courses: topped.courses.map(toResponseCourse),
        message: appendMessage('FALLBACK_TO_ONLINE', topped.messageSuffix),
        applied_criteria: {
          ...topped.criteria,
          criteria_source: { ...criteriaSource, location: 'inferred', ...(topped.criteriaSourcePatch || {}) }
        },
        attempts,
      };
    }
  }

  // 7) Nearest dates fallback
  if (activeCriteria.dateStart || activeCriteria.dateEnd) {
    const anchorDate = parseIsoDateLocal(activeCriteria.dateEnd || activeCriteria.dateStart || '');
    const anchor = anchorDate || new Date();

    const nearestFuture = sortCoursesByUsefulness(preDateFiltered)
      .map(c => ({ course: c, date: parseCourseDate(c.first_date || c.start_date) }))
      .filter(item => !!item.date && item.date >= anchor && isCourseBookable(item.course))
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
      const topped = ensureMinimumBookable(nearestFuture, activeCriteria);
      return {
        courses: topped.courses.map(toResponseCourse),
        message: appendMessage('FALLBACK_TO_NEAREST_DATES', topped.messageSuffix),
        applied_criteria: {
          ...topped.criteria,
          criteria_source: { ...criteriaSource, ...(topped.criteriaSourcePatch || {}) }
        },
        attempts,
      };
    }
  }

  // 8) As a last meaningful fallback, return best matches even if unavailable.
  if (bestUnavailableCandidates.length > 0) {
    return {
      courses: bestUnavailableCandidates.map(toResponseCourse),
      message: 'FALLBACK_ONLY_UNAVAILABLE',
      applied_criteria: { ...activeCriteria, criteria_source: criteriaSource },
      attempts,
    };
  }

  // 9) No results
  return {
    courses: [],
    message: 'NO_RESULTS',
    applied_criteria: { ...activeCriteria, criteria_source: criteriaSource },
    attempts,
  };
};
