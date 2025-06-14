// src/components/settings/SettingsSidebar.tsx
"use client";

import React, { useCallback } from 'react'; // Added useCallback
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { User, ShieldCheck, Bell, Lock, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getUserPreferences } from '@/services/userPreferenceService'; // Import the service

const settingsLinks = [
  { name: 'Profile', href: '/settings/profile', icon: User, prefetchKey: 'fullUserProfile' },
  { name: 'Verification', href: '/settings/verification', icon: ShieldCheck },
  { name: 'Account', href: '/settings/account', icon: Lock },
  { name: 'Notifications', href: '/settings/notifications', icon: Bell, prefetchKey: 'userPreferences' },
  { name: 'Payment Method', href: '/settings/payment-method', icon: CreditCard, prefetchKey: 'userPreferences' },
];

const SettingsSidebar = React.memo(() => {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const handlePrefetchPreferences = useCallback(() => {
    if (user?.uid) {
      // console.log(`[SettingsSidebar] Prefetching userPreferences for user: ${user.uid}`); // Removed this line
      queryClient.prefetchQuery({
        queryKey: ['userPreferences', user.uid],
        queryFn: () => getUserPreferences(user.uid),
        staleTime: 1000 * 60 * 5, // 5 minutes, same as in NotificationSettingsPage
      });
    }
  }, [user, queryClient]);

  // Note: Prefetching for 'fullUserProfile' is typically handled in MainLayout for the general Settings link.
  // If you need specific prefetching for the Profile link here, it would be similar to handlePrefetchPreferences.

  return (
    <Card className="sticky top-20 shadow-sm border-border">
      <CardContent className="p-4">
        <nav className="space-y-1">
          {settingsLinks.map((link) => {
            const isActive = pathname === link.href;
            const prefetchHandler = link.prefetchKey === 'userPreferences' ? handlePrefetchPreferences : undefined;

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
                onMouseEnter={prefetchHandler}
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
});

SettingsSidebar.displayName = 'SettingsSidebar';

export default SettingsSidebar;
