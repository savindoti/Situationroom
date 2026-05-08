import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSupport } from '../context/SupportContext';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, Hash } from 'lucide-react';

function LiveTimer({ startTime, stopTime }: { startTime: number; stopTime?: number }) {
  const [now, setNow] = useState(stopTime || Date.now());

  useEffect(() => {
    if (stopTime) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [stopTime]);

  const diffInSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
  
  const h = Math.floor(diffInSeconds / 3600);
  const m = Math.floor((diffInSeconds % 3600) / 60);
  const s = diffInSeconds % 60;
  
  if (h > 0) return <span>{h}h {m}m {s}s</span>;
  return <span>{m}m {s}s</span>;
}

import { SupportTask } from '../types';

const STORAGE_KEY = 'daily-tasks-col-widths';

type ColumnKey = 'sn' | 'details' | 'location' | 'org' | 'status' | 'duration' | 'actions';

const DEFAULT_WIDTHS: Record<ColumnKey, number> = {
  sn: 48,
  details: 450,
  location: 176,
  org: 140,
  status: 100,
  duration: 112,
  actions: 160
};

const MIN_WIDTHS: Record<ColumnKey, number> = {
  sn: 40,
  details: 200,
  location: 120,
  org: 100,
  status: 80,
  duration: 80,
  actions: 120
};

export function DailyTasks({ onEdit }: { onEdit: (task: SupportTask) => void }) {
  const { 
    tasks, updateTaskStatus, deleteTask, filterStatus,
    filterProvince, filterDistrict, filterMunicipal,
    startDate, endDate
  } = useSupport();
  const { user, appUser, isSuperAdmin, isAdmin, canWrite } = useAuth();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // Resize State
  const [widths, setWidths] = useState<Record<ColumnKey, number>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_WIDTHS;
      }
    }
    return DEFAULT_WIDTHS;
  });

  const resizingRef = useRef<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);

  const startResizing = useCallback((key: ColumnKey, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = {
      key,
      startX: e.clientX,
      startWidth: widths[key]
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [widths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { key, startX, startWidth } = resizingRef.current;
    if (!key) return;

    const delta = e.clientX - startX;
    const newWidth = Math.max(MIN_WIDTHS[key], startWidth + delta);

    setWidths(prev => {
      const updated = { ...prev, [key]: newWidth };
      return updated;
    });
  }, []);

  const stopResizing = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  }, [widths]);

  const handleDelete = (id: string) => {
    deleteTask(id);
    setConfirmDeleteId(null);
  };

  const canManageTask = (task: SupportTask) => {
    if (isSuperAdmin) return true;
    if (isAdmin && task.ownerId === user?.uid) return true;
    return false;
  };

  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024); // Switch at lg breakpoint
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dailyTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const matchesStatus = filterStatus === 'All' || t.status === filterStatus;
        const matchesProvince = !filterProvince || t.province === filterProvince;
        const matchesDistrict = !filterDistrict || t.district === filterDistrict;
        const matchesMunicipal = !filterMunicipal || t.municipal.toLowerCase().includes(filterMunicipal.toLowerCase());
        
        let matchesDate = true;
        if (startDate) {
          matchesDate = matchesDate && t.date >= startDate;
        }
        if (endDate) {
          matchesDate = matchesDate && t.date <= endDate;
        }

        return matchesStatus && matchesProvince && matchesDistrict && matchesMunicipal && matchesDate;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [tasks, filterStatus, filterProvince, filterDistrict, filterMunicipal, startDate, endDate]);

  // Reset page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterProvince, filterDistrict, filterMunicipal, startDate, endDate]);

  const totalPages = Math.ceil(dailyTasks.length / itemsPerPage);
  const paginatedTasks = dailyTasks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderHandle = (key: ColumnKey) => (
    <div 
      onMouseDown={(e) => startResizing(key, e)}
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-20 group"
      title="Drag to resize"
    >
      <div className="absolute right-[1px] top-1/2 -translate-y-1/2 w-[1px] h-4 bg-white/20 group-hover:bg-white/40" />
    </div>
  );

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="mt-4 flex items-center justify-between px-2 py-3 bg-white dark:bg-slate-900/50 rounded-xl border border-[#D9E2EC] dark:border-slate-800 shadow-sm transition-all">
        <div className="flex items-center gap-2">
          <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest hidden sm:block">
            Showing {Math.min(dailyTasks.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(dailyTasks.length, currentPage * itemsPerPage)} of {dailyTasks.length}
          </p>
          <div className="flex items-center gap-1 sm:hidden">
             <Hash className="w-3 h-3 text-gray-400" />
             <span className="text-[10px] font-bold text-gray-500">{dailyTasks.length} total</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`flex items-center gap-1 px-2.5 sm:px-4 py-2 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-tighter transition-all border ${
              currentPage === 1 
                ? 'bg-gray-50 dark:bg-slate-800 text-gray-300 dark:text-gray-600 border-gray-100 dark:border-slate-800 cursor-not-allowed' 
                : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 shadow-sm'
            }`}
          >
            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
            Prev
          </button>
          
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700">
             <span className="text-[11px] sm:text-sm font-black text-[#0B3C5D] dark:text-blue-400">{currentPage}</span>
             <span className="mx-1 text-[10px] text-gray-400 font-bold">/</span>
             <span className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400">{totalPages}</span>
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`flex items-center gap-1 px-2.5 sm:px-4 py-2 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-tighter transition-all border ${
              currentPage === totalPages 
                ? 'bg-gray-50 dark:bg-slate-800 text-gray-300 dark:text-gray-600 border-gray-100 dark:border-slate-800 cursor-not-allowed' 
                : 'bg-[#0B3C5D] text-white border-[#0B3C5D] hover:bg-[#102A43] active:scale-95 shadow-md'
            }`}
          >
            Next
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 space-y-3 pr-1 overflow-y-auto custom-scrollbar">
          {paginatedTasks.length === 0 ? (
            <div className="py-12 bg-white dark:bg-slate-900 rounded-lg border border-[#D9E2EC] dark:border-slate-800 text-center text-gray-500 dark:text-gray-400">
             <div className="flex flex-col items-center justify-center gap-3">
               <div className="w-6 h-6 border-2 border-[#D9E2EC] dark:border-slate-600 border-t-[#0B3C5D] dark:border-t-slate-400 rounded-full animate-spin"></div>
               <span className="text-sm font-bold uppercase tracking-wider">Awaiting data...</span>
             </div>
          </div>
          ) : (
            paginatedTasks.map((task, idx) => (
              <div key={task.id} className="bg-white dark:bg-slate-900 border border-[#D9E2EC] dark:border-slate-800 p-4 rounded-lg shadow-sm hover:border-blue-500/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 dark:bg-slate-800 px-1.5 py-0.5 rounded leading-none shrink-0">{(currentPage - 1) * itemsPerPage + idx + 1}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
                    task.status === 'Pending' ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7]' : 
                    task.status === 'Ongoing' ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]' :
                    'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                  }`}>
                    {task.status}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400 font-medium mb-0.5 uppercase tracking-wider">Duration</div>
                  <div className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
                    <LiveTimer 
                      startTime={task.createdAt} 
                      stopTime={task.status === 'Resolved' ? task.updatedAt : undefined} 
                    />
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-snug mb-1">{task.details}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{task.organization}</p>
              </div>
              
              <div className="flex items-end justify-between gap-4 mt-auto pt-3 border-t border-gray-50 dark:border-slate-800">
                <div className="flex flex-col font-medium">
                  <span className="text-[11px] text-[#0B3C5D] dark:text-blue-400 font-bold uppercase">{task.district}</span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest">{task.province}</span>
                </div>
                
                <div className="flex gap-2">
                  {canManageTask(task) ? (
                    <>
                      {task.status === 'Pending' && (
                          <button onClick={() => updateTaskStatus(task.id, 'Ongoing')} className="text-white bg-[#0B3C5D] hover:bg-[#102A43] font-bold text-[10px] px-3 py-1.5 rounded uppercase tracking-tighter">Start</button>
                      )}
                      {task.status === 'Ongoing' && (
                          <button onClick={() => updateTaskStatus(task.id, 'Resolved')} className="text-white bg-[#16A34A] hover:bg-[#15803d] font-bold text-[10px] px-3 py-1.5 rounded uppercase tracking-tighter">Resolve</button>
                      )}
                      <button onClick={() => onEdit(task)} className="text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 font-bold text-[10px] px-3 py-1.5 rounded uppercase tracking-tighter">Edit</button>
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase italic opacity-60">Locked</span>
                  )}
                </div>
              </div>
            </div>
            ))
          )}
        </div>
        {renderPagination()}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full gap-3 overflow-hidden">
      <div className="border border-[#D9E2EC] dark:border-slate-700 rounded-lg overflow-x-auto lg:overflow-y-auto bg-white dark:bg-slate-900 relative shadow-sm flex-1 w-full transition-colors scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-700">
        <table className="w-full text-left border-collapse whitespace-nowrap relative table-fixed">
        <thead className="sticky top-0 z-30 shadow-sm">
          <tr className="text-[10px] text-white bg-[#0B3C5D] dark:bg-slate-800 transition-colors uppercase tracking-widest">
            <th style={{ width: widths.sn }} className="py-2 px-4 font-bold border-r border-white/10 text-center relative group">
              S.N.
              {renderHandle('sn')}
            </th>
            <th style={{ width: widths.details }} className="py-2 px-4 font-bold border-r border-white/10 relative group">
              Task Details
              {renderHandle('details')}
            </th>
            <th style={{ width: widths.location }} className="py-2 px-4 font-bold border-r border-white/10 relative group">
              Location Info
              {renderHandle('location')}
            </th>
            <th style={{ width: widths.org }} className="py-2 px-4 font-bold border-r border-white/10 relative group">
              Organization
              {renderHandle('org')}
            </th>
            <th style={{ width: widths.status }} className="py-2 px-4 font-bold border-r border-white/10 relative group">
              Status
              {renderHandle('status')}
            </th>
            <th style={{ width: widths.duration }} className="py-2 px-4 font-bold border-r border-white/10 relative group">
              Duration
              {renderHandle('duration')}
            </th>
            <th style={{ width: widths.actions }} className="py-2 px-4 font-bold relative group">
              Actions
              {renderHandle('actions')}
            </th>
          </tr>
        </thead>
        <tbody className="text-xs">
          {paginatedTasks.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-12 text-center text-gray-500 dark:text-gray-400">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-6 h-6 border-2 border-[#D9E2EC] dark:border-slate-600 border-t-[#0B3C5D] dark:border-t-slate-400 rounded-full animate-spin"></div>
                  <span className="text-sm font-bold uppercase tracking-wider">Awaiting dynamic data feed...</span>
                </div>
              </td>
            </tr>
          ) : (
             paginatedTasks.map((task, idx) => (
                <tr key={task.id} className="border-b border-[#D9E2EC] dark:border-slate-700/50 hover:bg-[#F4F7FA] dark:hover:bg-slate-800/80 transition-colors even:bg-gray-50/30 dark:even:bg-slate-800/20">
                  <td className="py-2 px-4 text-gray-500 dark:text-gray-400 font-bold border-r border-[#D9E2EC] dark:border-slate-700/30 text-center">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                  <td className="py-2 px-4 dark:text-gray-200 border-r border-[#D9E2EC] dark:border-slate-700/30 overflow-hidden" title={task.details}>
                    <div className="flex flex-col overflow-hidden w-full">
                      <span className="font-bold text-gray-800 dark:text-gray-100 whitespace-normal line-clamp-2 leading-tight mb-1">{task.details}</span>
                      <span className="text-[10px] text-gray-400 font-medium">Recorded: {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </td>
                  <td className="py-2 px-4 dark:text-gray-300 border-r border-[#D9E2EC] dark:border-slate-700/30 overflow-hidden">
                    <div className="flex flex-col font-medium truncate w-full">
                      <span className="text-[#0B3C5D] dark:text-blue-400 font-bold truncate">{task.district}</span>
                      <span className="text-[10px] text-gray-500 truncate">{task.province}</span>
                    </div>
                  </td>
                  <td className="py-2 px-4 font-bold text-gray-800 dark:text-gray-100 border-r border-[#D9E2EC] dark:border-slate-700/30 uppercase truncate" title={task.organization}>{task.organization}</td>
                  <td className="py-2 px-4 border-r border-[#D9E2EC] dark:border-slate-700/30 text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter inline-block min-w-16 ${
                      task.status === 'Pending' ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7] animate-pulse' : 
                      task.status === 'Ongoing' ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]' :
                      'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                    }`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="py-2 px-4 font-mono font-bold text-gray-700 dark:text-gray-300 border-r border-[#D9E2EC] dark:border-slate-700/30 text-center">
                     <LiveTimer 
                        startTime={task.createdAt} 
                        stopTime={task.status === 'Resolved' ? task.updatedAt : undefined} 
                     />
                  </td>
                  <td className="py-2 px-4 flex gap-1.5 flex-nowrap items-center">
                    {canManageTask(task) ? (
                      <>
                        {task.status === 'Pending' && (
                            <button onClick={() => updateTaskStatus(task.id, 'Ongoing')} className="text-white bg-[#0B3C5D] hover:bg-[#102A43] font-bold text-[9px] px-2 py-1 rounded transition-colors uppercase tracking-tighter">Start</button>
                        )}
                        {task.status === 'Ongoing' && (
                            <button onClick={() => updateTaskStatus(task.id, 'Resolved')} className="text-white bg-[#16A34A] hover:bg-[#15803d] font-bold text-[9px] px-2 py-1 rounded transition-colors uppercase tracking-tighter">Resolve</button>
                        )}
                        <button onClick={() => onEdit(task)} className="text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 font-bold text-[9px] px-2 py-1 rounded transition-colors uppercase tracking-tighter">Edit</button>
                        {confirmDeleteId === task.id ? (
                            <div className="flex items-center gap-1 bg-[#FEF2F2] dark:bg-red-900/40 rounded p-0.5 border border-[#FEE2E2]">
                              <button onClick={() => handleDelete(task.id)} className="text-[#D32F2F] font-bold text-[9px] px-1.5 py-0.5 uppercase">Confirm?</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="text-gray-400 text-xs px-1 hover:text-gray-600 transition-colors">&times;</button>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmDeleteId(task.id)} className="text-[#D64545] border border-[#FBBFBF] hover:bg-[#FEF2F2] font-bold text-[9px] px-2 py-1 rounded transition-colors uppercase tracking-tighter">Delete</button>
                        )}
                      </>
                    ) : (
                      <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-tight italic opacity-60">Locked</span>
                    )}
                  </td>
                </tr>
             ))
          )}
        </tbody>
      </table>
    </div>
    {renderPagination()}
  </div>
);
}
