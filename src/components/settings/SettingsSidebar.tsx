
// src/components/settings/SettingsSidebar.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { User, ShieldCheck, Bell, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const settingsLinks = [
  { name: 'Profile', href: '/settings/profile', icon: User },
  { name: 'Verification', href: '/settings/verification', icon: ShieldCheck },
  { name: 'Account', href: '/settings/account', icon: Lock },
  { name: 'Notifications', href: '/settings/notifications', icon: Bell },
];

const SettingsSidebar = () => {
  const pathname = usePathname();

  return (
    <Card className="sticky top-20 shadow-sm border-border"> {/* Add sticky positioning */}
      <CardContent className="p-4">
        <nav className="space-y-1">
          {settingsLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={cn(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150',
                  isActive
                    ? 'bg-muted text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <link.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                  aria-hidden="true"
                />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
};

export default SettingsSidebar;
