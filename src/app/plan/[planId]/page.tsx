
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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

import { getPlanById, updatePlanRoadmap } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep, NewPlanData, UpdatePlanRoadmapData } from '@/types/plan';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn, IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
// Removed: import { RoadmapNodeCard } from '@/components/plan/RoadmapNodeCard';
import { AddRoadmapStepDialog, type AddRoadmapStepFormData } from '@/components/plan/AddRoadmapStepDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';


const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220; // Base width for a node
const NODE_BASE_MIN_HEIGHT = 100; // Base min-height
const NODE_HEADER_HEIGHT = 40; // Approx height of header
const SUBSTEP_ITEM_HEIGHT = 24; // Approx height of a sub-step list item
const NODE_CONTENT_PADDING_Y = 16; // Py-2 for content = 8px top + 8px bottom
const NODE_FOOTER_HEIGHT = 44; // Approx height of footer if present

const DOT_SIZE = 12;
const DOT_OFFSET = -(DOT_SIZE / 2);
const CONNECTION_LINE_COLOR = "hsl(var(--border))";
const CONNECTION_LINE_HOVER_COLOR = "hsl(var(--primary))";
const CONNECTION_LINE_THICKNESS = 2;

const SUBSTEP_DOT_SIZE = 10; // Slightly smaller for sub-steps
const SUBSTEP_DOT_OFFSET = -(SUBSTEP_DOT_SIZE / 2);


// Helper function to calculate dynamic height of a node
const calculateNodeHeight = (step: RoadmapStep): number => {
  let height = NODE_BASE_MIN_HEIGHT;
  height = Math.max(height, NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y); // Ensure base height covers header and padding

  if (step.description && step.description.trim().length > 0) {
    const lineCount = (step.description.match(/\n/g) || []).length + 1;
    height = Math.max(height, NODE_HEADER_HEIGHT + (lineCount * 15) + NODE_CONTENT_PADDING_Y); // Rough estimate for description lines
  }
  if (step.subSteps && step.subSteps.length > 0) {
    height = Math.max(height, NODE_HEADER_HEIGHT + (step.subSteps.length * SUBSTEP_ITEM_HEIGHT) + NODE_CONTENT_PADDING_Y + 10); // Add some space for sub-steps list
  }
  // Add footer height if applicable (e.g., for action buttons)
  // height += NODE_FOOTER_HEIGHT; 
  return height;
};


