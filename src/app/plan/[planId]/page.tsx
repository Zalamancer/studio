
// src/app/plan/[planId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlanById, updatePlanRoadmap } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep } from '@/types/plan';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Brain, Share2, Presentation, MessageSquare, Plus, Undo, Redo, Layers, Minus, HelpCircle, User, MapPin, MousePointer2, LayoutGrid, StickyNote, Type, ShareIcon, PenTool, Square, Frame, Move, GripVertical, X, Eye, Save, Trash2 } from 'lucide-react';
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
const DOT_SIZE = 8;
const DOT_OFFSET = - (DOT_SIZE / 2);

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
  onInitiateNodeFromDot: (event: React.MouseEvent, sourceStepId: string, sourceAnchor: 'N' | 'S' | 'E' | 'W', sourceYOffset?: number) => void;
  isSelected: boolean;
  isSubmitting: boolean;
  onMouseDownOnNode: (event: React.MouseEvent<HTMLDivElement>, stepId: string) => void;
  onDeleteNode: (stepId: string, stepTitle: string) => void;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = ({
  step,
  onAddSubStep,
  onOpenDetails,
  onInitiateNodeFromDot,
  isSelected,
  isSubmitting,
  onMouseDownOnNode,
  onDeleteNode,
}) => {
  const cardDivRef = useRef<HTMLDivElement>(null);

  const handleDotClick = useCallback((e: React.MouseEvent, anchor: 'N' | 'S' | 'E' | 'W') => {
    e.stopPropagation();
    onInitiateNodeFromDot(e, step.id, anchor);
  }, [onInitiateNodeFromDot, step.id]);

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

  const SubStepDot: React.FC<{ subStepIndex: number }> = ({ subStepIndex }) => {
    const dotRef = React.useRef<HTMLSpanElement>(null);

    const handleSubStepDotClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (cardDivRef.current && dotRef.current) {
        const cardRect = cardDivRef.current.getBoundingClientRect();
        const dotRect = dotRef.current.getBoundingClientRect();
        const relativeYOffset = (dotRect.top - cardRect.top) + (dotRect.height / 2);
        onInitiateNodeFromDot(e, step.id, 'W', relativeYOffset);
      } else {
        onInitiateNodeFromDot(e, step.id, 'W');
      }
    };

    return (
      <span
        ref={dotRef}
        onMouseDown={handleSubStepDotClick}
        className={cn(
          "inline-block rounded-full bg-muted-foreground cursor-pointer",
          "h-2 w-2 mr-1.5",
          "transition-all duration-150 ease-in-out",
          "hover:bg-green-500 hover:ring-2 hover:ring-green-300",
          "hover:scale-150 active:scale-125"
        )}
        title="Add new step from this sub-step (to the left)"
      ></span>
    );
  };

  return (
    <div
      ref={cardDivRef}
      data-step-id={step.id}
      className={cn(
        "absolute bg-card border rounded-lg shadow-md w-64 cursor-default select-none z-10",
        "flex flex-col",
        isSelected && "ring-2 ring-primary shadow-primary/30 z-20"
      )}
      style={{ left: `${Math.round(step.x)}px`, top: `${Math.round(step.y)}px` }}
    >
      <CardHeader
        className="p-2.5 bg-muted/50 rounded-t-lg cursor-grab active:cursor-grabbing flex flex-row items-center flex-shrink-0"
        onMouseDown={handleHeaderMouseDown}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground mr-1.5 flex-shrink-0 pointer-events-none" />
        <div className="flex-grow min-w-0 pointer-events-none card-body-content">
          <CardTitle className="text-sm font-semibold truncate" title={step.title}>{step.title}</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="p-2.5 pt-1.5 border-t card-body-content">
        {step.subSteps && step.subSteps.length > 0 && (
          <>
            <p className="text-xs font-medium mb-1 text-muted-foreground">Sub-steps:</p>
            <ul className="list-none space-y-0.5 pl-0 ml-0">
              {step.subSteps.map((subStep, index) => (
                <li key={subStep.id} className="flex items-center gap-1.5 text-xs">
                  <SubStepDot subStepIndex={index} />
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
        <Button
          variant="outline"
          size="xs"
          onClick={handleAddSubStepClick}
          disabled={isSubmitting}
          className="text-xs h-7 px-2"
        >
          <Plus className="h-3 w-3 mr-1" /> Sub-step
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={handleOpenDetailsButtonClick}
          disabled={isSubmitting}
          className="text-xs h-7 px-2"
          title="Open Details"
        >
          <Eye className="h-3.5 w-3.5 mr-1" /> Open
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleDeleteButtonClick}
          disabled={isSubmitting}
          className="text-xs h-7 px-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          title="Delete Step"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>

      {isSelected && (
        <>
          <Button variant="outline" size="icon" className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary z-30" style={{ top: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE / 2}px)`, width: DOT_SIZE, height: DOT_SIZE, padding: 0 }} onClick={(e) => handleDotClick(e, 'N')} title="Add step above"><Plus className="h-3 w-3" /></Button>
          <Button variant="outline" size="icon" className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary z-30" style={{ bottom: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE / 2}px)`, width: DOT_SIZE, height: DOT_SIZE, padding: 0 }} onClick={(e) => handleDotClick(e, 'S')} title="Add step below"><Plus className="h-3 w-3" /></Button>
          <Button variant="outline" size="icon" className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary z-30" style={{ right: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE / 2}px)`, width: DOT_SIZE, height: DOT_SIZE, padding: 0 }} onClick={(e) => handleDotClick(e, 'E')} title="Add step to the right"><Plus className="h-3 w-3" /></Button>
          {(!step.subSteps || step.subSteps.length === 0) && (
              <Button variant="outline" size="icon" className="absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary z-30" style={{ left: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE / 2}px)`, width: DOT_SIZE, height: DOT_SIZE, padding: 0 }} onClick={(e) => handleDotClick(e, 'W')} title="Add step to the left"><Plus className="h-3 w-3" /></Button>
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
            <Input
              id={`step-title-input-${step.id}`}
              value={editableTitle}
              onChange={handleTitleChange}
              placeholder="Step Title"
              className="text-lg font-semibold border-input focus-visible:ring-ring focus-visible:ring-offset-background p-2 h-auto"
              disabled={!isOwner}
            />
          </div>
        ) : (
          <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
        )}
        <div>
          <Label htmlFor={`step-description-${step.id}`} className="text-sm font-medium mb-1 block">Description</Label>
          <Textarea
            id={`step-description-${step.id}`}
            value={editableDescription}
            onChange={handleDescriptionChange}
            placeholder="Add details about this step..."
            rows={6}
            className="text-sm resize-none"
            disabled={!isOwner}
          />
        </div>

        {step.subSteps && step.subSteps.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Sub-steps ({step.subSteps.length})</h4>
            <ul className="list-none space-y-1 pl-0 ml-0">
              {step.subSteps.map(sub => (
                <li key={sub.id} className="text-sm text-muted-foreground">
                  {sub.title}
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

const AddRoadmapStepDialogInternal: React.FC<AddRoadmapStepDialogInternalProps> = ({
  isOpen,
  onOpenChange,
  onSubmit,
  isSubmitting,
  parentStepTitle,
  dialogTitle,
}) => {
  const form = useForm<AddRoadmapStepDialogFormDataInternal>({
    resolver: zodResolver(addRoadmapStepDialogSchema),
    defaultValues: {
      title: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({ title: '' });
    }
  }, [isOpen, form]);

  const effectiveDialogTitle = dialogTitle ||
    (parentStepTitle
      ? `Add Sub-step to "${parentStepTitle}"`
      : "Add New Roadmap Step");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <AddStepDialogContent className="sm:max-w-md">
        <AddStepDialogHeader>
          <AddStepDialogTitle>{effectiveDialogTitle}</AddStepDialogTitle>
          <AddStepDialogDescription>
            Define a new step for your collaboration plan.
          </AddStepDialogDescription>
        </AddStepDialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div>
            <Label htmlFor="title-dialog">Step Title <span className="text-destructive">*</span></Label>
            <Input id="title-dialog" {...form.register('title')} placeholder="e.g., Market Research, Phase 1 Kickoff" disabled={isSubmitting || form.formState.isSubmitting} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>
            )}
          </div>
          <AddStepDialogFooter>
            <AddStepDialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting || form.formState.isSubmitting}>Cancel</Button>
            </AddStepDialogClose>
            <Button type="submit" disabled={isSubmitting || form.formState.isSubmitting}>
              {(isSubmitting || form.formState.isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Step
            </Button>
          </AddStepDialogFooter>
        </form>
      </AddStepDialogContent>
    </Dialog>
  );
};


// --- Main Page Component ---
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
  const [pendingNodeFromDotInfo, setPendingNodeFromDotInfo] = useState<{ sourceStepId: string; sourceAnchor: 'N' | 'S' | 'E' | 'W'; sourceYOffset?: number; } | null>(null);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedNodeForPanel, setSelectedNodeForPanel] = useState<RoadmapStep | null>(null);

  const draggingNodeIdRef = useRef<string | null>(null);
  const dragOperationStartRef = useRef<{ x: number; y: number } | null>(null);
  const nodeInitialCanvasPosRef = useRef<{ x: number; y: number } | null>(null);
  const latestMousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const dragUpdateFrameRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);

  const [dynamicCanvasMinHeight, setDynamicCanvasMinHeight] = useState<number | null>(null);
  const [isSavingRoadmap, setIsSavingRoadmap] = useState(false);

  const [confirmDeleteNodeInfo, setConfirmDeleteNodeInfo] = useState<{ id: string; title: string } | null>(null);


  const isPlanIdValidUid = React.useMemo(() => {
    if (!planId) return false;
    return IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20;
  }, [planId]);

  const { data: plan, isLoading, error, refetch: refetchPlan } = useQuery<ClientPlan | null, Error>({
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
        x: Math.round(typeof step.x === 'number' ? step.x : (index % 3) * (NODE_WIDTH + 64) + 20),
        y: Math.round(typeof step.y === 'number' ? step.y : Math.floor(index / 3) * (getEstimatedCardHeight(step) + 64) + 20),
        subSteps: step.subSteps || [],
        sourceLineYOffset: step.sourceLineYOffset,
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
      if (roadmapSteps.length > 0) {
        roadmapSteps.forEach(step => {
          const nodeHeight = getEstimatedCardHeight(step);
          const nodeBottom = (step.y || 0) + nodeHeight;
          if (nodeBottom > maxBottomY) {
            maxBottomY = nodeBottom;
          }
        });
      }
      const calculatedMinHeight = maxBottomY + NODE_END_PADDING + window.innerHeight;
      setDynamicCanvasMinHeight(calculatedMinHeight < window.innerHeight ? window.innerHeight : calculatedMinHeight);
    }
  }, [roadmapSteps]);

  const handleInitiateNodeFromDot = useCallback((event: React.MouseEvent, sourceStepId: string, sourceAnchor: 'N' | 'S' | 'E' | 'W', sourceYOffset?: number) => {
    event.stopPropagation();
    setSelectedStepId(sourceStepId);
    setSelectedNodeForPanel(null);
    setPendingNodeFromDotInfo({ sourceStepId, sourceAnchor, sourceYOffset });
    setCurrentParentStepForDialog(null);
    setIsAddStepDialogOpen(true);
  }, []);

  const openAddMainStepDialog = useCallback(() => {
    setSelectedStepId(null);
    setSelectedNodeForPanel(null);
    setCurrentParentStepForDialog(null);
    setPendingNodeFromDotInfo(null);
    setIsAddStepDialogOpen(true);
  }, []);

  const openAddSubStepDialog = useCallback((event: React.MouseEvent, parentId: string, parentTitle: string) => {
    event.stopPropagation();
    setSelectedStepId(parentId);
    setCurrentParentStepForDialog({ id: parentId, title: parentTitle });
    setSelectedNodeForPanel(null);
    setPendingNodeFromDotInfo(null);
    setIsAddStepDialogOpen(true);
  }, []);

  const handleOpenNodeDetailsClick = useCallback((event: React.MouseEvent, clickedStep: RoadmapStep) => {
    event.stopPropagation();
    setSelectedNodeForPanel(current => (current?.id === clickedStep.id ? null : clickedStep));
    setSelectedStepId(current => (current === clickedStep.id ? null : clickedStep.id));
  }, []);

  const handleAddRoadmapStepSubmit = useCallback(async (formData: AddRoadmapStepDialogFormDataInternal) => {
    if (isSubmittingStep) { console.warn("[ViewPlanPage] handleAddRoadmapStepSubmit: Already submitting, ignoring additional call."); return; }
    setIsSubmittingStep(true);
    try {
      const newStepBase = {
        id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: formData.title,
        description: null,
      };

      setRoadmapSteps(prevSteps => {
        if (currentParentStepForDialog) {
          return prevSteps.map(step =>
            step.id === currentParentStepForDialog.id
              ? { ...step, subSteps: [...(step.subSteps || []), { ...newStepBase, parentId: step.id } as RoadmapSubStep] }
              : step
          );
        } else {
          let newX = 20;
          let newY = 20;
          let stepSourceNodeId: string | undefined = undefined;
          let stepSourceAnchor: 'N' | 'S' | 'E' | 'W' | undefined = undefined;
          let stepSourceLineYOffset: number | undefined = undefined;

          if (canvasRef.current) {
            const currentCanvasClientWidth = canvasRef.current.clientWidth;
            if (pendingNodeFromDotInfo) {
              const sourceStep = prevSteps.find(s => s.id === pendingNodeFromDotInfo.sourceStepId);
              if (sourceStep) {
                stepSourceNodeId = sourceStep.id;
                stepSourceAnchor = pendingNodeFromDotInfo.sourceAnchor;
                stepSourceLineYOffset = pendingNodeFromDotInfo.sourceYOffset;
                const sourceCardHeight = getEstimatedCardHeight(sourceStep);
                const newCardDynamicHeight = getEstimatedCardHeight({ ...newStepBase, subSteps: [] } as RoadmapStep);
                switch (pendingNodeFromDotInfo.sourceAnchor) {
                  case 'N': newX = sourceStep.x; newY = sourceStep.y - (newCardDynamicHeight + 64); break;
                  case 'S': newX = sourceStep.x; newY = sourceStep.y + sourceCardHeight + 64; break;
                  case 'E': newX = sourceStep.x + NODE_WIDTH + 64; newY = sourceStep.y + (stepSourceLineYOffset ? (stepSourceLineYOffset - newCardDynamicHeight / 2) : (sourceCardHeight / 2 - newCardDynamicHeight / 2)); break;
                  case 'W': newX = sourceStep.x - (NODE_WIDTH + 64); newY = sourceStep.y + (stepSourceLineYOffset ? (stepSourceLineYOffset - newCardDynamicHeight / 2) : (sourceCardHeight / 2 - newCardDynamicHeight / 2)); break;
                }
              }
            } else if (prevSteps.length > 0) {
              const mainSteps = prevSteps;
              if (mainSteps.length > 0) {
                const lastMainStep = mainSteps.reduce((latest, current) => (current.y > latest.y ? current : latest), mainSteps[0]);
                newX = 20;
                newY = lastMainStep.y + getEstimatedCardHeight(lastMainStep) + 64;
              } else {
                const lastStep = prevSteps.reduce((latest, current) => (current.y > latest.y ? current : latest), prevSteps[0]);
                newX = 20;
                newY = lastStep.y + getEstimatedCardHeight(lastStep) + 64;
              }
            }
            const maxX = currentCanvasClientWidth > NODE_WIDTH ? currentCanvasClientWidth - NODE_WIDTH : 0;
            newX = Math.round(Math.max(0, Math.min(newX, maxX)));
            newY = Math.round(Math.max(0, newY));
          }
          const newMainStep: RoadmapStep = {
            ...newStepBase,
            subSteps: [],
            x: newX,
            y: newY,
            sourceNodeId: stepSourceNodeId,
            sourceAnchor: stepSourceAnchor,
            sourceLineYOffset: stepSourceLineYOffset,
          };
          return [...prevSteps, newMainStep];
        }
      });
      toast({ title: "Step Added", description: `"${formData.title}" added to the roadmap.` });
      setIsAddStepDialogOpen(false);
    } catch (error) {
      console.error("Error in handleAddRoadmapStepSubmit (synchronous part):", error);
      toast({ variant: "destructive", title: "Error", description: "Could not add step locally." });
      setIsSubmittingStep(false);
    }
  }, [isSubmittingStep, currentParentStepForDialog, pendingNodeFromDotInfo, toast, setRoadmapSteps, setIsSubmittingStep, setIsAddStepDialogOpen, setCurrentParentStepForDialog, setPendingNodeFromDotInfo]);


  const processDragMovementLoop = useCallback(() => {
    if (!draggingNodeIdRef.current || !latestMousePositionRef.current || !dragOperationStartRef.current || !nodeInitialCanvasPosRef.current) {
      if (dragUpdateFrameRef.current) cancelAnimationFrame(dragUpdateFrameRef.current);
      dragUpdateFrameRef.current = null;
      return;
    }

    const dx = latestMousePositionRef.current.x - dragOperationStartRef.current.x;
    const dy = latestMousePositionRef.current.y - dragOperationStartRef.current.y;
    const currentCanvasClientWidth = canvasRef.current?.clientWidth || window.innerWidth;
    const maxX = currentCanvasClientWidth > NODE_WIDTH ? currentCanvasClientWidth - NODE_WIDTH : 0;

    const newX = Math.round(Math.max(0, Math.min(nodeInitialCanvasPosRef.current.x + dx, maxX)));
    const newY = Math.round(Math.max(0, nodeInitialCanvasPosRef.current.y + dy));

    setRoadmapSteps(prevSteps => {
      const currentDraggingStep = prevSteps.find(s => s.id === draggingNodeIdRef.current);
      if (currentDraggingStep && currentDraggingStep.x === newX && currentDraggingStep.y === newY) {
        return prevSteps;
      }
      return prevSteps.map(step =>
        step.id === draggingNodeIdRef.current
          ? { ...step, x: newX, y: newY }
          : step
      );
    });

    dragUpdateFrameRef.current = requestAnimationFrame(processDragMovementLoop);
  }, [setRoadmapSteps]);


  const autoScrollLoop = useCallback(() => {
    if (!draggingNodeIdRef.current || !canvasRef.current) {
      if (autoScrollFrameRef.current) cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
      return;
    }

    const draggedNode = roadmapSteps.find(s => s.id === draggingNodeIdRef.current);
    if (!draggedNode || typeof draggedNode.x !== 'number' || typeof draggedNode.y !== 'number') {
      autoScrollFrameRef.current = requestAnimationFrame(autoScrollLoop);
      return;
    }

    const nodeHeight = getEstimatedCardHeight(draggedNode);
    const nodeCanvasCenterY = draggedNode.y + (nodeHeight / 2);
    const viewportCenterY = window.innerHeight / 2;
    const currentCanvasScrollTop = canvasRef.current.scrollTop;
    const targetScrollTop = nodeCanvasCenterY - viewportCenterY;
    const scrollDiff = targetScrollTop - currentCanvasScrollTop;

    const SMOOTHING_FACTOR_CENTERING = 0.15;
    const SCROLL_THRESHOLD_FOR_CENTERING = 2;

    if (Math.abs(scrollDiff) > SCROLL_THRESHOLD_FOR_CENTERING) {
      const scrollAdjustment = scrollDiff * SMOOTHING_FACTOR_CENTERING;
      canvasRef.current.scrollTop += scrollAdjustment;
    }
    autoScrollFrameRef.current = requestAnimationFrame(autoScrollLoop);
  }, [draggingNodeIdRef, roadmapSteps]);


  const handleMouseDownOnNode = useCallback((event: React.MouseEvent<HTMLDivElement>, stepId: string) => {
    if (draggingNodeIdRef.current) return;

    event.stopPropagation();
    setSelectedStepId(stepId);

    const stepToDrag = roadmapSteps.find(s => s.id === stepId);
    if (stepToDrag && typeof stepToDrag.x === 'number' && typeof stepToDrag.y === 'number') {
      draggingNodeIdRef.current = stepId;
      dragOperationStartRef.current = { x: event.clientX, y: event.clientY };
      nodeInitialCanvasPosRef.current = { x: stepToDrag.x, y: stepToDrag.y };
      latestMousePositionRef.current = { x: event.clientX, y: event.clientY };

      if (dragUpdateFrameRef.current) cancelAnimationFrame(dragUpdateFrameRef.current);
      dragUpdateFrameRef.current = requestAnimationFrame(processDragMovementLoop);

      if (autoScrollFrameRef.current) cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = requestAnimationFrame(autoScrollLoop);
    }
  }, [roadmapSteps, processDragMovementLoop, autoScrollLoop]);


  const handleMouseMoveOnCanvas = useCallback((event: React.MouseEvent) => {
    if (!draggingNodeIdRef.current) return;
    latestMousePositionRef.current = { x: event.clientX, y: event.clientY };
  }, []);


  const handleMouseUpOnCanvas = useCallback(() => {
    if (autoScrollFrameRef.current) cancelAnimationFrame(autoScrollFrameRef.current);
    autoScrollFrameRef.current = null;
    if (dragUpdateFrameRef.current) cancelAnimationFrame(dragUpdateFrameRef.current);
    dragUpdateFrameRef.current = null;

    draggingNodeIdRef.current = null;
    dragOperationStartRef.current = null;
    nodeInitialCanvasPosRef.current = null;
    latestMousePositionRef.current = null;
  }, []);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setSelectedStepId(null);
      setSelectedNodeForPanel(null);
    }
  }, []);

  const handleStepDescriptionChange = useCallback((stepId: string, newDescription: string | null) => {
    setRoadmapSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, description: newDescription } : step
      )
    );
  }, []);

  const handleStepTitleChange = useCallback((stepId: string, newTitle: string) => {
    setRoadmapSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, title: newTitle } : step
      )
    );
  }, []);

  const handleDeleteNodeClick = useCallback((stepId: string, stepTitle: string) => {
    setConfirmDeleteNodeInfo({ id: stepId, title: stepTitle });
  }, []);

  const confirmDeleteNode = useCallback(() => {
    if (!confirmDeleteNodeInfo) return;
    const stepIdToDelete = confirmDeleteNodeInfo.id;

    setRoadmapSteps(prevSteps => {
      const updatedSteps = prevSteps.filter(step => step.id !== stepIdToDelete);
      const finalSteps = updatedSteps.map(step => {
        if (step.sourceNodeId === stepIdToDelete) {
          return { ...step, sourceNodeId: undefined, sourceAnchor: undefined, sourceLineYOffset: undefined };
        }
        return step;
      });
      return finalSteps;
    });

    if (selectedStepId === stepIdToDelete) {
      setSelectedStepId(null);
      setSelectedNodeForPanel(null);
    }
    toast({ title: "Node Deleted", description: `Step "${confirmDeleteNodeInfo.title}" and its connections removed.` });
    setConfirmDeleteNodeInfo(null);
  }, [confirmDeleteNodeInfo, selectedStepId, toast]);


  const handleSaveRoadmap = async () => {
    if (!plan || !currentUser || !planId) {
      toast({ variant: "destructive", title: "Error", description: "Plan data or user authentication missing." });
      return;
    }
    setIsSavingRoadmap(true);
    try {
      await updatePlanRoadmap(planId, currentUser.uid, roadmapSteps);
      toast({ title: "Roadmap Saved", description: "Your changes have been saved successfully." });
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save roadmap." });
    } finally {
      setIsSavingRoadmap(false);
    }
  };


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
  const toolbarIcons = [ MousePointer2, LayoutGrid, StickyNote, Type, ShareIcon, PenTool, Square, Frame, Plus, Undo, Redo ];

  let dialogTitleForAddStep = "Add New Roadmap Step";
  if (currentParentStepForDialog) {
    dialogTitleForAddStep = `Add Sub-step to "${currentParentStepForDialog.title}"`;
  } else if (pendingNodeFromDotInfo) {
    const sourceStepTitle = roadmapSteps.find(s => s.id === pendingNodeFromDotInfo.sourceStepId)?.title || "Selected Step";
    const fromSubStepText = pendingNodeFromDotInfo.sourceYOffset !== undefined ? ' (from sub-step)' : '';
    dialogTitleForAddStep = `Add New Step from "${sourceStepTitle}"${fromSubStepText}`;
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
          {isOwner && (
            <Button
              variant="default"
              size="sm"
              className="h-8"
              onClick={handleSaveRoadmap}
              disabled={isSavingRoadmap}
            >
              {isSavingRoadmap ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              <span className="hidden sm:inline">Save Roadmap</span>
              <span className="sm:hidden">Save</span>
            </Button>
          )}
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
            style={{ minHeight: dynamicCanvasMinHeight ? `${dynamicCanvasMinHeight}px` : '100vh' }}
        >
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <Button
              variant="outline"
              onClick={(e) => { e.stopPropagation(); openAddMainStepDialog(); }}
              disabled={isAddStepDialogOpen || !isOwner || isSubmittingStep}
              className="shadow-md bg-card hover:bg-muted"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Roadmap Step
            </Button>
            {!isOwner && (
                 <Badge variant="secondary" className="text-xs">View Only Mode</Badge>
            )}
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
                case 'N': x1 = sourceStep.x + NODE_WIDTH / 2; y1 = sourceStep.y; break;
                case 'S': x1 = sourceStep.x + NODE_WIDTH / 2; y1 = sourceStep.y + sourceCardHeight; break;
                case 'E': x1 = sourceStep.x + NODE_WIDTH; y1 = sourceStep.y + (targetStep.sourceLineYOffset !== undefined ? targetStep.sourceLineYOffset : sourceCardHeight / 2); break;
                case 'W': x1 = sourceStep.x; y1 = sourceStep.y + (targetStep.sourceLineYOffset !== undefined ? targetStep.sourceLineYOffset : sourceCardHeight / 2); break;
              }

              switch (targetStep.sourceAnchor) {
                case 'N': x2 = targetStep.x + NODE_WIDTH / 2; y2 = targetStep.y + targetCardHeight; break;
                case 'S': x2 = targetStep.x + NODE_WIDTH / 2; y2 = targetStep.y; break;
                case 'E': x2 = targetStep.x; y2 = targetStep.y + targetCardHeight / 2; break;
                case 'W': x2 = targetStep.x + NODE_WIDTH; y2 = targetStep.y + targetCardHeight / 2; break;
                default: return null;
              }
              const isSubStepLine = targetStep.sourceLineYOffset !== undefined;
              return (
                <line
                  key={`line-${sourceStep.id}-${targetStep.id}`}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="hsl(var(--foreground) / 0.7)"
                  strokeWidth={isSubStepLine ? "1.5" : "3"}
                  strokeDasharray={isSubStepLine ? "5 5" : "none"}
                />
              );
            })}
          </svg>

          {roadmapSteps.map(step => (
              <RoadmapStepCard
                key={step.id}
                step={step}
                onAddSubStep={openAddSubStepDialog}
                onOpenDetails={handleOpenNodeDetailsClick}
                onInitiateNodeFromDot={handleInitiateNodeFromDot}
                isSelected={selectedStepId === step.id}
                isSubmitting={!isOwner || isSubmittingStep || isAddStepDialogOpen}
                onMouseDownOnNode={isOwner ? handleMouseDownOnNode : (e) => e.stopPropagation()}
                onDeleteNode={isOwner ? handleDeleteNodeClick : () => {}}
              />
            ))}

          {roadmapSteps.length === 0 && !isAddStepDialogOpen && (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none">
              <StickyNote className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium">Roadmap is empty.</p>
              {isOwner && <p className="text-xs">Click "Add Roadmap Step" to begin planning.</p>}
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
        <AddRoadmapStepDialogInternal
          isOpen={isAddStepDialogOpen && isOwner}
          onOpenChange={(open) => {
            setIsAddStepDialogOpen(open);
            if (!open) {
              setIsSubmittingStep(false);
              setCurrentParentStepForDialog(null);
              setPendingNodeFromDotInfo(null);
            }
          }}
          onSubmit={handleAddRoadmapStepSubmit}
          isSubmitting={isSubmittingStep}
          parentStepTitle={currentParentStepForDialog?.title}
          dialogTitle={dialogTitleForAddStep}
        />
      )}

       <Sheet open={!!selectedNodeForPanel} onOpenChange={(open) => { if (!open) { setSelectedNodeForPanel(null); setSelectedStepId(null); } }}>
          <SheetContent className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col" side="right">
            {selectedNodeForPanel && (
              <>
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="truncate">
                    Editing: {selectedNodeForPanel.title}
                  </SheetTitle>
                  <SheetDescription>View or edit details for this roadmap step.</SheetDescription>
                </SheetHeader>
                <RoadmapStepDetailPanel
                  step={selectedNodeForPanel}
                  onDescriptionChange={handleStepDescriptionChange}
                  onTitleChange={handleStepTitleChange}
                  isOwner={isOwner}
                />
                <SheetFooter className="p-4 border-t mt-auto">
                   <SheetClose asChild>
                       <Button type="button" variant="outline">Close</Button>
                   </SheetClose>
                </SheetFooter>
              </>
            )}
          </SheetContent>
       </Sheet>


      {confirmDeleteNodeInfo && (
        <AlertDialog open={!!confirmDeleteNodeInfo} onOpenChange={() => setConfirmDeleteNodeInfo(null)}>
          <ConfirmDialogContent>
            <ConfirmDialogHeader>
              <ConfirmDialogTitle>Delete Roadmap Step?</ConfirmDialogTitle>
              <ConfirmDialogDescription>
                Are you sure you want to delete the step "{confirmDeleteNodeInfo.title}"?
                This will also remove any sub-steps and incoming connections to this step. This action cannot be undone.
              </ConfirmDialogDescription>
            </ConfirmDialogHeader>
            <ConfirmDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmDeleteNodeInfo(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteNode} className="bg-destructive hover:bg-destructive/90">
                Delete Step
              </AlertDialogAction>
            </ConfirmDialogFooter>
          </ConfirmDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default ViewPlanPage;
    

