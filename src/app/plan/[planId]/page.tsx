
// src/app/plan/[planId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getPlanById } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep } from '@/types/plan';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Brain, Share2, Presentation, MessageSquare, Plus, Undo, Redo, Layers, Minus, HelpCircle, User, MapPin, MousePointer2, LayoutGrid, StickyNote, Type, ShareIcon, PenTool, Square, Frame, Move, GripVertical, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import Link from 'next/link';
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AddRoadmapStepDialog, type AddRoadmapStepFormData } from '@/components/plan/AddRoadmapStepDialog';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea

const NODE_WIDTH = 256; // Corresponds to w-64 Tailwind class

const DOT_SIZE = 8;
const DOT_OFFSET = -DOT_SIZE / 2; // -4px
const DOT_CONNECTION_OFFSET = 4; 

// Constants for height estimation
const CARD_HEADER_EST_HEIGHT = 40; // Approx height of CardHeader
const CARD_FOOTER_EST_HEIGHT = 40; // Approx height of CardFooter
const CARD_CONTENT_PADDING_EST_Y = 10; // Sum of top/bottom padding in CardContent
const CARD_DESCRIPTION_EST_HEIGHT = 18; // Approx height if CardDescription (type) is shown
const SUBSTEPS_LABEL_EST_HEIGHT = 20;   // Approx height of "Sub-steps:" label
const SUBSTEP_ITEM_EST_HEIGHT = 22;     // Approx height of one sub-step list item
const MIN_CARD_EST_HEIGHT = 120;        // A reasonable minimum height for any card

const getEstimatedCardHeight = (step: RoadmapStep): number => {
  let height = CARD_HEADER_EST_HEIGHT + CARD_FOOTER_EST_HEIGHT + CARD_CONTENT_PADDING_EST_Y;
  if (step.type) height += CARD_DESCRIPTION_EST_HEIGHT; // For CardDescription (type)
  if (step.subSteps && step.subSteps.length > 0) {
    height += SUBSTEPS_LABEL_EST_HEIGHT;
    height += step.subSteps.length * SUBSTEP_ITEM_EST_HEIGHT;
    height += 8; // Buffer for list styling / margins
  }
  // Add some buffer for title text wrapping, assuming title might take 1-2 lines
  height += 20; // Can be adjusted based on typical title lengths
  return Math.max(height, MIN_CARD_EST_HEIGHT);
};


