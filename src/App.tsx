/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Toaster } from 'react-hot-toast';
import { SupportProvider } from './context/SupportContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { MainDashboard } from './components/MainDashboard';
import { UsernameModal } from './components/UsernameModal';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SupportProvider>
          <UsernameModal />
          <div className="min-h-screen bg-[#0B3C5D] flex flex-col transition-colors duration-300 overflow-x-hidden">
            <div 
               className="bg-[#F4F7FA] dark:bg-[#102A43] font-sans text-gray-800 dark:text-gray-100 flex flex-col w-full flex-1 max-w-[2000px] mx-auto relative shadow-none lg:shadow-2xl transition-colors duration-300"
            >
              <Header />
              <MainDashboard />
            </div>
          </div>
          <Toaster position="top-right" />
        </SupportProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
