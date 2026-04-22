import { useSupport } from '../context/SupportContext';

export function Backlog() {
  const { tasks } = useSupport();
  const backlogTasks = tasks.filter(t => t.status === 'Ongoing').sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="mt-2 lg:mt-4 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-3 lg:p-4 flex flex-col bg-white/30 dark:bg-slate-800/30 flex-1 min-h-[250px] lg:min-h-[400px] overflow-y-auto w-full transition-colors">
      {backlogTasks.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 m-auto">No backlog tasks.</p>
      ) : (
        <ul className="w-full flex flex-col gap-3 h-full">
           {backlogTasks.map(t => (
             <li key={t.id} className="text-sm border-b pb-3 last:border-0 border-gray-200 dark:border-slate-700">
                <div className="font-semibold text-gray-800 dark:text-gray-200">{t.organization}</div>
                <div className="text-gray-500 dark:text-gray-400 text-xs mt-1 leading-relaxed" title={t.details}>{t.details}</div>
                <div className="text-[10px] font-mono text-orange-600 dark:text-orange-400 mt-2 uppercase flex justify-between">
                  <span>Ongoing</span>
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
             </li>
           ))}
        </ul>
      )}
    </div>
  );
}