interface RoadmapStepCardProps {
  step: RoadmapStep;
  onNodeMouseDown: (stepId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  onConnectionDotInteraction: (
    parentStepId: string,
    anchor: 'N' | 'S' | 'E' | 'W',
    interactionType: 'down' | 'up',
    event: React.MouseEvent<HTMLButtonElement>,
    subStepOriginContext?: { subStepId: string; subStepTitle: string; dotElementRef: React.RefObject<HTMLButtonElement> }
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
    subStepOriginContext?: { subStepId: string; subStepTitle: string; dotElementRef: React.RefObject<HTMLButtonElement> };
  }> = ({ anchor, parentStepId, isSubmitting, style, className, subStepOriginContext }) => {
    const dotButtonRef = useRef<HTMLButtonElement>(null);
    return (
      <button
        ref={dotButtonRef}
        aria-label={`Connect from ${anchor} anchor of step ${step.title}`}
        className={cn(
          "absolute rounded-full border-2 border-primary bg-background transition-colors duration-150 hover:bg-primary/20 z-10",
          isSubmitting && "cursor-not-allowed opacity-50",
          className
        )}
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          ...style
        }}
        onMouseDown={(e) => {
          if (isSubmitting) return;
          e.stopPropagation(); // Prevent card drag
          onConnectionDotInteraction(parentStepId, anchor, 'down', e, subStepOriginContext ? {...subStepOriginContext, dotElementRef: dotButtonRef } : undefined);
        }}
        onMouseUp={(e) => {
           if (isSubmitting) return;
           e.stopPropagation();
           onConnectionDotInteraction(parentStepId, anchor, 'up', e, subStepOriginContext ? {...subStepOriginContext, dotElementRef: dotButtonRef } : undefined);
        }}
        disabled={isSubmitting}
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
        minHeight: `${dynamicHeight}px`, // Use dynamic height
        touchAction: 'none',
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
      <div className="p-2 text-xs text-muted-foreground flex-grow min-h-0 overflow-y-auto">
        {step.description && (
          <p className="whitespace-pre-wrap line-clamp-3 mb-1.5">{step.description}</p>
        )}
        {step.subSteps && step.subSteps.length > 0 && (
          <ul className="space-y-1 list-none p-0 m-0">
            {step.subSteps.map((subStep) => {
                const subStepDotButtonRef = useRef<HTMLButtonElement>(null);
                return (
                  <li key={subStep.id} className="text-xs text-muted-foreground/90 flex items-center relative pl-4 py-0.5 group/substep">
                    {/* Sub-step Connection Dot - Now on the Left */}
                    <button
                        ref={subStepDotButtonRef}
                        aria-label={`Connect from sub-step ${subStep.title}`}
                        className={cn(
                          "absolute rounded-full border-2 border-primary bg-background transition-all duration-150 z-10",
                          "cursor-pointer hover:scale-125 hover:bg-green-500 hover:border-green-700", // Added hover effects
                          isSubmitting && "cursor-not-allowed opacity-50"
                        )}
                        style={{
                          width: DOT_SIZE,
                          height: DOT_SIZE,
                          left: DOT_OFFSET, // Position on the left
                          top: `calc(50% - ${DOT_SIZE / 2}px)`, // Vertically center
                        }}
                        onMouseDown={(e) => {
                          if (isSubmitting) return;
                          e.stopPropagation();
                          onConnectionDotInteraction(step.id, 'E', 'down', e, { subStepId: subStep.id, subStepTitle: subStep.title, dotElementRef: subStepDotButtonRef });
                        }}
                        onMouseUp={(e) => {
                          if (isSubmitting) return;
                          e.stopPropagation();
                          onConnectionDotInteraction(step.id, 'E', 'up', e, { subStepId: subStep.id, subStepTitle: subStep.title, dotElementRef: subStepDotButtonRef });
                        }}
                        disabled={isSubmitting}
                    />
                    <span className="truncate flex-grow" title={subStep.title}>{subStep.title}</span>
                    {/* Placeholder for sub-step specific actions if needed in future */}
                    {/* <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 opacity-0 group-hover/substep:opacity-100 ml-auto"><MoreVertical className="h-3 w-3"/></Button> */}
                  </li>
                );
            })}
          </ul>
        )}
        {(!step.description || step.description.trim().length === 0) && (!step.subSteps || step.subSteps.length === 0) && (
          <p className="italic text-muted-foreground/70 text-center py-2 text-[11px]">No details or sub-steps yet.</p>
        )}
      </div>

      {/* Main Connection Dots */}
      <ConnectionDot anchor="N" parentStepId={step.id} isSubmitting={isSubmitting} style={{ top: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE / 2}px)` }} />
      <ConnectionDot anchor="S" parentStepId={step.id} isSubmitting={isSubmitting} style={{ bottom: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE / 2}px)` }} />
      <ConnectionDot anchor="E" parentStepId={step.id} isSubmitting={isSubmitting} style={{ right: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE / 2}px)` }} />
      <ConnectionDot anchor="W" parentStepId={step.id} isSubmitting={isSubmitting} style={{ left: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE / 2}px)` }} />
    </div>
  );
});
RoadmapStepCard.displayName = "RoadmapStepCard";


// Type for storing drag operation state for main nodes
interface DraggingNodeInfo {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

// Type for storing information about a connection drag operation
interface ConnectionDragStateType {
  isDragging: boolean;
  sourceStepId: string | null;
  sourceAnchor: 'N' | 'S' | 'E' | 'W' | null;
  sourceSubStepOriginContext?: { subStepId: string; subStepTitle: string; dotElementRef: React.RefObject<HTMLButtonElement> } | null; // For visual start of line
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// Type for storing info about the click that might initiate node creation
interface ClickStartInfoType {
  parentStepId: string | null;
  anchor: 'N' | 'S' | 'E' | 'W' | null;
  subStepOriginContext?: { subStepId: string; subStepTitle: string; dotElementRef: React.RefObject<HTMLButtonElement> } | null;
  clientX: number;
  clientY: number;
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

  const [canvasMinHeight, setCanvasMinHeight] = useState<number | string>('100vh');
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

