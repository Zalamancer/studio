
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, Circle as CircleIcon, Eraser, PlusCircle, GitFork, Trash2, Move, Eye } from 'lucide-react'; // Added Eye
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
  nodeType?: 'sector' | 'subsector' | 'industry' | 'user';
  code?: string;
  actualData?: SubSector | Industry; // To store the original object for focused view
}

interface FocusNodeDetails {
  code: string;
  type: 'sector' | 'subsector' | 'industry';
  name: string;
}

interface WhiteboardProps {
  sectorData?: SectorWithSubSectors | null; // Full data for the main sector of the page
  focusNodeDetails?: FocusNodeDetails | null; // Node to focus on
  onNodeClick?: (node: { code: string; type: string; text: string }) => void;
  // onFocusReset?: () => void; // If reset button were part of whiteboard
}


const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const HORIZONTAL_SPACING = 120;
const VERTICAL_SPACING = 100;
const VERTICAL_SPACING_INDUSTRY_START = 50;
const VERTICAL_SPACING_INDUSTRY_ITEM = 25;
const CANVAS_PADDING = 60;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5.0;
const ZOOM_SENSITIVITY = 0.0015;

const Whiteboard: React.FC<WhiteboardProps> = (props) => {
  const { sectorData, focusNodeDetails, onNodeClick } = props;
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [userShapes, setUserShapes] = useState<Shape[]>([]); // For user-added shapes in focused view
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  const whiteboardViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const generateShapesAndDimensions = useCallback((currentSector: SectorWithSubSectors, currentFocus: FocusNodeDetails | null) => {
    const newShapes: Shape[] = [];
    let maxContentX = 0;
    let maxContentY = 0;
    let rootNode: Shape | null = null;

    const effectiveFocus = currentFocus || { code: currentSector.code, type: 'sector', name: currentSector.name };

    if (effectiveFocus.type === 'sector') {
      // Display full sector hierarchy
      const sectorShape: Shape = {
        id: `sector-${currentSector.code}`,
        type: 'rectangle',
        text: `${currentSector.name} (${currentSector.code})`,
        x: CANVAS_PADDING,
        y: CANVAS_PADDING,
        width: NODE_WIDTH + 40,
        height: NODE_HEIGHT,
        parentId: null,
        isFixed: true,
        nodeType: 'sector',
        code: currentSector.code,
      };
      newShapes.push(sectorShape);
      rootNode = sectorShape;
      maxContentY = Math.max(maxContentY, sectorShape.y + sectorShape.height);

      let currentSubSectorX = CANVAS_PADDING;
      const subSectors = currentSector.subSectors || [];
      let maxSubSectorBlockHeight = sectorShape.y + sectorShape.height + VERTICAL_SPACING;

      subSectors.forEach((sub) => {
        const subSectorId = `subsector-${sub.code}`;
        const subSectorShape: Shape = {
          id: subSectorId, type: 'rectangle', text: `${sub.name} (${sub.code})`,
          x: currentSubSectorX, y: sectorShape.y + sectorShape.height + VERTICAL_SPACING,
          width: NODE_WIDTH, height: NODE_HEIGHT, parentId: sectorShape.id,
          isFixed: true, nodeType: 'subsector', code: sub.code, actualData: sub
        };
        newShapes.push(subSectorShape);
        maxContentX = Math.max(maxContentX, subSectorShape.x + subSectorShape.width);
        let currentIndustriesY = subSectorShape.y + NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;

        (sub.industries || []).forEach((ind) => {
          const industryId = `industry-${ind.code}-${subSectorId}`;
          const industryShape: Shape = {
            id: industryId, type: 'rectangle', text: `${ind.name} (${ind.code})`,
            x: subSectorShape.x + (NODE_WIDTH / 2) - (NODE_WIDTH / 2), // Centered under sub-sector
            y: currentIndustriesY,
            width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorId,
            isFixed: true, nodeType: 'industry', code: ind.code, actualData: ind
          };
          newShapes.push(industryShape);
          currentIndustriesY += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        });
        maxSubSectorBlockHeight = Math.max(maxSubSectorBlockHeight, currentIndustriesY - VERTICAL_SPACING_INDUSTRY_ITEM);
        currentSubSectorX += NODE_WIDTH + HORIZONTAL_SPACING;
      });
      maxContentY = Math.max(maxContentY, maxSubSectorBlockHeight);
      const totalSubSectorsWidth = Math.max(0, (subSectors.length * NODE_WIDTH) + (Math.max(0, subSectors.length - 1) * HORIZONTAL_SPACING));
      sectorShape.x = CANVAS_PADDING + Math.max(0, (totalSubSectorsWidth / 2) - (sectorShape.width / 2));
      maxContentX = Math.max(maxContentX, sectorShape.x + sectorShape.width, currentSubSectorX - (subSectors.length > 0 ? HORIZONTAL_SPACING : 0));

    } else if (effectiveFocus.type === 'subsector') {
      const focusedSubSector = currentSector.subSectors.find(ss => ss.code === effectiveFocus.code);
      if (focusedSubSector) {
        const subSectorShape: Shape = {
          id: `subsector-${focusedSubSector.code}-focused`, type: 'rectangle', text: `${focusedSubSector.name} (${focusedSubSector.code})`,
          x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null,
          isFixed: true, nodeType: 'subsector', code: focusedSubSector.code, actualData: focusedSubSector
        };
        newShapes.push(subSectorShape);
        rootNode = subSectorShape;
        maxContentX = Math.max(maxContentX, subSectorShape.x + subSectorShape.width);
        let currentIndustriesY = subSectorShape.y + NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;
        (focusedSubSector.industries || []).forEach((ind) => {
          const industryShape: Shape = {
            id: `industry-${ind.code}-focused`, type: 'rectangle', text: `${ind.name} (${ind.code})`,
            x: subSectorShape.x + (subSectorShape.width / 2) - (NODE_WIDTH / 2), y: currentIndustriesY,
            width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorShape.id,
            isFixed: true, nodeType: 'industry', code: ind.code, actualData: ind
          };
          newShapes.push(industryShape);
          currentIndustriesY += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        });
        maxContentY = Math.max(maxContentY, currentIndustriesY - VERTICAL_SPACING_INDUSTRY_ITEM);
      }
    } else if (effectiveFocus.type === 'industry') {
      let focusedIndustry: Industry | undefined;
      currentSector.subSectors.forEach(ss => {
        const ind = ss.industries.find(i => i.code === effectiveFocus.code);
        if (ind) focusedIndustry = ind;
      });
      if (focusedIndustry) {
        const industryShape: Shape = {
          id: `industry-${focusedIndustry.code}-focused`, type: 'rectangle', text: `${focusedIndustry.name} (${focusedIndustry.code})`,
          x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null,
          isFixed: true, nodeType: 'industry', code: focusedIndustry.code, actualData: focusedIndustry
        };
        newShapes.push(industryShape);
        rootNode = industryShape;
        maxContentX = Math.max(maxContentX, industryShape.x + industryShape.width);
        maxContentY = Math.max(maxContentY, industryShape.y + industryShape.height);
      }
    }
    
    // Center the root node of the current view if it exists
    if (rootNode && newShapes.length > 0) {
        let minX = Infinity, maxX = -Infinity;
        newShapes.forEach(s => {
            minX = Math.min(minX, s.x);
            maxX = Math.max(maxX, s.x + s.width);
        });
        const contentBlockWidth = maxX - minX;
        const offsetX = (Math.max(800, contentBlockWidth + 2 * CANVAS_PADDING) / 2) - (rootNode.x + rootNode.width / 2) - minX + CANVAS_PADDING;

        if (isFinite(offsetX)) {
          newShapes.forEach(s => s.x += offsetX);
          maxContentX += offsetX;
        }
    }

    const finalCanvasWidth = Math.max(800, maxContentX + CANVAS_PADDING);
    const finalCanvasHeight = Math.max(600, maxContentY + CANVAS_PADDING);

    return { newShapes, finalCanvasWidth, finalCanvasHeight };
  }, []);


  useEffect(() => {
    if (sectorData) {
        const { newShapes, finalCanvasWidth, finalCanvasHeight } = generateShapesAndDimensions(sectorData, focusNodeDetails);
        setShapes(newShapes);
        setUserShapes([]); // Clear user shapes when focus changes
        setCanvasDimensions({ width: finalCanvasWidth, height: finalCanvasHeight });

        if (whiteboardViewportRef.current) {
            const viewportWidth = whiteboardViewportRef.current.clientWidth;
            const viewportHeight = whiteboardViewportRef.current.clientHeight;
            const initialScale = 1; // Reset scale on focus change
            setScale(initialScale);
            setPan({ // Recenter
                x: (viewportWidth - finalCanvasWidth * initialScale) / 2,
                y: Math.max(CANVAS_PADDING * initialScale, (viewportHeight - finalCanvasHeight * initialScale) / 2 + (CANVAS_PADDING * initialScale) / 2)
            });
        }
    } else {
      setShapes([]);
      setUserShapes([]);
      setCanvasDimensions({ width: 800, height: 600 });
      setPan({ x: 0, y: 0 });
      setScale(1);
    }
  }, [sectorData, focusNodeDetails, generateShapesAndDimensions]);

  useEffect(() => {
    if (canvasRef.current) {
        canvasRef.current.style.width = `${canvasDimensions.width}px`;
        canvasRef.current.style.height = `${canvasDimensions.height}px`;
    }
  }, [canvasDimensions]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
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
  }, [scale, pan]);

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
  }, [handleWheel]);

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
    } else if (!sectorData) {
        setPan({ x: 0, y: 0 });
        setScale(1);
        setShapes([]);
        setUserShapes([]);
        setCanvasDimensions({ width: 800, height: 600 });
    }
  }, [sectorData, canvasDimensions]);

  const handleResize = useCallback(() => {
    if (whiteboardViewportRef.current && canvasDimensions.width > 0 && canvasDimensions.height > 0) {
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const viewportHeight = whiteboardViewportRef.current.clientHeight;
        setPan({
            x: (viewportWidth - canvasDimensions.width * scale) / 2,
            y: Math.max(CANVAS_PADDING * scale, (viewportHeight - canvasDimensions.height * scale) / 2 + (CANVAS_PADDING * scale) / 2)
        });
    }
  }, [canvasDimensions, scale]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);


  // --- User-shape interaction functions ---
  // For this iteration, these will be disabled if focusNodeDetails implies a non-sector focus,
  // or they could be adapted to add children to the FOCUSED NAICS node.
  // For simplicity, let's keep them mostly disabled for fixed trees for now.
  const isEditableMode = !sectorData || (focusNodeDetails && focusNodeDetails.type !== 'sector');
  // TODO: Adapt these functions to work with the current `focusNodeDetails` as the implicit parent for new user shapes.

  const addShape = (type: 'rectangle' | 'circle', parentId: string | null = null, isSister = false) => {
    // if (!isEditableMode) return; // Simplified: disable if not editable focus.
    // For now, retain old behavior for when sectorData is null (fully user-driven whiteboard)
    if (sectorData && (!focusNodeDetails || focusNodeDetails.type === 'sector')) return; // Only allow user shapes in focused sub-sector/industry or fully custom mode
    
    const newId = `user-shape-${Date.now()}`;
    let newShape: Shape = { id: newId, type, text: '', x: 50, y: 50, width: NODE_WIDTH, height: NODE_HEIGHT, parentId: null, nodeType: 'user' };

    const shapesToConsider = [...shapes, ...userShapes]; // Combine for positioning

    if (parentId) {
        const parentNode = shapesToConsider.find(s => s.id === parentId);
        if (parentNode) {
            newShape.parentId = parentNode.id;
            if (isSister) {
                newShape.parentId = parentNode.parentId; // Share parent with sibling
                const siblings = shapesToConsider.filter(s => s.parentId === newShape.parentId);
                const lastSibling = siblings[siblings.length-1] || parentNode;
                newShape.x = lastSibling.x + lastSibling.width + HORIZONTAL_SPACING / 2;
                newShape.y = lastSibling.y;
            } else { // Is child
                const children = shapesToConsider.filter(s => s.parentId === parentId);
                const lastChild = children[children.length-1];
                newShape.x = parentNode.x;
                newShape.y = lastChild ? lastChild.y + lastChild.height + VERTICAL_SPACING_INDUSTRY_ITEM : parentNode.y + parentNode.height + VERTICAL_SPACING_INDUSTRY_START;
            }
        }
    } else { // Root user shape
        const lastRootUserShape = userShapes.filter(s => !s.parentId).pop();
        newShape.x = lastRootUserShape ? lastRootUserShape.x : (focusNodeDetails ? shapes[0]?.x ?? 50 : 50); // Position near focused node or default
        newShape.y = lastRootUserShape ? lastRootUserShape.y + NODE_HEIGHT + 20 : (focusNodeDetails ? (shapes[0]?.y ?? 50) + NODE_HEIGHT + 50 : 50) ;
    }
    setUserShapes(prev => [...prev, newShape]);
  };

  const updateShapeText = (id: string, text: string) => {
    setUserShapes(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  const deleteShape = (idToDelete: string) => {
    setUserShapes(prev => {
        const allIdsToDelete = new Set<string>([idToDelete]);
        let queue = [idToDelete];
        while(queue.length > 0) {
            const currentId = queue.shift()!;
            prev.filter(s => s.parentId === currentId).forEach(child => {
                allIdsToDelete.add(child.id);
                queue.push(child.id);
            });
        }
        return prev.filter(s => !allIdsToDelete.has(s.id));
    });
  };
  
  const clearAllUserShapes = () => {
    setUserShapes([]);
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

  const allDisplayableShapes = [...shapes, ...userShapes];

  return (
    <Card className="w-full shadow-lg border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">
          {focusNodeDetails?.name || (sectorData ? `${sectorData.name} - Structure` : 'Collaborative Whiteboard')}
        </CardTitle>
        <div className="flex items-center gap-1">
          {isEditableMode && ( // Show add/clear buttons only if in an editable focused mode
              <>
                <Button variant="outline" size="xs" onClick={() => addShape('rectangle', focusNodeDetails ? shapes[0]?.id : null)}>
                  <Square className="h-3 w-3 mr-1" /> Add Idea
                </Button>
                <Button variant="outline" size="xs" onClick={clearAllUserShapes} className="text-destructive hover:text-destructive">
                  <Eraser className="h-3 w-3 mr-1" /> Clear Ideas
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
              className="relative"
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: '0 0', 
              }}
            >
                <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}>
                    {allDisplayableShapes.map(shape => {
                    if (shape.parentId) {
                        const parentShape = allDisplayableShapes.find(s => s.id === shape.parentId);
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

                {allDisplayableShapes.map((shape) => (
                    <div
                      key={shape.id}
                      onClick={(e) => {
                        if (e.defaultPrevented) return; 
                        if (shape.isFixed && onNodeClick && shape.code && shape.nodeType && shape.nodeType !== 'user') {
                          onNodeClick({
                            code: shape.code,
                            type: shape.nodeType, 
                            text: shape.text,
                          });
                        }
                      }}
                      className={cn(
                          "absolute flex flex-col items-center justify-center p-2 text-center text-xs border-2 shadow-md rounded-md transition-all duration-100",
                          shape.isFixed && "cursor-pointer select-none",
                          !shape.isFixed && "cursor-default bg-background/90 border-primary",
                          shape.nodeType === 'sector' && "bg-primary text-primary-foreground font-semibold border-primary-foreground/50 shadow-xl",
                          shape.nodeType === 'subsector' && "bg-secondary text-secondary-foreground border-secondary-foreground/40 shadow-lg",
                          shape.nodeType === 'industry' && "bg-card text-card-foreground border-border shadow-md",
                          shape.type === 'circle' && !shape.isFixed && "!rounded-full"
                      )}
                      style={{
                          left: `${shape.x}px`,
                          top: `${shape.y}px`,
                          width: `${shape.width}px`,
                          height: `${shape.height}px`,
                          zIndex: 10,
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
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
                            onMouseDown={(e) => e.stopPropagation()} 
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
