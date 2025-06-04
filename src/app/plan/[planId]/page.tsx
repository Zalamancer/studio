
// src/app/plan/[planId]/page.tsx
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getPlanById } from '@/services/planService';
import type { ClientPlan } from '@/types/plan';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Brain, Share2, Presentation, MessageSquare, Lock, MoreHorizontal, MapPin, MousePointer2, LayoutGrid, StickyNote, Type, Share, PenTool, Square, Frame, Upload, Plus, Undo, Redo, Layers, Minus, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import Link from 'next/link';
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ViewPlanPage = () => {
  const params = useParams();
  const planId = params?.planId as string | undefined;
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();

  const isPlanIdValidUid = React.useMemo(() => {
    if (!planId) return false;
    return IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20;
  }, [planId]);

  const { data: plan, isLoading, error } = useQuery<ClientPlan | null, Error>({
    queryKey: ['plan', planId],
    queryFn: async () => {
      if (!planId || !isPlanIdValidUid) {
        return null;
      }
      return getPlanById(planId);
    },
    enabled: !!planId && isPlanIdValidUid && !authLoading,
  });

  if (authLoading || (isLoading && isPlanIdValidUid)) {
    return (
      <div className="flex flex-col flex-grow items-center justify-center min-h-[calc(100vh-8rem)] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!planId || !isPlanIdValidUid) {
     return (
      <div className="flex flex-col flex-grow items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
        <h1 className="text-xl font-semibold">Invalid Plan ID</h1>
        <p className="text-muted-foreground">The plan identifier in the URL is not valid.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-grow items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
        <h1 className="text-xl font-semibold">Error Loading Plan</h1>
        <p className="text-muted-foreground">{error.message || "Could not load the collaboration plan."}</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  if (!isLoading && !plan) {
    return (
      <div className="flex flex-col flex-grow items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <Brain className="h-10 w-10 text-muted-foreground mb-2" />
        <h1 className="text-xl font-semibold">Plan Not Found</h1>
        <p className="text-muted-foreground">The collaboration plan does not exist or you may not have permission.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button>
      </div>
    );
  }
  
  if (!plan) { // Still loading or error handled above
    return (
      <div className="flex flex-col flex-grow items-center justify-center min-h-[calc(100vh-8rem)] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const isOwner = currentUser?.uid === plan.ownerId;
  const ownerDisplayName = generateAnonymousName(plan.ownerId);
  
  const toolbarIcons = [ MousePointer2, LayoutGrid, StickyNote, Type, Share, PenTool, Square, Frame, Plus, Undo, Redo ];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden absolute inset-0">
      {/* Top Toolbar */}
      <header className="h-12 flex-shrink-0 bg-card border-b border-border flex items-center px-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/discover" className="p-1 rounded hover:bg-muted">
             <Brain className="h-6 w-6 text-primary" />
          </Link>
          <div className="h-5 w-px bg-border"></div>
          <h1 className="text-sm font-semibold text-foreground truncate" title={plan.name}>
            {plan.name}
          </h1>
           {isOwner && <Badge variant="outline" className="text-xs ml-2 hidden sm:inline-flex">Owner</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8"><MessageSquare className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Presentation className="h-4 w-4" /></Button>
          <Button variant="default" size="sm" className="h-8">
            <Share2 className="h-4 w-4 mr-1.5 sm:mr-2" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          {currentUser && (
            <Avatar className="h-7 w-7">
              <AvatarImage src={currentUser.photoURL || undefined} alt={currentUser.displayName || 'User'} />
              <AvatarFallback className="text-xs">{getInitials(currentUser.displayName || currentUser.email || 'U')}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Vertical Toolbar */}
        <aside className="w-12 sm:w-14 bg-card border-r border-border flex flex-col items-center py-3 space-y-1 flex-shrink-0 shadow-sm">
          {toolbarIcons.slice(0,8).map((Icon, index) => (
            <Button key={index} variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-primary hover:bg-primary/10">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          ))}
          <div className="flex-grow"></div>
           {toolbarIcons.slice(8).map((Icon, index) => (
            <Button key={`bottom-${index}`} variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-primary hover:bg-primary/10">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          ))}
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 grid-background relative overflow-auto flex items-center justify-center">
          {/* Example Content Element */}
          <div className="bg-card border-2 border-foreground rounded-xl shadow-xl p-4 w-48 h-24 flex items-center justify-center text-foreground">
            hi
          </div>
          
          {/* Bottom Right Controls */}
          <div className="absolute bottom-4 right-4 bg-card border border-border rounded-lg shadow-md flex items-center p-0.5 space-x-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7"><Layers className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Minus className="h-4 w-4" /></Button>
            <span className="text-xs px-2 text-muted-foreground">100%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"><HelpCircle className="h-4 w-4" /></Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ViewPlanPage;

    
