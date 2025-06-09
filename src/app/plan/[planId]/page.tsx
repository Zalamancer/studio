
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
  Trash2,
  Type as TypeIcon,
  MessageSquare as LineLabelIcon,
  MinusCircle,
  History,
  RefreshCcw, 
} from 'lucide-react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { getPlanById, updatePlanRoadmap, getPlanVersions, restorePlanToVersion } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep, UpdatePlanRoadmapData, IncomingConnection, ClientPlanVersion } from '@/types/plan';
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
import { format } from 'date-fns';

const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const NODE_BASE_MIN_HEIGHT = 100;
const NODE_HEADER_HEIGHT = 40;
const SUBSTEP_ITEM_HEIGHT = 24;
const NODE_CONTENT_PADDING_Y = 16;
const FINAL_BUFFER_CARD_HEIGHT = 8;

const DOT_SIZE = 12;
const SUB_STEP_DOT_VISUAL_DIAMETER = 8; 

const DOT_OFFSET = -DOT_SIZE / 2;
const SNAP_THRESHOLD = 25;

const MAIN_CONNECTION_LINE_COLOR = "#FDC921";
const SUBSTEP_CONNECTION_LINE_COLOR = "#FDD85D";

const CONNECTION_LINE_THICKNESS = 2;
const CONNECTION_LINE_THICKNESS_MAIN = 3;


const ARROWHEAD_LENGTH = 10;
const ARROWHEAD_WIDTH_FACTOR = 0.7;
const NECK_LENGTH = ARROWHEAD_LENGTH * 2;
const MIN_MAIN_PATH_LENGTH = 10;

const CLICK_MOVE_THRESHOLD_PX_SQ = 25;
const CLICK_TIME_THRESHOLD_MS = 300;

const calculateNodeHeight = (step: RoadmapStep): number => {
  let height = NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y;
  let descriptionLineCount = 0;
  if (step.description && step.description.trim().length > 0) {
    const lines = Math.ceil(step.description.length / 35) + step.description.split(/\r\n|\r|\n/).length -1;
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
  onNodeInteractionStart: (nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => void;
  onDotInteractionStart: (parentNodeId: string, anchor: 'N' | 'S' | 'E' | 'W', event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>, subStepOriginContext?: { sourceCardId: string; subStepId: string; subStepTitle: string }) => void;
  isSelected?: boolean;
  isSubmitting: boolean;
  onEditStep: (step: RoadmapStep) => void;
  onSubStepSelect?: (parentStep: RoadmapStep, subStep: RoadmapSubStep) => void;
  isActuallyDraggingThisNode?: boolean;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  onNodeInteractionStart,
  onDotInteractionStart,
  isSelected,
  isSubmitting,
  onEditStep,
  onSubStepSelect,
  isActuallyDraggingThisNode,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const dynamicHeight = calculateNodeHeight(step);

  interface ConnectionDotProps {
    anchor: 'N' | 'S' | 'E' | 'W';
    parentStepId: string;
    isSubmitting: boolean;
    style?: React.CSSProperties;
    subStepContext?: { sourceCardId: string; subStepId: string; subStepTitle: string };
  }

  const ConnectionDot: React.FC<ConnectionDotProps> = ({ anchor, parentStepId: localParentStepId, isSubmitting: propIsSubmitting, style, subStepContext }) => {
    const dotClickableSize = DOT_SIZE;
    const isSubStepDot = !!subStepContext;
    const titleText = `Create new step from: ${isSubStepDot ? `Sub-step "${subStepContext.subStepTitle}"` : `"${step.title}"`} (Anchor: ${anchor})`;

    return (
      <button
        aria-label={titleText}
        title={titleText}
        className={cn(
          "group absolute rounded-full z-20 transition-all duration-150 ease-in-out flex items-center justify-center",
          propIsSubmitting && "cursor-not-allowed opacity-50",
          isSubStepDot ? "active:scale-125" : "active:scale-110"
        )}
        style={{ width: dotClickableSize, height: dotClickableSize, ...style }}
        onMouseDown={(e) => { if (propIsSubmitting) return; e.stopPropagation(); onDotInteractionStart(localParentStepId, anchor, e, subStepContext); }}
        onTouchStart={(e) => { if (propIsSubmitting) return; e.stopPropagation(); onDotInteractionStart(localParentStepId, anchor, e, subStepContext); }}
        disabled={propIsSubmitting}
      >
        <div className={cn(
            "rounded-full transition-all duration-150 ease-in-out",
             isSubStepDot
              ? `bg-muted-foreground h-${SUB_STEP_DOT_VISUAL_DIAMETER/4} w-${SUB_STEP_DOT_VISUAL_DIAMETER/4} group-hover:bg-green-500 group-hover:scale-150 group-hover:ring-2 group-hover:ring-green-300`
              : `h-2 w-2 bg-muted-foreground group-hover:bg-primary group-hover:scale-150 group-hover:ring-2 group-hover:ring-primary/60`
        )}/>
      </button>
    );
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "absolute select-none shadow-lg border rounded-lg flex flex-col",
        isSelected ? "ring-2 ring-primary shadow-2xl z-20" : "border-border hover:shadow-xl z-10 shadow-sm",
        isActuallyDraggingThisNode ? 'cursor-grabbing shadow-2xl z-30' : 'cursor-grab'
      )}
      style={{ 
        left: `${step.x}px`, 
        top: `${step.y}px`, 
        width: `${NODE_BASE_WIDTH}px`, 
        height: `${dynamicHeight}px`, 
        touchAction: 'none', 
        overflow: 'visible',
      }}
      onMouseDown={(e) => onNodeInteractionStart(step.id, e)}
      onTouchStart={(e) => onNodeInteractionStart(step.id, e)}
      data-node-id={step.id}
    >
      <div 
        className="p-2 border-b border-border flex items-center justify-between cursor-move rounded-t-lg h-[40px]"
        style={{ backgroundColor: '#6798C0' }} 
      >
        <h3 className="text-sm font-semibold truncate text-white" title={step.title}>{step.title}</h3>
      </div>
      <div className="p-2 text-xs flex-grow min-h-0" style={{ backgroundColor: '#99D6EA' }}>
        {step.description && (<p className="whitespace-pre-wrap line-clamp-3 mb-1.5 text-black">{step.description}</p>)}
        {step.subSteps && step.subSteps.length > 0 && (
          <ul className="space-y-1 list-none p-0 m-0">
            {step.subSteps.map((subStep) => (
              <li key={subStep.id} className="text-xs py-0.5 group/substep">
                 <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (onSubStepSelect) onSubStepSelect(step, subStep); }}
                    className="p-0 bg-transparent border-none truncate text-left hover:text-primary hover:underline focus:outline-none focus:text-primary focus:underline text-black"
                    title={`View/Edit sub-step: ${subStep.title}`}
                  >
                    {subStep.title}
                  </button>
              </li>
            ))}
          </ul>
        )}
        {(!step.description || step.description.trim().length === 0) && (!step.subSteps || step.subSteps.length === 0) && (
          <p className="italic text-gray-600 text-center py-2 text-[11px]">No details or sub-steps yet.</p>
        )}
      </div>
      <ConnectionDot anchor="N" parentStepId={step.id} isSubmitting={isSubmitting} style={{ top: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE/2}px)` }} />
      <ConnectionDot anchor="S" parentStepId={step.id} isSubmitting={isSubmitting} style={{ bottom: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE/2}px)` }} />
      <ConnectionDot anchor="E" parentStepId={step.id} isSubmitting={isSubmitting} style={{ right: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE/2}px)` }} />
      {!step.subSteps || step.subSteps.length === 0 ? (
          <ConnectionDot anchor="W" parentStepId={step.id} isSubmitting={isSubmitting} style={{ left: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE/2}px)` }} />
      ) : (
          step.subSteps.map((subStep, index) => (
              <ConnectionDot
                key={`subdot-west-${subStep.id}`}
                anchor="W"
                parentStepId={step.id}
                isSubmitting={isSubmitting}
                style={{
                    left: DOT_OFFSET,
                    top: `${NODE_HEADER_HEIGHT + (NODE_CONTENT_PADDING_Y / 2) + (index * SUBSTEP_ITEM_HEIGHT) + (SUBSTEP_ITEM_HEIGHT / 2) - (DOT_SIZE/2)}px`
                }}
                subStepContext={{ sourceCardId: step.id, subStepId: subStep.id, subStepTitle: subStep.title }}
              />
          ))
      )}
    </div>
  );
});
RoadmapStepCard.displayName = "RoadmapStepCard";

interface NodeDragInfo { type: 'node'; nodeId: string; offsetX: number; offsetY: number; }
interface ConnectionDragInfo { type: 'connectionDot'; sourceStepId: string; sourceAnchor: 'N' | 'S' | 'E' | 'W'; startX: number; startY: number; sourceSubStepContext?: { sourceCardId: string; subStepId: string; subStepTitle: string } | null; }
interface PointerStartInfo { clientX: number; clientY: number; timestamp: number; targetElement: EventTarget | null; }
interface LineContextMenuState { isOpen: boolean; x: number; y: number; targetNodeId: string; connectionId: string; }

interface ItemToDelete {
  type: 'step' | 'subStep';
  id: string;
  title: string;
  parentStepId?: string; 
  parentSubStepId?: string; 
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

