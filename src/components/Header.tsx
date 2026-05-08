import { useSupport } from '../context/SupportContext';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

export function Header() {
  const { tasks } = useSupport();
  
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const ongoing = tasks.filter(t => t.status === 'Ongoing').length;
  const resolved = tasks.filter(t => t.status === 'Resolved').length;

  return (
    <header className="px-4 md:px-8 py-3 lg:py-4 bg-white dark:bg-[#102A43] border-b border-[#D9E2EC] dark:border-slate-800 shadow-sm transition-colors duration-300">
      <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <img 
            src="https://giwmscdnone.gov.np/static/assets/image/Emblem_of_Nepal.png" 
            alt="Nepal Government Logo" 
            className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <p className="text-[10px] md:text-xs text-[#D64545] font-bold tracking-widest uppercase">Government of Nepal</p>
            <p className="text-[10px] md:text-xs text-gray-600 dark:text-gray-300 font-medium mb-0.5">Ministry of Home Affairs</p>
            <h3 className="text-xs md:text-sm lg:text-base text-[#0B3C5D] dark:text-blue-400 font-bold leading-tight uppercase">National Disaster Risk Reduction and Management Authority</h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
          <div className="bg-[#F4F7FA] dark:bg-slate-800/50 rounded-lg border border-[#D9E2EC] dark:border-slate-700 px-3 py-1.5 min-w-[80px] lg:min-w-[100px] transition-colors">
             <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</p>
             <div className="flex items-baseline gap-2">
               <p className="text-lg lg:text-xl font-bold text-[#0B3C5D] dark:text-white uppercase">{tasks.length}</p>
               <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">{pending} pending</p>
             </div>
          </div>
          
          <div className="bg-[#FFFBEB] dark:bg-orange-900/20 rounded-lg border border-[#FEF3C7] dark:border-orange-500/30 px-3 py-1.5 min-w-[80px] transition-colors">
             <p className="text-[9px] font-bold text-[#92400E] dark:text-orange-400 uppercase tracking-wider">Ongoing</p>
             <p className="text-lg lg:text-xl font-bold text-[#D97706] dark:text-white">{ongoing}</p>
          </div>

          <div className="bg-[#F0FDF4] dark:bg-emerald-900/20 rounded-lg border border-[#DCFCE7] dark:border-emerald-500/30 px-3 py-1.5 min-w-[80px] transition-colors">
             <p className="text-[9px] font-bold text-[#166534] dark:text-emerald-400 uppercase tracking-wider">Resolved</p>
             <p className="text-lg lg:text-xl font-bold text-[#16A34A] dark:text-white">{resolved}</p>
          </div>
          
          <div className="bg-[#0B3C5D] dark:bg-blue-700 text-white rounded-lg flex items-center gap-3 px-3 py-1.5 shadow-sm transition-colors">
             <CalendarIcon className="w-4 h-4 text-blue-200" />
             <div className="flex flex-col leading-none">
               <span className="text-[9px] font-bold uppercase tracking-widest text-blue-200 mb-0.5">{format(new Date(), 'MMMM')}</span>
               <span className="text-sm font-bold">{format(new Date(), 'dd, yyyy')}</span>
             </div>
          </div>
        </div>
      </div>
    </header>
  )
}
