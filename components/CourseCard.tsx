import React from 'react';
import { Course } from '../types';

interface CourseCardProps {
  course: Course;
  onVisit?: (courseName: string) => void;
  language: string;
}

type Labels = {
  online: string;
  inClass: string;
  closed: string;
  full: string;
  nearlyFull: string;
  venueTbc: string;
  durationTbc: string;
  spacesLeft: string;
  spaceSingular: string;
  spacePlural: string;
  daySingular: string;
  dayPlural: string;
  hourSingular: string;
  hourPlural: string;
  notAvailable: string;
  bookNow: string;
  vat: string;
};

const LABELS: Record<string, Labels> = {
  'en-US': {
    online: 'Online',
    inClass: 'In class',
    closed: 'Closed',
    full: 'Full',
    nearlyFull: 'Nearly full',
    venueTbc: 'Venue TBC',
    durationTbc: 'Duration TBC',
    spacesLeft: 'left',
    spaceSingular: 'space',
    spacePlural: 'spaces',
    daySingular: 'day',
    dayPlural: 'days',
    hourSingular: 'hour',
    hourPlural: 'hours',
    notAvailable: 'Not available',
    bookNow: 'Book now',
    vat: 'VAT',
  },
  'ro-RO': {
    online: 'Online',
    inClass: 'In clasa',
    closed: 'Inchis',
    full: 'Complet',
    nearlyFull: 'Aproape complet',
    venueTbc: 'Locatie in curs de confirmare',
    durationTbc: 'Durata in curs de confirmare',
    spacesLeft: 'ramase',
    spaceSingular: 'loc',
    spacePlural: 'locuri',
    daySingular: 'zi',
    dayPlural: 'zile',
    hourSingular: 'ora',
    hourPlural: 'ore',
    notAvailable: 'Indisponibil',
    bookNow: 'Rezerva acum',
    vat: 'TVA',
  },
  'pl-PL': {
    online: 'Online',
    inClass: 'Stacjonarnie',
    closed: 'Zamkniety',
    full: 'Brak miejsc',
    nearlyFull: 'Prawie pelny',
    venueTbc: 'Miejsce do potwierdzenia',
    durationTbc: 'Czas trwania do potwierdzenia',
    spacesLeft: 'pozostalo',
    spaceSingular: 'miejsce',
    spacePlural: 'miejsca',
    daySingular: 'dzien',
    dayPlural: 'dni',
    hourSingular: 'godzina',
    hourPlural: 'godziny',
    notAvailable: 'Niedostepne',
    bookNow: 'Zarezerwuj',
    vat: 'VAT',
  },
  'bg-BG': {
    online: 'Online',
    inClass: 'Prisastveno',
    closed: 'Zatvoreno',
    full: 'Pulno',
    nearlyFull: 'Pochti pulno',
    venueTbc: 'Lokaciya v ochakvane',
    durationTbc: 'Produljitelnost v ochakvane',
    spacesLeft: 'ostavashti',
    spaceSingular: 'myasto',
    spacePlural: 'mesta',
    daySingular: 'den',
    dayPlural: 'dni',
    hourSingular: 'chas',
    hourPlural: 'chasa',
    notAvailable: 'Nedostupno',
    bookNow: 'Rezervirai',
    vat: 'DDS',
  },
  'hu-HU': {
    online: 'Online',
    inClass: 'Tantermi',
    closed: 'Lezart',
    full: 'Betelt',
    nearlyFull: 'Majdnem betelt',
    venueTbc: 'Helyszin kesobb',
    durationTbc: 'Idotartam kesobb',
    spacesLeft: 'szabad hely',
    spaceSingular: 'hely',
    spacePlural: 'hely',
    daySingular: 'nap',
    dayPlural: 'nap',
    hourSingular: 'ora',
    hourPlural: 'ora',
    notAvailable: 'Nem elerheto',
    bookNow: 'Foglalas',
    vat: 'AFA',
  },
  'cs-CZ': {
    online: 'Online',
    inClass: 'Prezenicne',
    closed: 'Uzavreno',
    full: 'Obsazeno',
    nearlyFull: 'Temer plne',
    venueTbc: 'Misto bude potvrzeno',
    durationTbc: 'Delka bude potvrzena',
    spacesLeft: 'zbyva',
    spaceSingular: 'misto',
    spacePlural: 'mista',
    daySingular: 'den',
    dayPlural: 'dny',
    hourSingular: 'hodina',
    hourPlural: 'hodiny',
    notAvailable: 'Nedostupne',
    bookNow: 'Rezervovat',
    vat: 'DPH',
  },
};

