
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, GitFork, Trash2, Move, Eye, Save, PlusCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Removed useMutation
import { getShapesForNaics, saveShapesForNaics } from '@/services/whiteboardService'; // Ensure saveShapesForNaics is imported
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';

export interface Shape {
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
  createdBy?: string;
  lastEditedBy?: string;
}

export interface FocusNodeDetails {
  code: string;
  type: 'sector' | 'subsector' | 'industry';
  name: string;
}

interface WhiteboardProps {
  sectorData: SectorWithSubSectors | null;
  focusNodeDetails: FocusNodeDetails | null;
  onNodeClick?: (node: { code: string; type: 'sector' | 'subsector' | 'industry'; text: string }) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const USER_NODE_WIDTH = 150;
const USER_NODE_HEIGHT = 80;
const HORIZONTAL_SPACING = 120;
const VERTICAL_SPACING = 100;
const VERTICAL_SPACING_INDUSTRY_START = 50;
const VERTICAL_SPACING_INDUSTRY_ITEM = 25;
const CANVAS_PADDING = 60;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5.0;
const ZOOM_SENSITIVITY = 0.0015;

const Whiteboard: React.FC<WhiteboardProps> = ({ sectorData, focusNodeDetails: currentFocus, onNodeClick }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fixedShapes, setFixedShapes] = useState<Shape[]>([]);
  const [userShapes, setUserShapes] = useState<Shape[]>([]);
  const [isSaving, setIsSaving] = useState(false); // For save button loading state

