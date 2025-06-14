
// src/app/plan/[planId]/page.tsx
"use client";

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertTriangle, Info, Trash2, Edit3, PlusCircle, MessageCircle, Eye, Link as LinkIcon, CalendarDays, DollarSign, ListChecks, Layers, ExternalLinkIcon } from 'lucide-react'; // Added icons
import { PlanInfoDialog } from '@/components/plan/PlanInfoDialog';
import RoadmapStepCard from '@/components/plan/RoadmapStepCard';
import { AddRoadmapStepDialog } from '@/components/plan/AddRoadmapStepDialog';
import { EditChildItemDialog } from '@/components/plan/EditChildItemDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card'; // Added CardContent
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"; // For Node Detail form
import { Input } from "@/components/ui/input"; // For Node Detail form
import { Label } from "@/components/ui/label"; 
import { FormLabel } from "@/components/ui/form"; 
import { Textarea } from "@/components/ui/textarea"; 
import { useForm } from 'react-hook-form'; 
import { zodResolver } from '@hookform/resolvers/zod'; 
import * as z from 'zod'; 
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePlanLogic, sanitizeRoadmapStep } from './usePlanLogic';
import type { RoadmapStep, ClientPlanVersion, ChildDataItem, PeerConnection } from '@/types/plan';
import { PlanHeader } from './PlanHeader';
import { useToast } from '@/hooks/use-toast';

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

const nodeDetailFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title cannot exceed 100 characters"),
  description: z.string().max(1000, "Description cannot exceed 1000 characters").optional(),
});
type NodeDetailFormData = z.infer<typeof nodeDetailFormSchema>;


