
// src/app/plan/[planId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getPlanById } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep } from '@/types/plan';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Brain, Share2, Presentation, MessageSquare, Plus, Undo, Redo, Layers, Minus, HelpCircle, User, MapPin, MousePointer2, LayoutGrid, StickyNote, Type, Share, PenTool, Square, Frame, Move } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import Link from 'next/link';
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AddRoadmapStepDialog, type AddRoadmapStepFormData } from '@/components/plan/AddRoadmapStepDialog';
import { useToast } from '@/hooks/use-toast';

interface RoadmapStepCardProps {
  step: RoadmapStep;
  onAddSubStep: (parentId: string, parentTitle: string) => void;
  onSelectStep: (stepId: string) => void;
  onAddNewMainStepAfter: (currentStepId: string) => void;
  isSelected: boolean;
  isSubmitting: boolean;
  onMouseDown: (event: React.MouseEvent, stepId: string) => void;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = ({
  step,
  onAddSubStep,
  onSelectStep,
  onAddNewMainStepAfter,
  isSelected,
  isSubmitting,
  onMouseDown,
}) => {
  return (
    <div
      className={cn(
        "absolute bg-card border rounded-lg shadow-md w-60 sm:w-64 cursor-default", // Changed to cursor-default for main card
        isSelected && "ring-2 ring-primary shadow-primary/30 z-10"
      )}
      style={{ left: `${step.x}px`, top: `${step.y}px` }}
      onClick={() => onSelectStep(step.id)} // Keep selection logic on the main card
    >
      <CardHeader 
        className="p-2.5 bg-muted/50 rounded-t-lg cursor-grab active:cursor-grabbing" // Draggable header
        onMouseDown={(e) => onMouseDown(e, step.id)}
      >
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Move className="h-3.5 w-3.5 text-muted-foreground" />
            {step.title}
        </CardTitle>
        {step.type && <CardDescription className="text-xs">{step.type}</CardDescription>}
      </CardHeader>
      {step.subSteps && step.subSteps.length > 0 && (
        <CardContent className="p-2.5 pt-1.5 border-t">
          <p className="text-xs font-medium mb-1 text-muted-foreground">Sub-steps:</p>
          <ul className="list-disc list-inside pl-1 space-y-0.5">
            {step.subSteps.map((subStep) => (
              <li key={subStep.id} className="text-xs text-muted-foreground">
                {subStep.title} ({subStep.type})
              </li>
            ))}
          </ul>
        </CardContent>
      )}
      <CardFooter className="p-2 border-t flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-1">
        <Button
          variant="outline"
          size="xs"
          onClick={(e) => { e.stopPropagation(); onAddSubStep(step.id, step.title); }}
          disabled={isSubmitting}
          className="text-xs w-full sm:w-auto"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Sub-step
        </Button>
        {isSelected && (
          <Button
            variant="outline"
            size="xs"
            onClick={(e) => { e.stopPropagation(); onAddNewMainStepAfter(step.id); }}
            disabled={isSubmitting}
            className="text-xs w-full sm:w-auto"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Next Main
          </Button>
        )}
      </CardFooter>
    </div>
  );
};


const ViewPlanPage = () => {
  const paramsFromHook = useParams();
  const params = paramsFromHook; // No React.use() here for client components
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null); // Ref for the main canvas area

  const planId = params?.planId as string | undefined;

  const [roadmapSteps, setRoadmapSteps] = useState<RoadmapStep[]>([]);
  const [isAddStepDialogOpen, setIsAddStepDialogOpen] = useState(false);
  const [currentParentStepForDialog, setCurrentParentStepForDialog] = useState<{ id: string; title: string } | null>(null);
  const [isAddingMainStepAfter, setIsAddingMainStepAfter] = useState<string | null>(null);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [nodeStartPos, setNodeStartPos] = useState<{ x: number; y: number } | null>(null);


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
  
  // Initialize roadmap steps from plan data (if available and not already initialized)
  useEffect(() => {
    if (plan?.roadmap && roadmapSteps.length === 0) {
      setRoadmapSteps(plan.roadmap);
    }
  }, [plan, roadmapSteps.length]);


