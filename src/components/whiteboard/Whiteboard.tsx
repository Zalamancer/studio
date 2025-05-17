
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
  code?: string; // NAICS code
}

interface WhiteboardProps {
  sectorData?: SectorWithSubSectors | null;
  onNodeClick?: (node: { code: string; type: string; text: string }) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const HORIZONTAL_SPACING = 120;
const VERTICAL_SPACING = 100;
const VERTICAL_SPACING_INDUSTRY_START = 50;
const VERTICAL_SPACING_INDUSTRY_ITEM = 25;
const CANVAS_PADDING = 60;

const Whiteboard: React.FC<WhiteboardProps> = (props) => {
  const { sectorData } = props;
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const whiteboardViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const layoutNodes = useCallback(() => {
    if (!sectorData || !canvasRef.current) {
      setShapes([]);
      if (canvasRef.current) {
        canvasRef.current.style.width = '100%';
        canvasRef.current.style.height = '600px';
      }
      return;
    }

    const newShapes: Shape[] = [];
    let maxContentX = 0;
    let maxContentY = CANVAS_PADDING; // Start Y with padding

    // 1. Sector Node
    const sectorId = `sector-${sectorData.code}`;
    const sectorShape: Shape = {
      id: sectorId,
      type: 'rectangle',
      text: `${sectorData.name} (${sectorData.code})`,
      x: CANVAS_PADDING, // Temporary X, will be re-centered
      y: CANVAS_PADDING,
      width: NODE_WIDTH + 40,
      height: NODE_HEIGHT,
      parentId: null,
      isFixed: true,
      nodeType: 'sector',
      code: sectorData.code,
    };
    newShapes.push(sectorShape);
    maxContentY = Math.max(maxContentY, sectorShape.y + sectorShape.height);

    // 2. Sub-sectors and Industries
    let currentGlobalXForSubSector = CANVAS_PADDING;
    const subSectorY = sectorShape.y + sectorShape.height + VERTICAL_SPACING;

    const subSectors = sectorData.subSectors || [];
    let totalSubSectorsBlockWidth = 0;

    subSectors.forEach((sub, subIndex) => {
      let subSectorBlockWidth = NODE_WIDTH; // Width of this sub-sector and its industries

      const subSectorId = `subsector-${sub.code}-${subIndex}`;
      const subSectorShape: Shape = {
        id: subSectorId,
        type: 'rectangle',
        text: `${sub.name} (${sub.code})`,
        x: currentGlobalXForSubSector,
        y: subSectorY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        parentId: sectorId,
        isFixed: true,
        nodeType: 'subsector',
        code: sub.code,
      };
      newShapes.push(subSectorShape);
      maxContentY = Math.max(maxContentY, subSectorShape.y + subSectorShape.height);

      let currentIndustryY = subSectorShape.y + subSectorShape.height + VERTICAL_SPACING_INDUSTRY_START;
      const industries = sub.industries || [];
      industries.forEach((ind, indIndex) => {
        const industryId = `industry-${ind.code}-${subSectorId}-${indIndex}`;
        const industryShape: Shape = {
          id: industryId,
          type: 'rectangle',
          text: `${ind.name} (${ind.code})`,
          x: subSectorShape.x, // Centered under sub-sector
          y: currentIndustryY,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          parentId: subSectorId,
          isFixed: true,
          nodeType: 'industry',
          code: ind.code,
        };
        newShapes.push(industryShape);
        currentIndustryY += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        maxContentY = Math.max(maxContentY, industryShape.y + industryShape.height);
      });
      
      totalSubSectorsBlockWidth = currentGlobalXForSubSector + subSectorBlockWidth;
      currentGlobalXForSubSector += subSectorBlockWidth + HORIZONTAL_SPACING;
    });

    if (subSectors.length > 0) {
      totalSubSectorsBlockWidth -= HORIZONTAL_SPACING; // Remove last spacing
    } else {
      totalSubSectorsBlockWidth = sectorShape.width;
    }
    
    // Center the main sector node above the sub-sector block
    sectorShape.x = CANVAS_PADDING + (totalSubSectorsBlockWidth / 2) - (sectorShape.width / 2);
    sectorShape.x = Math.max(CANVAS_PADDING, sectorShape.x); // Ensure it doesn't go left of padding

    maxContentX = Math.max(CANVAS_PADDING + totalSubSectorsBlockWidth, sectorShape.x + sectorShape.width);
    
    setShapes(newShapes);

    if (canvasRef.current) {
      canvasRef.current.style.width = `${maxContentX + CANVAS_PADDING}px`;
      canvasRef.current.style.height = `${Math.max(600, maxContentY + CANVAS_PADDING)}px`;
    }
  }, [sectorData]);

  useEffect(() => {
    layoutNodes();
    window.addEventListener('resize', layoutNodes);
    return () => window.removeEventListener('resize', layoutNodes);
  }, [layoutNodes]);


  const addShape = (type: 'rectangle' | 'circle', parentId: string | null = null, isSister = false) => {
    if (sectorData) return;
    const newId = `shape-${Date.now()}`;
    let newX = 50;
    let newY = 50;
    let newParentId = parentId;

    if (parentId) {
      const parentShape = shapes.find(s => s.id === parentId);
      if (parentShape) {
        if (isSister) {
          newParentId = parentShape.parentId;
          const siblings = shapes.filter(s => s.parentId === newParentId);
          const lastSibling = siblings.length > 0 ? siblings[siblings.length -1] : parentShape.parentId ? shapes.find(s => s.id === parentShape.parentId) : null;
          newX = (lastSibling ? lastSibling.x + lastSibling.width : parentShape.x) + HORIZONTAL_SPACING / 2;
          newY = lastSibling ? lastSibling.y : parentShape.y;
        } else {
          newX = parentShape.x;
          newY = parentShape.y + parentShape.height + VERTICAL_SPACING / 2;
        }
      }
    } else {
      const rootNodes = shapes.filter(s => !s.parentId);
      newY = rootNodes.reduce((maxY, node) => Math.max(maxY, node.y + node.height), 0) + (rootNodes.length > 0 ? VERTICAL_SPACING / 2 : 50);
    }

    setShapes(prevShapes => [
      ...prevShapes,
      { id: newId, type, text: 'New Shape', x: newX, y: newY, width: NODE_WIDTH, height: NODE_HEIGHT, parentId: newParentId, code: `user-${newId}` },
    ]);
  };

  const updateShapeText = (id: string, text: string) => {
    if (sectorData) return;
    setShapes(prevShapes => prevShapes.map(shape => (shape.id === id ? { ...shape, text } : shape)));
  };

  const deleteShape = (idToDelete: string) => {
    if (sectorData) return;
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
    if (sectorData) return;
    setShapes([]);
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
                <Square className="h-4 w-4 mr-1" /> Add Root Rect
              </Button>
              <Button variant="outline" size="sm" onClick={() => addShape('circle')}>
                <CircleIcon className="h-4 w-4 mr-1" /> Add Root Circ
              </Button>
              <Button variant="outline" size="sm" onClick={clearAllUserShapes} className="text-destructive hover:text-destructive">
                <Eraser className="h-4 w-4 mr-1" /> Clear All
              </Button>
            </div>
        )}
      </CardHeader>
      <CardContent className="p-2">
        <div
          ref={whiteboardViewportRef}
          className="relative w-full border rounded-md bg-muted/20 overflow-auto"
          style={{ minHeight: '600px', maxHeight: '80vh' }}
        >
            <div ref={canvasRef} className="relative">
                <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}>
                    {shapes.map(shape => {
                    if (shape.parentId) {
                        const parentShape = shapes.find(s => s.id === shape.parentId);
                        if (parentShape) {
                        const parentPoint = getShapeCenter(parentShape, 'bottom');
                        const childPoint = getShapeCenter(shape, 'top');
                        
                        const verticalDistance = childPoint.y - parentPoint.y;
                        const curveFactor = Math.max(20, verticalDistance / 3.5);
                        const pathData = `M ${parentPoint.x} ${parentPoint.y} C ${parentPoint.x} ${parentPoint.y + curveFactor}, ${childPoint.x} ${childPoint.y - curveFactor}, ${childPoint.x} ${childPoint.y}`;
                        
                        return (
                            <path
                            key={`line-${shape.id}`}
                            d={pathData}
                            stroke="hsl(var(--primary) / 0.5)"
                            strokeWidth="1.5"
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
                    onClick={() => {
                      console.log('[Whiteboard] Shape div clicked. Shape ID:', shape.id, 'IsFixed:', shape.isFixed, 'Has onNodeClick prop:', !!props.onNodeClick);
                      if (shape.isFixed && props.onNodeClick && shape.code && shape.nodeType) {
                        console.log('[Whiteboard] Calling onNodeClick with:', { code: shape.code, type: shape.nodeType, text: shape.text });
                        props.onNodeClick({
                          code: shape.code,
                          type: shape.nodeType as string, // Ensure type consistency
                          text: shape.text,
                        });
                      } else if (shape.isFixed) {
                        console.log('[Whiteboard] onNodeClick not called for fixed shape. Conditions:', {
                          isFixed: shape.isFixed,
                          hasOnNodeClick: !!props.onNodeClick,
                          code: shape.code,
                          nodeType: shape.nodeType,
                        });
                      }
                    }}
                    className={cn(
                        "absolute flex flex-col items-center justify-center p-2 text-center text-xs border-2 shadow-md rounded-md",
                        shape.isFixed && "cursor-pointer select-none",
                        !shape.isFixed && "cursor-grab",
                        shape.nodeType === 'sector' && "bg-primary text-primary-foreground font-semibold border-primary-foreground/50 shadow-xl",
                        shape.nodeType === 'subsector' && "bg-secondary text-secondary-foreground border-secondary-foreground/40 shadow-lg",
                        shape.nodeType === 'industry' && "bg-card text-card-foreground border-border",
                        !shape.isFixed && "bg-background/90 border-primary",
                        shape.type === 'circle' && !shape.isFixed && "!rounded-full"
                    )}
                    style={{
                        left: `${shape.x}px`,
                        top: `${shape.y}px`,
                        width: `${shape.width}px`,
                        height: `${shape.height}px`,
                        zIndex: 10
                    }}
                    onMouseEnter={() => !shape.isFixed && setHoveredShapeId(shape.id)}
                    onMouseLeave={() => !shape.isFixed && setHoveredShapeId(null)}
                    >
                    {shape.isFixed ? (
                        <span className="px-1 break-words">{shape.text}</span>
                    ) : (
                        <>
                        <textarea
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
                            onClick={(e) => { e.stopPropagation(); deleteShape(shape.id);}} // Stop propagation
                            >
                            <Trash2 className="h-3 w-3" />
                            <span className="sr-only">Delete shape</span>
                        </Button>
                        {hoveredShapeId === shape.id && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 p-0.5 bg-background/80 border rounded-md shadow-sm">
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-primary/80 hover:text-primary" onClick={(e) => {e.stopPropagation(); addShape('rectangle', shape.id)}}>
                                <PlusCircle className="h-3.5 w-3.5" />
                                <span className="sr-only">Add Child</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-primary/80 hover:text-primary" onClick={(e) => {e.stopPropagation(); addShape('rectangle', shape.id, true)}}>
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
        </div>
      </CardContent>
    </Card>
  );
};

export default Whiteboard;

