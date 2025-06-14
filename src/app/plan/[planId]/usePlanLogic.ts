// src/app/plan/[planId]/usePlanLogic.ts
"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getPlanById, updatePlanDetails, getPlanVersions, restorePlanToVersion } from '@/services/planService';
import type { ClientPlan, RoadmapStep, ChildDataItem, PeerConnection, UpdatePlanData, ClientPlanVersion, PlanVersionData, PlanVisibility, PlanEditability } from '@/types/plan';
import { fetchUserProfileBasic, getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { v4 as uuidv4 } from 'uuid';
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import { serverTimestamp } from 'firebase/firestore';


const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const DEFAULT_SPACING_X = 80;
const DEFAULT_SPACING_Y = 40;
const NODE_BASE_MIN_HEIGHT = 80;
const CHILD_ITEM_HEIGHT = 28;
const NODE_HEADER_HEIGHT = 40;

export const sanitizeRoadmapStep = (step: Partial<RoadmapStep>, defaultParentId?: string): RoadmapStep => {
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
};

export const usePlanLogic = () => {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const planId = params?.planId as string | undefined;

  const [forceRenderFlag, setForceRenderFlag] = useState(0);
  const forceRender = useCallback(() => setForceRenderFlag(f => f + 1), []);

  const [editableRoadmap, setEditableRoadmap] = useState<RoadmapStep[]>([]);
  const [editingTarget, setEditingTarget] = useState<{ type: 'node', data: RoadmapStep } | { type: 'childItem', data: ChildDataItem, parentNode: RoadmapStep } | null>(null);
  const [isStepDetailSheetOpen, setIsStepDetailSheetOpen] = useState(false);
  const initialPanelDataRef = useRef<{ title: string; description: string } | null>(null);
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
  const childItemManagementContextRef = useRef<{ operation: 'createGrandchild'; targetChildToBecomeParentId: string; currentParentOfTargetChildId: string; } | { operation: 'createChild'; targetParentNodeId: string; } | { operation: 'edit'; itemToEditId: string; parentNodeId: string; } | null>(null);
  const [isEditChildItemDialogOpen, setIsEditChildItemDialogOpen] = useState(false);
  const [isChildItemDialogSubmitting, setIsChildItemDialogSubmitting] = useState(false); // Added this state
  const [dynamicChildDialogTitle, setDynamicChildDialogTitle] = useState("Manage Item");
  const [defaultChildDialogTitle, setDefaultChildDialogTitle] = useState("");
  const [defaultChildDialogDescription, setDefaultChildDialogDescription] = useState("");
  const [diffTarget, setDiffTarget] = useState<{ current: ClientPlanVersion; previous: ClientPlanVersion | null } | null>(null);
  const [addedNodeIds, setAddedNodeIds] = useState<Set<string>>(new Set());
  const [persistedNodeIds, setPersistedNodeIds] = useState<Set<string>>(new Set());
  const [removedNodeTitles, setRemovedNodeTitles] = useState<string[]>([]);
  const [diffDetailsVersionId, setDiffDetailsVersionId] = useState<string | null>(null);
  
  const [planDataForDialog, setPlanDataForDialog] = useState<ClientPlan | null>(null);
  const [isPlanInfoDialogOpen, setIsPlanInfoDialogOpen] = useState(false);
  const [originalEditingChildItemData, setOriginalEditingChildItemData] = useState<ChildDataItem | null>(null);
  
  const [viewPermissionsSearch, setViewPermissionsSearch] = useState('');
  const [debouncedViewPermissionsSearch, setDebouncedViewPermissionsSearch] = useState('');
  const [editPermissionsSearch, setEditPermissionsSearch] = useState('');
  const [debouncedEditPermissionsSearch, setDebouncedEditPermissionsSearch] = useState('');

  const isValidPlanId = useMemo(() => !!planId && (IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20), [planId]);

  const { data: planData, isLoading: isLoadingPlan, error: planError, refetch: refetchPlanData } = useQuery<ClientPlan | null>({
    queryKey: ['plan', planId],
    queryFn: async () => {
      if (planId && isValidPlanId) {
        const result = await getPlanById(planId);
        return result;
      }
      return null;
    },
    enabled: !!planId && isValidPlanId && !authLoading,
    onSuccess: (data) => {
      if (data) {
        setEditableRoadmap((data.roadmap || []).map(s => sanitizeRoadmapStep(s)));
      } else {
        setEditableRoadmap([]);
      }
    },
    onError: (error) => {
        setPlanDataForDialog(null);
        setEditableRoadmap([]);
    }
  });

  useEffect(() => {
    if (planData) {
      try {
        const deepCopiedData = JSON.parse(JSON.stringify(planData));
        setPlanDataForDialog(deepCopiedData);
      } catch (e) {
        console.error("[usePlanLogic] useEffect for planData change: FAILED to deep copy planData for dialog:", e);
        setPlanDataForDialog(null);
      }
    } else if (!isLoadingPlan && planId && isValidPlanId) {
      setPlanDataForDialog(null);
    }
  }, [planData, isLoadingPlan, planId, isValidPlanId]);


  useEffect(() => {
    const viewTimer = setTimeout(() => setDebouncedViewPermissionsSearch(viewPermissionsSearch), 300);
    const editTimer = setTimeout(() => setDebouncedEditPermissionsSearch(editPermissionsSearch), 300);
    return () => { clearTimeout(viewTimer); clearTimeout(editTimer); };
  }, [viewPermissionsSearch, editPermissionsSearch]);

  const { data: viewPermissionSuggestions = [] } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForPlanPermissions', 'view', debouncedViewPermissionsSearch, user?.uid],
    queryFn: () => user ? getSuggestibleUsers(debouncedViewPermissionsSearch, 5) : Promise.resolve([]),
    enabled: !!user && isPlanInfoDialogOpen && !!debouncedViewPermissionsSearch.trim(),
  });

  const { data: editPermissionSuggestions = [] } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForPlanPermissions', 'edit', debouncedEditPermissionsSearch, user?.uid],
    queryFn: () => user ? getSuggestibleUsers(debouncedEditPermissionsSearch, 5) : Promise.resolve([]),
    enabled: !!user && isPlanInfoDialogOpen && !!debouncedEditPermissionsSearch.trim(),
  });

  const { data: ownerProfile, isLoading: isLoadingOwnerProfile } = useQuery<UserProfileBasic | null>({
    queryKey: ['userProfileBasic', planData?.ownerId, 'planOwner'],
    queryFn: () => planData?.ownerId ? fetchUserProfileBasic(planData.ownerId) : Promise.resolve(null),
    enabled: !!planData?.ownerId,
  });

  const { data: planVersionsData = [], isLoading: isLoadingVersions, refetch: refetchPlanVersions } = useQuery<ClientPlanVersion[]>({
    queryKey: ['planVersions', planId],
    queryFn: () => (planId && isValidPlanId ? getPlanVersions(planId) : Promise.resolve([])),
    enabled: isVersionHistorySheetOpen && !!planId && isValidPlanId,
  });

  const savePlanSettingsMutation = useMutation({
    mutationFn: (payload: { planId: string; currentUserId: string; updates: UpdatePlanData }) =>
      updatePlanDetails(payload.planId, payload.currentUserId, payload.updates),
    onSuccess: async (_, variables) => {
      toast({ title: "Plan Settings Saved", description: "Your plan settings have been updated." });
      if (variables.planId) {
         await refetchPlanData();
      }
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save plan settings." })
  });

  const saveRoadmapMutation = useMutation({
    mutationFn: (payload: { planId: string; currentUserId: string; roadmapToSave: RoadmapStep[] }) =>
      updatePlanDetails(payload.planId, payload.currentUserId, { roadmap: payload.roadmapToSave, updatedAt: serverTimestamp() as any }),
    onSuccess: async (_, variables) => {
      toast({ title: "Plan State Saved", description: "The current plan state has been saved." });
      if (variables.planId) {
        await refetchPlanData();
        await refetchPlanVersions();
      }
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save plan." })
  });

  const restorePlanMutation = useMutation({
    mutationFn: (payload: { planId: string; versionIdToRestore: string; currentUserId: string; }) =>
      restorePlanToVersion(payload.planId, payload.versionIdToRestore, payload.currentUserId),
    onSuccess: async (_, variables) => {
      toast({ title: "Plan Restored", description: "The plan has been restored." });
      await refetchPlanData();
      await refetchPlanVersions();
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
    }
  }, [planData, diffTarget]);

  const canEditPlan = useMemo(() => {
    if (!user || !planData) return false;
    if (planData.ownerId === user.uid) return true;
    if (planData.editability === 'collaborators' && (planData.editUserIds || []).includes(user.uid)) return true;
    return false;
  }, [user, planData]);

  const getPointerCoords = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } => {
    if ('touches' in event && event.touches.length > 0) return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    if ('changedTouches' in event && event.changedTouches.length > 0) return { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY };
    return { clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY };
  }, []);

  const handleEditCanvasNode = useCallback((nodeToEdit: RoadmapStep) => {
    if (diffTarget) return;
    console.log(`[usePlanLogic] handleEditCanvasNode CALLED for node: ${nodeToEdit.id} "${nodeToEdit.title}"`);
    setEditingTarget({ type: 'node', data: { ...nodeToEdit } });
    initialPanelDataRef.current = { title: nodeToEdit.title, description: nodeToEdit.description || '' };
    setIsStepDetailSheetOpen(true);
    childItemManagementContextRef.current = null;
    setDefaultChildDialogTitle("");
    setDefaultChildDialogDescription("");
    setOriginalEditingChildItemData(null);
  }, [diffTarget, setEditingTarget, setIsStepDetailSheetOpen, setOriginalEditingChildItemData]);

  const handleChildItemCanvasNodeFocus = useCallback((childItemId: string, parentCanvasNodeId: string) => {
    if (diffTarget) return;
    console.log(`[usePlanLogic] handleChildItemCanvasNodeFocus CALLED for childItem: ${childItemId} in parent: ${parentCanvasNodeId}`);
    const parentNode = editableRoadmap.find(n => n.id === parentCanvasNodeId);
    if (!parentNode) {
      console.warn(`[usePlanLogic] handleChildItemCanvasNodeFocus: Parent node with ID ${parentCanvasNodeId} not found in editableRoadmap. Panel will not open for this child item focus.`);
      return; 
    }
    const childItem = parentNode.childrenData.find(ci => ci.id === childItemId);
    if (!childItem) {
      console.warn(`[usePlanLogic] handleChildItemCanvasNodeFocus: Child item ${childItemId} not found in parent ${parentCanvasNodeId}.`);
      return;
    }
    
    console.log(`[usePlanLogic] handleChildItemCanvasNodeFocus: Setting editingTarget for childItem: ${childItem.id} "${childItem.title}" in parent: ${parentNode.id}`);
    setEditingTarget({ type: 'childItem', data: { ...childItem }, parentNode: { ...parentNode } });
    if (childItem.canvasNodeIdForThisItem) {
      const spawnedNode = editableRoadmap.find(node => node.id === childItem.canvasNodeIdForThisItem);
      initialPanelDataRef.current = { title: spawnedNode?.title || childItem.title, description: spawnedNode?.description || childItem.description || '' };
    } else {
      initialPanelDataRef.current = { title: childItem.title, description: childItem.description || '' };
    }
    setOriginalEditingChildItemData(JSON.parse(JSON.stringify(childItem)));
    setIsStepDetailSheetOpen(true);
  }, [editableRoadmap, diffTarget, setEditingTarget, setIsStepDetailSheetOpen, setOriginalEditingChildItemData]);


  const handleNodeDetailUpdate = useCallback((updatedStep: RoadmapStep) => {
    if (!canEditPlan || diffTarget) return;
    setEditableRoadmap(prev => prev.map(s => s.id === updatedStep.id ? { ...s, ...updatedStep, childrenData: updatedStep.childrenData || (s.childrenData || []) } : s ));
  }, [canEditPlan, diffTarget]);

  const handleChildItemDetailUpdateInPanel = useCallback((updatedChildItem: ChildDataItem, parentNodeId: string) => {
    if (!canEditPlan || diffTarget) return;
    setEditableRoadmap(prev => prev.map(parentNode => parentNode.id === parentNodeId ? { ...parentNode, childrenData: parentNode.childrenData.map(ci => ci.id === updatedChildItem.id ? updatedChildItem : ci) } : parentNode ));
    if (updatedChildItem.canvasNodeIdForThisItem) {
      setEditableRoadmap(prev => prev.map(node => 
        node.id === updatedChildItem.canvasNodeIdForThisItem 
        ? { ...node, title: updatedChildItem.title, description: updatedChildItem.description } 
        : node
      ));
    }
  }, [canEditPlan, diffTarget]);

  const handleInitiateAddNode = useCallback((sourceNodeId: string | null, initiatingDot?: 'N' | 'E' | 'S') => {
    if (!canEditPlan || diffTarget) return;
    setTargetParentIdForDialog(sourceNodeId);
    setInitiatingDotTypeForDialog(initiatingDot || null);
    setIsAddNodeDialogOpen(true);
  }, [canEditPlan, diffTarget]);

  const handleAddNode = useCallback((data: { title: string }, canvasRefCurrent: HTMLDivElement | null) => {
    if (!canEditPlan || !canvasRefCurrent || diffTarget) return;
    const newId = `step-${Date.now()}-${uuidv4().substring(0, 8)}`;
    let newStepX, newStepY;
    const sourceNodeForPeerLink = targetParentIdForDialog ? editableRoadmap.find(s => s.id === targetParentIdForDialog) : null;

    if (sourceNodeForPeerLink && initiatingDotTypeForDialog) {
      const sourceHeight = NODE_BASE_MIN_HEIGHT;
      switch (initiatingDotTypeForDialog) {
        case 'N': newStepX = sourceNodeForPeerLink.x; newStepY = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.y - NODE_BASE_MIN_HEIGHT - DEFAULT_SPACING_Y); break;
        case 'E': newStepX = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.x + NODE_BASE_WIDTH + DEFAULT_SPACING_X); newStepY = sourceNodeForPeerLink.y; break;
        case 'S': newStepY = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.y + sourceHeight + DEFAULT_SPACING_Y); newStepX = sourceNodeForPeerLink.x; break;
        default:
          newStepX = Math.max(MIN_CANVAS_PADDING, canvasRefCurrent.scrollLeft + canvasRefCurrent.clientWidth / 2 - NODE_BASE_WIDTH / 2);
          newStepY = Math.max(MIN_CANVAS_PADDING, canvasRefCurrent.scrollTop + canvasRefCurrent.clientHeight / 2 - NODE_BASE_MIN_HEIGHT / 2);
      }
    } else {
      newStepX = Math.max(MIN_CANVAS_PADDING, canvasRefCurrent.scrollLeft + canvasRefCurrent.clientWidth / 2 - NODE_BASE_WIDTH / 2);
      newStepY = Math.max(MIN_CANVAS_PADDING, canvasRefCurrent.scrollTop + canvasRefCurrent.clientHeight / 2 - NODE_BASE_MIN_HEIGHT / 2);
    }

    const newNode: RoadmapStep = sanitizeRoadmapStep({ id: newId, title: data.title, x: newStepX, y: newStepY });
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
    console.log(`[SpawnNode] Attempting to spawn child ${childItemId} from parent ${parentCanvasNodeIdOfChildItem}.`);
    let newRoadmapCandidate = JSON.parse(JSON.stringify(currentRoadmap)); 
    const parentNodeIndex = newRoadmapCandidate.findIndex((s: RoadmapStep) => s.id === parentCanvasNodeIdOfChildItem);

    if (parentNodeIndex === -1) {
      console.error(`[SpawnNode] Parent node ${parentCanvasNodeIdOfChildItem} not found.`);
      toast({ variant: "destructive", title: "Error Spawning Node", description: `Parent node not found.` });
      return { updatedRoadmap: currentRoadmap, spawnedNodeId: null };
    }

    const parentNode: RoadmapStep = newRoadmapCandidate[parentNodeIndex];
    const childItemIndex = (parentNode.childrenData || []).findIndex((ci: ChildDataItem) => ci.id === childItemId);

    if (childItemIndex === -1) {
      console.error(`[SpawnNode] Child item ${childItemId} not found in parent ${parentCanvasNodeIdOfChildItem}.`);
      toast({ variant: "destructive", title: "Error Spawning Node", description: `Child item not found in parent.` });
      return { updatedRoadmap: currentRoadmap, spawnedNodeId: null };
    }

    const childItem: ChildDataItem = parentNode.childrenData[childItemIndex];

    if (childItem.canvasNodeIdForThisItem && newRoadmapCandidate.some((n: RoadmapStep) => n.id === childItem.canvasNodeIdForThisItem)) {
      console.log(`[SpawnNode] Child item ${childItemId} already spawned as node ${childItem.canvasNodeIdForThisItem}. Returning existing ID.`);
      return { updatedRoadmap: currentRoadmap, spawnedNodeId: childItem.canvasNodeIdForThisItem };
    }

    const newSpawnedNodeId = `canvasnode-${childItem.id}-${uuidv4().substring(0, 4)}`;
    const newSpawnedNode: RoadmapStep = sanitizeRoadmapStep({
      id: newSpawnedNodeId,
      title: childItem.title,
      description: childItem.description,
      x: Math.max(MIN_CANVAS_PADDING, parentNode.x - NODE_BASE_WIDTH - DEFAULT_SPACING_X),
      y: Math.max(MIN_CANVAS_PADDING, parentNode.y + (childItemIndex * (CHILD_ITEM_HEIGHT * 0.5))),
      childrenData: [], peerConnections: [],
    });
    
    newRoadmapCandidate[parentNodeIndex].childrenData[childItemIndex] = { ...childItem, canvasNodeIdForThisItem: newSpawnedNodeId };
    newRoadmapCandidate.push(newSpawnedNode);

    console.log(`[SpawnNode] Spawned child ${childItemId} as new node ${newSpawnedNodeId}. New node ID: ${newSpawnedNode.id}`);
    const foundInReturned = newRoadmapCandidate.find((n: RoadmapStep) => n.id === newSpawnedNodeId);
    console.log(`[SpawnNode] Does new roadmap candidate include ${newSpawnedNodeId}? ${!!foundInReturned}. All IDs:`, newRoadmapCandidate.map((n: RoadmapStep) => n.id));
    console.log(`[SpawnNode] Returning newRoadmapCandidate with length: ${newRoadmapCandidate.length}`);
    return { updatedRoadmap: newRoadmapCandidate, spawnedNodeId: newSpawnedNodeId };
  }, [toast]);

  const handleAddChildItemToNode = useCallback((parentNodeId: string) => {
    if (!canEditPlan || diffTarget) return;
    const parentNode = editableRoadmap.find(n => n.id === parentNodeId);
    if (!parentNode) { toast({ variant: "destructive", title: "Error", description: "Parent node not found." }); return; }
    childItemManagementContextRef.current = { operation: 'createChild', targetParentNodeId: parentNodeId };
    setDynamicChildDialogTitle(`Add Item to Step: "${parentNode.title}"`);
    setDefaultChildDialogTitle(""); setDefaultChildDialogDescription("");
    setIsEditChildItemDialogOpen(true);
  }, [canEditPlan, editableRoadmap, toast, diffTarget]);

  const handleAddGrandchildToChildDataItem = useCallback((clickedChildItemId: string, parentCanvasNodeIdOfClickedItem: string) => {
    if (!canEditPlan || diffTarget) return;
    const parentNode = editableRoadmap.find(n => n.id === parentCanvasNodeIdOfClickedItem);
    const childItemWhoseDotWasClicked = parentNode?.childrenData.find(ci => ci.id === clickedChildItemId);
    if (!childItemWhoseDotWasClicked) { toast({ variant: "destructive", title: "Error", description: "Originating child item not found." }); return; }
    childItemManagementContextRef.current = { operation: 'createGrandchild', targetChildToBecomeParentId: clickedChildItemId, currentParentOfTargetChildId: parentCanvasNodeIdOfClickedItem };
    setDynamicChildDialogTitle(`Add Item to "${childItemWhoseDotWasClicked.title}"`);
    setDefaultChildDialogTitle(""); setDefaultChildDialogDescription("");
    setIsEditChildItemDialogOpen(true);
  }, [canEditPlan, editableRoadmap, toast, diffTarget]);

  const handleChildItemDialogSubmit = useCallback((data: { title: string; description?: string }) => {
      setIsChildItemDialogSubmitting(true);
      if (!childItemManagementContextRef.current || !canEditPlan || diffTarget) {
        toast({ variant: "warning", title: "Action Blocked", description: "Cannot process item action." });
        setIsChildItemDialogSubmitting(false);
        return;
      }
      
      let newRoadmapCandidate = JSON.parse(JSON.stringify(editableRoadmap));
      let modificationSuccessful = false;
      const context = childItemManagementContextRef.current;

      console.log("[Submit] Initial roadmap candidate length:", newRoadmapCandidate.length, "Context operation:", context.operation);

      try {
        if (context.operation === 'createGrandchild') {
          console.log("[Submit] Create Grandchild: Context", context);
          const spawnResult = handleSpawnChildDataItemAsCanvasNode(newRoadmapCandidate, context.targetChildToBecomeParentId, context.currentParentOfTargetChildId);
          console.log("[Submit] Create Grandchild: spawnResult:", { spawnedNodeId: spawnResult.spawnedNodeId, updatedRoadmapLength: spawnResult.updatedRoadmap?.length });

          if (spawnResult.spawnedNodeId && spawnResult.updatedRoadmap) {
            newRoadmapCandidate = spawnResult.updatedRoadmap;
            console.log("[Submit] Create Grandchild: Roadmap updated from spawn. Spawned Node ID:", spawnResult.spawnedNodeId);
            const spawnedNodeAsParentIndex = newRoadmapCandidate.findIndex((node: RoadmapStep) => node.id === spawnResult.spawnedNodeId);
            console.log("[Submit] Create Grandchild: Index of spawned node in newRoadmapCandidate:", spawnedNodeAsParentIndex, "Searching for ID:", spawnResult.spawnedNodeId);
            console.log("[Submit] Create Grandchild: All IDs in newRoadmapCandidate after spawn:", newRoadmapCandidate.map((n: RoadmapStep) => n.id));

            if (spawnedNodeAsParentIndex > -1) {
              const newGrandchildItem: ChildDataItem = {
                id: `childitem-${Date.now()}-${uuidv4().substring(0, 8)}`,
                title: data.title, description: data.description || null,
                parentCanvasNodeId: spawnResult.spawnedNodeId,
                canvasNodeIdForThisItem: null,
              };
              const parentNodeToUpdate: RoadmapStep = newRoadmapCandidate[spawnedNodeAsParentIndex];
              parentNodeToUpdate.childrenData = [...(parentNodeToUpdate.childrenData || []), newGrandchildItem];
              newRoadmapCandidate[spawnedNodeAsParentIndex] = parentNodeToUpdate;
              modificationSuccessful = true;
            } else {
              console.error("Error in 'createGrandchild': Spawned node NOT FOUND in newRoadmapCandidate. Spawned ID was:", spawnResult.spawnedNodeId);
              toast({ variant: "destructive", title: "Action Failed", description: "Error locating newly created step for grandchild." });
            }
          } else {
            console.error("Error in 'createGrandchild': Spawning child as node failed. Spawn Result:", spawnResult);
            toast({ variant: "destructive", title: "Action Failed", description: "Could not prepare parent step for new item." });
          }
        } else if (context.operation === 'createChild') {
          const parentIdx = newRoadmapCandidate.findIndex((node: RoadmapStep) => node.id === context.targetParentNodeId);
          if (parentIdx > -1) {
            const newChildItem: ChildDataItem = {
              id: `childitem-${Date.now()}-${uuidv4().substring(0, 8)}`,
              title: data.title, description: data.description || null,
              parentCanvasNodeId: context.targetParentNodeId,
              canvasNodeIdForThisItem: null,
            };
            const parentNodeToUpdate: RoadmapStep = newRoadmapCandidate[parentIdx];
            parentNodeToUpdate.childrenData = [...(parentNodeToUpdate.childrenData || []), newChildItem];
            newRoadmapCandidate[parentIdx] = parentNodeToUpdate;
            modificationSuccessful = true;
          } else {
            toast({ variant: "destructive", title: "Action Failed", description: "Parent node not found for new item."});
          }
        } else if (context.operation === 'edit') {
          const parentIdx = newRoadmapCandidate.findIndex((node: RoadmapStep) => node.id === context.parentNodeId);
          if (parentIdx > -1) {
            let itemThatWasEdited: ChildDataItem | undefined;
            const parentNodeToUpdate: RoadmapStep = newRoadmapCandidate[parentIdx];
            parentNodeToUpdate.childrenData = parentNodeToUpdate.childrenData.map((item: ChildDataItem) =>
              item.id === context.itemToEditId ? (itemThatWasEdited = { ...item, title: data.title, description: data.description || null }) : item
            );
            if (itemThatWasEdited) {
              newRoadmapCandidate[parentIdx] = parentNodeToUpdate;
              if (itemThatWasEdited.canvasNodeIdForThisItem) {
                const canvasNodeIdx = newRoadmapCandidate.findIndex((node: RoadmapStep) => node.id === itemThatWasEdited!.canvasNodeIdForThisItem);
                if (canvasNodeIdx > -1) {
                  newRoadmapCandidate[canvasNodeIdx] = { ...newRoadmapCandidate[canvasNodeIdx], title: data.title, description: data.description || null };
                }
              }
              modificationSuccessful = true;
            } else {
              toast({ variant: "destructive", title: "Action Failed", description: "Child item to edit not found."});
            }
          } else {
            toast({ variant: "destructive", title: "Action Failed", description: "Parent node for item to edit not found."});
          }
        }

        if (modificationSuccessful) {
          setEditableRoadmap(newRoadmapCandidate); 
          toast({ title: "Item Action Complete", description: "Remember to save the plan changes." });
          setIsEditChildItemDialogOpen(false);
          childItemManagementContextRef.current = null;
        } else {
          console.log("[Submit] modificationSuccessful remained false. Operation:", context.operation);
          toast({ variant: "destructive", title: "Action Failed", description: "Could not process item action. Check console for details." });
        }
      } catch (error) {
        console.error("Error submitting child item form (outer catch):", error);
        toast({ variant: "destructive", title: "Submission Error", description: "Could not save item due to an unexpected error." });
      } finally {
        setIsChildItemDialogSubmitting(false);
      }
  }, [canEditPlan, diffTarget, toast, handleSpawnChildDataItemAsCanvasNode, editableRoadmap]);


  const handleEditChildItemText = useCallback((childItem: ChildDataItem, parentNodeIdOfChildItem: string) => {
    if (!canEditPlan || diffTarget) return;
    const parentNode = editableRoadmap.find(n => n.id === parentNodeIdOfChildItem);
    if (!parentNode) { toast({ variant: "destructive", title: "Error", description: "Parent node not found." }); return; }
    
    childItemManagementContextRef.current = { operation: 'edit', itemToEditId: childItem.id, parentNodeId: parentNodeIdOfChildItem };
    
    setDynamicChildDialogTitle(`Edit Item: "${childItem.title}"`);
    setDefaultChildDialogTitle(childItem.title);
    setDefaultChildDialogDescription(childItem.description || "");
    setOriginalEditingChildItemData(JSON.parse(JSON.stringify(childItem)));
    setIsEditChildItemDialogOpen(true);

  }, [canEditPlan, diffTarget, editableRoadmap, toast]);

  const handleDeleteChildItem = useCallback((childItemIdToDelete: string, parentCanvasNodeIdOfItem: string) => {
    if (!canEditPlan || diffTarget) return;
    setEditableRoadmap(prev => {
        let canvasNodeIdThatWasRepresentedByDeletedItem: string | null = null;
        let updatedRoadmap = prev.map(parentNode => {
            if (parentNode.id === parentCanvasNodeIdOfItem) {
                const childItemToRemove = (parentNode.childrenData || []).find(ci => ci.id === childItemIdToDelete);
                canvasNodeIdThatWasRepresentedByDeletedItem = childItemToRemove?.canvasNodeIdForThisItem || null;
                return { ...parentNode, childrenData: (parentNode.childrenData || []).filter(ci => ci.id !== childItemIdToDelete) };
            }
            return parentNode;
        });
        if (canvasNodeIdThatWasRepresentedByDeletedItem) {
            updatedRoadmap = updatedRoadmap.filter(node => node.id !== canvasNodeIdThatWasRepresentedByDeletedItem);
            updatedRoadmap = updatedRoadmap.map(rn => ({ ...rn, peerConnections: (rn.peerConnections || []).filter(pc => pc.targetNodeId !== canvasNodeIdThatWasRepresentedByDeletedItem) }));
        }
        if (editingTarget?.type === 'childItem' && editingTarget.data.id === childItemIdToDelete) {
          const parentNodeAfterDelete = updatedRoadmap.find(n => n.id === parentCanvasNodeIdOfItem);
          if (parentNodeAfterDelete) setEditingTarget({type: 'node', data: parentNodeAfterDelete});
          else {setIsStepDetailSheetOpen(false); setEditingTarget(null);}
        } else if (editingTarget?.type === 'node' && editingTarget.data.id === canvasNodeIdThatWasRepresentedByDeletedItem) {
          setIsStepDetailSheetOpen(false); setEditingTarget(null);
        }
        return updatedRoadmap;
    });
    toast({ title: "Item Removed", description: "Remember to save the plan." });
  }, [canEditPlan, toast, editingTarget, diffTarget]);

  const confirmDeleteNode = useCallback(() => {
    if (!nodeToDelete || !canEditPlan || diffTarget) return;
    const idToDelete = nodeToDelete.id;
    setEditableRoadmap(prev => prev.filter(s => s.id !== idToDelete).map(rn => ({ ...rn, childrenData: (rn.childrenData || []).map(ci => ci.canvasNodeIdForThisItem === idToDelete ? { ...ci, canvasNodeIdForThisItem: null } : ci), peerConnections: (rn.peerConnections || []).filter(pc => pc.targetNodeId !== idToDelete) })));
    if (editingTarget?.type === 'node' && editingTarget.data.id === idToDelete) { setIsStepDetailSheetOpen(false); setEditingTarget(null); }
    toast({ title: `Node "${nodeToDelete.title}" Deleted`, description: "Remember to save." });
    setNodeToDelete(null);
  }, [nodeToDelete, canEditPlan, toast, editingTarget, diffTarget]);

  const saveRoadmapChanges = useCallback(async () => {
    if (!planData || !user || !planId || !canEditPlan || diffTarget) { toast({ variant: "destructive", title: "Error", description: "Cannot save." }); return; }
    saveRoadmapMutation.mutate({ planId, currentUserId: user.uid, roadmapToSave: editableRoadmap });
  }, [planData, user, planId, canEditPlan, editableRoadmap, saveRoadmapMutation, toast, diffTarget]);

  const handleSavePlanSettings = useCallback((settings: {
    name: string;
    description: string;
    visibility: PlanVisibility;
    editability: PlanEditability;
    viewUserIds: string[];
    editUserIds: string[];
  }) => {
    if (!planDataForDialog || !user || !planId || !canEditPlan) {
      toast({ variant: "destructive", title: "Error", description: "Cannot save settings. Plan data missing or permissions issue." });
      return;
    }
    const updates: UpdatePlanData = {
        updatedAt: serverTimestamp() as any,
        name: settings.name,
        description: settings.description,
        visibility: settings.visibility,
        editability: settings.editability,
        viewUserIds: settings.viewUserIds,
        editUserIds: settings.editUserIds,
    };

    setPlanDataForDialog(prev => prev ? ({ 
      ...prev,
      name: settings.name,
      description: settings.description,
      visibility: settings.visibility,
      editability: settings.editability,
      viewUserIds: Array.from(new Set([prev.ownerId, ...settings.viewUserIds])),
      editUserIds: Array.from(new Set([prev.ownerId, ...settings.editUserIds])),
    }) : null);
    savePlanSettingsMutation.mutate({ planId, currentUserId: user.uid, updates });
  }, [planDataForDialog, user, planId, canEditPlan, savePlanSettingsMutation, toast]);

  const handleAddUserToViewers = useCallback((userProfile: UserProfileBasic) => {
    if (planDataForDialog && userProfile.userId !== planDataForDialog.ownerId) {
      setPlanDataForDialog(prev => prev ? ({
        ...prev,
        viewUserIds: Array.from(new Set([...(prev.viewUserIds || []), userProfile.userId])),
      }) : null);
    }
  }, [planDataForDialog]);

  const handleRemoveUserFromViewers = useCallback((userIdToRemove: string) => {
    if (planDataForDialog && userIdToRemove !== planDataForDialog.ownerId) {
      setPlanDataForDialog(prev => prev ? ({
        ...prev,
        viewUserIds: (prev.viewUserIds || []).filter(uid => uid !== userIdToRemove),
        editUserIds: (prev.editUserIds || []).filter(uid => uid !== userIdToRemove), 
      }) : null);
    }
  }, [planDataForDialog]);

  const handleAddUserToEditors = useCallback((userProfile: UserProfileBasic) => {
    if (planDataForDialog && userProfile.userId !== planDataForDialog.ownerId) {
      setPlanDataForDialog(prev => prev ? ({
        ...prev,
        editUserIds: Array.from(new Set([...(prev.editUserIds || []), userProfile.userId])),
        viewUserIds: Array.from(new Set([...(prev.viewUserIds || []), userProfile.userId])), 
      }) : null);
    }
  }, [planDataForDialog]);

  const handleRemoveUserFromEditors = useCallback((userIdToRemove: string) => {
    if (planDataForDialog && userIdToRemove !== planDataForDialog.ownerId) {
      setPlanDataForDialog(prev => prev ? ({
        ...prev,
        editUserIds: (prev.editUserIds || []).filter(uid => uid !== userIdToRemove),
      }) : null);
    }
  }, [planDataForDialog]);


  const handleExitDiffView = useCallback(() => {
      setDiffTarget(null);
      setDiffDetailsVersionId(null);
      if (planData) {
        setEditableRoadmap((planData.roadmap || []).map(s => sanitizeRoadmapStep(s)));
      }
  }, [planData]);

  const handleViewChangesClick = useCallback((versionToView: ClientPlanVersion, previousVersionInHistory: ClientPlanVersion | null) => {
      if (!planData) return;
      const isCurrentlyViewingThisDiff = diffDetailsVersionId === versionToView.id && !!diffTarget;
      if (isCurrentlyViewingThisDiff) {
        handleExitDiffView();
      } else {
        setDiffTarget({ current: versionToView, previous: previousVersionInHistory });
        setDiffDetailsVersionId(versionToView.id);
      }
  }, [planData, diffDetailsVersionId, diffTarget, handleExitDiffView]);

  const handleRestoreVersion = (version: ClientPlanVersion) => { setVersionToRestore(version); setIsRestoreConfirmOpen(true); };
  const confirmRestore = () => { if (!versionToRestore || !planId || !user) return; restorePlanMutation.mutate({ planId, versionIdToRestore: versionToRestore.id, currentUserId: user.uid }); };

  const handleNodeInteractionStart = useCallback((nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isDotDrag: boolean = false, dotType?: 'N' | 'E' | 'S') => {
      if (('button' in event && (event as React.MouseEvent).button !== 0) || !canEditPlan || diffTarget) return;
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
      forceRender();
    }, [canEditPlan, getPointerCoords, diffTarget, forceRender]);

  const handleGlobalMove = useCallback((event: MouseEvent | TouchEvent, canvasRefCurrent: HTMLDivElement | null) => {
      if (!isPointerDown || !canvasRefCurrent || diffTarget) return;
      const { clientX, clientY } = getPointerCoords(event);

      if (clickStartInfoRef.current && !isDraggingRef.current) {
          const deltaX = clientX - clickStartInfoRef.current.clientX;
          const deltaY = clientY - clickStartInfoRef.current.clientY;
          if ((deltaX * deltaX + deltaY * deltaY) > 25) isDraggingRef.current = true;
      }

      if (nodeDragInfoRef.current?.isDotDrag) {
          if (event.cancelable) event.preventDefault();
          const canvasRect = canvasRefCurrent.getBoundingClientRect();
          const currentX = clientX - canvasRect.left + canvasRefCurrent.scrollLeft;
          const currentY = clientY - canvasRect.top + canvasRefCurrent.scrollTop;
          const sourceNode = editableRoadmap.find(s => s.id === nodeDragInfoRef.current!.nodeId);
          if (!sourceNode) return;
          const sourceDotType = nodeDragInfoRef.current!.dotType;
          let startX: number, startY: number;
          const sourceNodeHeight = NODE_BASE_MIN_HEIGHT;
          switch(sourceDotType) {
              case 'N': startX = sourceNode.x + NODE_BASE_WIDTH / 2; startY = sourceNode.y; break;
              case 'E': startX = sourceNode.x + NODE_BASE_WIDTH; startY = sourceNode.y + sourceNodeHeight / 2; break;
              case 'S': startX = sourceNode.x + NODE_BASE_WIDTH / 2; startY = sourceNode.y + sourceNodeHeight; break;
              default: return;
          }
          let targetNodeIdUnderCursor: string | undefined = undefined;
          const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
          const targetNodeElement = elementsAtPoint.find(el => el.hasAttribute('data-node-id') && (el as HTMLElement).dataset.nodeId !== sourceNode.id);
          if (targetNodeElement) targetNodeIdUnderCursor = (targetNodeElement as HTMLElement).dataset.nodeId;
          activeConnectionLinePreviewRef.current = { path: `M ${startX} ${startY} L ${currentX} ${currentY}`, targetNodeId: targetNodeIdUnderCursor, sourceDotType };
      } else if (isDraggingRef.current && nodeDragInfoRef.current) {
          if (event.cancelable) event.preventDefault();
          const canvasRect = canvasRefCurrent.getBoundingClientRect();
          const currentX = clientX - canvasRect.left + canvasRefCurrent.scrollLeft;
          const currentY = clientY - canvasRect.top + canvasRefCurrent.scrollTop;
          const { nodeId, offsetX = 0, offsetY = 0 } = nodeDragInfoRef.current;
          let newX = Math.max(MIN_CANVAS_PADDING, currentX - offsetX);
          let newY = Math.max(MIN_CANVAS_PADDING, currentY - offsetY);
          setEditableRoadmap(prev => prev.map(step => step.id === nodeId ? { ...step, x: newX, y: newY } : step ));
      }
      forceRender();
  }, [isPointerDown, getPointerCoords, editableRoadmap, diffTarget, forceRender]);

  const handleGlobalPointerUp = useCallback((event: MouseEvent | TouchEvent) => {
      if (!isPointerDown || !nodeDragInfoRef.current || diffTarget) { setIsPointerDown(false); return; }
      const { nodeId: sourceNodeId, dotType: sourceDotType, isDotDrag } = nodeDragInfoRef.current;
      const clickInfo = clickStartInfoRef.current;
      const isConsideredDrag = isDraggingRef.current;

      if (isDotDrag && sourceDotType) {
          if (activeConnectionLinePreviewRef.current?.path) {
              const targetNodeIdUnderCursor = activeConnectionLinePreviewRef.current.targetNodeId;
              const dropTargetNode = targetNodeIdUnderCursor ? editableRoadmap.find(s => s.id === targetNodeIdUnderCursor) : undefined;
              if (dropTargetNode) {
                  if (dropTargetNode.id === sourceNodeId) toast({ variant: "destructive", title: "Invalid Connection", description: "Cannot connect a node to itself." });
                  else {
                      setEditableRoadmap(prev => {
                          const map = [...prev];
                          const sourceNodeIndex = map.findIndex(s => s.id === sourceNodeId);
                          if (sourceNodeIndex === -1) return prev;
                          const updatedSourceNode = { ...map[sourceNodeIndex] };
                          updatedSourceNode.peerConnections = updatedSourceNode.peerConnections || [];
                          let targetDotOnDropTarget: PeerConnection['targetDot'] = 'W';
                          if (sourceDotType === 'N') targetDotOnDropTarget = 'S';
                          else if (sourceDotType === 'S') targetDotOnDropTarget = 'N';
                          const alreadyConnected = updatedSourceNode.peerConnections.some(pc => pc.targetNodeId === dropTargetNode.id && pc.sourceDot === sourceDotType && pc.targetDot === targetDotOnDropTarget);
                          if (!alreadyConnected) {
                              updatedSourceNode.peerConnections.push({ targetNodeId: dropTargetNode.id, sourceDot: sourceDotType, targetDot: targetDotOnDropTarget });
                              map[sourceNodeIndex] = updatedSourceNode;
                              toast({ title: "Nodes Linked", description: `"${updatedSourceNode.title}" to "${dropTargetNode.title}".` });
                          } else toast({ title: "Already Linked" });
                          return map;
                      });
                  }
              } else handleInitiateAddNode(sourceNodeId, sourceDotType);
          } else if (!isConsideredDrag && clickInfo) handleInitiateAddNode(sourceNodeId, sourceDotType);
      } else if (!isConsideredDrag && clickInfo) {
          const finalCoords = getPointerCoords(event);
          const timeElapsed = Date.now() - clickInfo.timestamp;
          const deltaX = finalCoords.clientX - clickInfo.clientX;
          const deltaY = finalCoords.clientY - clickInfo.clientY;
          if ((deltaX * deltaX + deltaY * deltaY) < 25 && timeElapsed < 300) {
            if (clickInfo.targetElement && (clickInfo.targetElement as HTMLElement).closest('[data-node-id]') &&
               !(clickInfo.targetElement as HTMLElement).closest('[data-dot-type]') &&
               !(clickInfo.targetElement as HTMLElement).closest('[data-child-item-dot-id]') &&
               !(clickInfo.targetElement as HTMLElement).closest('[data-action-button="add-child"]')) {
              const clickedStep = editableRoadmap.find(s => s.id === sourceNodeId);
              if (clickedStep) {
                  console.log(`[usePlanLogic] handleGlobalPointerUp determined CLICK on node ${sourceNodeId}. Calling handleEditCanvasNode.`);
                  handleEditCanvasNode(clickedStep);
              }
            }
          }
      }
      activeConnectionLinePreviewRef.current = null;
      nodeDragInfoRef.current = null;
      clickStartInfoRef.current = null;
      isDraggingRef.current = false;
      setIsPointerDown(false);
      forceRender();
  }, [isPointerDown, getPointerCoords, editableRoadmap, toast, handleInitiateAddNode, handleEditCanvasNode, diffTarget, forceRender]);
  
  const onNodeDetailPanelSubmit = useCallback((data: { title: string; description?: string }) => {
    if (!editingTarget) return;

    if (editingTarget.type === 'node') {
      const updatedNode = { ...editingTarget.data, title: data.title, description: data.description || null };
      handleNodeDetailUpdate(updatedNode);
      toast({ title: "Step details updated", description: `"${data.title}" was updated.` });
    } else if (editingTarget.type === 'childItem' && editingTarget.data.canvasNodeIdForThisItem) {
      const updatedNodeRepresentation = { 
        id: editingTarget.data.canvasNodeIdForThisItem,
        title: data.title, 
        description: data.description || null,
        x: editableRoadmap.find(n=>n.id === editingTarget.data.canvasNodeIdForThisItem)?.x || 0,
        y: editableRoadmap.find(n=>n.id === editingTarget.data.canvasNodeIdForThisItem)?.y || 0,
        childrenData: editableRoadmap.find(n=>n.id === editingTarget.data.canvasNodeIdForThisItem)?.childrenData || [],
        peerConnections: editableRoadmap.find(n=>n.id === editingTarget.data.canvasNodeIdForThisItem)?.peerConnections || [],
      };
      handleNodeDetailUpdate(updatedNodeRepresentation as RoadmapStep); 
      handleChildItemDetailUpdateInPanel({ ...editingTarget.data, title: data.title, description: data.description || null }, editingTarget.parentNode.id); 
      toast({ title: "Item details updated", description: `"${data.title}" (spawned as node) was updated.` });
    } else if (editingTarget.type === 'childItem') {
        handleChildItemDetailUpdateInPanel({ ...editingTarget.data, title: data.title, description: data.description || null }, editingTarget.parentNode.id);
        toast({ title: "Child item details updated", description: `"${data.title}" was updated.`});
    }
  }, [editingTarget, handleNodeDetailUpdate, handleChildItemDetailUpdateInPanel, editableRoadmap, toast]);

  return {
    user, authLoading, planId, isValidPlanId,
    planData, isLoadingPlan, planError, ownerProfile, isLoadingOwnerProfile,
    editableRoadmap, setEditableRoadmap,
    editingTarget, setEditingTarget, isStepDetailSheetOpen, setIsStepDetailSheetOpen,
    initialPanelDataRef,
    onNodeDetailPanelSubmit,
    handleNodeDetailUpdate, handleChildItemDetailUpdateInPanel,
    nodeToDelete, setNodeToDelete, confirmDeleteNode,
    handleNodeInteractionStart, activeConnectionLinePreviewRef, nodeDragInfoRef, isDraggingRef,
    handleGlobalMove, handleGlobalPointerUp, isPointerDown,
    isVersionHistorySheetOpen, setIsVersionHistorySheetOpen, planVersionsData, isLoadingVersions, refetchPlanVersions,
    handleViewChangesClick, handleExitDiffView, diffTarget, addedNodeIds, persistedNodeIds, removedNodeTitles, diffDetailsVersionId,
    isRestoreConfirmOpen, setIsRestoreConfirmOpen, versionToRestore, handleRestoreVersion, confirmRestore, restorePlanMutation,
    isAddNodeDialogOpen, setIsAddNodeDialogOpen, targetParentIdForDialog, initiatingDotTypeForDialog, handleAddNode,
    childItemManagementContextRef, isEditChildItemDialogOpen, setIsEditChildItemDialogOpen, isChildItemDialogSubmitting, dynamicChildDialogTitle,
    defaultChildDialogTitle, setDefaultChildDialogTitle, defaultChildDialogDescription, setDefaultChildDialogDescription,
    handleChildItemDialogSubmit, handleEditChildItemText, handleDeleteChildItem,
    onAddGrandchildToChildDataItem: handleAddGrandchildToChildDataItem,
    onAddChildItemToNode: handleAddChildItemToNode,
    onChildItemTitleClick: handleChildItemCanvasNodeFocus,
    canEditPlan, saveRoadmapChanges, saveRoadmapMutation,
    savePlanSettingsMutation, handleSavePlanSettings,
    isPlanInfoDialogOpen, setIsPlanInfoDialogOpen,
    planDataForDialog,
    originalEditingChildItemData, setOriginalEditingChildItemData,
    viewPermissionsSearch, setViewPermissionsSearch, editPermissionsSearch, setEditPermissionsSearch,
    viewPermissionSuggestions, editPermissionSuggestions,
    handleAddUserToViewers, handleRemoveUserFromViewers, handleAddUserToEditors, handleRemoveUserFromEditors,
    forceRender,
    handleInitiateAddNode,
    setIsChildItemDialogSubmitting,
    handleEditCanvasNode, // Ensure this is returned
  };
};
    
    



    
