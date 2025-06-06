// src/app/plan/[planId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlanById, updatePlanRoadmap } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep } from '@/types/plan';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Brain, Share2, MessageSquare, Plus, Layers, Minus, Eye, Save, Trash2, Twitter, Linkedin, Facebook, Mail, Link as LinkIconLucide, Send, MousePointerSquareDashed } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import Link from 'next/link';
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogClose as AddStepDialogClose,
  DialogContent as AddStepDialogContent,
  DialogDescription as AddStepDialogDescription,
  DialogFooter as AddStepDialogFooter,
  DialogHeader as AddStepDialogHeader,
  DialogTitle as AddStepDialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as ConfirmDialogContent,
  AlertDialogDescription as ConfirmDialogDescription,
  AlertDialogFooter as ConfirmDialogFooter,
  AlertDialogHeader as ConfirmDialogHeader,
  AlertDialogTitle as ConfirmDialogTitle,
} from "@/components/ui/alert-dialog";


const NODE_WIDTH = 256; // width of RoadmapStepCard
const DOT_SIZE = 12;
const DOT_OFFSET = - (DOT_SIZE / 2);
const DOT_HIT_RADIUS = 10;

const HEADER_PADDING_TOP = 10;
const HEADER_PADDING_BOTTOM = 10;
const HEADER_TITLE_LINE_HEIGHT = 20;

const CONTENT_PADDING_TOP = 6;
const CONTENT_PADDING_BOTTOM = 10;
const SUBSTEPS_LABEL_TEXT_HEIGHT = 16;
const SUBSTEPS_LABEL_MARGIN_BOTTOM = 4;
const SUBSTEP_ITEM_LINE_HEIGHT = 16;
const SUBSTEP_INTER_ITEM_SPACING = 2;

const FOOTER_PADDING_TOP = 8;
const FOOTER_PADDING_BOTTOM = 8;
const FOOTER_CONTENT_HEIGHT = 28;

const INTERNAL_BORDER_HEIGHT = 1;
const NODE_END_PADDING = 50;

const CLICK_TIME_THRESHOLD_MS = 250;
const CLICK_MOVE_THRESHOLD_PX = 5;
const SNAP_RADIUS = 20;


type AnchorPoint = 'N' | 'S' | 'E' | 'W';

const getEstimatedCardHeight = (step: RoadmapStep): number => {
  let calculatedHeight = 0;
  let headerInternalContent = HEADER_TITLE_LINE_HEIGHT;
  calculatedHeight += HEADER_PADDING_TOP + headerInternalContent + HEADER_PADDING_BOTTOM;
  calculatedHeight += INTERNAL_BORDER_HEIGHT;
  let contentInternalContent = 0;
  if (step.subSteps && step.subSteps.length > 0) {
    contentInternalContent += SUBSTEPS_LABEL_TEXT_HEIGHT;
    contentInternalContent += SUBSTEPS_LABEL_MARGIN_BOTTOM;
    contentInternalContent += step.subSteps.length * SUBSTEP_ITEM_LINE_HEIGHT;
    if (step.subSteps.length > 1) {
      contentInternalContent += (step.subSteps.length - 1) * SUBSTEP_INTER_ITEM_SPACING;
    }
  }
  calculatedHeight += CONTENT_PADDING_TOP + contentInternalContent + CONTENT_PADDING_BOTTOM;
  calculatedHeight += INTERNAL_BORDER_HEIGHT;
  calculatedHeight += FOOTER_PADDING_TOP + FOOTER_CONTENT_HEIGHT + FOOTER_PADDING_BOTTOM;
  const baseMinHeightForEmptyCard =
    (HEADER_PADDING_TOP + HEADER_TITLE_LINE_HEIGHT + HEADER_PADDING_BOTTOM) +
    INTERNAL_BORDER_HEIGHT +
    (CONTENT_PADDING_TOP + 0 + CONTENT_PADDING_BOTTOM) +
    INTERNAL_BORDER_HEIGHT +
    (FOOTER_PADDING_TOP + FOOTER_CONTENT_HEIGHT + FOOTER_PADDING_BOTTOM);
  return Math.max(calculatedHeight, baseMinHeightForEmptyCard);
};


