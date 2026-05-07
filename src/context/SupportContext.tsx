import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SupportTask, SupportStatus } from '../types';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, onSnapshot, query, setDoc, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { useAuth } from './AuthContext';

import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface SupportContextType {
  tasks: SupportTask[];
  loadingTasks: boolean;
  startDate: string;
  endDate: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  filterProvince: string;
  setFilterProvince: (val: string) => void;
  filterDistrict: string;
  setFilterDistrict: (val: string) => void;
  filterMunicipal: string;
  setFilterMunicipal: (val: string) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  addTask: (task: Omit<SupportTask, 'id' | 'createdAt' | 'updatedAt' | 'ownerId' | 'ownerEmail'>) => void;
  updateTask: (id: string, updates: Partial<Omit<SupportTask, 'id' | 'createdAt' | 'ownerId' | 'ownerEmail'>>) => void;
  updateTaskStatus: (id: string, status: SupportStatus) => void;
  deleteTask: (id: string) => void;
}

const SupportContext = createContext<SupportContextType | undefined>(undefined);

export const SupportProvider = ({ children }: { children: ReactNode }) => {
  const { user, appUser } = useAuth();
  const [allTasks, setAllTasks] = useState<SupportTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterMunicipal, setFilterMunicipal] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Firestore Snapshot
  useEffect(() => {
    if (!user) {
      setAllTasks([]);
      setLoadingTasks(false);
      return;
    }

    setLoadingTasks(true);
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupportTask[];
      setAllTasks(dbTasks);
      setLoadingTasks(false);
    }, (error) => {
      toast.error('Failed to load tasks.');
      console.error(error);
      setLoadingTasks(false);
    });

    return () => unsubscribe();
  }, [user]);

  const tasks = allTasks.filter(t => {
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    if (filterProvince && t.province !== filterProvince) return false;
    if (filterDistrict && t.district !== filterDistrict) return false;
    if (filterMunicipal && !t.municipal?.toLowerCase().includes(filterMunicipal.toLowerCase())) return false;
    if (filterStatus !== 'All' && t.status !== filterStatus) return false;
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
    }, 5000);
    return () => clearInterval(interval);
  }, [allTasks]);

  const addTask = async (taskData: Omit<SupportTask, 'id' | 'createdAt' | 'updatedAt' | 'ownerId' | 'ownerEmail'>) => {
    if (!user) return toast.error('You must be logged in to add tasks.');
    if (appUser?.role === 'LOCAL_USER') return toast.error('Read-only access: Permissions denied.');
    
    const newRef = doc(collection(db, 'tasks'));
    const now = Date.now();
    const newTask = {
      ...taskData,
      createdAt: now,
      updatedAt: now,
      ownerId: user.uid,
      ownerEmail: appUser?.username || user.email || 'Unknown',
      ownerName: appUser?.username || '',
      uploadedByEmail: user.email,
      lastUpdatedByEmail: user.email,
      lastUpdatedTimestamp: now,
    };

    try {
      await setDoc(newRef, newTask);
      toast.success('Support task logged successfully.');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'tasks');
    }
  };

  const updateTask = async (id: string, updates: Partial<Omit<SupportTask, 'id' | 'createdAt' | 'ownerId'>>) => {
    if (!user) return;
    if (appUser?.role === 'LOCAL_USER') return toast.error('Read-only access: Permissions denied.');
    
    // Ownership check for ADMIN
    if (appUser?.role === 'ADMIN') {
        const task = allTasks.find(t => t.id === id);
        if (task && task.ownerId !== user.uid) {
            return toast.error('You can only edit your own records.');
        }
    }

    try {
      await updateDoc(doc(db, 'tasks', id), {
        ...updates,
        updatedAt: Date.now(),
        lastUpdatedByEmail: user.email,
        lastUpdatedTimestamp: Date.now()
      });
      toast.success('Task updated successfully.');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const updateTaskStatus = async (id: string, status: SupportStatus) => {
    if (!user) return;
    if (appUser?.role === 'LOCAL_USER') return toast.error('Read-only access: Permissions denied.');

    // Ownership check for ADMIN
    if (appUser?.role === 'ADMIN') {
        const task = allTasks.find(t => t.id === id);
        if (task && task.ownerId !== user.uid) {
            return toast.error('You can only edit your own records.');
        }
    }

    try {
      await updateDoc(doc(db, 'tasks', id), {
        status,
        updatedAt: Date.now(),
        lastUpdatedByEmail: user.email,
        lastUpdatedTimestamp: Date.now()
      });
      toast.success(`Task marked as ${status}.`);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    if (appUser?.role === 'LOCAL_USER') return toast.error('Read-only access: Permissions denied.');

    // Ownership check for ADMIN
    if (appUser?.role === 'ADMIN') {
        const task = allTasks.find(t => t.id === id);
        if (task && task.ownerId !== user.uid) {
            return toast.error('You can only delete your own records.');
        }
    }

    try {
      await deleteDoc(doc(db, 'tasks', id));
      toast.success('Task removed.');
    } catch (e: any) {
       handleFirestoreError(e, OperationType.DELETE, `tasks/${id}`);
    }
  };

  return (
    <SupportContext.Provider value={{
      tasks, loadingTasks, startDate, endDate, setStartDate, setEndDate,
      filterProvince, setFilterProvince, filterDistrict, setFilterDistrict, filterMunicipal, setFilterMunicipal,
      filterStatus, setFilterStatus,
      addTask, updateTask, updateTaskStatus, deleteTask
    }}>
      {children}
    </SupportContext.Provider>
  );
};

export const useSupport = () => {
  const context = useContext(SupportContext);
  if (!context) throw new Error('useSupport must be used within SupportProvider');
  return context;
};

