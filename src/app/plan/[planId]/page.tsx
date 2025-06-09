
// src/app/plan/[planId]/page.tsx
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
  History,
  Eye,
  Unlink,
  PlusCircle,
  GitTree, // Using GitTree as a placeholder for child indicator
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

import { getPlanById, updatePlanRoadmap, getPlanVersions, restorePlanToVersion } from '@/services/planService';
import type { ClientPlan, RoadmapStep, UpdatePlanRoadmapData, ClientPlanVersion } from '@/types/plan';
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
import { getInitials } from '@/lib/pseudonymUtils';

const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const NODE_BASE_MIN_HEIGHT = 80;
const NODE_HEADER_HEIGHT = 40;
const CHILD_NODE_ITEM_HEIGHT = 24;
const NODE_CONTENT_PADDING_Y = 16;
const FINAL_BUFFER_CARD_HEIGHT = 8;
const DOT_SIZE = 12;
const DOT_OFFSET = -DOT_SIZE / 2;
const CONNECTION_LINE_THICKNESS_HIERARCHY = 2;
const ARROWHEAD_LENGTH = 10;
const ARROWHEAD_WIDTH_FACTOR = 0.7;
const CLICK_MOVE_THRESHOLD_PX_SQ = 25;
const CLICK_TIME_THRESHOLD_MS = 300;
const DEFAULT_SPACING_X = 80;
const DEFAULT_SPACING_Y = 60;

const calculateNodeHeight = (step: RoadmapStep, allSteps: RoadmapStep[]): number => {
  let height = NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y;
  let descriptionLineCount = 0;
  if (step.description && step.description.trim().length > 0) {
    const lines = Math.ceil(step.description.length / 35) + step.description.split(/\\r\\n|\\r|\\n/).length -1;
    descriptionLineCount = Math.max(1, lines);
  }
  const descriptionHeight = descriptionLineCount * 15;

  let childNodesListHeight = 0;
  const childCanvasNodes = allSteps.filter(s => s.parentId === step.id);
  if (childCanvasNodes.length > 0) {
    childNodesListHeight = (childCanvasNodes.length * CHILD_NODE_ITEM_HEIGHT) + (CHILD_NODE_ITEM_HEIGHT / 2);
  }

  const contentHeight = Math.max(descriptionHeight, childNodesListHeight);
  height += contentHeight;
  height += FINAL_BUFFER_CARD_HEIGHT;
  return Math.max(NODE_BASE_MIN_HEIGHT, height);
};

