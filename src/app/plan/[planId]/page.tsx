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
  View,
  ArrowRightLeft,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { format } from 'date-fns';
import { getInitials } from '@/lib/pseudonymUtils';
import { AddRoadmapStepDialog, type AddRoadmapStepFormData } from '@/components/plan/AddRoadmapStepDialog';
// RoadmapStepCardComponent is now defined locally
// import RoadmapStepCardComponent from '@/components/plan/RoadmapStepCard';


// --- START: Definitions from RoadmapStepCard.tsx ---
const MIN_CANVAS_PADDING_CARD = 20;
const NODE_BASE_WIDTH_CARD = 220;
const NODE_BASE_MIN_HEIGHT_CARD = 80;
const NODE_HEADER_HEIGHT_CARD = 40;
const CHILD_ITEM_HEIGHT_CARD = 28;
const FINAL_BUFFER_CARD_HEIGHT_CARD = 8;

const calculateNodeHeightCard = (step: RoadmapStep, allSteps: RoadmapStep[]): number => {
  let height = NODE_HEADER_HEIGHT_CARD;
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
    childrenDataListHeight += step.childrenData.length * CHILD_ITEM_HEIGHT_CARD;
    childrenDataListHeight += 8;
  }

  contentAreaHeight = Math.max(descriptionHeight, childrenDataListHeight);
  if (contentAreaHeight === 0 && (!step.description || step.description.trim().length === 0) && (!Array.isArray(step.childrenData) || step.childrenData.length === 0)) {
      contentAreaHeight = 20;
  }

  height += contentAreaHeight;
  height += FINAL_BUFFER_CARD_HEIGHT_CARD;
  return Math.max(NODE_BASE_MIN_HEIGHT_CARD, height);
};

interface RoadmapStepCardProps {
  step: RoadmapStep;
  allSteps: RoadmapStep[];
  onNodeInteractionStart: (nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isDotDrag?: boolean, dotType?: 'N' | 'E' | 'S') => void;
  isSelected?: boolean;
  onEditStep: (step: RoadmapStep) => void;
  onAddGrandchildToChildDataItem: (parentChildItemId: string, parentCanvasNodeIdOfChildItem: string) => void;
  onChildItemTitleClick: (childItemId: string, parentCanvasNodeId: string) => void;
  isActuallyDraggingThisNode?: boolean;
  diffHighlight?: 'added' | 'persisted';
}

