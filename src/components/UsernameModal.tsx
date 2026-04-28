import { useState, useEffect } from 'react';
import { useSupport } from '../context/SupportContext';
import { setDoc, doc, updateDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

export function UsernameModal() {
  const { user, username, setUsername, loading: contextLoading } = useSupport();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // If user is logged in but has no username, show modal.
  if (contextLoading || !user || username !== null) return null;

  const handleSave = async () => {
    if (name.trim().length < 3) return toast.error("Username must be at least 3 characters");
    setLoading(true);
    try {
      // 1. Save username to users collection
      await setDoc(doc(db, 'users', user.uid), { username: name.trim() });
      
      // 2. We also need to backfill existing tasks for this user to have the new ownerName
      const q = query(collection(db, 'tasks'), where('ownerId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
          const batch = writeBatch(db);
          let count = 0;
          for (const taskDoc of snapshot.docs) {
              batch.update(taskDoc.ref, { ownerName: name.trim() });
              count++;
              if (count >= 500) break; // Firestore limits batch to 500
          }
          if (count > 0) await batch.commit();
      }

      setUsername(name.trim());
      toast.success("Username saved successfully!");
    } catch (e: any) {
      toast.error("Failed to save username: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-2">Welcome!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Please set a username for your account. This will be displayed in the task remarks.</p>
        
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. John Doe or johndoe"
          className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button 
          onClick={handleSave}
          disabled={loading || name.trim().length < 3}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Username"}
        </button>
      </div>
    </div>
  );
}
