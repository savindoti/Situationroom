import { useSupport } from '../context/SupportContext';
import { useEffect, useState } from 'react';

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

export function DailyTasks() {
  const { tasks, updateTaskStatus } = useSupport();
  
  const dailyTasks = tasks.filter(t => t.status !== 'Resolved').sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="mt-2 lg:mt-4 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl overflow-x-auto lg:overflow-y-auto bg-white/50 dark:bg-slate-800/50 relative shadow-inner flex-1 w-full min-h-[300px] transition-colors">
      <table className="w-full text-left border-collapse min-h-[150px] whitespace-nowrap relative">
        <thead className="sticky top-0 z-10 shadow-sm">
          <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-dashed border-gray-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm transition-colors">
            <th className="py-3 px-4 font-semibold">S.N.</th>
            <th className="py-3 px-4 font-semibold">Details</th>
            <th className="py-3 px-4 font-semibold">Province</th>
            <th className="py-3 px-4 font-semibold">District</th>
            <th className="py-3 px-4 font-semibold">Municipal</th>
            <th className="py-3 px-4 font-semibold">Organization</th>
            <th className="py-3 px-4 font-semibold">Status</th>
            <th className="py-3 px-4 font-semibold">Timer</th>
            <th className="py-3 px-4 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {dailyTasks.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-12 text-center text-gray-500 dark:text-gray-400">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-300 dark:border-slate-600 border-t-gray-500 dark:border-t-slate-400 rounded-full animate-spin"></div>
                  <span className="text-sm">No active tasks. Tracking...</span>
                </div>
              </td>
            </tr>
          ) : (
             dailyTasks.map((task, idx) => (
                <tr key={task.id} className="border-b border-dashed border-gray-200 dark:border-slate-700/50 hover:bg-gray-50/80 dark:hover:bg-slate-800/80 transition-colors">
                  <td className="py-4 px-4 text-gray-500 dark:text-gray-400">{idx + 1}</td>
                  <td className="py-4 px-4 max-w-[200px] truncate dark:text-gray-200" title={task.details}>{task.details}</td>
                  <td className="py-4 px-4 dark:text-gray-300">{task.province}</td>
                  <td className="py-4 px-4 dark:text-gray-300">{task.district}</td>
                  <td className="py-4 px-4 text-gray-600 dark:text-gray-400">{task.municipal}</td>
                  <td className="py-4 px-4 font-medium text-gray-800 dark:text-gray-100">{task.organization}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      task.status === 'Pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 animate-pulse' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                    }`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-xs font-mono font-bold text-gray-700 dark:text-gray-300 bg-gray-50/50 dark:bg-slate-800/50 rounded-lg">
                     <LiveTimer 
                        startTime={task.createdAt} 
                        stopTime={task.status === 'Resolved' ? task.updatedAt : undefined} 
                     />
                  </td>
                  <td className="py-4 px-4 flex gap-3">
                    {task.status === 'Pending' && (
                        <button onClick={() => updateTaskStatus(task.id, 'Ongoing')} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold text-xs bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded">Start Task</button>
                    )}
                    {task.status === 'Ongoing' && (
                        <button onClick={() => updateTaskStatus(task.id, 'Resolved')} className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-bold text-xs bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded">Mark Resolved</button>
                    )}
                  </td>
                </tr>
             ))
          )}
        </tbody>
      </table>
    </div>
  );
}
