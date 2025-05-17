
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, Circle as CircleIcon, Eraser, PlusCircle, GitFork, Trash2, Move } from 'lucide-react';
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
  nodeType?: 'sector' | 'subsector' | 'industry' | 'user'; // Added 'user'
  code?: string; // NAICS code or unique ID for user shapes
}

interface WhiteboardProps {
  sectorData?: SectorWithSubSectors | null;
  onNodeClick?: (node: { code: string; type: string; text: string }) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const HORIZONTAL_SPACING = 120; // Between sub-sector blocks
const VERTICAL_SPACING = 100;   // Sector to first sub-sector
const VERTICAL_SPACING_INDUSTRY_START = 50; // Sub-sector to its first industry
const VERTICAL_SPACING_INDUSTRY_ITEM = 25; // Between stacked industries
const CANVAS_PADDING = 60;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5.0;
const ZOOM_SENSITIVITY = 0.0015; // Adjusted sensitivity

const Whiteboard: React.FC<WhiteboardProps> = (props) => {
  const { sectorData, onNodeClick } = props;
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  const whiteboardViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null); // Inner div for content
  
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const generateShapesAndDimensions = useCallback((currentSectorData: SectorWithSubSectors) => {
    const newShapes: Shape[] = [];
    let maxContentX = 0;
    let maxContentY = 0;

    const sectorId = `sector-${currentSectorData.code}`;
    const sectorShape: Shape = {
      id: sectorId,
      type: 'rectangle',
      text: `${currentSectorData.name} (${currentSectorData.code})`,
      x: CANVAS_PADDING, // Initial X, will be re-centered later
      y: CANVAS_PADDING,
      width: NODE_WIDTH + 40, // Sector node slightly wider
      height: NODE_HEIGHT,
      parentId: null,
      isFixed: true,
      nodeType: 'sector',
      code: currentSectorData.code,
    };
    newShapes.push(sectorShape);
    maxContentY = Math.max(maxContentY, sectorShape.y + sectorShape.height);

    let currentSubSectorX = CANVAS_PADDING;
    const subSectors = currentSectorData.subSectors || [];
    let maxSubSectorBlockHeight = 0;

    subSectors.forEach((sub) => {
      const subSectorId = `subsector-${sub.code}`;
      const subSectorShape: Shape = {
        id: subSectorId,
        type: 'rectangle',
        text: `${sub.name} (${sub.code})`,
        x: currentSubSectorX,
        y: sectorShape.y + sectorShape.height + VERTICAL_SPACING,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        parentId: sectorId,
        isFixed: true,
        nodeType: 'subsector',
        code: sub.code,
      };
      newShapes.push(subSectorShape);
      maxContentX = Math.max(maxContentX, subSectorShape.x + subSectorShape.width);
      let currentSubSectorHeight = subSectorShape.y + subSectorShape.height;

      let currentIndustryYOffset = subSectorShape.height + VERTICAL_SPACING_INDUSTRY_START;
      const industries = sub.industries || [];
      industries.forEach((ind) => {
        const industryId = `industry-${ind.code}-${subSectorId}`;
        const industryShape: Shape = {
          id: industryId,
          type: 'rectangle',
          text: `${ind.name} (${ind.code})`,
          x: subSectorShape.x + (subSectorShape.width / 2) - (NODE_WIDTH / 2),
          y: subSectorShape.y + currentIndustryYOffset,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          parentId: subSectorId,
          isFixed: true,
          nodeType: 'industry',
          code: ind.code,
        };
        newShapes.push(industryShape);
        currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        currentSubSectorHeight = Math.max(currentSubSectorHeight, industryShape.y + industryShape.height);
      });
      maxSubSectorBlockHeight = Math.max(maxSubSectorBlockHeight, currentSubSectorHeight);
      currentSubSectorX += NODE_WIDTH + HORIZONTAL_SPACING;
    });
    
    maxContentY = Math.max(maxContentY, maxSubSectorBlockHeight);
    const totalSubSectorsWidth = Math.max(0, (subSectors.length * NODE_WIDTH) + (Math.max(0, subSectors.length - 1) * HORIZONTAL_SPACING));
    sectorShape.x = CANVAS_PADDING + Math.max(0, (totalSubSectorsWidth / 2) - (sectorShape.width / 2));
    maxContentX = Math.max(maxContentX, sectorShape.x + sectorShape.width, currentSubSectorX - (subSectors.length > 0 ? HORIZONTAL_SPACING : 0));
    
    const finalCanvasWidth = maxContentX + CANVAS_PADDING;
    const finalCanvasHeight = Math.max(600, maxContentY + CANVAS_PADDING);

    return { newShapes, finalCanvasWidth, finalCanvasHeight };
  }, [NODE_WIDTH, NODE_HEIGHT, HORIZONTAL_SPACING, VERTICAL_SPACING, CANVAS_PADDING, VERTICAL_SPACING_INDUSTRY_START, VERTICAL_SPACING_INDUSTRY_ITEM]);


