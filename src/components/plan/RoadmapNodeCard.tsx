
// src/components/plan/RoadmapNodeCard.tsx
"use client";

import React from 'react';
import type { RoadmapStep } from '@/types/plan'; // Assuming RoadmapStep is in plan types
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface RoadmapNodeCardProps {
  step: RoadmapStep;
  onNodeMouseDown: (
    stepId: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => void;
  isDragging?: boolean;
}

export const RoadmapNodeCard: React.FC<RoadmapNodeCardProps> = ({
  step,
  onNodeMouseDown,
  isDragging,
}) => {
  return (
    <Card
      className={cn(
        "absolute select-none shadow-lg border border-border rounded-lg",
        isDragging ? 'cursor-grabbing shadow-2xl z-10' : 'cursor-grab hover:shadow-xl',
        'bg-card text-card-foreground w-[200px] min-h-[80px]' // Example fixed width, min-height
      )}
      style={{
        left: `${step.x}px`,
        top: `${step.y}px`,
        touchAction: 'none', // Important for preventing page scroll on touch devices during drag
      }}
      onMouseDown={(e) => onNodeMouseDown(step.id, e)}
      data-node-id={step.id}
    >
      <CardHeader className="p-2 border-b">
        <CardTitle className="text-sm font-semibold truncate" title={step.title}>
          {step.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {step.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {step.description}
          </p>
        )}
        {(!step.description && (!step.subSteps || step.subSteps.length === 0)) && (
            <p className="text-xs text-muted-foreground italic">No description or sub-steps.</p>
        )}
        {step.subSteps && step.subSteps.length > 0 && (
          <div className="mt-1">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Sub-steps:</p>
            <ul className="list-disc list-inside pl-1 space-y-0.5">
              {step.subSteps.slice(0, 2).map((sub, index) => (
                <li key={sub.id || index} className="text-xs text-muted-foreground truncate">
                  {sub.title}
                </li>
              ))}
              {step.subSteps.length > 2 && (
                <li className="text-xs text-muted-foreground/70 italic">
                  ...and {step.subSteps.length - 2} more
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
