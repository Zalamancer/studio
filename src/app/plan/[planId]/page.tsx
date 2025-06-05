
// src/app/plan/[planId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getPlanById } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep } from '@/types/plan';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Brain, Share2, Presentation, MessageSquare, Plus, Undo, Redo, Layers, Minus, HelpCircle, User, MapPin, MousePointer2, LayoutGrid, StickyNote, Type, Share, PenTool, Square, Frame, Move, GripVertical } from 'lucide-react';
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

const NODE_WIDTH = 256; // approx 64 * 4 (w-64)
const NODE_HEIGHT = 160; // estimated height for a card with a couple of sub-steps
const NODE_WIDTH_WITH_MARGIN = NODE_WIDTH + 32; // Add some margin for spacing
const NODE_HEIGHT_WITH_MARGIN = NODE_HEIGHT + 48; // Add some margin for spacing
const DOT_SIZE = 8; // px
const DOT_OFFSET = -DOT_SIZE / 2; // px, to center the dot on the edge

interface RoadmapStepCardProps {
  step: RoadmapStep;
  onAddSubStep: (parentId: string, parentTitle: string) => void;
  onSelectStep: (event: React.MouseEvent, stepId: string) => void; // Pass event for stopPropagation
  onInitiateNodeFromDot: (event: React.MouseEvent, sourceStepId: string, sourceAnchor: 'N' | 'S' | 'E' | 'W') => void; // Pass event
  isSelected: boolean;
  isSubmitting: boolean;
  onMouseDownOnNode: (event: React.MouseEvent, stepId: string) => void; // Pass event
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = ({
  step,
  onAddSubStep,
  onSelectStep,
  onInitiateNodeFromDot,
  isSelected,
  isSubmitting,
  onMouseDownOnNode,
}) => {
  // isHovered state removed as dot visibility is now tied to isSelected

  const handleDotClick = (e: React.MouseEvent, anchor: 'N' | 'S' | 'E' | 'W') => {
    e.stopPropagation(); // Prevent card selection/deselection when clicking a dot
    onInitiateNodeFromDot(e, step.id, anchor);
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection/deselection when starting a drag
    onMouseDownOnNode(e, step.id);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // This ensures that clicking the card body itself (not header or dots) triggers selection.
    // Propagation is not stopped here, as this is the intended selection click.
    onSelectStep(e, step.id);
  };


  return (
    <div
      className={cn(
        "absolute bg-card border rounded-lg shadow-md w-64 cursor-default",
        isSelected && "ring-2 ring-primary shadow-primary/30 z-10"
      )}
      style={{ left: `${step.x}px`, top: `${step.y}px` }}
      onClick={handleCardClick} // Main card click for selection
    >
      {/* Draggable Header */}
      <CardHeader
        className="p-2.5 bg-muted/50 rounded-t-lg cursor-grab active:cursor-grabbing flex flex-row items-center"
        onMouseDown={handleHeaderMouseDown} // Drag initiation
      >
        <GripVertical className="h-4 w-4 text-muted-foreground mr-1.5 flex-shrink-0" />
        <div className="flex-grow min-w-0">
          <CardTitle className="text-sm font-semibold truncate" title={step.title}>{step.title}</CardTitle>
          {step.type && <CardDescription className="text-xs">{step.type}</CardDescription>}
        </div>
      </CardHeader>

      {/* Content */}
      {step.subSteps && step.subSteps.length > 0 && (
        <CardContent className="p-2.5 pt-1.5 border-t max-h-20 overflow-y-auto">
          <p className="text-xs font-medium mb-1 text-muted-foreground">Sub-steps:</p>
          <ul className="list-disc list-inside pl-1 space-y-0.5">
            {step.subSteps.map((subStep) => (
              <li key={subStep.id} className="text-xs text-muted-foreground truncate" title={subStep.title}>
                {subStep.title} ({subStep.type})
              </li>
            ))}
          </ul>
        </CardContent>
      )}

      {/* Footer */}
      <CardFooter className="p-2 border-t flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-1">
        <Button
          variant="outline"
          size="xs"
          onClick={(e) => { e.stopPropagation(); onAddSubStep(step.id, step.title); }} // Stop propagation here too
          disabled={isSubmitting}
          className="text-xs w-full sm:w-auto"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Sub-step
        </Button>
      </CardFooter>

      {/* Connection Dots - Show if selected */}
      {isSelected && (
        <>
          {/* North Dot */}
          <Button
            variant="outline" size="icon"
            className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary"
            style={{ top: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE / 2}px)`, width: DOT_SIZE * 2, height: DOT_SIZE * 2, padding: 0 }}
            onClick={(e) => handleDotClick(e, 'N')} title="Add step above"
          ><Plus className="h-3 w-3" /></Button>
          {/* South Dot */}
          <Button
            variant="outline" size="icon"
            className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary"
            style={{ bottom: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE / 2}px)`, width: DOT_SIZE * 2, height: DOT_SIZE * 2, padding: 0 }}
            onClick={(e) => handleDotClick(e, 'S')} title="Add step below"
          ><Plus className="h-3 w-3" /></Button>
          {/* West Dot */}
          <Button
            variant="outline" size="icon"
            className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary"
            style={{ left: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE / 2}px)`, width: DOT_SIZE * 2, height: DOT_SIZE * 2, padding: 0 }}
            onClick={(e) => handleDotClick(e, 'W')} title="Add step to the left"
          ><Plus className="h-3 w-3" /></Button>
          {/* East Dot */}
          <Button
            variant="outline" size="icon"
            className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary"
            style={{ right: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE / 2}px)`, width: DOT_SIZE * 2, height: DOT_SIZE * 2, padding: 0 }}
            onClick={(e) => handleDotClick(e, 'E')} title="Add step to the right"
          ><Plus className="h-3 w-3" /></Button>
        </>
      )}
    </div>
  );
};


