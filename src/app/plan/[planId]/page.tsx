
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'; // Corrected import
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Share2,
  Save,
  ChevronLeft,
  AlertTriangle,
  Map,
  Plus, // Added Plus icon
} from 'lucide-react';

import { getPlanById, updatePlanRoadmap } from '@/services/planService';
import type { ClientPlan, RoadmapStep } from '@/types/plan';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn, IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import Link from 'next/link';

// AddRoadmapStepDialog and related types/state removed as per previous request

const MIN_CANVAS_PADDING = 20;

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);

  const planId = params?.planId as string | undefined;

  const [isSavingRoadmap, setIsSavingRoadmap] = useState(false);
  const [canvasMinHeight, setCanvasMinHeight] = useState<number | string>('100vh');
  // State for AddRoadmapStepDialog removed

  const isValidPlanId = useMemo(() => !!planId && (IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20), [planId]);

  const { data: planData, isLoading: isLoadingPlan, error: planError } = useQuery<ClientPlan | null>({
    queryKey: ['plan', planId],
    queryFn: async () => (planId && isValidPlanId) ? getPlanById(planId) : null,
    enabled: !!planId && isValidPlanId && !authLoading,
  });

  useEffect(() => {
    if (canvasRef.current) {
        const newHeight = Math.max(window.innerHeight, MIN_CANVAS_PADDING * 2 );
        setCanvasMinHeight(newHeight);
    }
  }, []);

  const isOwner = useMemo(() => !!user && !!planData && user.uid === planData.ownerId, [user, planData]);

  // saveRoadmapChanges now saves an empty roadmap or the current (potentially empty) planData.roadmap
  const saveRoadmapChanges = async () => {
    if (!planData || !user || !planId || !isOwner) {
      toast({ variant: "destructive", title: "Error", description: "Cannot save: Plan data, user authentication, or ownership missing." });
      return;
    }
    setIsSavingRoadmap(true);
    try {
      // Saves the current state of planData.roadmap, which is empty after previous modifications
      await updatePlanRoadmap(planId, user.uid, planData.roadmap || []);
      toast({ title: "Plan State Saved", description: "The current plan state has been saved." });
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save plan." });
    } finally {
      setIsSavingRoadmap(false);
    }
  };

  const sharePlan = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link Copied!", description: "Plan URL copied to clipboard." });
    } catch (err) {
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy link to clipboard." });
    }
  };

  // handleAddRoadmapStepSubmit and related logic removed

  const handleAddNewNodeClick = () => {
    if (!isOwner) return;
    console.log("'+ Node' button clicked. Owner action.");
    // Here you would typically open a dialog or initiate node creation logic.
    // For now, it just logs.
    toast({ title: "Action: + Node", description: "Functionality to add node to be implemented."});
    // Example: setIsAddStepDialogOpen(true);
  };


  if (authLoading || (isLoadingPlan && isValidPlanId)) {
    return <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (!planId || !isValidPlanId) {
    return (
        <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
            <h1 className="text-xl font-semibold">Invalid Plan ID</h1>
            <p className="text-muted-foreground">The plan identifier in the URL is not valid.</p>
            <Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button>
        </div>
    );
  }
  if (planError) {
    return (
        <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
            <h1 className="text-xl font-semibold">Error Loading Plan</h1>
            <p className="text-muted-foreground">{planError.message || "Could not load the collaboration plan."}</p>
            <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
        </div>
    );
  }
  if (!planData) {
    return (
        <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
            <Map className="h-10 w-10 text-muted-foreground mb-2" />
            <h1 className="text-xl font-semibold">Plan Not Found</h1>
            <p className="text-muted-foreground">The collaboration plan does not exist or you may not have permission to view it.</p>
            <Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button>
        </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden">
      <header className="h-12 flex-shrink-0 bg-card border-b border-border flex items-center px-3 shadow-sm">
        <div className="flex items-center gap-2">
            <Link href="/discover" className="p-1 rounded hover:bg-muted" aria-label="Back to Discover">
                <ChevronLeft className="h-6 w-6 text-primary" />
            </Link>
            <div className="h-5 w-px bg-border"></div>
            <h1 className="text-sm font-semibold text-foreground truncate" title={planData.name}>
                {planData.name}
            </h1>
            {isOwner && <Badge variant="outline" className="text-xs ml-2 hidden sm:inline-flex">Owner</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-2">
            {isOwner && (
                 <Button variant="outline" size="sm" className="h-8" onClick={handleAddNewNodeClick}>
                    <Plus className="h-4 w-4 mr-1.5 sm:mr-2"/>
                    <span className="hidden sm:inline">+ Node</span>
                    <span className="sm:hidden">+</span>
                </Button>
            )}
            {isOwner && (
                 <Button variant="default" size="sm" className="h-8" onClick={saveRoadmapChanges} disabled={isSavingRoadmap}>
                    {isSavingRoadmap ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5"/>}
                    <span className="hidden sm:inline">Save Plan</span>
                    <span className="sm:hidden">Save</span>
                </Button>
            )}
            <Button variant="outline" size="sm" className="h-8" onClick={sharePlan}>
                <Share2 className="h-4 w-4 mr-1.5 sm:mr-2"/>
                <span className="hidden sm:inline">Share</span>
                <span className="sm:hidden">Share</span>
            </Button>
            {user && (
                <Avatar className="h-7 w-7">
                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
                    <AvatarFallback className="text-xs">{user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}</AvatarFallback>
                </Avatar>
            )}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main
          ref={canvasRef}
          className="flex-1 grid-background relative overflow-auto p-4 md:p-6"
          style={{ minHeight: canvasMinHeight }}
        >
          <div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none">
              <Map className="h-16 w-16 mb-4"/>
              <p className="text-lg font-medium">Collaboration Plan Area</p>
              <p className="text-sm mt-1">Roadmap content has been cleared. Use header controls if you are the owner.</p>
          </div>
        </main>
      </div>
      {/* Dialogs for AddStep, StepDetail, Node Deletion were removed */}
    </div>
  );
}
