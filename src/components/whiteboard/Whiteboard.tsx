
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, Circle as CircleIcon, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout'; // Import types

interface Shape {
  id: string;
  type: 'rectangle' | 'circle'; // Could extend for 'diamond' if styling allows
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  isFixed?: boolean; // To mark predefined NAICS nodes
  nodeType?: 'sector' | 'subsector' | 'industry'; // For styling/layout
}

interface WhiteboardProps {
  sectorData?: SectorWithSubSectors | null; // Make sectorData optional
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const HORIZONTAL_SPACING = 50;
const VERTICAL_SPACING = 80;

const Whiteboard: React.FC<WhiteboardProps> = ({ sectorData }) => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const whiteboardRef = useRef<HTMLDivElement>(null);

  const layoutNodes = useCallback((currentSectorData: SectorWithSubSectors): Shape[] => {
    const newShapes: Shape[] = [];
    let currentY = 50;
    const whiteboardWidth = whiteboardRef.current?.offsetWidth || 800;

    // 1. Sector Node
    const sectorId = `sector-${currentSectorData.code}`;
    const sectorShape: Shape = {
      id: sectorId,
      type: 'rectangle', // Style as "diamond" or prominent rectangle
      text: `${currentSectorData.name} (${currentSectorData.code})`,
      x: whiteboardWidth / 2 - NODE_WIDTH / 2,
      y: currentY,
      width: NODE_WIDTH + 40, // Make sector node wider
      height: NODE_HEIGHT,
      parentId: null,
      isFixed: true,
      nodeType: 'sector',
    };
    newShapes.push(sectorShape);
    currentY += NODE_HEIGHT + VERTICAL_SPACING;

    // 2. SubSector Nodes
    const subSectors = currentSectorData.subSectors || [];
    const totalSubSectorsWidth = subSectors.length * NODE_WIDTH + (subSectors.length - 1) * HORIZONTAL_SPACING;
    let subSectorStartX = Math.max(20, whiteboardWidth / 2 - totalSubSectorsWidth / 2);

    subSectors.forEach((sub, subIndex) => {
      const subSectorId = `subsector-${sub.code}-${subIndex}`;
      const subSectorShape: Shape = {
        id: subSectorId,
        type: 'rectangle',
        text: `${sub.name} (${sub.code})`,
        x: subSectorStartX + subIndex * (NODE_WIDTH + HORIZONTAL_SPACING),
        y: currentY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        parentId: sectorId,
        isFixed: true,
        nodeType: 'subsector',
      };
      newShapes.push(subSectorShape);

      // 3. Industry Nodes
      const industries = sub.industries || [];
      if (industries.length > 0) {
        const industryLevelY = currentY + NODE_HEIGHT + VERTICAL_SPACING;
        const totalIndustriesWidth = industries.length * NODE_WIDTH + (industries.length - 1) * HORIZONTAL_SPACING;
        // Center industries under their sub-sector
        let industryStartX = subSectorShape.x + NODE_WIDTH / 2 - totalIndustriesWidth / 2;
        
        industries.forEach((ind, indIndex) => {
          const industryId = `industry-${ind.code}-${indIndex}`;
          const industryShape: Shape = {
            id: industryId,
            type: 'rectangle',
            text: `${ind.name} (${ind.code})`,
            x: industryStartX + indIndex * (NODE_WIDTH + HORIZONTAL_SPACING),
            y: industryLevelY,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            parentId: subSectorId,
            isFixed: true,
            nodeType: 'industry',
          };
          newShapes.push(industryShape);
        });
      }
    });
    
    // Adjust Y positions if many industries push content down
    const maxY = newShapes.reduce((max, shape) => Math.max(max, shape.y + shape.height), 0);
    if (whiteboardRef.current && maxY > whiteboardRef.current.offsetHeight - 20) {
        whiteboardRef.current.style.height = `${maxY + 40}px`;
    }


    return newShapes;
  }, []);

  useEffect(() => {
    if (sectorData) {
      const newFixedShapes = layoutNodes(sectorData);
      setShapes(newFixedShapes);
    } else {
      setShapes([]); // Clear shapes if no sectorData (or revert to user-editable mode if desired later)
    }
  }, [sectorData, layoutNodes]);


