import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { UserRole, AppUser } from '../types';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isLocalUser: boolean;
  canWrite: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // The creator email from metadata setup
  const SUPERADMIN_EMAIL = 'shrestha.nibas@gmail.com'.toLowerCase();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Use onSnapshot to react to role changes in real-time
        const unsubDoc = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as AppUser;
            
            // Auto-upgrade if email matches SUPERADMIN_EMAIL but role is not SUPERADMIN
            if (firebaseUser.email?.toLowerCase() === SUPERADMIN_EMAIL && data.role !== 'SUPERADMIN') {
              try {
                await setDoc(userRef, { role: 'SUPERADMIN' as UserRole }, { merge: true });
                // Note: The onSnapshot will fire again with the updated data
              } catch (err) {
                console.error("Error auto-upgrading superadmin:", err);
              }
            }

            if (data.isDisabled) {
                await signOut(auth);
                toast.error('Your account has been disabled.');
                setAppUser(null);
            } else {
                setAppUser(data);
            }
          } else {
            // First time login logic
            const isInitialSuperAdmin = firebaseUser.email === SUPERADMIN_EMAIL;
            const newAppUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              username: firebaseUser.displayName || null,
              role: isInitialSuperAdmin ? 'SUPERADMIN' : 'LOCAL_USER',
              createdAt: Date.now(),
              lastLogin: Date.now(),
              isDisabled: false
            };
            try {
                await setDoc(userRef, newAppUser);
                setAppUser(newAppUser);
            } catch (err) {
                console.error("Error creating user profile:", err);
            }
          }
          setLoading(false);
        }, (err) => {
            console.error("User doc snapshot error:", err);
            setLoading(false);
        });

        return () => unsubDoc();
      } else {
        setAppUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      toast.error('Login failed: ' + error.message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      toast.error('Logout failed: ' + error.message);
    }
  };

  const roleValue = appUser?.role || 'LOCAL_USER';
  const isSuperAdmin = roleValue === 'SUPERADMIN' || user?.email?.toLowerCase() === SUPERADMIN_EMAIL;
  const isAdmin = roleValue === 'ADMIN' || isSuperAdmin;
  
  const value = {
    user,
    appUser,
    loading,
    isAdmin,
    isSuperAdmin,
    isLocalUser: roleValue === 'LOCAL_USER',
    canWrite: isAdmin,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
