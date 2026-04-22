import { useSupport } from '../context/SupportContext';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

export function Header() {
  const { tasks } = useSupport();
  
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const ongoing = tasks.filter(t => t.status === 'Ongoing').length;
  const resolved = tasks.filter(t => t.status === 'Resolved').length;

  return (
    <header className="px-4 md:px-8 py-4 lg:py-6 bg-[#fdfaf6] dark:bg-slate-900 transition-colors duration-300">
      <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-3 lg:gap-4">
          <img 
            src="https://giwmscdnone.gov.np/static/assets/image/Emblem_of_Nepal.png" 
            alt="Nepal Government Logo" 
            className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <p className="text-[10px] md:text-xs lg:text-sm text-red-700 dark:text-red-400 font-normal tracking-wide">Government of Nepal</p>
            <p className="text-xs md:text-sm lg:text-md text-red-700 dark:text-red-400 font-normal mb-0.5 lg:mb-1">Ministry of Home Affairs</p>
            <h3 className="text-sm md:text-lg lg:text-xl text-red-700 dark:text-red-500 font-bold leading-tight">National Disaster Risk Reduction and Management Authority</h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:gap-4 w-full md:w-auto mt-2 md:mt-0">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-2 sm:p-3 lg:p-4 text-center flex-1 md:flex-initial min-w-[30%] md:min-w-[100px] transition-colors">
             <p className="text-[9px] md:text-[10px] lg:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Support</p>
             <p className="text-lg md:text-2xl lg:text-3xl font-bold mt-0.5 lg:mt-1 text-gray-900 dark:text-white">{tasks.length}</p>
             <p className="text-[9px] md:text-[10px] lg:text-xs text-orange-600 dark:text-orange-400 mt-0.5 lg:mt-1">{pending} pending</p>
          </div>
          
          <div className="bg-orange-50/50 dark:bg-orange-900/20 rounded-xl shadow-sm border border-orange-100 dark:border-orange-500/30 p-2 sm:p-3 lg:p-4 text-center flex-1 md:flex-initial min-w-[30%] md:min-w-[80px] transition-colors">
             <p className="text-[9px] md:text-[10px] lg:text-xs font-semibold text-orange-800 dark:text-orange-400 uppercase">Ongoing</p>
             <p className="text-lg md:text-2xl lg:text-3xl font-bold mt-0.5 lg:mt-1 text-gray-900 dark:text-white">{ongoing}</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-2 sm:p-3 lg:p-4 text-center flex-1 md:flex-initial min-w-[30%] md:min-w-[80px] transition-colors">
             <p className="text-[9px] md:text-[10px] lg:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Resolved</p>
             <p className="text-lg md:text-2xl lg:text-3xl font-bold mt-0.5 lg:mt-1 text-gray-900 dark:text-white">{resolved}</p>
          </div>
          
          <div className="bg-blue-500 dark:bg-blue-600 text-white rounded-xl flex flex-col items-center justify-center p-2 sm:p-3 shadow-md flex-1 md:flex-initial min-w-[30%] md:min-w-[64px] transition-colors">
             <CalendarIcon className="w-4 h-4 md:w-5 md:h-5 mb-0.5 md:mb-1 text-blue-100 dark:text-blue-200 opacity-80" />
             <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">{format(new Date(), 'MMM')}</span>
             <span className="text-sm md:text-xl font-bold">{format(new Date(), 'dd')}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
