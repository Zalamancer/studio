
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
  ListTree, // Corrected from GitTree
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { format } from 'date-fns';
import { getInitials } from '@/lib/pseudonymUtils';

const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const NODE_BASE_MIN_HEIGHT = 80;
const NODE_HEADER_HEIGHT = 40;
const CHILD_ITEM_HEIGHT = 28; // Approx height per child item in list
const NODE_CONTENT_PADDING_Y = 16; // Sum of top/bottom padding in content area
const FINAL_BUFFER_CARD_HEIGHT = 8; // Extra buffer
const DOT_SIZE = 10; // Smaller green dot
const DOT_OFFSET = -DOT_SIZE / 2; // For N/E/S dots if kept
const CONNECTION_LINE_THICKNESS_HIERARCHY = 1.5;
const ARROWHEAD_LENGTH = 8;
const ARROWHEAD_WIDTH_FACTOR = 0.7;
const CLICK_MOVE_THRESHOLD_PX_SQ = 25;
const CLICK_TIME_THRESHOLD_MS = 300;
const DEFAULT_SPACING_X = 100;
const DEFAULT_SPACING_Y = 60;

// Calculate height of a canvas node based on its description and listed childrenData
const calculateNodeHeight = (step: RoadmapStep): number => {
  let height = NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y;
  let descriptionLineCount = 0;
  if (step.description && step.description.trim().length > 0) {
    const lines = Math.ceil(step.description.length / 35) + (step.description.split(/\r\n|\r|\n/).length - 1);
    descriptionLineCount = Math.max(1, lines);
  }
  const descriptionHeight = descriptionLineCount * 15;
  const childrenDataListHeight = step.childrenData.length * CHILD_ITEM_HEIGHT + (step.childrenData.length > 0 ? 8 : 0); // + padding
  const contentHeight = Math.max(descriptionHeight, childrenDataListHeight);
  height += contentHeight;
  height += FINAL_BUFFER_CARD_HEIGHT;
  return Math.max(NODE_BASE_MIN_HEIGHT, height);
};

