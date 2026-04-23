import { useState, useEffect } from 'react';
import { TitleSection } from './TitleSection';
import { DailyTasks } from './DailyTasks';
import { Backlog } from './Backlog';
import { SupportModal } from './SupportModal';
import { MapModal } from './MapModal';
import { CalendarIcon, Maximize, Minimize, Moon, Sun, Map as MapIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useSupport } from '../context/SupportContext';
import { useTheme } from '../context/ThemeContext';
import { SupportTask } from '../types';
import * as Papa from 'papaparse';
import toast from 'react-hot-toast';
import { provinces, getDistrictsByProvince, getMunicipalsByDistrict } from '../data/locations';

export function MainDashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<SupportTask | null>(null);
  const { 
    tasks, user, login, logout, 
    startDate, endDate, setStartDate, setEndDate,
    filterProvince, setFilterProvince, filterDistrict, setFilterDistrict, filterMunicipal, setFilterMunicipal
  } = useSupport();
  const { isDark, toggleTheme } = useTheme();

  const handleExport = () => {
    if (tasks.length === 0) {
      toast.error('No tasks available to export.');
      return;
    }

    const csvData = tasks.map(task => ({
      Date: task.date,
      Province: task.province,
      District: task.district,
      Municipal: task.municipal,
      Organization: task.organization,
      'Contact Person': task.contactPerson,
      'Contact Number': task.contactNumber,
      Status: task.status,
      Details: task.details,
      'Created At': new Date(task.createdAt).toLocaleString(),
      'Last Updated': new Date(task.updatedAt).toLocaleString()
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `support_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully!');
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <main className="flex-1 flex flex-col w-full px-4 md:px-8 pb-6 lg:min-h-0 bg-transparent transition-colors">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-2 border-b border-gray-200 dark:border-slate-700 pb-3 shrink-0 gap-4 transition-colors">
        <TitleSection />
        
        {user ? (
           <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
             <button 
                onClick={() => setIsMapOpen(true)} 
                className="flex items-center justify-center p-2 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-500 hover:bg-green-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-green-100 dark:hover:border-slate-700"
                title="View Map"
             >
                <MapIcon className="w-5 h-5" />
             </button>
             <button 
                onClick={toggleTheme} 
                className="flex items-center justify-center p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-blue-100 dark:hover:border-slate-700"
                title={isDark ? "Enable Light Mode" : "Enable Dark Mode"}
             >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
             <button 
                onClick={toggleFullscreen} 
                className="flex items-center justify-center p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-blue-100 dark:hover:border-slate-700 hidden sm:flex"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
             >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
             </button>
             <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-600 shadow-sm shrink-0 transition-colors">
                {user.photoURL && <img src={user.photoURL} alt="Profile" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />}
                <span className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-200 max-w-[80px] sm:max-w-[120px] truncate">{user.displayName || user.email}</span>
             </div>
             <button onClick={logout} className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">Sign out</button>
          </div>
        ) : (
          <button onClick={login} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2 w-full sm:w-auto justify-center">
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in
          </button>
        )}
      </div>
      
      {!user ? (
        <div className="mt-20 flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl max-w-md mx-auto shadow-sm transition-colors">
           <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
           </div>
           <h3 className="text-xl font-serif font-bold text-gray-900 dark:text-white mb-2">Authentication Required</h3>
           <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">Please sign in with your authorized government account to access the Situation Room dashboard.</p>
           <button onClick={login} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 px-5 rounded-lg shadow-sm text-sm transition-colors">Sign in to continue</button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 mt-6 items-start flex-1 lg:min-h-0 w-full">
          <div className="flex-1 w-full flex flex-col lg:h-full lg:min-h-0">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-[#2e3752] dark:text-slate-100 shrink-0">Daily Tasks</h2>
            <DailyTasks onEdit={(task) => {
               setEditingTask(task);
               setIsModalOpen(true);
            }} />
            
            <div className="mt-4 lg:mt-6 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-3 lg:gap-4 shrink-0 w-full">
              <button 
                onClick={() => {
                   setEditingTask(null);
                   setIsModalOpen(true);
                }}
                className="bg-[#f5a524] hover:bg-[#e69719] text-gray-900 font-semibold px-4 lg:px-5 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors border border-[#d68f1c] h-[42px] whitespace-nowrap w-full xl:w-auto"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add new support
              </button>
              <div className="flex flex-col xl:flex-row gap-2 lg:gap-3 items-start xl:items-center w-full xl:w-auto overflow-hidden">
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 sm:gap-2 w-full xl:w-auto">
                   <select 
                     value={filterProvince} 
                     onChange={(e) => { setFilterProvince(e.target.value); setFilterDistrict(''); setFilterMunicipal(''); }}
                     className="bg-white dark:bg-slate-800 text-xs sm:text-sm text-gray-800 dark:text-gray-200 focus:outline-none border border-gray-300 dark:border-slate-600 rounded-lg px-2 sm:px-3 h-[42px] cursor-pointer flex-1 xl:w-auto truncate transition-colors"
                   >
                     <option value="">All Provinces</option>
                     {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                   </select>

                   <select 
                     value={filterDistrict} 
                     onChange={(e) => { setFilterDistrict(e.target.value); setFilterMunicipal(''); }}
                     disabled={!filterProvince}
                     className="bg-white dark:bg-slate-800 text-xs sm:text-sm text-gray-800 dark:text-gray-200 focus:outline-none border border-gray-300 dark:border-slate-600 rounded-lg px-2 sm:px-3 h-[42px] cursor-pointer flex-1 xl:w-auto truncate transition-colors disabled:opacity-50"
                   >
                     <option value="">All Districts</option>
                     {getDistrictsByProvince(filterProvince).map(d => <option key={d} value={d}>{d}</option>)}
                   </select>

                   <div className="relative flex-1 xl:w-auto">
                     <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                     <input 
                       type="text"
                       placeholder="Search Municipality..."
                       value={filterMunicipal} 
                       onChange={(e) => setFilterMunicipal(e.target.value)}
                       className="bg-white dark:bg-slate-800 text-xs sm:text-sm text-gray-800 dark:text-gray-200 focus:outline-none border border-gray-300 dark:border-slate-600 rounded-lg pl-8 pr-2 h-[42px] w-full transition-colors focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                     />
                   </div>
                </div>
                
                <button 
                  onClick={() => {
                     setFilterProvince('');
                     setFilterDistrict('');
                     setFilterMunicipal('');
                     setStartDate('');
                     setEndDate('');
                  }}
                  className="bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 font-medium px-4 rounded-lg shadow-sm text-sm transition-colors whitespace-nowrap h-[42px] flex items-center justify-center shrink-0"
                  title="Reset all filters"
                >
                  Reset
                </button>
                
                <button onClick={handleExport} className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 lg:px-5 rounded-lg shadow-sm text-sm transition-colors whitespace-nowrap h-[42px] w-full sm:w-auto flex items-center justify-center shrink-0">
                  Export report
                </button>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 sm:gap-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-600 px-2 sm:px-3 h-auto sm:h-[42px] w-full sm:w-auto overflow-hidden transition-colors shrink-0">
                   <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase mr-1 hidden sm:inline">Viewing Dates</span>
                   <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-200 focus:outline-none h-8 sm:h-full w-full sm:w-auto flex-1 cursor-pointer min-w-[100px]"
                   />
                   <span className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mx-1">to</span>
                   <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-200 focus:outline-none h-8 sm:h-full w-full sm:w-auto flex-1 cursor-pointer min-w-[100px]"
                   />
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full lg:w-[320px] shrink-0 flex flex-col lg:h-full lg:min-h-0">
            <h2 className="text-lg md:text-xl font-serif font-bold text-[#2e3752] dark:text-slate-100 shrink-0">Backlog</h2>
            <Backlog />
          </div>
        </div>
      )}

      {isModalOpen && <SupportModal onClose={() => { setIsModalOpen(false); setEditingTask(null); }} editingTask={editingTask} />}
      {isMapOpen && <MapModal onClose={() => setIsMapOpen(false)} tasks={tasks} />}
    </main>
  );
}
