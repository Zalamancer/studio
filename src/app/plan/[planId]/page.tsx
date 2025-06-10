
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
  ListTree,
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

import { getPlanById, updatePlanRoadmap as savePlanData, getPlanVersions, restorePlanToVersion } from '@/services/planService';
import type { ClientPlan, RoadmapStep, ChildDataItem, UpdatePlanData, ClientPlanVersion } from '@/types/plan';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn, IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { format } from 'date-fns';
import { getInitials } from '@/lib/pseudonymUtils';
import { AddRoadmapStepDialog, type AddRoadmapStepFormData } from '@/components/plan/AddRoadmapStepDialog';


const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const NODE_BASE_MIN_HEIGHT = 80;
const NODE_HEADER_HEIGHT = 40;
const CHILD_ITEM_HEIGHT = 28;
const FINAL_BUFFER_CARD_HEIGHT = 8;

const CONNECTION_LINE_THICKNESS_HIERARCHY = 1.5;
const ARROWHEAD_LENGTH = 8;
const ARROWHEAD_WIDTH_FACTOR = 0.7;
const CLICK_MOVE_THRESHOLD_PX_SQ = 25;
const CLICK_TIME_THRESHOLD_MS = 300;
const DEFAULT_SPACING_X = 80;
const DEFAULT_SPACING_Y = 40;

const calculateNodeHeight = (step: RoadmapStep, allSteps: RoadmapStep[]): number => {
  let height = NODE_HEADER_HEIGHT;
  let contentAreaHeight = 0;

  let descriptionLineCount = 0;
  if (step.description && step.description.trim().length > 0) {
    const lines = Math.ceil(step.description.length / 35) + (step.description.split(/\r\n|\r|\n/).length - 1);
    descriptionLineCount = Math.max(1, lines);
  }
  const descriptionHeight = descriptionLineCount * 15 + (descriptionLineCount > 0 ? 8 : 0);

  let childrenDataListHeight = 0;
  if (Array.isArray(step.childrenData) && step.childrenData.length > 0) {
    childrenDataListHeight += 8; // Top padding for the list
    childrenDataListHeight += step.childrenData.length * CHILD_ITEM_HEIGHT;
    childrenDataListHeight += 8; // Bottom padding for the list
  }
  
  contentAreaHeight = Math.max(descriptionHeight, childrenDataListHeight);
  if (contentAreaHeight === 0 && (!step.description || step.description.trim().length === 0) && (!Array.isArray(step.childrenData) || step.childrenData.length === 0)) { 
      contentAreaHeight = 20;
  }

  height += contentAreaHeight;
  height += FINAL_BUFFER_CARD_HEIGHT;
  return Math.max(NODE_BASE_MIN_HEIGHT, height);
};


interface EditChildItemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description?: string }) => void;
  isSubmitting: boolean;
  existingChildItem?: ChildDataItem | null;
  parentTitleContext: string;
}

