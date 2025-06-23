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
import { serverTimestamp, onSnapshot, doc, collection, where, query, Timestamp, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { FieldValue } from 'firebase/firestore';
import { generateAnonymousName } from '@/lib/pseudonymUtils';


const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const DEFAULT_SPACING_X = 80;
const DEFAULT_SPACING_Y = 40;
const NODE_BASE_MIN_HEIGHT = 80;
const CHILD_ITEM_HEIGHT = 28;
const NODE_HEADER_HEIGHT = 40;
const PLANS_COLLECTION = 'plans';
const CANVAS_WIDTH = 1600;

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

const calculateNodeHeight = (step: RoadmapStep, allSteps: RoadmapStep[]): number => {
    let height = NODE_HEADER_HEIGHT;
    let contentAreaHeight = 0;
    let childrenDataListHeight = 0;
    if (Array.isArray(step.childrenData) && step.childrenData.length > 0) {
      childrenDataListHeight += 8;
      childrenDataListHeight += step.childrenData.length * CHILD_ITEM_HEIGHT;
      childrenDataListHeight += 8;
    }
    contentAreaHeight = childrenDataListHeight;
    if (contentAreaHeight === 0 && (!step.description || step.description.trim().length === 0) && (!Array.isArray(step.childrenData) || step.childrenData.length === 0)) {
        contentAreaHeight = 20;
    }
    height += contentAreaHeight;
    height += 8; // FINAL_BUFFER_CARD_HEIGHT
    return Math.max(NODE_BASE_MIN_HEIGHT, height);
};

export const usePlanLogic = ({ scale, setScale, canvasWrapperRef }: { scale: number, setScale: React.Dispatch<React.SetStateAction<number>>, canvasWrapperRef: React.RefObject<HTMLDivElement> }) => {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { user: currentUserFromAuth } = useAuth();
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
  const [newNodeCoordinates, setNewNodeCoordinates] = useState<{x: number, y: number} | null>(null);
  const childItemManagementContextRef = useRef<{ operation: 'createGrandchild'; targetChildToBecomeParentId: string; currentParentOfTargetChildId: string; } | { operation: 'createChild'; targetParentNodeId: string; } | { operation: 'edit'; itemToEditId: string; parentNodeId: string; } | null>(null);
  const [isEditChildItemDialogOpen, setIsEditChildItemDialogOpen] = useState(false);
  const [isChildItemDialogSubmitting, setIsChildItemDialogSubmitting] = useState(false);
  const [dynamicChildDialogTitle, setDynamicChildDialogTitle] = useState("Manage Item");
  const [defaultChildDialogTitle, setDefaultChildDialogTitle] = useState("");
  const [defaultChildDialogDescription, setDefaultChildDialogDescription] = useState("");
  const [diffTarget, setDiffTarget] = useState<{ current: ClientPlanVersion; previous: ClientPlanVersion | null } | null>(null);
  const [addedNodeIds, setAddedNodeIds] = useState<Set<string>>(new Set());
  const [persistedNodeIds, setPersistedNodeIds] = useState<Set<string>>(new Set());
  const [removedNodeTitles, setRemovedNodeTitles] = useState<string[]>([]);
  const [diffDetailsVersionId, setDiffDetailsVersionId] = useState<string | null>(null);
  
  const panStartRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);

  const pinchDistRef = useRef<number | null>(null);
  const startScaleRef = useRef<number>(1.0);

  const [planData, setPlanData] = useState<ClientPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [planError, setPlanError] = useState<Error | null>(null);

  const [isPlanInfoDialogOpen, setIsPlanInfoDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [planDataForDialog, setPlanDataForDialog] = useState<ClientPlan | null>(null);
  const [originalEditingChildItemData, setOriginalEditingChildItemData] = useState<ChildDataItem | null>(null);

  const [viewPermissionsSearch, setViewPermissionsSearch] = useState('');
  const [debouncedViewPermissionsSearch, setDebouncedViewPermissionsSearch] = useState('');
  const [editPermissionsSearch, setEditPermissionsSearch] = useState('');
  const [debouncedEditPermissionsSearch, setDebouncedEditPermissionsSearch] = useState('');
  const [currentViewUserIds, setCurrentViewUserIds] = useState<string[]>([]);
  const [currentEditUserIds, setCurrentEditUserIds] = useState<string[]>([]);

  const [activeViewers, setActiveViewers] = useState<UserProfileBasic[]>([]);

  const [historyFilterByUserId, setHistoryFilterByUserId] = useState<string | null>(null);
  const [historyFilterByUserName, setHistoryFilterByUserName] = useState<string | null>(null);

  const handleOpenHistoryForUser = useCallback(async (userId: string) => {
    const profile = await fetchUserProfileBasic(userId);
    const displayName = profile?.displayName || generateAnonymousName(userId);
    setHistoryFilterByUserName(displayName);
    setHistoryFilterByUserId(userId);
    setIsVersionHistorySheetOpen(true);
  }, [setIsVersionHistorySheetOpen]);

  useEffect(() => {
    if (!isPlanInfoDialogOpen) {
      setViewPermissionsSearch('');
      setEditPermissionsSearch('');
    }
  }, [isPlanInfoDialogOpen]);


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedViewPermissionsSearch(viewPermissionsSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [viewPermissionsSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedEditPermissionsSearch(editPermissionsSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [editPermissionsSearch]);

  const { data: viewPermissionSuggestions = [] } = useQuery<UserProfileBasic[]>({
      queryKey: ['suggestibleUsersForPlanView', debouncedViewPermissionsSearch, user?.uid],
      queryFn: () => user ? getSuggestibleUsers(debouncedViewPermissionsSearch, 10) : Promise.resolve([]),
      enabled: !!user && debouncedViewPermissionsSearch.length > 0,
  });

  const { data: editPermissionSuggestions = [] } = useQuery<UserProfileBasic[]>({
      queryKey: ['suggestibleUsersForPlanEdit', debouncedEditPermissionsSearch, user?.uid],
      queryFn: () => user ? getSuggestibleUsers(debouncedEditPermissionsSearch, 10) : Promise.resolve([]),
      enabled: !!user && debouncedEditPermissionsSearch.length > 0,
  });

  const isValidPlanId = useMemo(() => !!planId && (IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20), [planId]);

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
  
  const updateRoadmapMutation = useMutation({
    mutationFn: (updatedRoadmap: RoadmapStep[]) => {
      if (!planId || !user) {
        throw new Error("Plan or user not available for saving roadmap.");
      }
      return updatePlanDetails(planId, user.uid, { roadmap: updatedRoadmap });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['planVersions', planId] });
    },
    onError: (error: Error) => {
      toast({
          variant: "destructive",
          title: "Roadmap Sync Error",
          description: error.message || "Could not save roadmap changes. Reverting to last saved state."
      });
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
    }
  });

  const saveCurrentRoadmap = useCallback((newRoadmap: RoadmapStep[]) => {
    if (!planId || !user) return;
    updateRoadmapMutation.mutate(newRoadmap);
  }, [planId, user, updateRoadmapMutation]);
  
  const restorePlanMutation = useMutation({
    mutationFn: (payload: { planId: string; versionIdToRestore: string; currentUserId: string; }) =>
      restorePlanToVersion(payload.planId, payload.versionIdToRestore, payload.currentUserId),
    onSuccess: async (_, variables) => {
      toast({ title: "Plan Restored", description: "The plan has been restored." });
      await refetchPlanVersions();
      setIsRestoreConfirmOpen(false); setVersionToRestore(null);
      handleExitDiffView();
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Restore Failed", description: error.message || "Could not restore plan." }),
  });

  const savePlanSettingsMutation = useMutation({
    mutationFn: (payload: { planId: string; currentUserId: string; updates: UpdatePlanData }) =>
      updatePlanDetails(payload.planId, payload.currentUserId, payload.updates),
    onSuccess: async (_, variables) => {
      toast({ title: "Plan Settings Saved", description: "Your plan settings have been updated." });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save plan settings." })
  });
  
  const isSaving = savePlanSettingsMutation.isPending || restorePlanMutation.isPending || updateRoadmapMutation.isPending;

  useEffect(() => {
    if (!planId || !isValidPlanId) {
      setIsLoadingPlan(false);
      setPlanData(null);
      return;
    }
    const planDocRef = doc(db, PLANS_COLLECTION, planId);
    const unsubscribe = onSnapshot(planDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Plan;
        const clientPlan: ClientPlan = {
          id: docSnap.id,
          name: data.name,
          ownerId: data.ownerId,
          description: data.description || null,
          sector: data.sector,
          subSector: data.subSector || null,
          industry: data.industry || null,
          naicsCode: data.naicsCode || null,
          createdAt: (data.createdAt as Timestamp)?.toMillis() || Date.now(),
          updatedAt: (data.updatedAt as Timestamp)?.toMillis() || Date.now(),
          version: data.version || 1,
          roadmap: (data.roadmap || []).map(step => sanitizeRoadmapStep(step)),
          visibility: data.visibility || 'private',
          editability: data.editability || 'owner_only',
          viewUserIds: data.viewUserIds || (data.ownerId ? [data.ownerId] : []),
          editUserIds: data.editUserIds || (data.ownerId ? [data.ownerId] : []),
        };
        setPlanData(clientPlan);
        if (!diffTarget) {
            setEditableRoadmap(clientPlan.roadmap);
        }
        setPlanDataForDialog(clientPlan);
        setPlanError(null);
      } else {
        setPlanData(null);
        setPlanError(new Error("Plan not found."));
      }
      setIsLoadingPlan(false);
    }, (error) => {
      console.error("[usePlanLogic] onSnapshot error:", error);
      setPlanError(error);
      setIsLoadingPlan(false);
    });

    return () => unsubscribe();
  }, [planId, isValidPlanId, diffTarget]);

  // Presence management effect (user signals they are viewing)
  useEffect(() => {
    if (!planId || !user || !isValidPlanId) return;

    const viewingUserRef = doc(db, 'plans', planId, 'viewingUsers', user.uid);
    let presenceInterval: NodeJS.Timeout;

    const setPresence = () => {
        setDoc(viewingUserRef, { lastSeen: serverTimestamp() }, { merge: true });
    };

    setPresence();
    presenceInterval = setInterval(setPresence, 60 * 1000); // Update every 60 seconds

    return () => {
      clearInterval(presenceInterval);
      // This is a "best effort" attempt for cleanup.
      deleteDoc(viewingUserRef);
    };
  }, [planId, user, isValidPlanId]);

  // Listener for other viewers
  useEffect(() => {
    if (!planId || !user || !isValidPlanId) return;

    const viewingUsersRef = collection(db, 'plans', planId, 'viewingUsers');
    
    // Listen to all documents in the subcollection without a time-based where clause
    const q = query(viewingUsersRef);

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        // Calculate the cutoff time *inside* the listener callback
        const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

        const viewerIds = snapshot.docs
            .map(d => ({ id: d.id, lastSeen: (d.data().lastSeen as Timestamp)?.toMillis() || 0 }))
            .filter(viewer => viewer.lastSeen > twoMinutesAgo && viewer.id !== user.uid) // Filter by time and exclude self
            .map(viewer => viewer.id);

        if (viewerIds.length > 0) {
            const profiles = await Promise.all(
                viewerIds.map(id => fetchUserProfileBasic(id))
            );
            setActiveViewers(profiles.filter((p): p is UserProfileBasic => p !== null));
        } else {
            setActiveViewers([]);
        }
    }, (error) => {
        console.error("Error listening to viewing users:", error);
        // Don't clear viewers on error, might be temporary
    });

    return () => unsubscribe();
  }, [planId, user, isValidPlanId]);


  const canEditPlan = useMemo(() => {
    if (!user || !planData) return false;
    // Owner can always edit.
    if (planData.ownerId === user.uid) return true;
    
    // Check for collaborator role
    if (planData.editability === 'collaborators' && (planData.editUserIds || []).includes(user.uid)) {
      return true;
    }

    // Check for 'everyone' role, which requires view access.
    if (planData.editability === 'everyone') {
      if (planData.visibility === 'public' || planData.visibility === 'unlisted') {
        return true;
      }
      // For private plans with 'everyone' editability, they must be in the view list.
      if (planData.visibility === 'private' && (planData.viewUserIds || []).includes(user.uid)) {
        return true;
      }
    }
    
    return false;
  }, [user, planData]);

  const isOwnerForUIDisplay = useMemo(() => {
    return !!currentUserFromAuth && !!planData && planData.ownerId === currentUserFromAuth.uid;
  }, [currentUserFromAuth, planData]);

  const handleInitiateAddNode = useCallback((details: {
    sourceNodeId?: string | null;
    initiatingDot?: 'N' | 'E' | 'S';
    coords?: { x: number; y: number };
  }) => {
    if (!canEditPlan || diffTarget) return;
    setTargetParentIdForDialog(details.sourceNodeId ?? null);
    setInitiatingDotTypeForDialog(details.initiatingDot ?? null);
    setNewNodeCoordinates(details.coords ?? null);
    setIsAddNodeDialogOpen(true);
  }, [canEditPlan, diffTarget]);

  const handleAddNode = useCallback((data: { title: string }) => {
    if (!canEditPlan || diffTarget) return;

    const newId = `step-${Date.now()}-${uuidv4().substring(0, 8)}`;
    let newStepX, newStepY;
    const sourceNodeForPeerLink = targetParentIdForDialog ? editableRoadmap.find(s => s.id === targetParentIdForDialog) : null;

    if (newNodeCoordinates) {
      newStepX = Math.max(MIN_CANVAS_PADDING, newNodeCoordinates.x - (NODE_BASE_WIDTH / 2));
      newStepY = Math.max(MIN_CANVAS_PADDING, newNodeCoordinates.y - (NODE_BASE_MIN_HEIGHT / 2));
    } else if (sourceNodeForPeerLink && initiatingDotTypeForDialog) {
      const sourceHeight = calculateNodeHeight(sourceNodeForPeerLink, editableRoadmap);
      switch (initiatingDotTypeForDialog) {
        case 'N': newStepX = sourceNodeForPeerLink.x; newStepY = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.y - NODE_BASE_MIN_HEIGHT - DEFAULT_SPACING_Y); break;
        case 'E': newStepX = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.x + NODE_BASE_WIDTH + DEFAULT_SPACING_X); newStepY = sourceNodeForPeerLink.y; break;
        case 'S': newStepY = Math.max(MIN_CANVAS_PADDING, sourceNodeForPeerLink.y + sourceHeight + DEFAULT_SPACING_Y); newStepX = sourceNodeForPeerLink.x; break;
        default:
          newStepX = Math.max(MIN_CANVAS_PADDING, 500); // Fallback
          newStepY = Math.max(MIN_CANVAS_PADDING, 500); // Fallback
      }
    } else {
      newStepX = Math.max(MIN_CANVAS_PADDING, 500); // Fallback
      newStepY = Math.max(MIN_CANVAS_PADDING, 500); // Fallback
    }

    const newNode: RoadmapStep = sanitizeRoadmapStep({ id: newId, title: data.title, x: newStepX, y: newStepY });
    let newRoadmap: RoadmapStep[];

    if (sourceNodeForPeerLink && initiatingDotTypeForDialog) {
      const newPeerConnection: PeerConnection = {
        targetNodeId: newNode.id,
        sourceDot: initiatingDotTypeForDialog,
        targetDot: initiatingDotTypeForDialog === 'N' ? 'S' : (initiatingDotTypeForDialog === 'S' ? 'N' : 'W')
      };
      newRoadmap = editableRoadmap.map(s => s.id === sourceNodeForPeerLink.id ? {...s, peerConnections: [...(s.peerConnections || []), newPeerConnection]} : s);
      newRoadmap.push(newNode);
    } else {
      newRoadmap = [...editableRoadmap, newNode];
    }

    setEditableRoadmap(newRoadmap);
    saveCurrentRoadmap(newRoadmap);
    toast({ title: "Node Added" });
    setIsAddNodeDialogOpen(false);
    setTargetParentIdForDialog(null);
    setInitiatingDotTypeForDialog(null);
    setNewNodeCoordinates(null);
  }, [canEditPlan, diffTarget, editableRoadmap, targetParentIdForDialog, initiatingDotTypeForDialog, saveCurrentRoadmap, toast, newNodeCoordinates]);

  const getPointerCoords = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } => {
    if ('touches' in event && event.touches.length > 0) return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    if ('changedTouches' in event && event.changedTouches.length > 0) return { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY };
    return { clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY };
  }, []);
  
  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (diffTarget) return;

    if ((event.target as HTMLElement).closest('[data-node-id]')) {
      return;
    }

    const { clientX, clientY } = getPointerCoords(event);
    const canvasWrapper = (event.currentTarget as HTMLElement).parentElement as HTMLElement;
    if (!canvasWrapper) return;
    
    panStartRef.current = {
      startX: clientX,
      startY: clientY,
      scrollLeft: canvasWrapper.scrollLeft,
      scrollTop: canvasWrapper.scrollTop,
    };
    
    clickStartInfoRef.current = { clientX, clientY, timestamp: Date.now(), targetElement: event.currentTarget };
    isDraggingRef.current = false;
    setIsPointerDown(true);
    canvasWrapper.style.cursor = 'grabbing';
  }, [diffTarget, getPointerCoords]);

  const getPinchDistance = (touches: React.TouchList): number => {
    const [touch1, touch2] = Array.from(touches);
    return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
  };

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (diffTarget) return;
    if (event.touches.length === 2) {
      event.preventDefault();
      nodeDragInfoRef.current = null;
      panStartRef.current = null;
      
      const dist = getPinchDistance(event.touches);
      pinchDistRef.current = dist;
      startScaleRef.current = scale;
    }
  }, [diffTarget, scale]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>, canvasWrapperRefCurrent: HTMLDivElement | null) => {
    if (diffTarget) return;
    if (event.touches.length === 2 && pinchDistRef.current !== null) {
      event.preventDefault();
      const newDist = getPinchDistance(event.touches);
      const newScaleValue = startScaleRef.current * (newDist / pinchDistRef.current);
      
      let containerWidth = canvasWrapperRefCurrent?.clientWidth || CANVAS_WIDTH;
      const minScaleValue = containerWidth > 0 ? (containerWidth / CANVAS_WIDTH) * 0.95 : 0.1;

      setScale(Math.max(minScaleValue, Math.min(newScaleValue, 1.0)));
    }
  }, [diffTarget, setScale]);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
      if (diffTarget) return;
      if (pinchDistRef.current !== null) {
          pinchDistRef.current = null;
      }
  }, [diffTarget]);

  const handleEditCanvasNode = useCallback((nodeToEdit: RoadmapStep) => {
    if (diffTarget) return;
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
    const parentNode = editableRoadmap.find(n => n.id === parentCanvasNodeId);
    if (!parentNode) {
      return;
    }
    const childItem = parentNode.childrenData.find(ci => ci.id === childItemId);
    if (!childItem) {
      return;
    }
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
    const newRoadmap = editableRoadmap.map(s => s.id === updatedStep.id ? { ...s, ...updatedStep, childrenData: updatedStep.childrenData || (s.childrenData || []) } : s );
    saveCurrentRoadmap(newRoadmap);
  }, [canEditPlan, diffTarget, editableRoadmap, saveCurrentRoadmap]);

  const handleChildItemDetailUpdateInPanel = useCallback((updatedChildItem: ChildDataItem, parentNodeId: string) => {
    if (!canEditPlan || diffTarget) return;
    let newRoadmap = editableRoadmap.map(parentNode => parentNode.id === parentNodeId ? { ...parentNode, childrenData: parentNode.childrenData.map(ci => ci.id === updatedChildItem.id ? updatedChildItem : ci) } : parentNode );
    if (updatedChildItem.canvasNodeIdForThisItem) {
      newRoadmap = newRoadmap.map(node =>
        node.id === updatedChildItem.canvasNodeIdForThisItem
        ? { ...node, title: updatedChildItem.title, description: updatedChildItem.description }
        : node
      );
    }
    saveCurrentRoadmap(newRoadmap);
  }, [canEditPlan, diffTarget, editableRoadmap, saveCurrentRoadmap]);

  const handleSpawnChildDataItemAsCanvasNode = useCallback((
    currentRoadmap: RoadmapStep[],
    childItemId: string,
    parentCanvasNodeIdOfChildItem: string
  ): { updatedRoadmap: RoadmapStep[]; spawnedNodeId: string | null } => {
    let newRoadmapCandidate = JSON.parse(JSON.stringify(currentRoadmap));
    const parentNodeIndex = newRoadmapCandidate.findIndex((s: RoadmapStep) => s.id === parentCanvasNodeIdOfChildItem);

    if (parentNodeIndex === -1) {
      toast({ variant: "destructive", title: "Error Spawning Node", description: `Parent node not found.` });
      return { updatedRoadmap: currentRoadmap, spawnedNodeId: null };
    }

    const parentNode: RoadmapStep = newRoadmapCandidate[parentNodeIndex];
    const childItemIndex = (parentNode.childrenData || []).findIndex((ci: ChildDataItem) => ci.id === childItemId);

    if (childItemIndex === -1) {
      toast({ variant: "destructive", title: "Error Spawning Node", description: `Child item not found in parent.` });
      return { updatedRoadmap: currentRoadmap, spawnedNodeId: null };
    }

    const childItem: ChildDataItem = parentNode.childrenData[childItemIndex];
    if (childItem.canvasNodeIdForThisItem && newRoadmapCandidate.some((n: RoadmapStep) => n.id === childItem.canvasNodeIdForThisItem)) {
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

      try {
        if (context.operation === 'createGrandchild') {
          const spawnResult = handleSpawnChildDataItemAsCanvasNode(newRoadmapCandidate, context.targetChildToBecomeParentId, context.currentParentOfTargetChildId);
          if (spawnResult.spawnedNodeId && spawnResult.updatedRoadmap) {
            newRoadmapCandidate = spawnResult.updatedRoadmap;
            const spawnedNodeAsParentIndex = newRoadmapCandidate.findIndex((node: RoadmapStep) => node.id === spawnResult.spawnedNodeId);
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
            }
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
            }
          }
        }

        if (modificationSuccessful) {
          saveCurrentRoadmap(newRoadmapCandidate);
          toast({ title: "Item Action Complete" });
          setIsEditChildItemDialogOpen(false);
          childItemManagementContextRef.current = null;
        } else {
          toast({ variant: "destructive", title: "Action Failed" });
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Submission Error", description: "Could not save item due to an unexpected error." });
      } finally {
        setIsChildItemDialogSubmitting(false);
      }
  }, [canEditPlan, diffTarget, toast, handleSpawnChildDataItemAsCanvasNode, editableRoadmap, saveCurrentRoadmap]);


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
    let canvasNodeIdThatWasRepresentedByDeletedItem: string | null = null;
    let newRoadmap = editableRoadmap.map(parentNode => {
        if (parentNode.id === parentCanvasNodeIdOfItem) {
            const childItemToRemove = (parentNode.childrenData || []).find(ci => ci.id === childItemIdToDelete);
            canvasNodeIdThatWasRepresentedByDeletedItem = childItemToRemove?.canvasNodeIdForThisItem || null;
            return { ...parentNode, childrenData: (parentNode.childrenData || []).filter(ci => ci.id !== childItemIdToDelete) };
        }
        return parentNode;
    });
    if (canvasNodeIdThatWasRepresentedByDeletedItem) {
        newRoadmap = newRoadmap.filter(node => node.id !== canvasNodeIdThatWasRepresentedByDeletedItem);
        newRoadmap = newRoadmap.map(rn => ({ ...rn, peerConnections: (rn.peerConnections || []).filter(pc => pc.targetNodeId !== canvasNodeIdThatWasRepresentedByDeletedItem) }));
    }

    saveCurrentRoadmap(newRoadmap);

    if (editingTarget?.type === 'childItem' && editingTarget.data.id === childItemIdToDelete) {
      setIsStepDetailSheetOpen(false); setEditingTarget(null);
    }
    toast({ title: "Item Removed" });
  }, [canEditPlan, toast, editingTarget, diffTarget, editableRoadmap, saveCurrentRoadmap]);

  const confirmDeleteNode = useCallback(() => {
    if (!nodeToDelete || !canEditPlan || diffTarget) return;
    const idToDelete = nodeToDelete.id;
    const newRoadmap = editableRoadmap.filter(s => s.id !== idToDelete).map(rn => ({ ...rn, childrenData: (rn.childrenData || []).map(ci => ci.canvasNodeIdForThisItem === idToDelete ? { ...ci, canvasNodeIdForThisItem: null } : ci), peerConnections: (rn.peerConnections || []).filter(pc => pc.targetNodeId !== idToDelete) }));
    saveCurrentRoadmap(newRoadmap);
    if (editingTarget?.type === 'node' && editingTarget.data.id === idToDelete) { setIsStepDetailSheetOpen(false); setEditingTarget(null); }
    toast({ title: `Node "${nodeToDelete.title}" Deleted` });
    setNodeToDelete(null);
  }, [nodeToDelete, canEditPlan, toast, editingTarget, diffTarget, editableRoadmap, saveCurrentRoadmap]);

  const handleAddViewer = useCallback((userProfile: UserProfileBasic) => {
    if (planData && userProfile.userId !== planData.ownerId) {
        setCurrentViewUserIds(prev => Array.from(new Set([...prev, userProfile.userId])));
        setViewPermissionsSearch('');
    }
  }, [planData]);

  const handleRemoveViewer = useCallback((userIdToRemove: string) => {
    if (planData && userIdToRemove !== planData.ownerId) {
        setCurrentViewUserIds(prev => prev.filter(uid => uid !== userIdToRemove));
        setCurrentEditUserIds(prev => prev.filter(uid => uid !== userIdToRemove)); // Also remove from editors
    }
  }, [planData]);

  const handleAddEditor = useCallback((userProfile: UserProfileBasic) => {
    if (planData && userProfile.userId !== planData.ownerId) {
        setCurrentEditUserIds(prev => Array.from(new Set([...prev, userProfile.userId])));
        setCurrentViewUserIds(prev => Array.from(new Set([...prev, userProfile.userId]))); // Ensure they're also a viewer
        setEditPermissionsSearch('');
    }
  }, [planData]);

  const handleRemoveEditor = useCallback((userIdToRemove: string) => {
    if (planData && userIdToRemove !== planData.ownerId) {
        setCurrentEditUserIds(prev => prev.filter(uid => uid !== userIdToRemove));
    }
  }, [planData]);

  const handleSavePlanSettings = useCallback((settings: {
    name: string;
    description: string;
    visibility: PlanVisibility;
    editability: PlanEditability;
    viewUserIds: string[];
    editUserIds: string[];
  }) => {
    if (!planData || !user || !planId || !canEditPlan) {
      toast({ variant: "destructive", title: "Error", description: "Cannot save settings. Plan data missing or permissions issue." });
      return;
    }
    const updates: UpdatePlanData = {
        name: settings.name,
        description: settings.description,
        visibility: settings.visibility,
        editability: settings.editability,
        viewUserIds: settings.viewUserIds,
        editUserIds: settings.editUserIds,
    };
    savePlanSettingsMutation.mutate({ planId, currentUserId: user.uid, updates });
  }, [planData, user, planId, canEditPlan, savePlanSettingsMutation, toast]);

  const handleExitDiffView = useCallback(() => {
      setDiffTarget(null);
      setDiffDetailsVersionId(null);
  }, []);

  const handleViewChangesClick = useCallback((versionToView: ClientPlanVersion, previousVersionInHistory: ClientPlanVersion | null) => {
    if (!planData) return;
    const isCurrentlyViewingThisDiff = diffDetailsVersionId === versionToView.id && !!diffTarget;
    if (isCurrentlyViewingThisDiff) {
      handleExitDiffView();
    } else {
      setDiffTarget({ current: versionToView, previous: previousVersionInHistory });
      setDiffDetailsVersionId(versionToView.id);
      // Close all other dialogs/sheets for a clean view
      setIsVersionHistorySheetOpen(false);
      setIsPlanInfoDialogOpen(false);
      setIsPermissionsDialogOpen(false);
    }
  }, [
    planData,
    diffDetailsVersionId,
    diffTarget,
    handleExitDiffView,
    setIsVersionHistorySheetOpen,
    setIsPlanInfoDialogOpen,
    setIsPermissionsDialogOpen
  ]);

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

  const handleGlobalMove = useCallback((event: MouseEvent | TouchEvent, canvasWrapperRefCurrent: HTMLDivElement | null) => {
      if (!isPointerDown || !canvasWrapperRefCurrent) return;
  
      const { clientX, clientY } = getPointerCoords(event);
  
      if (nodeDragInfoRef.current) {
          if (!isDraggingRef.current) {
              const dx = clientX - (clickStartInfoRef.current?.clientX || 0);
              const dy = clientY - (clickStartInfoRef.current?.clientY || 0);
              if (dx * dx + dy * dy > 25) {
                  isDraggingRef.current = true;
              }
          }
  
          if (isDraggingRef.current) {
              if (event.cancelable) event.preventDefault();
              const { nodeId, offsetX = 0, offsetY = 0, isDotDrag, dotType } = nodeDragInfoRef.current;
              if (isDotDrag) {
                  // Connection line drawing logic would go here
              } else {
                  const canvasRect = canvasWrapperRefCurrent.getBoundingClientRect();
                  const newX = (clientX - canvasRect.left) / scale + canvasWrapperRefCurrent.scrollLeft / scale - offsetX / scale;
                  const newY = (clientY - canvasRect.top) / scale + canvasWrapperRefCurrent.scrollTop / scale - offsetY / scale;
                  setEditableRoadmap(prev => prev.map(step => step.id === nodeId ? { 
                      ...step, 
                      x: Math.max(MIN_CANVAS_PADDING, Math.min(newX, CANVAS_WIDTH - NODE_BASE_WIDTH - MIN_CANVAS_PADDING)), 
                      y: Math.max(MIN_CANVAS_PADDING, newY) 
                  } : step ));
              }
              forceRender();
          }
      } 
      else if (panStartRef.current) {
          if (event.cancelable) event.preventDefault();
          if (!isDraggingRef.current) {
              const dx = clientX - panStartRef.current.startX;
              const dy = clientY - panStartRef.current.startY;
              if (dx * dx + dy * dy > 25) {
                  isDraggingRef.current = true;
              }
          }
          if (isDraggingRef.current) {
              const deltaX = clientX - panStartRef.current.startX;
              const deltaY = clientY - panStartRef.current.startY;
              canvasWrapperRefCurrent.scrollLeft = panStartRef.current.scrollLeft - deltaX;
              canvasWrapperRefCurrent.scrollTop = panStartRef.current.scrollTop - deltaY;
          }
      }
  }, [isPointerDown, getPointerCoords, editableRoadmap, scale, forceRender]);

  const handleGlobalPointerUp = useCallback((event: MouseEvent | TouchEvent, canvasWrapperRefCurrent: HTMLDivElement | null) => {
    if (panStartRef.current && canvasWrapperRefCurrent) {
      canvasWrapperRefCurrent.style.cursor = 'grab';
    }

    if (panStartRef.current && !isDraggingRef.current && clickStartInfoRef.current) {
        const finalCoords = getPointerCoords(event);
        if ((finalCoords.clientX - clickStartInfoRef.current.clientX)**2 + (finalCoords.clientY - clickStartInfoRef.current.clientY)**2 < 25 && (Date.now() - clickStartInfoRef.current.timestamp) < 300) {
            if (canvasWrapperRefCurrent) {
                const scaleFactor = scale;
                const canvasRect = canvasWrapperRefCurrent.firstElementChild!.getBoundingClientRect();
                const x = (finalCoords.clientX - canvasRect.left) / scaleFactor + canvasWrapperRefCurrent.scrollLeft / scaleFactor;
                const y = (finalCoords.clientY - canvasRect.top) / scaleFactor + canvasWrapperRefCurrent.scrollTop / scaleFactor;
                handleInitiateAddNode({ coords: { x, y } });
            }
        }
    }

    let finalRoadmap = [...editableRoadmap];
    let hasChanged = false;

    if (nodeDragInfoRef.current) {
      if (nodeDragInfoRef.current.isDotDrag && isDraggingRef.current && nodeDragInfoRef.current.dotType) {
        // ... (existing connection creation logic)
      } else if (isDraggingRef.current) {
        hasChanged = true;
      } else if (clickStartInfoRef.current) {
        // ... (existing node click logic)
      }
    }
    
    if (hasChanged) {
        saveCurrentRoadmap(finalRoadmap);
    }
    
    panStartRef.current = null;
    nodeDragInfoRef.current = null;
    clickStartInfoRef.current = null;
    isDraggingRef.current = false;
    setIsPointerDown(false);
    activeConnectionLinePreviewRef.current = null;
    forceRender();
  }, [editableRoadmap, scale, handleInitiateAddNode, saveCurrentRoadmap, forceRender]);

  const onNodeDetailPanelSubmit = useCallback(async (data: { title: string; description?: string }) => {
    if (!editingTarget) return;

    let newRoadmap;
    if (editingTarget.type === 'node') {
      newRoadmap = editableRoadmap.map(s => s.id === editingTarget.data.id ? { ...s, title: data.title, description: data.description || null } : s );
    } else if (editingTarget.type === 'childItem') {
      newRoadmap = editableRoadmap.map(parentNode => parentNode.id === editingTarget.parentNode.id ? { ...parentNode, childrenData: parentNode.childrenData.map(ci => ci.id === editingTarget.data.id ? { ...ci, title: data.title, description: data.description || null } : ci) } : parentNode );
      if (editingTarget.data.canvasNodeIdForThisItem) {
          newRoadmap = newRoadmap.map(node => node.id === editingTarget.data.canvasNodeIdForThisItem ? { ...node, title: data.title, description: data.description || null } : node);
      }
    } else {
        return;
    }
    saveCurrentRoadmap(newRoadmap);
  }, [editingTarget, editableRoadmap, saveCurrentRoadmap]);

  return {
    user, authLoading, planId, isValidPlanId,
    planData, isLoadingPlan, planError, ownerProfile, isLoadingOwnerProfile,
    editableRoadmap,
    editingTarget, setEditingTarget, isStepDetailSheetOpen, setIsStepDetailSheetOpen,
    initialPanelDataRef,
    onNodeDetailPanelSubmit,
    handleNodeDetailUpdate: onNodeDetailPanelSubmit, handleChildItemDetailUpdateInPanel,
    nodeToDelete, setNodeToDelete, confirmDeleteNode,
    handleNodeInteractionStart, activeConnectionLinePreviewRef, nodeDragInfoRef, isDraggingRef,
    handleGlobalMove, handleGlobalPointerUp, isPointerDown,
    isVersionHistorySheetOpen, setIsVersionHistorySheetOpen, planVersionsData, isLoadingVersions, refetchPlanVersions,
    historyFilterByUserId, historyFilterByUserName, setHistoryFilterByUserId, setHistoryFilterByUserName, handleOpenHistoryForUser,
    handleViewChangesClick, handleExitDiffView, diffTarget, addedNodeIds, persistedNodeIds, removedNodeTitles, diffDetailsVersionId,
    isRestoreConfirmOpen, setIsRestoreConfirmOpen, versionToRestore, handleRestoreVersion, confirmRestore, restorePlanMutation,
    isAddNodeDialogOpen, setIsAddNodeDialogOpen, handleAddNode,
    childItemManagementContextRef, isEditChildItemDialogOpen, setIsEditChildItemDialogOpen, isChildItemDialogSubmitting, dynamicChildDialogTitle,
    defaultChildDialogTitle, setDefaultChildDialogTitle, defaultChildDialogDescription, setDefaultChildDialogDescription,
    handleChildItemDialogSubmit, handleEditChildItemText, handleDeleteChildItem,
    onAddGrandchildToChildDataItem: handleAddGrandchildToChildDataItem,
    onAddChildItemToNode: handleAddChildItemToNode,
    onChildItemTitleClick: handleChildItemCanvasNodeFocus,
    canEditPlan,
    isSaving,
    savePlanSettingsMutation,
    handleSavePlanSettings,
    isPlanInfoDialogOpen, setIsPlanInfoDialogOpen,
    isPermissionsDialogOpen, setIsPermissionsDialogOpen,
    planDataForDialog,
    originalEditingChildItemData, setOriginalEditingChildItemData,
    viewPermissionsSearch, setViewPermissionsSearch, editPermissionsSearch, setEditPermissionsSearch,
    viewPermissionSuggestions, editPermissionSuggestions,
    handleAddUserToViewers: handleAddViewer,
    handleRemoveUserFromViewers: handleRemoveViewer,
    handleAddUserToEditors: handleAddEditor,
    handleRemoveUserFromEditors: handleRemoveEditor,
    forceRender,
    handleInitiateAddNode,
    setIsChildItemDialogSubmitting,
    handleEditCanvasNode,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    activeViewers,
  };
};