const RoadmapStepCardComponent: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  allSteps,
  onNodeInteractionStart,
  isSelected,
  onEditStep,
  onAddGrandchildToChildDataItem,
  onChildItemTitleClick,
  isActuallyDraggingThisNode,
  diffHighlight,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const dynamicHeight = calculateNodeHeightCard(step, allSteps);

  const cardClasses = cn(
    "group/cardnode absolute select-none shadow-lg border rounded-lg flex flex-col",
    isSelected ? "ring-2 ring-primary shadow-2xl z-20" : "border-border hover:shadow-xl z-10 shadow-sm",
    isActuallyDraggingThisNode ? 'cursor-grabbing shadow-2xl z-30' : 'cursor-grab',
    diffHighlight === 'added' && 'border-green-500 ring-2 ring-green-300 shadow-green-500/30',
    diffHighlight === 'persisted' && 'border-gray-400 opacity-70'
  );

  const headerClasses = cn(
    "p-2 border-b border-border flex items-center justify-between cursor-move rounded-t-lg h-[40px]",
    diffHighlight === 'added' ? 'bg-green-600 text-white' : diffHighlight === 'persisted' ? 'bg-gray-500 text-gray-100' : 'bg-primary text-primary-foreground'
  );


  return (
    <div
      ref={cardRef}
      className={cardClasses}
      style={{
        left: `${step.x}px`,
        top: `${step.y}px`,
        width: `${NODE_BASE_WIDTH_CARD}px`,
        height: `${dynamicHeight}px`,
        touchAction: diffHighlight ? 'auto' : 'none',
        pointerEvents: diffHighlight ? 'none' : 'auto',
        zIndex: diffHighlight ? 30 : (isSelected ? 20 : 10),
      }}
      onMouseDown={(e) => {
        if (diffHighlight) return;
        if ((e.target as HTMLElement).closest('[data-dot-type]') || (e.target as HTMLElement).closest('[data-child-item-dot-id]')) return;
        onNodeInteractionStart(step.id, e);
      }}
      onTouchStart={(e) => {
        if (diffHighlight) return;
        if ((e.target as HTMLElement).closest('[data-dot-type]') || (e.target as HTMLElement).closest('[data-child-item-dot-id]')) return;
        onNodeInteractionStart(step.id, e);
      }}
      data-node-id={step.id}
    >
      <div
        className={headerClasses}
        onDoubleClick={diffHighlight ? undefined : () => onEditStep(step)}
      >
        <h3 className="text-sm font-semibold truncate" title={step.title}>{step.title}</h3>

        {!diffHighlight && (
          <>
            <div
              className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-sky-400 border-2 border-white transition-all duration-150 ease-in-out group-hover/cardnode:scale-125 group-hover/cardnode:ring-2 group-hover/cardnode:ring-sky-300 group-hover/cardnode:z-10 cursor-pointer"
              data-dot-type="N" title="North Connector (Drag to connect or create new)"
              onMouseDown={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'N'); }}
              onTouchStart={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'N'); }}
            />
            <div
              className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-sky-400 border-2 border-white transition-all duration-150 ease-in-out group-hover/cardnode:scale-125 group-hover/cardnode:ring-2 group-hover/cardnode:ring-sky-300 group-hover/cardnode:z-10 cursor-pointer"
              data-dot-type="E" title="East Connector (Drag to connect or create new)"
              onMouseDown={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'E'); }}
              onTouchStart={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'E'); }}
            />
            <div
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 h-3 w-3 rounded-full bg-sky-400 border-2 border-white transition-all duration-150 ease-in-out group-hover/cardnode:scale-125 group-hover/cardnode:ring-2 group-hover/cardnode:ring-sky-300 group-hover/cardnode:z-10 cursor-pointer"
              data-dot-type="S" title="South Connector (Drag to connect or create new)"
              onMouseDown={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'S'); }}
              onTouchStart={(e) => { e.stopPropagation(); onNodeInteractionStart(step.id, e, true, 'S'); }}
            />
          </>
        )}
      </div>
      <div
        className={cn("flex-grow min-h-0 p-2 text-xs space-y-1", diffHighlight === 'persisted' && 'opacity-80')}
        style={{ backgroundColor: 'hsl(var(--card))' }}
      >
          {step.description && (<p className="whitespace-pre-wrap line-clamp-2 mb-1 text-foreground">{step.description}</p>)}

          {Array.isArray(step.childrenData) && step.childrenData.length > 0 && (
            <ul className="space-y-0.5 list-none p-0 m-0" style={{paddingTop: `8px`}}>
              {step.childrenData.map((childItem, index) => {
                const childHasOwnCanvasNode = !!(childItem.canvasNodeIdForThisItem && allSteps.some(s => s.id === childItem.canvasNodeIdForThisItem));

                return (
                  <li key={childItem.id} data-child-item-index={index} className="text-xs py-0.5 flex items-center justify-between group/childitemli relative pl-4">
                    {!diffHighlight && (
                        <button
                        aria-label={`Create new step from: Sub-step "${childItem.title}" (Anchor: W)`}
                        title={`Create new step from: Sub-step "${childItem.title}" (Anchor: W)`}
                        onClick={(e) => { e.stopPropagation(); onAddGrandchildToChildDataItem(childItem.id, step.id); }}
                        className="group absolute rounded-full z-20 transition-all duration-150 ease-in-out flex items-center justify-center active:scale-125 cursor-pointer w-3 h-3 left-[-6px] top-1/2 -translate-y-1/2"
                        data-child-item-dot-id={childItem.id}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        >
                            <div className={cn(
                                "rounded-full transition-all duration-150 ease-in-out h-2 w-2",
                                childHasOwnCanvasNode ? "bg-green-500" : "bg-muted-foreground",
                                "group-hover:bg-green-500 group-hover:scale-150 group-hover:ring-2 group-hover:ring-green-300"
                            )}></div>
                        </button>
                    )}
                    <div className="flex items-center flex-grow min-w-0">
                      <button
                        type="button"
                        className={cn("truncate text-left data-child-item-title-button", !diffHighlight && "hover:underline cursor-pointer")}
                        onClick={(e) => {
                            if (diffHighlight) return;
                            e.stopPropagation();
                            onChildItemTitleClick(childItem.id, step.id);
                        }}
                        disabled={!!diffHighlight}
                        title={childItem.title}
                      >
                        {childItem.title}
                      </button>
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
RoadmapStepCardComponent.displayName = "RoadmapStepCardComponent";
// --- END: Definitions from RoadmapStepCard.tsx ---


// Constants for node rendering and layout
const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const NODE_BASE_MIN_HEIGHT = 80;
const NODE_HEADER_HEIGHT = 40;
const CHILD_ITEM_HEIGHT = 28;
const FINAL_BUFFER_CARD_HEIGHT = 8;
const DEFAULT_SPACING_X = 80;
const DEFAULT_SPACING_Y = 40;

const CONNECTION_LINE_THICKNESS_HIERARCHY = 1.5;
const CONNECTION_LINE_THICKNESS_PEER = 1.5;
const ARROWHEAD_LENGTH = 8;
const ARROWHEAD_WIDTH_FACTOR = 0.7;
const CLICK_MOVE_THRESHOLD_PX_SQ = 25;
const CLICK_TIME_THRESHOLD_MS = 300;

function calculateNodeHeight(step: RoadmapStep, allSteps: RoadmapStep[]): number {
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
}

function sanitizeRoadmapStep(step: Partial<RoadmapStep>, defaultParentId?: string): RoadmapStep {
  const sanitizedChildrenData = (Array.isArray(step.childrenData) ? step.childrenData : []).map(ci => ({
    id: typeof ci.id === 'string' && ci.id.trim() !== '' ? ci.id : `childitem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: ci.title || "Untitled Child",
    description: ci.description || null,
    parentCanvasNodeId: ci.parentCanvasNodeId || step.id || defaultParentId || "",
    canvasNodeIdForThisItem: ci.canvasNodeIdForThisItem || null,
  }));
  return {
    id: typeof step.id === 'string' && step.id.trim() !== '' ? step.id : `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: typeof step.title === 'string' ? step.title : "Untitled Step",
    x: typeof step.x === 'number' ? step.x : 0,
    y: typeof step.y === 'number' ? step.y : 0,
    description: (typeof step.description === 'string' && step.description.trim() !== '') ? step.description.trim() : null,
    childrenData: sanitizedChildrenData,
    peerConnections: Array.isArray(step.peerConnections) ? step.peerConnections : [],
  };
}


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

type EditingTarget =
  | { type: 'node', data: RoadmapStep }
  | { type: 'childItem', data: ChildDataItem, parentNode: RoadmapStep }
  | null;

type ChildItemOperationContext =
    | { operation: 'createGrandchild'; targetChildToBecomeParentId: string; currentParentOfTargetChildId: string; }
    | { operation: 'createChild'; targetParentNodeId: string; }
    | { operation: 'edit'; itemToEditId: string; parentNodeId: string; };

interface AugmentedClientPlanVersion extends ClientPlanVersion {
  addedNodesCount: number;
  removedNodesCount: number;
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

  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);

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

  const [diffTarget, setDiffTarget] = useState<{ current: ClientPlanVersion; previous: ClientPlanVersion | null } | null>(null);
  const [addedNodeIds, setAddedNodeIds] = useState<Set<string>>(new Set());
  const [persistedNodeIds, setPersistedNodeIds] = useState<Set<string>>(new Set());
  const [removedNodeTitles, setRemovedNodeTitles] = useState<string[]>([]);
  const [diffDetailsVersionId, setDiffDetailsVersionId] = useState<string | null>(null);


  const isValidPlanId = useMemo(() => !!planId && (IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20), [planId]);

  const { data: planData, isLoading: isLoadingPlan, error: planError } = useQuery<ClientPlan | null>({
    queryKey: ['plan', planId],
    queryFn: async () => (planId && isValidPlanId) ? getPlanById(planId) : null,
    enabled: !!planId && isValidPlanId && !authLoading,
  });

  const { data: planVersionsData = [], isLoading: isLoadingVersions, refetch: refetchPlanVersions } = useQuery<ClientPlanVersion[]>({
    queryKey: ['planVersions', planId],
    queryFn: () => (planId && isValidPlanId ? getPlanVersions(planId) : Promise.resolve([])),
    enabled: isVersionHistorySheetOpen && !!planId && isValidPlanId,
  });

  const augmentedPlanVersions = useMemo<AugmentedClientPlanVersion[]>(() => {
    if (!planVersionsData || planVersionsData.length === 0) return [];
    return planVersionsData.map((currentVersion, index) => {
      let addedNodesCount = 0;
      let removedNodesCount = 0;
      const currentRoadmapIds = new Set((currentVersion.roadmap || []).map(n => n.id));
      const previousVersionInHistory = planVersionsData[index + 1];

      if (previousVersionInHistory) {
        const previousRoadmapIds = new Set((previousVersionInHistory.roadmap || []).map(n => n.id));
        currentRoadmapIds.forEach(id => { if (!previousRoadmapIds.has(id)) addedNodesCount++; });
        previousRoadmapIds.forEach(id => { if (!currentRoadmapIds.has(id)) removedNodesCount++; });
      } else {
        addedNodesCount = currentRoadmapIds.size;
        removedNodesCount = 0;
      }
      return { ...currentVersion, addedNodesCount, removedNodesCount };
    });
  }, [planVersionsData]);


  const saveRoadmapMutation = useMutation({
    mutationFn: (payload: { planId: string; currentUserId: string; roadmapToSave: RoadmapStep[] }) => savePlanData(payload.planId, payload.currentUserId, payload.roadmapToSave),
    onSuccess: () => {
      toast({ title: "Plan State Saved", description: "The current plan state has been saved." });
      if (planId) {
        queryClient.invalidateQueries({ queryKey: ['plan', planId] });
        queryClient.invalidateQueries({ queryKey: ['planVersions', planId] });
        refetchPlanVersions();
      }
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save plan." })
  });

  const restorePlanMutation = useMutation({
    mutationFn: (payload: { planId: string; versionIdToRestore: string; currentUserId: string; }) => restorePlanToVersion(payload.planId, payload.versionIdToRestore, payload.currentUserId),
    onSuccess: () => {
      toast({ title: "Plan Restored", description: "The plan has been restored." });
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['planVersions', planId] });
      refetchPlanVersions();
      setIsRestoreConfirmOpen(false); setVersionToRestore(null);
      handleExitDiffView();
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Restore Failed", description: error.message || "Could not restore plan." }),
  });

  useEffect(() => {
    if (diffTarget) {
        const currentRoadmap = (diffTarget.current.roadmap || []).map(s => sanitizeRoadmapStep(s));
        const previousRoadmap = diffTarget.previous ? (diffTarget.previous.roadmap || []).map(s => sanitizeRoadmapStep(s)) : [];
        setEditableRoadmap(currentRoadmap);
        const currentIds = new Set(currentRoadmap.map(n => n.id));
        const previousIds = new Set(previousRoadmap.map(n => n.id));
        const added = new Set<string>();
        currentRoadmap.forEach(node => { if (!previousIds.has(node.id)) added.add(node.id); });
        setAddedNodeIds(added);
        const persisted = new Set<string>();
        currentRoadmap.forEach(node => { if (previousIds.has(node.id)) persisted.add(node.id); });
        setPersistedNodeIds(persisted);
        const removedTitlesList: string[] = [];
        previousRoadmap.forEach(node => { if (!currentIds.has(node.id)) removedTitlesList.push(node.title || `Unnamed Node (ID: ${node.id})`); });
        setRemovedNodeTitles(removedTitlesList);
    } else if (planData) {
        setEditableRoadmap((planData.roadmap || []).map(s => sanitizeRoadmapStep(s)));
        setAddedNodeIds(new Set());
        setPersistedNodeIds(new Set());
        setRemovedNodeTitles([]);
    } else {
        setEditableRoadmap([]);
        setAddedNodeIds(new Set());
        setPersistedNodeIds(new Set());
        setRemovedNodeTitles([]);
    }
  }, [planData, diffTarget]);


  useEffect(() => {
    if (editingTarget?.type === 'node' && editingTarget.data.id && editableRoadmap) {
        const updatedVersionOfEditingNode = editableRoadmap.find(s => s.id === editingTarget.data.id);
        if (updatedVersionOfEditingNode) {
            if (JSON.stringify(updatedVersionOfEditingNode) !== JSON.stringify(editingTarget.data)) {
                setEditingTarget({ type: 'node', data: updatedVersionOfEditingNode });
            }
        } else {
            setIsStepDetailSheetOpen(false);
            setEditingTarget(null);
        }
    } else if (editingTarget?.type === 'childItem' && editingTarget.data.id && editableRoadmap) {
        const parentNode = editableRoadmap.find(n => n.id === editingTarget.parentNode.id);
        if (parentNode) {
            const updatedChildItem = parentNode.childrenData.find(ci => ci.id === editingTarget.data.id);
            if (updatedChildItem) {
                if (JSON.stringify(updatedChildItem) !== JSON.stringify(editingTarget.data)) {
                    setEditingTarget({ type: 'childItem', data: updatedChildItem, parentNode: parentNode });
                }
            } else {
                setIsStepDetailSheetOpen(false);
                setEditingTarget(null);
            }
        } else {
            setIsStepDetailSheetOpen(false);
            setEditingTarget(null);
        }
    }
  }, [editableRoadmap, editingTarget]);


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

  const handleEditCanvasNode = useCallback((nodeToEdit: RoadmapStep) => {
    if (diffTarget) return;
    setEditingTarget({ type: 'node', data: nodeToEdit });
    setIsStepDetailSheetOpen(true);
    setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);
  }, [diffTarget]);

  const handleChildItemCanvasNodeFocus = useCallback((childItemId: string, parentCanvasNodeId: string) => {
    if (diffTarget) return;
    const parentNode = editableRoadmap.find(n => n.id === parentCanvasNodeId);
    if (!parentNode) {
      toast({ variant: "destructive", title: "Error", description: "Parent node not found."});
      return;
    }
    const childItem = parentNode.childrenData.find(ci => ci.id === childItemId);
    if (!childItem) {
      toast({ variant: "destructive", title: "Error", description: "Child item not found."});
      return;
    }

    if (childItem.canvasNodeIdForThisItem) {
      const existingCanvasNode = editableRoadmap.find(n => n.id === childItem.canvasNodeIdForThisItem);
      if (existingCanvasNode) {
        setEditingTarget({ type: 'node', data: existingCanvasNode });
      } else {
        console.warn("Child item has canvasNodeIdForThisItem, but node not found in roadmap. Treating as non-spawned.");
        setEditingTarget({ type: 'childItem', data: childItem, parentNode: parentNode });
      }
    } else {
      setEditingTarget({ type: 'childItem', data: childItem, parentNode: parentNode });
    }
    setIsStepDetailSheetOpen(true);
    setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);
  }, [editableRoadmap, toast, diffTarget]);


  const handleNodeDetailUpdate = useCallback((updatedStep: RoadmapStep) => {
    if (!canEditPlan || diffTarget) return;
    setEditableRoadmap(prev => prev.map(s =>
      s.id === updatedStep.id
        ? { ...s, ...updatedStep, childrenData: updatedStep.childrenData || (s.childrenData || []) }
        : s
    ));
    toast({ title: "Node Updated", description: `"${updatedStep.title}" details changed. Remember to save.`});
    setIsEditingNodeTitle(false); setIsEditingNodeDescription(false);
  }, [canEditPlan, toast, diffTarget]);

  const handleChildItemDetailUpdateInPanel = useCallback((updatedChildItem: ChildDataItem, parentNodeId: string) => {
    if (!canEditPlan || diffTarget) return;
    setEditableRoadmap(prev => prev.map(parentNode => {
        if (parentNode.id === parentNodeId) {
            return {
                ...parentNode,
                childrenData: parentNode.childrenData.map(ci => ci.id === updatedChildItem.id ? updatedChildItem : ci)
            };
        }
        return parentNode;
    }));
    toast({ title: "Item Updated", description: `"${updatedChildItem.title}" details changed. Remember to save.`});
  }, [canEditPlan, toast, diffTarget]);


  const handleInitiateAddNode = useCallback((sourceNodeId: string | null, initiatingDot?: 'N' | 'E' | 'S') => {
    if (!canEditPlan || diffTarget) return;
    setTargetParentIdForDialog(sourceNodeId);
    setInitiatingDotTypeForDialog(initiatingDot || null);
    setIsAddNodeDialogOpen(true);
  }, [canEditPlan, diffTarget]);

  const handleAddNode = useCallback((data: AddRoadmapStepFormData) => {
    if (!canEditPlan || !canvasRef.current || diffTarget) return;

    const newId = `step-${Date.now()}-${uuidv4().substring(0, 8)}`;
    let newStepX, newStepY;

    const sourceNodeForPeerLink = targetParentIdForDialog ? editableRoadmap.find(s => s.id === targetParentIdForDialog) : null;

    if (sourceNodeForPeerLink && initiatingDotTypeForDialog) {
        const sourceHeight = calculateNodeHeight(sourceNodeForPeerLink, editableRoadmap);
        switch (initiatingDotTypeForDialog) {
            case 'N': newStepX = sourceNodeForPeerLink.x; newStepY = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.y - NODE_BASE_MIN_HEIGHT - DEFAULT_SPACING_Y); break;
            case 'E': newStepX = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.x + NODE_BASE_WIDTH + DEFAULT_SPACING_X); newStepY = sourceNodeForPeerLink.y; break;
            case 'S': newStepY = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.y + sourceHeight + DEFAULT_SPACING_Y); newStepX = sourceNodeForPeerLink.x; break;
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
    setIsAddNodeDialogOpen(false);
    setTargetParentIdForDialog(null);
    setInitiatingDotTypeForDialog(null);
  }, [canEditPlan, toast, editableRoadmap, targetParentIdForDialog, initiatingDotTypeForDialog, diffTarget]);

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
      title: childItem.title,
      description: childItem.description,
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
    if (!canEditPlan || diffTarget) return;
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
  }, [canEditPlan, editableRoadmap, toast, diffTarget]);

  const handleChildItemDialogSubmit = useCallback((data: { title: string; description?: string }) => {
    if (!childItemManagementContextRef.current || !canEditPlan || diffTarget) return;
    const context = childItemManagementContextRef.current;
    let operationSucceeded = false;

    setEditableRoadmap(prevRoadmap => {
      let tempRoadmap = [...prevRoadmap];
      let spawnedNodeIdForContext: string | null = null;

      if (context.operation === 'createGrandchild') {
        const { targetChildToBecomeParentId, currentParentOfTargetChildId } = context;

        const spawnResult = handleSpawnChildDataItemAsCanvasNode(tempRoadmap, targetChildToBecomeParentId, currentParentOfTargetChildId);
        tempRoadmap = spawnResult.updatedRoadmap;
        spawnedNodeIdForContext = spawnResult.spawnedNodeId;

        if (!spawnedNodeIdForContext) {
          toast({ variant: "destructive", title: "Error", description: "Failed to ensure parent canvas node for new item." });
          return prevRoadmap;
        }

        const parentCanvasNodeForGrandchildIndex = tempRoadmap.findIndex(node => node.id === spawnedNodeIdForContext);
        if (parentCanvasNodeForGrandchildIndex > -1) {
          const newGrandchildItem: ChildDataItem = {
            id: `childitem-${Date.now()}-${uuidv4().substring(0, 8)}`,
            title: data.title, description: data.description || null,
            parentCanvasNodeId: spawnedNodeIdForContext,
            canvasNodeIdForThisItem: null,
          };
          const updatedParentNode = { ...tempRoadmap[parentCanvasNodeForGrandchildIndex] };
          updatedParentNode.childrenData = [...(updatedParentNode.childrenData || []), newGrandchildItem];
          tempRoadmap[parentCanvasNodeForGrandchildIndex] = updatedParentNode;
          toast({ title: "Item Added", description: `"${data.title}" added to "${updatedParentNode.title}". Remember to save.` });
          operationSucceeded = true;

          const nodeThatBecameParent = tempRoadmap.find(n => n.id === spawnedNodeIdForContext);
          if (nodeThatBecameParent) {
              setTimeout(() => {
                  setEditingTarget({type: 'node', data: nodeThatBecameParent});
                  setIsStepDetailSheetOpen(true);
              },0);
          }

        } else {
          toast({ variant: "destructive", title: "Error", description: `Could not find spawned canvas node (ID: ${spawnedNodeIdForContext}) to add item to.` });
        }

      } else if (context.operation === 'createChild') {
        const { targetParentNodeId } = context;
        const parentNodeIndex = tempRoadmap.findIndex(node => node.id === targetParentNodeId);
        if (parentNodeIndex > -1) {
          const newChildItem: ChildDataItem = {
            id: `childitem-${Date.now()}-${uuidv4().substring(0, 8)}`,
            title: data.title, description: data.description || null,
            parentCanvasNodeId: targetParentNodeId,
            canvasNodeIdForThisItem: null,
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
  }, [canEditPlan, toast, handleSpawnChildDataItemAsCanvasNode, diffTarget]);

  const handleEditChildItemText = useCallback((childItem: ChildDataItem, parentNodeIdOfChildItem: string) => {
    if(!canEditPlan || diffTarget) return;
    childItemManagementContextRef.current = {
        operation: 'edit',
        itemToEditId: childItem.id,
        parentNodeId: parentNodeIdOfChildItem
    };
    setDynamicChildDialogTitle(`Edit Item: "${childItem.title}"`);
    setDefaultChildDialogTitle(childItem.title);
    setDefaultChildDialogDescription(childItem.description || "");
    setIsEditChildItemDialogOpen(true);
  }, [canEditPlan, diffTarget]);

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
    if (!canEditPlan || diffTarget) return;

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

        if (editingTarget?.type === 'childItem' && editingTarget.data.id === childItemIdToDelete && editingTarget.parentNode.id === parentCanvasNodeIdOfItem) {
            const parentNodeAfterDelete = updatedRoadmap.find(n => n.id === parentCanvasNodeIdOfItem);
            if (parentNodeAfterDelete) {
                 setEditingTarget({type: 'node', data: parentNodeAfterDelete});
            } else {
                 setIsStepDetailSheetOpen(false); setEditingTarget(null);
            }
        } else if (editingTarget?.type === 'node' && editingTarget.data.id === canvasNodeIdThatWasRepresentedByDeletedItem) {
            setIsStepDetailSheetOpen(false); setEditingTarget(null);
        }

        setTimeout(() => handleUnspawnNodeIfChildless(parentCanvasNodeIdOfItem), 0);

        return updatedRoadmap;
    });
  }, [canEditPlan, toast, handleUnspawnNodeIfChildless, editingTarget, diffTarget]);


  const confirmDeleteNode = useCallback(() => {
    if (!nodeToDelete || !canEditPlan || diffTarget) return;
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

    if (editingTarget?.type === 'node' && editingTarget.data.id === idToDelete) {
        setIsStepDetailSheetOpen(false);
        setEditingTarget(null);
    }
    toast({ title: `Node "${nodeToDelete.title}" Deleted from Canvas`, description: `Remember to save.` });
    setNodeToDelete(null);
  }, [nodeToDelete, canEditPlan, toast, editingTarget, diffTarget]);

  const saveRoadmapChanges = useCallback(async () => {
    if (!planData || !user || !planId || !canEditPlan || diffTarget) {
      toast({ variant: "destructive", title: "Error", description: "Cannot save." });
      return;
    }
    saveRoadmapMutation.mutate({ planId, currentUserId: user.uid, roadmapToSave: editableRoadmap });
  }, [planData, user, planId, canEditPlan, editableRoadmap, saveRoadmapMutation, toast, diffTarget]);

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

  const handleViewChangesClick = useCallback((versionToView: ClientPlanVersion, previousVersionInHistory: ClientPlanVersion | null) => {
    if (!planData) return;
    const isCurrentlyViewingThisDiff = diffDetailsVersionId === versionToView.id && !!diffTarget;

    if (isCurrentlyViewingThisDiff) {
        handleExitDiffView();
    } else {
        setDiffTarget({ current: versionToView, previous: previousVersionInHistory });
        setDiffDetailsVersionId(versionToView.id);
    }
  }, [planData, diffDetailsVersionId, diffTarget]);

  const handleExitDiffView = useCallback(() => {
      setDiffTarget(null);
      setDiffDetailsVersionId(null);
      if (planData) {
        setEditableRoadmap((planData.roadmap || []).map(s => sanitizeRoadmapStep(s)));
      }
  }, [planData]);

  const handleRestoreVersion = (version: ClientPlanVersion) => { setVersionToRestore(version); setIsRestoreConfirmOpen(true); };
  const confirmRestore = () => { if (!versionToRestore || !planId || !user) return; restorePlanMutation.mutate({ planId, versionIdToRestore: versionToRestore.id, currentUserId: user.uid }); };

  const handleNodeInteractionStart = useCallback((nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isDotDrag: boolean = false, dotType?: 'N' | 'E' | 'S') => {
    if (('button' in event && (event as React.MouseEvent).button !== 0) || !canEditPlan || !canvasRef.current || diffTarget) return;
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
  }, [canEditPlan, getPointerCoords, diffTarget]);

  const handleGlobalMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isPointerDown || !canvasRef.current || diffTarget) return;
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
  }, [isPointerDown, getPointerCoords, editableRoadmap, diffTarget]);

  const handleGlobalPointerUp = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isPointerDown || !nodeDragInfoRef.current || diffTarget) {
        setIsPointerDown(false);
        return;
    }

    const { nodeId: sourceNodeId, dotType: sourceDotType, isDotDrag } = nodeDragInfoRef.current;
    const clickInfo = clickStartInfoRef.current;
    const isConsideredDrag = isDraggingRef.current;

    if (isDotDrag && sourceDotType) {
        if (activeConnectionLinePreviewRef.current?.path) {
            const targetNodeIdUnderCursor = activeConnectionLinePreviewRef.current.targetNodeId;
            const dropTargetNode = targetNodeIdUnderCursor ? editableRoadmap.find(s => s.id === targetNodeIdUnderCursor) : undefined;

            if (dropTargetNode) {
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
            } else {
                 handleInitiateAddNode(sourceNodeId, sourceDotType);
            }
        } else if (!isConsideredDrag && clickInfo) {
             handleInitiateAddNode(sourceNodeId, sourceDotType);
        }
    } else {
        if (!isConsideredDrag && clickInfo) {
            const finalCoords = getPointerCoords(event);
            const timeElapsed = Date.now() - clickInfo.timestamp;
            const deltaX = finalCoords.clientX - clickInfo.clientX;
            const deltaY = finalCoords.clientY - clickInfo.clientY;

            if ((deltaX * deltaX + deltaY * deltaY) < CLICK_MOVE_THRESHOLD_PX_SQ && timeElapsed < CLICK_TIME_THRESHOLD_MS) {
                 if (clickInfo.targetElement && (clickInfo.targetElement as HTMLElement).closest('[data-node-id]') &&
                    !(clickInfo.targetElement as HTMLElement).closest('[data-dot-type]') &&
                    !(clickInfo.targetElement as HTMLElement).closest('[data-child-item-dot-id]') &&
                    !(clickInfo.targetElement as HTMLElement).closest('[data-child-item-title-button]')) {
                    const clickedStep = editableRoadmap.find(s => s.id === sourceNodeId);
                    if (clickedStep) {
                        handleEditCanvasNode(clickedStep);
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
    if (svgRef.current) svgRef.current.style.display = 'block';
  }, [isPointerDown, getPointerCoords, editableRoadmap, handleEditCanvasNode, toast, handleInitiateAddNode, diffTarget]);

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
        setEditingTarget(null);
        setIsEditingNodeTitle(false);
        setIsEditingNodeDescription(false);
    }
  }, [isStepDetailSheetOpen]);


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

              const endX = childCanvasNode.x + NODE_BASE_WIDTH;
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

  return (
    <div className="flex flex-col flex-1">
      <div className="sticky top-0 z-20 w-full border-b bg-background">
        <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
          <div className="flex items-center space-x-4">
            <Link href="/" className="md:hidden">
              <ChevronLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-xl font-semibold">{planData?.title || "Loading Plan..."}</h1>
            {planData?.public && (<Badge variant="secondary">Public</Badge>)}
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4 sm:space-x-2">
            {!canEditPlan && planData?.ownerId && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={`https://avatar.vercel.sh/${planData.ownerId}.png`} alt={`Avatar of plan owner ${planData.ownerId}`} referrerPolicy="no-referrer" />
                  <AvatarFallback>{getInitials(planData.ownerId)}</AvatarFallback>
                </Avatar>
                <span>{planData.ownerId}</span>
              </div>
            )}
            {canEditPlan && !diffTarget && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsVersionHistorySheetOpen(true)}>
                  <History className="mr-2 h-4 w-4" />
                  Version History
                </Button>
                <Button size="sm" onClick={saveRoadmapChanges} disabled={saveRoadmapMutation.isLoading}>
                  {saveRoadmapMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </>
            )}
            {!diffTarget && (
              <Button variant="secondary" size="sm" onClick={sharePlan}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            )}
            {diffTarget && (
                <Button variant="secondary" size="sm" onClick={handleExitDiffView}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Exit Diff View
                </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto">
        {planError ? (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
            <h1 className="text-xl font-semibold">Error Loading Plan</h1>
            <p className="text-muted-foreground">{planError.message || "Failed to load plan."}</p>
          </div>
        ) : (
          <ScrollArea className="flex flex-1">
            <div
              ref={canvasRef}
              style={{ minWidth: '100%', minHeight: `${canvasMinHeight}px`, position: 'relative', overflow: 'auto', touchAction: 'none' }}
              className="bg-muted"
            >
              <svg
                ref={svgRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'block' }}
                className="pointer-events-none"
              >
                <defs>
                  <marker id="arrowhead-main" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                    <path d={`M 0 0 L 10 5 L 0 10 z`} fill={'hsl(var(--primary))'} />
                  </marker>
                  <marker id="arrowhead-accent" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                    <path d={`M 0 0 L 10 5 L 0 10 z`} fill={'hsl(var(--accent))'} />
                  </marker>
                </defs>
                {drawConnectionLines()}
                {activeConnectionLinePreviewRef.current?.path && (
                  <path d={activeConnectionLinePreviewRef.current.path} stroke={'hsl(var(--primary))'} strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY} fill="none" style={{ pointerEvents: "none" }} />
                )}
              </svg>
              {editableRoadmap.map((step) => (
                <RoadmapStepCardComponent
                  key={step.id}
                  step={step}
                  allSteps={editableRoadmap}
                  onNodeInteractionStart={handleNodeInteractionStart}
                  isSelected={editingTarget?.type === 'node' && editingTarget.data.id === step.id}
                  onEditStep={handleEditCanvasNode}
                  onAddGrandchildToChildDataItem={onAddGrandchildToChildDataItem}
                  onChildItemTitleClick={handleChildItemCanvasNodeFocus}
                  isActuallyDraggingThisNode={nodeDragInfoRef.current?.nodeId === step.id && isDraggingRef.current}
                  diffHighlight={addedNodeIds.has(step.id) ? 'added' : persistedNodeIds.has(step.id) ? 'persisted' : undefined}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <Sheet open={isStepDetailSheetOpen} onOpenChange={setIsStepDetailSheetOpen}>
        <SheetContent className="sm:max-w-[486px]" side="right">
          <SheetHeader>
            <SheetTitle>{editingTarget?.type === 'node' ? `Step Details: "${editingTarget.data.title}"` : editingTarget?.type === 'childItem' ? `Item Details: "${editingTarget.data.title}"` : "Step Details"}</SheetTitle>
            <SheetDescription>Make changes to your plan here. Click outside to save.</SheetDescription>
          </SheetHeader>
          {editingTarget?.type === 'node' && (
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  type="text"
                  id="title"
                  value={editingTarget.data.title}
                  onChange={(e) => handleNodeDetailUpdate({ ...editingTarget.data, title: e.target.value })}
                  className={cn(isEditingNodeTitle ? "ring-2 ring-primary" : "cursor-pointer hover:ring-1 hover:ring-border")}
                  onFocus={() => setIsEditingNodeTitle(true)}
                  onBlur={() => setIsEditingNodeTitle(false)}
                  disabled={!canEditPlan || diffTarget}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editingTarget.data.description || ""}
                  onChange={(e) => handleNodeDetailUpdate({ ...editingTarget.data, description: e.target.value })}
                  className={cn(isEditingNodeDescription ? "ring-2 ring-primary" : "cursor-pointer hover:ring-1 hover:ring-border")}
                  onFocus={() => setIsEditingNodeDescription(true)}
                  onBlur={() => setIsEditingNodeDescription(false)}
                  disabled={!canEditPlan || diffTarget}
                />
              </div>
              <div className="border rounded-md p-2 text-sm text-muted-foreground">
                <View className="inline-block h-3 w-3 mr-1 align-text-bottom" />
                <span>X: {editingTarget.data.x}, Y: {editingTarget.data.y}</span>
              </div>
            </div>
          )}

          {editingTarget?.type === 'childItem' && (
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="child-item-title-display">Title</Label>
                  <Input
                    type="text"
                    id="child-item-title-display"
                    value={editingTarget.data.title}
                    readOnly
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="child-item-description-display">Description</Label>
                  <Textarea
                    id="child-item-description-display"
                    value={editingTarget.data.description || ""}
                    readOnly
                    disabled
                  />
                </div>
                <div className="flex space-x-2">
                    <Button variant="secondary" size="sm" onClick={() => handleEditChildItemText(editingTarget.data, editingTarget.parentNode.id)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteChildItem(editingTarget.data.id, editingTarget.parentNode.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Item
                    </Button>
                </div>
              </div>
          )}

          {editingTarget?.type === 'node' && canEditPlan && !diffTarget && (
            <SheetFooter>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Step
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone. This will permanently delete this step and any associated connections from your plan.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setNodeToDelete(editingTarget.data)}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={nodeToDelete !== null} onOpenChange={(open) => { if (!open) setNodeToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{nodeToDelete?.title}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNodeToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNode}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </Dialog>

      <AddRoadmapStepDialog isOpen={isAddNodeDialogOpen} onOpenChange={setIsAddNodeDialogOpen} onSubmit={handleAddNode} />

      <EditChildItemDialog
        isOpen={isEditChildItemDialogOpen}
        onOpenChange={setIsEditChildItemDialogOpen}
        onSubmit={handleChildItemDialogSubmit}
        isSubmitting={false}
        dialogTitle={dynamicChildDialogTitle}
        defaultTitle={defaultChildDialogTitle}
        defaultDescription={defaultChildDialogDescription}
      />

      <Sheet open={isVersionHistorySheetOpen} onOpenChange={setIsVersionHistorySheetOpen}>
        <SheetContent className="sm:max-w-[500px]" side="left">
          <SheetHeader>
            <SheetTitle>Plan Version History</SheetTitle>
            <SheetDescription>View and restore previous versions of your plan.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="divide-y">
              {augmentedPlanVersions.map((version, index) => {
                const previousVersionInHistory = augmentedPlanVersions[index + 1] || null;
                const isCurrentlyViewingThisDiff = diffDetailsVersionId === version.id && !!diffTarget;

                return (
                  <div key={version.id} className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">{version.name || `Version from ${format(version.createdAt, 'MMM d, yyyy h:mm a')}`}</h3>
                        <p className="text-xs text-muted-foreground">
                          Created: {format(version.createdAt, 'MMM d, yyyy h:mm a')}.
                          {version.description && (<><br />Note: {version.description}</>)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="secondary" size="sm" onClick={() => handleViewChangesClick(version, previousVersionInHistory)}>
                          {isCurrentlyViewingThisDiff ? (<XCircle className="mr-2 h-4 w-4" />) : (<Eye className="mr-2 h-4 w-4" />)}
                          {isCurrentlyViewingThisDiff ? "Hide Changes" : "View Changes"}
                        </Button>
                        {canEditPlan && (
                          <Button variant="ghost" size="sm" onClick={() => handleRestoreVersion(version)} disabled={isCurrentlyViewingThisDiff}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center space-x-2 text-xs text-muted-foreground">
                      {version.addedNodesCount > 0 && (
                        <Badge variant="outline">
                          <Plus className="mr-1 h-3 w-3" />
                          {version.addedNodesCount} nodes
                        </Badge>
                      )}
                      {version.removedNodesCount > 0 && (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" />
                          {version.removedNodesCount} nodes
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Restore</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to restore this version? This will overwrite your current plan state.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsRestoreConfirmOpen(false); setVersionToRestore(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {diffTarget && (
        <div className="fixed bottom-0 left-0 w-full bg-secondary/80 backdrop-blur-sm text-secondary-foreground p-4 border-t z-50">
          <div className="container flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Viewing Changes:{" "}
                <span className="font-normal">
                  {diffTarget.current.name || `Version from ${format(diffTarget.current.createdAt, "MMM d, yyyy h:mm a")}`}
                </span>
              </h2>
              {removedNodeTitles.length > 0 && (
                <p className="text-xs">
                  <XCircle className="inline-block h-3 w-3 mr-1 align-text-bottom" />
                  Removed: {removedNodeTitles.join(", ")}
                </p>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={handleExitDiffView}>
              <XCircle className="mr-2 h-4 w-4" />
              Exit Diff View
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