interface RoadmapStepCardProps {
  step: RoadmapStep;
  allCanvasNodes: RoadmapStep[]; // All nodes currently on the canvas
  onNodeInteractionStart: (nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => void;
  onMainDotInteractionStart?: (nodeId: string, anchor: 'N' | 'S' | 'E', event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => void; // For N/E/S dots
  isSelected?: boolean;
  isSubmitting: boolean;
  onEditStep: (step: RoadmapStep) => void; // When canvas node card is clicked to open its details in the sheet
  onAddGrandchildToChildDataItem: (parentChildItemId: string, parentCanvasNodeId: string) => void; // New: click '+' next to a child item
  isActuallyDraggingThisNode?: boolean;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  allCanvasNodes,
  onNodeInteractionStart,
  onMainDotInteractionStart,
  isSelected,
  isSubmitting,
  onEditStep,
  onAddGrandchildToChildDataItem,
  isActuallyDraggingThisNode,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const dynamicHeight = calculateNodeHeight(step);

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
      onMouseDown={(e) => onNodeInteractionStart(step.id, e)}
      onTouchStart={(e) => onNodeInteractionStart(step.id, e)}
      onClick={(e) => { if (isActuallyDraggingThisNode) { e.stopPropagation(); return; } if (!isSelected) onEditStep(step); }}
      data-node-id={step.id}
    >
      <div className="p-2 border-b border-border flex items-center justify-between cursor-move rounded-t-lg h-[40px]" style={{ backgroundColor: 'hsl(var(--primary))' }} onDoubleClick={() => onEditStep(step)}>
        <h3 className="text-sm font-semibold truncate text-primary-foreground" title={step.title}>{step.title}</h3>
      </div>
      <div className="p-2 text-xs flex-grow min-h-0 space-y-1" style={{ backgroundColor: 'hsl(var(--card))' }} onDoubleClick={() => onEditStep(step)}>
        {step.description && (<p className="whitespace-pre-wrap line-clamp-2 mb-1 text-foreground">{step.description}</p>)}
        {step.childrenData.length > 0 && (
          <>
            <p className="text-[11px] font-medium text-muted-foreground mt-1 mb-0.5">Children:</p>
            <ul className="space-y-0.5 list-none p-0 m-0 max-h-[calc(100%-30px)] overflow-y-auto custom-scrollbar-xs">
              {step.childrenData.map((childItem) => {
                const childItemIsSpawnedAsCanvasNode = !!childItem.canvasNodeIdForThisItem;
                const spawnedChildNode = childItemIsSpawnedAsCanvasNode ? allCanvasNodes.find(n => n.id === childItem.canvasNodeIdForThisItem) : null;
                const childItemHasGrandchildren = childItemIsSpawnedAsCanvasNode && spawnedChildNode && spawnedChildNode.childrenData.length > 0;
                
                return (
                  <li key={childItem.id} data-child-item-id={childItem.id} className="text-xs py-0.5 flex items-center justify-between group/childitem text-foreground hover:bg-muted/30 rounded-sm pr-1">
                    <div className="flex items-center flex-grow min-w-0 pl-1">
                      <div
                        data-dot-for-child-item={childItem.id} // Used by drawConnectionLines
                        className={cn(
                          "h-2.5 w-2.5 rounded-full mr-1.5 flex-shrink-0 border",
                          childItemHasGrandchildren ? "bg-green-500 border-green-600" : "border-green-500",
                          !childItemIsSpawnedAsCanvasNode && "opacity-50 border-dashed" // Visually indicate if not yet a canvas node
                        )}
                        title={childItemIsSpawnedAsCanvasNode ? (childItemHasGrandchildren ? "This child has further children" : "This child is a canvas node with no children") : "This child is not yet a canvas node"}
                      />
                      <span className="truncate cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); if (childItem.canvasNodeIdForThisItem) { const node = allCanvasNodes.find(n=>n.id === childItem.canvasNodeIdForThisItem); if(node) onEditStep(node); } else { /* TODO: Maybe open EditChildItemDialog here for text edit? */ } }}>
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
        {(!step.description || step.description.trim().length === 0) && step.childrenData.length === 0 && (
          <p className="italic text-muted-foreground text-center py-2 text-[11px]">No details or children.</p>
        )}
      </div>
      {/* Main N/E/S Connection Dots - not for hierarchy in this model, but kept for now */}
      {onMainDotInteractionStart && (
        <>
          <div onMouseDown={(e) => { e.stopPropagation(); onMainDotInteractionStart(step.id, 'N', e); }} onTouchStart={(e) => { e.stopPropagation(); onMainDotInteractionStart(step.id, 'N', e); }} style={{ top: DOT_OFFSET, left: `calc(50% - ${DOT_OFFSET*-1}px)` }} className="absolute h-3 w-3 rounded-full bg-primary hover:scale-125 transition-transform cursor-crosshair z-20"></div>
          <div onMouseDown={(e) => { e.stopPropagation(); onMainDotInteractionStart(step.id, 'E', e); }} onTouchStart={(e) => { e.stopPropagation(); onMainDotInteractionStart(step.id, 'E', e); }} style={{ right: DOT_OFFSET, top: `calc(50% - ${DOT_OFFSET*-1}px)` }} className="absolute h-3 w-3 rounded-full bg-primary hover:scale-125 transition-transform cursor-crosshair z-20"></div>
          <div onMouseDown={(e) => { e.stopPropagation(); onMainDotInteractionStart(step.id, 'S', e); }} onTouchStart={(e) => { e.stopPropagation(); onMainDotInteractionStart(step.id, 'S', e); }} style={{ bottom: DOT_OFFSET, left: `calc(50% - ${DOT_OFFSET*-1}px)` }} className="absolute h-3 w-3 rounded-full bg-primary hover:scale-125 transition-transform cursor-crosshair z-20"></div>
        </>
      )}
    </div>
  );
});
RoadmapStepCard.displayName = "RoadmapStepCard";

// Dialog for adding/editing ChildDataItem (text content, not canvas position)
interface EditChildItemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description?: string }) => void;
  isSubmitting: boolean;
  existingChildItem?: ChildDataItem | null; // Pass if editing
  parentCanvasNodeTitle: string; // Title of the canvas node this child item belongs to
}

const EditChildItemDialog: React.FC<EditChildItemDialogProps> = ({ isOpen, onOpenChange, onSubmit, isSubmitting, existingChildItem, parentCanvasNodeTitle }) => {
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
      // Basic validation, can enhance with react-hook-form if needed
      alert("Child item title cannot be empty.");
      return;
    }
    onSubmit({ title: title.trim(), description: description.trim() || undefined });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existingChildItem ? `Edit Child in "${parentCanvasNodeTitle}"` : `Add Child to "${parentCanvasNodeTitle}"`}</DialogTitle>
          <DialogDescription>Define the details for this child item.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="child-item-title">Title <span className="text-destructive">*</span></Label>
            <Input id="child-item-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Research Competitors" disabled={isSubmitting} />
          </div>
          <div>
            <Label htmlFor="child-item-description">Description (Optional)</Label>
            <Textarea id="child-item-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details about this child item..." rows={3} disabled={isSubmitting} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existingChildItem ? 'Save Changes' : 'Add Child Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};


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
  const [editableRoadmap, setEditableRoadmap] = useState<RoadmapStep[]>([]); // List of ALL canvas nodes

  const [editingStep, setEditingStep] = useState<RoadmapStep | null>(null); // The CANVAS NODE being edited in the Sheet
  const [isStepDetailSheetOpen, setIsStepDetailSheetOpen] = useState(false);
  const [isEditingNodeTitle, setIsEditingNodeTitle] = useState(false);
  const [isEditingNodeDescription, setIsEditingNodeDescription] = useState(false);

  const [nodeToDelete, setNodeToDelete] = useState<RoadmapStep | null>(null); // For confirming canvas node deletion

  const [isPointerDown, setIsPointerDown] = useState(false);
  const nodeDragInfoRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  // connectionDragInfoRef is removed as N/E/S dots are no longer primary for hierarchy
  const clickStartInfoRef = useRef<{ clientX: number; clientY: number; timestamp: number; targetElement: EventTarget | null } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  // activeConnectionLinePreview is removed

  const [isVersionHistorySheetOpen, setIsVersionHistorySheetOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<ClientPlanVersion | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  // State for managing EditChildItemDialog
  const [isEditChildItemDialogOpen, setIsEditChildItemDialogOpen] = useState(false);
  const [childItemToManage, setChildItemToManage] = useState<{ parentCanvasNodeId: string; childItemId?: string } | null>(null); // parentCanvasNodeId and optional childItemId for edit

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
      queryClient.invalidateQueries({queryKey: ['planVersions', planId]});
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
      setEditableRoadmap(planData.roadmap || []);
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
      setCanvasMinHeight(Math.max(window.innerHeight, lowestNodeBottomY + window.innerHeight * 0.5));
    }
  }, [editableRoadmap]);

  const canEditPlan = useMemo(() => !!user && (planData?.ownerId === user.uid), [user, planData]);

  const getPointerCoords = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } => {
    if ('touches' in event && event.touches.length > 0) return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    if ('changedTouches' in event && event.changedTouches.length > 0) return { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY };
    return { clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY };
  }, []);

  // Opens a CANVAS NODE in the side sheet for editing its title, description, and managing its childrenData list
  const handleEditCanvasNode = useCallback((stepToEdit: RoadmapStep) => {
    setEditingStep(stepToEdit);
    setIsStepDetailSheetOpen(true);
    setIsEditingNodeTitle(false);
    setIsEditingNodeDescription(false);
  }, []);
  
  // Called by the main "+ Add Root Node" button
  const handleAddRootCanvasNode = useCallback(() => {
    if (!canEditPlan || !canvasRef.current) return;
    const newId = `step-${Date.now()}-${uuidv4().substring(0, 8)}`;
    const newStepX = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2);
    const newStepY = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - NODE_BASE_MIN_HEIGHT / 2);

    const newNode: RoadmapStep = {
      id: newId,
      title: "New Root Node",
      description: null,
      x: newStepX,
      y: newStepY,
      childrenData: [], // Initialize with empty childrenData
    };
    setEditableRoadmap(prev => [...prev, newNode]);
    toast({ title: "Root Node Added", description: "Remember to save the plan." });
  }, [canEditPlan, toast]);

  // Spawns a ChildDataItem as a full RoadmapStep on the canvas if it isn't already.
  // Returns the ID of the (potentially newly created) canvas node.
  const handleSpawnChildDataItemAsCanvasNode = useCallback((childItemId: string, parentCanvasNodeId: string): string => {
    let canvasNodeIdForChildItem: string | null = null;
    let childItemWasSpawned = false;

    setEditableRoadmap(prevRoadmap => {
      const newRoadmap = prevRoadmap.map(canvasNode => {
        if (canvasNode.id === parentCanvasNodeId) {
          const updatedChildrenData = canvasNode.childrenData.map(cItem => {
            if (cItem.id === childItemId) {
              if (!cItem.canvasNodeIdForThisItem) {
                canvasNodeIdForChildItem = `spawned-${cItem.id}-${uuidv4().substring(0,4)}`;
                childItemWasSpawned = true;
                return { ...cItem, canvasNodeIdForThisItem: canvasNodeIdForChildItem };
              } else {
                canvasNodeIdForChildItem = cItem.canvasNodeIdForThisItem;
              }
            }
            return cItem;
          });
          return { ...canvasNode, childrenData: updatedChildrenData };
        }
        return canvasNode;
      });

      if (childItemWasSpawned && canvasNodeIdForChildItem) {
        const parentNode = newRoadmap.find(n => n.id === parentCanvasNodeId);
        const originalChildItem = parentNode?.childrenData.find(ci => ci.id === childItemId);
        if (parentNode && originalChildItem) {
          const newSpawnedNode: RoadmapStep = {
            id: canvasNodeIdForChildItem,
            title: originalChildItem.title,
            description: originalChildItem.description,
            x: Math.max(MIN_CANVAS_PADDING, parentNode.x + NODE_BASE_WIDTH + DEFAULT_SPACING_X), // Position to the right
            y: Math.max(MIN_CANVAS_PADDING, parentNode.y + (parentNode.childrenData.findIndex(ci => ci.id === childItemId) * (NODE_BASE_MIN_HEIGHT / 2))), // Stagger Y
            childrenData: [], // Starts with no children of its own
          };
          return [...newRoadmap, newSpawnedNode];
        }
      }
      return newRoadmap;
    });
    
    if (!canvasNodeIdForChildItem) {
      // This case should ideally not happen if logic is correct, means childItem wasn't found or already had ID
      const parentNode = editableRoadmap.find(n => n.id === parentCanvasNodeId);
      const childItem = parentNode?.childrenData.find(ci => ci.id === childItemId);
      canvasNodeIdForChildItem = childItem?.canvasNodeIdForThisItem || "";
    }
    return canvasNodeIdForChildItem!; // Assert it's non-null as it should be set
  }, [editableRoadmap]);

  // Called when "+" is clicked next to a ChildDataItem in a RoadmapStepCard's content
  const handleAddGrandchildToChildDataItem = useCallback((targetChildItemId: string, parentOfTargetCanvasNodeId: string) => {
    if (!canEditPlan) return;
    // 1. Ensure the targetChildItem (which will be parent of the new grandchild) is spawned as a canvas node
    const targetChildCanvasNodeId = handleSpawnChildDataItemAsCanvasNode(targetChildItemId, parentOfTargetCanvasNodeId);
    // 2. Set up for EditChildItemDialog to add a new ChildDataItem to this newly ensured canvas node
    setChildItemToManage({ parentCanvasNodeId: targetChildCanvasNodeId }); // The new grandchild's parent is the targetChildItem (now a canvas node)
    setIsEditChildItemDialogOpen(true);
  }, [canEditPlan, handleSpawnChildDataItemAsCanvasNode]);

  // Called by EditChildItemDialog to add/update a ChildDataItem in a CANVAS NODE's childrenData
  const handleChildItemDialogSubmit = useCallback((data: { title: string; description?: string }) => {
    if (!childItemToManage) return;
    const { parentCanvasNodeId, childItemId } = childItemToManage;

    setEditableRoadmap(prev => prev.map(canvasNode => {
      if (canvasNode.id === parentCanvasNodeId) {
        let updatedChildrenData;
        if (childItemId) { // Editing existing ChildDataItem
          updatedChildrenData = canvasNode.childrenData.map(item =>
            item.id === childItemId ? { ...item, title: data.title, description: data.description || null } : item
          );
        } else { // Adding new ChildDataItem
          const newChildDataItemId = `childitem-${Date.now()}-${uuidv4().substring(0, 8)}`;
          const newChildItem: ChildDataItem = {
            id: newChildDataItemId,
            title: data.title,
            description: data.description || null,
            parentCanvasNodeId: parentCanvasNodeId, // Link back to its canvas node parent
            canvasNodeIdForThisItem: null, // Not spawned by default
          };
          updatedChildrenData = [...canvasNode.childrenData, newChildItem];
        }
        return { ...canvasNode, childrenData: updatedChildrenData };
      }
      return canvasNode;
    }));
    setIsEditChildItemDialogOpen(false);
    setChildItemToManage(null);
    toast({ title: childItemId ? "Child Item Updated" : "Child Item Added", description: "Remember to save the plan." });
  }, [childItemToManage, toast]);

  // Opens EditChildItemDialog to edit an existing ChildDataItem's text
  const handleEditChildItemText = useCallback((childItem: ChildDataItem, parentCanvasNodeId: string) => {
    if(!canEditPlan) return;
    setChildItemToManage({ parentCanvasNodeId, childItemId: childItem.id });
    setIsEditChildItemDialogOpen(true);
  }, [canEditPlan]);
  
  // Deletes a ChildDataItem from a CANVAS NODE's childrenData list
  const handleDeleteChildItem = useCallback((childItemIdToDelete: string, parentCanvasNodeIdOfItem: string) => {
    if(!canEditPlan) return;
    setEditableRoadmap(prev => prev.map(cn => {
        if (cn.id === parentCanvasNodeIdOfItem) {
            return {
                ...cn,
                childrenData: cn.childrenData.filter(ci => ci.id !== childItemIdToDelete)
            };
        }
        return cn;
    }));
    toast({ title: "Child Item Removed", description: "Removed from list. Remember to save."});
  }, [canEditPlan, toast]);


  // Deletes a CANVAS NODE. If it has childrenData items that were spawned, those spawned canvas nodes also need cleanup.
  const confirmDeleteCanvasNode = useCallback(() => {
    if (!nodeToDelete || !canEditPlan) return;
    const idToDelete = nodeToDelete.id;

    // Collect IDs of canvas nodes that were spawned from this node's childrenData
    const spawnedChildCanvasNodeIds = nodeToDelete.childrenData
        .map(ci => ci.canvasNodeIdForThisItem)
        .filter((id): id is string => id !== null && id !== undefined);

    setEditableRoadmap(prev => {
        // Remove the main node and any canvas nodes that were spawned directly from its childrenData
        let remainingNodes = prev.filter(s => s.id !== idToDelete && !spawnedChildCanvasNodeIds.includes(s.id));
        
        // Go through remaining nodes and remove any references to the deleted node or its spawned children from *their* childrenData
        remainingNodes = remainingNodes.map(rn => ({
            ...rn,
            childrenData: rn.childrenData.filter(ci => ci.parentCanvasNodeId !== idToDelete && (ci.canvasNodeIdForThisItem ? !spawnedChildCanvasNodeIds.includes(ci.canvasNodeIdForThisItem) : true))
        }));
        return remainingNodes;
    });

    if (editingStep?.id === idToDelete) {
        setIsStepDetailSheetOpen(false);
        setEditingStep(null);
    }
    toast({ title: `Canvas Node "${nodeToDelete.title}" Deleted`, description: `Remember to save the plan.` });
    setNodeToDelete(null);
  }, [nodeToDelete, canEditPlan, toast, editingStep]);

  // Updates details (title, description) of a CANVAS NODE
  const handleCanvasNodeDetailUpdate = useCallback((updatedStep: RoadmapStep) => {
    if (!canEditPlan) return;
    setEditableRoadmap(prev => prev.map(s => s.id === updatedStep.id ? updatedStep : s));
    toast({ title: "Node Updated", description: `"${updatedStep.title}" details changed. Remember to save.`});
    setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);
  }, [canEditPlan, toast]);

  const saveRoadmapChanges = useCallback(async () => {
    if (!planData || !user || !planId || !canEditPlan) {
      toast({ variant: "destructive", title: "Error", description: "Cannot save." });
      return;
    }
    saveRoadmapMutation.mutate({ planId, currentUserId: user.uid, roadmapToSave: editableRoadmap });
  }, [planData, user, planId, canEditPlan, editableRoadmap, saveRoadmapMutation, toast]);

  const sharePlan = useCallback(async () => { /* ... (unchanged) */ }, [toast]);
  const handleRestoreVersion = (version: ClientPlanVersion) => { /* ... (unchanged) */ };
  const confirmRestore = () => { /* ... (unchanged) */ };


  // Dragging canvas nodes
  const handleNodeInteractionStart = useCallback((nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (('button' in event && (event as React.MouseEvent).button !== 0) || !canEditPlan || !canvasRef.current) return;
    const { clientX, clientY } = getPointerCoords(event);
    const nodeElement = event.currentTarget as HTMLDivElement;
    const nodeRect = nodeElement.getBoundingClientRect();
    const offsetX = clientX - nodeRect.left;
    const offsetY = clientY - nodeRect.top;
    nodeDragInfoRef.current = { nodeId, offsetX, offsetY };
    clickStartInfoRef.current = { clientX, clientY, timestamp: Date.now(), targetElement: event.currentTarget };
    isDraggingRef.current = false;
    setIsPointerDown(true);
  }, [canEditPlan, getPointerCoords]);

  const handleGlobalMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isPointerDown || !canvasRef.current || !nodeDragInfoRef.current) return;
    const { clientX, clientY } = getPointerCoords(event);
    if (clickStartInfoRef.current && !isDraggingRef.current) {
      const deltaX = clientX - clickStartInfoRef.current.clientX;
      const deltaY = clientY - clickStartInfoRef.current.clientY;
      if ((deltaX * deltaX + deltaY * deltaY) > CLICK_MOVE_THRESHOLD_PX_SQ) isDraggingRef.current = true;
    }
    if (isDraggingRef.current) {
      if (event.cancelable) event.preventDefault();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const currentX = clientX - canvasRect.left + canvasRef.current.scrollLeft;
      const currentY = clientY - canvasRect.top + canvasRef.current.scrollTop;
      const { nodeId, offsetX = 0, offsetY = 0 } = nodeDragInfoRef.current;
      let newX = Math.max(MIN_CANVAS_PADDING, currentX - offsetX);
      let newY = Math.max(MIN_CANVAS_PADDING, currentY - offsetY);
      setEditableRoadmap(prev => prev.map(step => step.id === nodeId ? { ...step, x: newX, y: newY } : step));
    }
  }, [isPointerDown, getPointerCoords]);

  const handleGlobalPointerUp = useCallback((event: MouseEvent | TouchEvent) => {
    if (nodeDragInfoRef.current && !isDraggingRef.current && clickStartInfoRef.current) {
        const finalCoords = getPointerCoords(event);
        const timeElapsed = Date.now() - clickStartInfoRef.current.timestamp;
        const deltaX = finalCoords.clientX - clickStartInfoRef.current.clientX;
        const deltaY = finalCoords.clientY - clickStartInfoRef.current.clientY;
        if ((deltaX * deltaX + deltaY * deltaY) < CLICK_MOVE_THRESHOLD_PX_SQ && timeElapsed < CLICK_TIME_THRESHOLD_MS) {
          const clickedStep = editableRoadmap.find(s => s.id === nodeDragInfoRef.current!.nodeId);
          if (clickedStep) handleEditCanvasNode(clickedStep);
        }
    }
    nodeDragInfoRef.current = null;
    clickStartInfoRef.current = null;
    isDraggingRef.current = false;
    setIsPointerDown(false);
  }, [getPointerCoords, editableRoadmap, handleEditCanvasNode]);
  
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
    if (!canvasRef.current) return [];
    const lines: JSX.Element[] = [];
    const canvasRectBase = canvasRef.current.getBoundingClientRect();

    editableRoadmap.forEach(parentStep => {
        parentStep.childrenData.forEach(childItem => {
            if (childItem.canvasNodeIdForThisItem) {
                const childCanvasNode = editableRoadmap.find(n => n.id === childItem.canvasNodeIdForThisItem);
                if (!childCanvasNode) return;

                const parentCardElement = canvasRef.current!.querySelector(`[data-node-id="${parentStep.id}"]`) as HTMLElement;
                const childItemDotElement = parentCardElement?.querySelector(`[data-dot-for-child-item="${childItem.id}"]`) as HTMLElement;

                if (parentCardElement && childItemDotElement) {
                    const parentCardRect = parentCardElement.getBoundingClientRect(); // Relative to viewport
                    const dotRect = childItemDotElement.getBoundingClientRect();     // Relative to viewport
                    
                    const startX = dotRect.left + dotRect.width / 2 - canvasRectBase.left + canvasRef.current!.scrollLeft;
                    const startY = dotRect.top + dotRect.height / 2 - canvasRectBase.top + canvasRef.current!.scrollTop;
                    
                    const endX = childCanvasNode.x + NODE_BASE_WIDTH / 2; // N-dot X of child canvas node
                    const endY = childCanvasNode.y;                     // N-dot Y of child canvas node
                    
                    const pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
                    lines.push(
                      <path key={`conn-${parentStep.id}-${childItem.id}-to-${childCanvasNode.id}`} d={pathData} stroke={'hsl(var(--primary))'} strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY} fill="none" markerEnd={'url(#arrowhead-main)'} style={{pointerEvents: "none"}} />
                    );
                }
            }
        });
    });
    return lines;
  };
  
  // Conditional Rendering and UI structure
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
            {canEditPlan && (<Button variant="outline" size="sm" className="h-8" onClick={handleAddRootCanvasNode} disabled={saveRoadmapMutation.isPending}><Plus className="h-4 w-4 mr-1.5 sm:mr-2" /><span className="hidden sm:inline">Add Root Node</span><span className="sm:hidden">+Node</span></Button>)}
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
          </svg>
          {editableRoadmap.length === 0 && !isLoadingPlan && (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none">
              <Map className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">{canEditPlan ? "Click '+ Root Node' to start." : "Plan is empty."}</p>
            </div>
          )}
          {editableRoadmap.map(step => (
            <RoadmapStepCard key={step.id} step={step} allCanvasNodes={editableRoadmap} onNodeInteractionStart={handleNodeInteractionStart} isSelected={editingStep?.id === step.id} isSubmitting={saveRoadmapMutation.isPending} onEditStep={handleEditCanvasNode} onAddGrandchildToChildDataItem={handleAddGrandchildToChildDataItem} isActuallyDraggingThisNode={isDraggingRef.current && nodeDragInfoRef.current?.nodeId === step.id} />
          ))}
        </main>
      </div>

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
                        <Label className="flex items-center"><ListTree className="mr-1.5 h-4 w-4 text-primary/80"/>Child Items (Listed in this card)</Label>
                        {editingStep.childrenData.length > 0 ? (
                            <ul className="space-y-1.5 border p-2 rounded-md max-h-48 overflow-y-auto">
                                {editingStep.childrenData.map(childItem => (
                                    <li key={childItem.id} className="flex items-center justify-between gap-2 text-sm p-1 hover:bg-muted/30 rounded">
                                        <span className="truncate" title={childItem.title}>{childItem.title}</span>
                                        <div className="flex-shrink-0 space-x-1">
                                            {canEditPlan && <Button variant="ghost" size="icon" className="h-6 w-6 p-1" onClick={() => handleEditChildItemText(childItem, editingStep.id)} title={`Edit child item: ${childItem.title}`} disabled={saveRoadmapMutation.isPending}><Edit2 className="h-3.5 w-3.5" /></Button>}
                                            {canEditPlan && <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-destructive hover:text-destructive" onClick={() => handleDeleteChildItem(childItem.id, editingStep.id)} title={`Delete child item: ${childItem.title}`} disabled={saveRoadmapMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (<p className="text-xs text-muted-foreground italic">No child items listed yet.</p>)}
                        {canEditPlan && (
                            <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={() => { setChildItemToManage({ parentCanvasNodeId: editingStep.id }); setIsEditChildItemDialogOpen(true); }} disabled={saveRoadmapMutation.isPending}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Child Item to This Node
                            </Button>
                        )}
                    </div>
                </div>
              </ScrollArea>
              <SheetFooter className="p-4 mt-auto border-t pt-4 space-y-2 sm:space-y-0 sm:flex sm:justify-between">
                <div>{canEditPlan && editingStep && (<Button type="button" variant="destructive" onClick={() => setNodeToDelete(editingStep)} disabled={saveRoadmapMutation.isPending} className="w-full sm:w-auto"><Trash2 className="mr-2 h-4 w-4" /> Delete Canvas Node</Button>)}</div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                  <SheetClose asChild><Button type="button" variant="outline" onClick={() => setEditingStep(null)} disabled={saveRoadmapMutation.isPending}>Close Panel</Button></SheetClose>
                  {canEditPlan && editingStep && (isEditingNodeTitle || isEditingNodeDescription) && (<Button type="button" onClick={() => handleCanvasNodeDetailUpdate(editingStep)} disabled={saveRoadmapMutation.isPending}>{saveRoadmapMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Node Changes</Button>)}
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!nodeToDelete} onOpenChange={(open) => !open && setNodeToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete Canvas Node: "{nodeToDelete?.title}"?</AlertDialogTitle><AlertDialogDescription>This will remove the node from the canvas and any canvas nodes spawned from its child items. This action cannot be undone from here, but you can restore a previous plan version.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel onClick={() => setNodeToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteCanvasNode} className="bg-destructive hover:bg-destructive/90" disabled={!canEditPlan || saveRoadmapMutation.isPending}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {childItemToManage && (
          <EditChildItemDialog
            isOpen={isEditChildItemDialogOpen}
            onOpenChange={setIsEditChildItemDialogOpen}
            onSubmit={handleChildItemDialogSubmit}
            isSubmitting={saveRoadmapMutation.isPending}
            existingChildItem={childItemToManage.childItemId ? editableRoadmap.find(n => n.id === childItemToManage.parentCanvasNodeId)?.childrenData.find(ci => ci.id === childItemToManage.childItemId) : null}
            parentCanvasNodeTitle={editableRoadmap.find(n => n.id === childItemToManage.parentCanvasNodeId)?.title || "Node"}
          />
      )}

      <Sheet open={isVersionHistorySheetOpen} onOpenChange={setIsVersionHistorySheetOpen}>
        <SheetContent className="sm:max-w-lg w-[90vw]" side="left"><SheetHeader className="border-b pb-4"><SheetTitle>Plan Version History (v{planData?.version || 1})</SheetTitle><SheetDescription>Review past versions of this plan. You can restore to a previous version.</SheetDescription></SheetHeader>
          <ScrollArea className="h-[calc(100%-100px)]"><div className="p-4 space-y-3">
              {isLoadingVersions && (<div className="flex justify-center items-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary"/><p className="ml-2 text-muted-foreground">Loading versions...</p></div>)}
              {!isLoadingVersions && planVersions.length === 0 && (<p className="text-sm text-muted-foreground text-center py-4">No version history.</p>)}
              {!isLoadingVersions && planVersions.map(version => (<div key={version.id} className={cn("p-3 border rounded-md bg-muted/30 hover:bg-muted/40 transition-colors flex justify-between items-center", version.versionNumber === planData?.version && "border-primary ring-1 ring-primary")}><p className="text-sm font-medium">Version {version.versionNumber || "(Legacy)"} {version.versionNumber === planData?.version && <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>}</p><p className="text-xs text-muted-foreground">Saved by: <span className="font-semibold text-foreground">{version.editorDisplayName || getInitials(version.editorUid) || version.editorUid}</span> on {format(new Date(version.timestamp), "MMM d, yyyy, h:mm a")}</p><Button variant="outline" size="xs" className="h-7 px-2 text-xs" onClick={() => handleRestoreVersion(version)} disabled={version.versionNumber === planData?.version || restorePlanMutation.isPending}><History className="h-3.5 w-3.5 mr-1.5" /> Restore</Button></div>))}
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