  const openAddStepDialog = useCallback((parentId: string | null = null, parentTitle: string | null = null, addAfterStepId: string | null = null) => {
    if (parentId && parentTitle) {
      setCurrentParentStepForDialog({ id: parentId, title: parentTitle });
      setIsAddingMainStepAfter(null);
    } else {
      setCurrentParentStepForDialog(null);
      setIsAddingMainStepAfter(addAfterStepId);
    }
    setIsAddStepDialogOpen(true);
  }, []);
  
  const handleSelectStep = (stepId: string) => {
    setSelectedStepId(prevId => (prevId === stepId ? null : stepId));
  };

  const handleAddRoadmapStepSubmit = useCallback((data: AddRoadmapStepFormData) => {
    setIsSubmittingStep(true);
    const newStepBase = {
      id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: data.title,
      type: data.type,
    };

    setRoadmapSteps(prevSteps => {
      if (currentParentStepForDialog) { // Adding a sub-step
        return prevSteps.map(step =>
          step.id === currentParentStepForDialog.id
            ? { ...step, subSteps: [...(step.subSteps || []), { ...newStepBase, parentId: step.id, x:0, y:0 }] } // subSteps don't have x/y for now
            : step
        );
      } else { // Adding a main step
        let newX = 20;
        let newY = 20;
        if (isAddingMainStepAfter) { // Adding after a specific main step
            const parentStep = prevSteps.find(s => s.id === isAddingMainStepAfter);
            if (parentStep) {
                newX = parentStep.x + 280; // Offset to the right
                newY = parentStep.y;       // Same y-level
            } else if (prevSteps.length > 0) { // Fallback if parent not found, place after last
                const lastStep = prevSteps[prevSteps.length - 1];
                newX = lastStep.x + 280;
                newY = lastStep.y;
            }
        } else if (prevSteps.length > 0) { // Adding as a new main step, not after a specific one
            const lastStep = prevSteps[prevSteps.length - 1];
            newX = lastStep.x;
            newY = lastStep.y + 150; // Offset below the last step
        }

        const newMainStep: RoadmapStep = { ...newStepBase, subSteps: [], x: newX, y: newY };
        if (isAddingMainStepAfter) {
          const index = prevSteps.findIndex(step => step.id === isAddingMainStepAfter);
          if (index !== -1) {
            const stepsCopy = [...prevSteps];
            stepsCopy.splice(index + 1, 0, newMainStep);
            return stepsCopy;
          }
        }
        return [...prevSteps, newMainStep];
      }
    });

    toast({ title: "Step Added", description: `"${data.title}" added to the roadmap.` });
    setIsAddStepDialogOpen(false);
    setCurrentParentStepForDialog(null);
    setIsAddingMainStepAfter(null);
    setIsSubmittingStep(false);
  }, [currentParentStepForDialog, isAddingMainStepAfter, toast]);

  const handleMouseDownOnNode = useCallback((event: React.MouseEvent, stepId: string) => {
    event.preventDefault(); // Prevent default drag behavior
    event.stopPropagation();
    const stepToDrag = roadmapSteps.find(s => s.id === stepId);
    if (stepToDrag) {
      setDraggingNodeId(stepId);
      setDragStartPos({ x: event.clientX, y: event.clientY });
      setNodeStartPos({ x: stepToDrag.x, y: stepToDrag.y });
      setSelectedStepId(stepId); // Select the node being dragged
    }
  }, [roadmapSteps]);

  const handleMouseMoveOnCanvas = useCallback((event: React.MouseEvent) => {
    if (draggingNodeId && dragStartPos && nodeStartPos) {
      const dx = event.clientX - dragStartPos.x;
      const dy = event.clientY - dragStartPos.y;
      setRoadmapSteps(prevSteps =>
        prevSteps.map(step =>
          step.id === draggingNodeId
            ? { ...step, x: Math.max(0, nodeStartPos.x + dx), y: Math.max(0, nodeStartPos.y + dy) } // Ensure x, y >= 0
            : step
        )
      );
    }
  }, [draggingNodeId, dragStartPos, nodeStartPos]);

