
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
  PlusCircle,
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
const CHILD_ITEM_HEIGHT = 28; // Approximate height of a child item in the list
const CHILD_ITEM_DOT_OFFSET_X = 8 + 4; // p-2 (8px) + half of dot width (4px for 8px dot)
const CHILD_ITEM_LIST_PADDING_TOP = 8; // p-2 top padding for the content area where children are listed
const NODE_CONTENT_PADDING_Y_TOP = 8; // p-2 for the main content area
const FINAL_BUFFER_CARD_HEIGHT = 8;

const CONNECTION_LINE_THICKNESS_HIERARCHY = 1.5;
const ARROWHEAD_LENGTH = 8;
const ARROWHEAD_WIDTH_FACTOR = 0.7;
const CLICK_MOVE_THRESHOLD_PX_SQ = 25;
const CLICK_TIME_THRESHOLD_MS = 300;
const DEFAULT_SPACING_X = 80;
const DEFAULT_SPACING_Y = 40;


// Calculate height of a canvas node based on its description and *listed* childrenData
const calculateNodeHeight = (step: RoadmapStep, allSteps: RoadmapStep[]): number => {
  let height = NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y_TOP; // Header + top content padding
  let descriptionLineCount = 0;
  if (step.description && step.description.trim().length > 0) {
    const lines = Math.ceil(step.description.length / 35) + (step.description.split(/\r\n|\r|\n/).length -1); // Approximation
    descriptionLineCount = Math.max(1, lines);
  }
  const descriptionHeight = descriptionLineCount * 15; // Approx 15px per line

  const childDataItemsExist = Array.isArray(step.childrenData) && step.childrenData.length > 0;
  let childrenDataListHeight = 0;
  if (childDataItemsExist) {
    // Add height for "Child Nodes:" label if children exist
    childrenDataListHeight += 18; // Approx height for the label "Child Nodes:"
    childrenDataListHeight += step.childrenData.length * CHILD_ITEM_HEIGHT;
    childrenDataListHeight += 8; // Bottom padding for child list
  }

  const contentHeight = Math.max(descriptionHeight, childrenDataListHeight);
  height += contentHeight;
  height += FINAL_BUFFER_CARD_HEIGHT; // Bottom padding of the card
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
          <DialogTitle>{existingChildItem ? `Edit Item: "${existingChildItem.title}"` : `Add New Item to "${parentTitleContext}"`}</DialogTitle>
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
  isSubmitting: boolean;
  onEditStep: (step: RoadmapStep) => void;
  onAddGrandchildToChildDataItem: (parentChildItemId: string, parentCanvasNodeIdOfChildItem: string) => void;
  isActuallyDraggingThisNode?: boolean;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  allSteps,
  onNodeInteractionStart,
  isSelected,
  isSubmitting,
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
        backgroundColor: 'hsl(var(--card))',
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-dot-type]')) return; // Let dot specific mousedown handle it
        onNodeInteractionStart(step.id, e);
      }}
      onTouchStart={(e) => {
        if ((e.target as HTMLElement).closest('[data-dot-type]')) return;
        onNodeInteractionStart(step.id, e);
      }}
      onClick={(e) => { if (isActuallyDraggingThisNode) { e.stopPropagation(); return; } onEditStep(step); }}
      data-node-id={step.id}
    >
      <div className="p-2 border-b border-border flex items-center justify-between cursor-move rounded-t-lg h-[40px]" style={{ backgroundColor: 'hsl(var(--primary))' }} onDoubleClick={() => onEditStep(step)}>
        <h3 className="text-sm font-semibold truncate text-primary-foreground" title={step.title}>{step.title}</h3>
        {/* N, E, S dots for general connections or creating new root nodes */}
        <div
          className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary border border-card cursor-pointer"
          data-dot-type="N" title="North Connector"
          onMouseDown={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'N'); }}
          onTouchStart={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'N'); }}
        />
        <div
          className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary border border-card cursor-pointer"
          data-dot-type="E" title="East Connector"
          onMouseDown={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'E'); }}
          onTouchStart={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'E'); }}
        />
        <div
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 h-3 w-3 rounded-full bg-primary border border-card cursor-pointer"
          data-dot-type="S" title="South Connector (Parenting)"
          onMouseDown={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'S'); }}
          onTouchStart={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'S'); }}
        />
      </div>
      <ScrollArea className="flex-grow min-h-0">
        <div className="p-2 text-xs flex-grow min-h-0 space-y-1" style={{ backgroundColor: 'hsl(var(--card))' }} onClick={(e) => { if (isActuallyDraggingThisNode) e.stopPropagation(); else onEditStep(step); }}>
            {step.description && (<p className="whitespace-pre-wrap line-clamp-2 mb-1 text-foreground">{step.description}</p>)}

            {Array.isArray(step.childrenData) && step.childrenData.length > 0 && (
              <>
                <p className="text-[11px] font-medium text-muted-foreground mt-1 mb-0.5">Child Items:</p>
                <ul className="space-y-0.5 list-none p-0 m-0">
                  {step.childrenData.map((childItem) => {
                    const childCanvasNodeExists = !!childItem.canvasNodeIdForThisItem && allSteps.some(s => s.id === childItem.canvasNodeIdForThisItem);
                    const childCanvasNode = childCanvasNodeExists ? allSteps.find(s => s.id === childItem.canvasNodeIdForThisItem) : null;
                    const childHasGrandchildren = childCanvasNode ? (Array.isArray(childCanvasNode.childrenData) && childCanvasNode.childrenData.length > 0) : false;
                    
                    return (
                      <li key={childItem.id} data-child-item-id={childItem.id} className="text-xs py-0.5 flex items-center justify-between group/childitem text-foreground hover:bg-muted/30 rounded-sm pr-1">
                        <div className="flex items-center flex-grow min-w-0 pl-1">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full mr-1.5 flex-shrink-0 border",
                              childHasGrandchildren ? "bg-green-500 border-green-600" : "border-green-600",
                              !childItem.canvasNodeIdForThisItem && "opacity-50 border-dashed border-muted-foreground"
                            )}
                            title={childItem.canvasNodeIdForThisItem ? (childHasGrandchildren ? "This child has its own children (on canvas)" : "This child is a canvas node with no children") : "This child is listed but not yet a canvas node"}
                          />
                          <span
                            className="truncate cursor-pointer hover:underline"
                            onClick={(e) => { e.stopPropagation(); if (childCanvasNode) onEditStep(childCanvasNode); else onEditStep(step); }}
                            title={childItem.title}
                          >
                            {childItem.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onAddGrandchildToChildDataItem(childItem.id, step.id); }}
                          className="p-0.5 opacity-0 group-hover/childitem:opacity-100 focus-visible:opacity-100 rounded hover:bg-muted"
                          title={`Add child to "${childItem.title}"`}
                          disabled={isSubmitting}
                        >
                          <PlusCircle className="h-3.5 w-3.5 text-green-600 hover:text-green-700" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {(!step.description || step.description.trim().length === 0) && (!Array.isArray(step.childrenData) || step.childrenData.length === 0) && (
              <p className="italic text-muted-foreground text-center py-2 text-[11px]">No details or child items listed.</p>
            )}
        </div>
      </ScrollArea>
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
  const [editingStep, setEditingStep] = useState<RoadmapStep | null>(null); // The CANVAS NODE being edited in the Sheet
  const [isStepDetailSheetOpen, setIsStepDetailSheetOpen] = useState(false);
  const [isEditingNodeTitle, setIsEditingNodeTitle] = useState(false);
  const [isEditingNodeDescription, setIsEditingNodeDescription] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<RoadmapStep | null>(null);

  const [isPointerDown, setIsPointerDown] = useState(false);
  const nodeDragInfoRef = useRef<{ nodeId: string; offsetX: number; offsetY: number; isDotDrag: boolean; dotType?: 'N' | 'E' | 'S' } | null>(null);
  const clickStartInfoRef = useRef<{ clientX: number; clientY: number; timestamp: number; targetElement: EventTarget | null } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const activeConnectionLinePreviewRef = useRef<{ path: string; targetNodeId?: string } | null>(null);

  const [isVersionHistorySheetOpen, setIsVersionHistorySheetOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<ClientPlanVersion | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  const [isAddNodeDialogOpen, setIsAddNodeDialogOpen] = useState(false);
  const [targetParentIdForDialog, setTargetParentIdForDialog] = useState<string | null>(null);

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

  const handleInitiateAddNode = useCallback((parentId: string | null) => {
    if (!canEditPlan) return;
    setTargetParentIdForDialog(parentId);
    setIsAddNodeDialogOpen(true);
  }, [canEditPlan]);

  const handleAddNode = useCallback((data: AddRoadmapStepFormData) => {
    if (!canEditPlan || !canvasRef.current) return;
    const newId = `step-${Date.now()}-${uuidv4().substring(0, 8)}`;
    let newStepX = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2);
    let newStepY = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - NODE_BASE_MIN_HEIGHT / 2);

    if (targetParentIdForDialog) {
        const parentNode = editableRoadmap.find(s => s.id === targetParentIdForDialog);
        if (parentNode) {
            newStepX = parentNode.x - NODE_BASE_WIDTH - DEFAULT_SPACING_X; // Position to the left
            newStepY = parentNode.y;
        }
    }

    const newNode: RoadmapStep = {
      id: newId,
      title: data.title,
      x: Math.max(MIN_CANVAS_PADDING, newStepX),
      y: Math.max(MIN_CANVAS_PADDING, newStepY),
      description: null,
      childrenData: [], // Initialize with empty array
    };
    
    if (targetParentIdForDialog) { // If adding child to a specific Canvas Node
        setEditableRoadmap(prev => {
          const newRoadmap = [...prev, newNode];
          // Also add this new canvas node as a ChildDataItem to its parent's childrenData
          return newRoadmap.map(step => {
            if (step.id === targetParentIdForDialog) {
              const newChildDataItem: ChildDataItem = {
                id: `childitem-${newNode.id}`, // Link ChildDataItem ID to new Node ID
                title: newNode.title,
                description: newNode.description,
                parentCanvasNodeId: targetParentIdForDialog,
                canvasNodeIdForThisItem: newNode.id,
              };
              return { ...step, childrenData: [...(step.childrenData || []), newChildDataItem] };
            }
            return step;
          });
        });
        toast({ title: `Child Node Added to "${editableRoadmap.find(s => s.id === targetParentIdForDialog)?.title}"` });
    } else { // Adding a root node
        setEditableRoadmap(prev => [...prev, newNode]);
        toast({ title: "Root Node Added" });
    }
    setTargetParentIdForDialog(null);
  }, [canEditPlan, toast, editableRoadmap, targetParentIdForDialog]);

  // SPAWN: Ensure ChildDataItem becomes a canvas node
  const handleSpawnChildDataItemAsCanvasNode = useCallback((childItemId: string, parentCanvasNodeIdOfChildItem: string): string => {
    let spawnedCanvasNodeId = '';
    setEditableRoadmap(prev => {
      const parentNode = prev.find(s => s.id === parentCanvasNodeIdOfChildItem);
      if (!parentNode) return prev;
      const childItem = (parentNode.childrenData || []).find(ci => ci.id === childItemId);
      if (!childItem) return prev;

      if (childItem.canvasNodeIdForThisItem && prev.some(n => n.id === childItem.canvasNodeIdForThisItem)) {
        spawnedCanvasNodeId = childItem.canvasNodeIdForThisItem;
        return prev; // Already spawned
      }

      spawnedCanvasNodeId = `canvasnode-${childItem.id}-${uuidv4().substring(0,4)}`;
      const newSpawnedNode: RoadmapStep = {
          id: spawnedCanvasNodeId,
          title: childItem.title,
          description: childItem.description,
          x: Math.max(MIN_CANVAS_PADDING, parentNode.x + NODE_BASE_WIDTH + DEFAULT_SPACING_X),
          y: Math.max(MIN_CANVAS_PADDING, parentNode.y + ((parentNode.childrenData || []).findIndex(ci => ci.id === childItemId) * (CHILD_ITEM_HEIGHT * 1.5))),
          childrenData: [], // New canvas node starts with no children listed
      };
      
      const updatedParentNode = {
          ...parentNode,
          childrenData: (parentNode.childrenData || []).map(ci =>
            ci.id === childItemId ? { ...ci, canvasNodeIdForThisItem: spawnedCanvasNodeId } : ci
          )
      };
      return [...prev.filter(s => s.id !== parentCanvasNodeIdOfChildItem), updatedParentNode, newSpawnedNode];
    });
    toast({ title: `Node for "${childItem?.title || 'Item'}" is now on canvas.` });
    return spawnedCanvasNodeId;
  }, [toast]);

  // ADD GRANDCHILD: Called when "+" is clicked next to a ChildDataItem in a RoadmapStepCard's list
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
    setChildItemManagementContext({ parentCanvasNodeId: spawnedChildCanvasNodeId }); // New item will be child of the SPAWNED node
    setIsEditChildItemDialogOpen(true);
  }, [canEditPlan, editableRoadmap, handleSpawnChildDataItemAsCanvasNode, toast]);

  // SUBMIT CHILD ITEM DIALOG: Called by EditChildItemDialog to add/update a ChildDataItem in a CANVAS NODE's childrenData
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
            canvasNodeIdForThisItem: null, // New items don't immediately become canvas nodes
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
    if(!canEditPlan) return;
    setEditableRoadmap(prev => prev.map(cn => {
        if (cn.id === parentCanvasNodeIdOfItem) {
            const childItemToRemove = (cn.childrenData || []).find(ci => ci.id === childItemIdToDelete);
            const remainingCanvasNodes = prev.filter(node => node.id !== childItemToRemove?.canvasNodeIdForThisItem);

            const updatedChildrenData = (cn.childrenData || []).filter(ci => ci.id !== childItemIdToDelete);
            // If the removed childItem was a canvas node, also remove that canvas node from the main list
            if (childItemToRemove?.canvasNodeIdForThisItem && remainingCanvasNodes.length < prev.length) {
                toast({ title: "Item and its Canvas Node Removed", description: "Remember to save."});
                return { ...cn, childrenData: updatedChildrenData }; // Return parent with updated childrenData
            } else {
                toast({ title: "Item Removed from List", description: "Remember to save."});
                return { ...cn, childrenData: updatedChildrenData };
            }
        }
        return cn;
    }).filter(node => { // This filter might be redundant if the above logic is correct or needs refinement
        const parentNode = prev.find(p => p.id === parentCanvasNodeIdOfItem);
        const childItemToRemove = parentNode?.childrenData?.find(ci => ci.id === childItemIdToDelete);
        return node.id !== childItemToRemove?.canvasNodeIdForThisItem;
    }));
  }, [canEditPlan, toast]);

  const confirmDeleteNode = useCallback(() => {
    if (!nodeToDelete || !canEditPlan) return;
    const idToDelete = nodeToDelete.id;

    setEditableRoadmap(prev => {
        let remainingNodes = prev.filter(s => s.id !== idToDelete);
        // Update any ChildDataItem that was pointing to this deleted canvas node
        remainingNodes = remainingNodes.map(rn => ({
            ...rn,
            childrenData: (rn.childrenData || []).map(ci =>
                ci.canvasNodeIdForThisItem === idToDelete
                    ? { ...ci, canvasNodeIdForThisItem: null } // Unspawn the child item
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
    if (!nodeElement && !isDotDrag) return; // If not dragging a dot, nodeElement must exist

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

    if (nodeDragInfoRef.current?.isDotDrag) { // Dot drag for creating new connections
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
        default: return; // Should not happen
      }

      let targetNodeIdUnderCursor: string | undefined = undefined;
      const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
      const targetNodeElement = elementsAtPoint.find(el => el.hasAttribute('data-node-id') && (el as HTMLElement).dataset.nodeId !== sourceNode.id);
      if (targetNodeElement) {
          targetNodeIdUnderCursor = (targetNodeElement as HTMLElement).dataset.nodeId;
      }
      activeConnectionLinePreviewRef.current = { path: `M ${startX} ${startY} L ${currentX} ${currentY}`, targetNodeId: targetNodeIdUnderCursor };
      if (svgRef.current) svgRef.current.innerHTML = svgRef.current.innerHTML; // Force redraw hack

    } else if (isDraggingRef.current && nodeDragInfoRef.current) { // Node body drag
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

        const targetNodeId = activeConnectionLinePreviewRef.current.targetNodeId;
        const dropTargetNode = targetNodeId ? editableRoadmap.find(s => s.id === targetNodeId) : undefined;

        if (dropTargetNode) { // Dropped on an existing node (for non-hierarchical connections, if implemented)
            toast({ title: "Connect to Existing (Not Implemented)", description: `Dropped from ${sourceNode.title} (${sourceDotType}) onto ${dropTargetNode.title}. Hierarchical connections are made via in-card '+' buttons.` });
        } else { // Dropped on empty canvas
            if (sourceDotType === 'S') { // South dot drag creates a new child to this node directly
                setTargetParentIdForDialog(sourceNodeId);
                setIsAddNodeDialogOpen(true); // This will use targetParentIdForDialog to make a child
            } else { // N or E dots create new root nodes for now
                setTargetParentIdForDialog(null);
                setIsAddNodeDialogOpen(true);
                 toast({ title: "Creating Root Node", description: "Drag from S-dot to create a child."});
            }
        }
    } else if (nodeDragInfoRef.current && !isDraggingRef.current && clickStartInfoRef.current) { // Click on node body
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
    if (svgRef.current) svgRef.current.innerHTML = svgRef.current.innerHTML; // Force redraw hack
  }, [getPointerCoords, editableRoadmap, handleEditCanvasNode, toast]);


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

    editableRoadmap.forEach(parentStep => {
      if (!parentStep || !Array.isArray(parentStep.childrenData)) {
        console.error(`[drawConnectionLines] Skipping parentStep (ID: ${parentStep?.id}) due to missing or invalid childrenData.`);
        return;
      }

      parentStep.childrenData.forEach((childItem, childItemIndex) => {
        if (childItem.canvasNodeIdForThisItem) {
          const childCanvasNode = editableRoadmap.find(n => n.id === childItem.canvasNodeIdForThisItem);
          if (!childCanvasNode) return;

          // START POINT: Center of the green dot next to childItem's title within parentStep's card.
          const parentContentPaddingTop = NODE_CONTENT_PADDING_Y_TOP; // 8px from p-2
          const childItemsListLabelHeight = 18; // Approximate height for "Child Items:" label
          const startX = parentStep.x + CHILD_ITEM_DOT_OFFSET_X;
          const startY = parentStep.y + NODE_HEADER_HEIGHT + parentContentPaddingTop + childItemsListLabelHeight + (childItemIndex * CHILD_ITEM_HEIGHT) + (CHILD_ITEM_HEIGHT / 2);

          // END POINT: North dot (center-top) of the childCanvasNode card
          const endX = childCanvasNode.x + NODE_BASE_WIDTH / 2;
          const endY = childCanvasNode.y;

          const pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
          // Unique key incorporating positions to ensure re-render when nodes move
          const pathKey = `conn-${parentStep.id}-${childItem.id}-to-${childCanvasNode.id}-${startX}-${startY}-${endX}-${endY}`;

          lines.push(
            <path
              key={pathKey}
              d={pathData}
              stroke={'hsl(var(--primary))'}
              strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY}
              fill="none"
              markerEnd={'url(#arrowhead-main)'}
              style={{ pointerEvents: "none" }}
            />
          );
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
            <RoadmapStepCard key={step.id} step={step} allSteps={editableRoadmap} onNodeInteractionStart={handleNodeInteractionStart} isSelected={editingStep?.id === step.id} isSubmitting={saveRoadmapMutation.isPending} onEditStep={handleEditCanvasNode} onAddGrandchildToChildDataItem={handleAddGrandchildToChildDataItem} isActuallyDraggingThisNode={isDraggingRef.current && nodeDragInfoRef.current?.nodeId === step.id} />
          ))}
        </main>
      </div>

      <AddRoadmapStepDialog
        isOpen={isAddNodeDialogOpen}
        onOpenChange={setIsAddNodeDialogOpen}
        onSubmit={handleAddNode}
        isSubmitting={saveRoadmapMutation.isPending}
        parentStepTitle={targetParentIdForDialog ? editableRoadmap.find(s => s.id === targetParentIdForDialog)?.title : null}
        dialogTitle={targetParentIdForDialog ? `Add Child to "${editableRoadmap.find(s => s.id === targetParentIdForDialog)?.title || 'Node'}"` : "Add New Root Node"}
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
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Child Item to "{editingStep.title}"
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