  const whiteboardViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: CANVAS_PADDING, y: CANVAS_PADDING });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredUserShapeId, setHoveredUserShapeId] = useState<string | null>(null);

  const { isLoading: isLoadingShapes, error: shapesError } = useQuery<Shape[], Error>({
    queryKey: ['whiteboardShapes', currentFocus?.code],
    queryFn: () => {
      if (!currentFocus?.code) {
        console.log("[Whiteboard] No currentFocus.code, not fetching shapes.");
        return Promise.resolve([]);
      }
      console.log(`[Whiteboard] Fetching shapes for NAICS context: ${currentFocus.code}`);
      return getShapesForNaics(currentFocus.code);
    },
    enabled: !!currentFocus?.code,
    onSuccess: (data) => {
      console.log(`[Whiteboard] Successfully fetched ${data?.length || 0} collaborative shapes for NAICS: ${currentFocus?.code}.`);
      setUserShapes(data || []);
    },
    onError: (error) => {
      console.error(`[Whiteboard] Error fetching collaborative shapes for NAICS ${currentFocus?.code}:`, error);
      toast({ variant: "destructive", title: "Error Loading Ideas", description: "Could not load whiteboard ideas for this context." });
      setUserShapes([]);
    }
  });

  const generateShapesAndDimensions = useCallback((fullSectorData: SectorWithSubSectors | null, focusNode: FocusNodeDetails | null) => {
    const newGeneratedShapes: Shape[] = [];
    let maxContentX = 0;
    let maxContentY = 0;
    let rootNodeXOffset = CANVAS_PADDING;

    if (!focusNode || (!fullSectorData && focusNode.type === 'sector')) {
      return { newGeneratedShapes, finalCanvasWidth: 800, finalCanvasHeight: 600, rootNodeXOffset };
    }
    
    const addShape = (shape: Shape) => {
        newGeneratedShapes.push(shape);
        maxContentX = Math.max(maxContentX, shape.x + shape.width);
        maxContentY = Math.max(maxContentY, shape.y + shape.height);
    };
    
    let baseNode: Shape | undefined;

    if (focusNode.type === 'sector' && fullSectorData) {
        baseNode = {
            id: `sector-${focusNode.code}`, type: 'rectangle', text: `${focusNode.name} (${focusNode.code})`,
            x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 40, height: NODE_HEIGHT, parentId: null,
            isFixed: true, nodeType: 'sector', code: focusNode.code
        };
        addShape(baseNode);

        let currentSubSectorX = CANVAS_PADDING;
        const subSectors = fullSectorData.subSectors || [];
        subSectors.forEach((sub) => {
            const subSectorId = `subsector-${sub.code}`;
            const subSectorShape: Shape = {
                id: subSectorId, type: 'rectangle', text: `${sub.name} (${sub.code})`,
                x: currentSubSectorX, y: (baseNode?.y ?? 0) + NODE_HEIGHT + VERTICAL_SPACING,
                width: NODE_WIDTH, height: NODE_HEIGHT, parentId: baseNode?.id ?? null,
                isFixed: true, nodeType: 'subsector', code: sub.code
            };
            addShape(subSectorShape);

            let currentIndustryYOffset = subSectorShape.y + NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;
            (sub.industries || []).forEach((ind) => {
                const industryShape: Shape = {
                    id: `industry-${ind.code}-${subSectorId}`, type: 'rectangle', text: `${ind.name} (${ind.code})`,
                    x: subSectorShape.x + (NODE_WIDTH / 2) - (NODE_WIDTH / 2), y: currentIndustryYOffset,
                    width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorId,
                    isFixed: true, nodeType: 'industry', code: ind.code
                };
                addShape(industryShape);
                currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
            });
            currentSubSectorX += NODE_WIDTH + HORIZONTAL_SPACING;
        });

        if (baseNode && subSectors.length > 0) {
            const totalSubSectorsWidth = Math.max(0, (subSectors.length * NODE_WIDTH) + (Math.max(0, subSectors.length - 1) * HORIZONTAL_SPACING));
            baseNode.x = CANVAS_PADDING + Math.max(0, (totalSubSectorsWidth / 2) - (baseNode.width / 2));
            maxContentX = Math.max(maxContentX, baseNode.x + baseNode.width);
        }
        rootNodeXOffset = baseNode?.x ?? CANVAS_PADDING;

    } else if (focusNode.type === 'subsector' && fullSectorData) {
        const subSectorData = fullSectorData.subSectors.find(ss => ss.code === focusNode.code);
        if (subSectorData) {
            baseNode = {
                id: `subsector-${focusNode.code}-focused`, type: 'rectangle', text: `${focusNode.name} (${focusNode.code})`,
                x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null,
                isFixed: true, nodeType: 'subsector', code: focusNode.code
            };
            addShape(baseNode);
            rootNodeXOffset = baseNode.x;
            
            let currentIndustryYOffset = baseNode.y + NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;
            (subSectorData.industries || []).forEach((ind) => {
                const industryShape: Shape = {
                    id: `industry-${ind.code}-focused-${focusNode.code}`, type: 'rectangle', text: `${ind.name} (${ind.code})`,
                    x: (baseNode?.x ?? 0) + ((NODE_WIDTH + 20) / 2) - (NODE_WIDTH / 2), y: currentIndustryYOffset,
                    width: NODE_WIDTH, height: NODE_HEIGHT, parentId: baseNode?.id ?? null,
                    isFixed: true, nodeType: 'industry', code: ind.code
                };
                addShape(industryShape);
                currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
            });
        }
    } else if (focusNode.type === 'industry' && fullSectorData) {
        let industryData: Industry | undefined;
        fullSectorData.subSectors.forEach(ss => {
            const ind = ss.industries.find(i => i.code === focusNode.code);
            if (ind) industryData = ind;
        });
        if (industryData) {
            baseNode = {
                id: `industry-${focusNode.code}-focused`, type: 'rectangle', text: `${focusNode.name} (${focusNode.code})`,
                x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null,
                isFixed: true, nodeType: 'industry', code: focusNode.code
            };
            addShape(baseNode);
            rootNodeXOffset = baseNode.x;
        }
    }
    
    const finalCanvasWidth = Math.max(800, maxContentX + CANVAS_PADDING);
    const finalCanvasHeight = Math.max(600, maxContentY + CANVAS_PADDING + 100); // Added extra padding at bottom

    return { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight, rootNodeXOffset };
  }, []);

  useEffect(() => {
    console.log("[Whiteboard] useEffect for sectorData/currentFocus/generateShapes. Current Focus:", currentFocus);
    if (currentFocus) {
      const { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight, rootNodeXOffset } = generateShapesAndDimensions(sectorData, currentFocus);
      setFixedShapes(newGeneratedShapes);
      setCanvasDimensions({ width: finalCanvasWidth, height: finalCanvasHeight });
      
      if (whiteboardViewportRef.current) {
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const initialScale = 1;
        setScale(initialScale);
        
        const contentWidthToCenter = newGeneratedShapes.length > 0 ? (newGeneratedShapes[0].width) : finalCanvasWidth - 2 * CANVAS_PADDING;
        setPan({
          x: (viewportWidth / 2) - (rootNodeXOffset + contentWidthToCenter / 2) * initialScale,
          y: CANVAS_PADDING * initialScale,
        });
      }
    } else {
      setFixedShapes([]);
      // setUserShapes([]); // Keep user shapes for general whiteboard if currentFocus is null
      setCanvasDimensions({width: 800, height: 600});
      setPan({ x: CANVAS_PADDING, y: CANVAS_PADDING });
      setScale(1);
    }
  }, [sectorData, currentFocus, generateShapesAndDimensions]);


  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.width = `${canvasDimensions.width}px`;
      canvasRef.current.style.height = `${canvasDimensions.height}px`;
    }
  }, [canvasDimensions]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Allow panning if click is on viewport or canvas itself, not a shape that stops propagation
    if (e.target === whiteboardViewportRef.current || e.target === canvasRef.current) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      if (whiteboardViewportRef.current) whiteboardViewportRef.current.style.cursor = 'grabbing';
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUpOrLeave = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      if (whiteboardViewportRef.current) whiteboardViewportRef.current.style.cursor = 'grab';
    }
  }, [isPanning]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!whiteboardViewportRef.current || !whiteboardViewportRef.current.contains(e.target as Node)) return;
    e.preventDefault();
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
  
  const handleResize = useCallback(() => {
    if (whiteboardViewportRef.current && (fixedShapes.length > 0 || userShapes.length > 0)) {
      const viewportWidth = whiteboardViewportRef.current.clientWidth;
      const viewportHeight = whiteboardViewportRef.current.clientHeight;
      
      let rootNodeToCenter = fixedShapes.length > 0 ? fixedShapes[0] : userShapes.length > 0 ? userShapes[0] : null;
      if (fixedShapes.length > 0 && currentFocus?.type !== 'sector') {
          rootNodeToCenter = fixedShapes.find(s => s.code === currentFocus?.code && s.nodeType === currentFocus?.type) || fixedShapes[0];
      }
      
      const contentXToCenter = rootNodeToCenter ? rootNodeToCenter.x + rootNodeToCenter.width / 2 : canvasDimensions.width / 2;
      const contentYToCenter = rootNodeToCenter ? rootNodeToCenter.y + rootNodeToCenter.height / 2 : canvasDimensions.height / 2;
      
      setPan({
          x: viewportWidth / 2 - contentXToCenter * scale,
          y: viewportHeight / 2 - contentYToCenter * scale,
      });
    }
  }, [scale, fixedShapes, userShapes, canvasDimensions, currentFocus]);

  useEffect(() => {
    const currentViewportRef = whiteboardViewportRef.current;
    if (currentViewportRef) {
      currentViewportRef.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('resize', handleResize);
    }
    return () => {
      if (currentViewportRef) {
        currentViewportRef.removeEventListener('wheel', handleWheel);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [handleWheel, handleResize]);
  
  const resetView = useCallback(() => {
    if (whiteboardViewportRef.current && (fixedShapes.length > 0 || userShapes.length > 0)) {
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const viewportHeight = whiteboardViewportRef.current.clientHeight;
        const newScale = 1;
        setScale(newScale);

        let rootNodeToCenter = fixedShapes.length > 0 ? fixedShapes[0] : userShapes.length > 0 ? userShapes[0] : null;
        if (fixedShapes.length > 0 && currentFocus?.type !== 'sector') {
            rootNodeToCenter = fixedShapes.find(s => s.code === currentFocus?.code && s.nodeType === currentFocus?.type) || fixedShapes[0];
        }
        
        const contentXToCenter = rootNodeToCenter ? rootNodeToCenter.x + rootNodeToCenter.width / 2 : canvasDimensions.width / 2;
        const contentYToCenter = rootNodeToCenter ? rootNodeToCenter.y + rootNodeToCenter.height / 2 : canvasDimensions.height / 2;
        
        setPan({
            x: viewportWidth / 2 - contentXToCenter * newScale,
            y: viewportHeight / 2 - contentYToCenter * newScale,
        });
    }
  }, [fixedShapes, userShapes, canvasDimensions, currentFocus]);

  const canEditWhiteboard = !!user && !!currentFocus?.code;

  const addUserShape = (type: 'rectangle' | 'circle', parentId: string | null = null, isSister = false) => {
    if (!canEditWhiteboard || !user || !currentFocus?.code) return;

    const newId = `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let newX = CANVAS_PADDING + 50;
    let newY = CANVAS_PADDING + 50;
    let effectiveParentId = parentId;

    const allShapes = [...fixedShapes, ...userShapes];
    const defaultParentNode = currentFocus ? fixedShapes.find(s => s.code === currentFocus.code && s.nodeType === currentFocus.type && s.isFixed) : null;
    const parentNode = parentId ? allShapes.find(s => s.id === parentId) : defaultParentNode;

    if (parentNode) {
      if (isSister) {
        effectiveParentId = parentNode.parentId;
        const siblings = userShapes.filter(s => s.parentId === effectiveParentId);
        const lastSibling = siblings.length > 0 ? siblings[siblings.length - 1] : parentNode;
        newX = lastSibling.x + (lastSibling.isFixed ? lastSibling.width : USER_NODE_WIDTH) + HORIZONTAL_SPACING / 2;
        newY = lastSibling.y;
      } else {
        effectiveParentId = parentNode.id;
        const children = userShapes.filter(s => s.parentId === effectiveParentId);
        const lastChild = children[children.length - 1];
        newX = parentNode.x + ((parentNode.isFixed ? parentNode.width : USER_NODE_WIDTH) / 2) - (USER_NODE_WIDTH / 2);
        newY = lastChild
             ? lastChild.y + USER_NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM
             : parentNode.y + (parentNode.isFixed ? parentNode.height : USER_NODE_HEIGHT) + VERTICAL_SPACING_INDUSTRY_START;
      }
    } else {
       effectiveParentId = currentFocus?.code ? `sector-${currentFocus.code}` : null;
       const rootUserShapes = userShapes.filter(s => s.parentId === effectiveParentId || (!s.parentId && !effectiveParentId));
       newX = CANVAS_PADDING + 50 + (rootUserShapes.length * (USER_NODE_WIDTH + HORIZONTAL_SPACING / 2));
       newY = canvasDimensions.height - USER_NODE_HEIGHT - CANVAS_PADDING - 50;
    }

    const newShape: Shape = {
      id: newId, type, text: '', x: newX, y: newY,
      width: USER_NODE_WIDTH, height: USER_NODE_HEIGHT, parentId: effectiveParentId,
      nodeType: 'user', createdBy: user.uid, lastEditedBy: user.uid, isFixed: false
    };
    setUserShapes(prev => [...prev, newShape]);
  };

  const updateUserShapeText = (id: string, text: string) => {
    if (!user) return;
    setUserShapes(prev => prev.map(s => s.id === id ? { ...s, text, lastEditedBy: user.uid } : s));
  };

  const deleteUserShape = (idToDelete: string) => {
    setUserShapes(prev => {
      const allIdsToDelete = new Set<string>();
      const queue: string[] = [idToDelete];
      
      const shapeToDelete = prev.find(s => s.id === idToDelete);
      if (shapeToDelete && !shapeToDelete.isFixed) {
          allIdsToDelete.add(idToDelete);
      } else if (shapeToDelete?.isFixed) {
          toast({variant: "destructive", title: "Cannot Delete", description: "Fixed NAICS nodes cannot be deleted."});
          return prev;
      } else {
          return prev;
      }

      let head = 0;
      while(head < queue.length){
          const currentId = queue[head++];
          prev.filter(s => s.parentId === currentId && !s.isFixed).forEach(child => {
              if(!allIdsToDelete.has(child.id)){
                  allIdsToDelete.add(child.id);
                  queue.push(child.id);
              }
          });
      }
      return prev.filter(s => !allIdsToDelete.has(s.id));
    });
  };

  const clearUserShapesForCurrentFocus = () => {
    if (!canEditWhiteboard) return;
    setUserShapes([]);
    toast({ title: "User Ideas Cleared Locally", description: "Click 'Save Whiteboard' to make this change permanent." });
  };

  const handleSaveWhiteboard = async () => {
    if (!user || !currentFocus?.code) {
      toast({ variant: "destructive", title: "Cannot Save", description: "User not logged in or no whiteboard context (NAICS code)." });
      return;
    }
    
    console.log(
      `%c[Whiteboard] handleSaveWhiteboard - CRITICAL CHECK:`,
      "color: orange; font-weight: bold;",
      {
        isUserLoggedIn: !!user,
        userId: user?.uid,
        currentFocusCodeForDocId: currentFocus.code,
        numberOfUserShapesToSave: userShapes.length,
      }
    );
    
    setIsSaving(true);
    try {
      await saveShapesForNaics(currentFocus.code, userShapes, user.uid);
      toast({ title: "Whiteboard Saved", description: "Your collaborative changes have been saved." });
      queryClient.invalidateQueries({ queryKey: ['whiteboardShapes', currentFocus.code] });
    } catch (error: any) {
      console.error("[Whiteboard] handleSaveWhiteboard: Failed to save whiteboard shapes:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: `Could not save whiteboard: ${error.message || 'Unknown error'}. Check console.`,
      });
    } finally {
      setIsSaving(false);
    }
  };


  const getShapeCenter = (shape: Shape, side: 'top' | 'bottom' | 'left' | 'right') => {
    const width = shape.isFixed || shape.nodeType !== 'user' ? shape.width : USER_NODE_WIDTH;
    const height = shape.isFixed || shape.nodeType !== 'user' ? shape.height : USER_NODE_HEIGHT;
    switch (side) {
      case 'top': return { x: shape.x + width / 2, y: shape.y };
      case 'bottom': return { x: shape.x + width / 2, y: shape.y + height };
      case 'left': return { x: shape.x, y: shape.y + height / 2 };
      case 'right': return { x: shape.x + width, y: shape.y + height / 2 };
    }
  };

  const allDisplayableShapes = [...fixedShapes, ...userShapes];

  return (
    <Card className="w-full shadow-lg border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">
          {currentFocus?.name || 'Collaborative Whiteboard'}
          {currentFocus?.code && <span className="text-xs text-muted-foreground ml-2">({currentFocus.code})</span>}
        </CardTitle>
        <div className="flex items-center gap-1">
          {canEditWhiteboard && (
            <>
              <Button variant="outline" size="xs" onClick={() => addUserShape('rectangle')} disabled={isLoadingShapes || isSaving}>
                <Square className="h-3 w-3 mr-1" /> Add Idea
              </Button>
              <Button variant="outline" size="xs" onClick={clearUserShapesForCurrentFocus} className="text-destructive hover:text-destructive" disabled={isLoadingShapes || isSaving}>
                <Eraser className="h-3 w-3 mr-1" /> Clear Ideas
              </Button>
            </>
          )}
           <Button variant="default" size="xs" onClick={handleSaveWhiteboard} disabled={isSaving || isLoadingShapes || !user}>
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
            Save Whiteboard
          </Button>
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
              width: `${canvasDimensions.width}px`,
              height: `${canvasDimensions.height}px`,
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
                      <path key={`line-to-${shape.id}`} d={pathData} stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" fill="none" />
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
                  if (shape.isFixed && onNodeClick && shape.code && (shape.nodeType === 'sector' || shape.nodeType === 'subsector' || shape.nodeType === 'industry')) {
                    console.log("[Whiteboard] Fixed node clicked:", shape);
                    onNodeClick({ code: shape.code, type: shape.nodeType, text: shape.text });
                  }
                }}
                className={cn(
                  "absolute flex flex-col items-center justify-center p-2 text-center text-xs border-2 shadow-md rounded-md transition-all duration-100",
                  shape.isFixed && "cursor-pointer",
                  !shape.isFixed && "bg-background/90 border-primary cursor-default", // User-added shapes
                  shape.nodeType === 'sector' && "bg-primary text-primary-foreground font-semibold border-primary-foreground/50 shadow-xl",
                  shape.nodeType === 'subsector' && "bg-secondary text-secondary-foreground border-secondary-foreground/40 shadow-lg",
                  shape.nodeType === 'industry' && "bg-card text-card-foreground border-border shadow-md",
                  shape.type === 'circle' && !shape.isFixed && "!rounded-full"
                )}
                style={{
                  left: `${shape.x}px`, top: `${shape.y}px`,
                  width: `${shape.isFixed ? shape.width : USER_NODE_WIDTH}px`,
                  height: `${shape.isFixed ? shape.height : USER_NODE_HEIGHT}px`,
                  zIndex: shape.isFixed ? 10 : 20,
                }}
                onMouseDown={(e) => { if (!shape.isFixed) e.stopPropagation();}}
                onMouseEnter={() => !shape.isFixed && setHoveredUserShapeId(shape.id)}
                onMouseLeave={() => !shape.isFixed && setHoveredUserShapeId(null)}
              >
                {shape.isFixed ? (
                  <span className="px-1 break-words">{shape.text}</span>
                ) : ( 
                  <>
                    <Textarea
                      value={shape.text}
                      onChange={(e) => updateUserShapeText(shape.id, e.target.value)}
                      placeholder={shape.type === 'rectangle' ? 'Type idea...' : 'Idea...'}
                      className="w-full h-full resize-none bg-transparent border-none focus:ring-0 text-xs p-1 text-center flex items-center justify-center"
                      rows={Math.max(2, Math.min(4, Math.floor(shape.text.length / 15) + 1))}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    {canEditWhiteboard && (
                        <>
                            <Button
                                variant="ghost" size="icon"
                                className="absolute -top-2.5 -right-2.5 h-5 w-5 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5 opacity-50 hover:opacity-100 focus:opacity-100"
                                onClick={(e) => { e.stopPropagation(); deleteUserShape(shape.id); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                title="Delete Idea"
                            > <Trash2 className="h-3 w-3" /> </Button>
                            {hoveredUserShapeId === shape.id && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-0.5 p-0.5 bg-background/90 border rounded-md shadow-sm" onMouseDown={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-primary/80 hover:text-primary" onClick={(e) => { e.stopPropagation(); addUserShape('rectangle', shape.id); }} title="Add Child Idea">
                                <PlusCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-primary/80 hover:text-primary" onClick={(e) => { e.stopPropagation(); addUserShape('rectangle', shape.id, true); }} title="Add Sibling Idea">
                                <GitFork className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            )}
                        </>
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
