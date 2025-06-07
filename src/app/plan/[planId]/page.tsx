
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
  XCircle,
  Edit2,
  MoreVertical,
  Trash2,
  Type as TypeIcon,
  MessageSquare as LineLabelIcon,
  MinusCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

import { getPlanById, updatePlanRoadmap } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep, NewPlanData, UpdatePlanRoadmapData, IncomingConnection } from '@/types/plan';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn, IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { AddRoadmapStepDialog, type AddRoadmapStepFormData } from '@/components/plan/AddRoadmapStepDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';

const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const NODE_BASE_MIN_HEIGHT = 100;
const NODE_HEADER_HEIGHT = 40;
const SUBSTEP_ITEM_HEIGHT = 24;
const NODE_CONTENT_PADDING_Y = 16;
const FINAL_BUFFER_CARD_HEIGHT = 20;

const DOT_SIZE = 12;
const DOT_RADIUS = DOT_SIZE / 2;
const DOT_OFFSET = -DOT_RADIUS;
const SNAP_THRESHOLD = 20;
const CONNECTION_LINE_COLOR = "hsl(var(--border))";
const CONNECTION_LINE_HOVER_COLOR = "hsl(var(--primary))";
const CONNECTION_LINE_THICKNESS = 2;

const ARROWHEAD_LENGTH = 10;
const NECK_LENGTH = ARROWHEAD_LENGTH * 2;
const START_OFFSET_FROM_DOT = DOT_RADIUS + (CONNECTION_LINE_THICKNESS / 2);
const MIN_MAIN_PATH_LENGTH = 10;


const calculateNodeHeight = (step: RoadmapStep): number => {
  let height = NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y;

  let descriptionLineCount = 0;
  if (step.description && step.description.trim().length > 0) {
    const lines = step.description.split(/\\n|\n|<br\s*\/?>/gi).length;
    descriptionLineCount = Math.max(1, lines);
  }
  const descriptionHeight = descriptionLineCount * 15;

  let subStepsHeight = 0;
  if (step.subSteps && step.subSteps.length > 0) {
    subStepsHeight = (step.subSteps.length * SUBSTEP_ITEM_HEIGHT) + (SUBSTEP_ITEM_HEIGHT / 2);
  }

  const contentHeight = Math.max(descriptionHeight, subStepsHeight);
  height += contentHeight;
  height += FINAL_BUFFER_CARD_HEIGHT;

  return Math.max(NODE_BASE_MIN_HEIGHT, height);
};

interface RoadmapStepCardProps {
  step: RoadmapStep;
  onNodeMouseDown: (stepId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  onConnectionDotInteraction: (
    parentNodeId: string,
    anchor: 'N' | 'S' | 'E' | 'W',
    interactionType: 'down' | 'up',
    event: React.MouseEvent<HTMLElement>,
    subStepOriginContext?: { subStepId: string; subStepTitle: string }
  ) => void;
  isSelected?: boolean;
  isSubmitting: boolean;
  onEditStep: (step: RoadmapStep) => void;
  onDeleteStep: (stepId: string, stepTitle: string) => void;
  onAddSubStep: (parentStepId: string, parentStepTitle: string) => void;
  isDragging?: boolean;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  onNodeMouseDown,
  onConnectionDotInteraction,
  isSelected,
  isSubmitting,
  onEditStep,
  onDeleteStep,
  onAddSubStep,
  isDragging,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const dynamicHeight = calculateNodeHeight(step);

  const ConnectionDot: React.FC<{
    anchor: 'N' | 'S' | 'E' | 'W';
    parentStepId: string;
    isSubmitting: boolean;
    style?: React.CSSProperties;
    className?: string;
    subStepContext?: { subStepId: string; subStepTitle: string };
  }> = ({ anchor, parentStepId: localParentStepId, isSubmitting: propIsSubmitting, style, className, subStepContext }) => {
    const dotClickableSize = DOT_SIZE;

    return (
      <button
        aria-label={`Connect from ${anchor} anchor of step ${step.title}${subStepContext ? ` (sub-step: ${subStepContext.subStepTitle})` : ''}`}
        className={cn(
          "absolute rounded-full z-10 transition-all duration-150 ease-in-out shadow-sm",
          propIsSubmitting && "cursor-not-allowed opacity-50",
          className
        )}
        style={{
          width: dotClickableSize,
          height: dotClickableSize,
          ...style
        }}
        onMouseDown={(e) => {
          if (propIsSubmitting) return;
          e.stopPropagation();
          onConnectionDotInteraction(localParentStepId, anchor, 'down', e, subStepContext);
        }}
        onMouseUp={(e) => {
           if (propIsSubmitting) return;
           e.stopPropagation();
           onConnectionDotInteraction(localParentStepId, anchor, 'up', e, subStepContext);
        }}
        disabled={propIsSubmitting}
      />
    );
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "absolute select-none shadow-lg border rounded-lg flex flex-col",
        "bg-card text-card-foreground",
        isSelected ? "ring-2 ring-primary shadow-2xl z-20" : "border-border hover:shadow-xl z-10",
        isDragging ? 'cursor-grabbing shadow-2xl z-30' : 'cursor-grab'
      )}
      style={{
        left: `${step.x}px`,
        top: `${step.y}px`,
        width: `${NODE_BASE_WIDTH}px`,
        height: `${dynamicHeight}px`,
        touchAction: 'none',
        overflow: 'visible',
      }}
      onMouseDown={(e) => onNodeMouseDown(step.id, e)}
      data-node-id={step.id}
    >
      <div className="p-2 border-b border-border flex items-center justify-between cursor-move bg-muted/30 rounded-t-lg h-[40px]">
        <h3 className="text-sm font-semibold truncate" title={step.title}>
          {step.title}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 p-1 flex-shrink-0" onClick={(e) => e.stopPropagation()} disabled={isSubmitting}>
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Step options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEditStep(step)} disabled={isSubmitting}>
              <Edit2 className="mr-2 h-3.5 w-3.5" /> Edit Step
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddSubStep(step.id, step.title)} disabled={isSubmitting}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Add Sub-step
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDeleteStep(step.id, step.title)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={isSubmitting}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Step
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="p-2 text-xs text-muted-foreground flex-grow min-h-0">
        {step.description && (
          <p className="whitespace-pre-wrap line-clamp-3 mb-1.5">{step.description}</p>
        )}
        {step.subSteps && step.subSteps.length > 0 && (
          <ul className="space-y-1 list-none p-0 m-0">
            {step.subSteps.map((subStep) => (
              <li key={subStep.id} className="text-xs text-muted-foreground/90 flex items-center relative py-0.5 group/substep">
                <span className="truncate flex-grow" title={subStep.title}>{subStep.title}</span>
              </li>
            ))}
          </ul>
        )}
        {(!step.description || step.description.trim().length === 0) && (!step.subSteps || step.subSteps.length === 0) && (
          <p className="italic text-muted-foreground/70 text-center py-2 text-[11px]">No details or sub-steps yet.</p>
        )}
      </div>

      {/* Main connection dots */}
      <ConnectionDot anchor="N" parentStepId={step.id} isSubmitting={isSubmitting} style={{ top: DOT_OFFSET, left: `calc(50% + ${DOT_OFFSET}px)` }} className="border-2 border-primary bg-card hover:bg-primary/20 hover:scale-110" />
      <ConnectionDot anchor="S" parentStepId={step.id} isSubmitting={isSubmitting} style={{ bottom: DOT_OFFSET, left: `calc(50% + ${DOT_OFFSET}px)` }} className="border-2 border-primary bg-card hover:bg-primary/20 hover:scale-110" />
      <ConnectionDot anchor="E" parentStepId={step.id} isSubmitting={isSubmitting} style={{ right: DOT_OFFSET, top: `calc(50% + ${DOT_OFFSET}px)` }} className="border-2 border-primary bg-card hover:bg-primary/20 hover:scale-110" />
      
      {(!step.subSteps || step.subSteps.length === 0) && (
        <ConnectionDot anchor="W" parentStepId={step.id} isSubmitting={isSubmitting} style={{ left: DOT_OFFSET, top: `calc(50% + ${DOT_OFFSET}px)` }} className="border-2 border-primary bg-card hover:bg-primary/20 hover:scale-110" />
      )}

      {/* Sub-step connection dots (always on the West edge if sub-steps exist) */}
      {step.subSteps && step.subSteps.map((subStep, index) => (
        <ConnectionDot
          key={`subdot-ext-${subStep.id}`}
          anchor="W" // These are effectively West-side dots for sub-steps
          parentStepId={step.id}
          isSubmitting={isSubmitting}
          style={{
            left: DOT_OFFSET,
            top: `${NODE_HEADER_HEIGHT + (NODE_CONTENT_PADDING_Y / 2) + (index * SUBSTEP_ITEM_HEIGHT) + (SUBSTEP_ITEM_HEIGHT / 2) + DOT_OFFSET}px`,
          }}
          subStepContext={{ subStepId: subStep.id, subStepTitle: subStep.title }}
          className="bg-muted-foreground cursor-grab h-2 w-2 hover:bg-green-500 hover:ring-2 hover:ring-green-300 active:bg-green-600 hover:scale-150 active:scale-125"
        />
      ))}
    </div>
  );
});
RoadmapStepCard.displayName = "RoadmapStepCard";