  useEffect(() => {
    if (sectorData) {
        const { newShapes, finalCanvasWidth, finalCanvasHeight } = generateShapesAndDimensions(sectorData);
        setShapes(newShapes);
        setCanvasDimensions({ width: finalCanvasWidth, height: finalCanvasHeight });

        if (whiteboardViewportRef.current) {
            const viewportWidth = whiteboardViewportRef.current.clientWidth;
            const viewportHeight = whiteboardViewportRef.current.clientHeight;
            const initialScale = 1;
            setScale(initialScale);
            setPan({
                x: (viewportWidth - finalCanvasWidth * initialScale) / 2,
                y: Math.max(CANVAS_PADDING * initialScale, (viewportHeight - finalCanvasHeight * initialScale) / 2 + (CANVAS_PADDING * initialScale) / 2)
            });
        }
    } else {
      setShapes([]);
      setCanvasDimensions({ width: 800, height: 600 });
      setPan({ x: 0, y: 0 });
      setScale(1);
    }
  }, [sectorData, generateShapesAndDimensions, CANVAS_PADDING]);

  useEffect(() => {
    if (canvasRef.current) {
        canvasRef.current.style.width = `${canvasDimensions.width}px`;
        canvasRef.current.style.height = `${canvasDimensions.height}px`;
    }
  }, [canvasDimensions]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // e.preventDefault(); // Keep this commented for now, might interfere with text selection if user-shapes were active
    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
    if (whiteboardViewportRef.current) {
      whiteboardViewportRef.current.style.cursor = 'grabbing';
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  }, [isPanning, panStart]);

  const handleMouseUpOrLeave = useCallback(() => {
    if (isPanning) {
        setIsPanning(false);
        if (whiteboardViewportRef.current) {
          whiteboardViewportRef.current.style.cursor = 'grab';
        }
    }
  }, [isPanning]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!whiteboardViewportRef.current) return;

    const rect = whiteboardViewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 1 - (e.deltaY * ZOOM_SENSITIVITY);
    const newScale = Math.min(Math.max(scale * zoomFactor, MIN_ZOOM), MAX_ZOOM);
    
