import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query } from 'firebase/firestore';
import { AppUser, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { X, Search, UserCog, Shield, ShieldCheck, User, UserX, UserCheck, AlertCircle, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export function UserManagementModal({ onClose }: { onClose: () => void }) {
  const { isSuperAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) {
       onClose();
       return;
    }

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: AppUser[] = [];
      snapshot.forEach((doc) => {
        userList.push({ uid: doc.id, ...doc.data() } as AppUser);
      });
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users: ' + error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin, onClose]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.uid) {
      toast.error('You cannot change your own role.');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: Date.now()
      });
      toast.success('User role updated successfully.');
    } catch (error: any) {
      toast.error('Failed to update role: ' + error.message);
    }
  };

  const truncateEmail = (email: string) => {
    if (email.length > 20) {
      const [user, domain] = email.split('@');
      return `${user.substring(0, 3)}...@${domain}`;
    }
    return email;
  };

  const handleToggleDisabled = async (userId: string, currentStatus: boolean) => {
    if (userId === currentUser?.uid) {
      toast.error('You cannot disable your own account.');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        isDisabled: !currentStatus,
        updatedAt: Date.now()
      });
      toast.success(`User account ${!currentStatus ? 'disabled' : 'enabled'} successfully.`);
    } catch (error: any) {
      toast.error('Failed to update account status: ' + error.message);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
    (u.username || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  ).sort((a, b) => (a.isDisabled ? 1 : 0) - (b.isDisabled ? 1 : 0) || (a.email || '').localeCompare(b.email || ''));

  const RoleIcon = ({ role }: { role: UserRole }) => {
    switch (role) {
      case 'SUPERADMIN': return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
      case 'ADMIN': return <Shield className="w-4 h-4 text-emerald-600" />;
      default: return <User className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white dark:bg-slate-900 shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <UserCog className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-gray-900 dark:text-white line-height-tight">User Management</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Manage system access and roles</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by email or username..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
              <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
              <p>No users found matching your search.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-gray-100 dark:border-slate-800">
                <tr className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-2">User Info</th>
                  <th className="py-4 px-2">Current Role</th>
                  <th className="py-4 px-2">Permissions</th>
                  <th className="py-4 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className={`group transition-colors ${u.isDisabled ? 'opacity-60 bg-gray-50/50 dark:bg-slate-800/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800/30'}`}>
                    <td className="py-4 px-2">
                       <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 ${u.isDisabled ? 'bg-gray-200 text-gray-400 border-gray-300' : 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-800'}`}>
                            {(u.email || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                             <div className="flex items-center gap-2">
                               <span className={`font-semibold text-sm ${u.isDisabled ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-slate-100'}`}>{u.username || 'No Name'}</span>
                               {u.uid === currentUser?.uid && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200">YOU</span>}
                               {u.isDisabled && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold flex items-center gap-1 uppercase"><UserX className="w-2 h-2" /> Disabled</span>}
                             </div>
                             <span className="text-xs text-gray-400 dark:text-gray-500" title={u.email}>{truncateEmail(u.email || '')}</span>
                          </div>
                       </div>
                    </td>
                    <td className="py-4 px-2">
                       <div className="flex items-center gap-2">
                          <RoleIcon role={u.role} />
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tighter">
                            {(u.role || '').replace('_', ' ')}
                          </span>
                       </div>
                    </td>
                    <td className="py-4 px-2">
                       <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {u.isDisabled ? (
                            <span className="text-[10px] text-red-500 font-bold italic uppercase flex items-center gap-1"><ShieldAlert className="w-2.5 h-2.5" /> All access revoked</span>
                          ) : (
                            <>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${u.role === 'LOCAL_USER' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>Read ALL</span>
                              {(u.role !== 'LOCAL_USER') && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase">Upload</span>}
                              {(u.role === 'SUPERADMIN' || u.role === 'ADMIN') && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">Edit Own</span>}
                              {(u.role === 'SUPERADMIN') && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase">Manage All</span>}
                            </>
                          )}
                       </div>
                    </td>
                    <td className="py-4 px-2 text-right">
                       <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          {u.uid !== currentUser?.uid && (
                             <>
                                <select 
                                   className="text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                   value={u.role}
                                   onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                >
                                   <option value="LOCAL_USER">Local User</option>
                                   <option value="ADMIN">Admin</option>
                                   <option value="SUPERADMIN">Superadmin</option>
                                </select>
                                <button 
                                   onClick={() => handleToggleDisabled(u.uid, !!u.isDisabled)}
                                   className={`p-2 rounded-lg transition-colors ${u.isDisabled ? 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20' : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'}`}
                                   title={u.isDisabled ? "Enable User" : "Disable User"}
                                >
                                   {u.isDisabled ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                                </button>
                             </>
                          )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 shrink-0">
           <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 italic">
              <AlertCircle className="w-4 h-4" />
              <span>Only Superadmins can access this panel. Changes to roles or access status take effect immediately.</span>
           </div>
        </div>
      </div>
    </div>
  );
}