interface RoadmapStepCardProps {
  step: RoadmapStep;
  onAddSubStep: (event: React.MouseEvent, parentId: string, parentTitle: string) => void;
  onCardClick: (step: RoadmapStep) => void;
  onInitiateNodeFromDot: (event: React.MouseEvent, sourceStepId: string, sourceAnchor: 'N' | 'S' | 'E' | 'W') => void;
  isSelected: boolean;
  isSubmitting: boolean;
  onMouseDownOnNode: (event: React.MouseEvent<HTMLDivElement>, stepId: string) => void;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = ({
  step,
  onAddSubStep,
  onCardClick,
  onInitiateNodeFromDot,
  isSelected,
  isSubmitting,
  onMouseDownOnNode,
}) => {

  const handleDotClick = useCallback((e: React.MouseEvent, anchor: 'N' | 'S' | 'E' | 'W') => {
    e.stopPropagation();
    onInitiateNodeFromDot(e, step.id, anchor);
  }, [onInitiateNodeFromDot, step.id]);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onMouseDownOnNode(e, step.id);
  }, [onMouseDownOnNode, step.id]);

  const handleMainCardClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.card-body-content')) {
       onCardClick(step);
    }
  }, [onCardClick, step]);

  const handleAddSubStepClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAddSubStep(e, step.id, step.title);
  }, [onAddSubStep, step.id, step.title]);

  return (
    <div
      className={cn(
        "absolute bg-card border rounded-lg shadow-md w-64 cursor-default z-10",
        "flex flex-col", 
        isSelected && "ring-2 ring-primary shadow-primary/30 z-20"
      )}
      style={{ left: `${step.x}px`, top: `${step.y}px` }}
      onClick={handleMainCardClick}
    >
      <CardHeader
        className="p-2.5 bg-muted/50 rounded-t-lg cursor-grab active:cursor-grabbing flex flex-row items-center flex-shrink-0"
        onMouseDown={handleHeaderMouseDown}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground mr-1.5 flex-shrink-0 pointer-events-none" />
        <div className="flex-grow min-w-0 pointer-events-none card-body-content">
          <CardTitle className="text-sm font-semibold truncate" title={step.title}>{step.title}</CardTitle>
          {step.type && <CardDescription className="text-xs">{step.type}</CardDescription>}
        </div>
      </CardHeader>

      <CardContent className="p-2.5 pt-1.5 border-t card-body-content"> 
        {step.subSteps && step.subSteps.length > 0 && (
          <>
            <p className="text-xs font-medium mb-1 text-muted-foreground">Sub-steps:</p>
            <ul className="list-disc list-inside pl-1 space-y-0.5">
              {step.subSteps.map((subStep) => (
                <li key={subStep.id} className="text-xs text-muted-foreground" title={subStep.title}>
                  {subStep.title} ({subStep.type})
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>

      <CardFooter className="p-2 border-t flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-1 flex-shrink-0">
        <Button
          variant="outline"
          size="xs"
          onClick={handleAddSubStepClick}
          disabled={isSubmitting}
          className="text-xs w-full sm:w-auto"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Sub-step
        </Button>
      </CardFooter>

      {isSelected && (
        <>
          <Button variant="outline" size="icon" className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary z-30" style={{ top: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE}px)`, width: DOT_SIZE * 2, height: DOT_SIZE * 2, padding: 0 }} onClick={(e) => handleDotClick(e, 'N')} title="Add step above"><Plus className="h-3 w-3" /></Button>
          <Button variant="outline" size="icon" className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary z-30" style={{ bottom: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE}px)`, width: DOT_SIZE * 2, height: DOT_SIZE * 2, padding: 0 }} onClick={(e) => handleDotClick(e, 'S')} title="Add step below"><Plus className="h-3 w-3" /></Button>
          <Button variant="outline" size="icon" className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary z-30" style={{ left: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE}px)`, width: DOT_SIZE * 2, height: DOT_SIZE * 2, padding: 0 }} onClick={(e) => handleDotClick(e, 'W')} title="Add step to the left"><Plus className="h-3 w-3" /></Button>
          <Button variant="outline" size="icon" className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary z-30" style={{ right: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE}px)`, width: DOT_SIZE * 2, height: DOT_SIZE * 2, padding: 0 }} onClick={(e) => handleDotClick(e, 'E')} title="Add step to the right"><Plus className="h-3 w-3" /></Button>
        </>
      )}
    </div>
  );
};

interface RoadmapStepDetailPanelProps {
  step: RoadmapStep;
  onClose: () => void;
  // onUpdateDescription: (stepId: string, newDescription: string) => void; // For saving later
}

const RoadmapStepDetailPanel: React.FC<RoadmapStepDetailPanelProps> = ({ step, onClose }) => {
  const [editableDescription, setEditableDescription] = useState(step.description || '');

  useEffect(() => {
    setEditableDescription(step.description || '');
  }, [step]);

  // const handleSaveDescription = () => {
  //   onUpdateDescription(step.id, editableDescription);
  //   // Maybe show a toast here
  // };

  return (
    <>
      <SheetHeader className="p-4 border-b">
        <div className="flex justify-between items-center">
          <SheetTitle className="truncate" title={step.title}>{step.title}</SheetTitle>
          {/* Default SheetContent close button will be used. No explicit close button here. */}
        </div>
        <SheetDescription>{step.type}</SheetDescription>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <Label htmlFor={`step-description-${step.id}`} className="text-sm font-medium mb-1 block">Description</Label>
            <Textarea
              id={`step-description-${step.id}`}
              value={editableDescription}
              onChange={(e) => setEditableDescription(e.target.value)}
              placeholder="Add details about this step..."
              rows={4}
              className="text-sm resize-none"
            />
            {/* 
            <Button onClick={handleSaveDescription} size="sm" className="mt-2">
              Save Description
            </Button> 
            */}
          </div>
          {step.subSteps && step.subSteps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Sub-steps ({step.subSteps.length})</h4>
              <ul className="list-disc list-inside space-y-1 pl-4">
                {step.subSteps.map(sub => (
                  <li key={sub.id} className="text-sm text-muted-foreground">
                    {sub.title} <span className="text-xs text-muted-foreground/70">({sub.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(!step.subSteps || step.subSteps.length === 0) && (
             <p className="text-sm text-muted-foreground italic">No sub-steps defined for this item.</p>
          )}
        </div>
      </ScrollArea>
      {/* Footer removed as per request to remove the explicit "Close" button */}
    </>
  );
};


const ViewPlanPage = () => {
  const paramsFromHook = useParams();
  const params = paramsFromHook;
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);

  const planId = params?.planId as string | undefined;

  const [roadmapSteps, setRoadmapSteps] = useState<RoadmapStep[]>([]);
  const [isAddStepDialogOpen, setIsAddStepDialogOpen] = useState(false);
  const [currentParentStepForDialog, setCurrentParentStepForDialog] = useState<{ id: string; title: string } | null>(null);
  const [pendingNodeFromDotInfo, setPendingNodeFromDotInfo] = useState<{ sourceStepId: string; sourceAnchor: 'N' | 'S' | 'E' | 'W'; } | null>(null);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedNodeForPanel, setSelectedNodeForPanel] = useState<RoadmapStep | null>(null);

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [nodeStartPos, setNodeStartPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        if (entries[0]) {
          setCanvasWidth(entries[0].contentRect.width);
        }
      });
      resizeObserver.observe(canvasRef.current);
      setCanvasWidth(canvasRef.current.clientWidth); // Initial width
      return () => resizeObserver.disconnect();
    }
  }, []);

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
    if (plan?.roadmap) {
      const initializedSteps = plan.roadmap.map((step, index) => ({
        ...step,
        x: typeof step.x === 'number' ? step.x : (index % 3) * (NODE_WIDTH + 64) + (canvasRef.current?.getBoundingClientRect().left || 20) + 20,
        y: typeof step.y === 'number' ? step.y : Math.floor(index / 3) * (getEstimatedCardHeight(step) + 64) + 20,
        subSteps: step.subSteps || [],
      }));
      setRoadmapSteps(initializedSteps);
    } else if (plan && !plan.roadmap) {
      setRoadmapSteps([]);
    }
  }, [plan]);

  const handleInitiateNodeFromDot = useCallback((event: React.MouseEvent, sourceStepId: string, sourceAnchor: 'N' | 'S' | 'E' | 'W') => {
    event.stopPropagation();
    setSelectedStepId(sourceStepId); 
    setSelectedNodeForPanel(null); 
    setPendingNodeFromDotInfo({ sourceStepId, sourceAnchor });
    setCurrentParentStepForDialog(null);
    setIsAddStepDialogOpen(true);
  }, [setSelectedStepId, setSelectedNodeForPanel, setPendingNodeFromDotInfo, setCurrentParentStepForDialog, setIsAddStepDialogOpen]);

  const openAddMainStepDialog = useCallback(() => {
    setSelectedStepId(null);
    setSelectedNodeForPanel(null);
    setCurrentParentStepForDialog(null);
    setPendingNodeFromDotInfo(null);
    setIsAddStepDialogOpen(true);
  }, [setSelectedStepId, setSelectedNodeForPanel, setCurrentParentStepForDialog, setPendingNodeFromDotInfo, setIsAddStepDialogOpen]);

  const openAddSubStepDialog = useCallback((event: React.MouseEvent, parentId: string, parentTitle: string) => {
    event.stopPropagation();
    const parentNode = roadmapSteps.find(s => s.id === parentId);
    setSelectedNodeForPanel(parentNode || null); 
    setSelectedStepId(parentId); 
    setCurrentParentStepForDialog({ id: parentId, title: parentTitle });
    setPendingNodeFromDotInfo(null);
    setIsAddStepDialogOpen(true);
  }, [roadmapSteps, setSelectedNodeForPanel, setSelectedStepId, setCurrentParentStepForDialog, setPendingNodeFromDotInfo, setIsAddStepDialogOpen]);
  
  const handleNodeClick = useCallback((clickedStep: RoadmapStep) => {
    setSelectedNodeForPanel(current => (current?.id === clickedStep.id ? null : clickedStep));
    setSelectedStepId(current => (current === clickedStep.id ? null : clickedStep.id));
  }, [setSelectedNodeForPanel, setSelectedStepId]);


  const handleAddRoadmapStepSubmit = useCallback((formData: AddRoadmapStepFormData) => {
    setIsSubmittingStep(true);
    const newStepBase = {
      id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: formData.title,
      type: formData.type,
      description: null, // Initialize description
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
        let newY = 20;
        let stepSourceNodeId: string | undefined = undefined;
        let stepSourceAnchor: 'N' | 'S' | 'E' | 'W' | undefined = undefined;

        if (pendingNodeFromDotInfo) {
            const sourceStep = prevSteps.find(s => s.id === pendingNodeFromDotInfo.sourceStepId);
            if (sourceStep) {
                stepSourceNodeId = sourceStep.id;
                stepSourceAnchor = pendingNodeFromDotInfo.sourceAnchor;
                const sourceCardHeight = getEstimatedCardHeight(sourceStep);
                const newCardDynamicHeight = getEstimatedCardHeight({ ...newStepBase, subSteps: [] } as RoadmapStep);

                switch(pendingNodeFromDotInfo.sourceAnchor) {
                    case 'N': newX = sourceStep.x; newY = sourceStep.y - (newCardDynamicHeight + 64); break;
                    case 'S': newX = sourceStep.x; newY = sourceStep.y + sourceCardHeight + 64; break;
                    case 'E': newX = sourceStep.x + NODE_WIDTH + 64; newY = sourceStep.y; break;
                    case 'W': newX = sourceStep.x - (NODE_WIDTH + 64); newY = sourceStep.y; break;
                }
            }
        } else if (prevSteps.length > 0) {
            const mainSteps = prevSteps.filter(s => s.type === 'Main Category/Phase');
            if (mainSteps.length > 0) {
              const lastMainStep = mainSteps.reduce((latest, current) => (current.y > latest.y ? current : latest), mainSteps[0]);
              newX = 20 + (canvasRef.current?.getBoundingClientRect().left || 0); // Adjust for canvas offset
              newY = lastMainStep.y + getEstimatedCardHeight(lastMainStep) + 64;
            } else {
              newX = 20 + (canvasRef.current?.getBoundingClientRect().left || 0);
              newY = 20;
            }
        } else {
           newX = 20 + (canvasRef.current?.getBoundingClientRect().left || 0);
           newY = 20;
        }
        
        newX = Math.max(0, Math.min(newX, canvasWidth - NODE_WIDTH - (parseInt(getComputedStyle(canvasRef.current!).paddingRight) || 0) - 20));
        newY = Math.max(0, newY);

        const newMainStep: RoadmapStep = {
          ...newStepBase,
          subSteps: [],
          x: newX,
          y: newY,
          sourceNodeId: stepSourceNodeId,
          sourceAnchor: stepSourceAnchor,
        };
        return [...prevSteps, newMainStep];
      }
    });

    toast({ title: "Step Added", description: `"${formData.title}" added to the roadmap.` });
    setIsAddStepDialogOpen(false);
    setCurrentParentStepForDialog(null);
    setPendingNodeFromDotInfo(null);
    setIsSubmittingStep(false);
  }, [currentParentStepForDialog, pendingNodeFromDotInfo, toast, canvasWidth]);

  const handleMouseDownOnNode = useCallback((event: React.MouseEvent<HTMLDivElement>, stepId: string) => {
    event.stopPropagation();
    setSelectedStepId(stepId);
    const stepToDrag = roadmapSteps.find(s => s.id === stepId);
    if (stepToDrag && typeof stepToDrag.x === 'number' && typeof stepToDrag.y === 'number') {
      setDraggingNodeId(stepId);
      setDragStartPos({ x: event.clientX, y: event.clientY });
      setNodeStartPos({ x: stepToDrag.x, y: stepToDrag.y });
    }
  }, [roadmapSteps]);

  const handleMouseMoveOnCanvas = useCallback((event: React.MouseEvent) => {
    if (draggingNodeId && dragStartPos && nodeStartPos && canvasRef.current) {
      const dx = event.clientX - dragStartPos.x;
      const dy = event.clientY - dragStartPos.y;
      
      setRoadmapSteps(prevSteps =>
        prevSteps.map(step =>
          step.id === draggingNodeId
            ? { ...step,
                x: Math.max(0, Math.min(nodeStartPos.x + dx, canvasWidth - NODE_WIDTH - 20)), // Subtract padding/margin too
                y: Math.max(0, nodeStartPos.y + dy)
              }
            : step
        )
      );
    }
  }, [draggingNodeId, dragStartPos, nodeStartPos, canvasWidth]);

  const handleMouseUpOnCanvas = useCallback(() => {
    if (draggingNodeId) {
       // TODO: Persist new positions
    }
    setDraggingNodeId(null);
    setDragStartPos(null);
    setNodeStartPos(null);
  }, [draggingNodeId]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setSelectedStepId(null);
      setSelectedNodeForPanel(null);
    }
  }, [setSelectedStepId, setSelectedNodeForPanel]);


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
  const toolbarIcons = [ MousePointer2, LayoutGrid, StickyNote, Type, ShareIcon, PenTool, Square, Frame, Plus, Undo, Redo ];

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
            className="flex-1 grid-background relative overflow-y-auto overflow-x-hidden p-4 md:p-6"
            onMouseMove={handleMouseMoveOnCanvas}
            onMouseUp={handleMouseUpOnCanvas}
            onMouseLeave={handleMouseUpOnCanvas}
            onClick={handleCanvasClick}
        >
          <div className="absolute top-4 left-4 z-20">
            <Button
              variant="outline"
              onClick={(e) => { e.stopPropagation(); openAddMainStepDialog(); }}
              disabled={isSubmittingStep || isAddStepDialogOpen}
              className="shadow-md bg-card hover:bg-muted"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Main Roadmap Step
            </Button>
          </div>

          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {roadmapSteps.map(targetStep => {
              if (!targetStep.sourceNodeId || !targetStep.sourceAnchor) return null;
              const sourceStep = roadmapSteps.find(s => s.id === targetStep.sourceNodeId);
              if (!sourceStep || typeof sourceStep.x !== 'number' || typeof sourceStep.y !== 'number' || typeof targetStep.x !== 'number' || typeof targetStep.y !== 'number') return null;

              const sourceCardHeight = getEstimatedCardHeight(sourceStep);
              const targetCardHeight = getEstimatedCardHeight(targetStep);

              let x1=0, y1=0, x2=0, y2=0;

              switch (targetStep.sourceAnchor) {
                case 'N':
                  x1 = sourceStep.x + NODE_WIDTH / 2;
                  y1 = sourceStep.y + DOT_CONNECTION_OFFSET;
                  x2 = targetStep.x + NODE_WIDTH / 2;
                  y2 = targetStep.y + targetCardHeight - DOT_CONNECTION_OFFSET;
                  break;
                case 'S':
                  x1 = sourceStep.x + NODE_WIDTH / 2;
                  y1 = sourceStep.y + sourceCardHeight - DOT_CONNECTION_OFFSET;
                  x2 = targetStep.x + NODE_WIDTH / 2;
                  y2 = targetStep.y + DOT_CONNECTION_OFFSET;
                  break;
                case 'E':
                  x1 = sourceStep.x + NODE_WIDTH - DOT_CONNECTION_OFFSET;
                  y1 = sourceStep.y + sourceCardHeight / 2;
                  x2 = targetStep.x + DOT_CONNECTION_OFFSET;
                  y2 = targetStep.y + targetCardHeight / 2;
                  break;
                case 'W':
                  x1 = sourceStep.x + DOT_CONNECTION_OFFSET;
                  y1 = sourceStep.y + sourceCardHeight / 2;
                  x2 = targetStep.x + NODE_WIDTH - DOT_CONNECTION_OFFSET;
                  y2 = targetStep.y + targetCardHeight / 2;
                  break;
                default: return null;
              }

              return (
                <line
                  key={`line-${sourceStep.id}-${targetStep.id}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="hsl(var(--foreground) / 0.7)"
                  strokeWidth="3"
                />
              );
            })}
          </svg>

          {roadmapSteps.map(step => (
              <RoadmapStepCard
                key={step.id}
                step={step}
                onAddSubStep={openAddSubStepDialog}
                onCardClick={handleNodeClick}
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
          isSubStep={!!currentParentStepForDialog}
          dialogTitle={dialogTitleForAddStep}
        />
      )}

      <Sheet 
        open={!!selectedNodeForPanel} 
        onOpenChange={(open) => { 
          if (!open) {
            setSelectedNodeForPanel(null); 
            setSelectedStepId(null);
          }
        }}
      >
        <SheetContent 
            side="right" 
            className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col" 
            onInteractOutside={(e) => e.preventDefault()}
            showCloseButton={true} // Use the default SheetContent close button
        >
          {selectedNodeForPanel && (
            <RoadmapStepDetailPanel
              step={selectedNodeForPanel}
              onClose={() => {setSelectedNodeForPanel(null); setSelectedStepId(null);}}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ViewPlanPage;

