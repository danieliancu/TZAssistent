import React from 'react';
import { Course } from '../types';

interface CourseCardProps {
  course: Course;
  onVisit?: (courseName: string) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, onVisit }) => {
  // Extract clean name (before the pipe) as requested, with defensive check
  const cleanName = course.name ? course.name.split('|')[0].trim() : 'Course';
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden min-w-[260px] max-w-[280px] flex-shrink-0 hover:shadow-md transition-all duration-200 flex flex-col">
      {/* Header Band */}
      <div className="bg-[#00a884] px-3 py-2 flex justify-between items-center">
         <span className="text-white text-xs font-bold tracking-wide bg-white/20 px-2 py-0.5 rounded backdrop-blur-sm">
            {course.reference || 'CURS'}
         </span>
         <span className="text-white font-bold text-sm">£{course.price}</span>
      </div>

      <div className="p-3 flex flex-col flex-1">
        {/* Course Name */}
        <h3 className="font-bold text-gray-800 text-sm mb-3 leading-tight line-clamp-3 min-h-[3rem]" title={cleanName}>
          {cleanName}
        </h3>

        {/* Details Grid */}
        <div className="space-y-2 text-xs text-gray-600 mb-4 flex-1">
            <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-700">{course.start_date}</span>
                  {course.start_time && <span className="text-gray-400 text-[10px]">{course.start_time}</span>}
                </div>
            </div>
            
            <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <span className="line-clamp-2" title={course.venue}>{course.venue}</span>
            </div>
        </div>

        {/* Action Button */}
        <a 
            href={course.link} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={() => onVisit && onVisit(cleanName)}
            className="mt-auto block w-full text-center py-2 bg-[#f0f2f5] hover:bg-[#25d366] hover:text-white text-[#008069] font-semibold rounded-md transition-colors text-sm border border-transparent hover:border-[#25d366]"
        >
            Book now
        </a>
      </div>
    </div>
  );
};