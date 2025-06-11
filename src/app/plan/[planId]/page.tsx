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
import type { ClientPlan, RoadmapStep, ChildDataItem, UpdatePlanData, ClientPlanVersion, PeerConnection } from '@/types/plan';
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
import RoadmapStepCardComponent from '@/components/plan/RoadmapStepCard';


const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const NODE_BASE_MIN_HEIGHT = 80;
const NODE_HEADER_HEIGHT = 40;
const CHILD_ITEM_HEIGHT = 28;
const FINAL_BUFFER_CARD_HEIGHT = 8;

const CONNECTION_LINE_THICKNESS_HIERARCHY = 1.5;
const CONNECTION_LINE_THICKNESS_PEER = 1.5;
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
    childrenDataListHeight += 8;
    childrenDataListHeight += step.childrenData.length * CHILD_ITEM_HEIGHT;
    childrenDataListHeight += 8;
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
  dialogTitle: string; 
  defaultTitle?: string;
  defaultDescription?: string;
}

const EditChildItemDialog: React.FC<EditChildItemDialogProps> = ({ isOpen, onOpenChange, onSubmit, isSubmitting, dialogTitle, defaultTitle = "", defaultDescription = "" }) => {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);

  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle);
      setDescription(defaultDescription);
    }
  }, [isOpen, defaultTitle, defaultDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }
    onSubmit({ title: title.trim(), description: description.trim() || undefined });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
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
              Save Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

