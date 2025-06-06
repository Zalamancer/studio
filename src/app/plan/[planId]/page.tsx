
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/ui/avatar';
import {
  Dialog as AddStepDialog, // Alias to avoid conflict if another Dialog is used
  DialogContent as AddStepDialogContent,
  DialogHeader as AddStepDialogHeader,
  DialogTitle as AddStepDialogTitle,
  DialogDescription as AddStepDialogDescription,
  DialogFooter as AddStepDialogFooter,
  DialogClose as AddStepDialogClose,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogPrimitiveTitle, // Renamed to avoid conflict with SheetTitle if used directly
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

import {
  Loader2,
  PlusCircle,
  GripVertical,
  Edit3,
  Trash2,
  Share2,
  Copy,
  Save,
  ChevronLeft,
  AlertTriangle,
  FileText,
  MousePointerClick,
  Move,
  Zap,
  Info,
  Map,
  Settings2,
  MoreVertical,
  Link as LinkIcon,
  Eye,
  MessageCircle,
  Users,
  ChevronsUpDown,
  ListChecks,
  ExternalLink,
  Puzzle
} from 'lucide-react';

import { getPlanById, updatePlanRoadmap } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep, UpdatePlanRoadmapData } from '@/types/plan';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn, IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import Link from 'next/link'; // For links to Discover page

// Component for Add/Edit Step Dialog (extracted or defined here)
import { AddRoadmapStepDialog, type AddRoadmapStepFormData } from '@/components/plan/AddRoadmapStepDialog';


const NODE_WIDTH = 256; // Default width of a step card (w-64)
const NODE_SPACING_X = 64; // Horizontal spacing between nodes
const NODE_SPACING_Y = 64; // Vertical spacing between nodes
const MIN_CANVAS_PADDING = 20; // Min padding around content on canvas

const CLICK_TIME_THRESHOLD_MS = 250; // Max time for a mousedown/mouseup to be a click
const CLICK_MOVE_THRESHOLD_PX = 5;  // Max mouse movement for a click

const DOT_SIZE = 12; // Diameter of connection dots
const DOT_OFFSET = -(DOT_SIZE / 2); // To center the dot on the edge

const SUBSTEP_DOT_SIZE = 10;
const SUBSTEP_DOT_OFFSET = -(SUBSTEP_DOT_SIZE / 2);


interface RoadmapStepCardProps {
  step: RoadmapStep;
  onAddSubStep: (event: React.MouseEvent, parentStepId: string, parentStepTitle: string) => void;
  onOpenDetails: (event: React.MouseEvent, step: RoadmapStep) => void;
  isSelected: boolean;
  isSubmitting: boolean;
  onMouseDownOnNode: (event: React.MouseEvent, stepId: string) => void;
  onDeleteNode: (stepId: string, stepTitle: string) => void;
  onConnectionDotInteraction: (
    event: React.MouseEvent,
    stepId: string,
    anchor: 'N' | 'S' | 'E' | 'W',
    actionType: 'down' | 'up',
    subStepOriginContext?: SubStepOriginContextType
  ) => void;
  isPotentialConnectionTarget: (stepId: string, anchor: 'N' | 'S' | 'E' | 'W') => boolean;
}
interface SubStepOriginContextType {
  parentStepId: string;
  subStepId: string;
  subStepTitle: string;
  dotElementRef: React.RefObject<HTMLButtonElement>;
}


