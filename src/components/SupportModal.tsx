import { useState, FormEvent, useEffect } from 'react';
import { useSupport } from '../context/SupportContext';
import { SupportStatus, SupportTask } from '../types';
import { provinces, getDistrictsByProvince, getMunicipalsByDistrict } from '../data/locations';

export function SupportModal({ onClose, editingTask = null }: { onClose: () => void; editingTask?: SupportTask | null }) {
  const { addTask, updateTask } = useSupport();
  const [formData, setFormData] = useState({
    date: editingTask ? editingTask.date : new Date().toISOString().split('T')[0],
    province: editingTask ? editingTask.province : '',
    district: editingTask ? editingTask.district : '',
    municipal: editingTask ? editingTask.municipal : '',
    details: editingTask ? editingTask.details : '',
    organization: editingTask ? editingTask.organization : '',
    contactPerson: editingTask ? editingTask.contactPerson : '',
    contactNumber: editingTask ? editingTask.contactNumber : '',
    status: editingTask ? editingTask.status : 'Pending' as SupportStatus
  });

  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [availableMunicipals, setAvailableMunicipals] = useState<string[]>([]);

  useEffect(() => {
    if (formData.province) {
      setAvailableDistricts(getDistrictsByProvince(formData.province));
    } else {
      setAvailableDistricts([]);
    }
  }, [formData.province]);

  useEffect(() => {
    if (formData.district) {
      setAvailableMunicipals(getMunicipalsByDistrict(formData.district));
    } else {
      setAvailableMunicipals([]);
    }
  }, [formData.district]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Auto-reset dependent fields when parent changes
      if (name === 'province') {
        newData.district = '';
        newData.municipal = '';
      } else if (name === 'district') {
        newData.municipal = '';
      }
      
      return newData;
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      updateTask(editingTask.id, formData);
    } else {
      addTask(formData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-[#fdfaf6] dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-[#e5e0d8] dark:border-slate-700 transition-colors">
         <div className="p-8">
            <h2 className="text-3xl font-serif font-bold text-[#354060] dark:text-slate-100 mb-8 transition-colors">{editingTask ? 'Edit Support' : 'Add New Support'}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Date</label>
                  <input required type="date" name="date" value={formData.date} onChange={handleChange} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3.5 py-2.5 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Province</label>
                  <select name="province" value={formData.province} onChange={handleChange} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3.5 py-2.5 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-gray-100">
                    <option value="">Select Province</option>
                    {provinces.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">District</label>
                  <select name="district" value={formData.district} onChange={handleChange} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3.5 py-2.5 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:dark:bg-slate-800/50 disabled:text-gray-400 dark:text-gray-100" disabled={!formData.province}>
                    <option value="">Select District</option>
                    {availableDistricts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Municipal</label>
                  <select name="municipal" value={formData.municipal} onChange={handleChange} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3.5 py-2.5 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:dark:bg-slate-800/50 disabled:text-gray-400 dark:text-gray-100" disabled={!formData.district}>
                    <option value="">Select Municipal</option>
                    {availableMunicipals.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Details (Optional)</label>
                <textarea name="details" value={formData.details} onChange={handleChange} rows={3} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3.5 py-2.5 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 dark:text-gray-100" placeholder="Describe the support required..."></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Organization Name</label>
                  <input required type="text" name="organization" value={formData.organization} onChange={handleChange} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3.5 py-2.5 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-gray-100" placeholder="e.g. Red Cross" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Contact Person (Optional)</label>
                  <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3.5 py-2.5 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-gray-100" placeholder="John Doe" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-b border-gray-200 dark:border-slate-700 pb-8 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Contact Number (Optional)</label>
                  <input type="tel" name="contactNumber" value={formData.contactNumber} onChange={handleChange} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3.5 py-2.5 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-gray-100" placeholder="+977 98..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Status</label>
                  <select required name="status" value={formData.status} onChange={handleChange} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3.5 py-2.5 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-gray-100">
                    <option value="Pending">Pending</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-center gap-4 pt-2">
                <button type="button" onClick={onClose} className="w-32 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 bg-gray-200/60 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" className="w-40 py-2.5 rounded-lg text-white bg-blue-500 hover:bg-blue-600 font-semibold shadow-sm transition-colors">
                  Create Support
                </button>
              </div>
            </form>
         </div>
      </div>
    </div>
  );
}
