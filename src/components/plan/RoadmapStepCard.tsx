
// src/components/plan/RoadmapStepCard.tsx
"use client";

import React, { useRef } from 'react';
import type { RoadmapStep } from '@/types/plan';
import { cn } from '@/lib/utils';
// CardHeader, CardTitle, CardContent are not directly used from ui/card but divs are styled similarly
// We will use div elements and style them appropriately.

const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const NODE_BASE_MIN_HEIGHT = 80;
const NODE_HEADER_HEIGHT = 40; // Standardized header height
const CHILD_ITEM_HEIGHT = 28; // Includes padding/margin for each item
const FINAL_BUFFER_CARD_HEIGHT = 8; // Consistent buffer at the bottom of the card

const calculateNodeHeight = (step: RoadmapStep, allSteps: RoadmapStep[]): number => {
  let height = NODE_HEADER_HEIGHT;
  let contentAreaHeight = 0;

  // No description on card, so descriptionHeight is effectively 0 for card rendering.
  // Description is shown in the side panel.

  let childrenDataListHeight = 0;
  if (Array.isArray(step.childrenData) && step.childrenData.length > 0) {
    childrenDataListHeight += 8; // Padding top for list
    childrenDataListHeight += step.childrenData.length * CHILD_ITEM_HEIGHT;
    childrenDataListHeight += 8; // Padding bottom for list
  }
  
  contentAreaHeight = childrenDataListHeight;
  // If there are no children and no description (which is already excluded for card height),
  // give a minimum content area so card doesn't look too empty.
  if (contentAreaHeight === 0 && (!Array.isArray(step.childrenData) || step.childrenData.length === 0)) { 
      contentAreaHeight = 20; 
  }

  height += contentAreaHeight;
  height += FINAL_BUFFER_CARD_HEIGHT; 
  return Math.max(NODE_BASE_MIN_HEIGHT, height);
};

interface RoadmapStepCardProps {
  step: RoadmapStep;
  allSteps: RoadmapStep[];
  onNodeInteractionStart: (nodeId: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isDotDrag?: boolean, dotType?: 'N' | 'E' | 'S') => void;
  isSelected?: boolean;
  onEditStep: (step: RoadmapStep) => void; // This function should open the panel
  onAddGrandchildToChildDataItem: (parentChildItemId: string, parentCanvasNodeIdOfChildItem: string) => void;
  onChildItemTitleClick: (childItemId: string, parentCanvasNodeId: string) => void;
  onAddChildItemToNode: (parentNodeId: string) => void; // Add this prop
  isActuallyDraggingThisNode?: boolean;
  diffHighlight?: 'added' | 'persisted';
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  allSteps,
  onNodeInteractionStart,
  isSelected,
  onEditStep,
  onAddGrandchildToChildDataItem,
  onChildItemTitleClick,
  onAddChildItemToNode, // Destructure new prop
  isActuallyDraggingThisNode,
  diffHighlight,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const dynamicHeight = calculateNodeHeight(step, allSteps);

  const cardClasses = cn(
    "group/cardnode absolute select-none shadow-lg border rounded-lg flex flex-col bg-card text-card-foreground", // Ensure bg-card and text-card-foreground are applied
    isSelected ? "ring-2 ring-primary shadow-2xl z-20" : "border-border hover:shadow-xl z-10 shadow-sm",
    isActuallyDraggingThisNode ? 'cursor-grabbing shadow-2xl z-30' : 'cursor-grab',
    diffHighlight === 'added' && 'border-green-500 ring-2 ring-green-300 shadow-green-500/30 z-30',
    diffHighlight === 'persisted' && 'border-gray-400 opacity-70 z-30'
  );
  
  const headerClasses = cn(
    "p-2 border-b border-border flex items-center justify-between rounded-t-lg h-[40px] cursor-pointer", // Added cursor-pointer here
    diffHighlight === 'added' ? 'bg-green-600 text-white' : diffHighlight === 'persisted' ? 'bg-gray-500 text-gray-100' : 'bg-primary text-primary-foreground'
  );

  return (
    <div
      ref={cardRef}
      className={cardClasses}
      style={{
        left: `${step.x}px`,
        top: `${step.y}px`,
        width: `${NODE_BASE_WIDTH}px`,
        height: `${dynamicHeight}px`,
        touchAction: diffHighlight ? 'auto' : 'none', 
        pointerEvents: diffHighlight ? 'none' : 'auto', 
        zIndex: diffHighlight ? 30 : (isSelected ? 20 : (isActuallyDraggingThisNode ? 30 : 10)),
      }}
      onMouseDown={(e) => {
        if (diffHighlight) return;
        if ((e.target as HTMLElement).closest('[data-dot-type]') || (e.target as HTMLElement).closest('[data-child-item-dot-id]') || (e.target as HTMLElement).closest('[data-action-button="add-child"]')) return;
        // Check if the click is on the header area BUT NOT on an interactive element within it (like dots)
        if (!((e.target as HTMLElement).closest('[data-header-clickable]') && (e.target as HTMLElement).closest('[data-dot-type]'))) {
          onNodeInteractionStart(step.id, e);
        }
      }}
      onTouchStart={(e) => {
        if (diffHighlight) return;
        if ((e.target as HTMLElement).closest('[data-dot-type]') || (e.target as HTMLElement).closest('[data-child-item-dot-id]') || (e.target as HTMLElement).closest('[data-action-button="add-child"]')) return;
         if (!((e.target as HTMLElement).closest('[data-header-clickable]') && (e.target as HTMLElement).closest('[data-dot-type]'))) {
          onNodeInteractionStart(step.id, e);
        }
      }}
      data-node-id={step.id}
    >
      <div
        data-header-clickable 
        className={headerClasses}
        onClick={(e) => {
          if (diffHighlight) return;
          if (
            !(e.target as HTMLElement).closest('[data-dot-type]') &&
            !(e.target as HTMLElement).closest('[data-action-button="add-child"]')
          ) {
            e.stopPropagation(); 
            onEditStep(step);
          }
        }}
      >
        <h3 className="text-sm font-semibold truncate flex-grow" title={step.title}>{step.title}</h3>
        
        {!diffHighlight && (
          <button
            data-action-button="add-child"
            title="Add child item to this step"
            className={cn(
              "p-0.5 rounded-full hover:bg-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ml-auto flex-shrink-0",
               diffHighlight === 'added' ? 'text-white hover:bg-green-700/80' : 
               diffHighlight === 'persisted' ? 'text-gray-100 hover:bg-gray-600/80' :
               'text-primary-foreground hover:bg-primary-foreground/10'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onAddChildItemToNode(step.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span className="sr-only">Add child item</span>
          </button>
        )}

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
        className={cn("flex-grow min-h-0 p-2 text-xs space-y-1 overflow-y-auto",
                   diffHighlight === 'persisted' && 'opacity-80')}
        style={{ backgroundColor: 'hsl(var(--card))' }}
      >
          
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
                        className={cn("truncate text-left data-child-item-title-button text-card-foreground", !diffHighlight && "hover:underline cursor-pointer")}
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
          {/* REMOVED: Placeholder text for no child items */}
      </div>
    </div>
  );
});
RoadmapStepCard.displayName = "RoadmapStepCard";

export default RoadmapStepCard;
