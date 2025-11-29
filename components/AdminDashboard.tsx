import React, { useState, useEffect } from 'react';
import { analytics } from '../services/analyticsService';
import { AnalyticsSession } from '../types';

interface AdminDashboardProps {
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [sessions, setSessions] = useState<AnalyticsSession[]>([]);

  useEffect(() => {
    setSessions(analytics.getAllData());
  }, []);

  const handleClear = () => {
    if (window.confirm("Are you sure you want to delete all analytics data?")) {
        analytics.clearData();
        setSessions([]);
    }
  };

  // Calculate Stats
  const totalVisits = sessions.length;
  const totalConversions = sessions.filter(s => s.converted).length;
  const conversionRate = totalVisits > 0 ? ((totalConversions / totalVisits) * 100).toFixed(1) : "0.0";
  const avgDuration = totalVisits > 0 
    ? (sessions.reduce((acc, s) => acc + s.durationSeconds, 0) / totalVisits).toFixed(0) 
    : "0";

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-[#00a884] px-4 py-4 shadow-md flex items-center justify-between shrink-0">
        <h1 className="text-white font-bold text-lg">Admin Analytics</h1>
        <button 
            onClick={onClose}
            className="text-white hover:bg-white/20 px-3 py-1 rounded-md text-sm font-medium transition-colors"
        >
            Back to Chat
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         {/* Stats Cards */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wide">Total Visits</h3>
                <p className="text-3xl font-bold text-gray-800 mt-1">{totalVisits}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wide">Avg Duration</h3>
                <p className="text-3xl font-bold text-gray-800 mt-1">{avgDuration}s</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wide">Conversion Rate</h3>
                <p className="text-3xl font-bold text-[#00a884] mt-1">{conversionRate}%</p>
                <p className="text-xs text-gray-400 mt-1">{totalConversions} clicks</p>
            </div>
         </div>

         {/* Data Table */}
         <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h2 className="font-bold text-gray-700">Session Logs</h2>
                <button onClick={handleClear} className="text-red-500 hover:text-red-700 text-xs font-medium">Clear Data</button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-100 text-gray-800 font-semibold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Time</th>
                            <th className="px-6 py-3">IP (Mock)</th>
                            <th className="px-6 py-3">Duration</th>
                            <th className="px-6 py-3">Searches (Term / Period)</th>
                            <th className="px-6 py-3 text-center">Converted</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {sessions.length === 0 ? (
                             <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No data recorded yet.</td></tr>
                        ) : (
                            sessions.map((session) => (
                                <tr key={session.sessionId} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {new Date(session.startTime).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs">{session.ip}</td>
                                    <td className="px-6 py-4">{session.durationSeconds}s</td>
                                    <td className="px-6 py-4">
                                        {session.searches.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                {session.searches.map((s, i) => (
                                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                       {s.term} <span className="text-blue-400 mx-1">•</span> {s.period}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">None</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {session.converted ? (
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            </span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                        {session.clickedCourseId && (
                                            <div className="text-[10px] text-gray-500 mt-1 max-w-[100px] truncate mx-auto" title={session.clickedCourseId}>
                                                {session.clickedCourseId}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
         </div>
      </div>
    </div>
  );
};