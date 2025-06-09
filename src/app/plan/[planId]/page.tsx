
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
  Link2 as LinkNodeIcon,
  Unlink,
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

const MAIN_NODE_TITLE_BG = '#2b9dee';
const MAIN_NODE_CONTENT_BG = '#F7FCFF';

const CONNECTION_LINE_THICKNESS_CHILD = 2;
const ARROWHEAD_LENGTH = 10;
const ARROWHEAD_WIDTH_FACTOR = 0.7;

const CLICK_MOVE_THRESHOLD_PX_SQ = 25;
const CLICK_TIME_THRESHOLD_MS = 300;

const calculateNodeHeight = (step: RoadmapStep, allSteps: RoadmapStep[]): number => {
  let height = NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y;
  let descriptionLineCount = 0;
  if (step.description && step.description.trim().length > 0) {
    const lines = Math.ceil(step.description.length / 35) + step.description.split(/\r\n|\r|\n/).length -1;
    descriptionLineCount = Math.max(1, lines);
  }
  const descriptionHeight = descriptionLineCount * 15;
  let childNodesHeight = 0;
  const children = allSteps.filter(s => s.parentId === step.id);
  if (children.length > 0) {
    childNodesHeight = (children.length * SUBSTEP_ITEM_HEIGHT) + (SUBSTEP_ITEM_HEIGHT / 2);
  }
  const contentHeight = Math.max(descriptionHeight, childNodesHeight);
  height += contentHeight;
  height += FINAL_BUFFER_CARD_HEIGHT;
  return Math.max(NODE_BASE_MIN_HEIGHT, height);
};

interface RoadmapStepCardProps {
  step: RoadmapStep;
  allSteps: RoadmapStep[];
  onNodeInteractionStart: (nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => void;
  onDotInteractionStart: (parentNodeId: string, anchor: 'N' | 'S' | 'E' | 'W', event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => void;
  isSelected?: boolean;
  isSubmitting: boolean;
  onEditStep: (step: RoadmapStep) => void;
  isActuallyDraggingThisNode?: boolean;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  allSteps,
  onNodeInteractionStart,
  onDotInteractionStart,
  isSelected,
  isSubmitting,
  onEditStep,
  isActuallyDraggingThisNode,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const dynamicHeight = calculateNodeHeight(step, allSteps);
  const childNodes = useMemo(() => allSteps.filter(s => s.parentId === step.id), [allSteps, step.id]);

  interface ConnectionDotProps {
    anchor: 'N' | 'S' | 'E' | 'W';
    parentStepId: string;
    isSubmitting: boolean;
    style?: React.CSSProperties;
  }

  const ConnectionDot: React.FC<ConnectionDotProps> = ({ anchor, parentStepId: localParentStepId, isSubmitting: propIsSubmitting, style }) => {
    const dotClickableSize = DOT_SIZE;
    const titleText = `Drag to connect or create new node from: "${step.title}" (Anchor: ${anchor})`;
    const dotVisualClasses = "h-2 w-2 bg-muted-foreground group-hover:bg-primary group-hover:scale-150 group-hover:ring-2 group-hover:ring-primary/60";

    return (
      <button
        aria-label={titleText}
        title={titleText}
        className={cn(
          "group absolute rounded-full z-20 transition-all duration-150 ease-in-out flex items-center justify-center active:scale-110",
          propIsSubmitting && "cursor-not-allowed opacity-50"
        )}
        style={{ width: dotClickableSize, height: dotClickableSize, ...style }}
        onMouseDown={(e) => { if (propIsSubmitting) return; e.stopPropagation(); onDotInteractionStart(localParentStepId, anchor, e); }}
        onTouchStart={(e) => { if (propIsSubmitting) return; e.stopPropagation(); onDotInteractionStart(localParentStepId, anchor, e); }}
        disabled={propIsSubmitting}
      >
        <div className={cn("rounded-full transition-all duration-150 ease-in-out", dotVisualClasses)}/>
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
        backgroundColor: MAIN_NODE_CONTENT_BG,
      }}
      onMouseDown={(e) => onNodeInteractionStart(step.id, e)}
      onTouchStart={(e) => onNodeInteractionStart(step.id, e)}
      data-node-id={step.id}
    >
      <div
        className="p-2 border-b border-border flex items-center justify-between cursor-move rounded-t-lg h-[40px]"
        style={{ backgroundColor: MAIN_NODE_TITLE_BG }}
      >
        <h3 className="text-sm font-semibold truncate text-white" title={step.title}>{step.title}</h3>
      </div>
      <div className="p-2 text-xs flex-grow min-h-0" style={{ backgroundColor: MAIN_NODE_CONTENT_BG }}>
        {step.description && (<p className="whitespace-pre-wrap line-clamp-3 mb-1.5 text-black">{step.description}</p>)}
        {childNodes.length > 0 && (
          <>
            <p className="text-[11px] font-medium text-muted-foreground mt-1 mb-0.5">Child Nodes:</p>
            <ul className="space-y-0.5 list-none p-0 m-0 max-h-20 overflow-y-auto custom-scrollbar-xs">
              {childNodes.map((child) => (
                <li key={child.id} className={cn("text-xs py-0 flex items-center text-black")}>
                   <LinkNodeIcon className="h-2.5 w-2.5 mr-1.5 text-primary/70 flex-shrink-0"/>
                   <span className="truncate" title={child.title}>{child.title}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {(!step.description || step.description.trim().length === 0) && childNodes.length === 0 && (
          <p className="italic text-gray-600 text-center py-2 text-[11px]">No details or child nodes.</p>
        )}
      </div>
      <ConnectionDot anchor="N" parentStepId={step.id} isSubmitting={isSubmitting} style={{ top: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE/2}px)` }} />
      <ConnectionDot anchor="S" parentStepId={step.id} isSubmitting={isSubmitting} style={{ bottom: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE/2}px)` }} />
      <ConnectionDot anchor="E" parentStepId={step.id} isSubmitting={isSubmitting} style={{ right: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE/2}px)` }} />
      <ConnectionDot anchor="W" parentStepId={step.id} isSubmitting={isSubmitting} style={{ left: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE/2}px)` }} />
    </div>
  );
});
RoadmapStepCard.displayName = "RoadmapStepCard";

interface NodeDragInfo { type: 'node'; nodeId: string; offsetX: number; offsetY: number; }
interface ConnectionDragInfo { type: 'connectionDot'; sourceStepId: string; sourceAnchor: 'N' | 'S' | 'E' | 'W'; startX: number; startY: number; }
interface PointerStartInfo { clientX: number; clientY: number; timestamp: number; targetElement: EventTarget | null; }
interface LineContextMenuState { isOpen: boolean; x: number; y: number; childNodeId: string; }

interface ItemToDelete {
  type: 'step' | 'subStep';
  id: string;
  parentId?: string | null;
  title: string;
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
  const [pendingNodeFromDotInfo, setPendingNodeFromDotInfo] = useState<{ sourceStepId: string; sourceAnchor: 'N' | 'S' | 'E' | 'W'; } | null>(null);