export default function PlanDetailPage() {
  const {
    user, authLoading, planId, isValidPlanId,
    planData, isLoadingPlan, planError, ownerProfile, isLoadingOwnerProfile,
    editableRoadmap, 
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
    isAddNodeDialogOpen, setIsAddNodeDialogOpen, handleAddNode,
    childItemManagementContextRef, isEditChildItemDialogOpen, setIsEditChildItemDialogOpen, isChildItemDialogSubmitting, dynamicChildDialogTitle,
    defaultChildDialogTitle, setDefaultChildDialogTitle, defaultChildDialogDescription, setDefaultChildDialogDescription,
    handleChildItemDialogSubmit, handleEditChildItemText, handleDeleteChildItem,
    onAddGrandchildToChildDataItem, onAddChildItemToNode, onChildItemTitleClick,
    canEditPlan, saveRoadmapChanges, savePlanSettingsMutation, saveRoadmapMutation,
    handleSavePlanSettings,
    isPlanInfoDialogOpen, setIsPlanInfoDialogOpen,
    planDataForDialog,
    originalEditingChildItemData, setOriginalEditingChildItemData, 
    viewPermissionsSearch, setViewPermissionsSearch, editPermissionsSearch, setEditPermissionsSearch,
    viewPermissionSuggestions, editPermissionSuggestions,
    handleAddUserToViewers, handleRemoveUserFromViewers, handleAddUserToEditors, handleRemoveUserFromEditors,
    forceRender,
    handleInitiateAddNode,
    handleEditCanvasNode,
    setIsChildItemDialogSubmitting, 
  } = usePlanLogic();

  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [canvasMinHeight, setCanvasMinHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 800);
  const controlOffset = 100; 

  const nodeDetailForm = useForm<NodeDetailFormData>({
    resolver: zodResolver(nodeDetailFormSchema),
    defaultValues: { title: '', description: '' },
  });
  
  const { toast } = useToast();
  

  useEffect(() => {
    console.log(`[PlanDetailPage] Editing target changed. Type: ${editingTarget?.type}, Data ID: ${editingTarget?.type === 'node' ? editingTarget.data.id : (editingTarget?.type === 'childItem' ? editingTarget.data.id : 'N/A')}`);
    if (editingTarget?.type === 'node') {
      nodeDetailForm.reset({
        title: editingTarget.data.title,
        description: editingTarget.data.description || '',
      });
    } else if (editingTarget?.type === 'childItem') {
      const childItemAsNode = editableRoadmap.find(node => node.id === editingTarget.data.canvasNodeIdForThisItem);
      if (childItemAsNode) { 
        nodeDetailForm.reset({
          title: childItemAsNode.title,
          description: childItemAsNode.description || '',
        });
      } else { 
        nodeDetailForm.reset({ 
            title: editingTarget.data.title, 
            description: editingTarget.data.description || '' 
        });
      }
    }
  }, [editingTarget, nodeDetailForm, editableRoadmap]);


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
              const endX = childNode.x + NODE_BASE_WIDTH; // Connect to the RIGHT side of the child node
              const endY = childNode.y + calculateNodeHeight(childNode, editableRoadmap) / 2; 
              const pathKey_child = `hierarchical-${parentStep.id}-child${index}-to-${childNode.id}`;
              const c1x = startX - controlOffset / 2; 
              const c1y = startY;
              // Adjust c2x based on the new endX. If endX is to the right, handle should be to its right.
              // Since the child node is spawned to the left, startX will typically be > endX.
              // The curve should approach the right edge of the child node from its left.
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
  
  console.log(
    `[PlanDetailPage] Rendering. isStepDetailSheetOpen: ${isStepDetailSheetOpen}, editingTarget type: ${editingTarget?.type}, editingTarget ID: ${editingTarget?.type === 'node' ? editingTarget.data.id : (editingTarget?.type === 'childItem' ? editingTarget.data.id : 'N/A')}`
  );

  return (
    <div className="flex flex-col flex-1 h-full">
      <PlanHeader
        planData={planData}
        ownerProfile={ownerProfile}
        isLoadingOwnerProfile={isLoadingOwnerProfile}
        canEditPlan={canEditPlan}
        onSavePlan={saveRoadmapChanges}
        isSavingPlan={savePlanSettingsMutation.isPending || restorePlanMutation.isPending || saveRoadmapMutation.isPending}
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
                onEditStep={handleEditCanvasNode} 
                onAddGrandchildToChildDataItem={onAddGrandchildToChildDataItem}
                onChildItemTitleClick={onChildItemTitleClick}
                onAddChildItemToNode={() => onAddChildItemToNode(step.id)}
                isActuallyDraggingThisNode={nodeDragInfoRef.current?.nodeId === step.id && isDraggingRef.current}
                diffHighlight={diffTarget ? (addedNodeIds.has(step.id) ? 'added' : (persistedNodeIds.has(step.id) ? 'persisted' : undefined)) : undefined}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {planDataForDialog && (
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
        isSubmitting={isChildItemDialogSubmitting}
        dialogTitle={dynamicChildDialogTitle}
        defaultTitle={defaultChildDialogTitle}
        defaultDescription={defaultChildDialogDescription}
        originalItemData={originalEditingChildItemData}
        onItemUpdated={(updatedItem) => {
           if (childItemManagementContextRef.current?.operation === 'edit' && childItemManagementContextRef.current.itemToEditId === updatedItem.id) {
                handleChildItemDetailUpdateInPanel(updatedItem, childItemManagementContextRef.current.parentNodeId);
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

      <Sheet
        open={isStepDetailSheetOpen && (editingTarget?.type === 'node' || (editingTarget?.type === 'childItem' && !!editingTarget.data.canvasNodeIdForThisItem) || (editingTarget?.type === 'childItem' && !editingTarget.data.canvasNodeIdForThisItem))}
        onOpenChange={async (open) => {
          if (!open) {
            if (initialPanelDataRef.current && editingTarget && (editingTarget.type === 'node' || editingTarget.type === 'childItem')) {
                const currentValues = nodeDetailForm.getValues();
                if (currentValues.title !== initialPanelDataRef.current.title || (currentValues.description || '') !== (initialPanelDataRef.current.description || '')) {
                   if (canEditPlan && !diffTarget) {
                       try {
                           await nodeDetailForm.handleSubmit(onNodeDetailPanelSubmit)();
                           // Toast is now handled within onNodeDetailPanelSubmit in usePlanLogic
                       } catch (submitError) {
                           console.error("Error submitting node details on panel close:", submitError);
                           toast({ variant: "destructive", title: "Save Error", description: "Could not auto-save step details." });
                       }
                   } else if (!canEditPlan) {
                       toast({ variant: "default", title: "Changes Not Saved", description: "You do not have permission to edit this plan." });
                   } else if (diffTarget) {
                       toast({ variant: "default", title: "Changes Not Saved", description: "Cannot edit while viewing a historical version."});
                   }
                }
            }
            setIsStepDetailSheetOpen(false);
            setEditingTarget(null);
            initialPanelDataRef.current = null; 
          } else {
            setIsStepDetailSheetOpen(true);
          }
        }}
        disableAnimation={true}
      >
        <SheetContent className="w-[400px] sm:w-[540px] p-0 flex flex-col" side="right" disableAnimation={true}>
          {(editingTarget?.type === 'node' || (editingTarget?.type === 'childItem' && editingTarget.data.canvasNodeIdForThisItem) || (editingTarget?.type === 'childItem' && !editingTarget.data.canvasNodeIdForThisItem) ) && (
            <>
              <SheetHeader className="p-4 border-b">
                <div className="flex justify-between items-center">
                   <SheetTitle className="flex items-center gap-2">
                       <Layers className="h-5 w-5 text-primary"/>
                       {editingTarget.type === 'node' || editingTarget.data.canvasNodeIdForThisItem ? "Edit Step Details" : "Edit Item Details"}
                   </SheetTitle>
                   {(editingTarget.type === 'node' || editingTarget.data.canvasNodeIdForThisItem) && (
                     <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
                        if (editingTarget.type === 'node') setNodeToDelete(editingTarget.data);
                        else if (editingTarget.type === 'childItem' && editingTarget.data.canvasNodeIdForThisItem) {
                             const node = editableRoadmap.find(n => n.id === editingTarget.data.canvasNodeIdForThisItem);
                             if (node) setNodeToDelete(node);
                        }
                     }}>
                         <Trash2 className="h-4 w-4"/>
                         <span className="sr-only">Delete Step</span>
                     </Button>
                   )}
                </div>
                 <SheetDescription>Modify the title and description for this item.</SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                   <Form {...nodeDetailForm}>
                     <form 
                        onSubmit={nodeDetailForm.handleSubmit(onNodeDetailPanelSubmit)}
                        className="space-y-4"
                     >
                       <FormField control={nodeDetailForm.control} name="title" render={({ field }) => (
                         <FormItem>
                           <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                           <FormControl><Input {...field} disabled={!canEditPlan || diffTarget} /></FormControl>
                           <FormMessage />
                         </FormItem>
                       )} />
                       <FormField control={nodeDetailForm.control} name="description" render={({ field }) => (
                         <FormItem>
                           <FormLabel>Description</FormLabel>
                           <FormControl><Textarea {...field} rows={5} disabled={!canEditPlan || diffTarget} placeholder="Provide more details about this step..." /></FormControl>
                           <FormMessage />
                         </FormItem>
                       )} />
                     </form>
                   </Form>

                   {editingTarget?.type === 'node' && editingTarget.data.childrenData && editingTarget.data.childrenData.length > 0 && (
                     <div className="pt-4 border-t">
                       <Label className="text-sm font-semibold flex items-center gap-1 mb-2"><ListChecks className="h-4 w-4 text-muted-foreground"/>Child Items</Label>
                       <div className="space-y-2">
                         {editingTarget.data.childrenData.map(child => (
                           <Card key={child.id} className="p-2 bg-muted/50 shadow-sm">
                             <div className="flex justify-between items-center">
                               <span className="text-xs text-foreground truncate flex-grow cursor-pointer hover:underline" onClick={() => handleEditChildItemText(child, editingTarget.data.id)} title={child.title}>
                                 {child.title}
                               </span>
                               <div className="flex items-center flex-shrink-0">
                                {child.canvasNodeIdForThisItem && (
                                    <Link href={`#node-${child.canvasNodeIdForThisItem}`} onClick={(e) => {e.preventDefault(); document.getElementById(`node-${child.canvasNodeIdForThisItem}`)?.scrollIntoView({behavior: 'smooth', block: 'center'});}} className="p-1 hover:bg-accent rounded-sm" title="View on Canvas">
                                        <ExternalLinkIcon className="h-3 w-3 text-primary"/>
                                    </Link>
                                 )}
                                 <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-blue-600 hover:text-blue-700" onClick={() => handleEditChildItemText(child, editingTarget.data.id)} title="Edit Text">
                                   <Edit3 className="h-3 w-3"/>
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-destructive hover:text-destructive" onClick={() => handleDeleteChildItem(child.id, editingTarget.data.id)} title="Delete Item">
                                   <Trash2 className="h-3 w-3"/>
                                 </Button>
                               </div>
                             </div>
                             {child.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{child.description}</p>}
                           </Card>
                         ))}
                       </div>
                     </div>
                   )}
                   {editingTarget?.type === 'node' && (
                     <Button
                       variant="outline" size="sm" className="w-full mt-3"
                       onClick={() => onAddChildItemToNode(editingTarget.data.id)}
                       disabled={!canEditPlan || diffTarget}
                     >
                       <PlusCircle className="mr-2 h-4 w-4"/>Add Child Item
                     </Button>
                   )}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
    
    

