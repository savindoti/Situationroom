import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SupportTask, SupportStatus } from '../types';
import toast from 'react-hot-toast';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, setDoc, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';

interface SupportContextType {
  tasks: SupportTask[];
  user: User | null;
  loading: boolean;
  startDate: string;
  endDate: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  login: () => void;
  logout: () => void;
  addTask: (task: Omit<SupportTask, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>) => void;
  updateTaskStatus: (id: string, status: SupportStatus) => void;
  deleteTask: (id: string) => void;
}

const SupportContext = createContext<SupportContextType | undefined>(undefined);

export const SupportProvider = ({ children }: { children: ReactNode }) => {
  const [allTasks, setAllTasks] = useState<SupportTask[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      toast.error('Failed to login: ' + error.message);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  // Firestore Snapshot
  useEffect(() => {
    if (!user) {
      setAllTasks([]);
      return;
    }

    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupportTask[];
      setAllTasks(dbTasks);
    }, (error) => {
      toast.error('Failed to load tasks.');
      console.error(error);
    });

    return () => unsubscribe();
  }, [user]);

  const tasks = allTasks.filter(t => {
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    return true;
  });

  // Periodic check for escalations
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      allTasks.forEach(task => {
        if (task.status === 'Pending') {
          const isCritical = now - task.createdAt > 120000;
          const notifiedKey = `notified_${task.id}`;
          if (isCritical && !localStorage.getItem(notifiedKey)) {
             toast.error(`Critical: Support for ${task.organization || 'Unknown'} is still pending!`, {
               duration: 6000,
               icon: '🚨'
             });
             localStorage.setItem(notifiedKey, 'true');
          }
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [tasks]);

  const addTask = async (taskData: Omit<SupportTask, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>) => {
    if (!user) return toast.error('You must be logged in to add tasks.');
    
    const newRef = doc(collection(db, 'tasks'));
    const now = Date.now();
    const newTask = {
      ...taskData,
      createdAt: now,
      updatedAt: now,
      ownerId: user.uid,
    };

    try {
      await setDoc(newRef, newTask);
      toast.success('Support task logged successfully.');
    } catch (e: any) {
      toast.error('Error logging task: ' + e.message);
    }
  };

  const updateTaskStatus = async (id: string, status: SupportStatus) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'tasks', id), {
        status,
        updatedAt: Date.now()
      });
      toast.success(`Task marked as ${status}.`);
    } catch (e: any) {
      toast.error('Error updating task: ' + e.message);
    }
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
      toast.success('Task removed.');
    } catch (e: any) {
       toast.error('Delete failed: ' + e.message);
    }
  };

  return (
    <SupportContext.Provider value={{ tasks, user, loading, startDate, endDate, setStartDate, setEndDate, login, logout, addTask, updateTaskStatus, deleteTask }}>
      {children}
    </SupportContext.Provider>
  );
};

export const useSupport = () => {
  const context = useContext(SupportContext);
  if (!context) throw new Error('useSupport must be used within SupportProvider');
  return context;
};

