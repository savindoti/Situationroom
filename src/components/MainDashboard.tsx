import { useState, useEffect } from 'react';
import { TitleSection } from './TitleSection';
import { DailyTasks } from './DailyTasks';
import { Backlog } from './Backlog';
import { SupportModal } from './SupportModal';
import { RiskMapModal } from './RiskMapModal';
import { UserManagementModal } from './UserManagementModal';
import { CalendarIcon, Maximize, Minimize, Moon, Sun, Map as MapIcon, Users, Settings, LogOut, ChevronDown, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useSupport } from '../context/SupportContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SupportTask, UserRole } from '../types';
import * as Papa from 'papaparse';
import * as xlsx from 'xlsx';
import toast from 'react-hot-toast';
import { provinces, getDistrictsByProvince, getMunicipalsByDistrict } from '../data/locations';

const RoleBadge = ({ role }: { role: UserRole }) => {
  const colors: Record<UserRole, string> = {
    SUPERADMIN: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800',
    ADMIN: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800',
    LOCAL_USER: 'bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-400 border-gray-100 dark:border-slate-700'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 leading-none ${colors[role]}`}>
      {role === 'SUPERADMIN' && <ShieldCheck className="w-2.5 h-2.5" />}
      {(role || '').replace('_', ' ')}
    </span>
  );
};

export function MainDashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRiskMapOpen, setIsRiskMapOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<SupportTask | null>(null);
  
  const { 
    tasks,
    startDate, endDate, setStartDate, setEndDate,
    filterProvince, setFilterProvince, filterDistrict, setFilterDistrict, filterMunicipal, setFilterMunicipal,
    filterStatus, setFilterStatus
  } = useSupport();
  
  const { user, appUser, login, logout, isSuperAdmin, canWrite } = useAuth();
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

    const worksheet = xlsx.utils.json_to_sheet(csvData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Support Tasks");
    
    const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `support_export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
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
    <main className="flex-1 flex flex-col w-full px-3 sm:px-4 md:px-6 pb-6 min-h-0 bg-transparent transition-colors overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-end mt-2 border-b border-gray-200 dark:border-slate-700 pb-3 shrink-0 gap-4 transition-colors">
        <div className="flex-1 min-w-0">
          <TitleSection />
        </div>
        
        {user ? (
           <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-start md:justify-end shrink-0">
             {isSuperAdmin && (
                <button 
                  onClick={() => setIsUserManagementOpen(true)}
                  className="flex items-center justify-center gap-1.5 p-2 text-[#0B3C5D] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-transparent"
                  title="User Management"
                >
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-bold hidden md:inline">Users</span>
                </button>
             )}
             <button 
                onClick={() => setIsRiskMapOpen(true)} 
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-[#0B3C5D] dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent font-bold text-xs"
                title="Risk Map"
             >
                <MapIcon className="w-4 h-4" />
                <span className="hidden sm:inline">RISK MAP</span>
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
             
             <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 bg-[#F4F7FA] dark:bg-slate-800 px-3 py-1.5 rounded border border-[#D9E2EC] dark:border-slate-600 shadow-sm shrink-0 transition-colors">
                   {user.photoURL && <img src={user.photoURL} alt="Profile" className="w-5 h-5 sm:w-6 sm:h-6 rounded" />}
                   <span className="text-[10px] sm:text-xs font-bold text-[#0B3C5D] dark:text-gray-200 max-w-[80px] sm:max-w-[120px] truncate">{appUser?.username || user.displayName || user.email}</span>
                   {appUser && <RoleBadge role={appUser.role} />}
                </div>
                <button onClick={logout} className="text-[9px] sm:text-[10px] font-bold text-[#D64545] dark:text-red-400 hover:opacity-80 uppercase flex items-center gap-1 mt-1 px-1 transition-colors">
                  <LogOut className="w-2.5 h-2.5" />
                  Sign out
                </button>
             </div>
          </div>
        ) : (
          <button onClick={login} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2 w-full sm:w-auto justify-center">
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-4.3 0-8.01 2.53-9.82 6.22l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        )}
      </div>
      
      {!user ? (
        <div className="mt-20 flex flex-col items-center justify-center p-10 bg-white dark:bg-slate-800 border border-[#D9E2EC] dark:border-slate-700 rounded-xl max-w-md mx-auto shadow-2xl transition-colors">
           <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
              <ShieldCheck className="w-10 h-10 text-[#0B3C5D] dark:text-blue-400" />
           </div>
           <h3 className="text-2xl font-bold text-[#0B3C5D] dark:text-white mb-2 uppercase tracking-wide">Authentication Required</h3>
           <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8 font-medium">Please sign in with your authorized government account to access the Situation Room dashboard.</p>
           <button onClick={login} className="w-full bg-[#0B3C5D] hover:bg-[#102A43] text-white font-bold py-3 px-6 rounded-lg shadow-lg text-sm transition-colors uppercase tracking-widest">Sign in to continue</button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 mt-4 md:mt-6 items-stretch flex-1 min-h-0 w-full overflow-hidden">
          <div className="flex-1 w-full flex flex-col h-full min-h-0 overflow-hidden">
             <div className="flex items-center justify-between shrink-0 mb-3 md:mb-4">
                <h2 className="text-base md:text-xl font-bold text-[#0B3C5D] dark:text-slate-100 uppercase tracking-widest flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-[#0B3C5D] dark:bg-blue-500 rounded-full"></div>
                  Daily Tasks
                </h2>
                <div className="h-[1px] flex-1 bg-[#D9E2EC] dark:bg-slate-700 mx-4 md:mx-6 hidden sm:block"></div>
             </div>
            <DailyTasks onEdit={(task) => {
               setEditingTask(task);
               setIsModalOpen(true);
            }} />
            
            <div className="mt-4 lg:mt-6 flex flex-col xl:flex-row justify-between items-stretch xl:items-end gap-3 lg:gap-4 shrink-0 w-full">
              {canWrite && (
                <button 
                  onClick={() => {
                     setEditingTask(null);
                     setIsModalOpen(true);
                  }}
                  className="bg-[#0B3C5D] hover:bg-[#102A43] text-white font-bold px-4 lg:px-6 rounded-lg shadow-md flex items-center justify-center gap-2 transition-colors h-[42px] whitespace-nowrap w-full xl:w-auto uppercase text-xs tracking-widest shrink-0"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  New Support Entry
                </button>
              )}
              <div className="flex flex-col xl:flex-row gap-2 lg:gap-3 items-stretch xl:items-center w-full xl:w-auto">
                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                   <div className="relative flex-1 xl:w-auto min-w-[130px] sm:min-w-[140px]">
                     <select 
                       value={filterProvince} 
                       onChange={(e) => { setFilterProvince(e.target.value); setFilterDistrict(''); setFilterMunicipal(''); }}
                       className="bg-white dark:bg-slate-800 text-[10px] sm:text-xs text-gray-800 dark:text-gray-200 focus:outline-none border border-[#D9E2EC] dark:border-slate-600 rounded-lg px-2 sm:px-3 pr-8 h-[40px] sm:h-[42px] cursor-pointer w-full truncate transition-colors font-bold appearance-none uppercase shadow-sm"
                     >
                       <option value="">All Provinces</option>
                       {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                     </select>
                     <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                   </div>
   
                   <div className="relative flex-1 xl:w-auto min-w-[130px] sm:min-w-[140px]">
                     <select 
                       value={filterDistrict} 
                       onChange={(e) => { setFilterDistrict(e.target.value); setFilterMunicipal(''); }}
                       disabled={!filterProvince}
                       className="bg-white dark:bg-slate-800 text-[10px] sm:text-xs text-gray-800 dark:text-gray-200 focus:outline-none border border-[#D9E2EC] dark:border-slate-600 rounded-lg px-2 sm:px-3 pr-8 h-[40px] sm:h-[42px] cursor-pointer w-full truncate transition-colors font-bold disabled:opacity-50 appearance-none uppercase shadow-sm"
                     >
                       <option value="">All Districts</option>
                       {getDistrictsByProvince(filterProvince).map(d => <option key={d} value={d}>{d}</option>)}
                     </select>
                     <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                   </div>
   
                   <div className="relative flex-1 xl:w-auto min-w-[110px] sm:min-w-[140px]">
                     <select 
                       value={filterStatus} 
                       onChange={(e) => setFilterStatus(e.target.value)}
                       className="bg-white dark:bg-slate-800 text-[10px] sm:text-xs text-gray-800 dark:text-gray-200 focus:outline-none border border-[#D9E2EC] dark:border-slate-600 rounded-lg px-2 sm:px-3 pr-8 h-[40px] sm:h-[42px] cursor-pointer w-full truncate transition-colors font-bold appearance-none uppercase shadow-sm"
                     >
                       <option value="All">All Status</option>
                       <option value="Pending">Pending</option>
                       <option value="Ongoing">Ongoing</option>
                       <option value="Resolved">Resolved</option>
                     </select>
                     <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                   </div>
   
                   <div className="relative flex-[2] xl:w-auto min-w-[160px] sm:min-w-[200px]">
                     <svg className="w-3 h-3 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                     <input 
                       type="text"
                       placeholder="SEARCH MUNICIPALITY..."
                       value={filterMunicipal} 
                       onChange={(e) => setFilterMunicipal(e.target.value)}
                       className="bg-white dark:bg-slate-800 text-[10px] sm:text-xs text-gray-800 dark:text-gray-200 focus:outline-none border border-[#D9E2EC] dark:border-slate-600 rounded-lg pl-8 sm:pl-9 pr-3 h-[40px] sm:h-[42px] w-full transition-colors focus:ring-2 focus:ring-[#0B3C5D]/10 focus:border-[#0B3C5D] font-bold uppercase placeholder:text-gray-400 shadow-sm"
                     />
                   </div>
                </div>
                
                <div className="flex items-center gap-2 w-full xl:w-auto">
                  <button 
                    onClick={() => {
                       setFilterProvince('');
                       setFilterDistrict('');
                       setFilterMunicipal('');
                       setFilterStatus('All');
                       setStartDate('');
                       setEndDate('');
                    }}
                    className="bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 border border-[#D9E2EC] dark:border-slate-600 text-[#0B3C5D] dark:text-gray-200 font-bold px-3 sm:px-4 rounded-lg shadow-sm text-[9px] sm:text-[10px] transition-colors whitespace-nowrap h-[40px] sm:h-[42px] flex items-center justify-center shrink-0 uppercase tracking-widest"
                    title="Reset all filters"
                  >
                    Reset
                  </button>
                  
                  <button onClick={handleExport} className="bg-[#16A34A] hover:bg-[#15803d] text-white font-bold px-4 lg:px-6 rounded-lg shadow-md text-[9px] sm:text-[10px] transition-colors whitespace-nowrap h-[40px] sm:h-[42px] w-full sm:w-auto flex items-center justify-center shrink-0 uppercase tracking-widest">
                    Export Excel
                  </button>
                </div>
 
                <div className="flex flex-nowrap items-center gap-2 bg-white dark:bg-slate-800 rounded-lg border border-[#D9E2EC] dark:border-slate-600 px-2 sm:px-3 h-[40px] sm:h-[42px] w-full xl:w-auto overflow-hidden transition-colors shrink-0">
                   <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mr-1 hidden sm:inline tracking-wider shrink-0">Date range</span>
                   <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-[10px] sm:text-xs text-gray-800 dark:text-gray-200 focus:outline-none h-full w-full sm:w-auto flex-1 cursor-pointer min-w-0 font-bold uppercase"
                   />
                   <span className="text-gray-400 dark:text-gray-500 text-[10px] sm:text-xs mx-0.5 sm:mx-1 font-bold shrink-0">»</span>
                   <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-[10px] sm:text-xs text-gray-800 dark:text-gray-200 focus:outline-none h-full w-full sm:w-auto flex-1 cursor-pointer min-w-0 font-bold uppercase"
                   />
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full lg:w-[320px] shrink-0 flex flex-col h-auto lg:h-full min-h-0">
            <div className="flex items-center gap-3 mb-3 md:mb-4 shrink-0">
               <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
               <h2 className="text-lg md:text-xl font-bold text-[#0B3C5D] dark:text-slate-100 uppercase tracking-widest">Backlog</h2>
            </div>
            <Backlog />
          </div>
        </div>
      )}
      
      {isModalOpen && <SupportModal onClose={() => { setIsModalOpen(false); setEditingTask(null); }} editingTask={editingTask} />}
      {isRiskMapOpen && <RiskMapModal onClose={() => setIsRiskMapOpen(false)} />}
      {isUserManagementOpen && <UserManagementModal onClose={() => setIsUserManagementOpen(false)} />}
    </main>
  );
}