    const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
    const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);
    
    setPan({ x: newPanX, y: newPanY });
    setScale(newScale);
  }, [scale, pan, ZOOM_SENSITIVITY, MIN_ZOOM, MAX_ZOOM]);

  useEffect(() => {
    const currentViewportRef = whiteboardViewportRef.current;
    if (currentViewportRef) {
        currentViewportRef.addEventListener('wheel', handleWheel as unknown as EventListener, { passive: false });
    }
    return () => {
        if (currentViewportRef) {
            currentViewportRef.removeEventListener('wheel', handleWheel as unknown as EventListener);
        }
    };
  }, [handleWheel]); // handleWheel depends on scale and pan, so it changes.


  const resetView = useCallback(() => {
    if (sectorData && whiteboardViewportRef.current && canvasDimensions.width > 0 && canvasDimensions.height > 0) {
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const viewportHeight = whiteboardViewportRef.current.clientHeight;
        const newScale = 1;
        setScale(newScale);
        setPan({
            x: (viewportWidth - canvasDimensions.width * newScale) / 2,
            y: Math.max(CANVAS_PADDING, (viewportHeight - canvasDimensions.height * newScale) / 2 + (CANVAS_PADDING * newScale) / 2)
        });
    } else if (!sectorData) { // Reset for user-drawn mode
        setPan({ x: 0, y: 0 });
        setScale(1);
        setShapes([]);
        setCanvasDimensions({ width: 800, height: 600 });
    }
  }, [sectorData, canvasDimensions, CANVAS_PADDING]);

  const handleResize = useCallback(() => {
    if (sectorData && whiteboardViewportRef.current && canvasDimensions.width > 0 && canvasDimensions.height > 0) {
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const viewportHeight = whiteboardViewportRef.current.clientHeight;
        // Simple recenter based on current scale. More sophisticated pan adjustment might be needed for perfect UX.
        setPan({
            x: (viewportWidth - canvasDimensions.width * scale) / 2,
            y: Math.max(CANVAS_PADDING * scale, (viewportHeight - canvasDimensions.height * scale) / 2 + (CANVAS_PADDING * scale) / 2)
        });
    }
  }, [sectorData, canvasDimensions, scale, CANVAS_PADDING]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);


  // --- User-shape interaction functions (kept for potential future use if sectorData is null) ---
  const addShape = (type: 'rectangle' | 'circle', parentId: string | null = null, isSister = false) => {
    if (sectorData) return; // Disable user shapes if sectorData is present
    // ... (existing addShape logic) ...
  };
  const updateShapeText = (id: string, text: string) => {
    if (sectorData) return;
    // ... (existing updateShapeText logic) ...
  };
  const deleteShape = (idToDelete: string) => {
    if (sectorData) return;
    // ... (existing deleteShape logic) ...
  };
  const clearAllUserShapes = () => {
    if (sectorData) return;
    setShapes([]);
  };
  // --- End user-shape functions ---

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
        <div className="flex items-center gap-1">
          {!sectorData && ( // Only show these if not in sector display mode
              <>
                <Button variant="outline" size="xs" onClick={() => addShape('rectangle')}>
                  <Square className="h-3 w-3 mr-1" /> Add Root
                </Button>
                <Button variant="outline" size="xs" onClick={clearAllUserShapes} className="text-destructive hover:text-destructive">
                  <Eraser className="h-3 w-3 mr-1" /> Clear
                </Button>
              </>
          )}
           <Button variant="outline" size="xs" onClick={resetView} title="Reset View">
            <Move className="h-3 w-3 mr-1" /> Reset View
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div
          ref={whiteboardViewportRef}
          className="relative w-full border rounded-md bg-muted/20 overflow-hidden cursor-grab"
          style={{ minHeight: '600px', maxHeight: '80vh' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
            <div 
              ref={canvasRef} 
              className="relative" // Width/Height set by style prop
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: '0 0', 
                // width and height are now set via useEffect based on canvasDimensions state
              }}
            >
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
                      onClick={(e) => {
                        if (e.defaultPrevented) return; 
                        console.log('[Whiteboard] Shape div clicked. Shape ID:', shape.id, 'IsFixed:', shape.isFixed, 'Has onNodeClick prop:', !!onNodeClick);
                        if (shape.isFixed && onNodeClick && shape.code && shape.nodeType) {
                          console.log('[Whiteboard] Calling onNodeClick with:', { code: shape.code, type: shape.nodeType, text: shape.text });
                          onNodeClick({
                            code: shape.code,
                            type: shape.nodeType as string, // Cast as string, server will validate
                            text: shape.text,
                          });
                        }
                      }}
                      className={cn(
                          "absolute flex flex-col items-center justify-center p-2 text-center text-xs border-2 shadow-md rounded-md transition-all duration-100",
                          shape.isFixed && "cursor-pointer select-none",
                          !shape.isFixed && "cursor-default", // Should be grab or similar if draggable
                          shape.nodeType === 'sector' && "bg-primary text-primary-foreground font-semibold border-primary-foreground/50 shadow-xl",
                          shape.nodeType === 'subsector' && "bg-secondary text-secondary-foreground border-secondary-foreground/40 shadow-lg",
                          shape.nodeType === 'industry' && "bg-card text-card-foreground border-border shadow-md",
                          shape.nodeType === 'user' && "bg-background/90 border-primary", // For user-added shapes
                          shape.type === 'circle' && !shape.isFixed && "!rounded-full"
                      )}
                      style={{
                          left: `${shape.x}px`,
                          top: `${shape.y}px`,
                          width: `${shape.width}px`,
                          height: `${shape.height}px`,
                          zIndex: 10,
                      }}
                      onMouseDown={(e) => e.stopPropagation()} // Prevent pan when clicking shape
                      onMouseEnter={() => !shape.isFixed && setHoveredShapeId(shape.id)}
                      onMouseLeave={() => !shape.isFixed && setHoveredShapeId(null)}
                    >
                    {shape.isFixed ? (
                        <span className="px-1 break-words">{shape.text}</span>
                    ) : ( // User-editable shape logic
                        <>
                        <textarea
                            value={shape.text}
                            onChange={(e) => updateShapeText(shape.id, e.target.value)}
                            placeholder={shape.type === 'rectangle' ? 'Type...' : 'Type...'}
                            className="w-full h-full resize-none bg-transparent border-none focus:ring-0 text-xs p-1 text-center flex items-center justify-center"
                            rows={2}
                            onMouseDown={(e) => e.stopPropagation()} // Prevent pan
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-2 h-5 w-5 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5"
                            onClick={(e) => { e.stopPropagation(); deleteShape(shape.id);}}
                            onMouseDown={(e) => e.stopPropagation()}
                            >
                            <Trash2 className="h-3 w-3" />
                            <span className="sr-only">Delete shape</span>
                        </Button>
                        {hoveredShapeId === shape.id && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 p-0.5 bg-background/80 border rounded-md shadow-sm" onMouseDown={(e) => e.stopPropagation()}>
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

    