const RoadmapStepCard: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  onAddSubStep,
  onOpenDetails,
  isSelected,
  isSubmitting,
  onMouseDownOnNode,
  onDeleteNode,
  onConnectionDotInteraction,
  isPotentialConnectionTarget,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const subStepDotRefs = useRef<Map<string, React.RefObject<HTMLButtonElement>>>(new Map());

  // Ensure refs are created for each sub-step dot
  step.subSteps?.forEach(subStep => {
    if (!subStepDotRefs.current.has(subStep.id)) {
      subStepDotRefs.current.set(subStep.id, React.createRef<HTMLButtonElement>());
    }
  });

  const handleNodeMouseDown = useCallback((e: React.MouseEvent) => {
    onMouseDownOnNode(e, step.id);
  }, [onMouseDownOnNode, step.id]);

  const handleAddSubStepClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAddSubStep(e, step.id, step.title);
  }, [onAddSubStep, step.id, step.title]);

  const handleOpenDetailsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenDetails(e, step);
  }, [onOpenDetails, step]);

  const handleDeleteNodeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteNode(step.id, step.title);
  }, [onDeleteNode, step.id, step.title]);

  const getStepHeight = (currentStep: RoadmapStep) => {
    let baseHeight = 40; // Approximate height of CardHeader
    baseHeight += 1; // border-t for CardContent
    let subStepsHeight = 0;
    if (currentStep.subSteps && currentStep.subSteps.length > 0) {
      subStepsHeight += 20; // "Sub-steps:" label
      subStepsHeight += 16 * currentStep.subSteps.length; // Height per sub-step (approximate)
      if (currentStep.subSteps.length > 1) {
        subStepsHeight += (currentStep.subSteps.length - 1) * 2; // space-y-0.5
      }
    }
    baseHeight += 6 + subStepsHeight + 10; // CardContent padding and inner spacing
    baseHeight += 1; // border-t for CardFooter
    baseHeight += 44; // Approximate height of CardFooter
    return Math.max(baseHeight, 102); // Min height
  };


  const ConnectionDot = React.forwardRef<
    HTMLButtonElement,
    {
      anchor: 'N' | 'S' | 'E' | 'W';
      isSubStepDot?: boolean;
      subStepContext?: SubStepOriginContextType;
    }
  >(({ anchor, isSubStepDot = false, subStepContext }, ref) => {
    const dotSize = isSubStepDot ? SUBSTEP_DOT_SIZE : DOT_SIZE;
    const dotOffset = isSubStepDot ? SUBSTEP_DOT_OFFSET : DOT_OFFSET;

    let positionStyles: React.CSSProperties = {};
    switch (anchor) {
      case 'N': positionStyles = { top: dotOffset, left: `calc(50% - ${dotSize / 2}px)` }; break;
      case 'S': positionStyles = { bottom: dotOffset, left: `calc(50% - ${dotSize / 2}px)` }; break;
      case 'E': positionStyles = { right: dotOffset, top: `calc(50% - ${dotSize / 2}px)` }; break;
      case 'W': positionStyles = { left: dotOffset, top: `calc(50% - ${dotSize / 2}px)` }; break;
    }
     if (isSubStepDot && anchor === 'E') { // Adjust for sub-step dot specific placement if needed
       positionStyles = { right: dotOffset, top: '50%', transform: 'translateY(-50%)' };
     }


    return (
      <Button
        ref={ref}
        variant="outline"
        size="icon"
        className={cn(
          "absolute rounded-full bg-background hover:bg-primary/10 border-primary text-primary z-30 cursor-grab active:cursor-grabbing",
          "transition-all duration-150 ease-in-out",
          isPotentialConnectionTarget(isSubStepDot && subStepContext ? subStepContext.parentStepId : step.id, anchor)
            ? "ring-2 ring-green-500 bg-green-200 border-green-500 scale-125"
            : "hover:scale-110"
        )}
        style={{
          width: dotSize,
          height: dotSize,
          padding: 0,
          ...positionStyles
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onConnectionDotInteraction(e, isSubStepDot && subStepContext ? subStepContext.parentStepId : step.id, anchor, 'down', subStepContext);
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          onConnectionDotInteraction(e, isSubStepDot && subStepContext ? subStepContext.parentStepId : step.id, anchor, 'up', subStepContext);
        }}
        title={`Drag to connect, or click to create new step from ${anchor === 'N' ? 'top' : anchor === 'S' ? 'bottom' : 'side'}`}
      >
        <PlusCircle className="h-3 w-3 opacity-70" />
      </Button>
    );
  });
  ConnectionDot.displayName = 'ConnectionDot';

  return (
    <div
      ref={cardRef}
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
        onMouseDown={handleNodeMouseDown}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground mr-1.5 flex-shrink-0 pointer-events-none" />
        <div className="flex-grow min-w-0 pointer-events-none">
          <CardTitle className="text-sm font-semibold truncate" title={step.title}>
            {step.title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-2.5 pt-1.5 border-t">
        {step.subSteps && step.subSteps.length > 0 && (
          <>
            <p className="text-xs font-medium mb-1 text-muted-foreground">Sub-steps:</p>
            <ul className="list-none space-y-0.5 ml-0">
              {step.subSteps.map(subStep => (
                <li key={subStep.id} className="relative flex items-center gap-1.5 text-xs pr-3"> {/* Added pr-3 for dot */}
                  <span className="text-muted-foreground truncate" title={subStep.title}>{subStep.title}</span>
                   {isSelected && !isSubmitting && (
                    <ConnectionDot
                        ref={subStepDotRefs.current.get(subStep.id)}
                        anchor="E"
                        isSubStepDot={true}
                        subStepContext={{
                            parentStepId: step.id,
                            subStepId: subStep.id,
                            subStepTitle: subStep.title,
                            dotElementRef: subStepDotRefs.current.get(subStep.id)!
                        }}
                    />
                   )}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
      <CardFooter className="p-2 border-t flex items-center justify-end gap-1.5 flex-shrink-0">
        <Button variant="outline" size="xs" onClick={handleAddSubStepClick} disabled={isSubmitting} className="text-xs h-7 px-2">
          <PlusCircle className="h-3 w-3 mr-1" /> Sub-step
        </Button>
        <Button variant="outline" size="xs" onClick={handleOpenDetailsClick} disabled={isSubmitting} className="text-xs h-7 px-2" title="Open Details">
          <Edit3 className="h-3.5 w-3.5 mr-1" /> Open
        </Button>
        <Button variant="ghost" size="xs" onClick={handleDeleteNodeClick} disabled={isSubmitting} className="text-xs h-7 px-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" title="Delete Step">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>

      {/* Connection Dots for Main Card */}
      {isSelected && !isSubmitting && (
        <>
          <ConnectionDot anchor="N" />
          <ConnectionDot anchor="S" />
          <ConnectionDot anchor="E" />
          {/* West dot removed based on previous logic step */}
        </>
      )}
    </div>
  );
});
RoadmapStepCard.displayName = "RoadmapStepCard";


const StepDetailSheet: React.FC<{
  step: RoadmapStep | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDescriptionChange: (stepId: string, description: string | null) => void;
  onTitleChange: (stepId: string, title: string) => void;
  isOwner: boolean;
}> = ({ step, isOpen, onOpenChange, onDescriptionChange, onTitleChange, isOwner }) => {
  const [description, setDescription] = useState(step?.description || "");
  const [title, setTitle] = useState(step?.title || "");

  useEffect(() => {
    if (step) {
      setTitle(step.title || "");
      setDescription(step.description || "");
    }
  }, [step]);

  if (!step) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col" side="right">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="truncate">Editing: {step.title}</SheetTitle>
          <SheetDescription>View or edit details for this roadmap step.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
                {isOwner ? (
                    <div>
                        <Label htmlFor={`step-title-input-${step.id}`} className="text-sm font-medium mb-1 block">Title</Label>
                        <Input
                            id={`step-title-input-${step.id}`}
                            value={title}
                            onChange={(e) => {
                                const newTitle = e.target.value;
                                setTitle(newTitle);
                                onTitleChange(step.id, newTitle);
                            }}
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
                        value={description}
                        onChange={(e) => {
                            const newDesc = e.target.value;
                            setDescription(newDesc);
                            onDescriptionChange(step.id, newDesc.trim() === "" ? null : newDesc);
                        }}
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
                                <li key={sub.id} className="text-sm text-muted-foreground">{sub.title}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {(!step.subSteps || step.subSteps.length === 0) && (
                    <p className="text-sm text-muted-foreground italic">No sub-steps defined for this item.</p>
                )}
            </div>
        </ScrollArea>
        <SheetFooter className="p-4 border-t mt-auto">
            <SheetClose asChild>
                <Button type="button" variant="outline">Close</Button>
            </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};


interface ClickStartInfoType {
  time: number;
  clientX: number;
  clientY: number;
  stepId: string;
  anchor: 'N' | 'S' | 'E' | 'W';
  dotElementRef: React.RefObject<HTMLButtonElement>;
  subStepOriginContext?: SubStepOriginContextType;
}

interface ConnectionDragStateType {
  isActive: boolean;
  isPotentialClick: boolean;
  sourceStepId: string;
  sourceAnchor: 'N' | 'S' | 'E' | 'W';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetHotspot: { stepId: string; anchor: 'N' | 'S' | 'E' | 'W' } | null;
  subStepOriginContext?: SubStepOriginContextType;
}


export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);

  const planId = params?.planId as string | undefined;

  const [roadmapSteps, setRoadmapSteps] = useState<RoadmapStep[]>([]);
  const [isSavingRoadmap, setIsSavingRoadmap] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [editingStepDetails, setEditingStepDetails] = useState<RoadmapStep | null>(null);
  const [isAddStepDialogOpen, setIsAddStepDialogOpen] = useState(false);
  const [pendingNodeFromDialogParentStep, setPendingNodeFromDialogParentStep] = useState<{ id: string; title: string } | null>(null);
  const [pendingNodeFromDotInfo, setPendingNodeFromDotInfo] = useState<{ sourceStepId: string; sourceAnchor: 'N' | 'S' | 'E' | 'W'; creatingFromSubStepId?: string; creatingFromSubStepTitle?: string;} | null>(null);
  const [nodeToDelete, setNodeToDelete] = useState<{ id: string, title: string} | null>(null);
  const [canvasMinHeight, setCanvasMinHeight] = useState<number | string>('100vh');

  const clickStartInfoRef = useRef<ClickStartInfoType | null>(null);
  const activeConnectionDragOperationRef = useRef<Omit<ConnectionDragStateType, 'currentX' | 'currentY' | 'targetHotspot' | 'isPotentialClick'> | null>(null);
  const [connectionDragState, setConnectionDragState] = useState<ConnectionDragStateType | null>(null);
  const latestMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);


  const isValidPlanId = useMemo(() => !!planId && (IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20), [planId]);

  const { data: planData, isLoading: isLoadingPlan, error: planError } = useQuery<ClientPlan | null>({
    queryKey: ['plan', planId],
    queryFn: async () => (planId && isValidPlanId) ? getPlanById(planId) : null,
    enabled: !!planId && isValidPlanId && !authLoading,
  });

  useEffect(() => {
    if (planData?.roadmap) {
      setRoadmapSteps(planData.roadmap.map((step, index) => ({
        ...step,
        x: Math.round(typeof step.x === 'number' ? step.x : index % 3 * (NODE_WIDTH + NODE_SPACING_X) + MIN_CANVAS_PADDING),
        y: Math.round(typeof step.y === 'number' ? step.y : Math.floor(index / 3) * (getStepHeight(step) + NODE_SPACING_Y) + MIN_CANVAS_PADDING),
        subSteps: step.subSteps || [],
        originatingSubStepInfo: step.originatingSubStepInfo || null,
        description: step.description === undefined ? null : step.description,
      })));
    } else if (planData && !planData.roadmap) {
      setRoadmapSteps([]);
    }
  }, [planData]);

  useEffect(() => {
    if (canvasRef.current) {
        let maxBottom = 0;
        if (roadmapSteps.length > 0) {
            roadmapSteps.forEach(step => {
                const stepNodeHeight = getStepHeight(step);
                const stepBottom = (step.y || 0) + stepNodeHeight;
                if (stepBottom > maxBottom) {
                    maxBottom = stepBottom;
                }
            });
        }
        const newHeight = Math.max(window.innerHeight, maxBottom + (MIN_CANVAS_PADDING * 2) + (NODE_SPACING_Y * 2) ); // Add some buffer
        setCanvasMinHeight(newHeight);
    }
  }, [roadmapSteps]);


  const isOwner = useMemo(() => !!user && !!planData && user.uid === planData.ownerId, [user, planData]);

  const handleConnectionDotInteraction = useCallback((
    event: React.MouseEvent,
    stepId: string,
    anchor: 'N' | 'S' | 'E' | 'W',
    actionType: 'down' | 'up',
    subStepOriginContext?: SubStepOriginContextType
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const dotElement = event.currentTarget as HTMLButtonElement;

    if (actionType === 'down') {
        clickStartInfoRef.current = {
            time: Date.now(),
            clientX: event.clientX,
            clientY: event.clientY,
            stepId: stepId,
            anchor: anchor,
            dotElementRef: { current: dotElement },
            subStepOriginContext: subStepOriginContext,
        };

        if (!canvasRef.current) return;
        const canvasRect = canvasRef.current.getBoundingClientRect();
        let startX = 0;
        let startY = 0;

        if (subStepOriginContext?.dotElementRef?.current) {
            const subDotRect = subStepOriginContext.dotElementRef.current.getBoundingClientRect();
            startX = subDotRect.left + subDotRect.width / 2 - canvasRect.left + canvasRef.current.scrollLeft;
            startY = subDotRect.top + subDotRect.height / 2 - canvasRect.top + canvasRef.current.scrollTop;
        } else {
            const sourceNodeElement = canvasRef.current.querySelector(`[data-step-id="${stepId}"]`) as HTMLElement;
            if (!sourceNodeElement) return;
            const nodeRect = sourceNodeElement.getBoundingClientRect();
            const nodeHeight = getStepHeight(roadmapSteps.find(s => s.id === stepId)!);

            switch (anchor) {
                case 'N': startX = nodeRect.left + NODE_WIDTH / 2 - canvasRect.left; startY = nodeRect.top - canvasRect.top; break;
                case 'S': startX = nodeRect.left + NODE_WIDTH / 2 - canvasRect.left; startY = nodeRect.bottom - canvasRect.top; break;
                case 'E': startX = nodeRect.right - canvasRect.left; startY = nodeRect.top + nodeHeight / 2 - canvasRect.top; break;
                case 'W': startX = nodeRect.left - canvasRect.left; startY = nodeRect.top + nodeHeight / 2 - canvasRect.top; break;
            }
            startX += canvasRef.current.scrollLeft;
            startY += canvasRef.current.scrollTop;
        }

        activeConnectionDragOperationRef.current = {
            isActive: true,
            sourceStepId: stepId, // Parent step for sub-step drags
            sourceAnchor: anchor,  // Actual anchor for main dots, 'E' for sub-step dots
            startX: startX,
            startY: startY,
            subStepOriginContext: subStepOriginContext,
        };
        setConnectionDragState({ ...activeConnectionDragOperationRef.current, currentX: startX, currentY: startY, targetHotspot: null, isPotentialClick: true });
        setSelectedStepId(null); // Clear selection when starting a drag/click on dot
        setEditingStepDetails(null);

    } else if (actionType === 'up' && clickStartInfoRef.current) {
        const info = clickStartInfoRef.current;
        if (info.stepId === stepId && info.anchor === anchor) {
            const duration = Date.now() - info.time;
            const dx = Math.abs(event.clientX - info.clientX);
            const dy = Math.abs(event.clientY - info.clientY);

            if (duration < CLICK_TIME_THRESHOLD_MS && dx < CLICK_MOVE_THRESHOLD_PX && dy < CLICK_MOVE_THRESHOLD_PX) { // It's a click
                setPendingNodeFromDotInfo({
                    sourceStepId: stepId, // Parent step for sub-step clicks
                    sourceAnchor: anchor, // Actual anchor for main dots, 'E' for sub-step clicks
                    creatingFromSubStepId: subStepOriginContext?.subStepId,
                    creatingFromSubStepTitle: subStepOriginContext?.subStepTitle
                });
                setIsAddStepDialogOpen(true);
                // Cancel any drag if it was a click
                activeConnectionDragOperationRef.current = null;
                setConnectionDragState(null);
            }
        }
        clickStartInfoRef.current = null;
    }
  }, [canvasRef, roadmapSteps, setSelectedStepId, setEditingStepDetails, setIsAddStepDialogOpen, setPendingNodeFromDotInfo, setConnectionDragState]);


  const isPotentialTarget = useCallback((stepId: string, anchor: 'N' | 'S' | 'E' | 'W') => {
    return connectionDragState?.isActive === true &&
           connectionDragState.targetHotspot?.stepId === stepId &&
           connectionDragState.targetHotspot?.anchor === anchor;
  }, [connectionDragState]);

  const processConnectionLineDragLoop = useCallback(() => {
    if (!activeConnectionDragOperationRef.current?.isActive || !canvasRef.current) {
        animationFrameRef.current = null;
        return;
    }

    const { sourceStepId, sourceAnchor, startX, startY, subStepOriginContext } = activeConnectionDragOperationRef.current;
    const { x: clientX, y: clientY } = latestMousePositionRef.current;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    let currentX = clientX - canvasRect.left + canvasRef.current.scrollLeft;
    let currentY = clientY - canvasRect.top + canvasRef.current.scrollTop;
    let targetHotspot: ConnectionDragStateType['targetHotspot'] = null;
    const SNAP_THRESHOLD = 20;

    for (const targetStep of roadmapSteps) {
        if (targetStep.id === sourceStepId) continue;
        const targetNodeElement = canvasRef.current.querySelector(`[data-step-id="${targetStep.id}"]`) as HTMLElement;
        if (!targetNodeElement) continue;

        const targetRect = targetNodeElement.getBoundingClientRect();
        const targetNodeHeight = getStepHeight(targetStep);
        const targetAnchors = ['N', 'S', 'E'] as const; // West dot removed from targets

        for (const targetAnchor of targetAnchors) {
            // Do not allow connecting to a W anchor on a target if that target has sub-steps
            if (targetAnchor === 'W' && targetStep.subSteps && targetStep.subSteps.length > 0) continue;

            let targetAnchorX = 0, targetAnchorY = 0;
            switch (targetAnchor) {
                case 'N': targetAnchorX = targetRect.left + NODE_WIDTH / 2 - canvasRect.left; targetAnchorY = targetRect.top - canvasRect.top; break;
                case 'S': targetAnchorX = targetRect.left + NODE_WIDTH / 2 - canvasRect.left; targetAnchorY = targetRect.bottom - canvasRect.top; break;
                case 'E': targetAnchorX = targetRect.right - canvasRect.left; targetAnchorY = targetRect.top + targetNodeHeight / 2 - canvasRect.top; break;
                // West (W) anchor removed from general target consideration.
            }
            targetAnchorX += canvasRef.current.scrollLeft;
            targetAnchorY += canvasRef.current.scrollTop;

            const distance = Math.sqrt(Math.pow(currentX - targetAnchorX, 2) + Math.pow(currentY - targetAnchorY, 2));
            if (distance < SNAP_THRESHOLD) {
                currentX = targetAnchorX;
                currentY = targetAnchorY;
                targetHotspot = { stepId: targetStep.id, anchor: targetAnchor };
                break;
            }
        }
        if (targetHotspot) break;
    }
    
    let isClick = connectionDragState?.isPotentialClick ?? false;
    if (isClick && clickStartInfoRef.current) {
        const dx = Math.abs(clientX - clickStartInfoRef.current.clientX);
        const dy = Math.abs(clientY - clickStartInfoRef.current.clientY);
        if (dx > CLICK_MOVE_THRESHOLD_PX || dy > CLICK_MOVE_THRESHOLD_PX) {
            isClick = false;
        }
    }

    setConnectionDragState(prev => {
        if (!prev || !activeConnectionDragOperationRef.current) return null; // Drag might have been cancelled by click
        return {
            ...prev,
            currentX,
            currentY,
            targetHotspot,
            isPotentialClick: isClick,
        }
    });
    animationFrameRef.current = requestAnimationFrame(processConnectionLineDragLoop);
  }, [roadmapSteps, connectionDragState]);


  useEffect(() => {
    if (activeConnectionDragOperationRef.current?.isActive) {
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(processConnectionLineDragLoop);
      }
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [activeConnectionDragOperationRef.current?.isActive, processConnectionLineDragLoop]);


  const handleCanvasMouseUpForConnection = useCallback(() => {
    if (activeConnectionDragOperationRef.current?.isActive && connectionDragState) {
        if (connectionDragState.isPotentialClick && clickStartInfoRef.current) {
            // This was handled by the dot's onMouseUp, which should have cleared activeConnectionDragOperationRef
            // If it reaches here and is still considered a click, it's a fallback or an edge case.
            // Clear the drag state to be safe, the click logic on the dot should handle dialog.
            activeConnectionDragOperationRef.current = null;
            setConnectionDragState(null);
            clickStartInfoRef.current = null; // Clear click info
            return;
        }

        const { sourceStepId, sourceAnchor, subStepOriginContext } = activeConnectionDragOperationRef.current;
        const targetHotspot = connectionDragState.targetHotspot;

        if (targetHotspot) {
            const { stepId: targetStepId, anchor: targetAnchor } = targetHotspot;
            setRoadmapSteps(prevSteps => {
                const targetStepIndex = prevSteps.findIndex(s => s.id === targetStepId);
                if (targetStepIndex === -1) return prevSteps;

                const sourceStep = prevSteps.find(s => s.id === sourceStepId);
                if(!sourceStep) return prevSteps;

                const updatedTargetStep = {
                    ...prevSteps[targetStepIndex],
                    sourceNodeId: sourceStepId, // From main card
                    sourceAnchor: sourceAnchor, // Original anchor of drag, 'E' if from sub-step dot
                    originatingSubStepInfo: null, // Drag-to-connect clears any previous origin
                    // sourceLineYOffset: NO Y-offset when connecting this way; it should be a direct edge-to-edge
                };
                const newSteps = [...prevSteps];
                newSteps[targetStepIndex] = updatedTargetStep;
                return newSteps;
            });
            const targetNodeTitle = roadmapSteps.find(s => s.id === targetStepId)?.title || "target step";
            toast({ title: "Connection Created", description: `Linked to ${targetNodeTitle}.` });
        }
        activeConnectionDragOperationRef.current = null;
        setConnectionDragState(null);
        clickStartInfoRef.current = null;
    }
  }, [connectionDragState, roadmapSteps, toast]);


  const handleAddSubStep = useCallback((event: React.MouseEvent, parentStepId: string, parentStepTitle: string) => {
    event.stopPropagation();
    setPendingNodeFromDialogParentStep({ id: parentStepId, title: parentStepTitle });
    setPendingNodeFromDotInfo(null);
    setIsAddStepDialogOpen(true);
  }, []);

  const handleOpenStepDetails = useCallback((event: React.MouseEvent, step: RoadmapStep) => {
    event.stopPropagation();
    setEditingStepDetails(step);
    setSelectedStepId(step.id); // Also select it
  }, []);

  const handleAddRoadmapStepSubmit = useCallback(async (data: AddRoadmapStepFormData) => {
    setIsSavingRoadmap(true); // Use this state for the dialog's submit button
    try {
      setRoadmapSteps(prevSteps => {
        const newId = `step-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        let newStepData: Partial<RoadmapStep> = {
            id: newId,
            title: data.title,
            description: null,
            subSteps: [],
        };

        if (pendingNodeFromDialogParentStep) { // Adding a sub-step
            const parentIndex = prevSteps.findIndex(s => s.id === pendingNodeFromDialogParentStep.id);
            if (parentIndex === -1) return prevSteps; // Parent not found, should not happen
            const parentStep = prevSteps[parentIndex];
            const newSubStep: RoadmapSubStep = { id: newId, parentId: parentStep.id, title: data.title };
            const updatedParentStep = {
                ...parentStep,
                subSteps: [...(parentStep.subSteps || []), newSubStep]
            };
            const newSteps = [...prevSteps];
            newSteps[parentIndex] = updatedParentStep;
            return newSteps;

        } else if (pendingNodeFromDotInfo) { // Adding a main step from a dot click
            const sourceStep = prevSteps.find(s => s.id === pendingNodeFromDotInfo.sourceStepId);
            if (!sourceStep) return prevSteps;

            const sourceNodeHeight = getStepHeight(sourceStep);
            let newX = sourceStep.x;
            let newY = sourceStep.y;

            // New step created from dot click should NOT have sub-steps by default
            const tempNewNodeForHeightCalc: RoadmapStep = { ...newStepData, x:0, y:0, subSteps:[] } as RoadmapStep;
            const newNodeHeight = getStepHeight(tempNewNodeForHeightCalc);

            switch (pendingNodeFromDotInfo.sourceAnchor) {
                case 'N': newX = sourceStep.x; newY = sourceStep.y - newNodeHeight - NODE_SPACING_Y; break;
                case 'S': newX = sourceStep.x; newY = sourceStep.y + sourceNodeHeight + NODE_SPACING_Y; break;
                case 'E': newX = sourceStep.x + NODE_WIDTH + NODE_SPACING_X; newY = sourceStep.y + (sourceNodeHeight / 2) - (newNodeHeight / 2); break;
                case 'W': newX = sourceStep.x - NODE_WIDTH - NODE_SPACING_X; newY = sourceStep.y + (sourceNodeHeight / 2) - (newNodeHeight / 2); break; // Should not be used
            }
            
            newStepData.x = Math.round(Math.max(MIN_CANVAS_PADDING, newX));
            newStepData.y = Math.round(Math.max(MIN_CANVAS_PADDING, newY));
            newStepData.sourceNodeId = pendingNodeFromDotInfo.sourceStepId;
            newStepData.sourceAnchor = pendingNodeFromDotInfo.sourceAnchor;
            if (pendingNodeFromDotInfo.creatingFromSubStepId) {
                newStepData.originatingSubStepInfo = {
                    sourceCardId: pendingNodeFromDotInfo.sourceStepId,
                    subStepId: pendingNodeFromDotInfo.creatingFromSubStepId,
                };
            }
            return [...prevSteps, newStepData as RoadmapStep];

        } else { // Adding a general new main step (from main "Add Step" button)
            let defaultX = MIN_CANVAS_PADDING;
            let defaultY = MIN_CANVAS_PADDING;
            if (prevSteps.length > 0) {
                 // Place below the last step without a source node (a root step) or just below the very last step.
                const rootSteps = prevSteps.filter(s => !s.sourceNodeId);
                const lastStepToSort = rootSteps.length > 0 ? rootSteps.reduce((a, b) => (a.y + getStepHeight(a)) > (b.y + getStepHeight(b)) ? a : b) : prevSteps.reduce((a,b) => (a.y + getStepHeight(a)) > (b.y + getStepHeight(b)) ? a:b);
                defaultY = lastStepToSort.y + getStepHeight(lastStepToSort) + NODE_SPACING_Y;
            }
            newStepData.x = defaultX;
            newStepData.y = defaultY;
            return [...prevSteps, newStepData as RoadmapStep];
        }
      });
      toast({ title: "Step Added", description: `"${data.title}" added to the roadmap.` });
      setIsAddStepDialogOpen(false);
    } catch (error) {
      console.error("Error in handleAddRoadmapStepSubmit:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not add step locally." });
    } finally {
      setPendingNodeFromDialogParentStep(null); // Clear parent context
      setPendingNodeFromDotInfo(null); // Clear dot click context
      setIsSavingRoadmap(false);
    }
  }, [pendingNodeFromDialogParentStep, pendingNodeFromDotInfo, toast]);


  const activeDragNodeIdRef = useRef<string | null>(null);
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const nodeInitialPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragAnimationRef = useRef<number | null>(null);

  const handleMouseDownOnNode = useCallback((event: React.MouseEvent, stepId: string) => {
    if (activeDragNodeIdRef.current) return; // Prevent starting new drag if one is active
    event.stopPropagation();
    
    setSelectedStepId(stepId);
    setEditingStepDetails(roadmapSteps.find(s => s.id === stepId) || null);

    const stepToDrag = roadmapSteps.find(s => s.id === stepId);
    if (!stepToDrag || typeof stepToDrag.x !== 'number' || typeof stepToDrag.y !== 'number') return;

    activeDragNodeIdRef.current = stepId;
    dragStartOffsetRef.current = { x: event.clientX, y: event.clientY };
    nodeInitialPositionRef.current = { x: stepToDrag.x, y: stepToDrag.y };

    if (dragAnimationRef.current) cancelAnimationFrame(dragAnimationRef.current);
    dragAnimationRef.current = requestAnimationFrame(dragNodeLoop);

  }, [roadmapSteps]);

  const dragNodeLoop = useCallback(() => {
    if (!activeDragNodeIdRef.current || !canvasRef.current) {
        if (dragAnimationRef.current) cancelAnimationFrame(dragAnimationRef.current);
        dragAnimationRef.current = null;
        return;
    }
    const { x: clientX, y: clientY } = latestMousePositionRef.current;
    const dx = clientX - dragStartOffsetRef.current.x;
    const dy = clientY - dragStartOffsetRef.current.y;
    
    const canvasWidth = canvasRef.current.clientWidth || window.innerWidth;
    const newX = Math.round(Math.max(MIN_CANVAS_PADDING, Math.min(nodeInitialPositionRef.current.x + dx, canvasWidth > NODE_WIDTH ? canvasWidth - NODE_WIDTH - MIN_CANVAS_PADDING : MIN_CANVAS_PADDING)));
    const newY = Math.round(Math.max(MIN_CANVAS_PADDING, nodeInitialPositionRef.current.y + dy));

    setRoadmapSteps(prevSteps => {
        const stepIndex = prevSteps.findIndex(s => s.id === activeDragNodeIdRef.current);
        if (stepIndex === -1) {
            if (dragAnimationRef.current) cancelAnimationFrame(dragAnimationRef.current);
            dragAnimationRef.current = null;
            return prevSteps;
        }
        const currentStep = prevSteps[stepIndex];
        if (currentStep.x === newX && currentStep.y === newY) return prevSteps;

        const updatedSteps = [...prevSteps];
        updatedSteps[stepIndex] = { ...currentStep, x: newX, y: newY };
        return updatedSteps;
    });
    dragAnimationRef.current = requestAnimationFrame(dragNodeLoop);
  }, [latestMousePositionRef]);

  const handleMouseMoveOnCanvas = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    latestMousePositionRef.current = { x: event.clientX, y: event.clientY };
    if (activeConnectionDragOperationRef.current?.isActive) {
        // Trigger RAF loop if not already running for connection drag
        if (!animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(processConnectionLineDragLoop);
        }
    }
  }, [processConnectionLineDragLoop]);


  const handleMouseUpOnCanvas = useCallback(() => {
    if (activeDragNodeIdRef.current) {
        if (dragAnimationRef.current) cancelAnimationFrame(dragAnimationRef.current);
        dragAnimationRef.current = null;
        activeDragNodeIdRef.current = null;
    }
    if (activeConnectionDragOperationRef.current?.isActive) {
        handleCanvasMouseUpForConnection(); // Handles connection completion or cancellation
    }
    clickStartInfoRef.current = null; // Clear any pending click info
  }, [handleCanvasMouseUpForConnection]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) { // Click on canvas background
      setSelectedStepId(null);
      setEditingStepDetails(null);
    }
  }, []);

  const handleDescriptionChange = useCallback((stepId: string, description: string | null) => {
    setRoadmapSteps(prev => prev.map(s => s.id === stepId ? { ...s, description } : s));
  }, []);

  const handleTitleChange = useCallback((stepId: string, newTitle: string) => {
    setRoadmapSteps(prev => {
      const newSteps = [...prev];
      const stepIndex = newSteps.findIndex(s => s.id === stepId);
      if (stepIndex === -1) return prev;

      const updatedStep = { ...newSteps[stepIndex], title: newTitle };
      newSteps[stepIndex] = updatedStep;
      
      // If this step was created from a sub-step, update the originating sub-step's title too
      if (updatedStep.originatingSubStepInfo) {
        const { sourceCardId, subStepId } = updatedStep.originatingSubStepInfo;
        const parentCardIndex = newSteps.findIndex(s => s.id === sourceCardId);
        if (parentCardIndex !== -1) {
          const parentCard = { ...newSteps[parentCardIndex] };
          const subStepIndex = (parentCard.subSteps || []).findIndex(sub => sub.id === subStepId);
          if (subStepIndex !== -1) {
            const updatedSubSteps = [...(parentCard.subSteps || [])];
            updatedSubSteps[subStepIndex] = { ...updatedSubSteps[subStepIndex], title: newTitle };
            parentCard.subSteps = updatedSubSteps;
            newSteps[parentCardIndex] = parentCard;
          }
        }
      }
      return newSteps;
    });
  }, []);

  const handleDeleteNodeConfirmation = useCallback((stepId: string, stepTitle: string) => {
    setNodeToDelete({ id: stepId, title: stepTitle });
  }, []);

  const confirmDeleteNode = useCallback(() => {
    if (!nodeToDelete) return;
    const { id: stepIdToDelete, title } = nodeToDelete;

    setRoadmapSteps(prevSteps =>
      prevSteps
        .filter(s => s.id !== stepIdToDelete) // Remove the step
        .map(s => { // Remove connections pointing to the deleted step
          if (s.sourceNodeId === stepIdToDelete) {
            return { ...s, sourceNodeId: undefined, sourceAnchor: undefined, sourceLineYOffset: undefined };
          }
          // Also remove sub-steps from other cards that originated this deleted step
          if (s.subSteps) {
            const updatedSubSteps = s.subSteps.filter(sub => {
                const originatingNode = prevSteps.find(node => node.originatingSubStepInfo?.subStepId === sub.id);
                return !originatingNode || originatingNode.id !== stepIdToDelete;
            });
            if (updatedSubSteps.length !== s.subSteps.length) {
                return {...s, subSteps: updatedSubSteps};
            }
          }
          return s;
        })
    );
    if (selectedStepId === stepIdToDelete) {
      setSelectedStepId(null);
      setEditingStepDetails(null);
    }
    toast({ title: "Node Deleted", description: `Step "${title}" and its connections removed.` });
    setNodeToDelete(null);
  }, [nodeToDelete, selectedStepId, toast]);


  const saveRoadmapChanges = async () => {
    if (!planData || !user || !planId || !isOwner) {
      toast({ variant: "destructive", title: "Error", description: "Plan data, user authentication, or ownership missing." });
      return;
    }
    setIsSavingRoadmap(true);
    try {
      await updatePlanRoadmap(planId, user.uid, roadmapSteps);
      toast({ title: "Roadmap Saved", description: "Your changes have been saved successfully." });
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save roadmap." });
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
            <Puzzle className="h-10 w-10 text-muted-foreground mb-2" />
            <h1 className="text-xl font-semibold">Plan Not Found</h1>
            <p className="text-muted-foreground">The collaboration plan does not exist or you may not have permission to view it.</p>
            <Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button>
        </div>
    );
  }

  let addStepDialogTitle = "Add New Roadmap Step";
  if (pendingNodeFromDialogParentStep) {
      addStepDialogTitle = `Add Sub-step to "${pendingNodeFromDialogParentStep.title}"`;
  } else if (pendingNodeFromDotInfo) {
      const sourceNodeTitle = roadmapSteps.find(s => s.id === pendingNodeFromDotInfo.sourceStepId)?.title || "Selected Step";
      const fromPart = pendingNodeFromDotInfo.creatingFromSubStepTitle
        ? `sub-step "${pendingNodeFromDotInfo.creatingFromSubStepTitle}" in "${sourceNodeTitle}"`
        : `"${sourceNodeTitle}"`;
      addStepDialogTitle = `Add New Step from ${fromPart}`;
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
                 <Button variant="default" size="sm" className="h-8" onClick={saveRoadmapChanges} disabled={isSavingRoadmap}>
                    {isSavingRoadmap ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5"/>}
                    <span className="hidden sm:inline">Save Roadmap</span>
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
          onMouseMove={handleMouseMoveOnCanvas}
          onMouseUp={handleMouseUpOnCanvas}
          onMouseLeave={handleMouseUpOnCanvas} // Handle mouse leaving canvas to cancel drags
          onClick={handleCanvasClick}
          style={{ minHeight: canvasMinHeight }}
        >
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            {isOwner && (
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingNodeFromDialogParentStep(null);
                  setPendingNodeFromDotInfo(null);
                  setIsAddStepDialogOpen(true);
                }}
                className="shadow-md bg-card hover:bg-muted"
              >
                <PlusCircle className="h-4 w-4 mr-2" /> Add Roadmap Step
              </Button>
            )}
             {!isOwner && <Badge variant="secondary" className="text-xs">View Only Mode</Badge>}
          </div>

            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {roadmapSteps.map(targetStep => {
                    if (!targetStep.sourceNodeId || !targetStep.sourceAnchor) return null;
                    const sourceStep = roadmapSteps.find(s => s.id === targetStep.sourceNodeId);
                    if (!sourceStep || typeof sourceStep.x !== 'number' || typeof sourceStep.y !== 'number' || typeof targetStep.x !== 'number' || typeof targetStep.y !== 'number') return null;

                    const sourceNodeHeight = getStepHeight(sourceStep);
                    const targetNodeHeight = getStepHeight(targetStep);
                    let x1=0, y1=0, x2=0, y2=0;
                    const yOffset = targetStep.sourceLineYOffset || 0;

                    switch (targetStep.sourceAnchor) {
                        case 'N': x1 = sourceStep.x + NODE_WIDTH / 2; y1 = sourceStep.y; break;
                        case 'S': x1 = sourceStep.x + NODE_WIDTH / 2; y1 = sourceStep.y + sourceNodeHeight; break;
                        case 'E': x1 = sourceStep.x + NODE_WIDTH; y1 = sourceStep.y + sourceNodeHeight / 2 + yOffset; break;
                        case 'W': x1 = sourceStep.x; y1 = sourceStep.y + sourceNodeHeight / 2 + yOffset; break;
                    }
                     // Connect to opposite side or appropriate side for clarity
                    const targetSide = targetStep.sourceAnchor === 'N' ? 'S' : targetStep.sourceAnchor === 'S' ? 'N' : targetStep.sourceAnchor === 'E' ? 'W' : 'E';
                     switch (targetSide) {
                        case 'N': x2 = targetStep.x + NODE_WIDTH / 2; y2 = targetStep.y; break;
                        case 'S': x2 = targetStep.x + NODE_WIDTH / 2; y2 = targetStep.y + targetNodeHeight; break;
                        case 'E': x2 = targetStep.x + NODE_WIDTH; y2 = targetStep.y + targetNodeHeight / 2; break;
                        case 'W': x2 = targetStep.x; y2 = targetStep.y + targetNodeHeight / 2; break;
                     }
                    const isOriginatingFromSubStep = !!targetStep.originatingSubStepInfo && targetStep.sourceLineYOffset !== undefined;
                    return (
                        <line
                            key={`line-${sourceStep.id}-${targetStep.id}`}
                            x1={x1} y1={y1}
                            x2={x2} y2={y2}
                            stroke="hsl(var(--foreground) / 0.7)"
                            strokeWidth={isOriginatingFromSubStep ? "1.5" : "3"}
                            strokeDasharray={isOriginatingFromSubStep ? "5 5" : "none"}
                        />
                    );
                })}
                {connectionDragState?.isActive && (
                    <line
                        x1={connectionDragState.startX} y1={connectionDragState.startY}
                        x2={connectionDragState.currentX} y2={connectionDragState.currentY}
                        stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="4 4"
                    />
                )}
            </svg>

          {roadmapSteps.map(step => (
            <RoadmapStepCard
              key={step.id}
              step={step}
              onAddSubStep={handleAddSubStep}
              onOpenDetails={handleOpenStepDetails}
              isSelected={selectedStepId === step.id}
              isSubmitting={!isOwner || isSavingRoadmap || (connectionDragState?.isActive ?? false)}
              onMouseDownOnNode={isOwner ? handleMouseDownOnNode : (e) => e.stopPropagation()}
              onDeleteNode={isOwner ? handleDeleteNodeConfirmation : () => {}}
              onConnectionDotInteraction={isOwner ? handleConnectionDotInteraction : (e) => e.stopPropagation()}
              isPotentialConnectionTarget={isPotentialTarget}
            />
          ))}
          {roadmapSteps.length === 0 && !isAddStepDialogOpen && (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none">
                <Map className="h-10 w-10 mb-2"/>
                <p className="text-sm font-medium">Roadmap is empty.</p>
                {isOwner && <p className="text-xs">Click "Add Roadmap Step" to begin planning.</p>}
            </div>
          )}
        </main>
      </div>

      <AddStepDialog
        isOpen={isAddStepDialogOpen && isOwner}
        onOpenChange={(open) => {
            setIsAddStepDialogOpen(open);
            if (!open) { // Reset contexts when dialog closes
                setPendingNodeFromDialogParentStep(null);
                setPendingNodeFromDotInfo(null);
            }
        }}
        onSubmit={handleAddRoadmapStepSubmit}
        isSubmitting={isSavingRoadmap} // Dialog should use isSavingRoadmap for its own submit state
        parentStepTitle={pendingNodeFromDialogParentStep?.title}
        dialogTitle={addStepDialogTitle}
      />

      <StepDetailSheet
        step={editingStepDetails}
        isOpen={!!editingStepDetails}
        onOpenChange={(open) => {
            if (!open) {
                setEditingStepDetails(null);
                // Optionally clear selectedStepId if detail sheet closes and it wasn't a new selection.
                // For now, selection remains until canvas click or new selection.
            }
        }}
        onDescriptionChange={handleDescriptionChange}
        onTitleChange={handleTitleChange}
        isOwner={isOwner}
      />
       <AlertDialog open={!!nodeToDelete} onOpenChange={() => setNodeToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogPrimitiveTitle>Delete Roadmap Step?</AlertDialogPrimitiveTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete the step "{nodeToDelete?.title || ''}"?
                        This will also remove any sub-steps and incoming connections to this step. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setNodeToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteNode} className="bg-destructive hover:bg-destructive/90">
                        Delete Step
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

    