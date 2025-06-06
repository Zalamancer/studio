
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Share2,
  Save,
  ChevronLeft,
  AlertTriangle,
  Map,
  Plus,
} from 'lucide-react';

import { getPlanById, updatePlanRoadmap } from '@/services/planService';
import type { ClientPlan, RoadmapStep, NewPlanData } from '@/types/plan'; // Added NewPlanData
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn, IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs for new steps

const MIN_CANVAS_PADDING = 20;
const NODE_WIDTH = 200; // Example width
const NODE_HEIGHT = 100; // Example height
const NODE_SPACING_X = 50;
const NODE_SPACING_Y = 30;


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
  const [editableRoadmap, setEditableRoadmap] = useState<RoadmapStep[]>([]);

  const isValidPlanId = useMemo(() => !!planId && (IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20), [planId]);

  const { data: planData, isLoading: isLoadingPlan, error: planError, refetch: refetchPlanData } = useQuery<ClientPlan | null>({
    queryKey: ['plan', planId],
    queryFn: async () => (planId && isValidPlanId) ? getPlanById(planId) : null,
    enabled: !!planId && isValidPlanId && !authLoading,
  });

  useEffect(() => {
    if (planData) {
      setEditableRoadmap(planData.roadmap || []);
    } else {
      setEditableRoadmap([]);
    }
  }, [planData]);


  useEffect(() => {
    if (canvasRef.current) {
        const newHeight = Math.max(window.innerHeight, MIN_CANVAS_PADDING * 2 );
        setCanvasMinHeight(newHeight);
    }
  }, []);

  const isOwner = useMemo(() => !!user && !!planData && user.uid === planData.ownerId, [user, planData]);

  const saveRoadmapChanges = async () => {
    if (!planData || !user || !planId || !isOwner) {
      toast({ variant: "destructive", title: "Error", description: "Cannot save: Plan data, user authentication, or ownership missing." });
      return;
    }
    setIsSavingRoadmap(true);
    try {
      await updatePlanRoadmap(planId, user.uid, editableRoadmap); // Save the editableRoadmap
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

  const handleAddNewNodeClick = () => {
    if (!isOwner || !planData) return; // Ensure planData exists to calculate position
    console.log("'+ Node' button clicked. Owner action.");

    let initialX = 100;
    let initialY = 100;

    // Try to position the new node relative to the last node or center of canvas
    if (editableRoadmap.length > 0) {
        const lastNode = editableRoadmap[editableRoadmap.length - 1];
        initialX = lastNode.x + NODE_WIDTH + NODE_SPACING_X;
        initialY = lastNode.y; // Or adjust Y as well
    } else if (canvasRef.current) {
        initialX = canvasRef.current.scrollWidth / 2 - NODE_WIDTH / 2;
        initialY = canvasRef.current.scrollHeight / 2 - NODE_HEIGHT / 2;
    }
    
    // Ensure new node is within reasonable bounds initially
    initialX = Math.max(NODE_SPACING_X, initialX);
    initialY = Math.max(NODE_SPACING_Y, initialY);

    const newNode: RoadmapStep = {
      id: `step-${Date.now()}-${uuidv4().substring(0, 8)}`, // More robust unique ID
      title: "New Step",
      description: "",
      x: initialX,
      y: initialY,
      subSteps: [],
    };
    setEditableRoadmap(prev => [...prev, newNode]);
    toast({ title: "Node Added", description: "A new node has been added to the plan. Remember to save." });
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
          {editableRoadmap.length === 0 && (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none">
                <Map className="h-16 w-16 mb-4"/>
                <p className="text-lg font-medium">Collaboration Plan Area</p>
                <p className="text-sm mt-1">
                    {isOwner ? "Click '+ Node' in the header to add your first step." : "This plan currently has no steps defined."}
                </p>
            </div>
          )}
          {/* Render nodes from editableRoadmap */}
          {editableRoadmap.map(step => (
            <div
              key={step.id}
              className="absolute bg-card border border-border rounded-lg shadow-md p-3 w-[200px] min-h-[80px] cursor-grab" // Basic styling
              style={{
                left: `${step.x}px`,
                top: `${step.y}px`,
                width: `${NODE_WIDTH}px`,
                // minHeight: `${NODE_HEIGHT}px`, // If you want a min height
              }}
              // Draggability will be added later
            >
              <h3 className="text-sm font-semibold text-foreground truncate mb-1">{step.title}</h3>
              {step.description && <p className="text-xs text-muted-foreground line-clamp-2">{step.description}</p>}
              {/* Sub-steps rendering can be added here later if needed */}
            </div>
          ))}
           {/* SVG area for lines can be re-added here later */}
        </main>
      </div>
    </div>
  );
}

    