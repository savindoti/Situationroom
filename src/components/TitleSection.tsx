import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

export function TitleSection() {
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefreshed(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-3">
        <h2 className="text-3xl md:text-3xl font-bold text-[#0B3C5D] dark:text-blue-400 tracking-widest uppercase">SITUATION ROOM</h2>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
           <span className="text-[10px] text-green-700 dark:text-green-400 font-bold uppercase tracking-widest">Active</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <div className="w-8 h-[1px] bg-[#D64545]"></div>
        <p className="text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">
          Nepal Disaster Response • Auto-refreshed: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}