interface RoadmapStepCardProps {
  step: RoadmapStep;
  allSteps: RoadmapStep[];
  onNodeInteractionStart: (nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => void;
  onDotInteractionStart: (nodeId: string, anchor: 'N' | 'S' | 'E', event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => void;
  isSelected?: boolean;
  isSubmitting: boolean;
  onEditStep: (step: RoadmapStep) => void;
  onSelectChildNodeOnCanvas: (childNodeId: string) => void;
  isActuallyDraggingThisNode?: boolean;
  onAddNestedChild: (parentId: string) => void;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  allSteps,
  onNodeInteractionStart,
  onDotInteractionStart,
  isSelected,
  isSubmitting,
  onEditStep,
  onSelectChildNodeOnCanvas,
  isActuallyDraggingThisNode,
  onAddNestedChild,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const dynamicHeight = calculateNodeHeight(step, allSteps);
  const childCanvasNodes = useMemo(() => allSteps.filter(s => s.parentId === step.id), [allSteps, step.id]);

  interface ConnectionDotProps {
    anchor: 'N' | 'S' | 'E';
    nodeId: string;
    isSubmitting: boolean;
    style?: React.CSSProperties;
  }

  const ConnectionDot: React.FC<ConnectionDotProps> = ({ anchor, nodeId: localNodeId, isSubmitting: propIsSubmitting, style }) => {
    const dotClickableSize = DOT_SIZE;
    const titleText = `Drag from "${step.title}" (Anchor: ${anchor}) to connect or create child node.`;
    const dotVisualClasses = "h-2 w-2 bg-primary group-hover:bg-primary group-hover:scale-150 group-hover:ring-2 group-hover:ring-primary/60";

    return (
      <button
        aria-label={titleText}
        title={titleText}
        className={cn(
          "group absolute rounded-full z-20 transition-all duration-150 ease-in-out flex items-center justify-center active:scale-110",
          propIsSubmitting && "cursor-not-allowed opacity-50"
        )}
        style={{ width: dotClickableSize, height: dotClickableSize, ...style }}
        onMouseDown={(e) => { if (propIsSubmitting) return; e.stopPropagation(); onDotInteractionStart(localNodeId, anchor, e); }}
        onTouchStart={(e) => { if (propIsSubmitting) return; e.stopPropagation(); onDotInteractionStart(localNodeId, anchor, e); }}
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
        backgroundColor: 'hsl(var(--card))',
      }}
      onMouseDown={(e) => onNodeInteractionStart(step.id, e)}
      onTouchStart={(e) => onNodeInteractionStart(step.id, e)}
      onClick={(e) => {
        if (isActuallyDraggingThisNode) {
            e.stopPropagation();
            return;
        }
        if (!isSelected) {
           onEditStep(step);
        }
      }}
      data-node-id={step.id}
    >
      <div
        className="p-2 border-b border-border flex items-center justify-between cursor-move rounded-t-lg h-[40px]"
        style={{ backgroundColor: 'hsl(var(--primary))' }}
        onDoubleClick={() => onEditStep(step)}
      >
        <h3 className="text-sm font-semibold truncate text-primary-foreground" title={step.title}>{step.title}</h3>
      </div>
      <div className="p-2 text-xs flex-grow min-h-0 space-y-1" style={{ backgroundColor: 'hsl(var(--card))' }}
           onDoubleClick={() => onEditStep(step)}
      >
        {step.description && (<p className="whitespace-pre-wrap line-clamp-2 mb-1 text-foreground">{step.description}</p>)}

        {childCanvasNodes.length > 0 && (
          <>
            <p className="text-[11px] font-medium text-muted-foreground mt-1 mb-0.5">Child Nodes:</p>
            <ul className="space-y-0.5 list-none p-0 m-0 max-h-16 overflow-y-auto custom-scrollbar-xs">
              {childCanvasNodes.map((childNode) => {
                const hasGrandChildren = allSteps.some(s => s.parentId === childNode.id);
                return (
                  <li key={childNode.id} className="text-xs py-0 flex items-center justify-between group/childitem text-foreground hover:text-primary" title={`View child node: ${childNode.title}`}>
                    <div className="flex items-center flex-grow min-w-0">
                       <div
                        className={cn(
                          "h-2 w-2 rounded-full mr-1.5 flex-shrink-0",
                          hasGrandChildren ? "bg-green-500" : "border border-green-600"
                        )}
                        title={hasGrandChildren ? "This child has further children" : "This child has no children"}
                      />
                      <span className="truncate cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelectChildNodeOnCanvas(childNode.id); }}>
                        {childNode.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onAddNestedChild(childNode.id); }}
                      className="p-0.5 opacity-0 group-hover/childitem:opacity-100 focus-visible:opacity-100 rounded hover:bg-muted"
                      title={`Add child to "${childNode.title}"`}
                      disabled={isSubmitting}
                    >
                      <PlusCircle className="h-3.5 w-3.5 text-green-600 hover:text-green-700" />
                      <span className="sr-only">Add child to {childNode.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {(!step.description || step.description.trim().length === 0) && childCanvasNodes.length === 0 && (
          <p className="italic text-muted-foreground text-center py-2 text-[11px]">No details or children.</p>
        )}
      </div>
      <ConnectionDot anchor="N" nodeId={step.id} isSubmitting={isSubmitting} style={{ top: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE/2}px)` }} />
      <ConnectionDot anchor="S" nodeId={step.id} isSubmitting={isSubmitting} style={{ bottom: DOT_OFFSET, left: `calc(50% - ${DOT_SIZE/2}px)` }} />
      <ConnectionDot anchor="E" nodeId={step.id} isSubmitting={isSubmitting} style={{ right: DOT_OFFSET, top: `calc(50% - ${DOT_SIZE/2}px)` }} />
    </div>
  );
});
RoadmapStepCard.displayName = "RoadmapStepCard";

interface LineContextMenuState { isOpen: boolean; x: number; y: number; childNodeId: string; }

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
  const [isAddNodeDialogOpen, setIsAddNodeDialogOpen] = useState(false);
  const [targetParentIdForDialog, setTargetParentIdForDialog] = useState<string | null>(null);

  const [editingStep, setEditingStep] = useState<RoadmapStep | null>(null);
  const [isStepDetailSheetOpen, setIsStepDetailSheetOpen] = useState(false);
  const [isEditingNodeTitle, setIsEditingNodeTitle] = useState(false);
  const [isEditingNodeDescription, setIsEditingNodeDescription] = useState(false);

  const [nodeToDelete, setNodeToDelete] = useState<RoadmapStep | null>(null);
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

  interface NodeDragInfo { type: 'node'; nodeId: string; offsetX: number; offsetY: number; }
  interface ConnectionDragInfo { type: 'connectionDot'; sourceNodeId: string; sourceAnchor: 'N' | 'S' | 'E'; startX: number; startY: number; }
  interface PointerStartInfo { clientX: number; clientY: number; timestamp: number; targetElement: EventTarget | null; }

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
      setIsRestoreConfirmOpen(false); setVersionToRestore(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Restore Failed", description: error.message || "Could not restore plan." });
      setIsRestoreConfirmOpen(false); setVersionToRestore(null);
    },
  });

  useEffect(() => {
    if (planData) {
      setEditableRoadmap(planData.roadmap?.map(step => ({ ...step, parentId: step.parentId === undefined ? null : step.parentId })) || []);
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

  const canEditPlan = !!user && (planData?.ownerId === user.uid);

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

  const handleEditStep = useCallback((stepToEdit: RoadmapStep) => {
    setEditingStep(stepToEdit);
    setIsStepDetailSheetOpen(true);
    setIsEditingNodeTitle(false);
    setIsEditingNodeDescription(false);
  }, []);

  const handleAddNode = useCallback((data: AddRoadmapStepFormData) => {
    if (!canEditPlan) return;
    let newStepX = 100, newStepY = 100;

    const newNode: RoadmapStep = {
      id: `step-${Date.now()}-${uuidv4().substring(0, 8)}`,
      title: data.title,
      description: null,
      x: newStepX,
      y: newStepY,
      parentId: targetParentIdForDialog, // Set parentId from dialog context
    };

    if (targetParentIdForDialog) { // Creating a child node
        const parentNode = editableRoadmap.find(s => s.id === targetParentIdForDialog);
        if (parentNode) {
            newNode.x = Math.max(MIN_CANVAS_PADDING, parentNode.x - NODE_BASE_WIDTH - DEFAULT_SPACING_X); // Position to the left
            newNode.y = Math.max(MIN_CANVAS_PADDING, parentNode.y); // Align Y with parent
        } else { // Fallback if parent not found (should not happen)
             if (canvasRef.current) {
                newNode.x = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2);
                newNode.y = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - NODE_BASE_MIN_HEIGHT / 2);
             }
        }
    } else if (canvasRef.current) { // Creating a root node
      newNode.x = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2);
      newNode.y = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - NODE_BASE_MIN_HEIGHT / 2);
    }

    setEditableRoadmap(prev => [...prev, newNode]);
    setIsAddNodeDialogOpen(false);
    setTargetParentIdForDialog(null); // Reset after use
    toast({ title: "Node Added", description: `"${data.title}" added ${targetParentIdForDialog ? 'as child node' : 'as root node'}. Remember to save the plan.` });
  }, [canEditPlan, editableRoadmap, targetParentIdForDialog, toast]);

  const handleInitiateAddChildToNode = useCallback((parentId: string | null) => {
    if (!canEditPlan) return;
    setTargetParentIdForDialog(parentId);
    setIsAddNodeDialogOpen(true);
  }, [canEditPlan]);

  const confirmDeleteNode = useCallback(() => {
    if (!nodeToDelete || !canEditPlan) return;
    const idToDelete = nodeToDelete.id;
    setEditableRoadmap(prev => {
        // Children of the deleted node become root nodes
        const updatedChildren = prev
            .filter(s => s.parentId === idToDelete)
            .map(child => ({ ...child, parentId: null, x: child.x + 10, y: child.y + 10 })); // Slight offset
        const remainingNodes = prev.filter(s => s.id !== idToDelete && s.parentId !== idToDelete);
        return [...remainingNodes, ...updatedChildren];
    });
    if (editingStep?.id === idToDelete) {
        setIsStepDetailSheetOpen(false);
        setEditingStep(null);
    }
    toast({ title: `Node "${nodeToDelete.title}" Deleted`, description: `Its children (if any) are now root nodes. Remember to save the plan.` });
    setNodeToDelete(null);
  }, [nodeToDelete, canEditPlan, toast, editingStep]);

  const handleStepDetailUpdate = useCallback((updatedStep: RoadmapStep) => {
    if (!canEditPlan) return;
    setEditableRoadmap(prev => prev.map(s => s.id === updatedStep.id ? updatedStep : s));
    toast({ title: "Node Updated", description: `"${updatedStep.title}" details changed. Remember to save the plan.`});
    setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);
  }, [canEditPlan, toast]);

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
  }, [canEditPlan, getPointerCoords, lineContextMenu]);

  const handleDotInteractionStart = useCallback((nodeId: string, clickedAnchor: 'N' | 'S' | 'E', event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    if (('button' in event && (event as React.MouseEvent).button !== 0) || !canEditPlan || !canvasRef.current) return;
    if (lineContextMenu?.isOpen) setLineContextMenu(null);
    const { clientX, clientY } = getPointerCoords(event);
    const dotElement = event.currentTarget as HTMLElement;
    const dotCenterCanvas = getElementCenter(dotElement);
    connectionDragInfoRef.current = { type: 'connectionDot', sourceNodeId: nodeId, sourceAnchor: clickedAnchor, startX: dotCenterCanvas.x, startY: dotCenterCanvas.y };
    nodeDragInfoRef.current = null;
    clickStartInfoRef.current = { clientX, clientY, timestamp: Date.now(), targetElement: event.currentTarget };
    isDraggingRef.current = false;
    setIsPointerDown(true);
  }, [canEditPlan, getElementCenter, getPointerCoords, lineContextMenu]);

  const isCyclical = (potentialChildId: string, potentialParentId: string, currentRoadmap: RoadmapStep[]): boolean => {
    let current = potentialParentId;
    const visited = new Set<string>();
    while(current && !visited.has(current)) {
        visited.add(current);
        if (current === potentialChildId) return true;
        const node = currentRoadmap.find(n => n.id === current);
        current = node?.parentId || "";
    }
    return false;
  };

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
  }, [isPointerDown, getPointerCoords]);

  const handleGlobalPointerUp = useCallback((event: MouseEvent | TouchEvent) => {
    const clickInfo = clickStartInfoRef.current;
    const finalCoords = getPointerCoords(event);

    if (nodeDragInfoRef.current && !isDraggingRef.current && clickInfo) {
        const timeElapsed = Date.now() - clickInfo.timestamp;
        const deltaX = finalCoords.clientX - clickInfo.clientX;
        const deltaY = finalCoords.clientY - clickInfo.clientY;
        if ((deltaX * deltaX + deltaY * deltaY) < CLICK_MOVE_THRESHOLD_PX_SQ && timeElapsed < CLICK_TIME_THRESHOLD_MS) {
          const clickedStep = editableRoadmap.find(s => s.id === nodeDragInfoRef.current!.nodeId);
          if (clickedStep) handleEditStep(clickedStep);
        }
    } else if (connectionDragInfoRef.current && isDraggingRef.current && canvasRef.current) {
        const { sourceNodeId, sourceAnchor } = connectionDragInfoRef.current;
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const releaseX = finalCoords.clientX - canvasRect.left + canvasRef.current.scrollLeft;
        const releaseY = finalCoords.clientY - canvasRect.top + canvasRef.current.scrollTop;
        let targetNodeFound: RoadmapStep | null = null;

        for (const targetStep of editableRoadmap) {
            if (targetStep.id === sourceNodeId) continue;
            const targetNodeHeight = calculateNodeHeight(targetStep, editableRoadmap);
            const targetRect = { left: targetStep.x, top: targetStep.y, right: targetStep.x + NODE_BASE_WIDTH, bottom: targetStep.y + targetNodeHeight };
            if (releaseX >= targetRect.left && releaseX <= targetRect.right && releaseY >= targetRect.top && releaseY <= targetRect.bottom) {
                targetNodeFound = targetStep;
                break;
            }
        }

        if (targetNodeFound) { // Connecting to an existing node
            let childToSetParentId: string = "";
            let newParentIdForChild: string = "";

            if (sourceAnchor === 'S') { // Dragging from bottom of source
                childToSetParentId = sourceNodeId; newParentIdForChild = targetNodeFound.id;
            } else if (sourceAnchor === 'N') { // Dragging from top of source
                childToSetParentId = targetNodeFound.id; newParentIdForChild = sourceNodeId;
            } else { // Dragging from side (E) of source, make source child of target
                childToSetParentId = sourceNodeId; newParentIdForChild = targetNodeFound.id;
            }

            if (childToSetParentId && newParentIdForChild && childToSetParentId !== newParentIdForChild) {
                if (!isCyclical(childToSetParentId, newParentIdForChild, editableRoadmap)) {
                    setEditableRoadmap(prev => prev.map(s => s.id === childToSetParentId ? { ...s, parentId: newParentIdForChild } : s));
                    toast({ title: "Nodes Connected", description: `Hierarchy updated. Remember to save.` });
                } else {
                    toast({ variant: "destructive", title: "Invalid Connection", description: "This connection would create a loop." });
                }
            }
        } else { // Dropped on empty canvas, create new child node
            setTargetParentIdForDialog(sourceNodeId);
            setIsAddNodeDialogOpen(true);
        }
    }
    nodeDragInfoRef.current = null; connectionDragInfoRef.current = null; clickStartInfoRef.current = null;
    isDraggingRef.current = false; setActiveConnectionLinePreview(null); setIsPointerDown(false);
  }, [getPointerCoords, editableRoadmap, handleEditStep, toast, isCyclical]);

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
      setIsEditingNodeTitle(false);
      setIsEditingNodeDescription(false);
    }
  }, [isStepDetailSheetOpen]);

  const drawConnectionLines = () => {
    return editableRoadmap.filter(childStep => childStep.parentId).map(childStep => {
      const parentStep = editableRoadmap.find(s => s.id === childStep.parentId);
      if (!parentStep) return null;
      
      const parentNodeHeight = calculateNodeHeight(parentStep, editableRoadmap);
      // Start from parent's South dot (bottom-center edge)
      const parentAnchorPoint = { x: parentStep.x + NODE_BASE_WIDTH / 2, y: parentStep.y + parentNodeHeight };
      // End at child's North dot (top-center edge)
      const childAnchorPoint = { x: childStep.x + NODE_BASE_WIDTH / 2, y: childStep.y };

      const pathData = `M ${parentAnchorPoint.x} ${parentAnchorPoint.y} L ${childAnchorPoint.x} ${childAnchorPoint.y}`;
      return (
        <g key={`conn-${parentStep.id}-to-${childStep.id}`}>
          <path d={pathData} stroke="transparent" strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY + 12} fill="none" className="cursor-pointer" onClick={(e) => handleLineClick(e, childStep.id)} style={{pointerEvents: "stroke"}} />
          <path d={pathData} stroke={'hsl(var(--primary))'} strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY} fill="none" markerEnd={'url(#arrowhead-main)'} style={{pointerEvents: "none"}} />
        </g>
      );
    }).filter(path => path !== null);
  };

  const handleSelectChildNodeOnCanvas = useCallback((childNodeId: string) => {
    const childNode = editableRoadmap.find(step => step.id === childNodeId);
    if (childNode) {
      handleEditStep(childNode);
      const nodeElement = document.querySelector(`[data-node-id="${childNodeId}"]`) as HTMLElement;
      if (nodeElement && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const nodeRect = nodeElement.getBoundingClientRect();
        const scrollX = nodeRect.left - canvasRect.left + canvasRef.current.scrollLeft - (canvasRect.width / 2) + (nodeRect.width / 2);
        const scrollY = nodeRect.top - canvasRect.top + canvasRef.current.scrollTop - (canvasRect.height / 2) + (nodeRect.height / 2);
        canvasRef.current.scrollTo({ left: scrollX, top: scrollY, behavior: 'smooth' });
      }
    }
  }, [editableRoadmap, handleEditStep]);

  const handleRestoreVersion = (version: ClientPlanVersion) => { setVersionToRestore(version); setIsRestoreConfirmOpen(true); };
  const confirmRestore = () => { if (versionToRestore && user && planId) { restorePlanMutation.mutate({ planId, versionIdToRestore: versionToRestore.id, currentUserId: user.uid, }); } };

  if (authLoading || (isLoadingPlan && isValidPlanId)) { return <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>; }
  if (!planId || !isValidPlanId) { return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><AlertTriangle className="h-10 w-10 text-destructive mb-2" /><h1 className="text-xl font-semibold">Invalid Plan ID</h1><p className="text-muted-foreground">The plan identifier in the URL is not valid.</p><Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button></div>); }
  if (planError) { return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><AlertTriangle className="h-10 w-10 text-destructive mb-2" /><h1 className="text-xl font-semibold">Error Loading Plan</h1><p className="text-muted-foreground">{planError.message || "Could not load plan."}</p><Button onClick={() => router.back()} className="mt-4">Go Back</Button></div>); }
  if (!planData) { return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><Map className="h-10 w-10 text-muted-foreground mb-2" /><h1 className="text-xl font-semibold">Plan Not Found</h1><p className="text-muted-foreground">This collaboration plan does not exist or you do not have permission to view it.</p><Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button></div>); }

  const directChildrenOfEditingStep = editingStep ? editableRoadmap.filter(s => s.parentId === editingStep.id) : [];

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
            {canEditPlan && (<Button variant="outline" size="sm" className="h-8" onClick={() => handleInitiateAddChildToNode(null)} disabled={saveRoadmapMutation.isPending}><Plus className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">Add Root Node</span><span className="sm:hidden">+Node</span></Button>)}
            {canEditPlan && (<Button variant="default" size="sm" className="h-8" onClick={saveRoadmapChanges} disabled={saveRoadmapMutation.isPending}>{saveRoadmapMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}<span className="hidden sm:inline">Save Plan</span><span className="sm:hidden">Save</span></Button>)}
            <Button variant="outline" size="sm" className="h-8" onClick={() => setIsVersionHistorySheetOpen(true)}><History className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">History</span><span className="sm:hidden">Hist.</span></Button>
            <Button variant="outline" size="sm" className="h-8" onClick={sharePlan}><Share2 className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">Share</span><span className="sm:hidden">Share</span></Button>
            {user && (<Avatar className="h-7 w-7"><AvatarImage src={user.photoURL || undefined} alt={getInitials(user.displayName || user.email)} /><AvatarFallback className="text-xs">{getInitials(user.displayName || user.email || "U")}</AvatarFallback></Avatar>)}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main ref={canvasRef} className="flex-1 grid-background relative overflow-auto p-4 md:p-6" style={{ minHeight: canvasMinHeight }} onClick={() => { if (lineContextMenu?.isOpen) setLineContextMenu(null); }}>
          <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs><marker id="arrowhead-main" viewBox={`0 0 ${ARROWHEAD_LENGTH} ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} markerWidth={ARROWHEAD_LENGTH} markerHeight={ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR} refX={ARROWHEAD_LENGTH / 2} refY={(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2} orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points={`0 0, ${ARROWHEAD_LENGTH} ${(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2}, 0 ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} fill={'hsl(var(--primary))'}/></marker></defs>
            {drawConnectionLines()}
            {activeConnectionLinePreview && (<line x1={activeConnectionLinePreview.startX} y1={activeConnectionLinePreview.startY} x2={activeConnectionLinePreview.currentX} y2={activeConnectionLinePreview.currentY} stroke={'hsl(var(--primary))'} strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY + 1} strokeDasharray="4 4" markerEnd={'url(#arrowhead-main)'} />)}
          </svg>
          {editableRoadmap.length === 0 && !isLoadingPlan && (<div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none"><Map className="h-16 w-16 mb-4" /><p className="text-lg font-medium">Collaboration Plan Area</p><p className="text-sm mt-1">{canEditPlan ? "Click '+ Root Node' to add your first step." : "This plan currently has no steps defined."}</p></div>)}
          {editableRoadmap.map(step => (<RoadmapStepCard key={step.id} step={step} allSteps={editableRoadmap} onNodeInteractionStart={handleNodeInteractionStart} onDotInteractionStart={handleDotInteractionStart} isSelected={editingStep?.id === step.id} isSubmitting={saveRoadmapMutation.isPending} onEditStep={handleEditStep} onSelectChildNodeOnCanvas={handleSelectChildNodeOnCanvas} isActuallyDraggingThisNode={isDraggingRef.current && nodeDragInfoRef.current?.nodeId === step.id} onAddNestedChild={handleInitiateAddChildToNode} />))}
          <Popover open={lineContextMenu?.isOpen || false} onOpenChange={(open) => { if (!open) setLineContextMenu(null); }}><PopoverTrigger asChild><div className="fixed" style={{ left: `${lineContextMenu?.x || 0}px`, top: `${lineContextMenu?.y || 0}px`, width: 0, height: 0 }} /></PopoverTrigger>
            <PopoverContent className="w-auto p-1" side="right" align="start" sideOffset={5}>
              {lineContextMenu && canEditPlan && (
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => handleDetachParent(lineContextMenu.childNodeId)}><Unlink className="mr-2 h-3.5 w-3.5 text-destructive"/> Detach Child</Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </main>
      </div>
      <AddRoadmapStepDialog
        isOpen={isAddNodeDialogOpen}
        onOpenChange={setIsAddNodeDialogOpen}
        onSubmit={handleAddNode}
        isSubmitting={saveRoadmapMutation.isPending}
        dialogTitle={targetParentIdForDialog ? `Add Child to "${editableRoadmap.find(s=>s.id === targetParentIdForDialog)?.title || 'Node'}"` : "Add New Root Node"}
      />

      <Sheet open={isStepDetailSheetOpen} onOpenChange={(open) => { if (!open) { setEditingStep(null); } setIsStepDetailSheetOpen(open); setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);}}>
        <SheetContent className="sm:max-w-md flex flex-col">
          {editingStep ? (
            <>
              <SheetHeader className="border-b pb-3">
                <SheetTitle>Node: {editingStep.title}</SheetTitle>
                <SheetDescription>Modify node details and manage children.</SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-grow min-h-0"><div className="p-4 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1"><Label htmlFor="sheet-step-title">Node Title</Label>{canEditPlan && (<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingNodeTitle(prev => !prev)} title={isEditingNodeTitle ? "Finish Editing Title" : "Edit Title"}><Edit2 className="h-3.5 w-3.5" /></Button>)}</div>
                      <Input id="sheet-step-title" value={editingStep.title} onChange={(e) => setEditingStep(prev => prev ? { ...prev, title: e.target.value } : null)} disabled={!isEditingNodeTitle || !canEditPlan || saveRoadmapMutation.isPending} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1"><Label htmlFor="sheet-step-description">Node Description</Label>{canEditPlan && (<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingNodeDescription(prev => !prev)} title={isEditingNodeDescription ? "Finish Editing Description" : "Edit Description"}><Edit2 className="h-3.5 w-3.5" /></Button>)}</div>
                      <Textarea id="sheet-step-description" value={editingStep.description || ""} onChange={(e) => setEditingStep(prev => prev ? { ...prev, description: e.target.value } : null)} rows={4} disabled={!isEditingNodeDescription || !canEditPlan || saveRoadmapMutation.isPending} />
                    </div>

                    <div className="space-y-2 mt-3">
                        <Label className="flex items-center"><GitTree className="mr-1.5 h-4 w-4 text-primary/80"/>Child Nodes (On Canvas)</Label>
                        {directChildrenOfEditingStep.length > 0 ? (
                            <ul className="space-y-1.5 border p-2 rounded-md max-h-40 overflow-y-auto">
                                {directChildrenOfEditingStep.map(childNode => (
                                    <li key={childNode.id} className="flex items-center justify-between gap-2 text-sm p-1 hover:bg-muted/30 rounded">
                                        <span className="truncate" title={childNode.title}>{childNode.title}</span>
                                        <div className="flex-shrink-0 space-x-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 p-1" onClick={() => handleSelectChildNodeOnCanvas(childNode.id)} title={`View/Edit child node: ${childNode.title}`} disabled={saveRoadmapMutation.isPending}><Eye className="h-3.5 w-3.5" /></Button>
                                            {canEditPlan && (<Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-destructive hover:text-destructive" onClick={() => handleDetachParent(childNode.id)} title={`Detach child node: ${childNode.title}`} disabled={saveRoadmapMutation.isPending}><Unlink className="h-3.5 w-3.5" /></Button>)}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (<p className="text-xs text-muted-foreground italic">No child nodes on canvas yet.</p>)}
                        {canEditPlan && (
                            <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={() => handleInitiateAddChildToNode(editingStep.id)} disabled={saveRoadmapMutation.isPending}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add New Child Node to Canvas
                            </Button>
                        )}
                    </div>
              </div></ScrollArea>
              <SheetFooter className="p-4 mt-auto border-t pt-4 space-y-2 sm:space-y-0 sm:flex sm:justify-between">
                <div>
                  {canEditPlan && editingStep && (<Button type="button" variant="destructive" onClick={() => setNodeToDelete(editingStep)} disabled={saveRoadmapMutation.isPending} className="w-full sm:w-auto"><Trash2 className="mr-2 h-4 w-4" /> Delete This Node</Button>)}
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                  <SheetClose asChild><Button type="button" variant="outline" onClick={() => setEditingStep(null)} disabled={saveRoadmapMutation.isPending}>Close Panel</Button></SheetClose>
                  {canEditPlan && editingStep && (isEditingNodeTitle || isEditingNodeDescription) && (
                        <Button type="button" onClick={() => handleStepDetailUpdate(editingStep)} disabled={saveRoadmapMutation.isPending}>{saveRoadmapMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Node Changes</Button>
                  )}
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!nodeToDelete} onOpenChange={(open) => !open && setNodeToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Node: "{nodeToDelete?.title}"?</AlertDialogTitle>
                <AlertDialogDescription>This will remove the node from the canvas. Its child nodes (if any) will become root nodes. This action cannot be undone from here, but you can restore a previous plan version.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setNodeToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteNode} className="bg-destructive hover:bg-destructive/90" disabled={!canEditPlan || saveRoadmapMutation.isPending}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={isVersionHistorySheetOpen} onOpenChange={setIsVersionHistorySheetOpen}>
        <SheetContent className="sm:max-w-lg w-[90vw]" side="left">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Plan Version History (v{planData?.version || 1})</SheetTitle>
            <SheetDescription>Review past versions of this plan. You can restore to a previous version.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100%-100px)]">
            <div className="p-4 space-y-3">
              {isLoadingVersions && (<div className="flex justify-center items-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary"/><p className="ml-2 text-muted-foreground">Loading versions...</p></div>)}
              {!isLoadingVersions && versionsError && (<p className="text-sm text-destructive text-center py-4">Error loading versions: {versionsError.message}</p>)}
              {!isLoadingVersions && !versionsError && planVersions.length === 0 && (<p className="text-sm text-muted-foreground text-center py-4">No version history found.</p>)}
              {!isLoadingVersions && !versionsError && planVersions.map(version => {
                const isCurrentActiveVersion = version.versionNumber === planData?.version;
                return (
                  <div key={version.id} className={cn("p-3 border rounded-md bg-muted/30 hover:bg-muted/40 transition-colors flex justify-between items-center", isCurrentActiveVersion && "border-primary ring-1 ring-primary")}>
                    <div>
                      <p className="text-sm font-medium">Version {version.versionNumber || "(Legacy)"} {isCurrentActiveVersion && <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>}</p>
                      <p className="text-xs text-muted-foreground">Saved by: <span className="font-semibold text-foreground">{version.editorDisplayName || getInitials(version.editorUid) || version.editorUid}</span></p>
                      <p className="text-xs text-muted-foreground">{format(new Date(version.timestamp), "MMM d, yyyy, h:mm a")}</p>
                    </div>
                    <Button variant="outline" size="xs" className="h-7 px-2 text-xs" onClick={() => handleRestoreVersion(version)} disabled={isCurrentActiveVersion || restorePlanMutation.isPending} title={isCurrentActiveVersion ? "Current version" : `Restore to version ${version.versionNumber || 'this version'}`}><History className="h-3.5 w-3.5 mr-1.5" /> Restore</Button>
                  </div>);
              })}
            </div>
          </ScrollArea>
          <SheetFooter className="border-t pt-4 p-4"><SheetClose asChild><Button variant="outline">Close</Button></SheetClose></SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Restore to Version {versionToRestore?.versionNumber || 'this version'}?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to restore the plan? The current state will be saved as a new version before restoring.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => { setIsRestoreConfirmOpen(false); setVersionToRestore(null); }} disabled={restorePlanMutation.isPending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmRestore} disabled={restorePlanMutation.isPending} className="bg-primary hover:bg-primary/90">{restorePlanMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm Restore</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    
