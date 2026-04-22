/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Toaster } from 'react-hot-toast';
import { SupportProvider } from './context/SupportContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { MainDashboard } from './components/MainDashboard';

export default function App() {
  return (
    <ThemeProvider>
      <SupportProvider>
        <div className="fixed inset-0 bg-[#121212] flex items-start lg:items-center justify-center overflow-y-auto lg:overflow-hidden transition-colors duration-300">
          <div 
             className="bg-[#fdfbf6] dark:bg-slate-900 font-sans text-gray-800 dark:text-gray-100 flex flex-col w-full min-h-screen lg:min-h-0 lg:h-[100vh] lg:max-w-[calc(100vh*(16/9))] lg:max-h-[calc(100vw*(9/16))] relative shadow-none lg:shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-x-hidden lg:overflow-hidden transition-colors duration-300"
          >
            <Header />
            <MainDashboard />
          </div>
        </div>
        <Toaster position="top-right" />
      </SupportProvider>
    </ThemeProvider>
  );
}