interface DraggingNodeInfo {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

interface ConnectionDragStateType {
  isDragging: boolean;
  sourceStepId: string | null;
  sourceAnchor: 'N' | 'S' | 'E' | 'W' | null;
  sourceSubStepOriginContext?: { subStepId: string; subStepTitle: string } | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface ClickStartInfoType {
  parentStepId: string | null;
  anchor: 'N' | 'S' | 'E' | 'W' | null;
  subStepOriginContext?: { subStepId: string; subStepTitle: string } | null;
  clientX: number;
  clientY: number;
}

interface ConnectionToDeleteInfo {
  parentNodeId: string;
  connectionToActuallyDelete: IncomingConnection;
}

interface LineContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  targetNodeId: string;
  connectionId: string;
}

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const planId = params?.planId as string | undefined;

  const [canvasMinHeight, setCanvasMinHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 800 // Default for SSR or if window undefined early
  );
  const [editableRoadmap, setEditableRoadmap] = useState<RoadmapStep[]>([]);
  const [draggingNodeInfo, setDraggingNodeInfo] = useState<DraggingNodeInfo | null>(null);
  const [isAddStepDialogOpen, setIsAddStepDialogOpen] = useState(false);
  const [pendingNodeFromDotInfo, setPendingNodeFromDotInfo] = useState<{
    sourceStepId: string;
    sourceAnchor: 'N' | 'S' | 'E' | 'W';
    creatingFromSubStepId?: string;
    creatingFromSubStepTitle?: string;
  } | null>(null);
  const [editingStep, setEditingStep] = useState<RoadmapStep | null>(null);
  const [isStepDetailSheetOpen, setIsStepDetailSheetOpen] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<{id: string, title: string} | null>(null);
  const [connectionToDeleteInfo, setConnectionToDeleteInfo] = useState<ConnectionToDeleteInfo | null>(null);

  const [lineContextMenu, setLineContextMenu] = useState<LineContextMenuState | null>(null);
  const [isLineEditLabelAlertOpen, setIsLineEditLabelAlertOpen] = useState(false);
  const [currentLineEditLabel, setCurrentLineEditLabel] = useState("");
  const lineLabelInputRef = useRef<HTMLInputElement>(null);

  const [activeConnectionDragOperation, setActiveConnectionDragOperation] = useState<ConnectionDragStateType>({
    isDragging: false, sourceStepId: null, sourceAnchor: null, sourceSubStepOriginContext: null, startX: 0, startY: 0, currentX: 0, currentY: 0
  });
  const clickStartInfoRef = useRef<ClickStartInfoType | null>(null);

  const isValidPlanId = useMemo(() => !!planId && (IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20), [planId]);

  const { data: planData, isLoading: isLoadingPlan, error: planError } = useQuery<ClientPlan | null>({
    queryKey: ['plan', planId],
    queryFn: async () => (planId && isValidPlanId) ? getPlanById(planId) : null,
    enabled: !!planId && isValidPlanId && !authLoading,
  });

