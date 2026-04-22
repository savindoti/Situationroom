import { useState, useEffect } from 'react';

export function TitleSection() {
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  useEffect(() => {
    // Implement auto-refresh visual/state trigger every 5 seconds
    const interval = setInterval(() => {
      setLastRefreshed(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3">
        <h2 className="text-3xl md:text-4xl font-serif text-[#b91c1c] dark:text-red-500 tracking-wide font-bold">SITUATION ROOM</h2>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-900/30 rounded-full border border-green-200 dark:border-green-800">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
           <span className="text-[10px] text-green-700 dark:text-green-400 font-bold uppercase tracking-wider">Live</span>
        </div>
      </div>
      <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 tracking-wider mt-1 uppercase">
        Daily Updates • Auto-refreshed at {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
    </div>
  );
}
