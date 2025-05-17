
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, Circle as CircleIcon, Eraser, PlusCircle, GitFork, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout';

interface Shape {
  id: string;
  type: 'rectangle' | 'circle';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  isFixed?: boolean;
  nodeType?: 'sector' | 'subsector' | 'industry';
}

interface WhiteboardProps {
  sectorData?: SectorWithSubSectors | null;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const HORIZONTAL_SPACING = 80; // Increased from 50
const VERTICAL_SPACING = 120;  // Increased from 80

const Whiteboard: React.FC<WhiteboardProps> = ({ sectorData }) => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const whiteboardRef = useRef<HTMLDivElement>(null);
  const [_, rerender] = useState({}); // Force re-render for SVG lines if needed

  const layoutNodes = useCallback((currentSectorData: SectorWithSubSectors): Shape[] => {
    const newShapes: Shape[] = [];
    let currentY = 50;
    const whiteboardWidth = whiteboardRef.current?.offsetWidth || 800;

    const sectorId = `sector-${currentSectorData.code}`;
    const sectorShape: Shape = {
      id: sectorId,
      type: 'rectangle',
      text: `${currentSectorData.name} (${currentSectorData.code})`,
      x: whiteboardWidth / 2 - (NODE_WIDTH + 20) / 2, // Adjusted for slightly wider sector node
      y: currentY,
      width: NODE_WIDTH + 20, // Make sector node a bit wider
      height: NODE_HEIGHT,
      parentId: null,
      isFixed: true,
      nodeType: 'sector',
    };
    newShapes.push(sectorShape);
    currentY += NODE_HEIGHT + VERTICAL_SPACING;

    const subSectors = currentSectorData.subSectors || [];
    let maxIndustriesInRow = 0;

    subSectors.forEach(sub => {
        maxIndustriesInRow = Math.max(maxIndustriesInRow, (sub.industries || []).length);
    });
    
    const totalSubSectorsWidth = subSectors.length * NODE_WIDTH + (subSectors.length > 0 ? (subSectors.length - 1) * HORIZONTAL_SPACING : 0);
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

      const industries = sub.industries || [];
      if (industries.length > 0) {
        const industryLevelY = currentY + NODE_HEIGHT + VERTICAL_SPACING;
        const totalIndustriesWidth = industries.length * NODE_WIDTH + (industries.length > 0 ? (industries.length - 1) * HORIZONTAL_SPACING : 0);
        let industryStartX = subSectorShape.x + NODE_WIDTH / 2 - totalIndustriesWidth / 2;
        
        industries.forEach((ind, indIndex) => {
          const industryId = `industry-${ind.code}-${subSectorId}-${indIndex}`; // Ensure unique ID
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
    
    const maxY = newShapes.reduce((max, shape) => Math.max(max, shape.y + shape.height), 0);
    if (whiteboardRef.current && maxY + VERTICAL_SPACING > whiteboardRef.current.offsetHeight) {
        whiteboardRef.current.style.height = `${maxY + VERTICAL_SPACING + 40}px`;
    } else if (whiteboardRef.current && whiteboardRef.current.offsetHeight < 600 && maxY + VERTICAL_SPACING <= 600) {
        // Ensure minHeight is respected if content is small
        whiteboardRef.current.style.height = '600px';
    }


    return newShapes;
  }, []);

  useEffect(() => {
    if (sectorData) {
      const newFixedShapes = layoutNodes(sectorData);
      setShapes(newFixedShapes);
    } else {
      setShapes([]);
    }
  }, [sectorData, layoutNodes]);

  const addShape = (type: 'rectangle' | 'circle', parentId: string | null = null, isSister = false) => {
    const newId = `shape-${Date.now()}`;
    let newX = 50;
    let newY = 50;
    let newParentId = parentId;

    if (parentId) {
      const parentShape = shapes.find(s => s.id === parentId);
      if (parentShape) {
        if (isSister) {
          newParentId = parentShape.parentId; // Sister shares the same parent
          const siblings = shapes.filter(s => s.parentId === newParentId);
          const lastSibling = siblings.length > 0 ? siblings[siblings.length -1] : parentShape.parentId ? shapes.find(s => s.id === parentShape.parentId) : null;
          newX = (lastSibling ? lastSibling.x + lastSibling.width : parentShape.x) + HORIZONTAL_SPACING / 2;
          newY = lastSibling ? lastSibling.y : parentShape.y;

        } else { // Adding a child
          newX = parentShape.x;
          newY = parentShape.y + parentShape.height + VERTICAL_SPACING / 2;
        }
      }
    } else { // Root node
      const rootNodes = shapes.filter(s => !s.parentId);
      newY = rootNodes.reduce((maxY, node) => Math.max(maxY, node.y + node.height), 0) + (rootNodes.length > 0 ? VERTICAL_SPACING / 2 : 50);
    }

    setShapes(prevShapes => [
      ...prevShapes,
      { id: newId, type, text: 'New Shape', x: newX, y: newY, width: NODE_WIDTH, height: NODE_HEIGHT, parentId: newParentId },
    ]);
  };

  const updateShapeText = (id: string, text: string) => {
    setShapes(prevShapes => prevShapes.map(shape => (shape.id === id ? { ...shape, text } : shape)));
  };

  const deleteShape = (idToDelete: string) => {
    setShapes(prevShapes => {
      const shapesToDelete = new Set<string>([idToDelete]);
      let currentLevelIds = [idToDelete];
      while (currentLevelIds.length > 0) {
        const nextLevelIds: string[] = [];
        prevShapes.forEach(shape => {
          if (shape.parentId && currentLevelIds.includes(shape.parentId)) {
            shapesToDelete.add(shape.id);
            nextLevelIds.push(shape.id);
          }
        });
        currentLevelIds = nextLevelIds;
      }
      return prevShapes.filter(shape => !shapesToDelete.has(shape.id));
    });
  };

  const clearAllUserShapes = () => {
    setShapes(s => s.filter(sh => sh.isFixed));
  };

  const getShapeCenter = (shape: Shape, side: 'top' | 'bottom' | 'left' | 'right') => {
    switch(side) {
        case 'top': return { x: shape.x + shape.width / 2, y: shape.y };
        case 'bottom': return { x: shape.x + shape.width / 2, y: shape.y + shape.height };
        case 'left': return { x: shape.x, y: shape.y + shape.height / 2 };
        case 'right': return { x: shape.x + shape.width, y: shape.y + shape.height / 2 };
    }
  };

  return (
    <Card className="w-full shadow-lg border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">
          {sectorData ? `${sectorData.name} - Structure` : 'Collaborative Whiteboard'}
        </CardTitle>
        {!sectorData && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => addShape('rectangle')}>
                <Square className="h-4 w-4 mr-1" /> Add Root Rectangle
              </Button>
              <Button variant="outline" size="sm" onClick={() => addShape('circle')}>
                <CircleIcon className="h-4 w-4 mr-1" /> Add Root Circle
              </Button>
              <Button variant="outline" size="sm" onClick={clearAllUserShapes} className="text-destructive hover:text-destructive">
                <Eraser className="h-4 w-4 mr-1" /> Clear User Shapes
              </Button>
            </div>
        )}
      </CardHeader>
      <CardContent className="p-2">
        <div
          ref={whiteboardRef}
          className="relative w-full border rounded-md bg-muted/20 overflow-auto"
          style={{ minHeight: '600px' }}
          onMouseLeave={() => setHoveredShapeId(null)}
        >
          <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}>
            {shapes.map(shape => {
              if (shape.parentId) {
                const parentShape = shapes.find(s => s.id === shape.parentId);
                if (parentShape) {
                  const parentPoint = getShapeCenter(parentShape, 'bottom');
                  const childPoint = getShapeCenter(shape, 'top');
                  const midY = parentPoint.y + VERTICAL_SPACING / 2.5; // Adjusted control point for smoother curve
                  const pathData = `M ${parentPoint.x} ${parentPoint.y} C ${parentPoint.x} ${midY}, ${childPoint.x} ${midY - VERTICAL_SPACING / 5}, ${childPoint.x} ${childPoint.y}`;
                  return (
                    <path
                      key={`line-${shape.id}`}
                      d={pathData}
                      stroke="hsl(var(--primary) / 0.6)" // Slightly less opaque
                      strokeWidth="1.5" // Thinner line
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
                "absolute flex flex-col items-center justify-center p-2 text-center",
                shape.isFixed 
                  ? cn( // Fixed node styling
                      "border-2 rounded-md shadow-lg",
                      shape.nodeType === 'sector' && "bg-primary text-primary-foreground font-semibold border-primary-foreground/50",
                      shape.nodeType === 'subsector' && "bg-secondary text-secondary-foreground border-secondary-foreground/40",
                      shape.nodeType === 'industry' && "bg-muted text-muted-foreground border-muted-foreground/30"
                    )
                  : "border-2 border-primary bg-background/90 cursor-grab shadow-md rounded-md", // User-drawn node
                shape.type === 'circle' && !shape.isFixed && "!rounded-full" // User-drawn circles
              )}
              style={{
                left: `${shape.x}px`,
                top: `${shape.y}px`,
                width: `${shape.width}px`,
                height: `${shape.height}px`,
                zIndex: 10
              }}
              onMouseEnter={() => !shape.isFixed && setHoveredShapeId(shape.id)}
              // onMouseLeave={() => setHoveredShapeId(null)} // Handled by parent div to avoid flickering
            >
              {shape.isFixed ? (
                <span className="text-xs px-1 break-words select-none">{shape.text}</span>
              ) : (
                <>
                  <Textarea
                    value={shape.text}
                    onChange={(e) => updateShapeText(shape.id, e.target.value)}
                    placeholder={shape.type === 'rectangle' ? 'Type...' : 'Type...'}
                    className="w-full h-full resize-none bg-transparent border-none focus:ring-0 text-xs p-1 text-center flex items-center justify-center"
                    rows={2}
                  />
                  <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5"
                      onClick={() => deleteShape(shape.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      <span className="sr-only">Delete shape</span>
                  </Button>
                  {hoveredShapeId === shape.id && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 p-0.5 bg-background/80 border rounded-md shadow-sm">
                      <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-primary/80 hover:text-primary" onClick={() => addShape('rectangle', shape.id)}>
                        <PlusCircle className="h-3.5 w-3.5" />
                         <span className="sr-only">Add Child</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-primary/80 hover:text-primary" onClick={() => addShape('rectangle', shape.id, true)}>
                        <GitFork className="h-3.5 w-3.5" />
                        <span className="sr-only">Add Sister</span>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default Whiteboard;

