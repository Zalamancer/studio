
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, Circle as CircleIcon, Eraser, PlusCircle, GitFork, Trash2, Move, Eye, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserShapes, saveUserShapes } from '@/services/whiteboardService';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';

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
  code?: string; // NAICS code for fixed nodes
  // actualData?: SubSector | Industry; // Removed to simplify user shapes
  createdBy?: string; // UID
  lastEditedBy?: string; // UID
}

export interface FocusNodeDetails { // Exported for use in parent
  code: string;
  type: 'sector' | 'subsector' | 'industry';
  name: string;
}

interface WhiteboardProps {
  sectorData?: SectorWithSubSectors | null;
  initialFocusNode?: FocusNodeDetails | null; // Renamed from focusNodeDetails for clarity
  onNodeClick?: (node: { code: string; type: string; text: string }) => void;
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

const Whiteboard: React.FC<WhiteboardProps> = ({ sectorData, initialFocusNode, onNodeClick }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fixedShapes, setFixedShapes] = useState<Shape[]>([]);
  const [userShapes, setUserShapes] = useState<Shape[]>([]); // Shapes added by users for the current focus
  const [currentFocus, setCurrentFocus] = useState<FocusNodeDetails | null>(initialFocusNode || null);

  const whiteboardViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredUserShapeId, setHoveredUserShapeId] = useState<string | null>(null);

  // --- Data Fetching for User Shapes ---
  const { data: fetchedUserShapes, isLoading: isLoadingUserShapes } = useQuery<Shape[], Error>({
    queryKey: ['whiteboardUserShapes', user?.uid, currentFocus?.code],
    queryFn: () => {
      if (!user?.uid || !currentFocus?.code) return Promise.resolve([]);
      return getUserShapes(user.uid, currentFocus.code);
    },
    enabled: !!user && !!currentFocus?.code,
    onSuccess: (data) => {
      setUserShapes(data || []);
    },
    onError: (error) => {
      console.error("Error fetching user shapes:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load your saved ideas for this whiteboard." });
    }
  });

  // --- Data Saving for User Shapes ---
  const saveShapesMutation = useMutation({
    mutationFn: (variables: { naicsCode: string; shapes: Shape[]; userId: string }) =>
      saveUserShapes(variables.naicsCode, variables.shapes, variables.userId),
    onSuccess: () => {
      toast({ title: "Whiteboard Saved", description: "Your ideas have been saved." });
      queryClient.invalidateQueries({ queryKey: ['whiteboardUserShapes', user?.uid, currentFocus?.code] });
    },
    onError: (error: Error) => {
      console.error("Failed to save whiteboard shapes:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: `Could not save whiteboard: ${error.message}. Details: ${JSON.stringify(error)}`,
      });
    },
  });

  const generateFixedShapesAndDimensions = useCallback((currentSector: SectorWithSubSectors, focusNode: FocusNodeDetails | null) => {
    const newShapes: Shape[] = [];
    let maxContentX = 0;
    let maxContentY = 0;
    let rootNodeXOffset = 0;

    const displayTarget = focusNode || { code: currentSector.code, type: 'sector', name: currentSector.name };

    if (displayTarget.type === 'sector') {
      const sectorShape: Shape = {
        id: `sector-${currentSector.code}`, type: 'rectangle', text: `${currentSector.name} (${currentSector.code})`,
        x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 40, height: NODE_HEIGHT, parentId: null,
        isFixed: true, nodeType: 'sector', code: currentSector.code
      };
      newShapes.push(sectorShape);
      maxContentY = sectorShape.y + sectorShape.height;

      let currentSubSectorX = CANVAS_PADDING;
      const subSectors = currentSector.subSectors || [];
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
            x: subSectorShape.x + (NODE_WIDTH / 2) - (NODE_WIDTH / 2), y: currentIndustryYOffset,
            width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorId,
            isFixed: true, nodeType: 'industry', code: ind.code
          };
          newShapes.push(industryShape);
          currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        });
        maxContentY = Math.max(maxContentY, currentIndustryYOffset - VERTICAL_SPACING_INDUSTRY_ITEM);
        currentSubSectorX += NODE_WIDTH + HORIZONTAL_SPACING;
      });
      maxContentX = Math.max(maxContentX, currentSubSectorX - (subSectors.length > 0 ? HORIZONTAL_SPACING : 0));
      const totalSubSectorsWidth = Math.max(0, (subSectors.length * NODE_WIDTH) + (Math.max(0, subSectors.length - 1) * HORIZONTAL_SPACING));
      sectorShape.x = CANVAS_PADDING + Math.max(0, (totalSubSectorsWidth / 2) - (sectorShape.width / 2));
      maxContentX = Math.max(maxContentX, sectorShape.x + sectorShape.width);
      rootNodeXOffset = sectorShape.x;


    } else if (displayTarget.type === 'subsector') {
      const focusedSubSector = currentSector.subSectors.find(ss => ss.code === displayTarget.code);
      if (focusedSubSector) {
        const subSectorShape: Shape = {
          id: `subsector-${focusedSubSector.code}-focused`, type: 'rectangle', text: `${focusedSubSector.name} (${focusedSubSector.code})`,
          x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null,
          isFixed: true, nodeType: 'subsector', code: focusedSubSector.code
        };
        newShapes.push(subSectorShape);
        rootNodeXOffset = subSectorShape.x;
        maxContentY = subSectorShape.y + subSectorShape.height;

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
        maxContentY = Math.max(maxContentY, currentIndustryYOffset - VERTICAL_SPACING_INDUSTRY_ITEM);
        maxContentX = Math.max(maxContentX, subSectorShape.x + subSectorShape.width);
      }
    } else if (displayTarget.type === 'industry') {
      let focusedIndustry: Industry | undefined;
      currentSector.subSectors.forEach(ss => {
        const ind = ss.industries.find(i => i.code === displayTarget.code);
        if (ind) focusedIndustry = ind;
      });
      if (focusedIndustry) {
        const industryShape: Shape = {
          id: `industry-${focusedIndustry.code}-focused`, type: 'rectangle', text: `${focusedIndustry.name} (${focusedIndustry.code})`,
          x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null,
          isFixed: true, nodeType: 'industry', code: focusedIndustry.code
        };
        newShapes.push(industryShape);
        rootNodeXOffset = industryShape.x;
        maxContentX = Math.max(maxContentX, industryShape.x + industryShape.width);
        maxContentY = Math.max(maxContentY, industryShape.y + industryShape.height);
      }
    }

    const finalCanvasWidth = Math.max(800, maxContentX + CANVAS_PADDING);
    const finalCanvasHeight = Math.max(600, maxContentY + CANVAS_PADDING + (USER_NODE_HEIGHT * 3)); // Add space for user nodes

    return { newShapes, finalCanvasWidth, finalCanvasHeight, rootNodeXOffset };
  }, []);


  useEffect(() => {
    setCurrentFocus(initialFocusNode || (sectorData ? { code: sectorData.code, type: 'sector', name: sectorData.name } : null));
  }, [initialFocusNode, sectorData]);

  useEffect(() => {
    if (sectorData && currentFocus) {
      const { newShapes, finalCanvasWidth, finalCanvasHeight, rootNodeXOffset } = generateFixedShapesAndDimensions(sectorData, currentFocus);
      setFixedShapes(newShapes);
      setCanvasDimensions({ width: finalCanvasWidth, height: finalCanvasHeight });

      // Initial pan and zoom reset when focus changes
      if (whiteboardViewportRef.current) {
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const viewportHeight = whiteboardViewportRef.current.clientHeight;
        const newScale = 1;
        setScale(newScale);
        setPan({
          x: (viewportWidth / 2) - (rootNodeXOffset + (newShapes[0]?.width || NODE_WIDTH) / 2) * newScale,
          y: CANVAS_PADDING,
        });
      }
    } else {
      setFixedShapes([]);
      // Optionally, if !sectorData && currentFocus, it implies a fully custom whiteboard based on a user-defined root.
      // For now, we clear fixed shapes. User shapes are fetched based on currentFocus.code.
    }
    // User shapes are fetched by the useQuery hook based on currentFocus.code and user.uid
  }, [sectorData, currentFocus, generateFixedShapesAndDimensions]);


  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.width = `${canvasDimensions.width}px`;
      canvasRef.current.style.height = `${canvasDimensions.height}px`;
    }
  }, [canvasDimensions]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.target !== whiteboardViewportRef.current) return; // Pan only on viewport direct mousedown
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
      currentViewportRef.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (currentViewportRef) {
        currentViewportRef.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);

  const resetView = useCallback(() => {
    if (whiteboardViewportRef.current && fixedShapes.length > 0) {
      const viewportWidth = whiteboardViewportRef.current.clientWidth;
      const newScale = 1;
      setScale(newScale);
      const rootNodeXOffset = fixedShapes[0].x; // Assume first shape is the root of current view
      const rootNodeWidth = fixedShapes[0].width;
      setPan({
        x: (viewportWidth / 2) - (rootNodeXOffset + rootNodeWidth / 2) * newScale,
        y: CANVAS_PADDING,
      });
    } else {
      setScale(1);
      setPan({ x: CANVAS_PADDING, y: CANVAS_PADDING });
    }
  }, [fixedShapes]);
  
  const canEditWhiteboard = !!user && !!currentFocus?.code;

  const addUserShape = (type: 'rectangle' | 'circle', parentId: string | null = null, isSister = false) => {
    if (!canEditWhiteboard || !user) return;

    const newId = `user-${Date.now()}`;
    let newX = CANVAS_PADDING + 50;
    let newY = CANVAS_PADDING + 50;
    let effectiveParentId = parentId;

    const allShapes = [...fixedShapes, ...userShapes];
    const parentNode = parentId ? allShapes.find(s => s.id === parentId) : (currentFocus && fixedShapes.length > 0 ? fixedShapes[0] : null);


    if (parentNode) {
      if (isSister) {
        effectiveParentId = parentNode.parentId; // New shape shares parent with the "sibling" node
        const siblings = allShapes.filter(s => s.parentId === effectiveParentId);
        const lastSibling = siblings[siblings.length - 1] || parentNode;
        newX = lastSibling.x + (lastSibling.nodeType === 'user' ? USER_NODE_WIDTH : NODE_WIDTH) + HORIZONTAL_SPACING / 2;
        newY = lastSibling.y;
      } else { // Is a child
        effectiveParentId = parentNode.id;
        const children = allShapes.filter(s => s.parentId === effectiveParentId);
        const lastChild = children[children.length - 1];
        newX = parentNode.x + ((parentNode.nodeType === 'user' ? USER_NODE_WIDTH : NODE_WIDTH) / 2) - (USER_NODE_WIDTH / 2); // Center under parent
        newY = lastChild ? lastChild.y + (lastChild.nodeType === 'user' ? USER_NODE_HEIGHT : NODE_HEIGHT) + VERTICAL_SPACING_INDUSTRY_ITEM
                         : parentNode.y + (parentNode.nodeType === 'user' ? USER_NODE_HEIGHT : NODE_HEIGHT) + VERTICAL_SPACING_INDUSTRY_START;
      }
    } else { // Adding a "root" user shape for the current focus
       effectiveParentId = currentFocus && fixedShapes.length > 0 ? fixedShapes[0].id : null; // Parent to the main focused NAICS node
       const rootUserShapes = userShapes.filter(s => s.parentId === effectiveParentId);
       newX = fixedShapes[0] ? fixedShapes[0].x : CANVAS_PADDING + 50;
       newY = (fixedShapes[0] ? fixedShapes[0].y + NODE_HEIGHT : CANVAS_PADDING + 50) + 
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
    // Note: This local clear needs to be followed by a "Save Whiteboard" to persist
    toast({ title: "Ideas Cleared", description: "Click 'Save Whiteboard' to make this permanent." });
  };

  const handleSaveWhiteboard = () => {
    if (!user || !currentFocus?.code) {
      toast({ variant: "destructive", title: "Cannot Save", description: "User not logged in or no whiteboard context." });
      return;
    }
    console.log("Saving whiteboard for NAICS:", currentFocus.code, "by user:", user.uid);
    console.log("Shapes to save:", JSON.stringify(userShapes, null, 2));
    saveShapesMutation.mutate({ naicsCode: currentFocus.code, shapes: userShapes, userId: user.uid });
  };

  const getShapeCenter = (shape: Shape, side: 'top' | 'bottom' | 'left' | 'right') => {
    const width = shape.nodeType === 'user' ? USER_NODE_WIDTH : shape.width;
    const height = shape.nodeType === 'user' ? USER_NODE_HEIGHT : shape.height;
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
              <Button variant="outline" size="xs" onClick={() => addUserShape('rectangle')}>
                <Square className="h-3 w-3 mr-1" /> Add Idea
              </Button>
              <Button variant="outline" size="xs" onClick={clearUserShapesForCurrentFocus} className="text-destructive hover:text-destructive">
                <Eraser className="h-3 w-3 mr-1" /> Clear My Ideas
              </Button>
              <Button variant="default" size="xs" onClick={handleSaveWhiteboard} disabled={saveShapesMutation.isPending || isLoadingUserShapes}>
                {saveShapesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Save
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
                  if (e.defaultPrevented || shape.nodeType === 'user') return;
                  if (onNodeClick && shape.code && shape.nodeType) {
                    onNodeClick({ code: shape.code, type: shape.nodeType, text: shape.text });
                  }
                }}
                className={cn(
                  "absolute flex flex-col items-center justify-center p-2 text-center text-xs border-2 shadow-md rounded-md transition-all duration-100",
                  shape.isFixed && "select-none",
                  shape.nodeType === 'user' && "cursor-default bg-background/90 border-primary",
                  shape.nodeType === 'sector' && "bg-primary text-primary-foreground font-semibold border-primary-foreground/50 shadow-xl cursor-pointer",
                  shape.nodeType === 'subsector' && "bg-secondary text-secondary-foreground border-secondary-foreground/40 shadow-lg cursor-pointer",
                  shape.nodeType === 'industry' && "bg-card text-card-foreground border-border shadow-md cursor-pointer",
                  shape.type === 'circle' && shape.nodeType === 'user' && "!rounded-full"
                )}
                style={{
                  left: `${shape.x}px`, top: `${shape.y}px`,
                  width: `${shape.nodeType === 'user' ? USER_NODE_WIDTH : shape.width}px`,
                  height: `${shape.nodeType === 'user' ? USER_NODE_HEIGHT : shape.height}px`,
                  zIndex: shape.nodeType === 'user' ? 20 : 10,
                }}
                onMouseDown={(e) => { if (shape.nodeType !== 'user') e.stopPropagation();}} // Allow pan if clicking fixed, but not user shape input
                onMouseEnter={() => shape.nodeType === 'user' && setHoveredUserShapeId(shape.id)}
                onMouseLeave={() => shape.nodeType === 'user' && setHoveredUserShapeId(null)}
              >
                {shape.nodeType !== 'user' ? (
                  <span className="px-1 break-words">{shape.text}</span>
                ) : (
                  <>
                    <Textarea
                      value={shape.text}
                      onChange={(e) => updateUserShapeText(shape.id, e.target.value)}
                      placeholder={shape.type === 'rectangle' ? 'Type idea...' : 'Idea...'}
                      className="w-full h-full resize-none bg-transparent border-none focus:ring-0 text-xs p-1 text-center flex items-center justify-center"
                      rows={Math.max(2, Math.min(4, Math.floor(shape.text.length / 15)))} // Dynamic rows
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