  const saveRoadmapMutation = useMutation({
    mutationFn: (payload: { planId: string; ownerId: string; roadmap: RoadmapStep[] }) =>
      updatePlanRoadmap(payload.planId, payload.ownerId, payload.roadmap),
    onSuccess: () => {
      toast({ title: "Plan State Saved", description: "The current plan state has been saved." });
      if (planId) queryClient.invalidateQueries({ queryKey: ['plan', planId] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save plan." });
    }
  });

  useEffect(() => {
    if (planData) {
      setEditableRoadmap(planData.roadmap?.map(step => ({...step, incomingConnections: step.incomingConnections || [] })) || []);
    } else {
      setEditableRoadmap([]);
    }
  }, [planData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let lowestNodeBottomY = 0;
      if (editableRoadmap.length > 0) {
        lowestNodeBottomY = Math.max(
          ...editableRoadmap.map(step => step.y + calculateNodeHeight(step))
        );
      }
      const newMinHeight = Math.max(window.innerHeight, lowestNodeBottomY + window.innerHeight);
      setCanvasMinHeight(newMinHeight);
    }
  }, [editableRoadmap]);


  const isOwner = useMemo(() => !!user && !!planData && user.uid === planData.ownerId, [user, planData]);

  const saveRoadmapChanges = async () => {
    if (!planData || !user || !planId || !isOwner) {
      toast({ variant: "destructive", title: "Error", description: "Cannot save: Plan data, user authentication, or ownership missing." });
      return;
    }
    saveRoadmapMutation.mutate({ planId, ownerId: user.uid, roadmap: editableRoadmap });
  };

  const sharePlan = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link Copied!", description: "Plan URL copied to clipboard." });
    } catch (err) {
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy link to clipboard." });
    }
  };

  const handleAddNewNodeClick = (sourceNodeId?: string, sourceAnchor?: 'N'|'S'|'E'|'W') => {
    if (!isOwner || !planData) return;
    setPendingNodeFromDotInfo(sourceNodeId && sourceAnchor ? { sourceStepId: sourceNodeId, sourceAnchor } : null);
    setIsAddStepDialogOpen(true);
  };

  const handleAddRoadmapStepSubmit = useCallback((data: AddRoadmapStepFormData) => {
    if (!isOwner) return;

    let newStepX = 100;
    let newStepY = 100;
    let initialIncomingConnections: IncomingConnection[] = [];

    if (pendingNodeFromDotInfo && pendingNodeFromDotInfo.sourceStepId) {
      const sourceNode = editableRoadmap.find(s => s.id === pendingNodeFromDotInfo.sourceStepId);
      if (sourceNode) {
        const sourceNodeHeight = calculateNodeHeight(sourceNode);
        const sourceNodeWidth = NODE_BASE_WIDTH;
        const spacing = 50;
        const newNodeApproxHeight = calculateNodeHeight({ title: data.title, x:0, y:0, id:'temp', subSteps:[], incomingConnections:[] });

        let targetAnchorOnNewNode: 'N' | 'S' | 'E' | 'W' = 'N';

        switch(pendingNodeFromDotInfo.sourceAnchor) {
          case 'N':
            newStepX = sourceNode.x + (sourceNodeWidth / 2) - (NODE_BASE_WIDTH / 2);
            newStepY = sourceNode.y - newNodeApproxHeight - spacing;
            targetAnchorOnNewNode = 'S';
            break;
          case 'S':
            newStepX = sourceNode.x + (sourceNodeWidth / 2) - (NODE_BASE_WIDTH / 2);
            newStepY = sourceNode.y + sourceNodeHeight + spacing;
            targetAnchorOnNewNode = 'N';
            break;
          case 'E':
            newStepX = sourceNode.x + sourceNodeWidth + spacing;
            newStepY = sourceNode.y + (sourceNodeHeight / 2) - (newNodeApproxHeight / 2);
            targetAnchorOnNewNode = 'W';
            break;
          case 'W':
            newStepX = sourceNode.x - NODE_BASE_WIDTH - spacing;
            let baseSubStepY = sourceNode.y + (sourceNodeHeight / 2) - (newNodeApproxHeight / 2);
            if(pendingNodeFromDotInfo.creatingFromSubStepId){
                const subStepIndex = sourceNode.subSteps?.findIndex(ss => ss.id === pendingNodeFromDotInfo.creatingFromSubStepId) ?? -1;
                if(subStepIndex !== -1){
                    const subStepYCenterInCard = NODE_HEADER_HEIGHT + (NODE_CONTENT_PADDING_Y / 2) + (subStepIndex * SUBSTEP_ITEM_HEIGHT) + (SUBSTEP_ITEM_HEIGHT / 2);
                    baseSubStepY = sourceNode.y + subStepYCenterInCard - (newNodeApproxHeight / 2);
                }
            }
            newStepY = baseSubStepY;
            targetAnchorOnNewNode = 'E';
            break;
        }

        initialIncomingConnections.push({
            id: `conn-${uuidv4()}`,
            lineType: 'straight',
            sourceNodeId: pendingNodeFromDotInfo.sourceStepId,
            targetAnchor: targetAnchorOnNewNode,
            originatingSubStepContext: pendingNodeFromDotInfo.creatingFromSubStepId
                ? {
                    sourceCardId: pendingNodeFromDotInfo.sourceStepId,
                    subStepId: pendingNodeFromDotInfo.creatingFromSubStepId,
                  }
                : null,
        });
      }
    } else if (canvasRef.current) {
        newStepX = canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2;
        newStepY = canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - calculateNodeHeight({ title: data.title, x:0,y:0,id:'temp',subSteps:[], incomingConnections:[] }) / 2;
    }

    newStepX = Math.max(0, newStepX);
    newStepY = Math.max(0, newStepY);

    const newNode: RoadmapStep = {
      id: `step-${Date.now()}-${uuidv4().substring(0, 8)}`,
      title: data.title,
      description: null,
      x: newStepX,
      y: newStepY,
      subSteps: [],
      incomingConnections: initialIncomingConnections,
    };

    setEditableRoadmap(prev => [...prev, newNode]);
    setIsAddStepDialogOpen(false);
    setPendingNodeFromDotInfo(null);
    toast({ title: "Node Added", description: `"${data.title}" has been added. Remember to save your plan.` });
  }, [isOwner, editableRoadmap, pendingNodeFromDotInfo, toast]);


  const handleNodeMouseDown = useCallback((nodeId: string, event: React.MouseEvent<HTMLDivElement>) => {
    if (!isOwner || event.button !== 0) return;
    event.preventDefault();
    const nodeElement = event.currentTarget;
    const nodeRect = nodeElement.getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const offsetX = event.clientX - nodeRect.left;
    const offsetY = event.clientY - nodeRect.top;
    setDraggingNodeInfo({ nodeId, offsetX, offsetY });
  }, [isOwner]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();

    if (draggingNodeInfo) {
      let newX = event.clientX - canvasRect.left - draggingNodeInfo.offsetX + canvasRef.current.scrollLeft;
      let newY = event.clientY - canvasRect.top - draggingNodeInfo.offsetY + canvasRef.current.scrollTop;
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);

      setEditableRoadmap(prevRoadmap =>
        prevRoadmap.map(step =>
          step.id === draggingNodeInfo.nodeId
            ? { ...step, x: newX, y: newY }
            : step
        )
      );
    } else if (activeConnectionDragOperation.isDragging) {
        const currentX = event.clientX - canvasRect.left + canvasRef.current.scrollLeft;
        const currentY = event.clientY - canvasRect.top + canvasRef.current.scrollTop;
        setActiveConnectionDragOperation(prev => ({...prev, currentX, currentY }));
    }
  }, [draggingNodeInfo, activeConnectionDragOperation.isDragging]);

  const handleCanvasMouseUpOrLeave = useCallback(() => {
    if (draggingNodeInfo) setDraggingNodeInfo(null);
    if (activeConnectionDragOperation.isDragging) {
       setActiveConnectionDragOperation({ isDragging: false, sourceStepId: null, sourceAnchor: null, sourceSubStepOriginContext: null, startX: 0, startY: 0, currentX: 0, currentY: 0 });
    }
    clickStartInfoRef.current = null;
  }, [draggingNodeInfo, activeConnectionDragOperation.isDragging]);


  const getAnchorPoint = (step: RoadmapStep, anchor: 'N' | 'S' | 'E' | 'W'): { x: number, y: number } => {
    const nodeHeight = calculateNodeHeight(step);
    const nodeWidth = NODE_BASE_WIDTH;
    switch (anchor) {
      case 'N': return { x: step.x + nodeWidth / 2, y: step.y };
      case 'S': return { x: step.x + nodeWidth / 2, y: step.y + nodeHeight };
      case 'E': return { x: step.x + nodeWidth, y: step.y + nodeHeight / 2 };
      case 'W': return { x: step.x, y: step.y + nodeHeight / 2 };
      default: return { x: step.x, y: step.y };
    }
  };

  const getSubStepDotAnchorPoint = (parentStep: RoadmapStep, subStepId: string): { x: number, y: number } => {
    const subStepIndex = parentStep.subSteps?.findIndex(ss => ss.id === subStepId) ?? -1;
    if (subStepIndex === -1) {
      return { x: parentStep.x + DOT_OFFSET + DOT_RADIUS, y: parentStep.y + NODE_HEADER_HEIGHT + (NODE_CONTENT_PADDING_Y / 2) };
    }
    const yCenterOfSubStepTextLine = NODE_HEADER_HEIGHT + (NODE_CONTENT_PADDING_Y / 2) + (subStepIndex * SUBSTEP_ITEM_HEIGHT) + (SUBSTEP_ITEM_HEIGHT / 2);
    return {
      x: parentStep.x + DOT_OFFSET + DOT_RADIUS,
      y: parentStep.y + yCenterOfSubStepTextLine
    };
  };

  const handleConnectionDotInteraction = useCallback((
    parentNodeId: string,
    clickedAnchor: 'N' | 'S' | 'E' | 'W',
    interactionType: 'down' | 'up',
    event: React.MouseEvent<HTMLElement>,
    subStepOriginContextFromDot?: { subStepId: string; subStepTitle: string }
  ) => {
    if (!isOwner || !canvasRef.current) return;
    event.stopPropagation();
    const canvasRect = canvasRef.current.getBoundingClientRect();

    const getElementCenter = (domElement: HTMLElement) => {
        const domRect = domElement.getBoundingClientRect();
        return {
            x: domRect.left + domRect.width / 2 - canvasRect.left + canvasRef.current!.scrollLeft,
            y: domRect.top + domRect.height / 2 - canvasRect.top + canvasRef.current!.scrollTop,
        };
    };

    const sourceDotCenter = getElementCenter(event.currentTarget);
    const sourceDotX = sourceDotCenter.x;
    const sourceDotY = sourceDotCenter.y;

    if (interactionType === 'down') {
      clickStartInfoRef.current = { parentStepId: parentNodeId, anchor: clickedAnchor, clientX: event.clientX, clientY: event.clientY, subStepOriginContext: subStepOriginContextFromDot };
      setActiveConnectionDragOperation({
        isDragging: true,
        sourceStepId: parentNodeId,
        sourceAnchor: clickedAnchor,
        sourceSubStepOriginContext: subStepOriginContextFromDot,
        startX: sourceDotX,
        startY: sourceDotY,
        currentX: sourceDotX,
        currentY: sourceDotY,
      });
    } else if (interactionType === 'up' && clickStartInfoRef.current) {
        const dx = Math.abs(event.clientX - clickStartInfoRef.current.clientX);
        const dy = Math.abs(event.clientY - clickStartInfoRef.current.clientY);
        const isClick = dx < 5 && dy < 5;

        if (isClick) {
          const parentNode = editableRoadmap.find(s => s.id === parentNodeId);
          if (!parentNode) {
            clickStartInfoRef.current = null;
            setActiveConnectionDragOperation({ isDragging: false, sourceStepId: null, sourceAnchor: null, sourceSubStepOriginContext: null, startX: 0, startY: 0, currentX: 0, currentY: 0 });
            return;
          }

          const connectionAtThisDot = (parentNode.incomingConnections || []).find(conn => conn.targetAnchor === clickedAnchor);

          if (subStepOriginContextFromDot) {
             setPendingNodeFromDotInfo({
                sourceStepId: parentNode.id,
                sourceAnchor: 'W', // Sub-steps always connect from West for new nodes
                creatingFromSubStepId: subStepOriginContextFromDot.subStepId,
                creatingFromSubStepTitle: subStepOriginContextFromDot.subStepTitle,
             });
             setIsAddStepDialogOpen(true);
          } else {
            if (connectionAtThisDot) {
              setConnectionToDeleteInfo({ parentNodeId: parentNode.id, connectionToActuallyDelete: connectionAtThisDot });
            } else {
              setPendingNodeFromDotInfo({
                sourceStepId: parentNode.id,
                sourceAnchor: clickedAnchor,
              });
              setIsAddStepDialogOpen(true);
            }
          }
        } else {
            const releaseX = event.clientX - canvasRect.left + canvasRef.current.scrollLeft;
            const releaseY = event.clientY - canvasRect.top + canvasRef.current.scrollTop;
            let snapped = false;

            for (const targetStep of editableRoadmap) {
                if (targetStep.id === activeConnectionDragOperation.sourceStepId) continue;

                const targetAnchors: ('N'|'S'|'E'|'W')[] = ['N', 'S', 'E', 'W'];
                for (const targetAnchor of targetAnchors) {
                    const targetDotPos = getAnchorPoint(targetStep, targetAnchor);
                    const dist = Math.sqrt(Math.pow(releaseX - targetDotPos.x, 2) + Math.pow(releaseY - targetDotPos.y, 2));

                    if (dist <= SNAP_THRESHOLD) {
                        const alreadyConnectedFromThisSource = (targetStep.incomingConnections || []).some(conn =>
                            conn.sourceNodeId === activeConnectionDragOperation.sourceStepId &&
                            (activeConnectionDragOperation.sourceSubStepOriginContext
                                ? conn.originatingSubStepContext?.subStepId === activeConnectionDragOperation.sourceSubStepOriginContext.subStepId
                                : !conn.originatingSubStepContext)
                        );

                        if (alreadyConnectedFromThisSource) {
                            toast({ variant: "default", title: "Already Connected", description: `Node "${targetStep.title}" is already connected from this specific source.` });
                            snapped = true;
                            break;
                        }

                        const newConnection: IncomingConnection = {
                            id: `conn-${uuidv4()}`,
                            lineType: 'straight',
                            sourceNodeId: activeConnectionDragOperation.sourceStepId!,
                            targetAnchor: targetAnchor,
                            originatingSubStepContext: activeConnectionDragOperation.sourceSubStepOriginContext
                                ? {
                                    sourceCardId: activeConnectionDragOperation.sourceStepId!,
                                    subStepId: activeConnectionDragOperation.sourceSubStepOriginContext.subStepId,
                                  }
                                : null,
                        };

                        setEditableRoadmap(prev => prev.map(step => {
                            if (step.id === targetStep.id) {
                                return {
                                    ...step,
                                    incomingConnections: [...(step.incomingConnections || []), newConnection]
                                };
                            }
                            return step;
                        }));
                        toast({ title: "Nodes Connected", description: "Connection created. Remember to save."});
                        snapped = true;
                        break;
                    }
                }
                if (snapped) break;
            }
        }
        clickStartInfoRef.current = null;
        setActiveConnectionDragOperation({ isDragging: false, sourceStepId: null, sourceAnchor: null, sourceSubStepOriginContext: null, startX: 0, startY: 0, currentX: 0, currentY: 0 });
    }
  }, [isOwner, toast, editableRoadmap, activeConnectionDragOperation]);


  const handleLineClick = (
    event: React.MouseEvent<SVGPathElement>,
    targetNodeId: string,
    connectionId: string
  ) => {
    if (!isOwner) return;
    event.preventDefault();
    event.stopPropagation();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    setLineContextMenu({
      isOpen: true,
      x: event.clientX - canvasRect.left,
      y: event.clientY - canvasRect.top,
      targetNodeId: targetNodeId,
      connectionId: connectionId,
    });
  };

  const handleDeleteLine = (targetNodeId: string, connectionId: string) => {
    setEditableRoadmap(prev =>
      prev.map(step => {
        if (step.id === targetNodeId) {
          return {
            ...step,
            incomingConnections: (step.incomingConnections || []).filter(conn => conn.id !== connectionId),
          };
        }
        return step;
      })
    );
    toast({ title: "Connection Removed", description: "Line deleted. Remember to save." });
    setLineContextMenu(null);
  };

  const handleSetSelectedLineType = (targetNodeId: string, connectionId: string, newLineType: 'straight' | 'curved' | 'acute') => {
    setEditableRoadmap(prev =>
      prev.map(step => {
        if (step.id === targetNodeId) {
          return {
            ...step,
            incomingConnections: (step.incomingConnections || []).map(conn =>
              conn.id === connectionId ? { ...conn, lineType: newLineType } : conn
            ),
          };
        }
        return step;
      })
    );
    toast({ title: "Line Type Set", description: `Line type changed to ${newLineType}. Remember to save.` });
    setLineContextMenu(null);
  };

  const handleOpenSetLineLabelDialog = () => {
    if (lineContextMenu) {
      const targetNode = editableRoadmap.find(s => s.id === lineContextMenu.targetNodeId);
      const connection = targetNode?.incomingConnections?.find(c => c.id === lineContextMenu.connectionId);
      setCurrentLineEditLabel(connection?.label || "");
      setIsLineEditLabelAlertOpen(true);
    }
  };

  const handleConfirmSetLineLabel = () => {
    if (lineContextMenu) {
      setEditableRoadmap(prev =>
        prev.map(step => {
          if (step.id === lineContextMenu.targetNodeId) {
            return {
              ...step,
              incomingConnections: (step.incomingConnections || []).map(conn =>
                conn.id === lineContextMenu.connectionId ? { ...conn, label: currentLineEditLabel.trim() || undefined } : conn
              ),
            };
          }
          return step;
        })
      );
      toast({ title: "Line Label Set", description: "Label updated. Remember to save." });
    }
    setIsLineEditLabelAlertOpen(false);
    setLineContextMenu(null);
    setCurrentLineEditLabel("");
  };

  const getAnchorAxisVector = (anchor: 'N' | 'S' | 'E' | 'W'): { x: number, y: number } => {
    switch (anchor) {
      case 'N': return { x: 0, y: -1 };
      case 'S': return { x: 0, y: 1 };
      case 'E': return { x: 1, y: 0 };
      case 'W': return { x: -1, y: 0 };
      default: return { x: 0, y: 0 }; // Should not happen
    }
  };

  const drawConnectionLines = () => {
    return editableRoadmap.flatMap(targetStep => {
      if (!targetStep.incomingConnections || targetStep.incomingConnections.length === 0) return [];

      return targetStep.incomingConnections.map((incomingConn) => {
        if (!incomingConn.id || !incomingConn.sourceNodeId) return null;
        const sourceNode = editableRoadmap.find(s => s.id === incomingConn.sourceNodeId);
        if (!sourceNode) return null;

        let rawStartPoint: { x: number, y: number };
        let sourceVisualAnchor: 'N' | 'S' | 'E' | 'W';

        if (incomingConn.originatingSubStepContext && incomingConn.originatingSubStepContext.sourceCardId === sourceNode.id) {
          rawStartPoint = getSubStepDotAnchorPoint(sourceNode, incomingConn.originatingSubStepContext.subStepId);
          sourceVisualAnchor = 'W'; 
        } else {
          const tempRawEndPoint = getAnchorPoint(targetStep, incomingConn.targetAnchor);
          let bestAnchor: 'N' | 'S' | 'E' | 'W' = 'S';
          let minDistanceSq = Infinity;
          (['N', 'S', 'E', 'W'] as const).forEach(anchor => {
            if ((sourceNode.subSteps && sourceNode.subSteps.length > 0) && anchor === 'W') return; // Skip West if sub-steps exist
            const tempRawStart = getAnchorPoint(sourceNode, anchor);
            const distSq = Math.pow(tempRawEndPoint.x - tempRawStart.x, 2) + Math.pow(tempRawEndPoint.y - tempRawStart.y, 2);
            if (distSq < minDistanceSq) {
              minDistanceSq = distSq;
              bestAnchor = anchor;
            }
          });
          sourceVisualAnchor = bestAnchor;
          rawStartPoint = getAnchorPoint(sourceNode, sourceVisualAnchor);
        }

        const rawEndPoint = getAnchorPoint(targetStep, incomingConn.targetAnchor);
        const targetVisualAnchor = incomingConn.targetAnchor;

        const sourceAxisVec = getAnchorAxisVector(sourceVisualAnchor);
        const targetAxisVec = getAnchorAxisVector(targetVisualAnchor);

        const lineStartPoint = { x: rawStartPoint.x + sourceAxisVec.x * START_OFFSET_FROM_DOT, y: rawStartPoint.y + sourceAxisVec.y * START_OFFSET_FROM_DOT };
        const lineEndPointForArrow = { x: rawEndPoint.x - targetAxisVec.x * ARROWHEAD_LENGTH, y: rawEndPoint.y - targetAxisVec.y * ARROWHEAD_LENGTH };
        
        const overallDistance = Math.sqrt(Math.pow(rawEndPoint.x - rawStartPoint.x, 2) + Math.pow(rawEndPoint.y - rawStartPoint.y, 2));
        const isTooShortForNecks = overallDistance < START_OFFSET_FROM_DOT + (NECK_LENGTH * 2) + MIN_MAIN_PATH_LENGTH + ARROWHEAD_LENGTH;

        let pathData = "";
        const lineType = incomingConn.lineType || 'straight';
        
        if (isTooShortForNecks && (lineType === 'curved' || lineType === 'acute')) {
            pathData = `M ${lineStartPoint.x} ${lineStartPoint.y} L ${lineEndPointForArrow.x} ${lineEndPointForArrow.y}`;
        } else {
            switch (lineType) {
                case 'straight':
                    pathData = `M ${lineStartPoint.x} ${lineStartPoint.y} L ${lineEndPointForArrow.x} ${lineEndPointForArrow.y}`;
                    break;
                case 'curved':
                    const neck1EndCurved = { x: lineStartPoint.x + sourceAxisVec.x * NECK_LENGTH, y: lineStartPoint.y + sourceAxisVec.y * NECK_LENGTH };
                    const neck2StartCurved = { x: lineEndPointForArrow.x - targetAxisVec.x * NECK_LENGTH, y: lineEndPointForArrow.y - targetAxisVec.y * NECK_LENGTH };
                    const curveMidX = (neck1EndCurved.x + neck2StartCurved.x) / 2;
                    const curveMidY = (neck1EndCurved.y + neck2StartCurved.y) / 2;
                    const controlDx = -(neck2StartCurved.y - neck1EndCurved.y); 
                    const controlDy = neck2StartCurved.x - neck1EndCurved.x;
                    const curveSegmentLength = Math.sqrt(Math.pow(neck2StartCurved.x - neck1EndCurved.x, 2) + Math.pow(neck2StartCurved.y - neck1EndCurved.y, 2));
                    const curveFactor = 0.25; 
                    const controlX = curveSegmentLength === 0 ? curveMidX : curveMidX + (controlDx / curveSegmentLength) * curveSegmentLength * curveFactor;
                    const controlY = curveSegmentLength === 0 ? curveMidY : curveMidY + (controlDy / curveSegmentLength) * curveSegmentLength * curveFactor;
                    pathData = `M ${lineStartPoint.x} ${lineStartPoint.y} L ${neck1EndCurved.x} ${neck1EndCurved.y} Q ${controlX} ${controlY}, ${neck2StartCurved.x} ${neck2StartCurved.y} L ${lineEndPointForArrow.x} ${lineEndPointForArrow.y}`;
                    break;
                case 'acute':
                    const neck1EndAcute = { x: lineStartPoint.x + sourceAxisVec.x * NECK_LENGTH, y: lineStartPoint.y + sourceAxisVec.y * NECK_LENGTH };
                    const neck2StartAcute = { x: lineEndPointForArrow.x - targetAxisVec.x * NECK_LENGTH, y: lineEndPointForArrow.y - targetAxisVec.y * NECK_LENGTH };
                    const deltaX_elbow = neck2StartAcute.x - neck1EndAcute.x;
                    const deltaY_elbow = neck2StartAcute.y - neck1EndAcute.y;
                    pathData = `M ${lineStartPoint.x} ${lineStartPoint.y} L ${neck1EndAcute.x} ${neck1EndAcute.y}`;
                    if (Math.abs(deltaX_elbow) >= Math.abs(deltaY_elbow)) {
                        pathData += ` L ${neck1EndAcute.x + deltaX_elbow / 2} ${neck1EndAcute.y}`;
                        pathData += ` L ${neck1EndAcute.x + deltaX_elbow / 2} ${neck2StartAcute.y}`;
                    } else {
                        pathData += ` L ${neck1EndAcute.x} ${neck1EndAcute.y + deltaY_elbow / 2}`;
                        pathData += ` L ${neck2StartAcute.x} ${neck1EndAcute.y + deltaY_elbow / 2}`;
                    }
                    pathData += ` L ${neck2StartAcute.x} ${neck2StartAcute.y}`;
                    pathData += ` L ${lineEndPointForArrow.x} ${lineEndPointForArrow.y}`;
                    break;
                default:
                    pathData = `M ${lineStartPoint.x} ${lineStartPoint.y} L ${lineEndPointForArrow.x} ${lineEndPointForArrow.y}`;
            }
        }
        
        const labelMidX = (rawStartPoint.x + rawEndPoint.x) / 2;
        const labelMidY = (rawStartPoint.y + rawEndPoint.y) / 2;

        return (
          <g key={incomingConn.id}>
            <path
              d={pathData}
              stroke="transparent"
              strokeWidth={CONNECTION_LINE_THICKNESS + 12} // Wider invisible path for easier clicking
              fill="none"
              className="cursor-pointer"
              onClick={(e) => handleLineClick(e, targetStep.id, incomingConn.id!)}
              style={{pointerEvents: "stroke"}}
            />
            <path
              d={pathData}
              stroke={CONNECTION_LINE_COLOR}
              strokeWidth={CONNECTION_LINE_THICKNESS}
              fill="none"
              markerEnd="url(#arrowhead)"
              style={{pointerEvents: "none"}} // Ensure visible line doesn't block click on transparent one
            />
            {incomingConn.label && (
              <text
                x={labelMidX}
                y={labelMidY}
                fill="hsl(var(--foreground))"
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none select-none"
              >
                {incomingConn.label}
              </text>
            )}
          </g>
        );
      });
    }).filter(path => path !== null);
  };


  const handleEditStep = useCallback((stepToEdit: RoadmapStep) => {
    setEditingStep(stepToEdit);
    setIsStepDetailSheetOpen(true);
  }, []);

  const handleStepDetailUpdate = (updatedStep: RoadmapStep) => {
    setEditableRoadmap(prev => prev.map(s => s.id === updatedStep.id ? updatedStep : s));
    toast({ title: "Step Updated", description: `"${updatedStep.title}" details changed. Remember to save.`});
  };

  const handleAddSubStepToParent = useCallback((parentStepId: string, parentStepTitle: string) => {
    setEditingStep(editableRoadmap.find(s => s.id === parentStepId) || null);
    setIsStepDetailSheetOpen(true);
  }, [editableRoadmap]);

  const handleDeleteStep = useCallback((stepId: string, stepTitle: string) => {
    setStepToDelete({id: stepId, title: stepTitle});
  }, []);

  const confirmDeleteStep = useCallback(() => {
    if (!stepToDelete) return;
    setEditableRoadmap(prev =>
        prev.filter(s => s.id !== stepToDelete.id)
            .map(s => ({
                ...s,
                incomingConnections: (s.incomingConnections || []).filter(
                    conn => conn.sourceNodeId !== stepToDelete.id
                ),
            }))
    );
    toast({ title: "Step Deleted", description: `"${stepToDelete.title}" removed from plan. Save to persist.`});
    setStepToDelete(null);
  }, [stepToDelete, toast]);

  const confirmDeleteConnection = useCallback(() => {
    if (!connectionToDeleteInfo) return;
    setEditableRoadmap(prev =>
      prev.map(step => {
        if (step.id === connectionToDeleteInfo.parentNodeId) {
          return {
            ...step,
            incomingConnections: (step.incomingConnections || []).filter(
              conn => conn.id !== connectionToDeleteInfo.connectionToActuallyDelete.id
            ),
          };
        }
        return step;
      })
    );
    toast({ title: "Connection Removed", description: "The connection line has been deleted. Save your plan to persist changes." });
    setConnectionToDeleteInfo(null);
  }, [connectionToDeleteInfo, toast]);


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
            <Button variant="outline" size="sm" className="h-8" onClick={() => handleAddNewNodeClick()} disabled={saveRoadmapMutation.isPending}>
              <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">+ Node</span>
              <span className="sm:hidden">+</span>
            </Button>
          )}
          {isOwner && (
            <Button variant="default" size="sm" className="h-8" onClick={saveRoadmapChanges} disabled={saveRoadmapMutation.isPending}>
              {saveRoadmapMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
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
          onMouseLeave={handleCanvasMouseUpOrLeave}
          onClick={() => { if (lineContextMenu?.isOpen) setLineContextMenu(null); }}
        >
           <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-0">
             <defs>
                <marker id="arrowhead" markerWidth={ARROWHEAD_LENGTH} markerHeight={ARROWHEAD_LENGTH * 0.7} refX={ARROWHEAD_LENGTH} refY={ARROWHEAD_LENGTH * 0.35} orient="auto" markerUnits="userSpaceOnUse">
                    <polygon points={`0 0, ${ARROWHEAD_LENGTH} ${ARROWHEAD_LENGTH * 0.35}, 0 ${ARROWHEAD_LENGTH * 0.7}`} fill={CONNECTION_LINE_COLOR} />
                </marker>
             </defs>
             {drawConnectionLines()}
             {activeConnectionDragOperation.isDragging && activeConnectionDragOperation.sourceStepId && (
                <line
                    x1={activeConnectionDragOperation.startX}
                    y1={activeConnectionDragOperation.startY}
                    x2={activeConnectionDragOperation.currentX}
                    y2={activeConnectionDragOperation.currentY}
                    stroke={CONNECTION_LINE_HOVER_COLOR}
                    strokeWidth={CONNECTION_LINE_THICKNESS + 1}
                    strokeDasharray="4 4"
                />
             )}
           </svg>
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
            <RoadmapStepCard
              key={step.id}
              step={step}
              onNodeMouseDown={handleNodeMouseDown}
              onConnectionDotInteraction={handleConnectionDotInteraction}
              isSelected={editingStep?.id === step.id || pendingNodeFromDotInfo?.sourceStepId === step.id || connectionToDeleteInfo?.parentNodeId === step.id}
              isSubmitting={saveRoadmapMutation.isPending}
              onEditStep={handleEditStep}
              onDeleteStep={handleDeleteStep}
              onAddSubStep={handleAddSubStepToParent}
              isDragging={draggingNodeInfo?.nodeId === step.id}
            />
          ))}

          <Popover open={lineContextMenu?.isOpen || false} onOpenChange={(open) => { if (!open) setLineContextMenu(null); }}>
            <PopoverTrigger asChild>
              <div
                className="fixed"
                style={{
                  left: `${lineContextMenu?.x || 0}px`,
                  top: `${lineContextMenu?.y || 0}px`,
                  width: 0, height: 0,
                }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1" side="right" align="start" sideOffset={5}>
              {lineContextMenu && isOwner && (
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => handleDeleteLine(lineContextMenu.targetNodeId, lineContextMenu.connectionId)}>
                    <MinusCircle className="mr-2 h-3.5 w-3.5 text-destructive"/> Delete Line
                  </Button>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                       <Button variant="ghost" size="sm" className="justify-start text-xs">
                         <TypeIcon className="mr-2 h-3.5 w-3.5"/> Set Line Type
                       </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent side="right" align="start" sideOffset={5} className="w-40">
                          <DropdownMenuItem onClick={() => handleSetSelectedLineType(lineContextMenu.targetNodeId, lineContextMenu.connectionId, 'straight')}>Straight</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSetSelectedLineType(lineContextMenu.targetNodeId, lineContextMenu.connectionId, 'curved')}>Curved</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSetSelectedLineType(lineContextMenu.targetNodeId, lineContextMenu.connectionId, 'acute')}>Acute (Elbow)</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={handleOpenSetLineLabelDialog}>
                    <LineLabelIcon className="mr-2 h-3.5 w-3.5"/> Add/Edit Label
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

        </main>
      </div>
      <AddRoadmapStepDialog
        isOpen={isAddStepDialogOpen}
        onOpenChange={setIsAddStepDialogOpen}
        onSubmit={handleAddRoadmapStepSubmit}
        isSubmitting={saveRoadmapMutation.isPending}
        parentStepTitle={pendingNodeFromDotInfo?.sourceStepId ? editableRoadmap.find(s => s.id === pendingNodeFromDotInfo.sourceStepId)?.title : null}
        dialogTitle={pendingNodeFromDotInfo?.creatingFromSubStepTitle ? `New Main Step from "${pendingNodeFromDotInfo.creatingFromSubStepTitle}" (Anchor: ${pendingNodeFromDotInfo.sourceAnchor})` : undefined}
      />
      <Sheet open={isStepDetailSheetOpen} onOpenChange={(open) => { if (!open) setEditingStep(null); setIsStepDetailSheetOpen(open); }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Step: {editingStep?.title}</SheetTitle>
            <SheetDescription>
              Modify the details of this roadmap step.
            </SheetDescription>
          </SheetHeader>
          {editingStep && (
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="sheet-step-title">Title</Label>
                <Input
                  id="sheet-step-title"
                  value={editingStep.title}
                  onChange={(e) => setEditingStep(prev => prev ? { ...prev, title: e.target.value } : null)}
                  disabled={saveRoadmapMutation.isPending}
                />
              </div>
              <div>
                <Label htmlFor="sheet-step-description">Description</Label>
                <Textarea
                  id="sheet-step-description"
                  value={editingStep.description || ""}
                  onChange={(e) => setEditingStep(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={4}
                  disabled={saveRoadmapMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label>Sub-steps</Label>
                {editingStep.subSteps && editingStep.subSteps.length > 0 && (
                  <ul className="space-y-1">
                    {editingStep.subSteps.map((sub, index) => (
                      <li key={sub.id} className="flex items-center gap-2 text-xs">
                        <Input
                          value={sub.title}
                          onChange={(e) => {
                            const newSubSteps = [...(editingStep.subSteps || [])];
                            newSubSteps[index] = { ...newSubSteps[index], title: e.target.value };
                            setEditingStep(prev => prev ? { ...prev, subSteps: newSubSteps } : null);
                          }}
                          className="flex-grow h-7 text-xs"
                          disabled={saveRoadmapMutation.isPending}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-1 text-destructive hover:text-destructive"
                          onClick={() => {
                            const newSubSteps = (editingStep.subSteps || []).filter((_, i) => i !== index);
                            setEditingStep(prev => prev ? { ...prev, subSteps: newSubSteps } : null);
                          }}
                          disabled={saveRoadmapMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    if (!editingStep) return;
                    const newSubStep: RoadmapSubStep = {
                      id: `sub-${Date.now()}-${uuidv4().substring(0,6)}`,
                      parentId: editingStep.id,
                      title: "New Sub-step"
                    };
                    setEditingStep(prev => prev ? { ...prev, subSteps: [...(prev.subSteps || []), newSubStep] } : null);
                  }}
                  disabled={saveRoadmapMutation.isPending}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Sub-step
                </Button>
              </div>
            </div>
          )}
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline" disabled={saveRoadmapMutation.isPending}>Cancel</Button>
            </SheetClose>
            <Button
              type="button"
              onClick={() => {
                if (editingStep) {
                  handleStepDetailUpdate(editingStep);
                  setIsStepDetailSheetOpen(false);
                  setEditingStep(null);
                }
              }}
              disabled={saveRoadmapMutation.isPending || !editingStep}
            >
              {saveRoadmapMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
       <AlertDialog open={!!stepToDelete} onOpenChange={(open) => !open && setStepToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Step: "{stepToDelete?.title}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this step? All its sub-steps and connections to it will also be removed. This action cannot be undone easily.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStepToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteStep} className="bg-destructive hover:bg-destructive/90">
                Delete Step
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      <AlertDialog open={!!connectionToDeleteInfo} onOpenChange={(open) => !open && setConnectionToDeleteInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the connection to this step
              {connectionToDeleteInfo?.connectionToActuallyDelete?.sourceNodeId &&
                ` from "${editableRoadmap.find(s => s.id === connectionToDeleteInfo.connectionToActuallyDelete.sourceNodeId)?.title || 'another step'}"`}
              ? This action cannot be undone easily.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConnectionToDeleteInfo(null)} disabled={saveRoadmapMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteConnection} className="bg-destructive hover:bg-destructive/90" disabled={saveRoadmapMutation.isPending}>
              {saveRoadmapMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Connection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isLineEditLabelAlertOpen} onOpenChange={setIsLineEditLabelAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Line Label</AlertDialogTitle>
              <AlertDialogDescription>
                Enter a label for this connection line. Leave empty to remove the label.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Label htmlFor="line-label-input" className="sr-only">Line Label</Label>
              <Input
                id="line-label-input"
                ref={lineLabelInputRef}
                value={currentLineEditLabel}
                onChange={(e) => setCurrentLineEditLabel(e.target.value)}
                placeholder="E.g., Depends on, Blocks"
                autoFocus
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsLineEditLabelAlertOpen(false); setCurrentLineEditLabel(""); setLineContextMenu(null); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmSetLineLabel}>Set Label</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

