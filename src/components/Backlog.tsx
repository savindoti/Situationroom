import { useSupport } from '../context/SupportContext';
import { Clock, LayoutList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Backlog() {
  const { tasks } = useSupport();
  const backlogTasks = tasks.filter(t => t.status === 'Ongoing').sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-[#D9E2EC] dark:border-slate-800 flex flex-col h-full shadow-sm overflow-hidden transition-colors flex-1 min-h-[300px] lg:min-h-0">
      <div className="p-3 border-b border-[#D9E2EC] dark:border-slate-800 bg-[#F4F7FA] dark:bg-slate-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-600" />
          <h3 className="font-bold text-[10px] text-[#0B3C5D] dark:text-white uppercase tracking-widest">Active Operations Queue</h3>
        </div>
        <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-black px-2 py-0.5 rounded tracking-tighter uppercase">Ongoing</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {backlogTasks.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-full mb-3">
                 <LayoutList className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Queue Empty</p>
           </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {backlogTasks.map((t, idx) => (
              <motion.div 
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-3 rounded border border-gray-100 dark:border-slate-800 bg-[#F4F7FA]/30 dark:bg-slate-800/20 hover:border-[#0B3C5D] dark:hover:border-blue-500/50 transition-all group"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-[#0B3C5D] dark:text-blue-400 text-[11px] uppercase truncate max-w-[140px] group-hover:text-blue-600 transition-colors">{t.organization}</span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-[10px] leading-relaxed line-clamp-2" title={t.details}>{t.details}</p>
                <div className="mt-2.5 flex items-center justify-between">
                   <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Processing</span>
                   </div>
                   <span className="text-[9px] font-bold text-gray-400 bg-white dark:bg-slate-800 border border-[#D9E2EC] dark:border-slate-700 px-1.5 py-0.5 rounded uppercase tracking-tight">{t.district}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