  const [canvasMinHeight, setCanvasMinHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 800);
  const [editableRoadmap, setEditableRoadmap] = useState<RoadmapStep[]>([]);
  const [isAddStepDialogOpen, setIsAddStepDialogOpen] = useState(false);
  const [pendingNodeFromDotInfo, setPendingNodeFromDotInfo] = useState<{ sourceStepId: string; sourceAnchor: 'N' | 'S' | 'E' | 'W'; creatingFromSubStepContext?: { sourceCardId: string; subStepId: string; subStepTitle: string } } | null>(null);

  const [editingStep, setEditingStep] = useState<RoadmapStep | null>(null);
  const [editingSubStep, setEditingSubStep] = useState<RoadmapSubStep | null>(null);
  
  const [currentSubStepTitleEdit, setCurrentSubStepTitleEdit] = useState<string>("");
  const [currentSubStepDescriptionEdit, setCurrentSubStepDescriptionEdit] = useState<string>("");


  const [isStepDetailSheetOpen, setIsStepDetailSheetOpen] = useState(false);
  const [isEditingNodeTitle, setIsEditingNodeTitle] = useState(false);
  const [isEditingNodeDescription, setIsEditingNodeDescription] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);


  const [lineContextMenu, setLineContextMenu] = useState<LineContextMenuState | null>(null);
  const [isLineEditLabelAlertOpen, setIsLineEditLabelAlertOpen] = useState(false);
  const [currentLineEditLabel, setCurrentLineEditLabel] = useState("");
  const lineLabelInputRef = useRef<HTMLInputElement>(null);

  const [isPointerDown, setIsPointerDown] = useState(false);
  const nodeDragInfoRef = useRef<NodeDragInfo | null>(null);
  const connectionDragInfoRef = useRef<ConnectionDragInfo | null>(null);
  const clickStartInfoRef = useRef<PointerStartInfo | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const [activeConnectionLinePreview, setActiveConnectionLinePreview] = useState<{startX: number, startY: number, currentX: number, currentY: number, isFromSubStep: boolean} | null>(null);

  const [isVersionHistorySheetOpen, setIsVersionHistorySheetOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<ClientPlanVersion | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);


  const isValidPlanId = useMemo(() => !!planId && (IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20), [planId]);

  const { data: planData, isLoading: isLoadingPlan, error: planError } = useQuery<ClientPlan | null>({
    queryKey: ['plan', planId],
    queryFn: async () => (planId && isValidPlanId) ? getPlanById(planId) : null,
    enabled: !!planId && isValidPlanId && !authLoading,
  });

  const { data: planVersions = [], isLoading: isLoadingVersions, error: versionsError } = useQuery<ClientPlanVersion[]>({
    queryKey: ['planVersions', planId],
    queryFn: () => (planId && isValidPlanId ? getPlanVersions(planId) : Promise.resolve([])),
    enabled: isVersionHistorySheetOpen && !!planId && isValidPlanId,
  });

  const saveRoadmapMutation = useMutation({
    mutationFn: (payload: { planId: string; currentUserId: string; roadmap: RoadmapStep[] }) => updatePlanRoadmap(payload.planId, payload.currentUserId, payload.roadmap),
    onSuccess: () => { toast({ title: "Plan State Saved", description: "The current plan state has been saved." }); if (planId) queryClient.invalidateQueries({ queryKey: ['plan', planId] }); queryClient.invalidateQueries({queryKey: ['planVersions', planId]}); },
    onError: (error: Error) => { toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save plan." }); }
  });

  const restorePlanMutation = useMutation({
    mutationFn: (payload: { planId: string; versionIdToRestore: string; currentUserId: string; }) =>
      restorePlanToVersion(payload.planId, payload.versionIdToRestore, payload.currentUserId),
    onSuccess: () => {
      toast({ title: "Plan Restored", description: "The plan has been restored to the selected version." });
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['planVersions', planId] });
      setIsRestoreConfirmOpen(false);
      setVersionToRestore(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Restore Failed", description: error.message || "Could not restore plan." });
      setIsRestoreConfirmOpen(false);
      setVersionToRestore(null);
    },
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
        lowestNodeBottomY = Math.max(0, ...editableRoadmap.map(step => step.y + calculateNodeHeight(step)));
      }
      const newMinHeight = Math.max(window.innerHeight, lowestNodeBottomY + window.innerHeight * 0.5);
      setCanvasMinHeight(newMinHeight);
    }
  }, [editableRoadmap]);

  const canEditPlan = !!user;

  const getPointerCoords = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } => {
    if ('touches' in event && event.touches.length > 0) return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    if ('changedTouches' in event && event.changedTouches.length > 0) return { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY };
    return { clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY };
  }, []);

  const getElementCenter = useCallback((domElement: HTMLElement): { x: number, y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const domRect = domElement.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    return {
      x: domRect.left + domRect.width / 2 - canvasRect.left + canvasRef.current.scrollLeft,
      y: domRect.top + domRect.height / 2 - canvasRect.top + canvasRef.current.scrollTop,
    };
  }, []);

  const getAnchorPoint = useCallback((step: RoadmapStep, anchor: 'N' | 'S' | 'E' | 'W'): { x: number, y: number } => {
    const nodeHeight = calculateNodeHeight(step);
    const nodeWidth = NODE_BASE_WIDTH;
    switch (anchor) {
      case 'N': return { x: step.x + nodeWidth / 2, y: step.y };
      case 'S': return { x: step.x + nodeWidth / 2, y: step.y + nodeHeight };
      case 'E': return { x: step.x + nodeWidth, y: step.y + nodeHeight / 2 };
      case 'W': return { x: step.x, y: step.y + nodeHeight / 2 };
      default: return { x: step.x, y: step.y };
    }
  }, []);

  const getSubStepDotAnchorPoint = useCallback((parentStep: RoadmapStep, subStepId: string): { x: number, y: number } => {
    const subStepIndex = parentStep.subSteps?.findIndex(ss => ss.id === subStepId) ?? -1;
    if (subStepIndex === -1) {
      return { x: parentStep.x, y: parentStep.y + NODE_HEADER_HEIGHT + (NODE_CONTENT_PADDING_Y / 2) };
    }
    const yCenterOfSubStepTextLine = NODE_HEADER_HEIGHT + (NODE_CONTENT_PADDING_Y / 2) + (subStepIndex * SUBSTEP_ITEM_HEIGHT) + (SUBSTEP_ITEM_HEIGHT / 2);
    return { x: parentStep.x, y: parentStep.y + yCenterOfSubStepTextLine };
  }, []);

  const handleEditStep = useCallback((stepToEdit: RoadmapStep) => {
    setEditingStep(stepToEdit);
    setEditingSubStep(null);
    setCurrentSubStepTitleEdit("");
    setCurrentSubStepDescriptionEdit("");
    setIsStepDetailSheetOpen(true);
    setIsEditingNodeTitle(false);
    setIsEditingNodeDescription(false);
  }, []);

  const handleEditDirectSubStep = useCallback((subStepToEdit: RoadmapSubStep, parentMainStep: RoadmapStep) => {
    setEditingStep(parentMainStep);
    setEditingSubStep(subStepToEdit);
    setCurrentSubStepTitleEdit(subStepToEdit.title);
    setCurrentSubStepDescriptionEdit(subStepToEdit.description || "");
    setIsStepDetailSheetOpen(true);
  }, []);

  const handleEditNestedSubStep = useCallback((nestedSubStepToEdit: RoadmapSubStep) => {
    setEditingSubStep(nestedSubStepToEdit);
    setCurrentSubStepTitleEdit(nestedSubStepToEdit.title);
    setCurrentSubStepDescriptionEdit(nestedSubStepToEdit.description || "");
  }, []);


  const handleAddRoadmapStepSubmit = useCallback((data: AddRoadmapStepFormData) => {
    if (!canEditPlan) return;
    let newStepX = 100, newStepY = 100; let initialIncomingConnections: IncomingConnection[] = [];
    if (pendingNodeFromDotInfo?.sourceStepId) {
      const sourceNode = editableRoadmap.find(s => s.id === pendingNodeFromDotInfo.sourceStepId);
      if (sourceNode) {
        const sourceNodeHeight = calculateNodeHeight(sourceNode); const sourceNodeWidth = NODE_BASE_WIDTH;
        const spacing = 80; const newNodeApproxHeight = calculateNodeHeight({ title: data.title, x:0, y:0, id:'temp', subSteps:[], incomingConnections:[] });
        let targetAnchorOnNewNode: 'N' | 'S' | 'E' | 'W' = 'N';
        switch(pendingNodeFromDotInfo.sourceAnchor) {
          case 'N': newStepX = sourceNode.x + (sourceNodeWidth / 2) - (NODE_BASE_WIDTH / 2); newStepY = sourceNode.y - newNodeApproxHeight - spacing; targetAnchorOnNewNode = 'S'; break;
          case 'S': newStepX = sourceNode.x + (sourceNodeWidth / 2) - (NODE_BASE_WIDTH / 2); newStepY = sourceNode.y + sourceNodeHeight + spacing; targetAnchorOnNewNode = 'N'; break;
          case 'E': newStepX = sourceNode.x + sourceNodeWidth + spacing; newStepY = sourceNode.y + (sourceNodeHeight / 2) - (newNodeApproxHeight / 2); targetAnchorOnNewNode = 'W'; break;
          case 'W':
            let baseSubStepY = sourceNode.y + (sourceNodeHeight / 2) - (newNodeApproxHeight / 2);
            if(pendingNodeFromDotInfo.creatingFromSubStepContext){
                const subStepIndex = sourceNode.subSteps?.findIndex(ss => ss.id === pendingNodeFromDotInfo.creatingFromSubStepContext!.subStepId) ?? -1;
                if(subStepIndex !== -1){ baseSubStepY = sourceNode.y + NODE_HEADER_HEIGHT + (NODE_CONTENT_PADDING_Y / 2) + (subStepIndex * SUBSTEP_ITEM_HEIGHT) + (SUBSTEP_ITEM_HEIGHT / 2) - (newNodeApproxHeight / 2); }
            }
            newStepX = sourceNode.x - NODE_BASE_WIDTH - spacing; newStepY = baseSubStepY; targetAnchorOnNewNode = 'E'; break;
        }
        const newConnectionId = `conn-${uuidv4()}`;
        initialIncomingConnections.push({
            id: newConnectionId,
            lineType: 'straight',
            sourceNodeId: pendingNodeFromDotInfo.sourceStepId,
            targetAnchor: targetAnchorOnNewNode,
            originatingSubStepContext: pendingNodeFromDotInfo.creatingFromSubStepContext
                ? { sourceCardId: pendingNodeFromDotInfo.creatingFromSubStepContext.sourceCardId, subStepId: pendingNodeFromDotInfo.creatingFromSubStepContext.subStepId }
                : null
        });
      }
    } else if (canvasRef.current) {
      newStepX = canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2;
      newStepY = canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - calculateNodeHeight({ title: data.title, x:0,y:0,id:'temp',subSteps:[], incomingConnections:[] }) / 2;
    }
    newStepX = Math.max(MIN_CANVAS_PADDING, newStepX); newStepY = Math.max(MIN_CANVAS_PADDING, newStepY);
    const newNode: RoadmapStep = { id: `step-${Date.now()}-${uuidv4().substring(0, 8)}`, title: data.title, description: null, x: newStepX, y: newStepY, subSteps: [], incomingConnections: initialIncomingConnections };
    setEditableRoadmap(prev => [...prev, newNode]); setIsAddStepDialogOpen(false); setPendingNodeFromDotInfo(null);
    toast({ title: "Node Added", description: `"${data.title}" added. Remember to save the plan to persist changes.` });
  }, [canEditPlan, editableRoadmap, pendingNodeFromDotInfo, toast]);

  const updateSubStepPropertiesRecursive = (
    subSteps: RoadmapSubStep[] | undefined,
    targetId: string,
    newTitle: string,
    newDescription: string | null
  ): { updatedSubSteps: RoadmapSubStep[] | undefined, changed: boolean } => {
    if (!subSteps) return { updatedSubSteps: undefined, changed: false };
    let changed = false;
    const updated = subSteps.map(ss => {
      if (ss.id === targetId) {
        changed = true;
        return { ...ss, title: newTitle, description: newDescription };
      }
      if (ss.subSteps && ss.subSteps.length > 0) {
        const nestedResult = updateSubStepPropertiesRecursive(ss.subSteps, targetId, newTitle, newDescription);
        if (nestedResult.changed) changed = true;
        return { ...ss, subSteps: nestedResult.updatedSubSteps };
      }
      return ss;
    });
    return { updatedSubSteps: updated, changed };
  };

  const handleSaveSubStepDetails = useCallback(() => {
    if (!editingStep || !editingSubStep || !canEditPlan) return;
    const { id: subStepIdToUpdate } = editingSubStep;
    const newTitle = currentSubStepTitleEdit.trim() || "Untitled Sub-step";
    const newDescription = currentSubStepDescriptionEdit.trim() || null;

    let mainStepUpdated = false;
    setEditableRoadmap(prevRoadmap =>
      prevRoadmap.map(mainStep => {
        if (mainStep.id === editingStep.id && mainStep.subSteps) {
          const result = updateSubStepPropertiesRecursive(mainStep.subSteps, subStepIdToUpdate, newTitle, newDescription);
          if (result.changed) {
            mainStepUpdated = true;
            return { ...mainStep, subSteps: result.updatedSubSteps };
          }
        }
        return mainStep;
      })
    );
    
    if (mainStepUpdated) {
      setEditingSubStep(prev => prev ? { ...prev, title: newTitle, description: newDescription } : null);
      toast({ title: "Sub-step Saved", description: `Changes to "${newTitle}" saved. Remember to save the plan.` });
    } else {
      toast({ variant: "default", title: "No Changes", description: "No changes detected to save for this sub-step." });
    }
  }, [editingStep, editingSubStep, currentSubStepTitleEdit, currentSubStepDescriptionEdit, canEditPlan, toast]);

  const addSubStepToParentRecursive = (
    subSteps: RoadmapSubStep[] | undefined,
    targetParentId: string,
    newSubStep: RoadmapSubStep
  ): { updatedSubSteps: RoadmapSubStep[] | undefined, added: boolean } => {
    if (!subSteps) return { updatedSubSteps: undefined, added: false };
    let added = false;
    const updated = subSteps.map(ss => {
      if (ss.id === targetParentId) {
        added = true;
        return { ...ss, subSteps: [...(ss.subSteps || []), newSubStep] };
      }
      if (ss.subSteps && ss.subSteps.length > 0) {
        const nestedResult = addSubStepToParentRecursive(ss.subSteps, targetParentId, newSubStep);
        if (nestedResult.added) added = true;
        return { ...ss, subSteps: nestedResult.updatedSubSteps };
      }
      return ss;
    });
    return { updatedSubSteps: updated, added };
  };

  const handleAddSubStepToEditingSubStep = useCallback(() => {
    if (!editingStep || !editingSubStep || !canEditPlan) return;

    const newNestedSubStep: RoadmapSubStep = {
      id: `sub-${Date.now()}-${uuidv4().substring(0, 6)}`,
      parentId: editingSubStep.id,
      title: "New Nested Sub-step",
      description: null,
      subSteps: [],
    };

    // Check if this is the first child being added to editingSubStep (for promotion)
    const isFirstChildForPromotion = (!editingSubStep.subSteps || editingSubStep.subSteps.length === 0);

    if (isFirstChildForPromotion) {
        // Promotion Logic
        setEditableRoadmap(prevRoadmap => {
            const mainParentNode = prevRoadmap.find(rs => rs.id === editingStep.id); // This is the original main parent
            if (!mainParentNode) return prevRoadmap;

            const promotedNodeId = editingSubStep.id; // Use the sub-step's ID as the new main node ID
            const promotedNode: RoadmapStep = {
                id: promotedNodeId,
                title: editingSubStep.title,
                description: editingSubStep.description,
                x: mainParentNode.x + NODE_BASE_WIDTH + 80, // Position to the right
                y: mainParentNode.y,
                subSteps: [newNestedSubStep], // Add the new child
                incomingConnections: [{
                    id: `conn-${uuidv4()}`,
                    sourceNodeId: mainParentNode.id,
                    targetAnchor: 'W', // Connect to West anchor of new node
                    lineType: 'straight',
                    originatingSubStepContext: null, // Main connection for now
                }],
            };

            // Remove the promoted sub-step from its original parent's subSteps array
            const updatedMainParentNodeSubSteps = (mainParentNode.subSteps || []).filter(ss => ss.id !== editingSubStep.id);
            
            // Clean up connections on original parent that might have originated from the promoted sub-step's dot
            const updatedMainParentNodeConnections = (mainParentNode.incomingConnections || []).map(conn => {
                if (conn.originatingSubStepContext?.subStepId === editingSubStep.id) {
                    // This connection was from the promoted sub-step's dot.
                    // It's complex to re-route; for now, let's leave it as is, or decide to remove.
                    // For simplicity here, we might just leave it if the dot UI is robust.
                    // Or, one could decide to remove such specific connections.
                }
                return conn;
            });

            return [
                ...prevRoadmap.filter(rs => rs.id !== mainParentNode.id && rs.id !== promotedNodeId),
                { ...mainParentNode, subSteps: updatedMainParentNodeSubSteps, incomingConnections: updatedMainParentNodeConnections },
                promotedNode,
            ];
        });

        toast({ title: "Sub-step Promoted to Node", description: `"${editingSubStep.title}" is now a main step. Remember to save.` });
        setIsStepDetailSheetOpen(false); // Close sheet as context has changed significantly
        setEditingStep(null);
        setEditingSubStep(null);

    } else {
        // Existing logic: Add as a nested sub-step to the current editingSubStep
        let mainStepUpdated = false;
        setEditableRoadmap(prevRoadmap =>
          prevRoadmap.map(mainStep => {
            if (mainStep.id === editingStep.id && mainStep.subSteps) {
              const result = addSubStepToParentRecursive(mainStep.subSteps, editingSubStep.id, newNestedSubStep);
              if (result.added) {
                mainStepUpdated = true;
                return { ...mainStep, subSteps: result.updatedSubSteps };
              }
            }
            return mainStep;
          })
        );

        if (mainStepUpdated) {
          setEditingSubStep(prev => prev ? { ...prev, subSteps: [...(prev.subSteps || []), newNestedSubStep] } : null);
          toast({ title: "Nested Sub-step Added", description: "Remember to edit its details and save the plan." });
        }
    }
  }, [editingStep, editingSubStep, canEditPlan, toast, setEditableRoadmap, setIsStepDetailSheetOpen]);


  const handleDeleteThisEditingSubStep = useCallback(() => {
    if (editingSubStep && editingStep) {
        setItemToDelete({
            type: 'subStep',
            id: editingSubStep.id,
            title: editingSubStep.title,
            parentStepId: editingStep.id, // The main canvas step
            parentSubStepId: editingSubStep.parentId, // The direct parent sub-step ID, if nested
        });
    }
  }, [editingSubStep, editingStep]);

  const handleDeleteNestedSubStepFromList = useCallback((nestedSubStep: RoadmapSubStep) => {
    if (!editingSubStep || !editingStep) return;
    setItemToDelete({
      type: 'subStep',
      id: nestedSubStep.id,
      title: nestedSubStep.title,
      parentStepId: editingStep.id, 
      parentSubStepId: editingSubStep.id 
    });
  }, [editingStep, editingSubStep]);


  const confirmDeleteItem = useCallback(() => {
    if (!itemToDelete || !canEditPlan) return;
    const { type, id: idToDelete, title, parentStepId, parentSubStepId } = itemToDelete;

    const removeRecursive = (
      subSteps: RoadmapSubStep[] | undefined,
      targetId: string
    ): { updatedList: RoadmapSubStep[] | undefined; foundAndRemoved: boolean } => {
      if (!subSteps) return { updatedList: undefined, foundAndRemoved: false };
      let removed = false;
      const filtered = subSteps.filter(ss => {
        if (ss.id === targetId) {
          removed = true;
          return false;
        }
        if (ss.subSteps && ss.subSteps.length > 0) {
          const nestedResult = removeRecursive(ss.subSteps, targetId);
          ss.subSteps = nestedResult.updatedList;
          if (nestedResult.foundAndRemoved) removed = true;
        }
        return true;
      });
      return { updatedList: filtered, foundAndRemoved: removed };
    };
    
    if (type === 'step') { // Deleting a main canvas step
        setEditableRoadmap(prev => {
            const newRoadmap = prev.filter(s => s.id !== idToDelete);
            // Also remove any connections pointing to this deleted step
            return newRoadmap.map(s => ({
                ...s,
                incomingConnections: (s.incomingConnections || []).filter(conn => conn.sourceNodeId !== idToDelete),
            }));
        });
    } else { // Deleting a sub-step
        setEditableRoadmap(prevRoadmap =>
          prevRoadmap.map(mainStep => {
            // If the sub-step's direct parent is a main canvas step
            if (mainStep.id === parentStepId && mainStep.subSteps && (!parentSubStepId || parentSubStepId === mainStep.id)) {
              const result = removeRecursive(mainStep.subSteps, idToDelete);
              if (result.foundAndRemoved) {
                return { ...mainStep, subSteps: result.updatedList };
              }
            }
            // If the sub-step is nested within another sub-step which is part of this mainStep
            else if (mainStep.id === parentStepId && mainStep.subSteps && parentSubStepId) {
                 const updateNested = (subSteps: RoadmapSubStep[]): RoadmapSubStep[] => {
                    return subSteps.map(ss => {
                        if (ss.id === parentSubStepId) { // Found the direct parent sub-step
                            const result = removeRecursive(ss.subSteps, idToDelete);
                            return result.foundAndRemoved ? { ...ss, subSteps: result.updatedList } : ss;
                        }
                        if (ss.subSteps && ss.subSteps.length > 0) {
                           return {...ss, subSteps: updateNested(ss.subSteps)};
                        }
                        return ss;
                    });
                 };
                 const updatedMainStepSubSteps = updateNested(mainStep.subSteps);
                 return {...mainStep, subSteps: updatedMainStepSubSteps};
            }
            return mainStep;
          })
        );
    }

    toast({ title: `${type === 'step' ? 'Step' : 'Sub-step'} Deleted`, description: `"${title}" removed. Remember to save the plan.`});
    
    if (editingStep?.id === idToDelete && type === 'step') {
      setIsStepDetailSheetOpen(false); setEditingStep(null); setEditingSubStep(null);
    } else if (editingSubStep?.id === idToDelete && type === 'subStep') {
      const parentIsMainStep = parentSubStepId === editingStep?.id || !parentSubStepId;
      if (parentIsMainStep) {
        setEditingSubStep(null);
      } else if (editingStep && parentSubStepId) {
        // Try to find and set the parent sub-step as active for editing
        const findParentRecursive = (subSteps: RoadmapSubStep[] | undefined, targetId: string): RoadmapSubStep | null => {
          if (!subSteps) return null;
          for (const ss of subSteps) {
            if (ss.id === targetId) return ss;
            if (ss.subSteps) {
              const found = findParentRecursive(ss.subSteps, targetId);
              if (found) return found;
            }
          }
          return null;
        };
        const parent = findParentRecursive(editingStep.subSteps, parentSubStepId);
        if (parent) {
          setEditingSubStep(parent);
          setCurrentSubStepTitleEdit(parent.title);
          setCurrentSubStepDescriptionEdit(parent.description || "");
        } else {
          setEditingSubStep(null);
        }
      } else {
        setEditingSubStep(null);
      }
    } else if (type === 'subStep' && editingSubStep && parentSubStepId === editingSubStep.id) {
      // If a child of the currently viewed sub-step was deleted, refresh its list
      setEditingSubStep(prev => {
        if (!prev || !prev.subSteps) return prev;
        const result = removeRecursive(prev.subSteps, idToDelete);
        return result.foundAndRemoved ? { ...prev, subSteps: result.updatedList } : prev;
      });
    }
    setItemToDelete(null);
  }, [itemToDelete, canEditPlan, toast, editingStep, editingSubStep]);

  const handleStepDetailUpdate = useCallback((updatedStep: RoadmapStep) => {
    if (!canEditPlan) return;
    setEditableRoadmap(prev => prev.map(s => s.id === updatedStep.id ? updatedStep : s));
    toast({ title: "Step Updated", description: `"${updatedStep.title}" details changed. Remember to save the plan.`});
    setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);
  }, [canEditPlan, toast]);

  const handleDeleteStepRequest = useCallback((stepId: string, stepTitle: string) => {
    setItemToDelete({ type: 'step', id: stepId, title: stepTitle, parentStepId: stepId });
  }, []);
  
  const saveRoadmapChanges = useCallback(async () => {
    if (!planData || !user || !planId || !canEditPlan) { toast({ variant: "destructive", title: "Error", description: "Cannot save: Plan data, user auth, or permissions missing." }); return; }
    saveRoadmapMutation.mutate({ planId, currentUserId: user.uid, roadmap: editableRoadmap });
  }, [planData, user, planId, canEditPlan, editableRoadmap, saveRoadmapMutation, toast]);

  const sharePlan = useCallback(async () => { try { await navigator.clipboard.writeText(window.location.href); toast({ title: "Link Copied!", description: "Plan URL copied to clipboard." }); } catch (err) { toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy link to clipboard." }); } }, [toast]);
  const handleLineClick = useCallback((event: React.MouseEvent<SVGPathElement>, targetNodeId: string, connectionId: string) => {
    if (!canEditPlan) return; event.preventDefault(); event.stopPropagation(); const canvasRect = canvasRef.current?.getBoundingClientRect(); if (!canvasRect) return;
    setLineContextMenu({ isOpen: true, x: event.clientX - canvasRect.left, y: event.clientY - canvasRect.top, targetNodeId: targetNodeId, connectionId: connectionId });
  }, [canEditPlan]);
  const handleDeleteLine = useCallback((targetNodeId: string, connectionId: string) => {
    if (!canEditPlan) return;
    setEditableRoadmap(prev => prev.map(step => step.id === targetNodeId ? { ...step, incomingConnections: (step.incomingConnections || []).filter(conn => conn.id !== connectionId) } : step ));
    toast({ title: "Connection Removed", description: "Line deleted. Remember to save the plan." }); setLineContextMenu(null);
  }, [canEditPlan, toast]);
  const handleSetSelectedLineType = useCallback((targetNodeId: string, connectionId: string, newLineType: 'straight' | 'curved' | 'acute') => {
    if (!canEditPlan) return;
    setEditableRoadmap(prev => prev.map(step => step.id === targetNodeId ? { ...step, incomingConnections: (step.incomingConnections || []).map(conn => conn.id === connectionId ? { ...conn, lineType: newLineType } : conn) } : step ));
    toast({ title: "Line Type Set", description: `Line type changed. Remember to save the plan.` }); setLineContextMenu(null);
  }, [canEditPlan, toast]);
  const handleOpenSetLineLabelDialog = useCallback(() => {
    if (lineContextMenu) { const targetNode = editableRoadmap.find(s => s.id === lineContextMenu.targetNodeId); const connection = targetNode?.incomingConnections?.find(c => c.id === lineContextMenu.connectionId); setCurrentLineEditLabel(connection?.label || ""); setIsLineEditLabelAlertOpen(true); }
  }, [lineContextMenu, editableRoadmap]);
  const handleConfirmSetLineLabel = useCallback(() => {
    if (lineContextMenu && canEditPlan) {
      setEditableRoadmap(prev => prev.map(step => step.id === lineContextMenu.targetNodeId ? { ...step, incomingConnections: (step.incomingConnections || []).map(conn => conn.id === lineContextMenu.connectionId ? { ...conn, label: currentLineEditLabel.trim() || null } : conn) } : step ));
      toast({ title: "Line Label Set", description: "Label updated. Remember to save the plan." });
    }
    setIsLineEditLabelAlertOpen(false); setLineContextMenu(null); setCurrentLineEditLabel("");
  }, [lineContextMenu, currentLineEditLabel, canEditPlan, toast]);

  const handleNodeInteractionStart = useCallback((nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (('button' in event && (event as React.MouseEvent).button !== 0) || !canEditPlan || !canvasRef.current) return;
    if (lineContextMenu?.isOpen) setLineContextMenu(null);
    const { clientX, clientY } = getPointerCoords(event);
    const nodeElement = event.currentTarget as HTMLDivElement;
    const nodeRect = nodeElement.getBoundingClientRect();
    const offsetX = clientX - nodeRect.left;
    const offsetY = clientY - nodeRect.top;
    nodeDragInfoRef.current = { type: 'node', nodeId, offsetX, offsetY };
    connectionDragInfoRef.current = null;
    clickStartInfoRef.current = { clientX, clientY, timestamp: Date.now(), targetElement: event.currentTarget };
    isDraggingRef.current = false;
    setIsPointerDown(true);
  }, [canEditPlan, getPointerCoords, lineContextMenu, setIsPointerDown]);

  const handleDotInteractionStart = useCallback((parentNodeId: string, clickedAnchor: 'N' | 'S' | 'E' | 'W', event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>, subStepOriginContext?: { sourceCardId: string; subStepId: string; subStepTitle: string }) => {
    if (('button' in event && (event as React.MouseEvent).button !== 0) || !canEditPlan || !canvasRef.current) return;
    if (lineContextMenu?.isOpen) setLineContextMenu(null);
    const { clientX, clientY } = getPointerCoords(event);
    const dotElement = event.currentTarget as HTMLElement;
    const dotCenterCanvas = getElementCenter(dotElement);
    connectionDragInfoRef.current = { type: 'connectionDot', sourceStepId: parentNodeId, sourceAnchor: clickedAnchor, startX: dotCenterCanvas.x, startY: dotCenterCanvas.y, sourceSubStepContext: subStepOriginContext || null };
    nodeDragInfoRef.current = null;
    clickStartInfoRef.current = { clientX, clientY, timestamp: Date.now(), targetElement: event.currentTarget };
    isDraggingRef.current = false;
    setIsPointerDown(true);
  }, [canEditPlan, getElementCenter, getPointerCoords, lineContextMenu, setIsPointerDown]);

  const handleGlobalMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isPointerDown || !canvasRef.current || (!nodeDragInfoRef.current && !connectionDragInfoRef.current)) return;

    const { clientX, clientY } = getPointerCoords(event);
    if (clickStartInfoRef.current && !isDraggingRef.current) {
      const deltaX = clientX - clickStartInfoRef.current.clientX;
      const deltaY = clientY - clickStartInfoRef.current.clientY;
      if ((deltaX * deltaX + deltaY * deltaY) > CLICK_MOVE_THRESHOLD_PX_SQ) {
        isDraggingRef.current = true;
      }
    }

    if (isDraggingRef.current) {
      if (event.cancelable) event.preventDefault();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const currentX = clientX - canvasRect.left + canvasRef.current.scrollLeft;
      const currentY = clientY - canvasRect.top + canvasRef.current.scrollTop;

      if (nodeDragInfoRef.current) {
        const { nodeId, offsetX = 0, offsetY = 0 } = nodeDragInfoRef.current;
        let newX = currentX - offsetX; let newY = currentY - offsetY;
        newX = Math.max(MIN_CANVAS_PADDING, newX); newY = Math.max(MIN_CANVAS_PADDING, newY);
        setEditableRoadmap(prev => prev.map(step => step.id === nodeId ? { ...step, x: newX, y: newY } : step));
      } else if (connectionDragInfoRef.current) {
        const { startX, startY, sourceSubStepContext } = connectionDragInfoRef.current;
        setActiveConnectionLinePreview({ startX, startY, currentX, currentY, isFromSubStep: !!sourceSubStepContext });
      }
    }
  }, [isPointerDown, getPointerCoords, setEditableRoadmap, setActiveConnectionLinePreview]);

  const handleGlobalPointerUp = useCallback((event: MouseEvent | TouchEvent) => {
    const clickInfo = clickStartInfoRef.current;
    const finalCoords = getPointerCoords(event);

    if (nodeDragInfoRef.current) {
      if (!isDraggingRef.current && clickInfo) {
        const timeElapsed = Date.now() - clickInfo.timestamp;
        const deltaX = finalCoords.clientX - clickInfo.clientX;
        const deltaY = finalCoords.clientY - clickInfo.clientY;
        if ((deltaX * deltaX + deltaY * deltaY) < CLICK_MOVE_THRESHOLD_PX_SQ && timeElapsed < CLICK_TIME_THRESHOLD_MS) {
          const clickedStep = editableRoadmap.find(s => s.id === nodeDragInfoRef.current!.nodeId);
          if (clickedStep) handleEditStep(clickedStep);
        }
      }
    } else if (connectionDragInfoRef.current) {
      const { sourceStepId, sourceAnchor, sourceSubStepContext } = connectionDragInfoRef.current;
      if (isDraggingRef.current && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const releaseX = finalCoords.clientX - canvasRect.left + canvasRef.current.scrollLeft;
        const releaseY = finalCoords.clientY - canvasRect.top + canvasRef.current.scrollTop;
        let snapped = false;
        for (const targetStep of editableRoadmap) {
          if (targetStep.id === sourceStepId) continue;
          const targetAnchors: ('N'|'S'|'E'|'W')[] = ['N', 'S', 'E', 'W'];
          for (const targetAnchorOnTargetNode of targetAnchors) {
            const targetDotPos = getAnchorPoint(targetStep, targetAnchorOnTargetNode);
            const dist = Math.sqrt(Math.pow(releaseX - targetDotPos.x, 2) + Math.pow(releaseY - targetDotPos.y, 2));
            if (dist <= SNAP_THRESHOLD) {
              const alreadyConnected = (targetStep.incomingConnections || []).some(conn => {
                const existingConnIsFromSubStep = !!conn.originatingSubStepContext;
                const newDragIsFromSubStep = !!sourceSubStepContext;
                if (conn.sourceNodeId !== sourceStepId || conn.targetAnchor !== targetAnchorOnTargetNode) return false;
                if (newDragIsFromSubStep && existingConnIsFromSubStep) {
                  return conn.originatingSubStepContext!.sourceCardId === sourceStepId &&
                         conn.originatingSubStepContext!.subStepId === sourceSubStepContext!.subStepId;
                } else if (!newDragIsFromSubStep && !existingConnIsFromSubStep) {
                  return true;
                }
                return false;
              });

              if (alreadyConnected) {
                toast({ variant: "default", title: "Already Connected", description: `Node "${targetStep.title}" is already connected from this specific source point.` });
                snapped = true; break;
              }

              const newConnection: IncomingConnection = {
                id: `conn-${uuidv4()}`,
                lineType: 'straight',
                sourceNodeId: sourceStepId,
                targetAnchor: targetAnchorOnTargetNode,
                originatingSubStepContext: sourceSubStepContext ? { sourceCardId: sourceStepId, subStepId: sourceSubStepContext.subStepId } : null,
              };
              setEditableRoadmap(prev => {
                return prev.map(s => {
                  if (s.id === targetStep.id) {
                    return { ...s, incomingConnections: [...(s.incomingConnections || []), newConnection] };
                  }
                  return s;
                });
              });
              toast({ title: "Nodes Connected", description: "Connection created. Remember to save the plan."});
              snapped = true; break;
            }
          }
          if (snapped) break;
        }
      } else if (clickInfo) {
        const parentNode = editableRoadmap.find(s => s.id === sourceStepId);
        if (parentNode) {
            setPendingNodeFromDotInfo({ sourceStepId: parentNode.id, sourceAnchor: sourceAnchor!, creatingFromSubStepContext: sourceSubStepContext || undefined });
            setIsAddStepDialogOpen(true);
        }
      }
    }
    nodeDragInfoRef.current = null;
    connectionDragInfoRef.current = null;
    clickStartInfoRef.current = null;
    isDraggingRef.current = false;
    setActiveConnectionLinePreview(null);
    setIsPointerDown(false);
  }, [
    isPointerDown, getPointerCoords, editableRoadmap, handleEditStep, getAnchorPoint,
    setEditableRoadmap, toast, setIsAddStepDialogOpen, setPendingNodeFromDotInfo,
    setActiveConnectionLinePreview, setIsPointerDown
  ]);

  useEffect(() => {
    if (isPointerDown) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('touchmove', handleGlobalMove, { passive: false });
      window.addEventListener('mouseup', handleGlobalPointerUp);
      window.addEventListener('touchend', handleGlobalPointerUp);
      window.addEventListener('touchcancel', handleGlobalPointerUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('touchend', handleGlobalPointerUp);
      window.removeEventListener('touchcancel', handleGlobalPointerUp);
    };
  }, [isPointerDown, handleGlobalMove, handleGlobalPointerUp]);

  useEffect(() => {
    if (!isStepDetailSheetOpen) {
      setEditingStep(null);
      setEditingSubStep(null);
      setIsEditingNodeTitle(false);
      setIsEditingNodeDescription(false);
      setCurrentSubStepTitleEdit("");
      setCurrentSubStepDescriptionEdit("");
    }
  }, [isStepDetailSheetOpen]);

  useEffect(() => {
    if (editingSubStep) {
        setCurrentSubStepTitleEdit(editingSubStep.title);
        setCurrentSubStepDescriptionEdit(editingSubStep.description || "");
    } else {
        setCurrentSubStepTitleEdit("");
        setCurrentSubStepDescriptionEdit("");
    }
  }, [editingSubStep]);

  const getAnchorAxisVector = (anchor: 'N' | 'S' | 'E' | 'W'): { x: number, y: number } => {
    switch (anchor) { case 'N': return { x: 0, y: -1 }; case 'S': return { x: 0, y: 1 }; case 'E': return { x: 1, y: 0 }; case 'W': return { x: -1, y: 0 }; default: return { x: 0, y: 0 }; }
  };

  const drawConnectionLines = () => {
    return editableRoadmap.flatMap(targetStep => {
      if (!targetStep.incomingConnections || targetStep.incomingConnections.length === 0) return [];
      return targetStep.incomingConnections.map((incomingConn) => {
        if (!incomingConn.id || !incomingConn.sourceNodeId) return null;
        const sourceNode = editableRoadmap.find(s => s.id === incomingConn.sourceNodeId);
        if (!sourceNode) return null;

        let rawStartPoint: { x: number, y: number }, sourceVisualAnchor: 'N' | 'S' | 'E' | 'W', sourceVisualRadius: number, currentLineThicknessToUse: number, currentLineColor: string, currentMarkerId: string;

        if (incomingConn.originatingSubStepContext && incomingConn.originatingSubStepContext.sourceCardId === sourceNode.id) {
          rawStartPoint = getSubStepDotAnchorPoint(sourceNode, incomingConn.originatingSubStepContext.subStepId);
          sourceVisualAnchor = 'W';
          sourceVisualRadius = SUB_STEP_DOT_VISUAL_DIAMETER / 2;
          currentLineThicknessToUse = CONNECTION_LINE_THICKNESS;
          currentLineColor = SUBSTEP_CONNECTION_LINE_COLOR; 
          currentMarkerId = 'url(#arrowhead-substep)';
        } else {
          const tempRawEndPoint = getAnchorPoint(targetStep, incomingConn.targetAnchor);
          let bestAnchor: 'N' | 'S' | 'E' | 'W' = 'S';
          let minDistanceSq = Infinity;
          const availableSourceAnchors: ('N'|'S'|'E'|'W')[] = (sourceNode.subSteps && sourceNode.subSteps.length > 0) ? ['N', 'S', 'E'] : ['N', 'S', 'E', 'W'];
          availableSourceAnchors.forEach(anchor => {
            const tempRawStart = getAnchorPoint(sourceNode, anchor);
            const distSq = Math.pow(tempRawEndPoint.x - tempRawStart.x, 2) + Math.pow(tempRawEndPoint.y - tempRawStart.y, 2);
            if (distSq < minDistanceSq) { minDistanceSq = distSq; bestAnchor = anchor; }
          });
          sourceVisualAnchor = bestAnchor;
          rawStartPoint = getAnchorPoint(sourceNode, sourceVisualAnchor);
          sourceVisualRadius = (SUB_STEP_DOT_VISUAL_DIAMETER / 2);
          currentLineThicknessToUse = CONNECTION_LINE_THICKNESS_MAIN;
          currentLineColor = MAIN_CONNECTION_LINE_COLOR; 
          currentMarkerId = 'url(#arrowhead-main)';
        }

        const rawEndPoint = getAnchorPoint(targetStep, incomingConn.targetAnchor);
        const targetVisualAnchor = incomingConn.targetAnchor;
        const targetVisualRadius = (SUB_STEP_DOT_VISUAL_DIAMETER / 2);

        const sourceAxisVec = getAnchorAxisVector(sourceVisualAnchor);
        const targetAxisVec = getAnchorAxisVector(targetVisualAnchor);

        const lineStartOffset = sourceVisualRadius + (currentLineThicknessToUse / 2);
        const lineEndOffset = targetVisualRadius + (currentLineThicknessToUse / 2) + ARROWHEAD_LENGTH;

        const lineStartPoint = { x: rawStartPoint.x + sourceAxisVec.x * lineStartOffset, y: rawStartPoint.y + sourceAxisVec.y * lineStartOffset };
        const lineEndPointForArrow = { x: rawEndPoint.x - targetAxisVec.x * lineEndOffset, y: rawEndPoint.y - targetAxisVec.y * lineEndOffset };

        const overallDistance = Math.sqrt(Math.pow(rawEndPoint.x - rawStartPoint.x, 2) + Math.pow(rawEndPoint.y - rawStartPoint.y, 2));
        const isTooShortForNecks = overallDistance < lineStartOffset + (NECK_LENGTH * 2) + MIN_MAIN_PATH_LENGTH + lineEndOffset;
        let pathData = "";
        const lineType = incomingConn.lineType || 'straight';
        if (isTooShortForNecks || lineType === 'straight') {
            pathData = `M ${lineStartPoint.x} ${lineStartPoint.y} L ${lineEndPointForArrow.x} ${lineEndPointForArrow.y}`;
        } else {
            const neck1End = { x: lineStartPoint.x + sourceAxisVec.x * NECK_LENGTH, y: lineStartPoint.y + sourceAxisVec.y * NECK_LENGTH };
            const neck2Start = { x: lineEndPointForArrow.x - targetAxisVec.x * NECK_LENGTH, y: lineEndPointForArrow.y - targetAxisVec.y * NECK_LENGTH };
            switch (lineType) {
                case 'curved':
                    const curveMidX = (neck1End.x + neck2Start.x) / 2; const curveMidY = (neck1End.y + neck2Start.y) / 2;
                    const controlDx = -(neck2Start.y - neck1End.y); const controlDy = neck2Start.x - neck1End.x;
                    const curveSegmentLength = Math.sqrt(Math.pow(neck2Start.x - neck1End.x, 2) + Math.pow(neck2Start.y - neck1End.y, 2));
                    const curveFactor = 0.4;
                    const controlX = curveSegmentLength === 0 ? curveMidX : curveMidX + (controlDx / curveSegmentLength) * curveSegmentLength * curveFactor;
                    const controlY = curveSegmentLength === 0 ? curveMidY : curveMidY + (controlDy / curveSegmentLength) * curveSegmentLength * curveFactor;
                    pathData = `M ${lineStartPoint.x} ${lineStartPoint.y} L ${neck1End.x} ${neck1End.y} Q ${controlX} ${controlY}, ${neck2Start.x} ${neck2Start.y} L ${lineEndPointForArrow.x} ${lineEndPointForArrow.y}`;
                    break;
                case 'acute':
                    const deltaX_elbow = neck2Start.x - neck1End.x; const deltaY_elbow = neck2Start.y - neck1End.y;
                    pathData = `M ${lineStartPoint.x} ${lineStartPoint.y} L ${neck1End.x} ${neck1End.y}`;
                    if (Math.abs(deltaX_elbow) >= Math.abs(deltaY_elbow)) { pathData += ` L ${neck1End.x + deltaX_elbow / 2} ${neck1End.y}`; pathData += ` L ${neck1End.x + deltaX_elbow / 2} ${neck2Start.y}`;
                    } else { pathData += ` L ${neck1End.x} ${neck1End.y + deltaY_elbow / 2}`; pathData += ` L ${neck2Start.x} ${neck1End.y + deltaY_elbow / 2}`; }
                    pathData += ` L ${neck2Start.x} ${neck2Start.y} L ${lineEndPointForArrow.x} ${lineEndPointForArrow.y}`;
                    break;
                default: pathData = `M ${lineStartPoint.x} ${lineStartPoint.y} L ${lineEndPointForArrow.x} ${lineEndPointForArrow.y}`;
            }
        }
        const labelMidX = (rawStartPoint.x + rawEndPoint.x) / 2; const labelMidY = (rawStartPoint.y + rawEndPoint.y) / 2;
        return (
          <g key={incomingConn.id}>
            <path d={pathData} stroke="transparent" strokeWidth={currentLineThicknessToUse + 12} fill="none" className="cursor-pointer" onClick={(e) => handleLineClick(e, targetStep.id, incomingConn.id!)} style={{pointerEvents: "stroke"}} />
            <path d={pathData} stroke={currentLineColor} strokeWidth={currentLineThicknessToUse} fill="none" markerEnd={currentMarkerId} style={{pointerEvents: "none"}} />
            {incomingConn.label && (<text x={labelMidX} y={labelMidY} fill="hsl(var(--foreground))" fontSize="10" textAnchor="middle" dominantBaseline="central" className="pointer-events-none select-none">{incomingConn.label}</text>)}
          </g>
        );
      });
    }).filter(path => path !== null);
  };

  const handleRestoreVersion = (version: ClientPlanVersion) => {
    setVersionToRestore(version);
    setIsRestoreConfirmOpen(true);
  };

  const confirmRestore = () => {
    if (versionToRestore && user && planId) {
      restorePlanMutation.mutate({
        planId,
        versionIdToRestore: versionToRestore.id,
        currentUserId: user.uid,
      });
    }
  };


  if (authLoading || (isLoadingPlan && isValidPlanId)) { return <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>; }
  if (!planId || !isValidPlanId) { return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><AlertTriangle className="h-10 w-10 text-destructive mb-2" /><h1 className="text-xl font-semibold">Invalid Plan ID</h1><p className="text-muted-foreground">The plan identifier in the URL is not valid.</p><Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button></div>); }
  if (planError) { return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><AlertTriangle className="h-10 w-10 text-destructive mb-2" /><h1 className="text-xl font-semibold">Error Loading Plan</h1><p className="text-muted-foreground">{planError.message || "Could not load plan."}</p><Button onClick={() => router.back()} className="mt-4">Go Back</Button></div>); }
  if (!planData) { return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><Map className="h-10 w-10 text-muted-foreground mb-2" /><h1 className="text-xl font-semibold">Plan Not Found</h1><p className="text-muted-foreground">This collaboration plan does not exist or you do not have permission to view it.</p><Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button></div>); }

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden">
      <header className="h-12 flex-shrink-0 bg-card border-b border-border flex items-center px-3 shadow-sm">
        <div className="flex items-center gap-2">
            <Link href="/discover" className="p-1 rounded hover:bg-muted" aria-label="Back to Discover Page"><ChevronLeft className="h-6 w-6 text-primary" /></Link>
            <div className="h-5 w-px bg-border"></div>
            <h1 className="text-sm font-semibold text-foreground truncate" title={planData.name}>{planData.name}</h1>
            {user?.uid === planData.ownerId && <Badge variant="outline" className="text-xs ml-2 hidden sm:inline-flex">Owner</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-2">
            {canEditPlan && (<Button variant="outline" size="sm" className="h-8" onClick={() => setIsAddStepDialogOpen(true)} disabled={saveRoadmapMutation.isPending}><Plus className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">+ Node</span><span className="sm:hidden">+</span></Button>)}
            {canEditPlan && (<Button variant="default" size="sm" className="h-8" onClick={saveRoadmapChanges} disabled={saveRoadmapMutation.isPending}>{saveRoadmapMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}<span className="hidden sm:inline">Save Plan</span><span className="sm:hidden">Save</span></Button>)}
            <Button variant="outline" size="sm" className="h-8" onClick={() => setIsVersionHistorySheetOpen(true)}><History className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">History</span><span className="sm:hidden">Hist.</span></Button>
            <Button variant="outline" size="sm" className="h-8" onClick={sharePlan}><Share2 className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">Share</span><span className="sm:hidden">Share</span></Button>
            {user && (<Avatar className="h-7 w-7"><AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} /><AvatarFallback className="text-xs">{user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}</AvatarFallback></Avatar>)}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main ref={canvasRef} className="flex-1 grid-background relative overflow-auto p-4 md:p-6" style={{ minHeight: canvasMinHeight }} onClick={() => { if (lineContextMenu?.isOpen) setLineContextMenu(null); }}>
          <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
                <marker id="arrowhead-main" viewBox={`0 0 ${ARROWHEAD_LENGTH} ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} markerWidth={ARROWHEAD_LENGTH} markerHeight={ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR} refX={ARROWHEAD_LENGTH / 2} refY={(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2} orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points={`0 0, ${ARROWHEAD_LENGTH} ${(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2}, 0 ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} fill={MAIN_CONNECTION_LINE_COLOR}/></marker>
                <marker id="arrowhead-substep" viewBox={`0 0 ${ARROWHEAD_LENGTH} ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} markerWidth={ARROWHEAD_LENGTH} markerHeight={ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR} refX={ARROWHEAD_LENGTH / 2} refY={(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2} orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points={`0 0, ${ARROWHEAD_LENGTH} ${(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2}, 0 ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} fill={SUBSTEP_CONNECTION_LINE_COLOR}/></marker>
            </defs>
            {drawConnectionLines()}
            {activeConnectionLinePreview && (<line x1={activeConnectionLinePreview.startX} y1={activeConnectionLinePreview.startY} x2={activeConnectionLinePreview.currentX} y2={activeConnectionLinePreview.currentY} stroke={activeConnectionLinePreview.isFromSubStep ? SUBSTEP_CONNECTION_LINE_COLOR : MAIN_CONNECTION_LINE_COLOR} strokeWidth={activeConnectionLinePreview.isFromSubStep ? CONNECTION_LINE_THICKNESS + 1 : CONNECTION_LINE_THICKNESS_MAIN + 1} strokeDasharray="4 4" markerEnd={activeConnectionLinePreview.isFromSubStep ? 'url(#arrowhead-substep)' : 'url(#arrowhead-main)'} />)}
          </svg>
          {editableRoadmap.length === 0 && !isLoadingPlan && (<div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none"><Map className="h-16 w-16 mb-4" /><p className="text-lg font-medium">Collaboration Plan Area</p><p className="text-sm mt-1">{canEditPlan ? "Click '+ Node' to add your first step to the roadmap." : "This plan currently has no steps defined."}</p></div>)}
          {editableRoadmap.map(step => (<RoadmapStepCard key={step.id} step={step} onNodeInteractionStart={handleNodeInteractionStart} onDotInteractionStart={handleDotInteractionStart} isSelected={editingStep?.id === step.id && !editingSubStep} isSubmitting={saveRoadmapMutation.isPending} onEditStep={handleEditStep} onSubStepSelect={handleEditDirectSubStep} isActuallyDraggingThisNode={isDraggingRef.current && nodeDragInfoRef.current?.nodeId === step.id}/>))}
          <Popover open={lineContextMenu?.isOpen || false} onOpenChange={(open) => { if (!open) setLineContextMenu(null); }}><PopoverTrigger asChild><div className="fixed" style={{ left: `${lineContextMenu?.x || 0}px`, top: `${lineContextMenu?.y || 0}px`, width: 0, height: 0 }} /></PopoverTrigger>
            <PopoverContent className="w-auto p-1" side="right" align="start" sideOffset={5}>
              {lineContextMenu && canEditPlan && (
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => handleDeleteLine(lineContextMenu.targetNodeId, lineContextMenu.connectionId)}><MinusCircle className="mr-2 h-3.5 w-3.5 text-destructive"/> Delete Line</Button>
                  <DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="justify-start text-xs"><TypeIcon className="mr-2 h-3.5 w-3.5"/> Set Line Type</Button></DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" sideOffset={5} className="w-40">
                      <DropdownMenuItem onClick={() => handleSetSelectedLineType(lineContextMenu.targetNodeId, lineContextMenu.connectionId, 'straight')}>Straight</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSetSelectedLineType(lineContextMenu.targetNodeId, lineContextMenu.connectionId, 'curved')}>Curved</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSetSelectedLineType(lineContextMenu.targetNodeId, lineContextMenu.connectionId, 'acute')}>Acute (Elbow)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={handleOpenSetLineLabelDialog}><LineLabelIcon className="mr-2 h-3.5 w-3.5"/> Add/Edit Label</Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </main>
      </div>
      <AddRoadmapStepDialog isOpen={isAddStepDialogOpen} onOpenChange={setIsAddStepDialogOpen} onSubmit={handleAddRoadmapStepSubmit} isSubmitting={saveRoadmapMutation.isPending} parentStepTitle={pendingNodeFromDotInfo?.sourceStepId ? editableRoadmap.find(s => s.id === pendingNodeFromDotInfo.sourceStepId)?.title : null} dialogTitle={pendingNodeFromDotInfo?.creatingFromSubStepContext?.subStepTitle ? `New Step from "${pendingNodeFromDotInfo.creatingFromSubStepContext.subStepTitle}" (Anchor: ${pendingNodeFromDotInfo.sourceAnchor})` : undefined} />
      <Sheet open={isStepDetailSheetOpen} onOpenChange={(open) => { if (!open) { setEditingStep(null); setEditingSubStep(null); } setIsStepDetailSheetOpen(open); setIsEditingNodeTitle(false); setIsEditingNodeDescription(false); setCurrentSubStepTitleEdit(""); setCurrentSubStepDescriptionEdit("");}}>
        <SheetContent className="sm:max-w-md flex flex-col">
          {editingSubStep && editingStep ? ( 
            <>
              <SheetHeader className="border-b pb-3">
                <SheetTitle>Sub-step: {editingSubStep.title}</SheetTitle>
                <SheetDescription>Parent Step: {editingStep.title}</SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-grow min-h-0"><div className="p-4 space-y-4">
                <div>
                  <Label htmlFor="sheet-substep-title-edit">Sub-step Title</Label>
                  <Input id="sheet-substep-title-edit" value={currentSubStepTitleEdit} onChange={(e) => setCurrentSubStepTitleEdit(e.target.value)} disabled={!canEditPlan || saveRoadmapMutation.isPending} />
                </div>
                <div>
                  <Label htmlFor="sheet-substep-description-edit">Description (Optional)</Label>
                  <Textarea id="sheet-substep-description-edit" value={currentSubStepDescriptionEdit} onChange={(e) => setCurrentSubStepDescriptionEdit(e.target.value)} disabled={!canEditPlan || saveRoadmapMutation.isPending} rows={3} />
                </div>
                <div className="space-y-2 mt-4">
                  <Label>Nested Sub-steps</Label>
                  {(editingSubStep.subSteps && editingSubStep.subSteps.length > 0) ? (
                    <ul className="space-y-1.5 border p-2 rounded-md max-h-40 overflow-y-auto">
                      {editingSubStep.subSteps.map((nestedSub) => (
                        <li key={nestedSub.id} className="flex items-center justify-between gap-2 text-sm p-1 hover:bg-muted/30 rounded">
                          <span className="truncate" title={nestedSub.title}>{nestedSub.title}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6 p-1" onClick={() => handleEditNestedSubStep(nestedSub)} title={`Edit nested sub-step: ${nestedSub.title}`} disabled={!canEditPlan || saveRoadmapMutation.isPending}><Edit2 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-destructive hover:text-destructive" onClick={() => handleDeleteNestedSubStepFromList(nestedSub)} title={`Delete nested sub-step: ${nestedSub.title}`} disabled={!canEditPlan || saveRoadmapMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (<p className="text-xs text-muted-foreground italic">No nested sub-steps yet.</p>)}
                  {canEditPlan && (
                    <Button type="button" variant="outline" size="xs" onClick={handleAddSubStepToEditingSubStep} disabled={saveRoadmapMutation.isPending}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Nested Sub-step
                    </Button>
                  )}
                </div>
              </div></ScrollArea>
              <SheetFooter className="p-4 mt-auto border-t pt-4 flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <Button type="button" variant="destructive" size="icon" onClick={handleDeleteThisEditingSubStep} disabled={!canEditPlan || saveRoadmapMutation.isPending} className="sm:mr-auto" title={`Delete Sub-step: ${editingSubStep.title}`}>
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete This Sub-step</span>
                </Button>
                <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
                  <Button type="button" variant="outline" onClick={() => {setEditingSubStep(null); setCurrentSubStepTitleEdit(""); setCurrentSubStepDescriptionEdit(""); }} disabled={saveRoadmapMutation.isPending} className="w-full sm:w-auto">Back to Parent Step's List</Button>
                  <Button type="button" onClick={handleSaveSubStepDetails} disabled={!canEditPlan || saveRoadmapMutation.isPending || !currentSubStepTitleEdit.trim()} className="w-full sm:w-auto">{saveRoadmapMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Sub-step Changes</Button>
                </div>
              </SheetFooter>
            </>
          ) : editingStep ? ( 
            <>
              <SheetHeader className="border-b pb-3"><SheetTitle>Step: {editingStep.title}</SheetTitle><SheetDescription>Modify details and sub-steps.</SheetDescription></SheetHeader>
              <ScrollArea className="flex-grow min-h-0"><div className="p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="sheet-step-title">Title</Label>
                    {canEditPlan && (<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingNodeTitle(prev => !prev)} title={isEditingNodeTitle ? "Finish Editing Title" : "Edit Title"}><Edit2 className="h-3.5 w-3.5" /></Button>)}
                  </div>
                  <Input id="sheet-step-title" value={editingStep.title} onChange={(e) => setEditingStep(prev => prev ? { ...prev, title: e.target.value } : null)} disabled={!isEditingNodeTitle || !canEditPlan || saveRoadmapMutation.isPending} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="sheet-step-description">Description</Label>
                    {canEditPlan && (<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingNodeDescription(prev => !prev)} title={isEditingNodeDescription ? "Finish Editing Description" : "Edit Description"}><Edit2 className="h-3.5 w-3.5" /></Button>)}
                  </div>
                  <Textarea id="sheet-step-description" value={editingStep.description || ""} onChange={(e) => setEditingStep(prev => prev ? { ...prev, description: e.target.value } : null)} rows={4} disabled={!isEditingNodeDescription || !canEditPlan || saveRoadmapMutation.isPending} />
                </div>
                <div className="space-y-2"><Label>Sub-steps</Label>
                  {(editingStep.subSteps && editingStep.subSteps.length > 0) ? (<ul className="space-y-1.5 border p-2 rounded-md max-h-60 overflow-y-auto">
                      {editingStep.subSteps.map((sub) => (
                         <li key={sub.id} className="flex items-center justify-between gap-2 text-sm p-1 hover:bg-muted/30 rounded">
                            <span className="truncate" title={sub.title}>{sub.title}</span>
                            {canEditPlan && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-1" onClick={() => handleEditDirectSubStep(sub, editingStep!)} title={`Edit sub-step: ${sub.title}`} disabled={saveRoadmapMutation.isPending}><Edit2 className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-destructive hover:text-destructive" onClick={() => setItemToDelete({type: 'subStep', id: sub.id, title: sub.title, parentStepId: editingStep!.id, parentSubStepId: editingStep!.id })} title={`Delete sub-step: ${sub.title}`} disabled={saveRoadmapMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            )}
                        </li>
                      ))}
                    </ul>) : (<p className="text-xs text-muted-foreground italic">No sub-steps yet.</p>)}
                  {canEditPlan && (<Button type="button" variant="outline" size="xs" onClick={() => { if (!editingStep) return; const newSubStep: RoadmapSubStep = { id: `sub-${Date.now()}-${uuidv4().substring(0,6)}`, parentId: editingStep.id, title: "New Sub-step", description: null, subSteps: [] }; setEditingStep(prev => prev ? { ...prev, subSteps: [...(prev.subSteps || []), newSubStep] } : null);}} disabled={saveRoadmapMutation.isPending}><Plus className="mr-1 h-3.5 w-3.5" /> Add Sub-step</Button>)}
                </div>
              </div></ScrollArea>
              <SheetFooter className="p-4 mt-auto border-t pt-4 space-y-2 sm:space-y-0 sm:flex sm:justify-between">
                <div>{canEditPlan && editingStep && (<Button type="button" variant="destructive" onClick={() => handleDeleteStepRequest(editingStep.id, editingStep.title)} disabled={saveRoadmapMutation.isPending} className="w-full sm:w-auto"><Trash2 className="mr-2 h-4 w-4" /> Delete Step</Button>)}</div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                  <SheetClose asChild><Button type="button" variant="outline" disabled={saveRoadmapMutation.isPending} onClick={() => { setIsEditingNodeTitle(false); setIsEditingNodeDescription(false); setEditingSubStep(null); setCurrentSubStepTitleEdit(""); setCurrentSubStepDescriptionEdit(""); }}>Cancel</Button></SheetClose>
                  {canEditPlan && (<Button type="button" onClick={() => { if (editingStep) { handleStepDetailUpdate(editingStep); setIsStepDetailSheetOpen(false); setEditingStep(null); setEditingSubStep(null); }}} disabled={saveRoadmapMutation.isPending || !editingStep}>{saveRoadmapMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Step Changes</Button>)}
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete {itemToDelete?.type === 'step' ? 'Step' : 'Sub-step'}: "{itemToDelete?.title}"?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove the {itemToDelete?.type} and any connections to or from it {itemToDelete?.type === 'subStep' ? ' (and its nested sub-steps)' : ''}. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteItem} className="bg-destructive hover:bg-destructive/90" disabled={!canEditPlan}>Delete {itemToDelete?.type === 'step' ? 'Step' : 'Sub-step'}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isLineEditLabelAlertOpen} onOpenChange={setIsLineEditLabelAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Edit Line Label</AlertDialogTitle><AlertDialogDescription>Enter a label for this connection (or leave empty to remove an existing label).</AlertDialogDescription></AlertDialogHeader><div className="py-2"><Label htmlFor="line-label-input" className="sr-only">Line Label</Label><Input id="line-label-input" ref={lineLabelInputRef} value={currentLineEditLabel} onChange={(e) => setCurrentLineEditLabel(e.target.value)} placeholder="E.g., Depends on, Blocks, etc." autoFocus /></div><AlertDialogFooter><AlertDialogCancel onClick={() => { setIsLineEditLabelAlertOpen(false); setCurrentLineEditLabel(""); setLineContextMenu(null); }}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmSetLineLabel} disabled={!canEditPlan}>Set Label</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <Sheet open={isVersionHistorySheetOpen} onOpenChange={setIsVersionHistorySheetOpen}>
        <SheetContent className="sm:max-w-lg w-[90vw]" side="left">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Plan Version History (v{planData?.version || 1})</SheetTitle>
            <SheetDescription>
              Review past versions of this plan. You can restore to a previous version.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100%-100px)]"> 
            <div className="p-4 space-y-3">
              {isLoadingVersions && (
                <div className="flex justify-center items-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                  <p className="ml-2 text-muted-foreground">Loading versions...</p>
                </div>
              )}
              {!isLoadingVersions && versionsError && (
                <p className="text-sm text-destructive text-center py-4">
                  Error loading versions: {versionsError.message}
                </p>
              )}
              {!isLoadingVersions && !versionsError && planVersions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No version history found for this plan yet.
                </p>
              )}
              {!isLoadingVersions && !versionsError && planVersions.map(version => {
                const isCurrentActiveVersion = version.versionNumber === planData?.version;
                return (
                  <div key={version.id} className={cn("p-3 border rounded-md bg-muted/30 hover:bg-muted/40 transition-colors flex justify-between items-center", isCurrentActiveVersion && "border-primary ring-1 ring-primary")}>
                    <div>
                      <p className="text-sm font-medium">
                        Version {version.versionNumber || "(Legacy)"} {isCurrentActiveVersion && <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saved by: <span className="font-semibold text-foreground">{version.editorDisplayName || version.editorUid}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(version.timestamp), "MMM d, yyyy, h:mm a")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="xs"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleRestoreVersion(version)}
                      disabled={isCurrentActiveVersion || restorePlanMutation.isPending}
                      title={isCurrentActiveVersion ? "This is the current version" : `Restore to version ${version.versionNumber || 'this version'}`}
                    >
                      <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Restore
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <SheetFooter className="border-t pt-4 p-4">
            <SheetClose asChild>
              <Button variant="outline">Close</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore to Version {versionToRestore?.versionNumber || 'this version'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore the plan to the state it was in at{' '}
              {versionToRestore ? format(new Date(versionToRestore.timestamp), "MMM d, yyyy, h:mm a") : 'this version'}?
              The current state of the roadmap will be saved as a new version before restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsRestoreConfirmOpen(false); setVersionToRestore(null); }} disabled={restorePlanMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} disabled={restorePlanMutation.isPending} className="bg-primary hover:bg-primary/90">
              {restorePlanMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