const getLabels = (language: string): Labels => LABELS[language] || LABELS['en-US'];

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseFlexibleDate = (value: string): Date | null => {
  const input = (value || '').trim();
  if (!input) return null;

  const iso = parseIsoDate(input);
  if (iso) return iso;

  const dmy = input.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const yearRaw = Number(dmy[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const cleaned = input.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, '');
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toTitleCase = (value: string): string =>
  value
    .split(' ')
    .map(part => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');

const formatLongDate = (value: string, language: string): string => {
  const parsed = parseFlexibleDate(value);
  if (!parsed) return value;
  const formatted = parsed.toLocaleDateString(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return toTitleCase(formatted);
};

const getCourseSessionDates = (course: Course): string[] => {
  const rawSessionDays = (
    (course.attributes?.session_days_comma_separated as string) ||
    course.session_days ||
    course.dates_list ||
    ''
  ).trim();

  const parsedDates: Date[] = [];

  if (rawSessionDays) {
    const tokens = rawSessionDays
      .split(/[,;]+/)
      .map(t => t.trim())
      .filter(Boolean);

    for (const token of tokens) {
      const parsed = parseFlexibleDate(token);
      if (parsed) parsedDates.push(parsed);
    }
  }

  if (parsedDates.length === 0) {
    const start = parseFlexibleDate(course.start_date);
    const end = parseFlexibleDate(course.last_date || course.end_date || course.start_date);
    if (start && end && end >= start) {
      const cursor = new Date(start);
      while (cursor <= end) {
        parsedDates.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (start) {
      parsedDates.push(start);
    }
  }

  const deduped = new Map<string, Date>();
  for (const date of parsedDates) {
    deduped.set(toDateKey(date), date);
  }

  return [...deduped.values()]
    .sort((a, b) => a.getTime() - b.getTime())
    .map(d => toDateKey(d));
};

const pluralize = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

const localizePrice = (price: string, labels: Labels): string => {
  if (!price) return '';
  return price.replace(/\bVAT\b/g, labels.vat);
};

const buildMapsAddress = (course: Course): string => {
  const fromFullAddress = (course.venue_full_address || '').trim();
  if (fromFullAddress) return fromFullAddress;

  const parts = [
    course.venue_name || '',
    course.venue || '',
    course.venue_city || '',
    course.venue_postcode || '',
    course.venue_country || '',
  ]
    .map(v => (v || '').trim())
    .filter(Boolean);

  return parts.join(', ');
};

export const CourseCard: React.FC<CourseCardProps> = ({ course, onVisit, language }) => {
  const labels = getLabels(language);
  const cleanName = course.name ? course.name.split('|')[0].trim() : 'Course';
  const isClosed = !!course.is_closed;
  const isFull = !!course.is_full;
  const isNearlyFull = !!course.is_nearly_full;
  const isOnline = !!course.is_online;
  const isUnavailable = isClosed || isFull;
  const availableSpaces = Number.isFinite(course.available_spaces) ? course.available_spaces : 0;
  const rawPriceDisplay = course.price_display || `GBP ${course.price} + VAT`;
  const priceDisplay = localizePrice(rawPriceDisplay, labels);
  const displayVenue = course.venue || (isOnline ? labels.online : labels.venueTbc);
  const mapsAddress = buildMapsAddress(course);
  const mapsUrl = mapsAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsAddress)}` : '';
  const venueCityLabel = (course.venue_city || '').trim() || displayVenue;

  const totalDays = Number(course.total_days || 0);
  const totalHours = Number(course.total_hours || 0);
  const durationDisplay = totalDays > 0
    ? `${pluralize(totalDays, labels.daySingular, labels.dayPlural)}${totalHours > 0 ? ` (${pluralize(totalHours, labels.hourSingular, labels.hourPlural)})` : ''}`
    : (totalHours > 0 ? pluralize(totalHours, labels.hourSingular, labels.hourPlural) : labels.durationTbc);

  const sessionDates = getCourseSessionDates(course);
  const dateLines = sessionDates.length > 0
    ? sessionDates.map(date => formatLongDate(date, language))
    : [formatLongDate(course.start_date, language)];
  const showDateBullets = dateLines.length > 1;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden min-w-[260px] max-w-[280px] flex-shrink-0 hover:shadow-md transition-all duration-200 flex flex-col">
      <div className="bg-[#00a884] px-3 py-2 flex justify-between items-center gap-2">
        <span className="text-white text-xs font-bold tracking-wide bg-white/20 px-2 py-0.5 rounded backdrop-blur-sm">
          {course.reference || 'CURS'}
        </span>
        <span className="text-white font-bold text-xs text-right">{priceDisplay}</span>
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-bold text-gray-800 text-sm mb-3 leading-tight line-clamp-3 min-h-[3rem]" title={cleanName}>
          {cleanName}
        </h3>

        <div className="mb-3 flex flex-wrap gap-1">
          {isClosed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-semibold">{labels.closed}</span>}
          {!isClosed && isFull && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">{labels.full}</span>}
          {!isClosed && !isFull && isNearlyFull && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">{labels.nearlyFull}</span>}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isOnline ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {isOnline ? labels.online : labels.inClass}
          </span>
        </div>

        <div className="space-y-2 text-xs text-gray-600 mb-4 flex-1">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <div className="flex flex-col">
              {dateLines.map((line, idx) => (
                <span key={`${course.id}-date-${idx}`} className="font-medium text-gray-700">
                  {showDateBullets ? `• ${line}` : line}
                </span>
              ))}
              {course.start_time && <span className="text-gray-400 text-[10px]">{course.start_time}</span>}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            {(!isOnline && mapsUrl) ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 underline decoration-[#00a884] hover:text-[#008069]"
                title={mapsAddress}
              >
                {venueCityLabel}
              </a>
            ) : (
              <span className="line-clamp-2" title={displayVenue}>{displayVenue}</span>
            )}
          </div>

          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>{durationDisplay}</span>
          </div>

          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h2m-8 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            <span>
              {pluralize(availableSpaces, labels.spaceSingular, labels.spacePlural)} {labels.spacesLeft}
              {course.delivery_type ? ` | ${course.delivery_type}` : ''}
            </span>
          </div>
        </div>

        {isUnavailable ? (
          <div className="mt-auto block w-full text-center py-2 bg-gray-100 text-gray-500 font-semibold rounded-md text-sm border border-gray-200">
            {labels.notAvailable}
          </div>
        ) : (
          <a
            href={course.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onVisit && onVisit(cleanName)}
            className="mt-auto block w-full text-center py-2 bg-[#f0f2f5] hover:bg-[#25d366] hover:text-white text-[#008069] font-semibold rounded-md transition-colors text-sm border border-transparent hover:border-[#25d366]"
          >
            {labels.bookNow}
          </a>
        )}
      </div>
    </div>
  );
};
