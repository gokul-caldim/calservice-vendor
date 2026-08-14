import React, { useState } from 'react';
import { TopHeader } from './TopHeader.jsx';
import { Sidebar } from './Sidebar.jsx';
import { Breadcrumbs } from './Breadcrumbs.jsx';
import { useAuth } from '../../context/AuthProvider.jsx';
import { X } from 'lucide-react';

export function AppShell({ children, breadcrumbs = [] }) {
  const { user } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Top Header */}
      <TopHeader onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      {/* Main Container: Sidebar + Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Persistent Sidebar */}
        {user && (
          <div className="hidden lg:block shrink-0 h-full overflow-y-auto">
            <Sidebar />
          </div>
        )}

        {/* Mobile Slide-Over Sidebar Drawer */}
        {user && mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative w-64 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-10">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">Navigation Menu</span>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
              </div>
            </div>
          </div>
        )}

        {/* Workspace Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-4">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="pb-1">
              <Breadcrumbs items={breadcrumbs} />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
