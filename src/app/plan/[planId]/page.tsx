
// src/app/plan/[planId]/page.tsx
"use client";

import React, { useEffect, useRef, useCallback, useState } from 'react'; // Added useState for canvasMinHeight
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertTriangle } from 'lucide-react';
import { PlanInfoDialog } from '@/components/plan/PlanInfoDialog';
import RoadmapStepCard from '@/components/plan/RoadmapStepCard'; // Corrected default import
import { AddRoadmapStepDialog } from '@/components/plan/AddRoadmapStepDialog';
import { EditChildItemDialog } from '@/components/plan/EditChildItemDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'; // Added missing imports for Sheet
import { Card } from '@/components/ui/card'; // Added Card import
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePlanLogic, sanitizeRoadmapStep } from './usePlanLogic'; // Import from the hook
import type { RoadmapStep, ClientPlanVersion } from '@/types/plan';
import { PlanHeader } from './PlanHeader'; // Corrected import path


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
  if (contentAreaHeight === 0 && (!step.description || step.description.trim().length === 0) && (!Array.isArray(step.childrenData) || step.childrenData.length === 0)) {
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
    editableRoadmap,
    editingTarget, setEditingTarget, isStepDetailSheetOpen, setIsStepDetailSheetOpen,
    handleNodeDetailUpdate, handleChildItemDetailUpdateInPanel,
    nodeToDelete, setNodeToDelete, confirmDeleteNode,
    handleNodeInteractionStart, activeConnectionLinePreviewRef, nodeDragInfoRef, isDraggingRef,
    handleGlobalMove, handleGlobalPointerUp, isPointerDown,
    isVersionHistorySheetOpen, setIsVersionHistorySheetOpen, planVersionsData, isLoadingVersions, refetchPlanVersions,
    handleViewChangesClick, handleExitDiffView, diffTarget, addedNodeIds, persistedNodeIds, removedNodeTitles, diffDetailsVersionId,
    isRestoreConfirmOpen, setIsRestoreConfirmOpen, versionToRestore, handleRestoreVersion, confirmRestore, restorePlanMutation,
    isAddNodeDialogOpen, setIsAddNodeDialogOpen, handleAddNode,
    childItemManagementContextRef, isEditChildItemDialogOpen, setIsEditChildItemDialogOpen, dynamicChildDialogTitle,
    defaultChildDialogTitle, setDefaultChildDialogTitle, defaultChildDialogDescription, setDefaultChildDialogDescription,
    handleChildItemDialogSubmit, handleEditChildItemText, handleDeleteChildItem,
    onAddGrandchildToChildDataItem, onAddChildItemToNode, onChildItemTitleClick: handleChildItemCanvasNodeFocus,
    canEditPlan, saveRoadmapChanges, savePlanSettingsMutation,
    handleSavePlanSettings,
    isPlanInfoDialogOpen, setIsPlanInfoDialogOpen,
    planDataForDialog,
    originalEditingChildItemData, setOriginalEditingChildItemData,
    viewPermissionsSearch, setViewPermissionsSearch, editPermissionsSearch, setEditPermissionsSearch,
    viewPermissionSuggestions, editPermissionSuggestions,
    handleAddUserToViewers, handleRemoveUserFromViewers, handleAddUserToEditors, handleRemoveUserFromEditors,
    forceRender,
    handleInitiateAddNode, // Expose handleInitiateAddNode for header
  } = usePlanLogic();

  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [canvasMinHeight, setCanvasMinHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 800);
  const controlOffset = 100;


  useEffect(() => {
    if (isPointerDown && canvasRef.current) {
      const currentCanvasRef = canvasRef.current;
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
              const endX = childNode.x;
              const endY = childNode.y + calculateNodeHeight(childNode, editableRoadmap) / 2;
              const pathKey_child = `hierarchical-${parentStep.id}-child${index}-to-${childNode.id}`;
              const c1x = startX - controlOffset / 2;
              const c1y = startY;
              const c2x = endX - controlOffset / 2;
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
  
  const augmentedPlanVersions = planVersionsData.map((version, index, array) => {
    const previousVersion = index < array.length - 1 ? array[index + 1] : null;
    return { ...version, previousVersion };
  });

  return (
    <div className="flex flex-col flex-1 h-full">
      <PlanHeader
        planData={planData}
        ownerProfile={ownerProfile}
        isLoadingOwnerProfile={isLoadingOwnerProfile}
        canEditPlan={canEditPlan}
        onSavePlan={saveRoadmapChanges}
        isSavingPlan={savePlanSettingsMutation.isPending || restorePlanMutation.isPending} // Combine pending states
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
                <marker id="arrowhead-accent" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--accent))" /></marker>
              </defs>
              {drawConnectionLines()}
              {activeConnectionLinePreviewRef.current?.path && (
                <path d={activeConnectionLinePreviewRef.current.path} stroke="hsl(var(--primary))" strokeWidth={CONNECTION_LINE_THICKNESS_HIERARCHY} fill="none" style={{ pointerEvents: "none" }} />
              )}
            </svg>
            {editableRoadmap.map((step) => (
              <RoadmapStepCard
                key={step.id}
                step={step}
                allSteps={editableRoadmap}
                onNodeInteractionStart={handleNodeInteractionStart}
                isSelected={editingTarget?.type === 'node' && editingTarget.data.id === step.id && !diffTarget}
                onEditStep={(nodeToEdit) => { setEditingTarget({ type: 'node', data: nodeToEdit }); setIsStepDetailSheetOpen(true); }}
                onAddGrandchildToChildDataItem={onAddGrandchildToChildDataItem}
                onChildItemTitleClick={handleChildItemCanvasNodeFocus}
                onAddChildItemToNode={() => onAddChildItemToNode(step.id)}
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
          debugProp="DEBUG_PROP_FROM_PAGE_TSX_SUCCESS"
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
        originalItemData={originalEditingChildItemData}
        onItemUpdated={(updatedItem) => {
           if (editingTarget?.type === 'childItem' && editingTarget.data.id === updatedItem.id) {
                handleChildItemDetailUpdateInPanel(updatedItem, editingTarget.parentNode.id);
           }
        }}
      />
      <Sheet open={isVersionHistorySheetOpen} onOpenChange={setIsVersionHistorySheetOpen}>
        <SheetContent className="sm:max-w-[600px] w-[90vw] p-0 flex flex-col" side="left">
           <SheetHeader className="p-4 border-b">
             <SheetTitle>Plan Version History</SheetTitle>
             <SheetDescription>Review past versions of this plan. You can view changes or restore a previous version.</SheetDescription>
           </SheetHeader>
           <ScrollArea className="flex-1">
             <div className="p-4 space-y-3">
                {isLoadingVersions && <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>}
                {!isLoadingVersions && augmentedPlanVersions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No version history available.</p>}
                {augmentedPlanVersions.map((version) => (
                  <Card key={version.id} className={cn("p-3", diffDetailsVersionId === version.id && "ring-2 ring-primary")}>
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium">Version {version.versionNumber}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(version.timestamp), 'PPp')}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Edited by: {version.editorDisplayName || 'Unknown User'}</p>
                    <div className="flex gap-2">
                      <Button size="xs" variant="outline" onClick={() => handleViewChangesClick(version, version.previousVersion)}>
                        {diffDetailsVersionId === version.id ? 'Viewing Diff' : 'View Changes'}
                      </Button>
                      {canEditPlan && (
                        <Button size="xs" variant="destructive" onClick={() => handleRestoreVersion(version)} disabled={restorePlanMutation.isPending && versionToRestore?.id === version.id}>
                            {restorePlanMutation.isPending && versionToRestore?.id === version.id ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : null}
                            Restore
                        </Button>
                      )}
                    </div>
                    {diffDetailsVersionId === version.id && removedNodeTitles.length > 0 && (
                       <div className="mt-2 p-2 bg-destructive/10 rounded-md">
                           <p className="text-xs font-medium text-destructive">Removed Steps in this version:</p>
                           <ul className="list-disc list-inside pl-2 text-xs text-destructive/80">
                               {removedNodeTitles.map((title, idx) => <li key={idx} className="truncate">{title}</li>)}
                           </ul>
                       </div>
                    )}
                  </Card>
                ))}
             </div>
           </ScrollArea>
           <SheetFooter className="p-4 border-t">
              <Button variant="outline" onClick={() => setIsVersionHistorySheetOpen(false)}>Close</Button>
           </SheetFooter>
        </SheetContent>
      </Sheet>
       <AlertDialog open={!!nodeToDelete} onOpenChange={(open) => !open && setNodeToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Delete Step</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete the step "{nodeToDelete?.title}"? Any child items directly under it will also be removed. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setNodeToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteNode} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
       </AlertDialog>
       <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Restore Version</AlertDialogTitle>
                <AlertDialogDescription>
                  Restoring to version {versionToRestore?.versionNumber || ''} (from {versionToRestore ? format(new Date(versionToRestore.timestamp), 'PPp') : ''}) will overwrite the current plan structure.
                  The current state will be saved as a new version before restoring. Are you sure?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {setIsRestoreConfirmOpen(false); setVersionToRestore(null);}} disabled={restorePlanMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRestore} disabled={restorePlanMutation.isPending} className="bg-destructive hover:bg-destructive/90">
                    {restorePlanMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirm Restore
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