interface RoadmapStepCardProps {
  step: RoadmapStep;
  onAddSubStep: (event: React.MouseEvent, parentId: string, parentTitle: string) => void;
  onOpenDetails: (event: React.MouseEvent, step: RoadmapStep) => void;
  onAutoCreateStepFromSubStep: (event: React.MouseEvent, sourceStepId: string, sourceAnchor: AnchorPoint, sourceYOffset: number, newStepTitle: string, originatingSubStepId: string) => void;
  isSelected: boolean;
  isSubmitting: boolean;
  onMouseDownOnNode: (event: React.MouseEvent<HTMLDivElement>, stepId: string) => void;
  onDeleteNode: (stepId: string, stepTitle: string) => void;
  onConnectionDotInteraction: (event: React.MouseEvent, stepId: string, anchor: AnchorPoint, interactionType: 'down' | 'up', dotRef: React.RefObject<HTMLButtonElement>) => void;
  isPotentialConnectionTarget: (stepId: string, anchor: AnchorPoint) => boolean;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = ({
  step,
  onAddSubStep,
  onOpenDetails,
  onAutoCreateStepFromSubStep,
  isSelected,
  isSubmitting,
  onMouseDownOnNode,
  onDeleteNode,
  onConnectionDotInteraction,
  isPotentialConnectionTarget,
}) => {
  const cardDivRef = useRef<HTMLDivElement>(null);
  const northDotRef = useRef<HTMLButtonElement>(null);
  const southDotRef = useRef<HTMLButtonElement>(null);
  const eastDotRef = useRef<HTMLButtonElement>(null);
  const westDotRef = useRef<HTMLButtonElement>(null);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    onMouseDownOnNode(e, step.id);
  }, [onMouseDownOnNode, step.id]);

  const handleAddSubStepClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAddSubStep(e, step.id, step.title);
  }, [onAddSubStep, step.id, step.title]);

  const handleOpenDetailsButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenDetails(e, step);
  }, [onOpenDetails, step]);

  const handleDeleteButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteNode(step.id, step.title);
  }, [onDeleteNode, step.id, step.title]);

  const SubStepDot: React.FC<{ subStep: RoadmapSubStep; subStepTitle: string }> = ({ subStep, subStepTitle }) => {
    const dotRef = React.useRef<HTMLSpanElement>(null);
    const handleSubStepDotMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (cardDivRef.current && dotRef.current) {
        const cardRect = cardDivRef.current.getBoundingClientRect();
        const dotRect = dotRef.current.getBoundingClientRect();
        const relativeYOffset = (dotRect.top - cardRect.top) + (dotRect.height / 2);
        onAutoCreateStepFromSubStep(e, step.id, 'W', relativeYOffset, subStepTitle, subStep.id);
      } else {
        onAutoCreateStepFromSubStep(e, step.id, 'W', getEstimatedCardHeight(step) / 2, subStepTitle, subStep.id);
      }
    };
    return (
      <span
        ref={dotRef}
        onMouseDown={handleSubStepDotMouseDown}
        className={cn(
          "absolute top-1/2 left-1 -translate-y-1/2 rounded-full bg-muted-foreground cursor-grab",
          "h-2 w-2",
          "transition-all duration-150 ease-in-out",
          "hover:bg-green-500 hover:ring-2 hover:ring-green-300 active:bg-green-600",
          "hover:scale-150 active:scale-125"
        )}
        title={`Create new step: "${subStepTitle}" (to the left)`}
      ></span>
    );
  };

  const ConnectionDot: React.FC<{ anchor: AnchorPoint; dotRef: React.RefObject<HTMLButtonElement> }> = ({ anchor, dotRef }) => (
    <Button
      ref={dotRef}
      variant="outline"
      size="icon"
      className={cn(
        "absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary z-30 cursor-grab active:cursor-grabbing",
        "transition-all duration-150 ease-in-out",
        isPotentialConnectionTarget(step.id, anchor) ? "ring-2 ring-green-500 bg-green-200 border-green-500 scale-125" : "hover:scale-110",
      )}
      style={{
        width: DOT_SIZE, height: DOT_SIZE, padding: 0,
        ...(anchor === 'N' && { top: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE / 2}px)` }),
        ...(anchor === 'S' && { bottom: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE / 2}px)` }),
        ...(anchor === 'E' && { right: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE / 2}px)` }),
        ...(anchor === 'W' && { left: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE / 2}px)` }),
      }}
      onMouseDown={(e) => { e.stopPropagation(); onConnectionDotInteraction(e, step.id, anchor, 'down', dotRef); }}
      onMouseUp={(e) => { e.stopPropagation(); onConnectionDotInteraction(e, step.id, anchor, 'up', dotRef); }}
      title={`Drag to connect, or click to create a new step from ${anchor === 'N' ? 'top' : anchor === 'S' ? 'bottom' : anchor === 'E' ? 'right' : 'left'}`}
    >
      <MousePointerSquareDashed className="h-3 w-3 opacity-70" />
    </Button>
  );

  return (
    <div
      ref={cardDivRef}
      data-step-id={step.id}
      className={cn(
        "absolute bg-card border rounded-lg shadow-md w-64 cursor-default select-none z-10",
        "flex flex-col",
        isSelected && !isSubmitting ? "ring-2 ring-primary shadow-primary/30 z-20" : "hover:shadow-lg"
      )}
      style={{ left: `${Math.round(step.x)}px`, top: `${Math.round(step.y)}px` }}
    >
      <CardHeader
        className="p-2.5 bg-muted/50 rounded-t-lg cursor-grab active:cursor-grabbing flex flex-row items-center flex-shrink-0"
        onMouseDown={handleHeaderMouseDown}
      >
        <Layers className="h-4 w-4 text-muted-foreground mr-1.5 flex-shrink-0 pointer-events-none" />
        <div className="flex-grow min-w-0 pointer-events-none card-body-content">
          <CardTitle className="text-sm font-semibold truncate" title={step.title}>{step.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-2.5 pt-1.5 border-t card-body-content">
        {step.subSteps && step.subSteps.length > 0 && (
          <>
            <p className="text-xs font-medium mb-1 text-muted-foreground">Sub-steps:</p>
            <ul className="list-none space-y-0.5 pl-0 ml-0">
              {step.subSteps.map((subStep) => (
                <li key={subStep.id} className="relative flex items-center gap-1.5 text-xs pl-4">
                  <SubStepDot subStep={subStep} subStepTitle={subStep.title} />
                  <span className="text-muted-foreground truncate" title={subStep.title}>
                    {subStep.title}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
      <CardFooter className="p-2 border-t flex items-center justify-end gap-1.5 flex-shrink-0">
        <Button variant="outline" size="xs" onClick={handleAddSubStepClick} disabled={isSubmitting} className="text-xs h-7 px-2">
          <Plus className="h-3 w-3 mr-1" /> Sub-step
        </Button>
        <Button variant="outline" size="xs" onClick={handleOpenDetailsButtonClick} disabled={isSubmitting} className="text-xs h-7 px-2" title="Open Details">
          <Eye className="h-3.5 w-3.5 mr-1" /> Open
        </Button>
        <Button variant="ghost" size="xs" onClick={handleDeleteButtonClick} disabled={isSubmitting} className="text-xs h-7 px-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" title="Delete Step">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>

      {isSelected && !isSubmitting && (
        <>
          <ConnectionDot anchor="N" dotRef={northDotRef} />
          <ConnectionDot anchor="S" dotRef={southDotRef} />
          <ConnectionDot anchor="E" dotRef={eastDotRef} />
          {(!step.subSteps || step.subSteps.length === 0) && (
             <ConnectionDot anchor="W" dotRef={westDotRef} />
          )}
        </>
      )}
    </div>
  );
};

interface RoadmapStepDetailPanelProps {
  step: RoadmapStep;
  onDescriptionChange: (stepId: string, newDescription: string | null) => void;
  onTitleChange: (stepId: string, newTitle: string) => void;
  isOwner: boolean;
}

const RoadmapStepDetailPanel: React.FC<RoadmapStepDetailPanelProps> = ({ step, onDescriptionChange, onTitleChange, isOwner }) => {
  const [editableDescription, setEditableDescription] = useState(step.description || '');
  const [editableTitle, setEditableTitle] = useState(step.title || '');
  useEffect(() => {
    setEditableTitle(step.title || '');
    setEditableDescription(step.description || '');
  }, [step]);
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setEditableTitle(newTitle);
    onTitleChange(step.id, newTitle);
  };
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDesc = e.target.value;
    setEditableDescription(newDesc);
    onDescriptionChange(step.id, newDesc.trim() === '' ? null : newDesc);
  };
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {isOwner ? (
          <div>
            <Label htmlFor={`step-title-input-${step.id}`} className="text-sm font-medium mb-1 block">Title</Label>
            <Input id={`step-title-input-${step.id}`} value={editableTitle} onChange={handleTitleChange} placeholder="Step Title" className="text-lg font-semibold border-input focus-visible:ring-ring focus-visible:ring-offset-background p-2 h-auto" disabled={!isOwner}/>
          </div>
        ) : (
          <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
        )}
        <div>
          <Label htmlFor={`step-description-${step.id}`} className="text-sm font-medium mb-1 block">Description</Label>
          <Textarea id={`step-description-${step.id}`} value={editableDescription} onChange={handleDescriptionChange} placeholder="Add details about this step..." rows={6} className="text-sm resize-none" disabled={!isOwner}/>
        </div>
        {step.subSteps && step.subSteps.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Sub-steps ({step.subSteps.length})</h4>
            <ul className="list-none space-y-1 pl-0 ml-0">
              {step.subSteps.map(sub => (<li key={sub.id} className="text-sm text-muted-foreground">{sub.title}</li>))}
            </ul>
          </div>
        )}
        {(!step.subSteps || step.subSteps.length === 0) && (<p className="text-sm text-muted-foreground italic">No sub-steps defined for this item.</p>)}
      </div>
    </ScrollArea>
  );
};

const addRoadmapStepDialogSchema = z.object({
  title: z.string().min(1, "Title is required.").max(100, "Title cannot exceed 100 characters."),
});
export type AddRoadmapStepDialogFormDataInternal = z.infer<typeof addRoadmapStepDialogSchema>;
interface AddRoadmapStepDialogInternalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddRoadmapStepDialogFormDataInternal) => Promise<void>;
  isSubmitting: boolean;
  parentStepTitle?: string | null;
  dialogTitle?: string;
}
const AddRoadmapStepDialogInternal: React.FC<AddRoadmapStepDialogInternalProps> = ({ isOpen, onOpenChange, onSubmit, isSubmitting, parentStepTitle, dialogTitle, }) => {
  const form = useForm<AddRoadmapStepDialogFormDataInternal>({ resolver: zodResolver(addRoadmapStepDialogSchema), defaultValues: { title: '' } });
  React.useEffect(() => { if (isOpen) form.reset({ title: '' }); }, [isOpen, form]);
  const effectiveDialogTitle = dialogTitle || (parentStepTitle ? `Add Sub-step to "${parentStepTitle}"` : "Add New Roadmap Step");
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <AddStepDialogContent className="sm:max-w-md">
        <AddStepDialogHeader>
          <AddStepDialogTitle>{effectiveDialogTitle}</AddStepDialogTitle>
          <AddStepDialogDescription>Define a new step for your collaboration plan.</AddStepDialogDescription>
        </AddStepDialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div>
            <Label htmlFor="title-dialog">Step Title <span className="text-destructive">*</span></Label>
            <Input id="title-dialog" {...form.register('title')} placeholder="e.g., Market Research, Phase 1 Kickoff" disabled={isSubmitting || form.formState.isSubmitting} />
            {form.formState.errors.title && (<p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>)}
          </div>
          <AddStepDialogFooter>
            <AddStepDialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting || form.formState.isSubmitting}>Cancel</Button></AddStepDialogClose>
            <Button type="submit" disabled={isSubmitting || form.formState.isSubmitting}>
              {(isSubmitting || form.formState.isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Step
            </Button>
          </AddStepDialogFooter>
        </form>
      </AddStepDialogContent>
    </Dialog>
  );
};

