
// src/app/plan/[planId]/page.tsx
"use client";

import React, { useEffect, useRef, useCallback } from 'react'; // Removed useState, useMemo as they are in usePlanLogic
import { useParams, useRouter } from 'next/navigation'; // useRouter might still be needed for top-level nav
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ChevronLeft, AlertTriangle, PlusCircle, History, Share2, Info } from 'lucide-react'; // Keep common icons
import { PlanInfoDialog } from '@/components/plan/PlanInfoDialog'; // Keep this import
import { RoadmapStepCardComponent } from '@/components/plan/RoadmapStepCard';
import { AddRoadmapStepDialog } from '@/components/plan/AddRoadmapStepDialog';
import { EditChildItemDialog } from '@/components/plan/EditChildItemDialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePlanLogic, sanitizeRoadmapStep } from './usePlanLogic'; // Import from the hook
import type { RoadmapStep, ClientPlanVersion } from '@/types/plan';
import { PlanHeader } from './PlanHeader';


// Constants from usePlanLogic moved here if they are purely presentational and used by drawConnectionLines
const NODE_BASE_WIDTH = 220;
const NODE_HEADER_HEIGHT = 40;
const CHILD_ITEM_HEIGHT = 28;
const NODE_BASE_MIN_HEIGHT = 80;
const FINAL_BUFFER_CARD_HEIGHT = 8;

const CONNECTION_LINE_THICKNESS_HIERARCHY = 1.5;
const CONNECTION_LINE_THICKNESS_PEER = 1.5;

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
  if (contentAreaHeight === 0) {
      contentAreaHeight = 20;
  }
  height += contentAreaHeight;
  height += FINAL_BUFFER_CARD_HEIGHT;
  return Math.max(NODE_BASE_MIN_HEIGHT, height);
};