type ChildItemOperationContext = 
    | { operation: 'createGrandchild'; targetChildToBecomeParentId: string; currentParentOfTargetChildId: string; }
    | { operation: 'createChild'; targetParentNodeId: string; }
    | { operation: 'edit'; itemToEditId: string; parentNodeId: string; };

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

  const childItemManagementContextRef = useRef<ChildItemOperationContext | null>(null);
  
  const [isEditChildItemDialogOpen, setIsEditChildItemDialogOpen] = useState(false);
  const [dynamicChildDialogTitle, setDynamicChildDialogTitle] = useState("Manage Item");
  const [defaultChildDialogTitle, setDefaultChildDialogTitle] = useState("");
  const [defaultChildDialogDescription, setDefaultChildDialogDescription] = useState("");

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
          peerConnections: Array.isArray(s.peerConnections) ? s.peerConnections : [],
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
  }, [editableRoadmap, editingStep]);


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

  const handleInitiateAddNode = useCallback((sourceNodeId: string | null, initiatingDot?: 'N' | 'E' | 'S') => {
    if (!canEditPlan) return;
    setTargetParentIdForDialog(sourceNodeId);
    setInitiatingDotTypeForDialog(initiatingDot || null);
    setIsAddNodeDialogOpen(true);
  }, [canEditPlan]);

  const handleAddNode = useCallback((data: AddRoadmapStepFormData) => {
    if (!canEditPlan || !canvasRef.current) return;
    
    const newId = `step-${Date.now()}-${uuidv4().substring(0, 8)}`;
    let newStepX, newStepY;

    const sourceNodeForPeerLink = targetParentIdForDialog ? editableRoadmap.find(s => s.id === targetParentIdForDialog) : null;

    if (sourceNodeForPeerLink && initiatingDotTypeForDialog) {
        const sourceHeight = calculateNodeHeight(sourceNodeForPeerLink, editableRoadmap);
        switch (initiatingDotTypeForDialog) {
            case 'N': newStepX = sourceNodeForPeerLink.x; newStepY = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.y - NODE_BASE_MIN_HEIGHT - DEFAULT_SPACING_Y); break;
            case 'E': newStepX = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.x + NODE_BASE_WIDTH + DEFAULT_SPACING_X); newStepY = sourceNodeForPeerLink.y; break;
            case 'S': newStepX = sourceNodeForPeerLink.x; newStepY = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.y + sourceHeight + DEFAULT_SPACING_Y); break;
            default: 
                newStepX = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2);
                newStepY = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - NODE_BASE_MIN_HEIGHT / 2);
                break;
        }
    } else { 
        newStepX = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollLeft + canvasRef.current.clientWidth / 2 - NODE_BASE_WIDTH / 2);
        newStepY = Math.max(MIN_CANVAS_PADDING, canvasRef.current.scrollTop + canvasRef.current.clientHeight / 2 - NODE_BASE_MIN_HEIGHT / 2);
    }
    
    const newNode: RoadmapStep = {
      id: newId, title: data.title, x: newStepX, y: newStepY, description: null, childrenData: [], peerConnections: [],
    };

    setEditableRoadmap(prev => {
        let newMap = [...prev, newNode];
        if (sourceNodeForPeerLink && initiatingDotTypeForDialog) {
            const sourceNodeIndex = newMap.findIndex(s => s.id === sourceNodeForPeerLink.id);
            if (sourceNodeIndex > -1) {
                const updatedSourceNode = { ...newMap[sourceNodeIndex] };
                let targetDotOnNewNode: PeerConnection['targetDot'] = 'W'; 
                if (initiatingDotTypeForDialog === 'N') targetDotOnNewNode = 'S';
                else if (initiatingDotTypeForDialog === 'S') targetDotOnNewNode = 'N';

                const newPeerConnection: PeerConnection = { targetNodeId: newNode.id, sourceDot: initiatingDotTypeForDialog, targetDot: targetDotOnNewNode };
                updatedSourceNode.peerConnections = [...(updatedSourceNode.peerConnections || []), newPeerConnection];
                newMap[sourceNodeIndex] = updatedSourceNode;
                toast({ title: `Node "${newNode.title}" created and linked from "${updatedSourceNode.title}".` });
            }
        } else {
            toast({ title: `Node "${newNode.title}" Added` });
        }
        return newMap;
    });
    setIsAddNodeDialogOpen(false); // Close dialog after adding
    setTargetParentIdForDialog(null);
    setInitiatingDotTypeForDialog(null);
  }, [canEditPlan, toast, editableRoadmap, targetParentIdForDialog, initiatingDotTypeForDialog]);
  
  const handleSpawnChildDataItemAsCanvasNode = useCallback((
    currentRoadmap: RoadmapStep[],
    childItemId: string,
    parentCanvasNodeIdOfChildItem: string
  ): { updatedRoadmap: RoadmapStep[]; spawnedNodeId: string | null } => {
    let newRoadmap = [...currentRoadmap];
    const parentNodeIndex = newRoadmap.findIndex(s => s.id === parentCanvasNodeIdOfChildItem);
    if (parentNodeIndex === -1) {
      toast({ variant: "destructive", title: "Error", description: "Parent node not found for spawning child." });
      return { updatedRoadmap: currentRoadmap, spawnedNodeId: null };
    }
    const parentNode = newRoadmap[parentNodeIndex];
    const childItemIndex = (parentNode.childrenData || []).findIndex(ci => ci.id === childItemId);
    if (childItemIndex === -1) {
      toast({ variant: "destructive", title: "Error", description: "Child item to spawn not found in parent." });
      return { updatedRoadmap: currentRoadmap, spawnedNodeId: null };
    }
    const childItem = parentNode.childrenData[childItemIndex];

    if (childItem.canvasNodeIdForThisItem && newRoadmap.some(n => n.id === childItem.canvasNodeIdForThisItem)) {
      return { updatedRoadmap: currentRoadmap, spawnedNodeId: childItem.canvasNodeIdForThisItem };
    }

    const newSpawnedNodeId = `canvasnode-${childItem.id}-${uuidv4().substring(0, 4)}`;
    const newSpawnedNode: RoadmapStep = {
      id: newSpawnedNodeId,
      title: childItem.title, // Populate from child item
      description: childItem.description, // Populate from child item
      x: Math.max(MIN_CANVAS_PADDING, parentNode.x - NODE_BASE_WIDTH - DEFAULT_SPACING_X),
      y: Math.max(MIN_CANVAS_PADDING, parentNode.y + (childItemIndex * (CHILD_ITEM_HEIGHT * 1.5))),
      childrenData: [],
      peerConnections: [],
    };

    const updatedChildrenDataForOriginalParent = parentNode.childrenData.map(ci =>
      ci.id === childItemId ? { ...ci, canvasNodeIdForThisItem: newSpawnedNodeId } : ci
    );
    newRoadmap[parentNodeIndex] = { ...parentNode, childrenData: updatedChildrenDataForOriginalParent };
    newRoadmap = [...newRoadmap, newSpawnedNode];
    
    return { updatedRoadmap: newRoadmap, spawnedNodeId: newSpawnedNodeId };
  }, [toast]);


  const onAddGrandchildToChildDataItem = useCallback((clickedChildItemId: string, parentCanvasNodeIdOfClickedItem: string) => {
    if (!canEditPlan) return;
    const parentNode = editableRoadmap.find(n => n.id === parentCanvasNodeIdOfClickedItem);
    const childItemWhoseDotWasClicked = parentNode?.childrenData.find(ci => ci.id === clickedChildItemId);
    if (!childItemWhoseDotWasClicked) {
        toast({ variant: "destructive", title: "Error", description: "Originating child item not found." });
        return;
    }
    
    childItemManagementContextRef.current = {
        operation: 'createGrandchild',
        targetChildToBecomeParentId: clickedChildItemId,
        currentParentOfTargetChildId: parentCanvasNodeIdOfClickedItem
    };
    setDynamicChildDialogTitle(`Add Item to "${childItemWhoseDotWasClicked.title}"`);
    setDefaultChildDialogTitle("");
    setDefaultChildDialogDescription("");
    setIsEditChildItemDialogOpen(true);
  }, [canEditPlan, editableRoadmap, toast]);

  const handleChildItemDialogSubmit = useCallback((data: { title: string; description?: string }) => {
    if (!childItemManagementContextRef.current || !canEditPlan) return;
    const context = childItemManagementContextRef.current;
    let operationSucceeded = false;

    setEditableRoadmap(prevRoadmap => {
      let tempRoadmap = [...prevRoadmap]; 
      let spawnedNodeIdForContext: string | null = null;
      
      if (context.operation === 'createGrandchild') {
        const { targetChildToBecomeParentId, currentParentOfTargetChildId } = context;
        if (!targetChildToBecomeParentId || !currentParentOfTargetChildId) {
          toast({ variant: "destructive", title: "Error", description: "Context for creating grandchild is missing." });
          return prevRoadmap;
        }

        const spawnResult = handleSpawnChildDataItemAsCanvasNode(tempRoadmap, targetChildToBecomeParentId, currentParentOfTargetChildId);
        tempRoadmap = spawnResult.updatedRoadmap; 
        spawnedNodeIdForContext = spawnResult.spawnedNodeId; // This is CanvasNodeA's ID

        if (!spawnedNodeIdForContext) {
          toast({ variant: "destructive", title: "Error", description: "Failed to ensure parent canvas node for new item." });
          return prevRoadmap;
        }
        
        const parentCanvasNodeForGrandchildIndex = tempRoadmap.findIndex(node => node.id === spawnedNodeIdForContext);
        if (parentCanvasNodeForGrandchildIndex > -1) {
          const newGrandchildItem: ChildDataItem = { // This is GrandchildB
            id: `childitem-${Date.now()}-${uuidv4().substring(0, 8)}`,
            title: data.title, description: data.description || null,
            parentCanvasNodeId: spawnedNodeIdForContext, // Parent is CanvasNodeA
            canvasNodeIdForThisItem: null, // GrandchildB does not get a canvas node automatically
          };
          const updatedParentNode = { ...tempRoadmap[parentCanvasNodeForGrandchildIndex] }; // This is CanvasNodeA
          updatedParentNode.childrenData = [...(updatedParentNode.childrenData || []), newGrandchildItem];
          tempRoadmap[parentCanvasNodeForGrandchildIndex] = updatedParentNode;
          toast({ title: "Item Added", description: `"${data.title}" added to "${updatedParentNode.title}". Remember to save.` });
          operationSucceeded = true;
        } else {
          toast({ variant: "destructive", title: "Error", description: `Could not find spawned canvas node (ID: ${spawnedNodeIdForContext}) to add item to.` });
        }

      } else if (context.operation === 'createChild') {
        const { targetParentNodeId } = context; // This is an existing Canvas Node ID
        if (!targetParentNodeId) {
             toast({ variant: "destructive", title: "Error", description: "Target parent node for new child is missing."});
             return prevRoadmap;
        }
        const parentNodeIndex = tempRoadmap.findIndex(node => node.id === targetParentNodeId);
        if (parentNodeIndex > -1) {
          const newChildItem: ChildDataItem = {
            id: `childitem-${Date.now()}-${uuidv4().substring(0, 8)}`,
            title: data.title, description: data.description || null,
            parentCanvasNodeId: targetParentNodeId, // Belongs to this existing canvas node
            canvasNodeIdForThisItem: null, // Does not get a canvas node automatically
          };
          const updatedParentNode = { ...tempRoadmap[parentNodeIndex] };
          updatedParentNode.childrenData = [...(updatedParentNode.childrenData || []), newChildItem];
          tempRoadmap[parentNodeIndex] = updatedParentNode;
          toast({ title: "Item Added to List", description: `"${data.title}" added. Remember to save.` });
          operationSucceeded = true;
        } else {
            toast({ variant: "destructive", title: "Error", description: `Parent node ${targetParentNodeId} not found for adding child.`});
        }
      } else if (context.operation === 'edit') {
        const { itemToEditId, parentNodeId } = context;
        if (!itemToEditId || !parentNodeId) {
            toast({ variant: "destructive", title: "Error", description: "Context for editing item is missing."});
            return prevRoadmap;
        }
        const parentNodeIndex = tempRoadmap.findIndex(node => node.id === parentNodeId);
        if (parentNodeIndex > -1) {
          let itemThatWasEdited: ChildDataItem | undefined;
          const updatedChildren = tempRoadmap[parentNodeIndex].childrenData.map(item => {
            if (item.id === itemToEditId) {
              itemThatWasEdited = { ...item, title: data.title, description: data.description || null };
              return itemThatWasEdited;
            }
            return item;
          });
          tempRoadmap[parentNodeIndex] = { ...tempRoadmap[parentNodeIndex], childrenData: updatedChildren };

          if (itemThatWasEdited && itemThatWasEdited.canvasNodeIdForThisItem) { 
            const canvasNodeIndex = tempRoadmap.findIndex(node => node.id === itemThatWasEdited!.canvasNodeIdForThisItem);
            if (canvasNodeIndex > -1) {
              tempRoadmap[canvasNodeIndex] = { ...tempRoadmap[canvasNodeIndex], title: data.title, description: data.description || null };
            }
          }
          toast({ title: "Item Updated", description: "Remember to save." });
          operationSucceeded = true;
        } else {
            toast({ variant: "destructive", title: "Error", description: `Parent node ${parentNodeId} not found for editing child.`});
        }
      }
      return tempRoadmap; 
    });
    
    if (operationSucceeded) {
        setIsEditChildItemDialogOpen(false);
    }
    childItemManagementContextRef.current = null;
  }, [canEditPlan, toast, handleSpawnChildDataItemAsCanvasNode]);

  const handleEditChildItemText = useCallback((childItem: ChildDataItem, parentCanvasNodeIdOfChildItem: string) => {
    if(!canEditPlan) return;
    childItemManagementContextRef.current = {
        operation: 'edit',
        itemToEditId: childItem.id,
        parentNodeId: parentCanvasNodeIdOfChildItem
    };
    setDynamicChildDialogTitle(`Edit Item: "${childItem.title}"`);
    setDefaultChildDialogTitle(childItem.title);
    setDefaultChildDialogDescription(childItem.description || "");
    setIsEditChildItemDialogOpen(true);
  }, [canEditPlan]);
  
  const handleUnspawnNodeIfChildless = useCallback((nodeIdToCheck: string) => {
    setEditableRoadmap(prev => {
        let newRoadmap = [...prev];
        const nodeToPotentiallyUnspawn = newRoadmap.find(n => n.id === nodeIdToCheck);
        
        if (!nodeToPotentiallyUnspawn || (nodeToPotentiallyUnspawn.childrenData && nodeToPotentiallyUnspawn.childrenData.length > 0)) {
            return prev; 
        }
        
        let wasLinkedFromParentList = false;
        for (let i = 0; i < newRoadmap.length; i++) {
            if (newRoadmap[i].id === nodeIdToCheck) continue; 

            if (newRoadmap[i].childrenData) {
                const childLinkIndex = newRoadmap[i].childrenData.findIndex(ci => ci.canvasNodeIdForThisItem === nodeIdToCheck);
                if (childLinkIndex > -1) {
                    const updatedParentNode = { ...newRoadmap[i] };
                    const updatedChildItemLink = { ...updatedParentNode.childrenData[childLinkIndex], canvasNodeIdForThisItem: null }; 
                    updatedParentNode.childrenData = [
                        ...updatedParentNode.childrenData.slice(0, childLinkIndex),
                        updatedChildItemLink,
                        ...updatedParentNode.childrenData.slice(childLinkIndex + 1)
                    ];
                    newRoadmap[i] = updatedParentNode;
                    wasLinkedFromParentList = true;
                    break; 
                }
            }
        }
        if (wasLinkedFromParentList) {
            const unspawnedNodeTitle = nodeToPotentiallyUnspawn.title;
            newRoadmap = newRoadmap.filter(n => n.id !== nodeIdToCheck); 
            newRoadmap = newRoadmap.map(rn => ({
              ...rn,
              peerConnections: (rn.peerConnections || []).filter(pc => pc.targetNodeId !== nodeIdToCheck)
            }));
            toast({ title: `Node "${unspawnedNodeTitle}" Unspawned`, description: "Became childless and was removed from canvas." });
            return newRoadmap;
        }
        return prev; 
    });
  }, [toast]);

  const handleDeleteChildItem = useCallback((childItemIdToDelete: string, parentCanvasNodeIdOfItem: string) => {
    if (!canEditPlan) return;
    
    setEditableRoadmap(prev => {
        let canvasNodeIdThatWasRepresentedByDeletedItem: string | null = null;
        let updatedRoadmap = prev.map(parentNode => {
            if (parentNode.id === parentCanvasNodeIdOfItem) {
                const childItemToRemove = (parentNode.childrenData || []).find(ci => ci.id === childItemIdToDelete);
                canvasNodeIdThatWasRepresentedByDeletedItem = childItemToRemove?.canvasNodeIdForThisItem || null;
                
                const updatedChildrenData = (parentNode.childrenData || []).filter(ci => ci.id !== childItemIdToDelete);
                return { ...parentNode, childrenData: updatedChildrenData };
            }
            return parentNode;
        });
        
        if (canvasNodeIdThatWasRepresentedByDeletedItem) {
            const deletedNodeTitle = updatedRoadmap.find(n => n.id === canvasNodeIdThatWasRepresentedByDeletedItem)?.title || "Item";
            updatedRoadmap = updatedRoadmap.filter(node => node.id !== canvasNodeIdThatWasRepresentedByDeletedItem);
            updatedRoadmap = updatedRoadmap.map(rn => ({
              ...rn,
              peerConnections: (rn.peerConnections || []).filter(pc => pc.targetNodeId !== canvasNodeIdThatWasRepresentedByDeletedItem)
            }));
            toast({ title: `"${deletedNodeTitle}" Removed`, description: "Item and its canvas node removed. Remember to save."});
        } else {
            const parentNodeTitle = prev.find(n => n.id === parentCanvasNodeIdOfItem)?.title || "Parent Node";
            const deletedItemTitle = prev.find(n => n.id === parentCanvasNodeIdOfItem)?.childrenData?.find(ci => ci.id === childItemIdToDelete)?.title || "Item";
            toast({ title: `"${deletedItemTitle}" Removed`, description: `Removed from list in "${parentNodeTitle}". Remember to save.`});
        }
        
        // Call unspawning logic for the parent node whose child list was just modified
        setTimeout(() => handleUnspawnNodeIfChildless(parentCanvasNodeIdOfItem), 0);
        
        return updatedRoadmap;
    });
  }, [canEditPlan, toast, handleUnspawnNodeIfChildless]);


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
            peerConnections: (rn.peerConnections || []).filter(pc => pc.targetNodeId !== idToDelete)
        }));
        return remainingNodes;
    });

    if (editingStep?.id === idToDelete) {
        setIsStepDetailSheetOpen(false);
        setEditingStep(null);
    }
    toast({ title: `Node "${nodeToDelete.title}" Deleted from Canvas`, description: `Remember to save.` });
    setNodeToDelete(null);
  }, [nodeToDelete, canEditPlan, toast, editingStep?.id]);

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
    if (!isPointerDown || !nodeDragInfoRef.current) {
        setIsPointerDown(false);
        return;
    }

    const { nodeId: sourceNodeId, dotType: sourceDotType, isDotDrag } = nodeDragInfoRef.current;
    const clickInfo = clickStartInfoRef.current;
    const isConsideredDrag = isDraggingRef.current;

    if (isDotDrag && sourceDotType) { // Interaction started on a blue N/E/S dot
        if (activeConnectionLinePreviewRef.current?.path) { // Blue dot was dragged (line preview exists)
            const targetNodeIdUnderCursor = activeConnectionLinePreviewRef.current.targetNodeId;
            const dropTargetNode = targetNodeIdUnderCursor ? editableRoadmap.find(s => s.id === targetNodeIdUnderCursor) : undefined;

            if (dropTargetNode) { // Dropped on an existing node
                if (dropTargetNode.id === sourceNodeId) {
                    toast({ variant: "destructive", title: "Invalid Connection", description: "Cannot connect a node to itself." });
                } else {
                    setEditableRoadmap(prev => {
                        const map = [...prev];
                        const sourceNodeIndex = map.findIndex(s => s.id === sourceNodeId);
                        if (sourceNodeIndex === -1) return prev;

                        const updatedSourceNode = { ...map[sourceNodeIndex] };
                        updatedSourceNode.peerConnections = updatedSourceNode.peerConnections || [];
                        let targetDotOnDropTarget: PeerConnection['targetDot'] = 'W'; 
                        if (sourceDotType === 'N') targetDotOnDropTarget = 'S';
                        else if (sourceDotType === 'S') targetDotOnDropTarget = 'N';
                        else if (sourceDotType === 'E') targetDotOnDropTarget = 'W'; 

                        const alreadyConnected = updatedSourceNode.peerConnections.some(
                            pc => pc.targetNodeId === dropTargetNode.id && pc.sourceDot === sourceDotType && pc.targetDot === targetDotOnDropTarget
                        );

                        if (!alreadyConnected) {
                            const newPeerConnection: PeerConnection = { targetNodeId: dropTargetNode.id, sourceDot: sourceDotType, targetDot: targetDotOnDropTarget };
                            updatedSourceNode.peerConnections.push(newPeerConnection);
                            map[sourceNodeIndex] = updatedSourceNode;
                            toast({ title: "Nodes Linked", description: `"${updatedSourceNode.title}" is now linked to "${dropTargetNode.title}".` });
                        } else {
                            toast({ title: "Already Linked", description: "These nodes are already connected in this way." });
                        }
                        return map;
                    });
                }
            } else { // Dropped on empty space (or target not found)
                 handleInitiateAddNode(sourceNodeId, sourceDotType);
            }
        } else if (!isConsideredDrag && clickInfo) { // Blue dot was CLICKED (not dragged significantly)
             handleInitiateAddNode(sourceNodeId, sourceDotType);
        }
    } else { // Interaction started on the main node body (isDotDrag is false)
        if (!isConsideredDrag && clickInfo) { // It was a click on the node body
            const finalCoords = getPointerCoords(event);
            const timeElapsed = Date.now() - clickInfo.timestamp;
            const deltaX = finalCoords.clientX - clickInfo.clientX;
            const deltaY = finalCoords.clientY - clickInfo.clientY;

            if ((deltaX * deltaX + deltaY * deltaY) < CLICK_MOVE_THRESHOLD_PX_SQ && timeElapsed < CLICK_TIME_THRESHOLD_MS) {
                // Check if the click target was specifically the node body, not a child item or green dot
                 if (clickInfo.targetElement && (clickInfo.targetElement as HTMLElement).closest('[data-node-id]') &&
                    !(clickInfo.targetElement as HTMLElement).closest('[data-child-item-dot-id]') &&
                    !(clickInfo.targetElement as HTMLElement).closest('[data-child-item-title-button]')) { // Add check for child item title
                    const clickedStep = editableRoadmap.find(s => s.id === sourceNodeId);
                    if (clickedStep) {
                        handleEditCanvasNode(clickedStep); // Open panel for node body click
                    }
                }
            }
        }
    }

    activeConnectionLinePreviewRef.current = null;
    nodeDragInfoRef.current = null;
    clickStartInfoRef.current = null;
    isDraggingRef.current = false;
    setIsPointerDown(false);
    if (svgRef.current) svgRef.current.style.display = 'block'; // Re-enable for static lines
  }, [isPointerDown, getPointerCoords, editableRoadmap, handleEditCanvasNode, toast, handleInitiateAddNode]);

  const handleChildItemCanvasNodeFocus = useCallback((childItemId: string, parentCanvasNodeId: string) => {
    if (!canEditPlan && !planData?.roadmap.find(r => r.id === childItemId || r.childrenData.find(ci => ci.id === childItemId))) return; // Allow read-only focus

    setEditableRoadmap(prevRoadmap => {
        const spawnResult = handleSpawnChildDataItemAsCanvasNode(prevRoadmap, childItemId, parentCanvasNodeId);
        const { updatedRoadmap: roadmapAfterSpawning, spawnedNodeId } = spawnResult;

        if (spawnedNodeId) {
            const nodeToEdit = roadmapAfterSpawning.find(s => s.id === spawnedNodeId);
            if (nodeToEdit) {
                setTimeout(() => { // Defer state update to avoid issues with ongoing rendering
                    setEditingStep(nodeToEdit);
                    setIsStepDetailSheetOpen(true);
                }, 0);
            }
        }
        return roadmapAfterSpawning; // Return the (potentially) updated roadmap
    });
  }, [canEditPlan, planData, toast, handleSpawnChildDataItemAsCanvasNode]);


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

  const drawConnectionLines = useCallback(() => {
    if (!canvasRef.current || !editableRoadmap || editableRoadmap.length === 0) return [];
    const lines: JSX.Element[] = [];
    const canvasRectBase = canvasRef.current.getBoundingClientRect();

    editableRoadmap.forEach(parentStep => {
      if (!parentStep || !parentStep.id) return; 

      if (Array.isArray(parentStep.childrenData)) {
        parentStep.childrenData.forEach((childItem) => {
          if (!childItem || !childItem.id) return; 

          if (childItem.canvasNodeIdForThisItem) {
            const childCanvasNode = editableRoadmap.find(n => n && n.id === childItem.canvasNodeIdForThisItem);
            if (!childCanvasNode) return; 
            const greenDotElement = canvasRef.current?.querySelector(`[data-node-id="${parentStep.id}"] [data-child-item-dot-id="${childItem.id}"]`);
            
            if (greenDotElement && canvasRef.current) {
              const dotRect = greenDotElement.getBoundingClientRect();
              const startX = dotRect.left - canvasRectBase.left + canvasRef.current.scrollLeft + (dotRect.width / 2);
              const startY = dotRect.top - canvasRectBase.top + canvasRef.current.scrollTop + (dotRect.height / 2);
              
              const endX = childCanvasNode.x + NODE_BASE_WIDTH; // Connect to EAST side of child node
              const endY = childCanvasNode.y + calculateNodeHeight(childCanvasNode, editableRoadmap) / 2; 

              const pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
              const pathKey = `conn-dot-${childItem.id}-to-node-${childCanvasNode.id}-${startX}-${startY}-${endX}-${endY}`;
              lines.push(
                <path key={pathKey} d={pathData} stroke={'hsl(var(--primary))'} strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY} fill="none" markerEnd={'url(#arrowhead-main)'} style={{ pointerEvents: "none" }} />
              );
            }
          }
        });
      }

      if (Array.isArray(parentStep.peerConnections)) {
        parentStep.peerConnections.forEach((peerConn, index) => {
          if (!peerConn || !peerConn.targetNodeId) return; 

          const targetStep = editableRoadmap.find(s => s && s.id === peerConn.targetNodeId);
          if (!targetStep) return; 

          const sourceNodeHeight = calculateNodeHeight(parentStep, editableRoadmap);
          const targetNodeHeight = calculateNodeHeight(targetStep, editableRoadmap);

          let startX_peer: number, startY_peer: number;
          switch(peerConn.sourceDot) {
            case 'N': startX_peer = parentStep.x + NODE_BASE_WIDTH / 2; startY_peer = parentStep.y; break;
            case 'E': startX_peer = parentStep.x + NODE_BASE_WIDTH; startY_peer = parentStep.y + sourceNodeHeight / 2; break;
            case 'S': startX_peer = parentStep.x + NODE_BASE_WIDTH / 2; startY_peer = parentStep.y + sourceNodeHeight; break;
            default: console.warn(`Invalid sourceDot: ${peerConn.sourceDot}`); return;
          }

          let endX_peer: number, endY_peer: number;
          switch(peerConn.targetDot) {
            case 'N': endX_peer = targetStep.x + NODE_BASE_WIDTH / 2; endY_peer = targetStep.y; break;
            case 'E': endX_peer = targetStep.x + NODE_BASE_WIDTH; endY_peer = targetStep.y + targetNodeHeight / 2; break;
            case 'S': endX_peer = targetStep.x + NODE_BASE_WIDTH / 2; endY_peer = targetStep.y + targetNodeHeight; break;
            case 'W': endX_peer = targetStep.x; endY_peer = targetStep.y + targetNodeHeight / 2; break;
            default: console.warn(`Invalid targetDot: ${peerConn.targetDot}`); return;
          }
          
          let c1x = startX_peer, c1y = startY_peer, c2x = endX_peer, c2y = endY_peer;
          const curveFactor = 0.4 * Math.sqrt(Math.pow(endX_peer - startX_peer, 2) + Math.pow(endY_peer - startY_peer, 2));

          if (peerConn.sourceDot === 'E' && peerConn.targetDot === 'W') { c1x = startX_peer + curveFactor; c2x = endX_peer - curveFactor; }
          else if (peerConn.sourceDot === 'W' && peerConn.targetDot === 'E') { c1x = startX_peer - curveFactor; c2x = endX_peer + curveFactor; }
          else if (peerConn.sourceDot === 'S' && peerConn.targetDot === 'N') { c1y = startY_peer + curveFactor; c2y = endY_peer - curveFactor; }
          else if (peerConn.sourceDot === 'N' && peerConn.targetDot === 'S') { c1y = startY_peer - curveFactor; c2y = endY_peer + curveFactor; }
          else if (Math.abs(startX_peer - endX_peer) > Math.abs(startY_peer - endY_peer)) { c1x = startX_peer + (endX_peer - startX_peer) * 0.3; c1y = startY_peer; c2x = startX_peer + (endX_peer - startX_peer) * 0.7; c2y = endY_peer; }
          else { c1x = startX_peer; c1y = startY_peer + (endY_peer - startY_peer) * 0.3; c2x = endX_peer; c2y = startY_peer + (endY_peer - startY_peer) * 0.7; }

          const pathData_peer = `M ${startX_peer} ${startY_peer} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX_peer} ${endY_peer}`;
          const pathKey_peer = `peerconn-${parentStep.id}-${peerConn.sourceDot}-to-${targetStep.id}-${peerConn.targetDot}-${index}`;
          lines.push(
            <path key={pathKey_peer} d={pathData_peer} stroke={'hsl(var(--accent))'} strokeWidth={CONNECTION_LINE_THICKNESS_PEER} fill="none" markerEnd={'url(#arrowhead-accent)'} style={{ pointerEvents: "none" }} />
          );
        });
      }
    });
    return lines;
  }, [editableRoadmap]);


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
            <defs>
                <marker id="arrowhead-main" viewBox={`0 0 ${ARROWHEAD_LENGTH} ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} markerWidth={ARROWHEAD_LENGTH} markerHeight={ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR} refX={ARROWHEAD_LENGTH / 2} refY={(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2} orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points={`0 0, ${ARROWHEAD_LENGTH} ${(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2}, 0 ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} fill={'hsl(var(--primary))'}/></marker>
                <marker id="arrowhead-accent" viewBox={`0 0 ${ARROWHEAD_LENGTH} ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} markerWidth={ARROWHEAD_LENGTH} markerHeight={ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR} refX={ARROWHEAD_LENGTH / 2} refY={(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2} orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points={`0 0, ${ARROWHEAD_LENGTH} ${(ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR) / 2}, 0 ${ARROWHEAD_LENGTH * ARROWHEAD_WIDTH_FACTOR}`} fill={'hsl(var(--accent))'}/></marker>
            </defs>
            {drawConnectionLines()}
            {activeConnectionLinePreviewRef.current?.path && <path d={activeConnectionLinePreviewRef.current.path} stroke="hsl(var(--accent))" strokeWidth="2" strokeDasharray="4 4" fill="none" markerEnd={activeConnectionLinePreviewRef.current.targetNodeId ? 'url(#arrowhead-accent)' : undefined} />}
          </svg>
          {editableRoadmap.length === 0 && !isLoadingPlan && (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-full opacity-70 pointer-events-none">
              <Map className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">{canEditPlan ? "Click '+ Root Node' to start." : "Plan is empty."}</p>
            </div>
          )}
          {editableRoadmap.map(step => (
            <RoadmapStepCardComponent 
                key={step.id} 
                step={step} 
                allSteps={editableRoadmap} 
                onNodeInteractionStart={handleNodeInteractionStart} 
                isSelected={editingStep?.id === step.id} 
                onEditStep={handleEditCanvasNode} 
                onAddGrandchildToChildDataItem={onAddGrandchildToChildDataItem}
                onChildItemTitleClick={handleChildItemCanvasNodeFocus}
                isActuallyDraggingThisNode={isDraggingRef.current && nodeDragInfoRef.current?.nodeId === step.id} 
            />
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
                                        <button 
                                          type="button" 
                                          className="truncate text-left hover:underline" 
                                          title={childItem.title}
                                          onClick={() => handleChildItemCanvasNodeFocus(childItem.id, editingStep.id)}
                                        >
                                            {childItem.title}
                                        </button>
                                        <div className="flex-shrink-0 space-x-1">
                                            {canEditPlan && <Button variant="ghost" size="icon" className="h-6 w-6 p-1" onClick={() => handleEditChildItemText(childItem, editingStep.id)} title={`Edit item: ${childItem.title}`} disabled={saveRoadmapMutation.isPending}><Edit2 className="h-3.5 w-3.5" /></Button>}
                                            {canEditPlan && <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-destructive hover:text-destructive" onClick={() => handleDeleteChildItem(childItem.id, editingStep.id)} title={`Delete item: ${childItem.title}`} disabled={saveRoadmapMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (<p className="text-xs text-muted-foreground italic">No child items listed yet for this node.</p>)}
                        {canEditPlan && (
                            <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={() => { 
                                childItemManagementContextRef.current = { operation: 'createChild', targetParentNodeId: editingStep.id };
                                setDynamicChildDialogTitle(`Add Item to "${editingStep.title}"`);
                                setDefaultChildDialogTitle("");
                                setDefaultChildDialogDescription("");
                                setIsEditChildItemDialogOpen(true);
                             }} disabled={saveRoadmapMutation.isPending}>
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

      {childItemManagementContextRef.current && (
          <EditChildItemDialog
            isOpen={isEditChildItemDialogOpen}
            onOpenChange={setIsEditChildItemDialogOpen}
            onSubmit={handleChildItemDialogSubmit}
            isSubmitting={saveRoadmapMutation.isPending}
            dialogTitle={dynamicChildDialogTitle}
            defaultTitle={defaultChildDialogTitle}
            defaultDescription={defaultChildDialogDescription}
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
    