type ConnectionDragStateType = {
  isActive: boolean;
  sourceStepId: string;
  sourceAnchor: AnchorPoint;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetHotspot: { stepId: string; anchor: AnchorPoint } | null;
};

type ClickStartInfoType = {
  time: number;
  clientX: number;
  clientY: number;
  stepId: string;
  anchor: AnchorPoint;
  dotRef: React.RefObject<HTMLButtonElement>;
} | null;

// Helper function to compare target hotspots
const hotspotsAreEqual = (
  a: ConnectionDragStateType['targetHotspot'],
  b: ConnectionDragStateType['targetHotspot']
): boolean => {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.stepId === b.stepId && a.anchor === b.anchor;
};


const ViewPlanPage = () => {
  const paramsFromHook = useParams();
  const params = paramsFromHook;
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const planId = params?.planId as string | undefined;
  const [roadmapSteps, setRoadmapSteps] = useState<RoadmapStep[]>([]);
  const [isAddStepDialogOpen, setIsAddStepDialogOpen] = useState(false);
  const [currentParentStepForDialog, setCurrentParentStepForDialog] = useState<{ id: string; title: string } | null>(null);
  const [pendingNodeFromDotInfo, setPendingNodeFromDotInfo] = useState<{ sourceStepId: string; sourceAnchor: AnchorPoint; } | null>(null);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedNodeForPanel, setSelectedNodeForPanel] = useState<RoadmapStep | null>(null);

  const draggingNodeIdRef = useRef<string | null>(null);
  const dragOperationStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const nodeInitialCanvasPosRef = useRef<{ x: number; y: number } | null>(null);
  const latestMousePositionRef = useRef<{ x: number; y: number; clientX: number; clientY: number; } | null>(null);
  const dragUpdateFrameRef = useRef<number | null>(null);
  const dragContextRef = useRef<{ maxX: number } | null>(null);


  const [dynamicCanvasMinHeight, setDynamicCanvasMinHeight] = useState<number | null>(null);
  const [isSavingRoadmap, setIsSavingRoadmap] = useState(false);
  const [confirmDeleteNodeInfo, setConfirmDeleteNodeInfo] = useState<{ id: string; title: string } | null>(null);

  const [connectionDragState, setConnectionDragState] = useState<ConnectionDragStateType | null>(null);
  const connectionDragStateRef = useRef<ConnectionDragStateType | null>(null);
  useEffect(() => { connectionDragStateRef.current = connectionDragState; }, [connectionDragState]);

  const clickStartInfoRef = useRef<ClickStartInfoType>(null);
  const rAFConnectionDragLoopRef = useRef<number | null>(null);
  const activeConnectionDragOperationRef = useRef<{ sourceStepId: string; sourceAnchor: AnchorPoint; startX: number; startY: number; } | null>(null);


  const roadmapStepsRef = useRef(roadmapSteps);
  useEffect(() => {
    roadmapStepsRef.current = roadmapSteps;
  }, [roadmapSteps]);

  const isPlanIdValidUid = React.useMemo(() => { if (!planId) return false; return IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20; }, [planId]);

  const { data: plan, isLoading, error } = useQuery<ClientPlan | null, Error>({
    queryKey: ['plan', planId],
    queryFn: async () => { if (!planId || !isPlanIdValidUid) return null; return getPlanById(planId); },
    enabled: !!planId && isPlanIdValidUid && !authLoading,
  });

  useEffect(() => {
    if (plan?.roadmap) {
      const initializedSteps = plan.roadmap.map((step, index) => ({
        ...step,
        x: Math.round(typeof step.x === 'number' && !isNaN(step.x) ? step.x : (index % 3) * (NODE_WIDTH + 64) + 20),
        y: Math.round(typeof step.y === 'number' && !isNaN(step.y) ? step.y : Math.floor(index / 3) * (getEstimatedCardHeight(step) + 64) + 20),
        subSteps: step.subSteps || [],
        originatingSubStepInfo: step.originatingSubStepInfo || null,
        description: step.description || null,
      }));
      setRoadmapSteps(initializedSteps);
    } else if (plan && !plan.roadmap) {
      setRoadmapSteps([]);
    }
  }, [plan]);

  useEffect(() => {
    if (typeof window !== 'undefined' && canvasRef.current) {
      let maxBottomY = 0;
      if (roadmapStepsRef.current.length > 0) {
        roadmapStepsRef.current.forEach(step => {
          const nodeHeight = getEstimatedCardHeight(step);
          const nodeBottom = (typeof step.y === 'number' && !isNaN(step.y) ? step.y : 0) + nodeHeight;
          if (nodeBottom > maxBottomY) maxBottomY = nodeBottom;
        });
      }
      const calculatedMinHeight = maxBottomY + NODE_END_PADDING + window.innerHeight;
      setDynamicCanvasMinHeight(calculatedMinHeight < window.innerHeight ? window.innerHeight : calculatedMinHeight);
    }
  }, [roadmapSteps]);

 const processConnectionLineDragLoop = useCallback(() => {
    if (!activeConnectionDragOperationRef.current || !latestMousePositionRef.current || !canvasRef.current) {
      if (rAFConnectionDragLoopRef.current) cancelAnimationFrame(rAFConnectionDragLoopRef.current);
      rAFConnectionDragLoopRef.current = null;
      return;
    }
    const { x: mouseCanvasX, y: mouseCanvasY } = latestMousePositionRef.current;
    let newCalculatedCurrentX = mouseCanvasX;
    let newCalculatedCurrentY = mouseCanvasY;
    let newCalculatedTargetHotspot: ConnectionDragStateType['targetHotspot'] = null;
    let minDistance = SNAP_RADIUS;
    const currentRoadmapSteps = roadmapStepsRef.current;
    const sourceStepIdForLoop = activeConnectionDragOperationRef.current.sourceStepId;

    for (const targetStep of currentRoadmapSteps) {
      if (targetStep.id === sourceStepIdForLoop) continue;
      const targetCardElement = canvasRef.current.querySelector(`[data-step-id="${targetStep.id}"]`);
      if (!targetCardElement) continue;
      const targetCardRect = targetCardElement.getBoundingClientRect();
      const targetCardHeight = getEstimatedCardHeight(targetStep);
      const canvasRectLocal = canvasRef.current.getBoundingClientRect();
      const targetAnchors: AnchorPoint[] = ['N', 'S', 'E', 'W'];
      for (const targetAnchor of targetAnchors) {
        if (targetAnchor === 'W' && targetStep.subSteps && targetStep.subSteps.length > 0) continue;
        let dotX = 0, dotY = 0;
        switch (targetAnchor) {
          case 'N': dotX = targetCardRect.left + NODE_WIDTH / 2; dotY = targetCardRect.top; break;
          case 'S': dotX = targetCardRect.left + NODE_WIDTH / 2; dotY = targetCardRect.bottom; break;
          case 'E': dotX = targetCardRect.right; dotY = targetCardRect.top + targetCardHeight / 2; break;
          case 'W': dotX = targetCardRect.left; dotY = targetCardRect.top + targetCardHeight / 2; break;
        }
        const dotCanvasX = dotX - canvasRectLocal.left + canvasRef.current.scrollLeft;
        const dotCanvasY = dotY - canvasRectLocal.top + canvasRef.current.scrollTop;
        const dist = Math.sqrt(Math.pow(mouseCanvasX - dotCanvasX, 2) + Math.pow(mouseCanvasY - dotCanvasY, 2));
        if (dist < minDistance) {
          minDistance = dist;
          newCalculatedTargetHotspot = { stepId: targetStep.id, anchor: targetAnchor };
          newCalculatedCurrentX = dotCanvasX;
          newCalculatedCurrentY = dotCanvasY;
        }
      }
    }

    setConnectionDragState(prevDragState => {
      if (!prevDragState || !prevDragState.isActive) {
        return null; // If not active, clear state
      }
      // Check if any of the critical visual state elements have changed
      const hasChanged = (
        Math.round(newCalculatedCurrentX) !== Math.round(prevDragState.currentX) ||
        Math.round(newCalculatedCurrentY) !== Math.round(prevDragState.currentY) ||
        !hotspotsAreEqual(newCalculatedTargetHotspot, prevDragState.targetHotspot)
      );

      if (hasChanged) {
        return {
          ...prevDragState,
          currentX: newCalculatedCurrentX,
          currentY: newCalculatedCurrentY,
          targetHotspot: newCalculatedTargetHotspot,
        };
      }
      return prevDragState; // No change, return current state to prevent re-render
    });

    if (activeConnectionDragOperationRef.current) {
      rAFConnectionDragLoopRef.current = requestAnimationFrame(processConnectionLineDragLoop);
    }
  }, [setConnectionDragState]);


  const handleConnectionDotInteraction = useCallback((
    event: React.MouseEvent,
    stepId: string,
    anchor: AnchorPoint,
    interactionType: 'down' | 'up',
    dotRef: React.RefObject<HTMLButtonElement>
  ) => {
    event.preventDefault(); // Prevent default browser actions like text selection
    event.stopPropagation(); // Stop event from bubbling to canvas click handler

    if (interactionType === 'down') {
      if (!canvasRef.current || !dotRef.current) return;
      clickStartInfoRef.current = { time: Date.now(), clientX: event.clientX, clientY: event.clientY, stepId, anchor, dotRef };
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const dotRect = dotRef.current.getBoundingClientRect();
      let startX = 0, startY = 0;
      switch (anchor) {
        case 'N': startX = dotRect.left + dotRect.width / 2 - canvasRect.left; startY = dotRect.top - canvasRect.top; break;
        case 'S': startX = dotRect.left + dotRect.width / 2 - canvasRect.left; startY = dotRect.bottom - canvasRect.top; break;
        case 'E': startX = dotRect.right - canvasRect.left; startY = dotRect.top + dotRect.height / 2 - canvasRect.top; break;
        case 'W': startX = dotRect.left - canvasRect.left; startY = dotRect.top + dotRect.height / 2 - canvasRect.top; break;
      }
      const lineStartX = startX + canvasRef.current.scrollLeft;
      const lineStartY = startY + canvasRef.current.scrollTop;

      activeConnectionDragOperationRef.current = { sourceStepId: stepId, sourceAnchor: anchor, startX: lineStartX, startY: lineStartY };
      setConnectionDragState({
        isActive: true, sourceStepId: stepId, sourceAnchor: anchor,
        startX: lineStartX, startY: lineStartY, currentX: lineStartX, currentY: lineStartY, targetHotspot: null
      });
      setSelectedStepId(null); setSelectedNodeForPanel(null);
      if (rAFConnectionDragLoopRef.current) cancelAnimationFrame(rAFConnectionDragLoopRef.current);
      rAFConnectionDragLoopRef.current = requestAnimationFrame(processConnectionLineDragLoop);
    } else if (interactionType === 'up' && clickStartInfoRef.current && clickStartInfoRef.current.stepId === stepId && clickStartInfoRef.current.anchor === anchor) {
      const timeDiff = Date.now() - clickStartInfoRef.current.time;
      const moveX = Math.abs(event.clientX - clickStartInfoRef.current.clientX);
      const moveY = Math.abs(event.clientY - clickStartInfoRef.current.clientY);

      if (timeDiff < CLICK_TIME_THRESHOLD_MS && moveX < CLICK_MOVE_THRESHOLD_PX && moveY < CLICK_MOVE_THRESHOLD_PX) {
        // It's a click!
        event.stopPropagation(); // Ensure this stopPropagation is called here
        setPendingNodeFromDotInfo({ sourceStepId: stepId, sourceAnchor: anchor });
        setIsAddStepDialogOpen(true);
        if (rAFConnectionDragLoopRef.current) cancelAnimationFrame(rAFConnectionDragLoopRef.current);
        activeConnectionDragOperationRef.current = null;
        setConnectionDragState(null);
      }
      clickStartInfoRef.current = null;
    }
  }, [processConnectionLineDragLoop, setConnectionDragState, setSelectedStepId, setSelectedNodeForPanel, setIsAddStepDialogOpen, setPendingNodeFromDotInfo]);

  const isPotentialConnectionTarget = useCallback((stepId: string, anchor: AnchorPoint): boolean => {
    const currentDragState = connectionDragStateRef.current;
    return currentDragState?.isActive === true &&
           currentDragState?.targetHotspot?.stepId === stepId &&
           currentDragState?.targetHotspot?.anchor === anchor;
  }, []); // Removed connectionDragState from deps, uses ref

  const handleAutoCreateStepFromSubStep = useCallback((event: React.MouseEvent, sourceStepId: string, sourceAnchor: AnchorPoint, sourceYOffset: number, newStepTitle: string, originatingSubStepId: string) => {
    event.stopPropagation();
    if (!canvasRef.current) return;
    const currentCanvasClientWidth = canvasRef.current.clientWidth;
    setRoadmapSteps(prevSteps => {
        const sourceStep = prevSteps.find(s => s.id === sourceStepId);
        if (!sourceStep) return prevSteps;
        const newId = `step-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const newStepInitial: RoadmapStep = {
            id: newId, title: newStepTitle, description: null, subSteps: [], x: 0, y: 0,
            sourceNodeId: sourceStep.id, sourceAnchor: sourceAnchor, sourceLineYOffset: Math.round(sourceYOffset),
            originatingSubStepInfo: { sourceCardId: sourceStep.id, subStepId: originatingSubStepId },
        };
        const newCardDynamicHeight = getEstimatedCardHeight(newStepInitial);
        let newX = (typeof sourceStep.x === 'number' && !isNaN(sourceStep.x) ? sourceStep.x : 0) - (NODE_WIDTH + 64);
        let newY = (typeof sourceStep.y === 'number' && !isNaN(sourceStep.y) ? sourceStep.y : 0) + sourceYOffset - (newCardDynamicHeight / 2);
        const maxX = currentCanvasClientWidth > NODE_WIDTH ? currentCanvasClientWidth - NODE_WIDTH : 0;
        newStepInitial.x = Math.round(Math.max(0, Math.min(newX, maxX)));
        newStepInitial.y = Math.round(Math.max(0, newY));
        const updatedSteps = [...prevSteps, newStepInitial];
        setSelectedStepId(newId);
        setSelectedNodeForPanel(newStepInitial);
        setTimeout(() => { toast({ title: "Step Created", description: `"${newStepTitle}" added from sub-step.` }); }, 0);
        return updatedSteps;
    });
  }, [setRoadmapSteps, setSelectedStepId, setSelectedNodeForPanel, toast, canvasRef]);


  const openAddMainStepDialog = useCallback(() => {
    setSelectedStepId(null); setSelectedNodeForPanel(null); setCurrentParentStepForDialog(null); setPendingNodeFromDotInfo(null); setIsAddStepDialogOpen(true);
  }, []);

  const openAddSubStepDialog = useCallback((event: React.MouseEvent, parentId: string, parentTitle: string) => {
    event.stopPropagation(); setSelectedStepId(parentId); setCurrentParentStepForDialog({ id: parentId, title: parentTitle }); setSelectedNodeForPanel(null); setPendingNodeFromDotInfo(null); setIsAddStepDialogOpen(true);
  }, []);

  const handleOpenNodeDetailsClick = useCallback((event: React.MouseEvent, clickedStep: RoadmapStep) => {
    event.stopPropagation(); setSelectedNodeForPanel(current => (current?.id === clickedStep.id ? null : clickedStep)); setSelectedStepId(current => (current === clickedStep.id ? null : clickedStep.id));
  }, []);

  const handleAddRoadmapStepSubmit = useCallback(async (formData: AddRoadmapStepDialogFormDataInternal) => {
    setIsSubmittingStep(true);
    try {
      setRoadmapSteps(prevSteps => {
        const newStepBase = { id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`, title: formData.title, description: null, originatingSubStepInfo: null };
        if (currentParentStepForDialog) {
          return prevSteps.map(step => step.id === currentParentStepForDialog.id ? { ...step, subSteps: [...(step.subSteps || []), { ...newStepBase, parentId: step.id } as RoadmapSubStep] } : step);
        } else {
          let newX = 20, newY = 20; let stepSourceNodeId: string | undefined = undefined; let stepSourceAnchor: AnchorPoint | undefined = undefined;
          const newMainStepInitial: RoadmapStep = { ...newStepBase, subSteps: [], x: newX, y: newY };
          if (canvasRef.current) {
            const currentCanvasClientWidth = canvasRef.current.clientWidth;
            if (pendingNodeFromDotInfo) {
              const sourceStep = prevSteps.find(s => s.id === pendingNodeFromDotInfo.sourceStepId);
              if (sourceStep) {
                stepSourceNodeId = sourceStep.id; stepSourceAnchor = pendingNodeFromDotInfo.sourceAnchor;
                const sourceX = typeof sourceStep.x === 'number' && !isNaN(sourceStep.x) ? sourceStep.x : 0;
                const sourceY = typeof sourceStep.y === 'number' && !isNaN(sourceStep.y) ? sourceStep.y : 0;
                const sourceCardHeight = getEstimatedCardHeight(sourceStep); const newCardDynamicHeight = getEstimatedCardHeight(newMainStepInitial);
                switch (pendingNodeFromDotInfo.sourceAnchor) {
                  case 'N': newX = sourceX; newY = sourceY - (newCardDynamicHeight + 64); break;
                  case 'S': newX = sourceX; newY = sourceY + sourceCardHeight + 64; break;
                  case 'E': newX = sourceX + NODE_WIDTH + 64; newY = sourceY + (sourceCardHeight / 2 - newCardDynamicHeight / 2); break;
                  case 'W': newX = sourceX - (NODE_WIDTH + 64); newY = sourceY + (sourceCardHeight / 2 - newCardDynamicHeight / 2); break;
                }
              }
            } else if (prevSteps.length > 0) {
              const mainSteps = prevSteps.filter(step => !step.sourceNodeId);
              const lastStep = mainSteps.length > 0 ? mainSteps.reduce((latest, current) => (current.y > latest.y ? current : latest), mainSteps[0]) : prevSteps.reduce((latest, current) => (current.y > latest.y ? current : latest), prevSteps[0] || {y: -84});
              newY = (typeof lastStep.y === 'number' && !isNaN(lastStep.y) ? lastStep.y : 0) + getEstimatedCardHeight(lastStep) + 64;
            }
            const maxX = currentCanvasClientWidth > NODE_WIDTH ? currentCanvasClientWidth - NODE_WIDTH : 0;
            newMainStepInitial.x = Math.round(Math.max(0, Math.min(newX, maxX))); newMainStepInitial.y = Math.round(Math.max(0, newY));
            if(stepSourceNodeId) newMainStepInitial.sourceNodeId = stepSourceNodeId; if(stepSourceAnchor) newMainStepInitial.sourceAnchor = stepSourceAnchor;
          }
          return [...prevSteps, newMainStepInitial];
        }
      });
      toast({ title: "Step Added", description: `"${formData.title}" added to the roadmap.` });
      setIsAddStepDialogOpen(false);
    } catch (error) {
      console.error("Error in handleAddRoadmapStepSubmit (synchronous part):", error);
      toast({ variant: "destructive", title: "Error", description: "Could not add step locally." });
    } finally {
      setIsSubmittingStep(false);
    }
  }, [currentParentStepForDialog, pendingNodeFromDotInfo, setRoadmapSteps, toast, setIsAddStepDialogOpen, canvasRef]);