  const handleMouseUpOnCanvas = useCallback(() => {
    setDraggingNodeId(null);
    setDragStartPos(null);
    setNodeStartPos(null);
    // TODO: Persist roadmapSteps to Firestore here if needed
  }, []);
  

  if (authLoading || (isLoading && isPlanIdValidUid)) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!planId || !isPlanIdValidUid) {
     return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
        <h1 className="text-xl font-semibold">Invalid Plan ID</h1>
        <p className="text-muted-foreground">The plan identifier in the URL is not valid.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
        <h1 className="text-xl font-semibold">Error Loading Plan</h1>
        <p className="text-muted-foreground">{error.message || "Could not load the collaboration plan."}</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <Brain className="h-10 w-10 text-muted-foreground mb-2" />
        <h1 className="text-xl font-semibold">Plan Not Found</h1>
        <p className="text-muted-foreground">The collaboration plan does not exist or you may not have permission.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button>
      </div>
    );
  }

  const isOwner = currentUser?.uid === plan.ownerId;
  const ownerDisplayName = generateAnonymousName(plan.ownerId);
  const toolbarIcons = [ MousePointer2, LayoutGrid, StickyNote, Type, Share, PenTool, Square, Frame, Plus, Undo, Redo ];
  
  const dialogTitle = currentParentStepForDialog
    ? `Add Sub-step to "${currentParentStepForDialog.title}"`
    : isAddingMainStepAfter
    ? `Add New Main Step After Selected`
    : "Add New Main Roadmap Step";

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden">
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

        <main 
            ref={canvasRef}
            className="flex-1 grid-background relative overflow-auto p-4 md:p-6"
            onMouseMove={handleMouseMoveOnCanvas}
            onMouseUp={handleMouseUpOnCanvas}
            onMouseLeave={handleMouseUpOnCanvas} // Also clear drag state if mouse leaves canvas
        >
          <div className="absolute top-4 left-4 z-20"> {/* Ensure button is above draggable nodes */}
            <Button
              variant="outline"
              onClick={() => openAddStepDialog(null, null, null)}
              disabled={isSubmittingStep || isAddStepDialogOpen}
              className="shadow-md bg-card hover:bg-muted"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Main Roadmap Step
            </Button>
          </div>

          {roadmapSteps.length === 0 && !isAddStepDialogOpen && (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70">
              <StickyNote className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium">Roadmap is empty.</p>
              <p className="text-xs">Click "Add Main Roadmap Step" to begin planning.</p>
            </div>
          )}

          {/* Render draggable main steps */}
          {roadmapSteps.filter(step => step.type === 'Main Category/Phase').map(step => (
              <RoadmapStepCard
                key={step.id}
                step={step}
                onAddSubStep={openAddStepDialog}
                onSelectStep={handleSelectStep}
                onAddNewMainStepAfter={(currentId) => openAddStepDialog(null, null, currentId)}
                isSelected={selectedStepId === step.id}
                isSubmitting={isSubmittingStep || isAddStepDialogOpen}
                onMouseDown={handleMouseDownOnNode}
              />
            ))}
          
          <div className="absolute bottom-4 right-4 bg-card border border-border rounded-lg shadow-md flex items-center p-0.5 space-x-0.5 z-20">
            <Button variant="ghost" size="icon" className="h-7 w-7"><Layers className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Minus className="h-4 w-4" /></Button>
            <span className="text-xs px-2 text-muted-foreground">100%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"><HelpCircle className="h-4 w-4" /></Button>
          </div>
        </main>
      </div>
      
      {planId && (
        <AddRoadmapStepDialog
          isOpen={isAddStepDialogOpen}
          onOpenChange={setIsAddStepDialogOpen}
          onSubmit={handleAddRoadmapStepSubmit}
          isSubmitting={isSubmittingStep}
          parentStepTitle={currentParentStepForDialog?.title}
          isSubStep={!!currentParentStepForDialog} // True if adding a sub-step
          dialogTitle={dialogTitle}
        />
      )}
    </div>
  );
};

export default ViewPlanPage;
    