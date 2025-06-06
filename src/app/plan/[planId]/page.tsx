
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'; // Updated import
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
import type { ClientPlan, RoadmapStep, NewPlanData } from '@/types/plan';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn, IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { RoadmapNodeCard } from '@/components/plan/RoadmapNodeCard'; // Import the new component

const MIN_CANVAS_PADDING = 20;
const NODE_WIDTH = 200; // Example width, matches RoadmapNodeCard
const NODE_HEIGHT = 80; // Example min-height, matches RoadmapNodeCard

// Type for storing drag operation state
interface DraggingNodeInfo {
  nodeId: string;
  // Store the offset from the node's top-left corner to the mouse click position
  offsetX: number;
  offsetY: number;
}

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
  const [draggingNodeInfo, setDraggingNodeInfo] = useState<DraggingNodeInfo | null>(null);

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
      const newHeight = Math.max(window.innerHeight, MIN_CANVAS_PADDING * 2);
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
      await updatePlanRoadmap(planId, user.uid, editableRoadmap);
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
    if (!isOwner || !planData) return;
    let initialX = 100;
    let initialY = 100;

    if (canvasRef.current) {
      initialX = canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_WIDTH / 2;
      initialY = canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - NODE_HEIGHT / 2;
    }
    
    // Ensure new node is within reasonable bounds initially
    initialX = Math.max(NODE_WIDTH / 2, initialX); // Adjust for node width/height if needed
    initialY = Math.max(NODE_HEIGHT / 2, initialY);

    const newNode: RoadmapStep = {
      id: `step-${Date.now()}-${uuidv4().substring(0, 8)}`,
      title: "New Step",
      description: "",
      x: initialX,
      y: initialY,
      subSteps: [],
    };
    setEditableRoadmap(prev => [...prev, newNode]);
    toast({ title: "Node Added", description: "A new node has been added to the plan. Remember to save." });
  };

  const handleNodeMouseDown = useCallback((nodeId: string, event: React.MouseEvent<HTMLDivElement>) => {
    if (!isOwner) return;
    event.preventDefault(); // Prevent text selection, etc.
    const nodeElement = event.currentTarget;
    const nodeRect = nodeElement.getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();

    if (!canvasRect) return;

    // Calculate offset from node's top-left to mouse click
    const offsetX = event.clientX - nodeRect.left;
    const offsetY = event.clientY - nodeRect.top;

    setDraggingNodeInfo({
      nodeId,
      offsetX,
      offsetY,
    });
  }, [isOwner]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingNodeInfo || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Calculate new top-left for the node based on mouse position, canvas offset, and initial click offset within the node
    let newX = event.clientX - canvasRect.left - draggingNodeInfo.offsetX + canvasRef.current.scrollLeft;
    let newY = event.clientY - canvasRect.top - draggingNodeInfo.offsetY + canvasRef.current.scrollTop;

    // Clamp to canvas boundaries (optional, simple clamping)
    newX = Math.max(0, Math.min(newX, canvasRef.current.scrollWidth - NODE_WIDTH));
    newY = Math.max(0, Math.min(newY, canvasRef.current.scrollHeight - NODE_HEIGHT));


    setEditableRoadmap(prevRoadmap =>
      prevRoadmap.map(step =>
        step.id === draggingNodeInfo.nodeId
          ? { ...step, x: newX, y: newY }
          : step
      )
    );
  }, [draggingNodeInfo]);

  const handleCanvasMouseUpOrLeave = useCallback(() => {
    if (draggingNodeInfo) {
      setDraggingNodeInfo(null);
      // Optionally, you could trigger a save here or mark as dirty
      // For now, relies on manual "Save Plan" button
    }
  }, [draggingNodeInfo]);


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
            <Button variant="outline" size="sm" className="h-8" onClick={handleAddNewNodeClick} disabled={isSavingRoadmap}>
              <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">+ Node</span>
              <span className="sm:hidden">+</span>
            </Button>
          )}
          {isOwner && (
            <Button variant="default" size="sm" className="h-8" onClick={saveRoadmapChanges} disabled={isSavingRoadmap}>
              {isSavingRoadmap ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              <span className="hidden sm:inline">Save Plan</span>
              <span className="sm:hidden">Save</span>
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8" onClick={sharePlan}>
            <Share2 className="h-4 w-4 mr-1.5 sm:mr-2" />
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
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUpOrLeave}
          onMouseLeave={handleCanvasMouseUpOrLeave} // Handle mouse leaving canvas while dragging
        >
          {editableRoadmap.length === 0 && !isLoadingPlan && (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none">
              <Map className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">Collaboration Plan Area</p>
              <p className="text-sm mt-1">
                {isOwner ? "Click '+ Node' in the header to add your first step." : "This plan currently has no steps defined."}
              </p>
            </div>
          )}
          {editableRoadmap.map(step => (
            <RoadmapNodeCard
              key={step.id}
              step={step}
              onNodeMouseDown={handleNodeMouseDown}
              isDragging={draggingNodeInfo?.nodeId === step.id}
            />
          ))}
        </main>
      </div>
    </div>
  );
}
