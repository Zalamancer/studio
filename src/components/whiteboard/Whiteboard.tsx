
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, Circle as CircleIcon, Eraser, PlusCircle, GitFork, Trash2, Move, Eye, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShapesForNaics, saveShapesForNaics } from '@/services/whiteboardService'; // Corrected imports
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';

export interface Shape { // Keep Shape interface public for potential re-use
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
  sectorData: SectorWithSubSectors | null; // Changed to non-optional based on usage in parent
  focusNodeDetails: FocusNodeDetails | null;
  onNodeClick?: (node: { code: string; type: 'sector' | 'subsector' | 'industry' | 'user'; text: string }) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const USER_NODE_WIDTH = 150;
const USER_NODE_HEIGHT = 80;
const HORIZONTAL_SPACING = 120;
const VERTICAL_SPACING = 100;
const VERTICAL_SPACING_INDUSTRY_START = 50;
const VERTICAL_SPACING_INDUSTRY_ITEM = 25; // Reduced for tighter vertical packing
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

  const whiteboardViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: CANVAS_PADDING, y: CANVAS_PADDING });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredUserShapeId, setHoveredUserShapeId] = useState<string | null>(null);

  // --- Data Fetching for User Shapes (now collaborative shapes for NAICS context) ---
  const { data: fetchedShapes, isLoading: isLoadingShapes } = useQuery<Shape[], Error>({
    queryKey: ['whiteboardShapes', currentFocus?.code], // Keyed by NAICS code only
    queryFn: () => {
      if (!currentFocus?.code) return Promise.resolve([]);
      console.log(`[Whiteboard] Fetching shapes for NAICS: ${currentFocus.code}`);
      return getShapesForNaics(currentFocus.code); // Use getShapesForNaics
    },
    enabled: !!currentFocus?.code,
    onSuccess: (data) => {
      console.log(`[Whiteboard] Successfully fetched ${data?.length || 0} shapes for NAICS: ${currentFocus?.code}.`);
      setUserShapes(data || []);
    },
    onError: (error) => {
      console.error(`[Whiteboard] Error fetching shapes for NAICS ${currentFocus?.code}:`, error);
      toast({ variant: "destructive", title: "Error", description: "Could not load whiteboard ideas." });
    }
  });

  // --- Data Saving for User Shapes (now collaborative shapes) ---
  const saveShapesMutation = useMutation({
    mutationFn: (variables: { naicsCode: string; shapes: Shape[]; userId: string | undefined }) => {
      if (!variables.userId) throw new Error("User must be logged in to save.");
      console.log(`[Whiteboard] Attempting to save shapes for NAICS: ${variables.naicsCode} by user: ${variables.userId}`);
      console.log("[Whiteboard] Shapes to save:", JSON.stringify(variables.shapes, null, 2));
      return saveShapesForNaics(variables.naicsCode, variables.shapes, variables.userId); // Use saveShapesForNaics
    },
    onSuccess: () => {
      toast({ title: "Whiteboard Saved", description: "Your changes have been saved." });
      if (currentFocus?.code) {
        queryClient.invalidateQueries({ queryKey: ['whiteboardShapes', currentFocus.code] });
      }
    },
    onError: (error: Error) => {
      console.error("[Whiteboard] Failed to save whiteboard shapes:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: `Could not save whiteboard: ${error.message || 'Unknown error'}. Check console for details.`,
      });
    },
  });

  const generateShapesAndDimensions = useCallback((fullSectorData: SectorWithSubSectors | null, focusNode: FocusNodeDetails | null) => {
    const newShapes: Shape[] = [];
    let maxContentX = 0;
    let maxContentY = 0;

    if (!fullSectorData && !focusNode) { // If no sector data and no specific focus, start blank
        return { newShapes, finalCanvasWidth: 800, finalCanvasHeight: 600, rootNodeXOffset: CANVAS_PADDING };
    }
    
    const displayTarget = focusNode || (fullSectorData ? { code: fullSectorData.code, type: 'sector', name: fullSectorData.name } : null);
    if (!displayTarget) return { newShapes, finalCanvasWidth: 800, finalCanvasHeight: 600, rootNodeXOffset: CANVAS_PADDING };

    let rootNodeXOffset = CANVAS_PADDING;

    if (displayTarget.type === 'sector' && fullSectorData) {
        const sectorShape: Shape = {
            id: `sector-${fullSectorData.code}`, type: 'rectangle', text: `${fullSectorData.name} (${fullSectorData.code})`,
            x: 0, y: CANVAS_PADDING, width: NODE_WIDTH + 40, height: NODE_HEIGHT, parentId: null,
            isFixed: true, nodeType: 'sector', code: fullSectorData.code
        };
        newShapes.push(sectorShape);
        maxContentY = Math.max(maxContentY, sectorShape.y + sectorShape.height);

        let currentSubSectorX = CANVAS_PADDING;
        const subSectors = fullSectorData.subSectors || [];
        subSectors.forEach((sub) => {
            const subSectorId = `subsector-${sub.code}`;
            const subSectorShape: Shape = {
                id: subSectorId, type: 'rectangle', text: `${sub.name} (${sub.code})`,
                x: currentSubSectorX, y: sectorShape.y + sectorShape.height + VERTICAL_SPACING,
                width: NODE_WIDTH, height: NODE_HEIGHT, parentId: sectorShape.id,
                isFixed: true, nodeType: 'subsector', code: sub.code
            };
            newShapes.push(subSectorShape);

            let currentIndustryYOffset = subSectorShape.y + NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;
            (sub.industries || []).forEach((ind) => {
                const industryShape: Shape = {
                    id: `industry-${ind.code}-${subSectorId}`, type: 'rectangle', text: `${ind.name} (${ind.code})`,
                    x: subSectorShape.x + (NODE_WIDTH / 2) - (NODE_WIDTH / 2), // Center under sub-sector
                    y: currentIndustryYOffset, width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorId,
                    isFixed: true, nodeType: 'industry', code: ind.code
                };
                newShapes.push(industryShape);
                currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
            });
            maxContentY = Math.max(maxContentY, currentIndustryYOffset - (sub.industries.length > 0 ? VERTICAL_SPACING_INDUSTRY_ITEM : 0));
            maxContentX = Math.max(maxContentX, currentSubSectorX + NODE_WIDTH);
            currentSubSectorX += NODE_WIDTH + HORIZONTAL_SPACING;
        });
        maxContentX = Math.max(maxContentX, currentSubSectorX - (subSectors.length > 0 ? HORIZONTAL_SPACING : 0));
        const totalSubSectorsWidth = Math.max(0, (subSectors.length * NODE_WIDTH) + (Math.max(0, subSectors.length - 1) * HORIZONTAL_SPACING));
        sectorShape.x = CANVAS_PADDING + Math.max(0, (totalSubSectorsWidth / 2) - (sectorShape.width / 2));
        maxContentX = Math.max(maxContentX, sectorShape.x + sectorShape.width);
        rootNodeXOffset = sectorShape.x;

    } else if (displayTarget.type === 'subsector' && fullSectorData) {
        const focusedSubSector = fullSectorData.subSectors.find(ss => ss.code === displayTarget.code);
        if (focusedSubSector) {
            const subSectorShape: Shape = {
                id: `subsector-${focusedSubSector.code}-focused`, type: 'rectangle', text: `${focusedSubSector.name} (${focusedSubSector.code})`,
                x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null,
                isFixed: true, nodeType: 'subsector', code: focusedSubSector.code
            };
            newShapes.push(subSectorShape);
            rootNodeXOffset = subSectorShape.x;
            maxContentY = Math.max(maxContentY, subSectorShape.y + subSectorShape.height);

            let currentIndustryYOffset = subSectorShape.y + NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;
            (focusedSubSector.industries || []).forEach((ind) => {
                const industryShape: Shape = {
                    id: `industry-${ind.code}-focused-${focusedSubSector.code}`, type: 'rectangle', text: `${ind.name} (${ind.code})`,
                    x: subSectorShape.x + ((NODE_WIDTH + 20) / 2) - (NODE_WIDTH / 2), y: currentIndustryYOffset,
                    width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorShape.id,
                    isFixed: true, nodeType: 'industry', code: ind.code
                };
                newShapes.push(industryShape);
                currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
            });
            maxContentY = Math.max(maxContentY, currentIndustryYOffset - (focusedSubSector.industries.length > 0 ? VERTICAL_SPACING_INDUSTRY_ITEM : 0));
            maxContentX = Math.max(maxContentX, subSectorShape.x + subSectorShape.width);
        }
    } else if (displayTarget.type === 'industry' && fullSectorData) {
        let focusedIndustry: Industry | undefined;
        let parentSubSectorId: string | null = null;
        fullSectorData.subSectors.forEach(ss => {
            const ind = ss.industries.find(i => i.code === displayTarget.code);
            if (ind) {
                focusedIndustry = ind;
                parentSubSectorId = `subsector-${ss.code}-focused`; // If sub-sector was focused, it would have this ID
            }
        });
        if (focusedIndustry) {
            const industryShape: Shape = {
                id: `industry-${focusedIndustry.code}-focused`, type: 'rectangle', text: `${focusedIndustry.name} (${focusedIndustry.code})`,
                x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null, // No parent from fixed data in this view
                isFixed: true, nodeType: 'industry', code: focusedIndustry.code
            };
            newShapes.push(industryShape);
            rootNodeXOffset = industryShape.x;
            maxContentX = Math.max(maxContentX, industryShape.x + industryShape.width);
            maxContentY = Math.max(maxContentY, industryShape.y + industryShape.height);
        }
    }

    const finalCanvasWidth = Math.max(800, maxContentX + CANVAS_PADDING);
    const finalCanvasHeight = Math.max(600, maxContentY + CANVAS_PADDING + (USER_NODE_HEIGHT * 2)); // Extra space for user nodes

    return { newShapes, finalCanvasWidth, finalCanvasHeight, rootNodeXOffset };
  }, []);


  useEffect(() => {
    if (sectorData || currentFocus) { // If there's any NAICS context
      const { newShapes, finalCanvasWidth, finalCanvasHeight, rootNodeXOffset } = generateShapesAndDimensions(sectorData, currentFocus);
      setFixedShapes(newShapes);
      setCanvasDimensions({ width: finalCanvasWidth, height: finalCanvasHeight });

      if (whiteboardViewportRef.current) {
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const initialScale = 1;
        setScale(initialScale);
        setPan({
          x: (viewportWidth / 2) - (rootNodeXOffset + (newShapes[0]?.width || NODE_WIDTH) / 2) * initialScale,
          y: CANVAS_PADDING,
        });
      }
    } else {
      setFixedShapes([]);
      setCanvasDimensions({width: 800, height: 600}); // Default for blank user whiteboard
      setPan({ x: CANVAS_PADDING, y: CANVAS_PADDING });
      setScale(1);
    }
    // When focus changes, userShapes are refetched by useQuery
  }, [sectorData, currentFocus, generateShapesAndDimensions]);


  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.width = `${canvasDimensions.width}px`;
      canvasRef.current.style.height = `${canvasDimensions.height}px`;
    }
  }, [canvasDimensions]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only pan on left click
    // Allow pan if clicking on viewport directly, not on a shape that stops propagation
    e.preventDefault();
    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
    if (whiteboardViewportRef.current) whiteboardViewportRef.current.style.cursor = 'grabbing';
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
      if (whiteboardViewportRef.current) whiteboardViewportRef.current.style.cursor = 'grab';
    }
  }, [isPanning]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!whiteboardViewportRef.current || !whiteboardViewportRef.current.contains(e.target as Node)) return;
    e.preventDefault();
    const rect = whiteboardViewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // Mouse X relative to viewport
    const mouseY = e.clientY - rect.top;  // Mouse Y relative to viewport
    const zoomFactor = 1 - (e.deltaY * ZOOM_SENSITIVITY);
    const newScale = Math.min(Math.max(scale * zoomFactor, MIN_ZOOM), MAX_ZOOM);

    // Adjust pan to zoom towards the mouse pointer
    const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
    const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);

    setPan({ x: newPanX, y: newPanY });
    setScale(newScale);
  }, [scale, pan]); // Include pan in dependencies

  const handleResize = useCallback(() => {
    if (whiteboardViewportRef.current && (fixedShapes.length > 0 || userShapes.length > 0)) {
      const viewportWidth = whiteboardViewportRef.current.clientWidth;
      const contentCenterX = (fixedShapes[0]?.x || CANVAS_PADDING) + (fixedShapes[0]?.width || NODE_WIDTH) / 2;
      
      setPan(prevPan => ({
        ...prevPan,
        x: (viewportWidth / 2) - contentCenterX * scale, // Re-center horizontally
        // y: CANVAS_PADDING // Could also adjust y, but often x is more critical on resize
      }));
    }
  }, [scale, fixedShapes, userShapes]); // fixedShapes and userShapes for contentCenterX calculation

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
    if (whiteboardViewportRef.current) {
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const newScale = 1;
        setScale(newScale);

        let rootNodeX = CANVAS_PADDING;
        let rootNodeWidth = NODE_WIDTH;

        if (fixedShapes.length > 0 && fixedShapes[0]) {
            rootNodeX = fixedShapes[0].x;
            rootNodeWidth = fixedShapes[0].width;
        } else if (userShapes.length > 0 && userShapes.find(s => !s.parentId)) {
            // Find the first "root" user shape if no fixed shapes
            const firstRootUserShape = userShapes.find(s => !s.parentId);
            if (firstRootUserShape) {
                rootNodeX = firstRootUserShape.x;
                rootNodeWidth = firstRootUserShape.width;
            }
        }
        
        setPan({
            x: (viewportWidth / 2) - (rootNodeX + rootNodeWidth / 2) * newScale,
            y: CANVAS_PADDING,
        });
    }
  }, [fixedShapes, userShapes]); // Add userShapes here

  const canEditWhiteboard = !!user && !!currentFocus?.code;

  const addUserShape = (type: 'rectangle' | 'circle', parentId: string | null = null, isSister = false) => {
    if (!canEditWhiteboard || !user || !currentFocus?.code) return;

    const newId = `user-${Date.now()}`;
    let newX = CANVAS_PADDING + 50;
    let newY = CANVAS_PADDING + 50;
    let effectiveParentId = parentId;

    const allShapes = [...fixedShapes, ...userShapes];
    const parentNode = parentId ? allShapes.find(s => s.id === parentId) : (currentFocus && fixedShapes.length > 0 ? fixedShapes[0] : null);

    if (parentNode) {
      if (isSister) {
        effectiveParentId = parentNode.parentId;
        const siblings = userShapes.filter(s => s.parentId === effectiveParentId); // Only consider user shapes as siblings to add next to
        const lastSibling = siblings[siblings.length - 1] || parentNode; // Fallback to parentNode if no user siblings
        
        newX = lastSibling.x + (lastSibling.nodeType === 'user' || lastSibling.isFixed ? lastSibling.width : USER_NODE_WIDTH) + HORIZONTAL_SPACING / 2;
        newY = lastSibling.y;
      } else { // Is a child
        effectiveParentId = parentNode.id;
        const children = userShapes.filter(s => s.parentId === effectiveParentId);
        const lastChild = children[children.length - 1];

        newX = parentNode.x + ((parentNode.nodeType === 'user' || parentNode.isFixed ? parentNode.width : USER_NODE_WIDTH) / 2) - (USER_NODE_WIDTH / 2); // Center under parent
        newY = lastChild 
             ? lastChild.y + USER_NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM
             : parentNode.y + (parentNode.nodeType === 'user' || parentNode.isFixed ? parentNode.height : USER_NODE_HEIGHT) + VERTICAL_SPACING_INDUSTRY_START;
      }
    } else { // Adding a "root" user shape relative to the main focused NAICS node
       effectiveParentId = fixedShapes.length > 0 ? fixedShapes[0].id : null; 
       const rootUserShapes = userShapes.filter(s => s.parentId === effectiveParentId);
       newX = fixedShapes.length > 0 ? fixedShapes[0].x : CANVAS_PADDING + 50;
       newY = (fixedShapes.length > 0 ? fixedShapes[0].y + fixedShapes[0].height : CANVAS_PADDING + 50) + 
              VERTICAL_SPACING_INDUSTRY_START + 
              (rootUserShapes.length * (USER_NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM));
    }

    const newShape: Shape = {
      id: newId, type, text: '', x: newX, y: newY,
      width: USER_NODE_WIDTH, height: USER_NODE_HEIGHT, parentId: effectiveParentId,
      nodeType: 'user', createdBy: user.uid, lastEditedBy: user.uid
    };
    setUserShapes(prev => [...prev, newShape]);
  };

  const updateUserShapeText = (id: string, text: string) => {
    if (!user) return;
    setUserShapes(prev => prev.map(s => s.id === id ? { ...s, text, lastEditedBy: user.uid } : s));
  };

  const deleteUserShape = (idToDelete: string) => {
    setUserShapes(prev => {
      const allIdsToDelete = new Set<string>([idToDelete]);
      let queue = [idToDelete];
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        prev.filter(s => s.parentId === currentId && s.nodeType === 'user').forEach(child => {
          allIdsToDelete.add(child.id);
          queue.push(child.id);
        });
      }
      return prev.filter(s => !allIdsToDelete.has(s.id));
    });
  };

  const clearUserShapesForCurrentFocus = () => {
    setUserShapes([]);
    // Note: Needs a manual save to persist this clearing
    toast({ title: "Ideas Cleared Locally", description: "Click 'Save Whiteboard' to make this change permanent." });
  };

  const handleSaveWhiteboard = () => {
    if (!user || !currentFocus?.code) {
      toast({ variant: "destructive", title: "Cannot Save", description: "User not logged in or no whiteboard context." });
      return;
    }
    saveShapesMutation.mutate({ naicsCode: currentFocus.code, shapes: userShapes, userId: user.uid });
  };

  const getShapeCenter = (shape: Shape, side: 'top' | 'bottom' | 'left' | 'right') => {
    const width = shape.isFixed ? shape.width : USER_NODE_WIDTH;
    const height = shape.isFixed ? shape.height : USER_NODE_HEIGHT;
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
          {currentFocus?.name || (sectorData ? `${sectorData.name} - Structure` : 'Collaborative Whiteboard')}
        </CardTitle>
        <div className="flex items-center gap-1">
          {canEditWhiteboard && (
            <>
              <Button variant="outline" size="xs" onClick={() => addUserShape('rectangle')} disabled={isLoadingShapes || saveShapesMutation.isPending}>
                <Square className="h-3 w-3 mr-1" /> Add Idea
              </Button>
              <Button variant="outline" size="xs" onClick={clearUserShapesForCurrentFocus} className="text-destructive hover:text-destructive" disabled={isLoadingShapes || saveShapesMutation.isPending}>
                <Eraser className="h-3 w-3 mr-1" /> Clear My Ideas
              </Button>
              <Button variant="default" size="xs" onClick={handleSaveWhiteboard} disabled={saveShapesMutation.isPending || isLoadingShapes}>
                {saveShapesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Save Whiteboard
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
            className="relative" // Canvas itself is relative for absolute positioning of shapes
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              // Dynamic width/height will be set by useEffect
            }}
          >
            {/* SVG for lines - ensure it's same size as canvasRef */}
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}>
              {allDisplayableShapes.map(shape => {
                if (shape.parentId) {
                  const parentShape = allDisplayableShapes.find(s => s.id === shape.parentId);
                  if (parentShape) {
                    const parentPoint = getShapeCenter(parentShape, 'bottom');
                    const childPoint = getShapeCenter(shape, 'top');
                    const verticalDistance = childPoint.y - parentPoint.y;
                    const curveFactor = Math.max(20, verticalDistance / 3.5); // Adjust for curve intensity
                    const pathData = `M ${parentPoint.x} ${parentPoint.y} C ${parentPoint.x} ${parentPoint.y + curveFactor}, ${childPoint.x} ${childPoint.y - curveFactor}, ${childPoint.x} ${childPoint.y}`;
                    return (
                      <path key={`line-to-${shape.id}`} d={pathData} stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" fill="none" />
                    );
                  }
                }
                return null;
              })}
            </svg>

            {/* Shapes */}
            {allDisplayableShapes.map((shape) => (
              <div
                key={shape.id}
                onClick={(e) => {
                  if (e.defaultPrevented || shape.isFixed !== true) return; // Only allow click for fixed NAICS nodes
                  if (onNodeClick && shape.code && (shape.nodeType === 'sector' || shape.nodeType === 'subsector' || shape.nodeType === 'industry')) {
                    console.log("[Whiteboard] Fixed node clicked:", shape);
                    onNodeClick({ code: shape.code, type: shape.nodeType, text: shape.text });
                  }
                }}
                className={cn(
                  "absolute flex flex-col items-center justify-center p-2 text-center text-xs border-2 shadow-md rounded-md transition-all duration-100",
                  shape.isFixed && "cursor-pointer",
                  !shape.isFixed && "cursor-default bg-background/90 border-primary", // User shape
                  shape.nodeType === 'sector' && "bg-primary text-primary-foreground font-semibold border-primary-foreground/50 shadow-xl",
                  shape.nodeType === 'subsector' && "bg-secondary text-secondary-foreground border-secondary-foreground/40 shadow-lg",
                  shape.nodeType === 'industry' && "bg-card text-card-foreground border-border shadow-md",
                  shape.type === 'circle' && !shape.isFixed && "!rounded-full" // Circle for user shapes only
                )}
                style={{
                  left: `${shape.x}px`, top: `${shape.y}px`,
                  width: `${shape.isFixed ? shape.width : USER_NODE_WIDTH}px`,
                  height: `${shape.isFixed ? shape.height : USER_NODE_HEIGHT}px`,
                  zIndex: shape.isFixed ? 10 : 20, // User shapes on top
                }}
                onMouseDown={(e) => { if (!shape.isFixed) e.stopPropagation();}} // Allow pan if clicking fixed, prevent if user shape text area
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
                      onMouseDown={(e) => e.stopPropagation()} // Prevent pan when clicking textarea
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
