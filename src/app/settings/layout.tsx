
// src/app/settings/layout.tsx
"use client"; // Required for hooks like usePathname

import React from 'react';
import SettingsSidebar from '@/components/settings/SettingsSidebar';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Left Sidebar Navigation */}
        <div className="md:col-span-1">
          <SettingsSidebar />
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3">
          {children}
        </div>
      </div>
    </div>
  );
}