const processDragMovementLoop = useCallback(() => {
    const currentDraggingId = draggingNodeIdRef.current;
    if (!currentDraggingId || !latestMousePositionRef.current || !dragOperationStartRef.current || !nodeInitialCanvasPosRef.current || !dragContextRef.current) {
      if (dragUpdateFrameRef.current) cancelAnimationFrame(dragUpdateFrameRef.current);
      dragUpdateFrameRef.current = null;
      return;
    }
    const dx = latestMousePositionRef.current.clientX - dragOperationStartRef.current.clientX;
    const dy = latestMousePositionRef.current.clientY - dragOperationStartRef.current.clientY;
    const newCalculatedXUnclamped = nodeInitialCanvasPosRef.current.x + dx;
    const newCalculatedYUnclamped = nodeInitialCanvasPosRef.current.y + dy;
    const finalNewCalculatedX = Math.round(Math.max(0, Math.min(newCalculatedXUnclamped, dragContextRef.current.maxX)));
    const finalNewCalculatedY = Math.round(Math.max(0, newCalculatedYUnclamped));

    setRoadmapSteps(prevSteps => {
      const currentDraggingIdInternal = draggingNodeIdRef.current; // Re-read inside updater
      if (!currentDraggingIdInternal) return prevSteps;

      const stepIndex = prevSteps.findIndex(s => s.id === currentDraggingIdInternal);
      if (stepIndex === -1) {
        if (dragUpdateFrameRef.current) cancelAnimationFrame(dragUpdateFrameRef.current);
        dragUpdateFrameRef.current = null;
        draggingNodeIdRef.current = null;
        return prevSteps;
      }

      const nodeToUpdate = prevSteps[stepIndex];
      const currentX = typeof nodeToUpdate.x === 'number' && !isNaN(nodeToUpdate.x) ? Math.round(nodeToUpdate.x) : 0;
      const currentY = typeof nodeToUpdate.y === 'number' && !isNaN(nodeToUpdate.y) ? Math.round(nodeToUpdate.y) : 0;

      if (currentX === finalNewCalculatedX && currentY === finalNewCalculatedY) {
        return prevSteps; // No change, return previous state
      }

      const newSteps = [...prevSteps];
      newSteps[stepIndex] = { ...nodeToUpdate, x: finalNewCalculatedX, y: finalNewCalculatedY };
      return newSteps;
    });

    if (draggingNodeIdRef.current === currentDraggingId) {
      dragUpdateFrameRef.current = requestAnimationFrame(processDragMovementLoop);
    } else {
      if (dragUpdateFrameRef.current) cancelAnimationFrame(dragUpdateFrameRef.current);
      dragUpdateFrameRef.current = null;
    }
  }, [setRoadmapSteps]);


  const handleMouseDownOnNode = useCallback((event: React.MouseEvent<HTMLDivElement>, stepId: string) => {
    if (draggingNodeIdRef.current) return;
    event.stopPropagation();
    setSelectedStepId(stepId);
    const currentSteps = roadmapStepsRef.current;
    const stepToDrag = currentSteps.find(s => s.id === stepId);

    if (stepToDrag && typeof stepToDrag.x === 'number' && !isNaN(stepToDrag.x) && typeof stepToDrag.y === 'number' && !isNaN(stepToDrag.y)) {
      draggingNodeIdRef.current = stepId;
      dragOperationStartRef.current = { clientX: event.clientX, clientY: event.clientY };
      nodeInitialCanvasPosRef.current = { x: stepToDrag.x, y: stepToDrag.y };
      if (canvasRef.current) {
        latestMousePositionRef.current = {
          x: event.clientX - canvasRef.current.getBoundingClientRect().left + canvasRef.current.scrollLeft,
          y: event.clientY - canvasRef.current.getBoundingClientRect().top + canvasRef.current.scrollTop,
          clientX: event.clientX, clientY: event.clientY,
        };
        dragContextRef.current = { maxX: Math.max(0, canvasRef.current.scrollWidth - NODE_WIDTH - NODE_END_PADDING) };
      } else {
        dragContextRef.current = { maxX: Math.max(0, window.innerWidth - NODE_WIDTH - NODE_END_PADDING) };
      }
      if (dragUpdateFrameRef.current) cancelAnimationFrame(dragUpdateFrameRef.current);
      dragUpdateFrameRef.current = requestAnimationFrame(processDragMovementLoop);
      // autoScrollLoop temporarily disabled
      // if (autoScrollFrameRef.current) cancelAnimationFrame(autoScrollFrameRef.current);
      // autoScrollFrameRef.current = requestAnimationFrame(autoScrollLoop);
    }
  }, [processDragMovementLoop, /*autoScrollLoop,*/ canvasRef, setSelectedStepId, roadmapStepsRef]);

  const handleMouseMoveOnCanvas = useCallback((event: React.MouseEvent) => {
    if (!canvasRef.current) return;
    if (draggingNodeIdRef.current || activeConnectionDragOperationRef.current) { // Check if any drag op is active
      const canvasRect = canvasRef.current.getBoundingClientRect();
      latestMousePositionRef.current = {
        x: event.clientX - canvasRect.left + canvasRef.current.scrollLeft,
        y: event.clientY - canvasRect.top + canvasRef.current.scrollTop,
        clientX: event.clientX, clientY: event.clientY,
      };
    }
  }, [canvasRef]);

  const handleCanvasMouseUpForConnection = useCallback(() => {
    if (rAFConnectionDragLoopRef.current) {
      cancelAnimationFrame(rAFConnectionDragLoopRef.current);
      rAFConnectionDragLoopRef.current = null;
    }
    const localActiveDragOp = activeConnectionDragOperationRef.current;
    const localConnectionDragState = connectionDragStateRef.current; // Use ref for latest state
    
    // Always clear active drag operation flags
    activeConnectionDragOperationRef.current = null;
    setConnectionDragState(null);

    if (clickStartInfoRef.current === null && localActiveDragOp && localConnectionDragState?.isActive && localConnectionDragState.targetHotspot) {
        const { sourceStepId, sourceAnchor } = localActiveDragOp; // Use from activeDragOp for initial info
        const { stepId: targetStepId, anchor: targetSnapAnchor } = localConnectionDragState.targetHotspot;
        const currentRoadmapSteps = roadmapStepsRef.current;
        setRoadmapSteps(prevSteps => {
          const sourceNode = prevSteps.find(s => s.id === sourceStepId);
          const targetNodeIndex = prevSteps.findIndex(s => s.id === targetStepId);
          if (!sourceNode || targetNodeIndex === -1) return prevSteps;
          const targetNode = prevSteps[targetNodeIndex];
          let sourceLineYOffsetVal: number | undefined = undefined;
          if (sourceAnchor === 'E' || sourceAnchor === 'W') {
              // When creating a line from E/W, we don't have a dot ref if it wasn't a click
              // We could try to estimate based on sourceCardHeight if that's needed
              // For now, assume it's centered if not explicitly set by a sub-step dot
              sourceLineYOffsetVal = 0;
          }
          const updatedSteps = [...prevSteps];
          updatedSteps[targetNodeIndex] = {
            ...targetNode,
            sourceNodeId,
            sourceAnchor,
            sourceLineYOffset: sourceLineYOffsetVal,
            originatingSubStepInfo: null
          };
          return updatedSteps;
        });
        toast({ title: "Connection Created", description: `Linked step to ${currentRoadmapSteps.find(s=>s.id === targetStepId)?.title || 'target'}.`});
    }
    // Always reset click info on any canvas mouseup
    clickStartInfoRef.current = null;
  }, [toast, setRoadmapSteps, roadmapStepsRef]);

  const handleMouseUpGlobal = useCallback(() => {
    if (draggingNodeIdRef.current) {
        // if (autoScrollFrameRef.current) cancelAnimationFrame(autoScrollFrameRef.current);
        if (dragUpdateFrameRef.current) cancelAnimationFrame(dragUpdateFrameRef.current);
        dragUpdateFrameRef.current = null;
        draggingNodeIdRef.current = null;
        dragOperationStartRef.current = null;
        nodeInitialCanvasPosRef.current = null;
        dragContextRef.current = null;
    }
    if (activeConnectionDragOperationRef.current) {
        handleCanvasMouseUpForConnection();
    }
  }, [handleCanvasMouseUpForConnection /*, autoScrollLoop*/]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => {
        window.removeEventListener('mouseup', handleMouseUpGlobal);
        if (rAFConnectionDragLoopRef.current) cancelAnimationFrame(rAFConnectionDragLoopRef.current);
        if (dragUpdateFrameRef.current) cancelAnimationFrame(dragUpdateFrameRef.current);
        // if (autoScrollFrameRef.current) cancelAnimationFrame(autoScrollFrameRef.current);
    };
  }, [handleMouseUpGlobal]);


  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) { setSelectedStepId(null); setSelectedNodeForPanel(null); } }, []);
  const handleStepDescriptionChange = useCallback((stepId: string, newDescription: string | null) => { setRoadmapSteps(prevSteps => prevSteps.map(step => step.id === stepId ? { ...step, description: newDescription } : step)); }, []);

  const handleStepTitleChange = useCallback((stepId: string, newTitle: string) => {
    setRoadmapSteps(prevSteps => {
      let stepsCopy = [...prevSteps];
      const mainStepIndex = stepsCopy.findIndex(s => s.id === stepId);
      if (mainStepIndex === -1) return prevSteps;

      const mainStepToUpdate = { ...stepsCopy[mainStepIndex], title: newTitle };
      stepsCopy[mainStepIndex] = mainStepToUpdate;

      if (mainStepToUpdate.originatingSubStepInfo) {
        const { sourceCardId, subStepId } = mainStepToUpdate.originatingSubStepInfo;
        const parentCardIndex = stepsCopy.findIndex(s => s.id === sourceCardId);
        if (parentCardIndex !== -1) {
          const parentCard = { ...stepsCopy[parentCardIndex] };
          const subStepIndex = (parentCard.subSteps || []).findIndex(sub => sub.id === subStepId);
          if (subStepIndex !== -1) {
            const updatedSubSteps = [...(parentCard.subSteps || [])];
            updatedSubSteps[subStepIndex] = { ...updatedSubSteps[subStepIndex], title: newTitle };
            parentCard.subSteps = updatedSubSteps;
            stepsCopy[parentCardIndex] = parentCard;
          }
        }
      }
      return stepsCopy;
    });
  }, []);


  const handleDeleteNodeClick = useCallback((stepId: string, stepTitle: string) => { setConfirmDeleteNodeInfo({ id: stepId, title: stepTitle }); }, []);
  const confirmDeleteNode = useCallback(() => {
    if (!confirmDeleteNodeInfo) return; const stepIdToDelete = confirmDeleteNodeInfo.id;
    setRoadmapSteps(prevSteps => {
      const updatedSteps = prevSteps.filter(step => step.id !== stepIdToDelete);
      const finalSteps = updatedSteps.map(step => {
        if (step.sourceNodeId === stepIdToDelete) return { ...step, sourceNodeId: undefined, sourceAnchor: undefined, sourceLineYOffset: undefined };
        if (step.originatingSubStepInfo && step.originatingSubStepInfo.sourceCardId === stepIdToDelete) return { ...step, originatingSubStepInfo: null };
        return step;
      });
      return finalSteps;
    });
    if (selectedStepId === stepIdToDelete) { setSelectedStepId(null); setSelectedNodeForPanel(null); }
    toast({ title: "Node Deleted", description: `Step "${confirmDeleteNodeInfo.title}" and its connections removed.` });
    setConfirmDeleteNodeInfo(null);
  }, [confirmDeleteNodeInfo, selectedStepId, toast, setRoadmapSteps, setSelectedStepId, setSelectedNodeForPanel]);

  const handleSaveRoadmap = async () => {
    if (!plan || !currentUser || !planId) { toast({ variant: "destructive", title: "Error", description: "Plan data or user authentication missing." }); return; }
    setIsSavingRoadmap(true);
    try { await updatePlanRoadmap(planId, currentUser.uid, roadmapStepsRef.current); toast({ title: "Roadmap Saved", description: "Your changes have been saved successfully." }); queryClient.invalidateQueries({ queryKey: ['plan', planId] }); }
    catch (error: any) { toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save roadmap." }); }
    finally { setIsSavingRoadmap(false); }
  };
  const handleCopyLink = async () => { if (typeof window !== 'undefined') { try { await navigator.clipboard.writeText(window.location.href); toast({ title: "Link Copied!", description: "Plan URL copied to clipboard." }); } catch (err) { toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy link to clipboard." }); } } };
  const handleShareToDiscord = async () => { if (typeof window !== 'undefined') { try { await navigator.clipboard.writeText(window.location.href); toast({ title: "Link Copied!", description: "Paste it into Discord." }); window.open('https://discord.com/app', '_blank'); } catch (err) { toast({ variant: "destructive", title: "Action Failed", description: "Could not copy link or open Discord." }); } } };

  if (authLoading || (isLoading && isPlanIdValidUid)) return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>);
  if (!planId || !isPlanIdValidUid) return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><AlertTriangle className="h-10 w-10 text-destructive mb-2" /><h1 className="text-xl font-semibold">Invalid Plan ID</h1><p className="text-muted-foreground">The plan identifier in the URL is not valid.</p><Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button></div>);
  if (error) return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><AlertTriangle className="h-10 w-10 text-destructive mb-2" /><h1 className="text-xl font-semibold">Error Loading Plan</h1><p className="text-muted-foreground">{error.message || "Could not load the collaboration plan."}</p><Button onClick={() => router.back()} className="mt-4">Go Back</Button></div>);
  if (!plan) return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><Brain className="h-10 w-10 text-muted-foreground mb-2" /><h1 className="text-xl font-semibold">Plan Not Found</h1><p className="text-muted-foreground">The collaboration plan does not exist or you may not have permission.</p><Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button></div>);

  const isOwner = currentUser?.uid === plan.ownerId;
  let dialogTitleForAddStep = "Add New Roadmap Step";
  if (currentParentStepForDialog) dialogTitleForAddStep = `Add Sub-step to "${currentParentStepForDialog.title}"`;
  else if (pendingNodeFromDotInfo) { const sourceStepTitle = roadmapStepsRef.current.find(s => s.id === pendingNodeFromDotInfo.sourceStepId)?.title || "Selected Step"; dialogTitleForAddStep = `Add New Step from "${sourceStepTitle}"`; }

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden">
      <header className="h-12 flex-shrink-0 bg-card border-b border-border flex items-center px-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/discover" className="p-1 rounded hover:bg-muted"><Brain className="h-6 w-6 text-primary" /></Link>
          <div className="h-5 w-px bg-border"></div>
          <h1 className="text-sm font-semibold text-foreground truncate" title={plan.name}>{plan.name}</h1>
          {isOwner && <Badge variant="outline" className="text-xs ml-2 hidden sm:inline-flex">Owner</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isOwner && (<Button variant="default" size="sm" className="h-8" onClick={handleSaveRoadmap} disabled={isSavingRoadmap}>{isSavingRoadmap ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}<span className="hidden sm:inline">Save Roadmap</span><span className="sm:hidden">Save</span></Button>)}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="default" size="sm" className="h-8"><Share2 className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">Share</span><span className="sm:hidden">Share</span></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => { const planUrl = window.location.href; const text = `Check out this collaboration plan: ${plan.name}`; window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(planUrl)}&text=${encodeURIComponent(text)}`, '_blank');}} className="cursor-pointer"><Twitter className="mr-2 h-4 w-4 text-[#1DA1F2]" />Share on X (Twitter)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { const planUrl = window.location.href; window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(planUrl)}`, '_blank');}} className="cursor-pointer"><Linkedin className="mr-2 h-4 w-4 text-[#0A66C2]" />Share on LinkedIn</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { const planUrl = window.location.href; window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(planUrl)}`, '_blank');}} className="cursor-pointer"><Facebook className="mr-2 h-4 w-4 text-[#1877F2]" />Share on Facebook</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleShareToDiscord} className="cursor-pointer"><MessageSquare className="mr-2 h-4 w-4 text-[#5865F2]" />Share on Discord</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { const planUrl = window.location.href; const text = `Check out this collaboration plan: ${plan.name}\n\n${planUrl}`; window.open(`https://t.me/share/url?url=${encodeURIComponent(planUrl)}&text=${encodeURIComponent(text)}`, '_blank');}} className="cursor-pointer"><Send className="mr-2 h-4 w-4 text-[#0088cc]" />Share on Telegram</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { const planUrl = window.location.href; const text = `Check out this collaboration plan: ${plan.name}`; window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + planUrl)}`, '_blank');}} className="cursor-pointer"><MessageSquare className="mr-2 h-4 w-4 text-[#25D366]" />Share on WhatsApp</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { const planUrl = window.location.href; const subject = `Collaboration Plan: ${plan.name}`; const body = `Check out this collaboration plan: ${plan.name}\n\n${planUrl}`; window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;}} className="cursor-pointer"><Mail className="mr-2 h-4 w-4" />Share via Email</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleCopyLink} className="cursor-pointer"><LinkIconLucide className="mr-2 h-4 w-4" />Copy Link</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {currentUser && (<Avatar className="h-7 w-7"><AvatarImage src={currentUser.photoURL || undefined} alt={currentUser.displayName || 'User'} /><AvatarFallback className="text-xs">{getInitials(currentUser.displayName || currentUser.email || 'U')}</AvatarFallback></Avatar>)}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main
            ref={canvasRef}
            className="flex-1 grid-background relative overflow-auto p-4 md:p-6"
            onMouseMove={handleMouseMoveOnCanvas}
            onMouseUp={handleCanvasMouseUpForConnection}
            onClick={handleCanvasClick}
            style={{ minHeight: dynamicCanvasMinHeight ? `${dynamicCanvasMinHeight}px` : '100vh' }}
        >
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            {isOwner && <Button variant="outline" onClick={(e) => { e.stopPropagation(); openAddMainStepDialog(); }} className="shadow-md bg-card hover:bg-muted"><Plus className="h-4 w-4 mr-2" /> Add Roadmap Step</Button>}
            {!isOwner && (<Badge variant="secondary" className="text-xs">View Only Mode</Badge>)}
          </div>
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {roadmapSteps.map(targetStep => {
              if (!targetStep.sourceNodeId || !targetStep.sourceAnchor) return null;
              const sourceStep = roadmapStepsRef.current.find(s => s.id === targetStep.sourceNodeId);

              if (!sourceStep ||
                  isNaN(sourceStep.x) || isNaN(sourceStep.y) ||
                  isNaN(targetStep.x) || isNaN(targetStep.y)
              ) { return null; }

              const sourceCardHeight = getEstimatedCardHeight(sourceStep);
              const targetCardHeight = getEstimatedCardHeight(targetStep);

              if (isNaN(sourceCardHeight) || isNaN(targetCardHeight)) return null;

              let x1=0, y1=0, x2=0, y2=0;
              const yOffset = typeof targetStep.sourceLineYOffset === 'number' && !isNaN(targetStep.sourceLineYOffset) ? targetStep.sourceLineYOffset : 0;

              switch (targetStep.sourceAnchor) {
                case 'N': x1 = sourceStep.x + NODE_WIDTH / 2; y1 = sourceStep.y; break;
                case 'S': x1 = sourceStep.x + NODE_WIDTH / 2; y1 = sourceStep.y + sourceCardHeight; break;
                case 'E': x1 = sourceStep.x + NODE_WIDTH; y1 = sourceStep.y + sourceCardHeight / 2 + yOffset; break;
                case 'W': x1 = sourceStep.x; y1 = sourceStep.y + sourceCardHeight / 2 + yOffset; break;
                default: return null;
              }

              switch (targetStep.sourceAnchor) { // Lines connect *to* the opposite anchor
                case 'N': x2 = targetStep.x + NODE_WIDTH / 2; y2 = targetStep.y + targetCardHeight; break; // To bottom of target
                case 'S': x2 = targetStep.x + NODE_WIDTH / 2; y2 = targetStep.y; break; // To top of target
                case 'E': x2 = targetStep.x; y2 = targetStep.y + targetCardHeight / 2; break; // To left of target
                case 'W': x2 = targetStep.x + NODE_WIDTH; y2 = targetStep.y + targetCardHeight / 2; break; // To right of target
                default: return null;
              }

              const isSubStepLine = targetStep.sourceLineYOffset !== undefined && targetStep.originatingSubStepInfo;
              return (<line key={`line-${sourceStep.id}-${targetStep.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--foreground) / 0.7)" strokeWidth={isSubStepLine ? "1.5" : "3"} strokeDasharray={isSubStepLine ? "5 5" : "none"}/>);
            })}
            {connectionDragStateRef.current?.isActive && (
              <line
                x1={connectionDragStateRef.current.startX} y1={connectionDragStateRef.current.startY}
                x2={connectionDragStateRef.current.currentX} y2={connectionDragStateRef.current.currentY}
                stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="4 4"
              />
            )}
          </svg>
          {roadmapSteps.map(step => (
              <RoadmapStepCard
                key={step.id} step={step} onAddSubStep={openAddSubStepDialog} onOpenDetails={handleOpenNodeDetailsClick}
                onAutoCreateStepFromSubStep={isOwner ? handleAutoCreateStepFromSubStep : (e) => e.stopPropagation()}
                isSelected={selectedStepId === step.id} isSubmitting={!isOwner || isSubmittingStep || isAddStepDialogOpen || (connectionDragStateRef.current?.isActive ?? false)}
                onMouseDownOnNode={isOwner ? handleMouseDownOnNode : (e) => e.stopPropagation()}
                onDeleteNode={isOwner ? handleDeleteNodeClick : () => {}}
                onConnectionDotInteraction={isOwner ? handleConnectionDotInteraction : (e) => e.stopPropagation()}
                isPotentialConnectionTarget={isPotentialConnectionTarget}
              />
            ))}
          {roadmapSteps.length === 0 && !isAddStepDialogOpen && (<div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none"><Layers className="h-10 w-10 mb-2" /><p className="text-sm font-medium">Roadmap is empty.</p>{isOwner && <p className="text-xs">Click "Add Roadmap Step" to begin planning.</p>}</div>)}
        </main>
      </div>
      {planId && (<AddRoadmapStepDialogInternal isOpen={isAddStepDialogOpen && isOwner} onOpenChange={(open) => { setIsAddStepDialogOpen(open); if (!open) { setCurrentParentStepForDialog(null); setPendingNodeFromDotInfo(null); } }} onSubmit={handleAddRoadmapStepSubmit} isSubmitting={isSubmittingStep} parentStepTitle={currentParentStepForDialog?.title} dialogTitle={dialogTitleForAddStep}/>)}
      <Sheet open={!!selectedNodeForPanel} onOpenChange={(open) => { if (!open) { setSelectedNodeForPanel(null); setSelectedStepId(null); } }}><SheetContent className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col" side="right">{selectedNodeForPanel && (<><SheetHeader className="p-4 border-b"><SheetTitle className="truncate">Editing: {selectedNodeForPanel.title}</SheetTitle><SheetDescription>View or edit details for this roadmap step.</SheetDescription></SheetHeader><RoadmapStepDetailPanel step={selectedNodeForPanel} onDescriptionChange={handleStepDescriptionChange} onTitleChange={handleStepTitleChange} isOwner={isOwner}/><SheetFooter className="p-4 border-t mt-auto"><SheetClose asChild><Button type="button" variant="outline">Close</Button></SheetClose></SheetFooter></>)}</SheetContent></Sheet>
      {confirmDeleteNodeInfo && (<AlertDialog open={!!confirmDeleteNodeInfo} onOpenChange={() => setConfirmDeleteNodeInfo(null)}><ConfirmDialogContent><ConfirmDialogHeader><ConfirmDialogTitle>Delete Roadmap Step?</ConfirmDialogTitle><ConfirmDialogDescription>Are you sure you want to delete the step "{confirmDeleteNodeInfo.title}"? This will also remove any sub-steps and incoming connections to this step. This action cannot be undone.</ConfirmDialogDescription></ConfirmDialogHeader><ConfirmDialogFooter><AlertDialogCancel onClick={() => setConfirmDeleteNodeInfo(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteNode} className="bg-destructive hover:bg-destructive/90">Delete Step</AlertDialogAction></ConfirmDialogFooter></ConfirmDialogContent></AlertDialog>)}
    </div>
  );
};
export default ViewPlanPage;

