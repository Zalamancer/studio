
// src/app/plan/[planId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getPlanById } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep } from '@/types/plan';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Brain, Share2, Presentation, MessageSquare, Plus, Undo, Redo, Layers, Minus, HelpCircle, User, MapPin, MousePointer2, LayoutGrid, StickyNote, Type, ShareIcon, PenTool, Square, Frame, Move, GripVertical } from 'lucide-react';
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

const NODE_WIDTH = 256; // Corresponds to w-64 Tailwind class
// NODE_HEIGHT is now dynamic based on content (sub-steps) for the card itself.
// For line drawing, we will use estimated heights.

const DOT_SIZE = 8;
const DOT_OFFSET = -DOT_SIZE / 2; // -4px, visual offset for the dot button itself
const DOT_CONNECTION_OFFSET = 4; // How far from the card's *calculated* edge the line should connect to align with dot center

// Constants for estimating card height
const CARD_HEADER_EST_HEIGHT = 40;
const CARD_FOOTER_EST_HEIGHT = 40;
const CARD_CONTENT_PADDING_EST_Y = 10;
const SUBSTEPS_LABEL_EST_HEIGHT = 20;
const SUBSTEP_ITEM_EST_HEIGHT = 22;
const MIN_CARD_EST_HEIGHT = 120;

const getEstimatedCardHeight = (step: RoadmapStep): number => {
  let height = CARD_HEADER_EST_HEIGHT + CARD_FOOTER_EST_HEIGHT + CARD_CONTENT_PADDING_EST_Y;
  if (step.subSteps && step.subSteps.length > 0) {
    height += SUBSTEPS_LABEL_EST_HEIGHT;
    height += step.subSteps.length * SUBSTEP_ITEM_EST_HEIGHT;
    height += 8; // Buffer for list styling
  }
  height += 20; // Buffer for title area

  return Math.max(height, MIN_CARD_EST_HEIGHT);
};


interface RoadmapStepCardProps {
  step: RoadmapStep;
  onAddSubStep: (event: React.MouseEvent, parentId: string, parentTitle: string) => void;
  onSelectStep: (event: React.MouseEvent, stepId: string) => void;
  onInitiateNodeFromDot: (event: React.MouseEvent, sourceStepId: string, sourceAnchor: 'N' | 'S' | 'E' | 'W') => void;
  isSelected: boolean;
  isSubmitting: boolean;
  onMouseDownOnNode: (event: React.MouseEvent<HTMLDivElement>, stepId: string) => void;
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

  const handleDotClick = useCallback((e: React.MouseEvent, anchor: 'N' | 'S' | 'E' | 'W') => {
    e.stopPropagation();
    onInitiateNodeFromDot(e, step.id, anchor);
  }, [onInitiateNodeFromDot, step.id]);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onMouseDownOnNode(e, step.id);
  }, [onMouseDownOnNode, step.id]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.card-body-content')) {
       onSelectStep(e, step.id);
    }
  }, [onSelectStep, step.id]);

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
      onClick={handleCardClick}
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

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [nodeStartPos, setNodeStartPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      setCanvasWidth(canvasRef.current.clientWidth);
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          setCanvasWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(canvasRef.current);
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
        x: typeof step.x === 'number' ? step.x : (index % 3) * (NODE_WIDTH + 64) + 20,
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
    setPendingNodeFromDotInfo({ sourceStepId, sourceAnchor });
    setCurrentParentStepForDialog(null);
    setIsAddStepDialogOpen(true);
  }, [setSelectedStepId, setPendingNodeFromDotInfo, setCurrentParentStepForDialog, setIsAddStepDialogOpen]);

  const openAddMainStepDialog = useCallback(() => {
    setSelectedStepId(null);
    setCurrentParentStepForDialog(null);
    setPendingNodeFromDotInfo(null);
    setIsAddStepDialogOpen(true);
  }, [setSelectedStepId, setCurrentParentStepForDialog, setPendingNodeFromDotInfo, setIsAddStepDialogOpen]);

  const openAddSubStepDialog = useCallback((event: React.MouseEvent, parentId: string, parentTitle: string) => {
    event.stopPropagation();
    setSelectedStepId(parentId);
    setCurrentParentStepForDialog({ id: parentId, title: parentTitle });
    setPendingNodeFromDotInfo(null);
    setIsAddStepDialogOpen(true);
  }, [setSelectedStepId, setCurrentParentStepForDialog, setPendingNodeFromDotInfo, setIsAddStepDialogOpen]);

  const handleSelectStep = useCallback((event: React.MouseEvent, stepId: string) => {
    event.stopPropagation();
    setSelectedStepId(prevId => (prevId === stepId ? null : stepId));
  }, [setSelectedStepId]);


  const handleAddRoadmapStepSubmit = useCallback((formData: AddRoadmapStepFormData) => {
    setIsSubmittingStep(true);
    const newStepBase = {
      id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: formData.title,
      type: formData.type,
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
                const newCardHeight = getEstimatedCardHeight({ ...newStepBase, subSteps: [] } as RoadmapStep); // Estimate height of new node

                switch(pendingNodeFromDotInfo.sourceAnchor) {
                    case 'N': newX = sourceStep.x; newY = sourceStep.y - (newCardHeight + 64); break;
                    case 'S': newX = sourceStep.x; newY = sourceStep.y + sourceCardHeight + 64; break;
                    case 'E': newX = sourceStep.x + NODE_WIDTH + 64; newY = sourceStep.y; break;
                    case 'W': newX = sourceStep.x - (NODE_WIDTH + 64); newY = sourceStep.y; break;
                }
            }
        } else if (prevSteps.length > 0) {
            const mainSteps = prevSteps.filter(s => s.type === 'Main Category/Phase');
            if (mainSteps.length > 0) {
              const lastMainStep = mainSteps.reduce((latest, current) => (current.y > latest.y ? current : latest), mainSteps[0]);
              newX = 20;
              newY = lastMainStep.y + getEstimatedCardHeight(lastMainStep) + 64;
            }
        }
        
        if (canvasRef.current) {
            const currentCanvasWidth = canvasRef.current.clientWidth;
            newX = Math.min(newX, currentCanvasWidth - NODE_WIDTH);
        }
        newX = Math.max(0, newX);
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
  }, [currentParentStepForDialog, pendingNodeFromDotInfo, toast]);

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
      const currentCanvasWidth = canvasRef.current.clientWidth;
      setRoadmapSteps(prevSteps =>
        prevSteps.map(step =>
          step.id === draggingNodeId
            ? { ...step,
                x: Math.max(0, Math.min(nodeStartPos.x + dx, currentCanvasWidth - NODE_WIDTH)),
                y: Math.max(0, nodeStartPos.y + dy)
              }
            : step
        )
      );
    }
  }, [draggingNodeId, dragStartPos, nodeStartPos]); // canvasWidth state not needed as dep here, canvasRef.current is used

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
    }
  }, [setSelectedStepId]);


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
            className="flex-1 grid-background relative overflow-auto p-4 md:p-6"
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
          isSubStep={!!currentParentStepForDialog}
          dialogTitle={dialogTitleForAddStep}
        />
      )}
    </div>
  );
};

export default ViewPlanPage;

    