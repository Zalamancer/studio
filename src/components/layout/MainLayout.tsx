// src/components/layout/MainLayout.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Home, Compass, MessageSquare, Newspaper, LogOut, PlusCircle, Settings, User, CreditCard, Bell, Search, X } from "lucide-react"; // Removed unnecessary icons, added Search and X
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import type {
  SectorWithSubSectors as SectorWithSubSectorsType,
  SubSector as SubSectorType,
  Industry as IndustryType
} from '@/types/post';
import { useQueryClient } from '@tanstack/react-query';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { useIsMobile } from "@/hooks/use-mobile";
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { fetchFullUserProfile } from '@/services/connectionService';
import { usePage } from '@/contexts/PageContext'; // Import the new context hook

export const availableTags = [
  "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

export const detailedSectorsData: SectorWithSubSectorsType[] = [
    // ... (data remains unchanged, omitted for brevity) ...
];

export type SectorWithSubSectors = typeof detailedSectorsData[0];
export type SubSector = SectorWithSubSectors['subSectors'][0];
export type Industry = SubSector['industries'][0];

export const findIndustryByName = (
    industryName: string
  ): { industry: IndustryType; subSector: SubSectorType; sector: SectorWithSubSectorsType } | null => {
    for (const sector of detailedSectorsData) {
      for (const subSector of sector.subSectors) {
        if (subSector.industries) {
          for (const industry of subSector.industries) {
            if (industry.name === industryName) {
              return { industry, subSector, sector };
            }
          }
        }
      }
    }
    return null;
};


const DynamicNotificationDropdown = dynamic(() =>
  import('@/components/notifications/NotificationDropdown').then((mod) => mod.NotificationDropdown),
  {
    loading: () => <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications (Loading)"><Bell className="h-5 w-5" /></Button>,
    ssr: false
  }
);

const DynamicThemeToggle = dynamic(() =>
  import('@/components/ThemeToggle').then((mod) => mod.ThemeToggle),
  {
    loading: () => <DropdownMenuItem disabled className="justify-between">Theme <span className="text-xs text-muted-foreground">...</span></DropdownMenuItem>,
    ssr: false
  }
);

export default function MainLayout({
  children
}: {
  children: React.ReactNode
}) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { isSearchFilterVisible, setSearchFilterVisible, handleCreateClick } = usePage(); // Use the new context

  // Reset search/filter view when pathname changes
  useEffect(() => {
    setSearchFilterVisible(false);
  }, [pathname, setSearchFilterVisible]);


  const handlePrefetchSettings = useCallback(() => {
    if (user?.uid) {
      queryClient.prefetchQuery({
        queryKey: ['fullUserProfile', user.uid],
        fn: () => fetchFullUserProfile(user.uid),
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [user, queryClient]);

  useEffect(() => {
    if (isMobile) {
      const setVisualViewportHeight = () => {
        if (typeof window !== 'undefined') {
          const vh = window.innerHeight * 0.01;
          document.documentElement.style.setProperty('--vh-dynamic', `${vh}px`);
        }
      };
      setVisualViewportHeight();
      window.addEventListener('resize', setVisualViewportHeight);
      window.addEventListener('orientationchange', setVisualViewportHeight);
      return () => {
        window.removeEventListener('resize', setVisualViewportHeight);
        window.removeEventListener('orientationchange', setVisualViewportHeight);
      };
    }
  }, [isMobile]);


  const handleLogout = async () => {
    try {
      await signOut();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/login');
    } catch (error) {
      toast({ variant: "destructive", title: "Logout Failed", description: "An error occurred. Please try again." });
    }
  };

  const navItems = [
    { title: "Home", href: "/", icon: Home },
    { title: "Discover", href: "/discover", icon: Compass },
    { title: "News", href: "/news", icon: Newspaper },
    { title: "Messages", href: "/messages", icon: MessageSquare },
  ];

  const rootLayoutClasses = cn(
    "flex flex-col bg-background",
    isMobile ? "h-[calc(var(--vh-dynamic,1vh)*100)]" : "min-h-screen"
  );

  const hideAppChrome = false;
  
  // Determine if the current page should show the contextual header icons
  const showContextualHeaderIcons = user && ['/', '/discover', '/news'].some(p => pathname === p || pathname.startsWith(p + '/'));

  return (
    <div className={rootLayoutClasses}>
      {!hideAppChrome && (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-14 max-w-screen-2xl items-center px-4">
            <div className="mr-4 flex items-center">
              <Link href="/" className="mr-2 flex items-center space-x-2" aria-label="Go to homepage">
                <Handshake className="h-6 w-6 text-primary" />
                 <span className="hidden font-bold sm:inline-block text-primary hover:text-primary/90 text-lg">
                  AnonyCollab
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-4 text-sm lg:gap-6 ml-4">
                {navItems.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={cn(
                      "transition-colors hover:text-foreground/80 flex items-center",
                      pathname === item.href ? 'text-foreground font-semibold' : 'text-foreground/60'
                    )}
                  >
                    <item.icon className="mr-1 h-4 w-4" aria-hidden="true" />
                    {item.title}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-3">
              {authLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-20 rounded-md bg-muted animate-pulse"></div>
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
                </div>
              ) : user ? (
                <>
                  {/* --- Mobile Contextual Header Icons --- */}
                  {isMobile && showContextualHeaderIcons && (
                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="icon" onClick={() => setSearchFilterVisible(prev => !prev)} className="h-8 w-8">
                         {isSearchFilterVisible ? <X className="h-5 w-5"/> : <Search className="h-5 w-5"/>}
                         <span className="sr-only">{isSearchFilterVisible ? 'Close Search & Filters' : 'Open Search & Filters'}</span>
                       </Button>
                       <Button variant="ghost" size="icon" onClick={handleCreateClick} className="h-8 w-8">
                         <PlusCircle className="h-5 w-5"/>
                         <span className="sr-only">Create New</span>
                       </Button>
                    </div>
                  )}

                  {user.uid && <DynamicNotificationDropdown userId={user.uid} />}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="User Menu" className="rounded-full h-8 w-8">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.photoURL ?? undefined} alt={getInitials(user.displayName || user.email)} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {getInitials(user.displayName || user.email)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user.displayName || generateAnonymousName(user.uid)}</p>
                          {user.email && (<p className="text-xs leading-none text-muted-foreground">{user.email}</p>)}
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="cursor-pointer"><Link href={`/profile/${user.uid}`}><User className="mr-2 h-4 w-4" /><span>Profile</span></Link></DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer"><Link href="/collections"><Bookmark className="mr-2 h-4 w-4" /><span>Saved Items</span></Link></DropdownMenuItem>
                      <DropdownMenuItem asChild onMouseEnter={handlePrefetchSettings} className="cursor-pointer"><Link href="/settings/profile"><Settings className="mr-2 h-4 w-4" /><span>Settings</span></Link></DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer"><Link href="/subscription"><CreditCard className="mr-2 h-4 w-4"/><span>Subscription</span></Link></DropdownMenuItem>
                      <DynamicThemeToggle />
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="cursor-pointer"><LogOut className="mr-2 h-4 w-4" /><span>Log out</span></DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild><Link href="/login">Login</Link></Button>
                  <Button variant="default" size="sm" asChild><Link href="/signup">Sign Up</Link></Button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}
      <main className={cn("flex-1 flex flex-col", isMobile ? "pb-14" : "pb-0")}>
        {children}
      </main>
      {!hideAppChrome && isMobile && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border h-14">
          <div className="container mx-auto flex justify-around items-center h-full px-1">
            {navItems.map((item) => (
              <Link
                key={`mobile-${item.title}`}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center text-xs px-2 py-1 rounded-md transition-colors w-1/4 h-full",
                  pathname === item.href ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'
                )}
              >
                <item.icon className="h-5 w-5 mb-0.5" aria-hidden="true" />
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