  const getShapeCenter = (shape: Shape, side: 'top' | 'bottom' | 'left' | 'right') => {
    switch(side) {
        case 'top': return { x: shape.x + shape.width / 2, y: shape.y };
        case 'bottom': return { x: shape.x + shape.width / 2, y: shape.y + shape.height };
        case 'left': return { x: shape.x, y: shape.y + shape.height / 2 };
        case 'right': return { x: shape.x + shape.width, y: shape.y + shape.height / 2 };
    }
  };

  // Placeholder for user-added shape logic if re-enabled later
  // const addShape = (...) => { /* if (!sectorData) { ... } */ };
  // const clearAllUserShapes = () => { /* setShapes(s => s.filter(sh => sh.isFixed)); */ };


  return (
    <Card className="w-full shadow-lg border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">
          {sectorData ? `${sectorData.name} - Structure` : 'Whiteboard'}
        </CardTitle>
        {!sectorData && ( // Only show these if not displaying fixed sector data
            <div className="flex items-center gap-2">
            {/* 
              <Button variant="outline" size="sm" onClick={() => addShape('rectangle')}>
                <Square className="h-4 w-4 mr-1" /> Add Root Rectangle
              </Button>
              <Button variant="outline" size="sm" onClick={() => addShape('circle')}>
                <CircleIcon className="h-4 w-4 mr-1" /> Add Root Circle
              </Button>
              <Button variant="outline" size="sm" onClick={clearAllUserShapes} className="text-destructive hover:text-destructive">
                <Eraser className="h-4 w-4 mr-1" /> Clear User Shapes
              </Button> 
            */}
            </div>
        )}
      </CardHeader>
      <CardContent className="p-2">
        <div
          ref={whiteboardRef}
          className="relative w-full border rounded-md bg-muted/20 overflow-auto"
          style={{ minHeight: '600px' }} // Increased min height for better layout
        >
          <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}>
            {shapes.map(shape => {
              if (shape.parentId && shape.isFixed) {
                const parentShape = shapes.find(s => s.id === shape.parentId);
                if (parentShape) {
                  const parentPoint = getShapeCenter(parentShape, 'bottom');
                  const childPoint = getShapeCenter(shape, 'top');
                  // Calculate control points for a smoother curve (simple bezier)
                  const midY = (parentPoint.y + childPoint.y) / 2;
                  const pathData = `M ${parentPoint.x} ${parentPoint.y} C ${parentPoint.x} ${midY}, ${childPoint.x} ${midY}, ${childPoint.x} ${childPoint.y}`;
                  return (
                    <path
                      key={`line-${shape.id}`}
                      d={pathData}
                      stroke="hsl(var(--primary) / 0.7)"
                      strokeWidth="2"
                      fill="none"
                    />
                  );
                }
              }
              return null;
            })}
          </svg>

          {shapes.map((shape) => (
            <div
              key={shape.id}
              className={cn(
                "absolute flex flex-col items-center justify-center p-2 border-2 shadow-md text-center",
                shape.isFixed ? "border-primary/50 bg-card" : "border-primary bg-background/90 cursor-grab",
                shape.nodeType === 'sector' ? 'border-accent ring-2 ring-accent bg-accent/10 text-accent-foreground font-semibold' : '',
                shape.nodeType === 'subsector' ? 'border-primary/70 bg-primary/5 text-primary-foreground' : '',
                shape.nodeType === 'industry' ? 'border-secondary-foreground/50 bg-secondary/10 text-secondary-foreground' : '',
                shape.type === 'rectangle' ? 'rounded-md' : 'rounded-lg' // All fixed nodes are rects for now
              )}
              style={{
                left: `${shape.x}px`,
                top: `${shape.y}px`,
                width: `${shape.width}px`,
                height: `${shape.height}px`,
                zIndex: 10
              }}
            >
              {shape.isFixed ? (
                <span className="text-xs px-1 break-words select-none">{shape.text}</span>
              ) : (
                <textarea // This part is for user-added shapes, currently not active if sectorData is present
                  value={shape.text}
                  // onChange={(e) => updateShapeText(shape.id, e.target.value)}
                  placeholder={shape.type === 'rectangle' ? 'Type...' : 'Type...'}
                  className="w-full h-full resize-none bg-transparent border-none focus:ring-0 text-sm p-1 text-center flex items-center justify-center"
                />
              )}
              {/* Removed user interaction buttons for fixed shapes */}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default Whiteboard;