const ViewPlanPage = () => {
  const paramsFromHook = useParams();
  const params = paramsFromHook;
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  const planId = params?.planId as string | undefined;

  const [roadmapSteps, setRoadmapSteps] = useState<RoadmapStep[]>([]);
  const [isAddStepDialogOpen, setIsAddStepDialogOpen] = useState(false);
  const [currentParentStepForDialog, setCurrentParentStepForDialog] = useState<{ id: string; title: string } | null>(null);
  const [pendingNodeFromDotInfo, setPendingNodeFromDotInfo] = useState<{ sourceStepId: string; sourceAnchor: 'N' | 'S' | 'E' | 'W'; } | null>(null);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

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
      if (!planId || !isPlanIdValidUid) return null;
      return getPlanById(planId);
    },
    enabled: !!planId && isPlanIdValidUid && !authLoading,
  });

  useEffect(() => {
    if (plan?.roadmap && roadmapSteps.length === 0) { // Only init if roadmapSteps is empty
      setRoadmapSteps(plan.roadmap);
    }
  }, [plan, roadmapSteps.length]);


  const handleInitiateNodeFromDot = useCallback((event: React.MouseEvent, sourceStepId: string, sourceAnchor: 'N' | 'S' | 'E' | 'W') => {
    // event.stopPropagation(); // Already done in RoadmapStepCard's handleDotClick
    setSelectedStepId(sourceStepId); // Ensure the source node is selected
    setPendingNodeFromDotInfo({ sourceStepId, sourceAnchor });
    setCurrentParentStepForDialog(null);
    setIsAddStepDialogOpen(true);
  }, []);

  const openAddMainStepDialog = useCallback(() => {
    setCurrentParentStepForDialog(null);
    setPendingNodeFromDotInfo(null);
    setIsAddStepDialogOpen(true);
  }, []);

  const openAddSubStepDialog = useCallback((parentId: string, parentTitle: string) => {
    // event.stopPropagation(); // Already done in RoadmapStepCard's button onClick
    setSelectedStepId(parentId); // Select the parent when adding sub-step
    setCurrentParentStepForDialog({ id: parentId, title: parentTitle });
    setPendingNodeFromDotInfo(null);
    setIsAddStepDialogOpen(true);
  }, []);
  
  const handleSelectStep = useCallback((event: React.MouseEvent, stepId: string) => {
    // This is the direct click on the card body for selection/deselection
    // event.stopPropagation(); // Not needed here, this is the primary selection event for the card
    setSelectedStepId(prevId => (prevId === stepId ? null : stepId));
  }, []);


  const handleAddRoadmapStepSubmit = useCallback((data: AddRoadmapStepFormData) => {
    setIsSubmittingStep(true);
    const newStepBase = {
      id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: data.title,
      type: data.type,
    };

    setRoadmapSteps(prevSteps => {
      if (currentParentStepForDialog) {
        return prevSteps.map(step =>
          step.id === currentParentStepForDialog.id
            ? { ...step, subSteps: [...(step.subSteps || []), { ...newStepBase, parentId: step.id, x:0, y:0 } as RoadmapSubStep] }
            : step
        );
      } else {
        let newX = 20;
        let newY = (prevSteps.filter(s => s.type === 'Main Category/Phase').length * (NODE_HEIGHT_WITH_MARGIN)) + 20; // Default vertical stacking
        let sourceNodeId: string | undefined = undefined;
        let sourceAnchor: 'N' | 'S' | 'E' | 'W' | undefined = undefined;

        if (pendingNodeFromDotInfo) {
            const sourceStep = prevSteps.find(s => s.id === pendingNodeFromDotInfo.sourceStepId);
            if (sourceStep) {
                sourceNodeId = sourceStep.id;
                sourceAnchor = pendingNodeFromDotInfo.sourceAnchor;
                switch(pendingNodeFromDotInfo.sourceAnchor) {
                    case 'N': newX = sourceStep.x; newY = sourceStep.y - NODE_HEIGHT_WITH_MARGIN; break;
                    case 'S': newX = sourceStep.x; newY = sourceStep.y + NODE_HEIGHT_WITH_MARGIN; break;
                    case 'E': newX = sourceStep.x + NODE_WIDTH_WITH_MARGIN; newY = sourceStep.y; break;
                    case 'W': newX = sourceStep.x - NODE_WIDTH_WITH_MARGIN; newY = sourceStep.y; break;
                }
            }
        } else if (prevSteps.filter(s => s.type === 'Main Category/Phase').length > 0) {
            const mainSteps = prevSteps.filter(s => s.type === 'Main Category/Phase');
            const lastMainStep = mainSteps.sort((a,b) => a.y - b.y)[mainSteps.length-1]; // Simplistic: find lowest positioned one
            newX = lastMainStep.x; // Stack below by default if not from dot
            newY = lastMainStep.y + NODE_HEIGHT_WITH_MARGIN;
        }
        
        newX = Math.max(0, newX); // Ensure within bounds
        newY = Math.max(0, newY);

        const newMainStep: RoadmapStep = { ...newStepBase, subSteps: [], x: newX, y: newY, sourceNodeId, sourceAnchor };
        return [...prevSteps, newMainStep];
      }
    });

    toast({ title: "Step Added", description: `"${data.title}" added to the roadmap.` });
    setIsAddStepDialogOpen(false);
    setCurrentParentStepForDialog(null);
    setPendingNodeFromDotInfo(null);
    setIsSubmittingStep(false);
  }, [currentParentStepForDialog, pendingNodeFromDotInfo, toast]);

  const handleMouseDownOnNode = useCallback((event: React.MouseEvent, stepId: string) => {
    // event.stopPropagation(); // Already done in RoadmapStepCard's handleHeaderMouseDown
    const stepToDrag = roadmapSteps.find(s => s.id === stepId);
    if (stepToDrag) {
      setSelectedStepId(stepId); // Ensure node is selected when drag starts
      setDraggingNodeId(stepId);
      setDragStartPos({ x: event.clientX, y: event.clientY });
      setNodeStartPos({ x: stepToDrag.x, y: stepToDrag.y });
    }
  }, [roadmapSteps]);

  const handleMouseMoveOnCanvas = useCallback((event: React.MouseEvent) => {
    if (draggingNodeId && dragStartPos && nodeStartPos) {
      const dx = event.clientX - dragStartPos.x;
      const dy = event.clientY - dragStartPos.y;
      setRoadmapSteps(prevSteps =>
        prevSteps.map(step =>
          step.id === draggingNodeId
            ? { ...step, x: Math.max(0, nodeStartPos.x + dx), y: Math.max(0, nodeStartPos.y + dy) }
            : step
        )
      );
    }
  }, [draggingNodeId, dragStartPos, nodeStartPos]);

  const handleMouseUpOnCanvas = useCallback(() => {
    setDraggingNodeId(null);
    setDragStartPos(null);
    setNodeStartPos(null);
  }, []);
  
  const handleCanvasClick = useCallback(() => {
    // Only deselect if the click is directly on the canvas, not on a node or its interactive elements
    setSelectedStepId(null);
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
  
  let dialogTitleForAddStep = "Add New Main Roadmap Step";
  if (currentParentStepForDialog) {
    dialogTitleForAddStep = `Add Sub-step to "${currentParentStepForDialog.title}"`;
  } else if (pendingNodeFromDotInfo) {
    const sourceStepTitle = roadmapSteps.find(s => s.id === pendingNodeFromDotInfo.sourceStepId)?.title || "Selected Step";
    dialogTitleForAddStep = `Add New Step from "${sourceStepTitle}" (${pendingNodeFromDotInfo.sourceAnchor} anchor)`;
  }

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
            onMouseLeave={handleMouseUpOnCanvas} // Added to handle mouse leaving canvas during drag
            onClick={handleCanvasClick} // Deselect on canvas click
        >
          <div className="absolute top-4 left-4 z-20">
            <Button
              variant="outline"
              onClick={(e) => { e.stopPropagation(); openAddMainStepDialog(); }} // Stop propagation
              disabled={isSubmittingStep || isAddStepDialogOpen}
              className="shadow-md bg-card hover:bg-muted"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Main Roadmap Step
            </Button>
          </div>

          {roadmapSteps.filter(step => step.type === 'Main Category/Phase').map(step => (
              <RoadmapStepCard
                key={step.id}
                step={step}
                onAddSubStep={openAddSubStepDialog}
                onSelectStep={handleSelectStep}
                onInitiateNodeFromDot={handleInitiateNodeFromDot}
                isSelected={selectedStepId === step.id}
                isSubmitting={isSubmittingStep || isAddStepDialogOpen}
                onMouseDownOnNode={handleMouseDownOnNode}
              />
            ))}
          
          {roadmapSteps.length === 0 && !isAddStepDialogOpen && (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none">
              <StickyNote className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium">Roadmap is empty.</p>
              <p className="text-xs">Click "Add Main Roadmap Step" to begin planning.</p>
            </div>
          )}
          
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
          isSubStep={!!currentParentStepForDialog || (!!pendingNodeFromDotInfo && data.type === 'Sub-category/Task')}
          dialogTitle={dialogTitleForAddStep}
        />
      )}
    </div>
  );
};

export default ViewPlanPage;
    