  const [activeConnectionDragOperation, setActiveConnectionDragOperation] = useState<ConnectionDragStateType>({
    isDragging: false, sourceStepId: null, sourceAnchor: null, sourceSubStepOriginContext: null, startX: 0, startY: 0, currentX: 0, currentY: 0
  });
  const clickStartInfoRef = useRef<ClickStartInfoType | null>(null);


  const isValidPlanId = useMemo(() => !!planId && (IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20), [planId]);

  const { data: planData, isLoading: isLoadingPlan, error: planError, refetch: refetchPlanData } = useQuery<ClientPlan | null>({
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

    const newStepBase: Omit<RoadmapStep, 'id' | 'x' | 'y' | 'subSteps'> = {
      title: data.title,
      description: null,
    };
    
    let newStepX = 100;
    let newStepY = 100;

    if (pendingNodeFromDotInfo && pendingNodeFromDotInfo.sourceStepId) {
      const sourceNode = editableRoadmap.find(s => s.id === pendingNodeFromDotInfo.sourceStepId);
      if (sourceNode) {
        const sourceNodeHeight = calculateNodeHeight(sourceNode);
        const sourceNodeWidth = NODE_BASE_WIDTH;
        const spacing = 50; // Spacing between nodes

        switch(pendingNodeFromDotInfo.sourceAnchor) {
          case 'N':
            newStepX = sourceNode.x + (sourceNodeWidth / 2) - (NODE_BASE_WIDTH / 2);
            newStepY = sourceNode.y - calculateNodeHeight(newStepBase as RoadmapStep) - spacing;
            break;
          case 'S':
            newStepX = sourceNode.x + (sourceNodeWidth / 2) - (NODE_BASE_WIDTH / 2);
            newStepY = sourceNode.y + sourceNodeHeight + spacing;
            break;
          case 'E':
            newStepX = sourceNode.x + sourceNodeWidth + spacing;
            newStepY = sourceNode.y + (sourceNodeHeight / 2) - (calculateNodeHeight(newStepBase as RoadmapStep) / 2);
            break;
          case 'W':
            newStepX = sourceNode.x - NODE_BASE_WIDTH - spacing;
            newStepY = sourceNode.y + (sourceNodeHeight / 2) - (calculateNodeHeight(newStepBase as RoadmapStep) / 2);
            break;
        }
        newStepBase.sourceNodeId = pendingNodeFromDotInfo.sourceStepId;
        newStepBase.sourceAnchor = pendingNodeFromDotInfo.sourceAnchor === 'N' ? 'S' : pendingNodeFromDotInfo.sourceAnchor === 'S' ? 'N' : pendingNodeFromDotInfo.sourceAnchor === 'E' ? 'W' : 'E';
        
        if (pendingNodeFromDotInfo.creatingFromSubStepId) {
          newStepBase.originatingSubStepInfo = {
            sourceCardId: pendingNodeFromDotInfo.sourceStepId,
            subStepId: pendingNodeFromDotInfo.creatingFromSubStepId,
          };
          // For sub-step origins, always connect from East of parent to West of new node
          newStepBase.sourceNodeId = pendingNodeFromDotInfo.sourceStepId;
          newStepBase.sourceAnchor = 'W'; // New node's West anchor connects to parent's East

          // Adjust positioning to be East of parent, aligned with where the sub-step might have been
           const subStepDotYOffset = 0; // Placeholder: In a real scenario, you might pass Y offset of sub-step dot
           newStepX = sourceNode.x + sourceNodeWidth + spacing;
           newStepY = sourceNode.y + subStepDotYOffset - (calculateNodeHeight(newStepBase as RoadmapStep) / 2);

        } else {
          newStepBase.originatingSubStepInfo = null;
        }
      }
    } else if (canvasRef.current) {
        newStepX = canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2;
        newStepY = canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - calculateNodeHeight(newStepBase as RoadmapStep) / 2;
    }
    
    newStepX = Math.max(0, newStepX);
    newStepY = Math.max(0, newStepY);

    const newNode: RoadmapStep = {
      ...newStepBase,
      id: `step-${Date.now()}-${uuidv4().substring(0, 8)}`,
      x: newStepX,
      y: newStepY,
      subSteps: [],
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
      newX = Math.max(0, newX); // Ensure X is not negative
      newY = Math.max(0, newY); // Ensure Y is not negative

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


  const handleConnectionDotInteraction = useCallback((
    parentStepId: string,
    anchor: 'N' | 'S' | 'E' | 'W',
    interactionType: 'down' | 'up',
    event: React.MouseEvent<HTMLButtonElement>,
    subStepOriginContext?: { subStepId: string; subStepTitle: string; dotElementRef: React.RefObject<HTMLButtonElement> }
  ) => {
    if (!isOwner || !canvasRef.current) return;
    event.stopPropagation();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const dotElement = event.currentTarget;
    const dotRect = dotElement.getBoundingClientRect();

    const getDotCenter = (rect: DOMRect) => ({
        x: rect.left + rect.width / 2 - canvasRect.left + canvasRef.current!.scrollLeft,
        y: rect.top + rect.height / 2 - canvasRect.top + canvasRef.current!.scrollTop,
    });
    
    let sourceDotX: number, sourceDotY: number;
    if (subStepOriginContext && subStepOriginContext.dotElementRef.current) {
        const subDotRect = subStepOriginContext.dotElementRef.current.getBoundingClientRect();
        const subDotCenter = getDotCenter(subDotRect);
        sourceDotX = subDotCenter.x;
        sourceDotY = subDotCenter.y;
    } else {
        const mainDotCenter = getDotCenter(dotRect);
        sourceDotX = mainDotCenter.x;
        sourceDotY = mainDotCenter.y;
    }


    if (interactionType === 'down') {
      clickStartInfoRef.current = { parentStepId, anchor, clientX: event.clientX, clientY: event.clientY, subStepOriginContext };
      setActiveConnectionDragOperation({
        isDragging: true,
        sourceStepId: parentStepId,
        sourceAnchor: anchor, // This is the anchor on the sourceStepId card itself
        sourceSubStepOriginContext: subStepOriginContext, // Store if drag initiated from sub-step
        startX: sourceDotX,
        startY: sourceDotY,
        currentX: sourceDotX,
        currentY: sourceDotY,
      });
    } else if (interactionType === 'up' && clickStartInfoRef.current) {
        const dx = Math.abs(event.clientX - clickStartInfoRef.current.clientX);
        const dy = Math.abs(event.clientY - clickStartInfoRef.current.clientY);
        const isClick = dx < 5 && dy < 5; // Threshold for click vs drag

        if (isClick) {
            setPendingNodeFromDotInfo({
                sourceStepId: parentStepId,
                sourceAnchor: anchor,
                creatingFromSubStepId: subStepOriginContext?.subStepId,
                creatingFromSubStepTitle: subStepOriginContext?.subStepTitle
            });
            setIsAddStepDialogOpen(true);
        } else {
            // Handle drag-to-connect logic
            const targetElement = document.elementFromPoint(event.clientX, event.clientY);
            const targetNodeElement = targetElement?.closest('[data-node-id]');
            const targetNodeId = targetNodeElement?.getAttribute('data-node-id');
            const targetDotElement = targetElement?.closest('button[aria-label*="Connect from"]');
            
            let targetAnchor: 'N' | 'S' | 'E' | 'W' | null = null;
            if (targetDotElement) {
                const label = targetDotElement.getAttribute('aria-label');
                if (label?.includes("N anchor")) targetAnchor = 'N';
                else if (label?.includes("S anchor")) targetAnchor = 'S';
                else if (label?.includes("E anchor")) targetAnchor = 'E';
                else if (label?.includes("W anchor")) targetAnchor = 'W';
            }
            
            if (targetNodeId && targetNodeId !== parentStepId && targetAnchor && activeConnectionDragOperation.sourceStepId) {
                const sourceIdForConnection = parentStepId; // Always use parent card for connection
                const sourceAnchorForConnection = subStepOriginContext ? 'E' : activeConnectionDragOperation.sourceAnchor; // If from sub-step, parent's E edge

                setEditableRoadmap(prev => prev.map(step => {
                    if (step.id === targetNodeId) {
                        return { ...step, sourceNodeId: sourceIdForConnection, sourceAnchor: targetAnchor };
                    }
                    return step;
                }));
                toast({ title: "Nodes Connected", description: "Connection created. Remember to save."});
            }
        }
        clickStartInfoRef.current = null;
        setActiveConnectionDragOperation({ isDragging: false, sourceStepId: null, sourceAnchor: null, sourceSubStepOriginContext: null, startX: 0, startY: 0, currentX: 0, currentY: 0 });
    }
  }, [isOwner, activeConnectionDragOperation.sourceAnchor, activeConnectionDragOperation.sourceStepId, toast]);


  const getAnchorPoint = (step: RoadmapStep, anchor: 'N' | 'S' | 'E' | 'W') => {
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

  const drawConnectionLines = () => {
    return editableRoadmap.map(step => {
      if (step.sourceNodeId && step.sourceAnchor) {
        const sourceNode = editableRoadmap.find(s => s.id === step.sourceNodeId);
        if (!sourceNode) return null;

        let startPoint = getAnchorPoint(sourceNode, step.sourceAnchor === 'N' ? 'S' : step.sourceAnchor === 'S' ? 'N' : step.sourceAnchor === 'E' ? 'W' : 'E'); // Opposite for clarity
        let endPoint = getAnchorPoint(step, step.sourceAnchor);

        // If the source was a sub-step, adjust startPoint to parent's E edge conceptually
        if (step.originatingSubStepInfo && step.sourceNodeId === step.originatingSubStepInfo.sourceCardId) {
            startPoint = getAnchorPoint(sourceNode, 'E');
            // The target (step) anchor should be 'W' if created from sub-step E-dot
            endPoint = getAnchorPoint(step, 'W');
        } else {
             // Default connection logic: source's specified anchor to target's opposite anchor
             const oppositeTargetAnchor = step.sourceAnchor === 'N' ? 'S' : step.sourceAnchor === 'S' ? 'N' : step.sourceAnchor === 'E' ? 'W' : 'E';
             startPoint = getAnchorPoint(sourceNode, step.sourceAnchor);
             endPoint = getAnchorPoint(step, oppositeTargetAnchor);
        }

        const pathData = `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`;
        return (
          <path
            key={`${step.sourceNodeId}-${step.id}`}
            d={pathData}
            stroke={CONNECTION_LINE_COLOR}
            strokeWidth={CONNECTION_LINE_THICKNESS}
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        );
      }
      return null;
    });
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
    setPendingNodeFromDotInfo({ sourceStepId: parentStepId, sourceAnchor: 'E', creatingFromSubStepTitle: `Sub-step for ${parentStepTitle}` });
    setIsAddStepDialogOpen(true); // Re-use the add step dialog for sub-steps for now
  }, []);


  const handleDeleteStep = useCallback((stepId: string, stepTitle: string) => {
    setStepToDelete({id: stepId, title: stepTitle});
  }, []);

  const confirmDeleteStep = useCallback(() => {
    if (!stepToDelete) return;
    setEditableRoadmap(prev => prev.filter(s => s.id !== stepToDelete.id).map(s => {
        if (s.sourceNodeId === stepToDelete.id) {
            return { ...s, sourceNodeId: undefined, sourceAnchor: undefined };
        }
        return s;
    }));
    toast({ title: "Step Deleted", description: `"${stepToDelete.title}" removed from plan. Save to persist.`});
    setStepToDelete(null);
  }, [stepToDelete, toast]);


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
        >
           <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-0">
             <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={CONNECTION_LINE_COLOR} />
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
              isSelected={editingStep?.id === step.id || pendingNodeFromDotInfo?.sourceStepId === step.id}
              isSubmitting={saveRoadmapMutation.isPending}
              onEditStep={handleEditStep}
              onDeleteStep={handleDeleteStep}
              onAddSubStep={handleAddSubStepToParent}
              isDragging={draggingNodeInfo?.nodeId === step.id}
            />
          ))}
        </main>
      </div>
      <AddRoadmapStepDialog
        isOpen={isAddStepDialogOpen}
        onOpenChange={setIsAddStepDialogOpen}
        onSubmit={handleAddRoadmapStepSubmit}
        isSubmitting={saveRoadmapMutation.isPending}
        parentStepTitle={pendingNodeFromDotInfo?.sourceStepId ? editableRoadmap.find(s => s.id === pendingNodeFromDotInfo.sourceStepId)?.title : null}
        dialogTitle={pendingNodeFromDotInfo?.creatingFromSubStepTitle ? `New Main Step from "${pendingNodeFromDotInfo.creatingFromSubStepTitle}"` : undefined}
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
              {/* Sub-step management can be added here */}
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
    </div>
  );
}