const EditChildItemDialog: React.FC<EditChildItemDialogProps> = ({ isOpen, onOpenChange, onSubmit, isSubmitting, existingChildItem, parentTitleContext }) => {
  const [title, setTitle] = useState(existingChildItem?.title || "");
  const [description, setDescription] = useState(existingChildItem?.description || "");

  useEffect(() => {
    if (isOpen) {
      setTitle(existingChildItem?.title || "");
      setDescription(existingChildItem?.description || "");
    }
  }, [isOpen, existingChildItem]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Child item title cannot be empty.");
      return;
    }
    onSubmit({ title: title.trim(), description: description.trim() || undefined });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existingChildItem ? `Edit Item: "${existingChildItem.title}"` : `Add Item to "${parentTitleContext}"`}</DialogTitle>
          <DialogDescription>Define the details for this item.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="child-item-title-dialog">Title <span className="text-destructive">*</span></Label>
            <Input id="child-item-title-dialog" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Research Competitors" disabled={isSubmitting} />
          </div>
          <div>
            <Label htmlFor="child-item-description-dialog">Description (Optional)</Label>
            <Textarea id="child-item-description-dialog" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details about this item..." rows={3} disabled={isSubmitting} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existingChildItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface RoadmapStepCardProps {
  step: RoadmapStep;
  allSteps: RoadmapStep[];
  onNodeInteractionStart: (nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isDotDrag?: boolean, dotType?: 'N' | 'E' | 'S') => void;
  isSelected?: boolean;
  onEditStep: (step: RoadmapStep) => void;
  onAddGrandchildToChildDataItem: (parentChildItemId: string, parentCanvasNodeIdOfChildItem: string) => void;
  isActuallyDraggingThisNode?: boolean;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  allSteps,
  onNodeInteractionStart,
  isSelected,
  onEditStep,
  onAddGrandchildToChildDataItem,
  isActuallyDraggingThisNode,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const dynamicHeight = calculateNodeHeight(step, allSteps);

  return (
    <div
      ref={cardRef}
      className={cn(
        "group/cardnode absolute select-none shadow-lg border rounded-lg flex flex-col",
        isSelected ? "ring-2 ring-primary shadow-2xl z-20" : "border-border hover:shadow-xl z-10 shadow-sm",
        isActuallyDraggingThisNode ? 'cursor-grabbing shadow-2xl z-30' : 'cursor-grab'
      )}
      style={{
        left: `${step.x}px`,
        top: `${step.y}px`,
        width: `${NODE_BASE_WIDTH}px`,
        height: `${dynamicHeight}px`,
        touchAction: 'none',
        backgroundColor: 'hsl(var(--card))',
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-dot-type]') || (e.target as HTMLElement).closest('[data-child-item-dot-id]')) return;
        onNodeInteractionStart(step.id, e);
      }}
      onTouchStart={(e) => {
        if ((e.target as HTMLElement).closest('[data-dot-type]') || (e.target as HTMLElement).closest('[data-child-item-dot-id]')) return;
        onNodeInteractionStart(step.id, e);
      }}
      onClick={(e) => { if (isActuallyDraggingThisNode || (e.target as HTMLElement).closest('[data-child-item-dot-id]')) { e.stopPropagation(); return; } onEditStep(step); }}
      data-node-id={step.id}
    >
      <div className="p-2 border-b border-border flex items-center justify-between cursor-move rounded-t-lg h-[40px]" style={{ backgroundColor: 'hsl(var(--primary))' }} onDoubleClick={() => onEditStep(step)}>
        <h3 className="text-sm font-semibold truncate text-primary-foreground" title={step.title}>{step.title}</h3>
        
        <div
          className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-muted-foreground transition-all duration-150 ease-in-out group-hover/cardnode:bg-primary group-hover/cardnode:scale-150 group-hover/cardnode:ring-2 group-hover/cardnode:ring-primary/60 group-hover/cardnode:z-10 cursor-pointer"
          data-dot-type="N" title="North Connector (Drag to connect or create new)"
          onMouseDown={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'N'); }}
          onTouchStart={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'N'); }}
        />
        <div
          className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-muted-foreground transition-all duration-150 ease-in-out group-hover/cardnode:bg-primary group-hover/cardnode:scale-150 group-hover/cardnode:ring-2 group-hover/cardnode:ring-primary/60 group-hover/cardnode:z-10 cursor-pointer"
          data-dot-type="E" title="East Connector (Drag to connect or create new)"
          onMouseDown={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'E'); }}
          onTouchStart={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'E'); }}
        />
        <div
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 h-2 w-2 rounded-full bg-muted-foreground transition-all duration-150 ease-in-out group-hover/cardnode:bg-primary group-hover/cardnode:scale-150 group-hover/cardnode:ring-2 group-hover/cardnode:ring-primary/60 group-hover/cardnode:z-10 cursor-pointer"
          data-dot-type="S" title="South Connector (Drag to connect or create new)"
          onMouseDown={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'S'); }}
          onTouchStart={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'S'); }}
        />
      </div>
      <div className="flex-grow min-h-0 p-2 text-xs space-y-1" style={{ backgroundColor: 'hsl(var(--card))' }} onClick={(e) => { if (isActuallyDraggingThisNode || (e.target as HTMLElement).closest('[data-child-item-dot-id]')) e.stopPropagation(); else onEditStep(step); }}>
          {step.description && (<p className="whitespace-pre-wrap line-clamp-2 mb-1 text-foreground">{step.description}</p>)}
          
          {Array.isArray(step.childrenData) && step.childrenData.length > 0 && (
            <ul className="space-y-0.5 list-none p-0 m-0" style={{paddingTop: `8px`}}>
              {step.childrenData.map((childItem, index) => {
                const childCanvasNode = childItem.canvasNodeIdForThisItem ? allSteps.find(s => s.id === childItem.canvasNodeIdForThisItem) : null;
                const childHasSubStepsOnCanvas = !!(childCanvasNode && Array.isArray(childCanvasNode.childrenData) && childCanvasNode.childrenData.length > 0);
                
                return (
                  <li key={childItem.id} data-child-item-index={index} className="text-xs py-0.5 flex items-center justify-between group/childitemli relative pl-4">
                    <div
                      data-child-item-dot-id={childItem.id}
                      title={childHasSubStepsOnCanvas ? `Add more sub-steps to "${childItem.title}"` : `Add sub-step to "${childItem.title}"`}
                      onClick={() => onAddGrandchildToChildDataItem(childItem.id, step.id)}
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full transition-all duration-150 ease-in-out cursor-pointer",
                        childHasSubStepsOnCanvas
                          ? "bg-green-500 group-hover/childitemli:bg-green-600 group-hover/childitemli:scale-125 group-hover/childitemli:ring-1 group-hover/childitemli:ring-green-400"
                          : "bg-muted-foreground group-hover/childitemli:bg-green-500 group-hover/childitemli:scale-150 group-hover/childitemli:ring-2 group-hover/childitemli:ring-green-300"
                      )}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center flex-grow min-w-0">
                      <span
                        className="truncate cursor-pointer hover:underline"
                        onClick={(e) => { e.stopPropagation(); if (childCanvasNode) onEditStep(childCanvasNode); else onEditStep(step); }}
                        title={childItem.title}
                      >
                        {childItem.title}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {(!step.description || step.description.trim().length === 0) && (!Array.isArray(step.childrenData) || step.childrenData.length === 0) && (
            <p className="italic text-muted-foreground text-center py-2 text-[11px]">No details or child items listed.</p>
          )}
      </div>
    </div>
  );
});
RoadmapStepCard.displayName = "RoadmapStepCard";


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
  const [editingStep, setEditingStep] = useState<RoadmapStep | null>(null);
  const [isStepDetailSheetOpen, setIsStepDetailSheetOpen] = useState(false);
  const [isEditingNodeTitle, setIsEditingNodeTitle] = useState(false);
  const [isEditingNodeDescription, setIsEditingNodeDescription] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<RoadmapStep | null>(null);

  const [isPointerDown, setIsPointerDown] = useState(false);
  const nodeDragInfoRef = useRef<{ nodeId: string; offsetX: number; offsetY: number; isDotDrag: boolean; dotType?: 'N' | 'E' | 'S' } | null>(null);
  const clickStartInfoRef = useRef<{ clientX: number; clientY: number; timestamp: number; targetElement: EventTarget | null } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const activeConnectionLinePreviewRef = useRef<{ path: string; targetNodeId?: string; sourceDotType?: 'N' | 'E' | 'S' } | null>(null);


  const [isVersionHistorySheetOpen, setIsVersionHistorySheetOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<ClientPlanVersion | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  const [isAddNodeDialogOpen, setIsAddNodeDialogOpen] = useState(false);
  const [targetParentIdForDialog, setTargetParentIdForDialog] = useState<string | null>(null);
  const [initiatingDotTypeForDialog, setInitiatingDotTypeForDialog] = useState<'N' | 'E' | 'S' | null>(null);


  const [isEditChildItemDialogOpen, setIsEditChildItemDialogOpen] = useState(false);
  const [childItemManagementContext, setChildItemManagementContext] = useState<{
    parentCanvasNodeId: string;
    childDataItemIdToEdit?: string;
  } | null>(null);

  const isValidPlanId = useMemo(() => !!planId && (IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20), [planId]);

  const { data: planData, isLoading: isLoadingPlan, error: planError } = useQuery<ClientPlan | null>({
    queryKey: ['plan', planId],
    queryFn: async () => (planId && isValidPlanId) ? getPlanById(planId) : null,
    enabled: !!planId && isValidPlanId && !authLoading,
  });

  const { data: planVersions = [], isLoading: isLoadingVersions } = useQuery<ClientPlanVersion[]>({
    queryKey: ['planVersions', planId],
    queryFn: () => (planId && isValidPlanId ? getPlanVersions(planId) : Promise.resolve([])),
    enabled: isVersionHistorySheetOpen && !!planId && isValidPlanId,
  });

  const saveRoadmapMutation = useMutation({
    mutationFn: (payload: { planId: string; currentUserId: string; roadmapToSave: RoadmapStep[] }) => savePlanData(payload.planId, payload.currentUserId, payload.roadmapToSave),
    onSuccess: () => {
      toast({ title: "Plan State Saved", description: "The current plan state has been saved." });
      if (planId) queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['planVersions', planId] });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save plan." })
  });

  const restorePlanMutation = useMutation({
    mutationFn: (payload: { planId: string; versionIdToRestore: string; currentUserId: string; }) => restorePlanToVersion(payload.planId, payload.versionIdToRestore, payload.currentUserId),
    onSuccess: () => {
      toast({ title: "Plan Restored", description: "The plan has been restored." });
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['planVersions', planId] });
      setIsRestoreConfirmOpen(false); setVersionToRestore(null);
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Restore Failed", description: error.message || "Could not restore plan." }),
  });

  useEffect(() => {
    if (planData) {
      const validRoadmapSteps = (planData.roadmap || []).filter(
        (s): s is RoadmapStep => s != null && typeof s.id === 'string'
      );
      const sanitizedRoadmap = validRoadmapSteps.map(s => {
        const sanitizedChildren = (Array.isArray(s.childrenData) ? s.childrenData : [])
          .filter((ci): ci is ChildDataItem => ci != null && typeof ci.id === 'string')
          .map(ci => ({
            id: ci.id,
            title: ci.title || "Untitled Child",
            description: ci.description || null,
            parentCanvasNodeId: ci.parentCanvasNodeId || s.id,
            canvasNodeIdForThisItem: ci.canvasNodeIdForThisItem || null,
          }));
        return {
          id: s.id,
          title: s.title || "Untitled Step",
          x: typeof s.x === 'number' ? s.x : 0,
          y: typeof s.y === 'number' ? s.y : 0,
          description: s.description || null,
          childrenData: sanitizedChildren,
        };
      });
      setEditableRoadmap(sanitizedRoadmap as RoadmapStep[]);
    } else {
      setEditableRoadmap([]);
    }
  }, [planData]);

  useEffect(() => {
    if (editingStep?.id && editableRoadmap) {
      const updatedVersionOfEditingStep = editableRoadmap.find(s => s.id === editingStep.id);
      if (updatedVersionOfEditingStep) {
        if (JSON.stringify(updatedVersionOfEditingStep.childrenData) !== JSON.stringify(editingStep.childrenData) ||
            updatedVersionOfEditingStep.title !== editingStep.title ||
            updatedVersionOfEditingStep.description !== editingStep.description) {
          setEditingStep(updatedVersionOfEditingStep);
        }
      } else {
        setIsStepDetailSheetOpen(false);
        setEditingStep(null);
      }
    }
  }, [editableRoadmap, editingStep?.id]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      let lowestNodeBottomY = 0;
      if (editableRoadmap.length > 0) {
        lowestNodeBottomY = Math.max(0, ...editableRoadmap.map(step => step.y + calculateNodeHeight(step, editableRoadmap)));
      }
      setCanvasMinHeight(Math.max(window.innerHeight, lowestNodeBottomY + window.innerHeight * 0.5));
    }
  }, [editableRoadmap]);

  const canEditPlan = useMemo(() => !!user && (planData?.ownerId === user.uid), [user, planData]);

  const getPointerCoords = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } => {
    if ('touches' in event && event.touches.length > 0) return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    if ('changedTouches' in event && event.changedTouches.length > 0) return { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY };
    return { clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY };
  }, []);

  const handleEditCanvasNode = useCallback((stepToEdit: RoadmapStep) => {
    setEditingStep(stepToEdit);
    setIsStepDetailSheetOpen(true);
    setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);
  }, []);

  const handleNodeDetailUpdate = useCallback((updatedStep: RoadmapStep) => {
    if (!canEditPlan) return;
    setEditableRoadmap(prev => prev.map(s =>
      s.id === updatedStep.id
        ? { ...s, ...updatedStep, childrenData: updatedStep.childrenData || (s.childrenData || []) }
        : s
    ));
    toast({ title: "Node Updated", description: `"${updatedStep.title}" details changed. Remember to save.`});
    setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);
  }, [canEditPlan, toast]);

  const handleInitiateAddNode = useCallback((parentId: string | null, initiatingDot?: 'N' | 'E' | 'S') => {
    if (!canEditPlan) return;
    setTargetParentIdForDialog(parentId);
    setInitiatingDotTypeForDialog(initiatingDot || null);
    setIsAddNodeDialogOpen(true);
  }, [canEditPlan]);

  const handleAddNode = useCallback((data: AddRoadmapStepFormData) => {
    if (!canEditPlan || !canvasRef.current) return;
    const newId = `step-${Date.now()}-${uuidv4().substring(0, 8)}`;
    let newStepX, newStepY;

    if (targetParentIdForDialog) {
      const parentNode = editableRoadmap.find(s => s.id === targetParentIdForDialog);
      if (parentNode) {
        const parentHeight = calculateNodeHeight(parentNode, editableRoadmap);
        // Default to West if no specific dot initiated, or for 'E' dot
        if (initiatingDotTypeForDialog === 'N') {
          newStepX = Math.max(MIN_CANVAS_PADDING, parentNode.x);
          newStepY = Math.max(MIN_CANVAS_PADDING, parentNode.y - NODE_BASE_MIN_HEIGHT - DEFAULT_SPACING_Y);
        } else if (initiatingDotTypeForDialog === 'S') {
          newStepX = Math.max(MIN_CANVAS_PADDING, parentNode.x);
          newStepY = Math.max(MIN_CANVAS_PADDING, parentNode.y + parentHeight + DEFAULT_SPACING_Y);
        } else { // Default to West (for 'E' dot or if no dot specified for a child context)
          newStepX = Math.max(MIN_CANVAS_PADDING, parentNode.x - NODE_BASE_WIDTH - DEFAULT_SPACING_X);
          newStepY = Math.max(MIN_CANVAS_PADDING, parentNode.y);
        }
      } else { // Fallback if parent not found (should not happen)
        newStepX = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2);
        newStepY = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - NODE_BASE_MIN_HEIGHT / 2);
      }
    } else { // Root node
      newStepX = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2);
      newStepY = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - NODE_BASE_MIN_HEIGHT / 2);
    }
    
    const newNode: RoadmapStep = {
      id: newId, title: data.title, x: newStepX, y: newStepY, description: null, childrenData: [],
    };

    setEditableRoadmap(prev => {
      let newMap = [...prev];
      if (targetParentIdForDialog) {
        const parentNodeIndex = newMap.findIndex(s => s.id === targetParentIdForDialog);
        if (parentNodeIndex > -1) {
          const parentNode = { ...newMap[parentNodeIndex] };
          const newChildDataItem: ChildDataItem = {
            id: `childitem-${newId}`, title: newNode.title, description: newNode.description,
            parentCanvasNodeId: targetParentIdForDialog, canvasNodeIdForThisItem: newNode.id,
          };
          parentNode.childrenData = [...(parentNode.childrenData || []), newChildDataItem];
          newMap[parentNodeIndex] = parentNode;
          toast({ title: `Linked Step "${newNode.title}" Added to "${parentNode.title}"` });
        }
      } else {
        toast({ title: `Root Step "${newNode.title}" Added` });
      }
      return [...newMap, newNode];
    });
    setTargetParentIdForDialog(null);
    setInitiatingDotTypeForDialog(null);
  }, [canEditPlan, toast, editableRoadmap, targetParentIdForDialog, initiatingDotTypeForDialog]);

  const handleSpawnChildDataItemAsCanvasNode = useCallback((childItemId: string, parentCanvasNodeIdOfChildItem: string): string => {
    const parentNodeForToast = editableRoadmap.find(s => s.id === parentCanvasNodeIdOfChildItem);
    const childItemForToast = parentNodeForToast?.childrenData?.find(ci => ci.id === childItemId);
    const childItemTitleForToast = childItemForToast?.title || 'Item';
    let spawnedNodeIdToReturn: string = '';

    setEditableRoadmap(prev => {
      const parentNode = prev.find(s => s.id === parentCanvasNodeIdOfChildItem);
      if (!parentNode) {
        console.error(`[Spawn] Parent node ${parentCanvasNodeIdOfChildItem} not found.`);
        spawnedNodeIdToReturn = '';
        return prev;
      }
      const childItem = (parentNode.childrenData || []).find(ci => ci.id === childItemId);
      if (!childItem) {
        console.error(`[Spawn] Child item ${childItemId} not found in parent ${parentCanvasNodeIdOfChildItem}.`);
        spawnedNodeIdToReturn = '';
        return prev;
      }

      if (childItem.canvasNodeIdForThisItem && prev.some(n => n.id === childItem.canvasNodeIdForThisItem)) {
        console.log(`[Spawn] Child item ${childItemId} already spawned as canvas node ${childItem.canvasNodeIdForThisItem}.`);
        spawnedNodeIdToReturn = childItem.canvasNodeIdForThisItem;
        return prev;
      }

      const newSpawnedNodeId = `canvasnode-${childItem.id}-${uuidv4().substring(0,4)}`;
      spawnedNodeIdToReturn = newSpawnedNodeId;

      const newSpawnedNode: RoadmapStep = {
          id: newSpawnedNodeId,
          title: childItem.title,
          description: childItem.description,
          x: Math.max(MIN_CANVAS_PADDING, parentNode.x - NODE_BASE_WIDTH - DEFAULT_SPACING_X), // Position West
          y: Math.max(MIN_CANVAS_PADDING, parentNode.y + ((parentNode.childrenData || []).findIndex(ci => ci.id === childItemId) * (CHILD_ITEM_HEIGHT * 1.2))), // Stagger vertically
          childrenData: [],
      };
      
      const updatedParentNode = {
          ...parentNode,
          childrenData: (parentNode.childrenData || []).map(ci =>
            ci.id === childItemId ? { ...ci, canvasNodeIdForThisItem: newSpawnedNodeId } : ci
          )
      };
      console.log(`[Spawn] Spawning child item ${childItemId} as new canvas node ${newSpawnedNodeId}. Parent ${parentCanvasNodeIdOfChildItem} updated.`);
      return [...prev.filter(s => s.id !== parentCanvasNodeIdOfChildItem), updatedParentNode, newSpawnedNode];
    });
    toast({ title: `Node for "${childItemTitleForToast}" is now on canvas.` });
    return spawnedNodeIdToReturn;
  }, [toast, editableRoadmap]);

  const handleAddGrandchildToChildDataItem = useCallback((targetChildItemId: string, parentCanvasNodeIdOfChildItem: string) => {
    if (!canEditPlan) return;
    let spawnedChildCanvasNodeId = editableRoadmap.find(s => s.id === parentCanvasNodeIdOfChildItem)?.childrenData?.find(ci => ci.id === targetChildItemId)?.canvasNodeIdForThisItem || null;

    if (!spawnedChildCanvasNodeId || !editableRoadmap.some(n => n.id === spawnedChildCanvasNodeId)) {
      spawnedChildCanvasNodeId = handleSpawnChildDataItemAsCanvasNode(targetChildItemId, parentCanvasNodeIdOfChildItem);
    }
    if (!spawnedChildCanvasNodeId) {
        toast({variant: "destructive", title: "Error", description: "Could not prepare parent node for new child."});
        return;
    }
    setChildItemManagementContext({ parentCanvasNodeId: spawnedChildCanvasNodeId });
    setIsEditChildItemDialogOpen(true);
  }, [canEditPlan, editableRoadmap, handleSpawnChildDataItemAsCanvasNode, toast]);

  const handleChildItemDialogSubmit = useCallback((data: { title: string; description?: string }) => {
    if (!childItemManagementContext) return;
    const { parentCanvasNodeId, childDataItemIdToEdit } = childItemManagementContext;

    setEditableRoadmap(prev => prev.map(canvasNode => {
      if (canvasNode.id === parentCanvasNodeId) {
        const currentChildrenData = Array.isArray(canvasNode.childrenData) ? canvasNode.childrenData : [];
        let updatedChildrenData;
        if (childDataItemIdToEdit) {
          updatedChildrenData = currentChildrenData.map(item =>
            item.id === childDataItemIdToEdit ? { ...item, title: data.title, description: data.description || null } : item
          );
        } else {
          const newChildDataItemId = `childitem-${Date.now()}-${uuidv4().substring(0, 8)}`;
          const newChildItem: ChildDataItem = {
            id: newChildDataItemId,
            title: data.title,
            description: data.description || null,
            parentCanvasNodeId: parentCanvasNodeId,
            canvasNodeIdForThisItem: null,
          };
          updatedChildrenData = [...currentChildrenData, newChildItem];
        }
        return { ...canvasNode, childrenData: updatedChildrenData };
      }
      return canvasNode;
    }));
    setIsEditChildItemDialogOpen(false);
    setChildItemManagementContext(null);
    toast({ title: childDataItemIdToEdit ? "Item Updated" : "Item Added to Node's List", description: "Remember to save the plan." });
  }, [childItemManagementContext, toast]);

  const handleEditChildItemText = useCallback((childItem: ChildDataItem, parentCanvasNodeIdOfChildItem: string) => {
    if(!canEditPlan) return;
    setChildItemManagementContext({ parentCanvasNodeId: parentCanvasNodeIdOfChildItem, childDataItemIdToEdit: childItem.id });
    setIsEditChildItemDialogOpen(true);
  }, [canEditPlan]);

  const handleDeleteChildItem = useCallback((childItemIdToDelete: string, parentCanvasNodeIdOfItem: string) => {
    if (!canEditPlan) return;
    setEditableRoadmap(prev => {
        let childCanvasNodeIdThatWasDeleted: string | null | undefined = null;
        const newRoadmap = prev.map(cn => {
            if (cn.id === parentCanvasNodeIdOfItem) {
                const childItemToRemove = (cn.childrenData || []).find(ci => ci.id === childItemIdToDelete);
                childCanvasNodeIdThatWasDeleted = childItemToRemove?.canvasNodeIdForThisItem;
                const updatedChildrenData = (cn.childrenData || []).filter(ci => ci.id !== childItemIdToDelete);
                return { ...cn, childrenData: updatedChildrenData };
            }
            return cn;
        });
        if (childCanvasNodeIdThatWasDeleted) {
            toast({ title: "Item and its Canvas Node Removed", description: "Remember to save."});
            return newRoadmap.filter(node => node.id !== childCanvasNodeIdThatWasDeleted);
        } else {
            toast({ title: "Item Removed from List", description: "Remember to save."});
            return newRoadmap;
        }
    });
  }, [canEditPlan, toast]);

  const confirmDeleteNode = useCallback(() => {
    if (!nodeToDelete || !canEditPlan) return;
    const idToDelete = nodeToDelete.id;

    setEditableRoadmap(prev => {
        let remainingNodes = prev.filter(s => s.id !== idToDelete);
        remainingNodes = remainingNodes.map(rn => ({
            ...rn,
            childrenData: (rn.childrenData || []).map(ci =>
                ci.canvasNodeIdForThisItem === idToDelete
                    ? { ...ci, canvasNodeIdForThisItem: null }
                    : ci
            ),
        }));
        return remainingNodes;
    });

    if (editingStep?.id === idToDelete) {
        setIsStepDetailSheetOpen(false);
        setEditingStep(null);
    }
    toast({ title: `Node "${nodeToDelete.title}" Deleted from Canvas`, description: `Remember to save.` });
    setNodeToDelete(null);
  }, [nodeToDelete, canEditPlan, toast, editingStep]);

  const saveRoadmapChanges = useCallback(async () => {
    if (!planData || !user || !planId || !canEditPlan) {
      toast({ variant: "destructive", title: "Error", description: "Cannot save." });
      return;
    }
    saveRoadmapMutation.mutate({ planId, currentUserId: user.uid, roadmapToSave: editableRoadmap });
  }, [planData, user, planId, canEditPlan, editableRoadmap, saveRoadmapMutation, toast]);

  const sharePlan = useCallback(async () => {
    if (!planData || !planId) return;
    try {
      const shareUrl = `${window.location.origin}/plan/${planId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link Copied!", description: "Plan link copied to clipboard." });
    } catch (err) {
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy link." });
    }
  }, [planData, planId, toast]);

  const handleRestoreVersion = (version: ClientPlanVersion) => { setVersionToRestore(version); setIsRestoreConfirmOpen(true); };
  const confirmRestore = () => { if (!versionToRestore || !planId || !user) return; restorePlanMutation.mutate({ planId, versionIdToRestore: versionToRestore.id, currentUserId: user.uid }); };

  const handleNodeInteractionStart = useCallback((nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isDotDrag: boolean = false, dotType?: 'N' | 'E' | 'S') => {
    if (('button' in event && (event as React.MouseEvent).button !== 0) || !canEditPlan || !canvasRef.current) return;
    const { clientX, clientY } = getPointerCoords(event);
    const nodeElement = (event.currentTarget as HTMLElement).closest('[data-node-id]') as HTMLElement;
    if (!nodeElement && !isDotDrag) return;

    const nodeRect = isDotDrag ? (event.currentTarget as HTMLElement).getBoundingClientRect() : nodeElement.getBoundingClientRect();
    const offsetX = clientX - nodeRect.left;
    const offsetY = clientY - nodeRect.top;

    nodeDragInfoRef.current = { nodeId, offsetX, offsetY, isDotDrag, dotType };
    clickStartInfoRef.current = { clientX, clientY, timestamp: Date.now(), targetElement: event.currentTarget };
    isDraggingRef.current = false;
    setIsPointerDown(true);
  }, [canEditPlan, getPointerCoords]);

  const handleGlobalMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isPointerDown || !canvasRef.current) return;
    const { clientX, clientY } = getPointerCoords(event);

    if (clickStartInfoRef.current && !isDraggingRef.current) {
      const deltaX = clientX - clickStartInfoRef.current.clientX;
      const deltaY = clientY - clickStartInfoRef.current.clientY;
      if ((deltaX * deltaX + deltaY * deltaY) > CLICK_MOVE_THRESHOLD_PX_SQ) isDraggingRef.current = true;
    }

    if (nodeDragInfoRef.current?.isDotDrag) {
      if (event.cancelable) event.preventDefault();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const currentX = clientX - canvasRect.left + canvasRef.current.scrollLeft;
      const currentY = clientY - canvasRect.top + canvasRef.current.scrollTop;
      const sourceNode = editableRoadmap.find(s => s.id === nodeDragInfoRef.current!.nodeId);
      if (!sourceNode) return;

      const sourceDotType = nodeDragInfoRef.current!.dotType;
      let startX: number, startY: number;
      const sourceNodeHeight = calculateNodeHeight(sourceNode, editableRoadmap);

      switch(sourceDotType) {
        case 'N': startX = sourceNode.x + NODE_BASE_WIDTH / 2; startY = sourceNode.y; break;
        case 'E': startX = sourceNode.x + NODE_BASE_WIDTH; startY = sourceNode.y + sourceNodeHeight / 2; break;
        case 'S': startX = sourceNode.x + NODE_BASE_WIDTH / 2; startY = sourceNode.y + sourceNodeHeight; break;
        default: return;
      }

      let targetNodeIdUnderCursor: string | undefined = undefined;
      const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
      const targetNodeElement = elementsAtPoint.find(el => el.hasAttribute('data-node-id') && (el as HTMLElement).dataset.nodeId !== sourceNode.id);
      if (targetNodeElement) {
          targetNodeIdUnderCursor = (targetNodeElement as HTMLElement).dataset.nodeId;
      }
      activeConnectionLinePreviewRef.current = { path: `M ${startX} ${startY} L ${currentX} ${currentY}`, targetNodeId: targetNodeIdUnderCursor, sourceDotType };
      if (svgRef.current) svgRef.current.style.display = 'block';
    } else if (isDraggingRef.current && nodeDragInfoRef.current) {
      if (event.cancelable) event.preventDefault();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const currentX = clientX - canvasRect.left + canvasRef.current.scrollLeft;
      const currentY = clientY - canvasRect.top + canvasRef.current.scrollTop;
      const { nodeId, offsetX = 0, offsetY = 0 } = nodeDragInfoRef.current;
      let newX = Math.max(MIN_CANVAS_PADDING, currentX - offsetX);
      let newY = Math.max(MIN_CANVAS_PADDING, currentY - offsetY);
      setEditableRoadmap(prev => prev.map(step => step.id === nodeId ? { ...step, x: newX, y: newY } : step ));
    }
  }, [isPointerDown, getPointerCoords, editableRoadmap]);

  const handleGlobalPointerUp = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isPointerDown) return;

    if (nodeDragInfoRef.current?.isDotDrag && activeConnectionLinePreviewRef.current?.path) {
        const { nodeId: sourceNodeId, dotType: sourceDotType } = nodeDragInfoRef.current;
        const sourceNode = editableRoadmap.find(s => s.id === sourceNodeId);
        if (!sourceNode) return;

        const targetNodeIdUnderCursor = activeConnectionLinePreviewRef.current.targetNodeId;
        const dropTargetNode = targetNodeIdUnderCursor ? editableRoadmap.find(s => s.id === targetNodeIdUnderCursor) : undefined;

        if (dropTargetNode) {
            // Check if dropTarget is the same as sourceNode
            if (dropTargetNode.id === sourceNode.id) {
                toast({ variant: "destructive", title: "Invalid Connection", description: "Cannot connect a node to itself." });
            } else {
                // Connect parent N/E/S dot to the West dot of the dropTargetNode
                setEditableRoadmap(prev => {
                    let newMap = [...prev];
                    const parentIndex = newMap.findIndex(s => s.id === sourceNode.id);
                    const childIndex = newMap.findIndex(s => s.id === dropTargetNode.id);
                    if (parentIndex > -1 && childIndex > -1) {
                        const parent = { ...newMap[parentIndex] };
                        const child = { ...newMap[childIndex] };
                        // Create a child item in the parent representing this connection
                        const newChildDataItem: ChildDataItem = {
                            id: `linkitem-${child.id}`, title: child.title, description: null,
                            parentCanvasNodeId: parent.id, canvasNodeIdForThisItem: child.id,
                        };
                        // Avoid duplicate child items linking to the same canvas node
                        if (!parent.childrenData.some(ci => ci.canvasNodeIdForThisItem === child.id)) {
                            parent.childrenData = [...(parent.childrenData || []), newChildDataItem];
                            newMap[parentIndex] = parent;
                            toast({ title: "Nodes Linked", description: `"${parent.title}" is now linked to "${child.title}".` });
                        } else {
                            toast({ title: "Already Linked", description: `"${parent.title}" is already linked to "${child.title}".` });
                        }
                    }
                    return newMap;
                });
            }
        } else {
            // Dropped on empty space: initiate adding a new node linked to the source dot
            handleInitiateAddNode(sourceNodeId, sourceDotType);
        }
    } else if (nodeDragInfoRef.current && !isDraggingRef.current && clickStartInfoRef.current) {
      const finalCoords = getPointerCoords(event);
      const timeElapsed = Date.now() - clickStartInfoRef.current.timestamp;
      const deltaX = finalCoords.clientX - clickStartInfoRef.current.clientX;
      const deltaY = finalCoords.clientY - clickStartInfoRef.current.clientY;
      if ((deltaX * deltaX + deltaY * deltaY) < CLICK_MOVE_THRESHOLD_PX_SQ && timeElapsed < CLICK_TIME_THRESHOLD_MS) {
        const clickedStep = editableRoadmap.find(s => s.id === nodeDragInfoRef.current!.nodeId);
        if (clickedStep) handleEditCanvasNode(clickedStep);
      }
    }

    activeConnectionLinePreviewRef.current = null;
    nodeDragInfoRef.current = null;
    clickStartInfoRef.current = null;
    isDraggingRef.current = false;
    setIsPointerDown(false);
    if (svgRef.current) svgRef.current.style.display = 'block';
  }, [isPointerDown, getPointerCoords, editableRoadmap, handleEditCanvasNode, toast, handleInitiateAddNode]);


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

  useEffect(() => { if (!isStepDetailSheetOpen) { setEditingStep(null); setIsEditingNodeTitle(false); setIsEditingNodeDescription(false); } }, [isStepDetailSheetOpen]);

  const drawConnectionLines = () => {
    if (!canvasRef.current || !editableRoadmap || editableRoadmap.length === 0) return [];
    const lines: JSX.Element[] = [];
    const canvasRectBase = canvasRef.current.getBoundingClientRect();

    editableRoadmap.forEach(parentStep => {
      if (!parentStep || !Array.isArray(parentStep.childrenData)) {
        console.warn(`[drawConnectionLines] parentStep (ID: ${parentStep?.id}) has invalid/undefined childrenData. Skipping. childrenData:`, parentStep?.childrenData);
        return;
      }

      parentStep.childrenData.forEach((childItem) => {
        if (childItem.canvasNodeIdForThisItem) {
          const childCanvasNode = editableRoadmap.find(n => n.id === childItem.canvasNodeIdForThisItem);
          if (!childCanvasNode) {
            console.warn(`[drawConnectionLines] Child canvas node ${childItem.canvasNodeIdForThisItem} not found for child item ${childItem.id} in parent ${parentStep.id}`);
            return;
          }
          const greenDotElement = canvasRef.current?.querySelector(`[data-node-id="${parentStep.id}"] [data-child-item-dot-id="${childItem.id}"]`);
          if (greenDotElement && canvasRef.current) {
            const dotRect = greenDotElement.getBoundingClientRect();
            const startX = dotRect.left - canvasRectBase.left + canvasRef.current.scrollLeft + (dotRect.width / 2);
            const startY = dotRect.top - canvasRectBase.top + canvasRef.current.scrollTop + (dotRect.height / 2);
            
            const endX = childCanvasNode.x + NODE_BASE_WIDTH; // Connect to East dot of child
            const endY = childCanvasNode.y + calculateNodeHeight(childCanvasNode, editableRoadmap) / 2; // Midpoint of East edge
            
            const pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
            const pathKey = `conn-dot-${childItem.id}-to-node-${childCanvasNode.id}-${startX}-${startY}-${endX}-${endY}`;
            lines.push(
              <path key={pathKey} d={pathData} stroke={'hsl(var(--primary))'} strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY} fill="none" markerEnd={'url(#arrowhead-main)'} style={{ pointerEvents: "none" }} />
            );
          } else {
             console.warn(`[drawConnectionLines] Could not find green dot DOM element for childItem.id: ${childItem.id} within parentStep.id: ${parentStep.id}. Line not drawn.`);
          }
        }
      });
    });
    return lines;
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
            {canEditPlan && (<Button variant="outline" size="sm" className="h-8" onClick={() => handleInitiateAddNode(null)} disabled={saveRoadmapMutation.isPending}><Plus className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">Add Root Node</span><span className="sm:hidden">+Node</span></Button>)}
            {canEditPlan && (<Button variant="default" size="sm" className="h-8" onClick={saveRoadmapChanges} disabled={saveRoadmapMutation.isPending}>{saveRoadmapMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}<span className="hidden sm:inline">Save Plan</span><span className="sm:hidden">Save</span></Button>)}
            <Button variant="outline" size="sm" className="h-8" onClick={() => setIsVersionHistorySheetOpen(true)}><History className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">History</span><span className="sm:hidden">Hist.</span></Button>
            <Button variant="outline" size="sm" className="h-8" onClick={sharePlan}><Share2 className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">Share</span><span className="sm:hidden">Share</span></Button>
            {user && (<Avatar className="h-7 w-7"><AvatarImage src={user.photoURL || undefined} alt={getInitials(user.displayName || user.email)} /><AvatarFallback className="text-xs">{getInitials(user.displayName || user.email || "U")}</AvatarFallback></Avatar>)}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main ref={canvasRef} className="flex-1 grid-background relative overflow-auto p-4 md:p-6" style={{ minHeight: canvasMinHeight }}>
          <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs><marker id="arrowhead-main" viewBox={`0 0 ${ARROWHEAD_LENGTH} ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} markerWidth={ARROWHEAD_LENGTH} markerHeight={ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR} refX={ARROWHEAD_LENGTH / 2} refY={(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2} orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points={`0 0, ${ARROWHEAD_LENGTH} ${(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2}, 0 ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} fill={'hsl(var(--primary))'}/></marker></defs>
            {drawConnectionLines()}
            {activeConnectionLinePreviewRef.current?.path && <path d={activeConnectionLinePreviewRef.current.path} stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="4 4" fill="none" markerEnd={activeConnectionLinePreviewRef.current.targetNodeId ? 'url(#arrowhead-main)' : undefined} />}
          </svg>
          {editableRoadmap.length === 0 && !isLoadingPlan && (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none">
              <Map className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">{canEditPlan ? "Click '+ Root Node' to start." : "Plan is empty."}</p>
            </div>
          )}
          {editableRoadmap.map(step => (
            <RoadmapStepCard key={step.id} step={step} allSteps={editableRoadmap} onNodeInteractionStart={handleNodeInteractionStart} isSelected={editingStep?.id === step.id} onEditStep={handleEditCanvasNode} onAddGrandchildToChildDataItem={handleAddGrandchildToChildDataItem} isActuallyDraggingThisNode={isDraggingRef.current && nodeDragInfoRef.current?.nodeId === step.id} />
          ))}
        </main>
      </div>

      <AddRoadmapStepDialog
        isOpen={isAddNodeDialogOpen}
        onOpenChange={setIsAddNodeDialogOpen}
        onSubmit={handleAddNode}
        isSubmitting={saveRoadmapMutation.isPending}
        parentStepTitle={targetParentIdForDialog ? editableRoadmap.find(s => s.id === targetParentIdForDialog)?.title : null}
        dialogTitle={targetParentIdForDialog ? `Add New Node Linked to "${editableRoadmap.find(s => s.id === targetParentIdForDialog)?.title || 'Node'}"` : "Add New Root Node"}
      />

      <Sheet open={isStepDetailSheetOpen} onOpenChange={(open) => { if (!open) { setEditingStep(null); } setIsStepDetailSheetOpen(open); setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);}}>
        <SheetContent className="sm:max-w-md flex flex-col">
          {editingStep ? (
            <>
              <SheetHeader className="border-b pb-3">
                <SheetTitle>Edit Node: {editingStep.title}</SheetTitle>
                <SheetDescription>Modify node details and manage its child items.</SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-grow min-h-0">
                <div className="p-4 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1"><Label htmlFor="sheet-step-title">Node Title</Label>{canEditPlan && (<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingNodeTitle(prev => !prev)} title={isEditingNodeTitle ? "Finish Editing Title" : "Edit Title"}><Edit2 className="h-3.5 w-3.5" /></Button>)}</div>
                      <Input id="sheet-step-title" value={editingStep.title} onChange={(e) => setEditingStep(prev => prev ? { ...prev, title: e.target.value } : null)} disabled={!isEditingNodeTitle || !canEditPlan || saveRoadmapMutation.isPending} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1"><Label htmlFor="sheet-step-description">Node Description</Label>{canEditPlan && (<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingNodeDescription(prev => !prev)} title={isEditingNodeDescription ? "Finish Editing Description" : "Edit Description"}><Edit2 className="h-3.5 w-3.5" /></Button>)}</div>
                      <Textarea id="sheet-step-description" value={editingStep.description || ""} onChange={(e) => setEditingStep(prev => prev ? { ...prev, description: e.target.value } : null)} rows={4} disabled={!isEditingNodeDescription || !canEditPlan || saveRoadmapMutation.isPending} />
                    </div>
                    <div className="space-y-2 mt-3">
                        <Label className="flex items-center"><ListTree className="mr-1.5 h-4 w-4 text-primary/80"/>Child Items (Listed in this Node)</Label>
                        {(editingStep.childrenData || []).length > 0 ? (
                            <ul className="space-y-1.5 border p-2 rounded-md max-h-48 overflow-y-auto">
                                {(editingStep.childrenData).map(childItem => (
                                    <li key={childItem.id} className="flex items-center justify-between gap-2 text-sm p-1 hover:bg-muted/30 rounded">
                                        <span className="truncate" title={childItem.title}>{childItem.title}</span>
                                        <div className="flex-shrink-0 space-x-1">
                                            {canEditPlan && <Button variant="ghost" size="icon" className="h-6 w-6 p-1" onClick={() => handleEditChildItemText(childItem, editingStep.id)} title={`Edit item: ${childItem.title}`} disabled={saveRoadmapMutation.isPending}><Edit2 className="h-3.5 w-3.5" /></Button>}
                                            {canEditPlan && <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-destructive hover:text-destructive" onClick={() => handleDeleteChildItem(childItem.id, editingStep.id)} title={`Delete item: ${childItem.title}`} disabled={saveRoadmapMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (<p className="text-xs text-muted-foreground italic">No child items listed yet for this node.</p>)}
                        {canEditPlan && (
                            <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={() => { setChildItemManagementContext({ parentCanvasNodeId: editingStep.id }); setIsEditChildItemDialogOpen(true); }} disabled={saveRoadmapMutation.isPending}>
                                <Plus className="mr-2 h-4 w-4" /> Add Child Item to "{editingStep.title}"
                            </Button>
                        )}
                    </div>
                </div>
              </ScrollArea>
              <SheetFooter className="p-4 mt-auto border-t pt-4 space-y-2 sm:space-y-0 sm:flex sm:justify-between">
                <div>{canEditPlan && editingStep && (<Button type="button" variant="destructive" onClick={() => setNodeToDelete(editingStep)} disabled={saveRoadmapMutation.isPending} className="w-full sm:w-auto"><Trash2 className="mr-2 h-4 w-4" /> Delete Node from Canvas</Button>)}</div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                  <SheetClose asChild><Button type="button" variant="outline" onClick={() => setEditingStep(null)} disabled={saveRoadmapMutation.isPending}>Close Panel</Button></SheetClose>
                  {canEditPlan && editingStep && (isEditingNodeTitle || isEditingNodeDescription) && (<Button type="button" onClick={() => handleNodeDetailUpdate(editingStep)} disabled={saveRoadmapMutation.isPending}>{saveRoadmapMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Node Changes</Button>)}
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!nodeToDelete} onOpenChange={(open) => !open && setNodeToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete Node: "{nodeToDelete?.title}"?</AlertDialogTitle><AlertDialogDescription>This will remove the node from the canvas. Any child items listed within it will be removed, and any canvas nodes spawned from those child items will become unlinked (but remain on canvas). This action cannot be undone from here, but you can restore a previous plan version.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel onClick={() => setNodeToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteNode} className="bg-destructive hover:bg-destructive/90" disabled={!canEditPlan || saveRoadmapMutation.isPending}>Delete Node</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {childItemManagementContext && (
          <EditChildItemDialog
            isOpen={isEditChildItemDialogOpen}
            onOpenChange={setIsEditChildItemDialogOpen}
            onSubmit={handleChildItemDialogSubmit}
            isSubmitting={saveRoadmapMutation.isPending}
            existingChildItem={childItemManagementContext.childDataItemIdToEdit ? editableRoadmap.find(n => n.id === childItemManagementContext.parentCanvasNodeId)?.childrenData.find(ci => ci.id === childItemManagementContext.childDataItemIdToEdit) : null}
            parentTitleContext={editableRoadmap.find(n => n.id === childItemManagementContext.parentCanvasNodeId)?.title || "Node"}
          />
      )}

      <Sheet open={isVersionHistorySheetOpen} onOpenChange={setIsVersionHistorySheetOpen}>
        <SheetContent className="sm:max-w-lg w-[90vw]" side="left"><SheetHeader className="border-b pb-4"><SheetTitle>Plan Version History (v{planData?.version || 1})</SheetTitle><SheetDescription>Review past versions of this plan. You can restore to a previous version.</SheetDescription></SheetHeader>
          <ScrollArea className="h-[calc(100%-100px)]"><div className="p-4 space-y-3">
              {isLoadingVersions && (<div className="flex justify-center items-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary"/><p className="ml-2 text-muted-foreground">Loading versions...</p></div>)}
              {!isLoadingVersions && planVersions.length === 0 && (<p className="text-sm text-muted-foreground text-center py-4">No version history.</p>)}
              {!isLoadingVersions && planVersions.map(version => (<div key={version.id} className={cn("p-3 border rounded-md bg-muted/30 hover:bg-muted/40 transition-colors flex justify-between items-center", version.versionNumber === planData?.version && "border-primary ring-1 ring-primary")}><div className="min-w-0"><p className="text-sm font-medium truncate">Version {version.versionNumber || "(Legacy)"} {version.versionNumber === planData?.version && <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>}</p><p className="text-xs text-muted-foreground truncate">Saved by: <span className="font-semibold text-foreground">{version.editorDisplayName || getInitials(version.editorUid) || version.editorUid}</span> on {format(new Date(version.timestamp), "MMM d, yyyy, h:mm a")}</p></div><Button variant="outline" size="xs" className="h-7 px-2 text-xs flex-shrink-0" onClick={() => handleRestoreVersion(version)} disabled={version.versionNumber === planData?.version || restorePlanMutation.isPending}><History className="h-3.5 w-3.5 mr-1.5" /> Restore</Button></div>))}
          </div></ScrollArea>
          <SheetFooter className="border-t pt-4 p-4"><SheetClose asChild><Button variant="outline">Close</Button></SheetClose></SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restore to Version {versionToRestore?.versionNumber || 'this version'}?</AlertDialogTitle><AlertDialogDescription>Are you sure? The current state will be saved as a new version before restoring.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => { setIsRestoreConfirmOpen(false); setVersionToRestore(null); }} disabled={restorePlanMutation.isPending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmRestore} disabled={restorePlanMutation.isPending} className="bg-primary hover:bg-primary/90">{restorePlanMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm Restore</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
