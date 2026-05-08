import React, { useState, FormEvent, useEffect } from 'react';
import { useSupport } from '../context/SupportContext';
import { SupportStatus, SupportTask } from '../types';
import { provinces, getDistrictsByProvince, getMunicipalsByDistrict } from '../data/locations';

export function SupportModal({ onClose, editingTask = null }: { onClose: () => void; editingTask?: SupportTask | null }) {
  const { addTask, updateTask } = useSupport();
  const [isNDRRMA, setIsNDRRMA] = useState(editingTask?.organization === 'NDRRMA');
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
    <div className="fixed inset-0 bg-[#0B3C5D]/40 flex items-center justify-center p-2 sm:p-4 z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden border border-[#D9E2EC] dark:border-slate-700 transition-colors">
         <div className="bg-[#0B3C5D] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center shrink-0">
            <h2 className="text-sm sm:text-lg font-bold text-white uppercase tracking-wider">{editingTask ? 'Edit Support Entry' : 'Create New Support Request'}</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
               <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
         </div>
         
         <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-2 bg-[#F4F7FA] dark:bg-slate-800 p-3 rounded border border-[#D9E2EC] dark:border-slate-700">
                <input 
                  type="checkbox" 
                  id="ndrrmaCheck" 
                  checked={isNDRRMA} 
                  onChange={(e) => {
                    setIsNDRRMA(e.target.checked);
                    if (e.target.checked) {
                      setFormData(prev => ({ ...prev, organization: 'NDRRMA' }));
                    } else if (formData.organization === 'NDRRMA') {
                      setFormData(prev => ({ ...prev, organization: '' }));
                    }
                  }} 
                  className="w-4 h-4 text-[#0B3C5D] rounded border-[#D9E2EC] focus:ring-[#0B3C5D]"
                />
                <label htmlFor="ndrrmaCheck" className="text-xs font-bold text-[#0B3C5D] dark:text-blue-400 cursor-pointer uppercase tracking-tight">
                  Official NDRRMA Assignment
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Entry Date <span className="text-red-500">*</span></label>
                  <input required={!isNDRRMA} type="date" name="date" value={formData.date} onChange={handleChange} className="w-full border border-[#D9E2EC] dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-sm focus:border-[#0B3C5D] outline-none transition-all dark:text-gray-100 font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Province</label>
                  <select name="province" value={formData.province} onChange={handleChange} className="w-full border border-[#D9E2EC] dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-sm focus:border-[#0B3C5D] outline-none transition-all dark:text-gray-100 font-medium">
                    <option value="">Select Province</option>
                    {provinces.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">District</label>
                  <select name="district" value={formData.district} onChange={handleChange} className="w-full border border-[#D9E2EC] dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-sm focus:border-[#0B3C5D] outline-none transition-all disabled:bg-gray-50 disabled:dark:bg-slate-800/50 disabled:text-gray-400 dark:text-gray-100 font-medium" disabled={!formData.province}>
                    <option value="">Select District</option>
                    {availableDistricts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Municipal</label>
                  <select name="municipal" value={formData.municipal} onChange={handleChange} className="w-full border border-[#D9E2EC] dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-sm focus:border-[#0B3C5D] outline-none transition-all disabled:bg-gray-50 disabled:dark:bg-slate-800/50 disabled:text-gray-400 dark:text-gray-100 font-medium" disabled={!formData.district}>
                    <option value="">Select Municipal</option>
                    {availableMunicipals.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Request Details <span className="text-red-500">*</span></label>
                <textarea required name="details" value={formData.details} onChange={handleChange} rows={3} className="w-full border border-[#D9E2EC] dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-sm focus:border-[#0B3C5D] outline-none transition-all placeholder:text-gray-400 dark:text-gray-100 font-medium" placeholder="Specify nature of support needed..."></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Leading Organization <span className="text-red-500">*</span></label>
                  <input required type="text" name="organization" value={formData.organization} onChange={handleChange} className="w-full border border-[#D9E2EC] dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-sm focus:border-[#0B3C5D] outline-none transition-all dark:text-gray-100 font-bold uppercase" placeholder="e.g. Red Cross" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Focal Person</label>
                  <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} className="w-full border border-[#D9E2EC] dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-sm focus:border-[#0B3C5D] outline-none transition-all dark:text-gray-100 font-medium" placeholder="Name" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Contact Details</label>
                  <input type="tel" name="contactNumber" value={formData.contactNumber} onChange={handleChange} className="w-full border border-[#D9E2EC] dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-sm focus:border-[#0B3C5D] outline-none transition-all dark:text-gray-100 font-medium" placeholder="Phone" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Current Status <span className="text-red-500">*</span></label>
                  <select required name="status" value={formData.status} onChange={handleChange} className="w-full border border-[#D9E2EC] dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-sm focus:border-[#0B3C5D] outline-none transition-all dark:text-gray-100 font-bold text-[#D97706]">
                    <option value="Pending">Pending</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#D9E2EC] dark:border-slate-700">
                <button type="button" onClick={onClose} className="px-6 py-2 rounded text-gray-500 hover:text-gray-700 font-bold text-xs uppercase transition-colors tracking-widest">
                  Cancel
                </button>
                <button type="submit" className="px-8 py-2 rounded text-white bg-[#0B3C5D] hover:bg-[#102A43] font-bold text-xs uppercase transition-colors shadow-md tracking-widest">
                  {editingTask ? 'Update Entry' : 'Submit Entry'}
                </button>
              </div>
            </form>
         </div>
      </div>
    </div>
  );
}