export default function PlanDetailPage() {
  const {
    user, authLoading, planId, isValidPlanId,
    planData, isLoadingPlan, planError, ownerProfile, isLoadingOwnerProfile,
    editableRoadmap, setEditableRoadmap,
    editingTarget, setEditingTarget, isStepDetailSheetOpen, setIsStepDetailSheetOpen,
    handleNodeDetailUpdate, handleChildItemDetailUpdateInPanel,
    nodeToDelete, setNodeToDelete, confirmDeleteNode,
    handleNodeInteractionStart, activeConnectionLinePreviewRef,
    handleGlobalMove, handleGlobalPointerUp, isPointerDown,
    isVersionHistorySheetOpen, setIsVersionHistorySheetOpen, planVersionsData, isLoadingVersions, refetchPlanVersions, augmentedPlanVersions,
    handleViewChangesClick, handleExitDiffView, diffTarget, addedNodeIds, persistedNodeIds, removedNodeTitles, diffDetailsVersionId,
    isRestoreConfirmOpen, setIsRestoreConfirmOpen, versionToRestore, handleRestoreVersion, confirmRestore,
    isAddNodeDialogOpen, setIsAddNodeDialogOpen, handleAddNode,
    childItemManagementContextRef, isEditChildItemDialogOpen, setIsEditChildItemDialogOpen, dynamicChildDialogTitle,
    defaultChildDialogTitle, setDefaultChildDialogTitle, defaultChildDialogDescription, setDefaultChildDialogDescription,
    handleChildItemDialogSubmit, handleEditChildItemText, handleDeleteChildItem,
    onAddGrandchildToChildDataItem, onAddChildItemToNode, onChildItemTitleClick,
    canEditPlan, saveRoadmapChanges,
    savePlanSettingsMutation, handleSavePlanSettings,
    isPlanInfoDialogOpen, setIsPlanInfoDialogOpen,
    planDataForDialog, // Use this for PlanInfoDialog
    originalEditingChildItemData, setOriginalEditingChildItemData,
    // Permissions
    viewPermissionsSearch, setViewPermissionsSearch, editPermissionsSearch, setEditPermissionsSearch,
    viewPermissionSuggestions, editPermissionSuggestions,
    handleAddUserToViewers, handleRemoveUserFromViewers, handleAddUserToEditors, handleRemoveUserFromEditors,
    forceRender,
  } = usePlanLogic();

  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [canvasMinHeight, setCanvasMinHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 800);
  const controlOffset = 100;

  useEffect(() => {
    if (isPointerDown && canvasRef.current) {
      const currentCanvasRef = canvasRef.current; // Capture ref value
      const moveHandler = (event: MouseEvent | TouchEvent) => handleGlobalMove(event, currentCanvasRef);
      window.addEventListener('mousemove', moveHandler);
      window.addEventListener('touchmove', moveHandler, { passive: false });
      window.addEventListener('mouseup', handleGlobalPointerUp);
      window.addEventListener('touchend', handleGlobalPointerUp);
      window.addEventListener('touchcancel', handleGlobalPointerUp);
      return () => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('touchmove', moveHandler);
        window.removeEventListener('mouseup', handleGlobalPointerUp);
        window.removeEventListener('touchend', handleGlobalPointerUp);
        window.removeEventListener('touchcancel', handleGlobalPointerUp);
      };
    }
  }, [isPointerDown, handleGlobalMove, handleGlobalPointerUp]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let lowestNodeBottomY = 0;
      if (editableRoadmap.length > 0) {
        lowestNodeBottomY = Math.max(0, ...editableRoadmap.map(step => step.y + calculateNodeHeight(step, editableRoadmap)));
      }
      setCanvasMinHeight(Math.max(window.innerHeight, lowestNodeBottomY + window.innerHeight * 0.5));
    }
  }, [editableRoadmap]);


  const drawConnectionLines = useCallback(() => {
    if (!editableRoadmap) return null;
    const lines: JSX.Element[] = [];
    editableRoadmap.forEach((parentStep) => {
      const parentNodeHeight = calculateNodeHeight(parentStep, editableRoadmap);
      if (parentStep.childrenData) {
        parentStep.childrenData.forEach((childItem, index) => {
          if (childItem.canvasNodeIdForThisItem) {
            const childNode = editableRoadmap.find(node => node.id === childItem.canvasNodeIdForThisItem);
            if (childNode) {
              const startX = parentStep.x + 16; 
              const startY = parentStep.y + NODE_HEADER_HEIGHT + 8 + (index * CHILD_ITEM_HEIGHT) + (CHILD_ITEM_HEIGHT / 2);
              const endX = childNode.x; // Connect to WEST side of child node
              const endY = childNode.y + calculateNodeHeight(childNode, editableRoadmap) / 2;
              const pathKey_child = `hierarchical-${parentStep.id}-child${index}-to-${childNode.id}`;
              const c1x = startX - controlOffset / 2; // Control point for left curve
              const c1y = startY;
              const c2x = endX - controlOffset / 2; // Control point for right curve (approaching from left)
              const c2y = endY;
              const pathD = `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
              lines.push(
                <path key={pathKey_child} d={pathD} stroke="hsl(var(--primary))" strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY} fill="none" markerEnd="url(#arrowhead-main)" style={{ pointerEvents: "none" }} />
              );
            }
          }
        });
      }
      if (parentStep.peerConnections) {
        parentStep.peerConnections.forEach((peerConn, index) => {
          const targetStep = editableRoadmap.find(node => node.id === peerConn.targetNodeId);
          if (targetStep) {
            const sourceNodeHeight = calculateNodeHeight(parentStep, editableRoadmap);
            const targetNodeHeight = calculateNodeHeight(targetStep, editableRoadmap);
            let sX, sY, eX, eY;
            switch (peerConn.sourceDot) {
              case 'N': sX = parentStep.x + NODE_BASE_WIDTH / 2; sY = parentStep.y; break;
              case 'E': sX = parentStep.x + NODE_BASE_WIDTH; sY = parentStep.y + sourceNodeHeight / 2; break;
              case 'S': sX = parentStep.x + NODE_BASE_WIDTH / 2; sY = parentStep.y + sourceNodeHeight; break;
              default: return;
            }
            switch (peerConn.targetDot) {
              case 'N': eX = targetStep.x + NODE_BASE_WIDTH / 2; eY = targetStep.y; break;
              case 'E': eX = targetStep.x + NODE_BASE_WIDTH; eY = targetStep.y + targetNodeHeight / 2; break;
              case 'S': eX = targetStep.x + NODE_BASE_WIDTH / 2; eY = targetStep.y + targetNodeHeight; break;
              case 'W': eX = targetStep.x; eY = targetStep.y + targetNodeHeight / 2; break;
              default: return;
            }
            const pathKey_peer = `peerconn-${parentStep.id}-${peerConn.sourceDot}-to-${targetStep.id}-${peerConn.targetDot}-${index}`;
            let c1x_p, c1y_p, c2x_p, c2y_p;
            switch (peerConn.sourceDot) {
                case 'N': c1x_p = sX; c1y_p = sY - controlOffset; break;
                case 'E': c1x_p = sX + controlOffset; c1y_p = sY; break;
                case 'S': c1x_p = sX; c1y_p = sY + controlOffset; break;
                default: c1x_p = sX; c1y_p = sY;
            }
            switch (peerConn.targetDot) {
                case 'N': c2x_p = eX; c2y_p = eY - controlOffset; break;
                case 'E': c2x_p = eX + controlOffset; c2y_p = eY; break;
                case 'S': c2x_p = eX; c2y_p = eY + controlOffset; break;
                case 'W': c2x_p = eX - controlOffset; c2y_p = eY; break;
                default: c2x_p = eX; c2y_p = eY;
            }
            const pathD_peer = `M ${sX} ${sY} C ${c1x_p} ${c1y_p}, ${c2x_p} ${c2y_p}, ${eX} ${eY}`;
            lines.push(
              <path key={pathKey_peer} d={pathD_peer} stroke="hsl(var(--accent))" strokeWidth={CONNECTION_LINE_THICKNESS_PEER} fill="none" markerEnd="url(#arrowhead-accent)" style={{ pointerEvents: "none" }} />
            );
          }
        });
      }
    });
    return lines;
  }, [editableRoadmap, controlOffset]);

  if (authLoading || (isLoadingPlan && isValidPlanId && !planData)) {
    return <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (!planId || !isValidPlanId) {
    return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><AlertTriangle className="h-10 w-10 text-destructive mb-2" /><h1 className="text-xl font-semibold">Invalid Plan ID</h1><p className="text-muted-foreground">The plan identifier in the URL is not valid.</p><Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button></div>);
  }
  if (planError) {
    return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><AlertTriangle className="h-10 w-10 text-destructive mb-2" /><h1 className="text-xl font-semibold">Error Loading Plan</h1><p className="text-muted-foreground">{planError.message}</p><Button onClick={() => router.refresh()} className="mt-4">Try Again</Button></div>);
  }
  if (!planData && !isLoadingPlan) {
    return (<div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center"><AlertTriangle className="h-10 w-10 text-destructive mb-2" /><h1 className="text-xl font-semibold">Plan Not Found</h1><p className="text-muted-foreground">The requested plan could not be found.</p><Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button></div>);
  }

  return (
    <div className="flex flex-col flex-1 h-full">
      <h1 className="text-3xl font-bold text-center text-blue-600 p-4 bg-yellow-100 border-b-4 border-blue-700">DEBUG: PLAN PAGE UPDATED - {new Date().toLocaleTimeString()}</h1>
      {planData && canEditPlan && <p className="text-red-500 font-bold text-xl p-2 bg-yellow-100 border-b border-red-300">PAGE.TSX SAYS: YOU ARE OWNER. Plan: {planData.name}</p>}
      {!canEditPlan && planData && <p className="text-blue-500 font-bold text-xl p-2 bg-gray-100 border-b border-blue-300">PAGE.TSX SAYS: YOU ARE NOT OWNER. Plan: {planData.name}</p>}
      {isLoadingPlan && <p className="p-2 bg-gray-50">PAGE.TSX SAYS: PLAN IS LOADING...</p>}

      <PlanHeader
        planData={planData}
        ownerProfile={ownerProfile}
        canEditPlan={canEditPlan}
        onSavePlan={saveRoadmapChanges}
        isSavingPlan={savePlanSettingsMutation.isPending}
        onOpenHistory={() => setIsVersionHistorySheetOpen(true)}
        onOpenInfo={() => setIsPlanInfoDialogOpen(true)}
        onInitiateAddNode={() => handleInitiateAddNode(null)}
        diffTargetActive={!!diffTarget}
      />

      <div className="flex flex-1 items-center justify-center overflow-auto relative">
        <ScrollArea className="flex flex-1 w-full h-full">
          <div
            ref={canvasRef}
            style={{ width: '1920px', minHeight: `${canvasMinHeight}px`, position: 'relative', overflow: 'visible' }}
            className="bg-muted grid-background"
          >
            {diffTarget && (
              <div className="absolute inset-0 bg-black/60 z-20 pointer-events-auto" onClick={handleExitDiffView} aria-hidden="true" style={{ width: '100%', height: '100%' }} />
            )}
            <svg ref={svgRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'block' }} className="pointer-events-none">
              <defs>
                <marker id="arrowhead-main" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" /></marker>
                <marker id="arrowhead-accent" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--accent))" /></marker>
              </defs>
              {drawConnectionLines()}
              {activeConnectionLinePreviewRef.current?.path && (
                <path d={activeConnectionLinePreviewRef.current.path} stroke="hsl(var(--primary))" strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY} fill="none" style={{ pointerEvents: "none" }} />
              )}
            </svg>
            {editableRoadmap.map((step) => (
              <RoadmapStepCardComponent
                key={step.id}
                step={step}
                allSteps={editableRoadmap}
                onNodeInteractionStart={handleNodeInteractionStart}
                isSelected={editingTarget?.type === 'node' && editingTarget.data.id === step.id && !diffTarget}
                onEditStep={handleEditCanvasNode}
                onAddGrandchildToChildDataItem={onAddGrandchildToChildDataItem}
                onChildItemTitleClick={handleChildItemCanvasNodeFocus}
                onAddChildItemToNode={onAddChildItemToNode}
                isActuallyDraggingThisNode={nodeDragInfoRef.current?.nodeId === step.id && isDraggingRef.current}
                diffHighlight={diffTarget ? (addedNodeIds.has(step.id) ? 'added' : (persistedNodeIds.has(step.id) ? 'persisted' : undefined)) : undefined}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

       {planData && (
        <PlanInfoDialog
          isOpen={isPlanInfoDialogOpen}
          onOpenChange={setIsPlanInfoDialogOpen}
          planData={planDataForDialog} 
          ownerProfile={ownerProfile}
          isPlanOwner={canEditPlan} 
          onSaveSettings={handleSavePlanSettings}
          isSavingSettings={savePlanSettingsMutation.isPending}
          viewPermissionsSearch={viewPermissionsSearch}
          setViewPermissionsSearch={setViewPermissionsSearch}
          editPermissionsSearch={editPermissionsSearch}
          setEditPermissionsSearch={setEditPermissionsSearch}
          viewPermissionSuggestions={viewPermissionSuggestions}
          editPermissionSuggestions={editPermissionSuggestions}
          onAddUserToViewers={handleAddUserToViewers}
          onRemoveUserFromViewers={handleRemoveUserFromViewers}
          onAddUserToEditors={handleAddUserToEditors}
          onRemoveUserFromEditors={handleRemoveUserFromEditors}
          debugProp="DEBUG_PROP_FROM_PAGE_TSX_SUCCESS" // New debug prop
        />
      )}
       <AddRoadmapStepDialog
        isOpen={isAddNodeDialogOpen}
        onOpenChange={setIsAddNodeDialogOpen}
        onSubmit={(data) => handleAddNode(data, canvasRef.current)}
        isSubmitting={false} 
      />
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
        <SheetContent className="sm:max-w-[600px] w-[90vw] p-0 flex flex-col" side="left">
           {/* Version History Sheet Content */}
        </SheetContent>
      </Sheet>
       <AlertDialog open={!!nodeToDelete} onOpenChange={(open) => !open && setNodeToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Delete Node</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete the node "{nodeToDelete?.title}"?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setNodeToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteNode}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
       </AlertDialog>
       <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Restore Version</AlertDialogTitle>
                <AlertDialogDescription>Restore to version {versionToRestore?.versionNumber || ''}?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {setIsRestoreConfirmOpen(false); setVersionToRestore(null);}} disabled={restorePlanMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRestore} disabled={restorePlanMutation.isPending}>
                    {restorePlanMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirm Restore
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
