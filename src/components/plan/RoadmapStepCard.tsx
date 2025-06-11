// src/components/plan/RoadmapStepCard.tsx
"use client";

import React, { useRef } from 'react';
import type { RoadmapStep } from '@/types/plan';
import { cn } from '@/lib/utils';

const MIN_CANVAS_PADDING = 20;
const NODE_BASE_WIDTH = 220;
const NODE_BASE_MIN_HEIGHT = 80;
const NODE_HEADER_HEIGHT = 40;
const CHILD_ITEM_HEIGHT = 28; // Includes padding/margin for each item
const FINAL_BUFFER_CARD_HEIGHT = 8;

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
    childrenDataListHeight += 8; // Padding top for list
    childrenDataListHeight += step.childrenData.length * CHILD_ITEM_HEIGHT;
    childrenDataListHeight += 8; // Padding bottom for list
  }
  
  contentAreaHeight = Math.max(descriptionHeight, childrenDataListHeight);
  if (contentAreaHeight === 0 && (!step.description || step.description.trim().length === 0) && (!Array.isArray(step.childrenData) || step.childrenData.length === 0)) { 
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
  onEditStep: (step: RoadmapStep) => void;
  onAddGrandchildToChildDataItem: (parentChildItemId: string, parentCanvasNodeIdOfChildItem: string) => void;
  onChildItemTitleClick: (childItemId: string, parentCanvasNodeId: string) => void;
  isActuallyDraggingThisNode?: boolean;
}

const RoadmapStepCard: React.FC<RoadmapStepCardProps> = React.memo(({
  step,
  allSteps,
  onNodeInteractionStart,
  isSelected,
  onEditStep,
  onAddGrandchildToChildDataItem,
  onChildItemTitleClick,
  isActuallyDraggingThisNode,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const dynamicHeight = calculateNodeHeight(step, allSteps);

  return (
    <div
      ref={cardRef}
      className={cn(
        "group/cardnode absolute select-none shadow-lg border rounded-lg flex flex-col",
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
        if ((e.target as HTMLElement).closest('[data-dot-type]') || (e.target as HTMLElement).closest('[data-child-item-dot-id]')) return;
        onNodeInteractionStart(step.id, e);
      }}
      onTouchStart={(e) => {
        if ((e.target as HTMLElement).closest('[data-dot-type]') || (e.target as HTMLElement).closest('[data-child-item-dot-id]')) return;
        onNodeInteractionStart(step.id, e);
      }}
      data-node-id={step.id}
    >
      <div 
        className="p-2 border-b border-border flex items-center justify-between cursor-move rounded-t-lg h-[40px]" 
        style={{ backgroundColor: 'hsl(var(--primary))' }} 
        onDoubleClick={() => onEditStep(step)}
      >
        <h3 className="text-sm font-semibold truncate text-primary-foreground" title={step.title}>{step.title}</h3>
        
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
      </div>
      <div 
        className="flex-grow min-h-0 p-2 text-xs space-y-1" 
        style={{ backgroundColor: 'hsl(var(--card))' }}
        // Removed onClick from here to centralize panel opening logic
      >
          {step.description && (<p className="whitespace-pre-wrap line-clamp-2 mb-1 text-foreground">{step.description}</p>)}
          
          {Array.isArray(step.childrenData) && step.childrenData.length > 0 && (
            <ul className="space-y-0.5 list-none p-0 m-0" style={{paddingTop: `8px`}}>
              {step.childrenData.map((childItem, index) => {
                const childHasOwnCanvasNode = !!(childItem.canvasNodeIdForThisItem && allSteps.some(s => s.id === childItem.canvasNodeIdForThisItem));
                
                return (
                  <li key={childItem.id} data-child-item-index={index} className="text-xs py-0.5 flex items-center justify-between group/childitemli relative pl-4">
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
                    <div className="flex items-center flex-grow min-w-0">
                      <button // Changed span to button for better accessibility and clearer click target
                        type="button"
                        className="truncate text-left hover:underline cursor-pointer data-child-item-title-button" // Added data attribute
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            onChildItemTitleClick(childItem.id, step.id); // Call new prop
                        }}
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
RoadmapStepCard.displayName = "RoadmapStepCard";

export default RoadmapStepCard;
    