  const [editingStep, setEditingStep] = useState<RoadmapStep | null>(null);
  const [editingSubStep, setEditingSubStep] = useState<RoadmapSubStep | null>(null);
  const [currentSubStepTitleEdit, setCurrentSubStepTitleEdit] = useState('');
  const [currentSubStepDescriptionEdit, setCurrentSubStepDescriptionEdit] = useState('');

  const [isStepDetailSheetOpen, setIsStepDetailSheetOpen] = useState(false);
  const [isEditingNodeTitle, setIsEditingNodeTitle] = useState(false);
  const [isEditingNodeDescription, setIsEditingNodeDescription] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);
  const [lineContextMenu, setLineContextMenu] = useState<LineContextMenuState | null>(null);

  const [isPointerDown, setIsPointerDown] = useState(false);
  const nodeDragInfoRef = useRef<NodeDragInfo | null>(null);
  const connectionDragInfoRef = useRef<ConnectionDragInfo | null>(null);
  const clickStartInfoRef = useRef<PointerStartInfo | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const [activeConnectionLinePreview, setActiveConnectionLinePreview] = useState<{startX: number, startY: number, currentX: number, currentY: number } | null>(null);

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
      setEditableRoadmap(planData.roadmap?.map(step => ({ ...step, parentId: step.parentId === undefined ? null : step.parentId, subSteps: step.subSteps || [] })) || []);
    } else {
      setEditableRoadmap([]);
    }
  }, [planData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let lowestNodeBottomY = 0;
      if (editableRoadmap.length > 0) {
        lowestNodeBottomY = Math.max(0, ...editableRoadmap.map(step => step.y + calculateNodeHeight(step, editableRoadmap)));
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

  const getAnchorPoint = useCallback((step: RoadmapStep, anchor: 'N' | 'S' | 'E' | 'W', allStepsForHeightCalc: RoadmapStep[]): { x: number, y: number } => {
    const nodeHeight = calculateNodeHeight(step, allStepsForHeightCalc);
    const nodeWidth = NODE_BASE_WIDTH;
    switch (anchor) {
      case 'N': return { x: step.x + nodeWidth / 2, y: step.y };
      case 'S': return { x: step.x + nodeWidth / 2, y: step.y + nodeHeight };
      case 'E': return { x: step.x + nodeWidth, y: step.y + nodeHeight / 2 };
      case 'W': return { x: step.x, y: step.y + nodeHeight / 2 };
      default: return { x: step.x, y: step.y };
    }
  }, []);

  const handleEditStep = useCallback((stepToEdit: RoadmapStep) => {
    setEditingStep(stepToEdit);
    setEditingSubStep(null); // Clear any sub-step editing when a main step is selected
    setIsStepDetailSheetOpen(true);
    setIsEditingNodeTitle(false);
    setIsEditingNodeDescription(false);
  }, []);

  const handleAddRoadmapStepSubmit = useCallback((data: AddRoadmapStepFormData) => {
    if (!canEditPlan) return;
    let newStepX = 100, newStepY = 100; let parentId: string | null = null;
    if (pendingNodeFromDotInfo?.sourceStepId) {
      const sourceNode = editableRoadmap.find(s => s.id === pendingNodeFromDotInfo.sourceStepId);
      if (sourceNode) {
        parentId = sourceNode.id;
        const sourceNodeHeight = calculateNodeHeight(sourceNode, editableRoadmap);
        const sourceNodeWidth = NODE_BASE_WIDTH;
        const spacing = 80;
        const newNodeApproxHeight = calculateNodeHeight({ title: data.title, x:0, y:0, id:'temp', parentId: null, subSteps:[] }, editableRoadmap);
        
        switch(pendingNodeFromDotInfo.sourceAnchor) {
          case 'N': newStepX = sourceNode.x + (sourceNodeWidth / 2) - (NODE_BASE_WIDTH / 2); newStepY = sourceNode.y - newNodeApproxHeight - spacing; break;
          case 'S': newStepX = sourceNode.x + (sourceNodeWidth / 2) - (NODE_BASE_WIDTH / 2); newStepY = sourceNode.y + sourceNodeHeight + spacing; break;
          case 'E': newStepX = sourceNode.x + sourceNodeWidth + spacing; newStepY = sourceNode.y + (sourceNodeHeight / 2) - (newNodeApproxHeight / 2); break;
          case 'W': newStepX = sourceNode.x - NODE_BASE_WIDTH - spacing; newStepY = sourceNode.y + (sourceNodeHeight / 2) - (newNodeApproxHeight / 2); break;
        }
      }
    } else if (canvasRef.current) {
      newStepX = canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2;
      newStepY = canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - calculateNodeHeight({ title: data.title, x:0,y:0,id:'temp',parentId:null,subSteps:[] }, editableRoadmap) / 2;
    }
    newStepX = Math.max(MIN_CANVAS_PADDING, newStepX); newStepY = Math.max(MIN_CANVAS_PADDING, newStepY);
    const newNode: RoadmapStep = { id: `step-${Date.now()}-${uuidv4().substring(0, 8)}`, title: data.title, description: null, x: newStepX, y: newStepY, parentId: parentId, subSteps: [] };
    setEditableRoadmap(prev => [...prev, newNode]);
    setIsAddStepDialogOpen(false);
    setPendingNodeFromDotInfo(null);
    toast({ title: "Node Added", description: `"${data.title}" added. Remember to save the plan to persist changes.` });
  }, [canEditPlan, editableRoadmap, pendingNodeFromDotInfo, toast]);

  const removeSubStepRecursiveCorrected = (
    subSteps: RoadmapSubStep[],
    subStepIdToDelete: string
  ): { updatedSubSteps: RoadmapSubStep[]; foundAndRemoved: boolean } => {
    let foundAndRemoved = false;
    const updatedSubSteps = subSteps.filter(sub => {
        if (sub.id === subStepIdToDelete) {
            foundAndRemoved = true;
            return false; // Exclude this sub-step
        }
        return true;
    }).map(sub => {
        if (!foundAndRemoved && sub.subSteps && sub.subSteps.length > 0) {
            const result = removeSubStepRecursiveCorrected(sub.subSteps, subStepIdToDelete);
            if (result.foundAndRemoved) {
                foundAndRemoved = true; // Propagate found status
                return { ...sub, subSteps: result.updatedSubSteps }; // Return updated parent
            }
        }
        return sub; // Return unchanged sub-step if not found in this branch
    });
    return { updatedSubSteps, foundAndRemoved };
  };
  
  const confirmDeleteItem = useCallback(() => {
    if (!itemToDelete || !canEditPlan) return;
    const { id: idToDelete, type, parentId: directParentId, title } = itemToDelete;
  
    if (type === 'step') { // Deleting a main canvas node
      setEditableRoadmap(prev => {
        const childrenOfDeletedNode = prev.filter(s => s.parentId === idToDelete);
        const updatedChildren = childrenOfDeletedNode.map(child => ({ ...child, parentId: null, x: child.x + 5, y: child.y + 5 }));
        return prev.filter(s => s.id !== idToDelete).map(s => {
          const childToUpdate = updatedChildren.find(uc => uc.id === s.id);
          return childToUpdate || s;
        });
      });
      if (editingStep?.id === idToDelete) {
        setIsStepDetailSheetOpen(false); setEditingStep(null); setEditingSubStep(null);
      }
    } else if (type === 'subStep' && editingStep) { // Deleting a sub-step (direct or nested)
      setEditableRoadmap(prevRoadmap =>
        prevRoadmap.map(mainStep => {
          if (mainStep.id === editingStep.id) { // Only modify the currently editing main step's hierarchy
            const result = removeSubStepRecursiveCorrected(mainStep.subSteps || [], idToDelete);
            if (result.foundAndRemoved) {
              return { ...mainStep, subSteps: result.updatedSubSteps };
            }
          }
          return mainStep;
        })
      );
      // Update the panel's view
      if (editingSubStep?.id === idToDelete) { // If the deleted sub-step was the one being edited
        setEditingSubStep(null); // Go back to the main step's sub-step list
      } else if (editingSubStep) { // If a different sub-step was being edited, refresh its sub-steps
        const updatedParentSubStep = findSubStepRecursive(editingStep.subSteps || [], editingSubStep.id);
        setEditingSubStep(updatedParentSubStep ? { ...updatedParentSubStep } : null);
      } else { // If main step was being edited, refresh its direct sub-steps (editingSubStep was already null)
        const updatedMainStep = editableRoadmap.find(rs => rs.id === editingStep.id);
        setEditingStep(updatedMainStep ? { ...updatedMainStep } : null);
      }
    }
    toast({ title: `${type === 'step' ? 'Node' : 'Sub-step'} Deleted`, description: `"${title}" removed. Remember to save the plan.` });
    setItemToDelete(null);
  }, [itemToDelete, canEditPlan, toast, editingStep, editingSubStep, editableRoadmap]);
  
  const findSubStepRecursive = (subSteps: RoadmapSubStep[], subStepId: string): RoadmapSubStep | null => {
    for (const subStep of subSteps) {
      if (subStep.id === subStepId) return subStep;
      if (subStep.subSteps && subStep.subSteps.length > 0) {
        const found = findSubStepRecursive(subStep.subSteps, subStepId);
        if (found) return found;
      }
    }
    return null;
  };

  const handleStepDetailUpdate = useCallback((updatedStep: RoadmapStep) => {
    if (!canEditPlan) return;
    setEditableRoadmap(prev => prev.map(s => s.id === updatedStep.id ? updatedStep : s));
    toast({ title: "Node Updated", description: `"${updatedStep.title}" details changed. Remember to save the plan.`});
    setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);
  }, [canEditPlan, toast]);

  const handleDeleteNodeRequest = useCallback((stepId: string, stepTitle: string) => {
    setItemToDelete({ type: 'step', id: stepId, title: stepTitle });
  }, []);

  const saveRoadmapChanges = useCallback(async () => {
    if (!planData || !user || !planId || !canEditPlan) { toast({ variant: "destructive", title: "Error", description: "Cannot save: Plan data, user auth, or permissions missing." }); return; }
    saveRoadmapMutation.mutate({ planId, currentUserId: user.uid, roadmap: editableRoadmap });
  }, [planData, user, planId, canEditPlan, editableRoadmap, saveRoadmapMutation, toast]);

  const sharePlan = useCallback(async () => { try { await navigator.clipboard.writeText(window.location.href); toast({ title: "Link Copied!", description: "Plan URL copied to clipboard." }); } catch (err) { toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy link to clipboard." }); } }, [toast]);

  const handleLineClick = useCallback((event: React.MouseEvent<SVGPathElement>, childNodeId: string) => {
    if (!canEditPlan) return; event.preventDefault(); event.stopPropagation();
    const canvasRect = canvasRef.current?.getBoundingClientRect(); if (!canvasRect) return;
    setLineContextMenu({ isOpen: true, x: event.clientX - canvasRect.left, y: event.clientY - canvasRect.top, childNodeId: childNodeId });
  }, [canEditPlan]);

  const handleDetachParent = useCallback((childNodeId: string) => {
    if (!canEditPlan) return;
    setEditableRoadmap(prev => prev.map(step => step.id === childNodeId ? { ...step, parentId: null } : step ));
    toast({ title: "Node Detached", description: "Node is now a root. Remember to save the plan." });
    setLineContextMenu(null);
  }, [canEditPlan, toast]);

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

  const handleDotInteractionStart = useCallback((parentNodeId: string, clickedAnchor: 'N' | 'S' | 'E' | 'W', event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    if (('button' in event && (event as React.MouseEvent).button !== 0) || !canEditPlan || !canvasRef.current) return;
    if (lineContextMenu?.isOpen) setLineContextMenu(null);
    const { clientX, clientY } = getPointerCoords(event);
    const dotElement = event.currentTarget as HTMLElement;
    const dotCenterCanvas = getElementCenter(dotElement);
    connectionDragInfoRef.current = { type: 'connectionDot', sourceStepId: parentNodeId, sourceAnchor: clickedAnchor, startX: dotCenterCanvas.x, startY: dotCenterCanvas.y };
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
        const { startX, startY } = connectionDragInfoRef.current;
        setActiveConnectionLinePreview({ startX, startY, currentX, currentY });
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
      const { sourceStepId, sourceAnchor } = connectionDragInfoRef.current;
      const sourceNode = editableRoadmap.find(s => s.id === sourceStepId);

      if (isDraggingRef.current && canvasRef.current && sourceNode) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const releaseX = finalCoords.clientX - canvasRect.left + canvasRef.current.scrollLeft;
        const releaseY = finalCoords.clientY - canvasRect.top + canvasRef.current.scrollTop;
        let snapped = false;

        for (const targetNode of editableRoadmap) {
          if (targetNode.id === sourceStepId) continue;

          const targetAnchors: ('N'|'S'|'E'|'W')[] = ['N', 'S', 'E', 'W'];
          for (const targetAnchorOnTargetNode of targetAnchors) {
            const targetDotPos = getAnchorPoint(targetNode, targetAnchorOnTargetNode, editableRoadmap);
            const dist = Math.sqrt(Math.pow(releaseX - targetDotPos.x, 2) + Math.pow(releaseY - targetDotPos.y, 2));

            if (dist <= SNAP_THRESHOLD) {
                let newChildId = "";
                let newParentId = "";

                if (sourceAnchor === 'S' && targetAnchorOnTargetNode === 'N') {
                    newChildId = targetNode.id; newParentId = sourceNode.id;
                } else if (sourceAnchor === 'N' && targetAnchorOnTargetNode === 'S') {
                    newChildId = sourceNode.id; newParentId = targetNode.id;
                } else if (sourceAnchor === 'E' && targetAnchorOnTargetNode === 'W') {
                    newChildId = targetNode.id; newParentId = sourceNode.id;
                } else if (sourceAnchor === 'W' && targetAnchorOnTargetNode === 'E') {
                    newChildId = sourceNode.id; newParentId = targetNode.id;
                }

                if (newChildId && newParentId) {
                    let currentAncestorId: string | null = newParentId;
                    let isCyclical = false;
                    const visited = new Set<string>();
                    while(currentAncestorId && !visited.has(currentAncestorId)) {
                        visited.add(currentAncestorId);
                        if (currentAncestorId === newChildId) {
                            isCyclical = true; break;
                        }
                        const ancestorNode = editableRoadmap.find(n => n.id === currentAncestorId);
                        currentAncestorId = ancestorNode?.parentId || null;
                    }
                    if (isCyclical) {
                        toast({ variant: "destructive", title: "Invalid Connection", description: "This connection would create a cyclical dependency." });
                    } else {
                        setEditableRoadmap(prev => prev.map(s => s.id === newChildId ? { ...s, parentId: newParentId } : s));
                        toast({ title: "Nodes Connected", description: `"${editableRoadmap.find(s=>s.id === newChildId)?.title}" is now a child of "${editableRoadmap.find(s=>s.id === newParentId)?.title}". Save plan.`});
                    }
                }
                snapped = true; break;
            }
          }
          if (snapped) break;
        }
      } else if (clickInfo && sourceNode) {
        setPendingNodeFromDotInfo({ sourceStepId: sourceNode.id, sourceAnchor });
        setIsAddStepDialogOpen(true);
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
    }
  }, [isStepDetailSheetOpen]);

  const drawConnectionLines = () => {
    return editableRoadmap.filter(childStep => childStep.parentId).map(childStep => {
      const parentStep = editableRoadmap.find(s => s.id === childStep.parentId);
      if (!parentStep) return null;

      const parentAnchorPoint = getAnchorPoint(parentStep, 'S', editableRoadmap);
      const childAnchorPoint = getAnchorPoint(childStep, 'N', editableRoadmap);

      const lineStartOffset = (DOT_SIZE / 2) + (CONNECTION_LINE_THICKNESS_CHILD / 2);
      const lineEndOffset = (DOT_SIZE / 2) + (CONNECTION_LINE_THICKNESS_CHILD / 2) + ARROWHEAD_LENGTH;

      const lineStart = { x: parentAnchorPoint.x, y: parentAnchorPoint.y + lineStartOffset };
      const lineEnd = { x: childAnchorPoint.x, y: childAnchorPoint.y - lineEndOffset };

      const pathData = `M ${lineStart.x} ${lineStart.y} L ${lineEnd.x} ${lineEnd.y}`;

      return (
        <g key={`conn-${parentStep.id}-to-${childStep.id}`}>
          <path d={pathData} stroke="transparent" strokeWidth={CONNECTION_LINE_THICKNESS_CHILD + 12} fill="none" className="cursor-pointer" onClick={(e) => handleLineClick(e, childStep.id)} style={{pointerEvents: "stroke"}} />
          <path d={pathData} stroke={MAIN_NODE_TITLE_BG} strokeWidth={CONNECTION_LINE_THICKNESS_CHILD} fill="none" markerEnd={'url(#arrowhead-main)'} style={{pointerEvents: "none"}} />
        </g>
      );
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
  
  const updateNestedSubStepTree = (
    subSteps: RoadmapSubStep[],
    targetParentSubStepId: string,
    newNestedSubStepToAdd: RoadmapSubStep
  ): { updatedList: RoadmapSubStep[]; foundAndUpdated: boolean } => {
    let foundAndUpdated = false;
    const updatedList = subSteps.map(subStep => {
      if (subStep.id === targetParentSubStepId) {
        foundAndUpdated = true;
        return {
          ...subStep,
          subSteps: [...(subStep.subSteps || []), newNestedSubStepToAdd],
        };
      }
      if (subStep.subSteps && subStep.subSteps.length > 0) {
        const result = updateNestedSubStepTree(subStep.subSteps, targetParentSubStepId, newNestedSubStepToAdd);
        if (result.foundAndUpdated) {
          foundAndUpdated = true;
          return { ...subStep, subSteps: result.updatedList };
        }
      }
      return subStep;
    });
    return { updatedList, foundAndUpdated };
  };
  
  const handleAddSubStepToEditingSubStep = (newSubStepTitle: string) => {
    if (!editingStep || !editingSubStep || !newSubStepTitle.trim()) return;
  
    const newNestedSubStepToAdd: RoadmapSubStep = {
      id: `sub-${Date.now()}-${uuidv4().substring(0, 6)}`,
      parentId: editingSubStep.id, // Parent is the sub-step being edited
      title: newSubStepTitle.trim(),
      description: null,
      subSteps: [],
    };
  
    setEditableRoadmap(prevRoadmap =>
      prevRoadmap.map(mainStep => {
        if (mainStep.id === editingStep.id) {
          const result = updateNestedSubStepTree(
            mainStep.subSteps || [],
            editingSubStep.id,
            newNestedSubStepToAdd
          );
          if (result.foundAndUpdated) {
            return { ...mainStep, subSteps: result.updatedList };
          }
        }
        return mainStep;
      })
    );
  
    // Update the local editingSubStep state to reflect the new child
    setEditingSubStep(prev => {
      if (prev && prev.id === editingSubStep.id) {
        return {
          ...prev,
          subSteps: [...(prev.subSteps || []), newNestedSubStepToAdd],
        };
      }
      return prev;
    });
  
    toast({ title: "Nested Sub-step Added", description: `"${newNestedSubStepToAdd.title}" added. Remember to save changes.` });
  };

  const handleEditNestedSubStep = (subStep: RoadmapSubStep) => {
    if (!editingStep) return;
    setEditingSubStep(subStep); // Focus on this nested sub-step for editing
    setCurrentSubStepTitleEdit(subStep.title);
    setCurrentSubStepDescriptionEdit(subStep.description || '');
    // No need to navigate to main sheet, we are already in it for a sub-step.
  };
  
  const handleDeleteNestedSubStepFromList = (parentSubStepId: string, subStepIdToDelete: string, subStepTitle: string) => {
    if (!editingStep) return;
    setItemToDelete({ type: 'subStep', id: subStepIdToDelete, parentId: parentSubStepId, title: subStepTitle });
  };

  const handleEditSubStep = (subStepToEdit: RoadmapSubStep) => {
    if (!editingStep) return; // Ensure we have a main step context
    setEditingSubStep(subStepToEdit);
    setCurrentSubStepTitleEdit(subStepToEdit.title);
    setCurrentSubStepDescriptionEdit(subStepToEdit.description || '');
    // setIsStepDetailSheetOpen(true); // This is already open or should be
  };

  const handleSaveSubStepDetails = () => {
    if (!editingStep || !editingSubStep || !canEditPlan) return;
  
    const updateSubStepRecursive = (
      subSteps: RoadmapSubStep[],
      targetId: string,
      newTitle: string,
      newDescription: string | null
    ): { updatedList: RoadmapSubStep[]; foundAndUpdated: boolean } => {
      let foundAndUpdated = false;
      const updatedList = subSteps.map(sub => {
        if (sub.id === targetId) {
          foundAndUpdated = true;
          return { ...sub, title: newTitle, description: newDescription };
        }
        if (sub.subSteps && sub.subSteps.length > 0) {
          const result = updateSubStepRecursive(sub.subSteps, targetId, newTitle, newDescription);
          if (result.foundAndUpdated) {
            foundAndUpdated = true;
            return { ...sub, subSteps: result.updatedList };
          }
        }
        return sub;
      });
      return { updatedList, foundAndUpdated };
    };
  
    setEditableRoadmap(prevRoadmap =>
      prevRoadmap.map(mainStep => {
        if (mainStep.id === editingStep.id) {
          const result = updateSubStepRecursive(
            mainStep.subSteps || [],
            editingSubStep.id,
            currentSubStepTitleEdit.trim(),
            currentSubStepDescriptionEdit.trim() || null
          );
          if (result.foundAndUpdated) {
            return { ...mainStep, subSteps: result.updatedList };
          }
        }
        return mainStep;
      })
    );
  
    // Update the local editingSubStep state as well for immediate UI feedback
    setEditingSubStep(prev => prev ? { ...prev, title: currentSubStepTitleEdit.trim(), description: currentSubStepDescriptionEdit.trim() || null } : null);
    toast({ title: "Sub-step Updated", description: `"${currentSubStepTitleEdit.trim()}" details saved. Remember to save the plan.` });
  };

  const handleDeleteThisEditingSubStep = () => {
    if (!editingStep || !editingSubStep) return;
    setItemToDelete({ type: 'subStep', id: editingSubStep.id, parentId: editingSubStep.parentId, title: editingSubStep.title });
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
            {canEditPlan && (<Button variant="outline" size="sm" className="h-8" onClick={() => setIsAddStepDialogOpen(true)} disabled={saveRoadmapMutation.isPending}><Plus className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">Add Node</span><span className="sm:hidden">+Node</span></Button>)}
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
                <marker id="arrowhead-main" viewBox={`0 0 ${ARROWHEAD_LENGTH} ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} markerWidth={ARROWHEAD_LENGTH} markerHeight={ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR} refX={ARROWHEAD_LENGTH / 2} refY={(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2} orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points={`0 0, ${ARROWHEAD_LENGTH} ${(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2}, 0 ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} fill={MAIN_NODE_TITLE_BG}/></marker>
            </defs>
            {drawConnectionLines()}
            {activeConnectionLinePreview && (<line x1={activeConnectionLinePreview.startX} y1={activeConnectionLinePreview.startY} x2={activeConnectionLinePreview.currentX} y2={activeConnectionLinePreview.currentY} stroke={MAIN_NODE_TITLE_BG} strokeWidth={CONNECTION_LINE_THICKNESS_CHILD + 1} strokeDasharray="4 4" markerEnd={'url(#arrowhead-main)'} />)}
          </svg>
          {editableRoadmap.length === 0 && !isLoadingPlan && (<div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none"><Map className="h-16 w-16 mb-4" /><p className="text-lg font-medium">Collaboration Plan Area</p><p className="text-sm mt-1">{canEditPlan ? "Click '+ Node' to add your first step to the roadmap." : "This plan currently has no steps defined."}</p></div>)}
          {editableRoadmap.map(step => (<RoadmapStepCard key={step.id} step={step} allSteps={editableRoadmap} onNodeInteractionStart={handleNodeInteractionStart} onDotInteractionStart={handleDotInteractionStart} isSelected={editingStep?.id === step.id} isSubmitting={saveRoadmapMutation.isPending} onEditStep={handleEditStep} isActuallyDraggingThisNode={isDraggingRef.current && nodeDragInfoRef.current?.nodeId === step.id}/>))}
          <Popover open={lineContextMenu?.isOpen || false} onOpenChange={(open) => { if (!open) setLineContextMenu(null); }}><PopoverTrigger asChild><div className="fixed" style={{ left: `${lineContextMenu?.x || 0}px`, top: `${lineContextMenu?.y || 0}px`, width: 0, height: 0 }} /></PopoverTrigger>
            <PopoverContent className="w-auto p-1" side="right" align="start" sideOffset={5}>
              {lineContextMenu && canEditPlan && (
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => handleDetachParent(lineContextMenu.childNodeId)}><Unlink className="mr-2 h-3.5 w-3.5 text-destructive"/> Detach Parent</Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </main>
      </div>
      <AddRoadmapStepDialog isOpen={isAddStepDialogOpen} onOpenChange={setIsAddStepDialogOpen} onSubmit={handleAddRoadmapStepSubmit} isSubmitting={saveRoadmapMutation.isPending} parentStepTitle={pendingNodeFromDotInfo?.sourceStepId ? editableRoadmap.find(s => s.id === pendingNodeFromDotInfo.sourceStepId)?.title : null} dialogTitle={pendingNodeFromDotInfo?.sourceStepId ? `New Child Node from "${editableRoadmap.find(s => s.id === pendingNodeFromDotInfo.sourceStepId)?.title}"` : "Add New Root Node"} />
      
      <Sheet open={isStepDetailSheetOpen} onOpenChange={(open) => { if (!open) { setEditingStep(null); setEditingSubStep(null); } setIsStepDetailSheetOpen(open); setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);}}>
        <SheetContent className="sm:max-w-md flex flex-col">
          {editingStep ? (
            <>
              <SheetHeader className="border-b pb-3">
                <SheetTitle>
                  {editingSubStep ? `Editing Sub-step: ${editingSubStep.title}` : `Node: ${editingStep.title}`}
                </SheetTitle>
                <SheetDescription>
                  {editingSubStep ? "Modify details for this sub-step." : "Modify details for this main roadmap node."}
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-grow min-h-0"><div className="p-4 space-y-4">
                {editingSubStep ? (
                  <> {/* Sub-step Editing UI */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="sheet-substep-title">Sub-step Title</Label>
                        {canEditPlan && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {}} title="Edit Sub-step Title" disabled><Edit2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                      <Input id="sheet-substep-title" value={currentSubStepTitleEdit} onChange={(e) => setCurrentSubStepTitleEdit(e.target.value)} disabled={!canEditPlan || saveRoadmapMutation.isPending} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="sheet-substep-description">Description</Label>
                        {canEditPlan && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {}} title="Edit Sub-step Description" disabled><Edit2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                      <Textarea id="sheet-substep-description" value={currentSubStepDescriptionEdit} onChange={(e) => setCurrentSubStepDescriptionEdit(e.target.value)} rows={3} disabled={!canEditPlan || saveRoadmapMutation.isPending} />
                    </div>
                     <div className="space-y-2 mt-3">
                        <Label>Nested Sub-steps of "{editingSubStep.title}"</Label>
                        {(editingSubStep.subSteps && editingSubStep.subSteps.length > 0) ? (
                             <ul className="space-y-1.5 border p-2 rounded-md max-h-40 overflow-y-auto">
                                {editingSubStep.subSteps.map((nestedSub) => (
                                    <li key={nestedSub.id} className="flex items-center justify-between gap-2 text-sm p-1 hover:bg-muted/30 rounded">
                                        <span className="truncate" title={nestedSub.title}>{nestedSub.title}</span>
                                        {canEditPlan && (
                                            <div className="flex-shrink-0 space-x-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 p-1" onClick={() => handleEditNestedSubStep(nestedSub)} title={`Edit nested sub-step: ${nestedSub.title}`} disabled={saveRoadmapMutation.isPending}><Edit2 className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-destructive hover:text-destructive" onClick={() => handleDeleteNestedSubStepFromList(editingSubStep!.id, nestedSub.id, nestedSub.title)} title={`Delete nested sub-step: ${nestedSub.title}`} disabled={saveRoadmapMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (<p className="text-xs text-muted-foreground italic">No nested sub-steps yet.</p>)}
                        {canEditPlan && (
                            <form onSubmit={(e) => { e.preventDefault(); const input = (e.target as HTMLFormElement).elements.namedItem('newNestedSubStepTitle') as HTMLInputElement; handleAddSubStepToEditingSubStep(input.value); input.value = ''; }} className="flex gap-2 items-center mt-2">
                            <Input name="newNestedSubStepTitle" placeholder="New nested sub-step title..." className="h-8 text-xs flex-grow" disabled={saveRoadmapMutation.isPending} />
                            <Button type="submit" variant="outline" size="xs" className="h-8 px-2" disabled={saveRoadmapMutation.isPending}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
                            </form>
                        )}
                    </div>
                  </>
                ) : (
                  <> {/* Main Node Editing UI */}
                    <div>
                      <div className="flex items-center justify-between mb-1"><Label htmlFor="sheet-step-title">Node Title</Label>{canEditPlan && (<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingNodeTitle(prev => !prev)} title={isEditingNodeTitle ? "Finish Editing Title" : "Edit Title"}><Edit2 className="h-3.5 w-3.5" /></Button>)}</div>
                      <Input id="sheet-step-title" value={editingStep.title} onChange={(e) => setEditingStep(prev => prev ? { ...prev, title: e.target.value } : null)} disabled={!isEditingNodeTitle || !canEditPlan || saveRoadmapMutation.isPending} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1"><Label htmlFor="sheet-step-description">Node Description</Label>{canEditPlan && (<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingNodeDescription(prev => !prev)} title={isEditingNodeDescription ? "Finish Editing Description" : "Edit Description"}><Edit2 className="h-3.5 w-3.5" /></Button>)}</div>
                      <Textarea id="sheet-step-description" value={editingStep.description || ""} onChange={(e) => setEditingStep(prev => prev ? { ...prev, description: e.target.value } : null)} rows={4} disabled={!isEditingNodeDescription || !canEditPlan || saveRoadmapMutation.isPending} />
                    </div>
                    <div className="space-y-2 mt-3">
                      <Label>Direct Sub-steps</Label>
                      {(editingStep.subSteps && editingStep.subSteps.length > 0) ? (<ul className="space-y-1.5 border p-2 rounded-md max-h-60 overflow-y-auto">
                          {editingStep.subSteps.map((sub) => (
                             <li key={sub.id} className="flex items-center justify-between gap-2 text-sm p-1 hover:bg-muted/30 rounded">
                                <span className="truncate" title={sub.title}>{sub.title}</span>
                                {canEditPlan && (
                                  <div className="flex-shrink-0 space-x-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6 p-1" onClick={() => handleEditSubStep(sub)} title={`Edit sub-step: ${sub.title}`} disabled={saveRoadmapMutation.isPending}><Edit2 className="h-3.5 w-3.5" /></Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-destructive hover:text-destructive" onClick={() => setItemToDelete({ type: 'subStep', id: sub.id, parentId: editingStep.id, title: sub.title })} title={`Delete sub-step: ${sub.title}`} disabled={saveRoadmapMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                )}
                            </li>
                          ))}
                        </ul>) : (<p className="text-xs text-muted-foreground italic">No direct sub-steps yet.</p>)}
                      {canEditPlan && (
                        <form onSubmit={(e) => { e.preventDefault(); const input = (e.target as HTMLFormElement).elements.namedItem('newMainSubStepTitle') as HTMLInputElement; /* Call function to add to editingStep.subSteps */; input.value = ''; }} className="flex gap-2 items-center mt-2">
                          <Input name="newMainSubStepTitle" placeholder="New sub-step title..." className="h-8 text-xs flex-grow" disabled={saveRoadmapMutation.isPending} />
                          <Button type="submit" variant="outline" size="xs" className="h-8 px-2" disabled={saveRoadmapMutation.isPending}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
                        </form>
                      )}
                    </div>
                  </>
                )}
              </div></ScrollArea>
              <SheetFooter className="p-4 mt-auto border-t pt-4 space-y-2 sm:space-y-0 sm:flex sm:justify-between">
                <div>
                  {canEditPlan && editingStep && (
                    editingSubStep ? (
                        <Button type="button" variant="destructive" onClick={handleDeleteThisEditingSubStep} disabled={saveRoadmapMutation.isPending} className="w-full sm:w-auto"><Trash2 className="mr-2 h-4 w-4" /> Delete This Sub-step</Button>
                    ) : (
                        <Button type="button" variant="destructive" onClick={() => handleDeleteNodeRequest(editingStep.id, editingStep.title)} disabled={saveRoadmapMutation.isPending} className="w-full sm:w-auto"><Trash2 className="mr-2 h-4 w-4" /> Delete Node</Button>
                    )
                  )}
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                  <Button type="button" variant="outline" onClick={() => editingSubStep ? setEditingSubStep(null) : setIsStepDetailSheetOpen(false)} disabled={saveRoadmapMutation.isPending}>
                      {editingSubStep ? "Back to Main Step Details" : "Close Panel"}
                  </Button>
                  {canEditPlan && (
                    editingSubStep ? (
                        <Button type="button" onClick={handleSaveSubStepDetails} disabled={saveRoadmapMutation.isPending || !editingSubStep}>{saveRoadmapMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Sub-step Changes</Button>
                    ) : (
                        <Button type="button" onClick={() => { if (editingStep) { handleStepDetailUpdate(editingStep); setIsStepDetailSheetOpen(false); setEditingStep(null); }}} disabled={saveRoadmapMutation.isPending || !editingStep || (!isEditingNodeTitle && !isEditingNodeDescription) }>{saveRoadmapMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Node Changes</Button>
                    )
                  )}
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete: "{itemToDelete?.title}"?</AlertDialogTitle>
                <AlertDialogDescription>
                   {itemToDelete?.type === 'step'
                     ? "This will remove the node. Its child nodes will become root nodes. This action cannot be undone."
                     : "This will remove the sub-step and all its nested sub-steps. This action cannot be undone."}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteItem} className="bg-destructive hover:bg-destructive/90" disabled={!canEditPlan || saveRoadmapMutation.isPending}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
