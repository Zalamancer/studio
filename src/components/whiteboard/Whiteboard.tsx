
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, GitFork, Trash2, Move, Eye, Save, PlusCircle, Loader2, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getShapesForNaics, saveShapesForNaics } from '@/services/whiteboardService';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { useIsMobile } from "@/hooks/use-mobile"; // Corrected import

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
  code?: string | null; // Ensure code can be null for user shapes
  createdBy?: string | null;
  lastEditedBy?: string | null;
}

export interface FocusNodeDetails {
  code: string;
  type: 'sector' | 'subsector' | 'industry';
  name: string;
}

interface WhiteboardProps {
  sectorData: SectorWithSubSectors | null; // Full data for the main sector of the page
  focusNodeDetails: FocusNodeDetails | null; // The currently focused NAICS node
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

const Whiteboard: React.FC<WhiteboardProps> = ({ sectorData: fullSectorData, focusNodeDetails: currentFocus, onNodeClick }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fixedShapes, setFixedShapes] = useState<Shape[]>([]);
  const [userShapes, setUserShapes] = useState<Shape[]>([]);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });

  const whiteboardViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: CANVAS_PADDING, y: CANVAS_PADDING });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredUserShapeId, setHoveredUserShapeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  console.log(`%c[Whiteboard] Component Render. Current Focus: ${currentFocus?.code}, User: ${user?.uid}, User Shapes Count: ${userShapes.length}`, "color: blueviolet");

  // Fetch user-specific or collaborative shapes for the current NAICS context
  const {
    data: fetchedUserShapesData,
    isLoading: isLoadingShapes,
    isError: isErrorShapes,
    error: shapesQueryError,
    status: shapesQueryStatus,
    isSuccess: isSuccessShapes,
  } = useQuery<Shape[], Error>({
    queryKey: ['whiteboardShapes', currentFocus?.code, user?.uid], // Include user to re-fetch if user changes, though shapes are shared by naicsCode
    queryFn: async () => {
      if (!currentFocus?.code) {
        console.log(`%c[Whiteboard] useQuery queryFn: Skipping fetch - no currentFocus.code`, "color: orange;");
        return [];
      }
      console.log(`%c[Whiteboard] useQuery queryFn: Fetching shapes for NAICS context: '${currentFocus.code}'`, "color: cyan;");
      const shapes = await getShapesForNaics(currentFocus.code); // Service fetches based on NAICS code
      console.log(`%c[Whiteboard] useQuery queryFn: getShapesForNaics returned ${shapes?.length ?? 0} shapes for '${currentFocus.code}'`, "color: cyan;", shapes);
      return Array.isArray(shapes) ? shapes : [];
    },
    enabled: !!currentFocus?.code, // Query enabled only if focus code exists
    refetchOnWindowFocus: false, // Simpler behavior for now
    refetchOnMount: 'always', // More aggressive refetch
  });

  // Effect to update userShapes state when fetchedUserShapesData changes
  useEffect(() => {
    console.log(`%c[Whiteboard] useEffect (for fetchedUserShapesData): Status: ${shapesQueryStatus}, isSuccess: ${isSuccessShapes}`, "color: #20B2AA"); // LightSeaGreen
    if (isSuccessShapes && fetchedUserShapesData) {
      console.log(`%c[Whiteboard] useEffect (for fetchedUserShapesData): SUCCESS. Data length: ${fetchedUserShapesData.length}. Setting userShapes.`, "background: lightgreen; color: black;", fetchedUserShapesData);
      setUserShapes(fetchedUserShapesData);
    } else if (isErrorShapes) {
      console.error(`%c[Whiteboard] useEffect (for fetchedUserShapesData): ERROR fetching user shapes.`, "background: salmon; color: black;", shapesQueryError);
      setUserShapes([]); // Clear on error
    }
    // This effect depends on the direct output of useQuery for user shapes.
  }, [isSuccessShapes, fetchedUserShapesData, isErrorShapes, shapesQueryError]);

  // Effect to clear userShapes if currentFocus is explicitly removed (e.g., navigating away)
  useEffect(() => {
    if (!currentFocus?.code && !isLoadingShapes) {
      console.log(`%c[Whiteboard] useEffect (for clearing userShapes): No currentFocus.code and not loading. Clearing userShapes.`, "color: orange; font-weight: bold;");
      setUserShapes([]);
    }
  }, [currentFocus?.code, isLoadingShapes]);


  const generateShapesAndDimensions = useCallback((sectorDataForLayout: SectorWithSubSectors | null, focusNode: FocusNodeDetails | null) => {
    console.log(`%c[Whiteboard] generateShapesAndDimensions INPUT:`, "color: teal;", { sectorDataForLayout: !!sectorDataForLayout, focusNode });
    const newGeneratedShapes: Shape[] = [];
    let maxContentX = 0;
    let maxContentY = 0;
    let rootNodeXOffset = CANVAS_PADDING;

    if (!focusNode || !sectorDataForLayout) {
      console.log(`%c[Whiteboard] generateShapesAndDimensions: No focusNode or no sectorDataForLayout. Returning empty.`, "color: teal;");
      return { newGeneratedShapes, finalCanvasWidth: 800, finalCanvasHeight: 600, rootNodeXOffset };
    }

    const addShape = (shape: Shape) => {
      newGeneratedShapes.push(shape);
      maxContentX = Math.max(maxContentX, shape.x + shape.width);
      maxContentY = Math.max(maxContentY, shape.y + shape.height);
    };

    let baseNode: Shape | undefined;

    if (focusNode.type === 'sector') {
      baseNode = {
        id: `fixed-sector-${focusNode.code}`, type: 'rectangle', text: `${focusNode.name} (${focusNode.code})`,
        x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 40, height: NODE_HEIGHT, parentId: null,
        isFixed: true, nodeType: 'sector', code: focusNode.code
      };
      addShape(baseNode);

      let currentSubSectorX = CANVAS_PADDING;
      const subSectors = sectorDataForLayout.subSectors || [];
      subSectors.forEach((sub, subIndex) => {
        const subSectorId = `fixed-subsector-${sub.code}`;
        const subSectorShape: Shape = {
          id: subSectorId, type: 'rectangle', text: `${sub.name} (${sub.code})`,
          x: currentSubSectorX, y: (baseNode?.y ?? CANVAS_PADDING) + NODE_HEIGHT + VERTICAL_SPACING,
          width: NODE_WIDTH, height: NODE_HEIGHT, parentId: baseNode?.id ?? null,
          isFixed: true, nodeType: 'subsector', code: sub.code
        };
        addShape(subSectorShape);

        let currentIndustryYOffset = subSectorShape.y + NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;
        (sub.industries || []).forEach((ind) => {
          const industryShape: Shape = {
            id: `fixed-industry-${ind.code}-${subSectorId}`, type: 'rectangle', text: `${ind.name} (${ind.code})`,
            x: subSectorShape.x + (NODE_WIDTH / 2) - (NODE_WIDTH / 2), y: currentIndustryYOffset,
            width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorId,
            isFixed: true, nodeType: 'industry', code: ind.code
          };
          addShape(industryShape);
          currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        });
        maxContentY = Math.max(maxContentY, currentIndustryYOffset - VERTICAL_SPACING_INDUSTRY_ITEM); // Adjust maxContentY based on last industry
        currentSubSectorX += NODE_WIDTH + HORIZONTAL_SPACING;
      });

      if (baseNode && subSectors.length > 0) {
        const totalSubSectorsWidth = Math.max(0, (subSectors.length * NODE_WIDTH) + (Math.max(0, subSectors.length - 1) * HORIZONTAL_SPACING));
        baseNode.x = CANVAS_PADDING + Math.max(0, (totalSubSectorsWidth / 2) - (baseNode.width / 2));
        maxContentX = Math.max(maxContentX, baseNode.x + baseNode.width);
      }
      rootNodeXOffset = baseNode?.x ?? CANVAS_PADDING;

    } else if (focusNode.type === 'subsector') {
      const subSectorData = sectorDataForLayout.subSectors.find(ss => ss.code === focusNode.code);
      if (subSectorData) {
        baseNode = {
          id: `fixed-subsector-${focusNode.code}`, type: 'rectangle', text: `${focusNode.name} (${focusNode.code})`,
          x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null,
          isFixed: true, nodeType: 'subsector', code: focusNode.code
        };
        addShape(baseNode);
        rootNodeXOffset = baseNode.x;

        let currentIndustryYOffset = baseNode.y + NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;
        (subSectorData.industries || []).forEach((ind) => {
          const industryShape: Shape = {
            id: `fixed-industry-${ind.code}-${focusNode.code}`, type: 'rectangle', text: `${ind.name} (${ind.code})`,
            x: (baseNode?.x ?? CANVAS_PADDING) + ((NODE_WIDTH + 20) / 2) - (NODE_WIDTH / 2), y: currentIndustryYOffset,
            width: NODE_WIDTH, height: NODE_HEIGHT, parentId: baseNode?.id ?? null,
            isFixed: true, nodeType: 'industry', code: ind.code
          };
          addShape(industryShape);
          currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        });
        maxContentY = Math.max(maxContentY, currentIndustryYOffset - VERTICAL_SPACING_INDUSTRY_ITEM);
      }
    } else if (focusNode.type === 'industry') {
      let industryData: Industry | undefined;
      sectorDataForLayout.subSectors.forEach(ss => {
        const ind = ss.industries.find(i => i.code === focusNode.code);
        if (ind) industryData = ind;
      });
      if (industryData) {
        baseNode = {
          id: `fixed-industry-${focusNode.code}`, type: 'rectangle', text: `${focusNode.name} (${focusNode.code})`,
          x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null,
          isFixed: true, nodeType: 'industry', code: focusNode.code
        };
        addShape(baseNode);
        rootNodeXOffset = baseNode.x;
      }
    }

    const finalCanvasWidth = Math.max(800, maxContentX + CANVAS_PADDING);
    const finalCanvasHeight = Math.max(600, maxContentY + CANVAS_PADDING);
    console.log(`%c[Whiteboard] generateShapesAndDimensions OUTPUT: newGeneratedShapes count: ${newGeneratedShapes.length}, canvas: ${finalCanvasWidth}x${finalCanvasHeight}`, "color: teal;");
    return { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight, rootNodeXOffset };
  }, []);


  // Effect to layout fixed NAICS nodes and reset view when focus changes
  useEffect(() => {
    console.log(`%c[Whiteboard] LayoutEffect: Triggered.`, "color: orange;", {fullSectorData: !!fullSectorData, currentFocus});
    if (!currentFocus) {
        console.log("%c[Whiteboard] LayoutEffect: No currentFocus, clearing fixed shapes.", "color: orange");
        setFixedShapes([]);
        // User shapes are cleared by a separate effect based on currentFocus.code and query status
        return;
    }
    if (fullSectorData) {
        const { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight, rootNodeXOffset } = generateShapesAndDimensions(fullSectorData, currentFocus);
        console.log(`%c[Whiteboard] LayoutEffect: setFixedShapes called. Count: ${newGeneratedShapes.length}. Canvas: ${finalCanvasWidth}x${finalCanvasHeight}`, "color: orange;");
        setFixedShapes(newGeneratedShapes);
        setCanvasDimensions({ width: finalCanvasWidth, height: finalCanvasHeight });
        // Reset pan/zoom when fixed layout changes significantly
        if (whiteboardViewportRef.current) {
            const viewportWidth = whiteboardViewportRef.current.clientWidth;
            const initialScale = 1;
            const rootNode = newGeneratedShapes.find(s => s.code === currentFocus.code && s.nodeType === currentFocus.type) || newGeneratedShapes[0];
            const currentRootNodeXOffset = rootNode ? rootNode.x : CANVAS_PADDING; // Use calculated x of current root
            const contentWidthToCenter = rootNode && rootNode.width ? rootNode.width : finalCanvasWidth - 2 * CANVAS_PADDING;

            setScale(initialScale);
            setPan({
                x: (viewportWidth / 2) - (currentRootNodeXOffset + contentWidthToCenter / 2) * initialScale,
                y: CANVAS_PADDING * initialScale,
            });
        }
    } else {
        console.log("%c[Whiteboard] LayoutEffect: No fullSectorData, clearing fixed shapes.", "color: orange");
        setFixedShapes([]);
    }
}, [fullSectorData, currentFocus, generateShapesAndDimensions]);


  const handleResize = useCallback(() => {
    if (whiteboardViewportRef.current && (fixedShapes.length > 0 || userShapes.length > 0)) {
      const viewportWidth = whiteboardViewportRef.current.clientWidth;
      const viewportHeight = whiteboardViewportRef.current.clientHeight;
      
      let rootNodeToCenter = fixedShapes.find(s => s.code === currentFocus?.code && s.nodeType === currentFocus?.type) || fixedShapes[0] || userShapes[0];
      
      const contentXToCenter = rootNodeToCenter ? rootNodeToCenter.x + rootNodeToCenter.width / 2 : canvasDimensions.width / 2;
      const contentYToCenter = rootNodeToCenter ? rootNodeToCenter.y + rootNodeToCenter.height / 2 : canvasDimensions.height / 2;
      
      setPan(prevPan => ({
          x: viewportWidth / 2 - contentXToCenter * scale,
          y: viewportHeight / 2 - contentYToCenter * scale,
      }));
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


  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.target !== whiteboardViewportRef.current) return; // Only pan on direct viewport click
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    if (whiteboardViewportRef.current) whiteboardViewportRef.current.style.cursor = 'grabbing';
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

  const resetView = useCallback(() => {
    if (currentFocus && fullSectorData) {
      const { rootNodeXOffset } = generateShapesAndDimensions(fullSectorData, currentFocus);
      if (whiteboardViewportRef.current) {
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const newScale = 1;
        const rootNode = fixedShapes.find(s => s.code === currentFocus.code && s.nodeType === currentFocus.type) || fixedShapes[0];
        const currentRootX = rootNode ? rootNode.x : CANVAS_PADDING;
        const contentWidthToCenter = rootNode && rootNode.width ? rootNode.width : canvasDimensions.width - 2 * CANVAS_PADDING;

        setScale(newScale);
        setPan({
          x: (viewportWidth / 2) - (currentRootX + contentWidthToCenter / 2) * newScale,
          y: CANVAS_PADDING * newScale,
        });
      }
    } else {
      setScale(1);
      setPan({ x: CANVAS_PADDING, y: CANVAS_PADDING });
    }
  }, [fixedShapes, canvasDimensions, generateShapesAndDimensions, fullSectorData, currentFocus]);

  const canEditWhiteboard = !!user && !!currentFocus?.code;

  const addUserShape = (type: 'rectangle' | 'circle', parentShapeId: string | null = null, isSister = false) => {
    if (!canEditWhiteboard || !user || !currentFocus?.code) return;

    const newId = `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let newX = CANVAS_PADDING + 50;
    let newY = CANVAS_PADDING + 50;
    let effectiveParentId = parentShapeId;

    const allNodes = [...fixedShapes, ...userShapes];
    const defaultFixedParent = fixedShapes.find(s => s.code === currentFocus?.code && s.nodeType === currentFocus?.type && s.isFixed);
    let parentNode = parentShapeId ? allNodes.find(s => s.id === parentShapeId) : defaultFixedParent;

    if (parentNode) {
      const parentWidth = parentNode.isFixed ? parentNode.width : USER_NODE_WIDTH;
      const parentHeight = parentNode.isFixed ? parentNode.height : USER_NODE_HEIGHT;

      if (isSister) {
        effectiveParentId = parentNode.parentId; // Could be null if parentNode is a root fixed node or a root user node
        const siblings = userShapes.filter(s => s.parentId === effectiveParentId);
        const lastRelevantNode = siblings.length > 0 ? siblings[siblings.length - 1] : parentNode;
        
        newX = lastRelevantNode.x + (lastRelevantNode.isFixed ? lastRelevantNode.width : USER_NODE_WIDTH) + HORIZONTAL_SPACING / 2;
        newY = lastRelevantNode.y;

      } else { // Adding a child
        effectiveParentId = parentNode.id;
        const children = userShapes.filter(s => s.parentId === effectiveParentId);
        const lastChild = children.length > 0 ? children[children.length - 1] : null;
        
        newX = parentNode.x + (parentWidth / 2) - (USER_NODE_WIDTH / 2);
        newY = lastChild 
          ? lastChild.y + USER_NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM 
          : parentNode.y + parentHeight + VERTICAL_SPACING_INDUSTRY_START;
      }
    } else { // No specific parent clicked, adding relative to current focus context (likely as a root user node)
      effectiveParentId = currentFocus ? fixedShapes.find(s => s.code === currentFocus.code && s.nodeType === currentFocus.type)?.id || null : null;
      const rootUserShapesForContext = userShapes.filter(s => s.parentId === effectiveParentId);
      const baseFixedNodeContext = fixedShapes.find(s => s.id === effectiveParentId);

      if (baseFixedNodeContext) {
        newX = baseFixedNodeContext.x + (baseFixedNodeContext.width / 2) - (USER_NODE_WIDTH / 2);
        newY = baseFixedNodeContext.y + baseFixedNodeContext.height + VERTICAL_SPACING_INDUSTRY_START + (rootUserShapesForContext.length * (USER_NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM));
      } else { // No fixed context node, place generally
        newX = CANVAS_PADDING + 50 + (rootUserShapesForContext.length * (USER_NODE_WIDTH + HORIZONTAL_SPACING / 2));
        newY = canvasDimensions.height - USER_NODE_HEIGHT - CANVAS_PADDING - 50; // Try to place at bottom
      }
    }

    const newShape: Shape = {
      id: newId, type, text: '', x: newX, y: newY,
      width: USER_NODE_WIDTH, height: USER_NODE_HEIGHT, parentId: effectiveParentId,
      nodeType: 'user', createdBy: user.uid, lastEditedBy: user.uid, isFixed: false, code: null
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
        toast({ variant: "destructive", title: "Cannot Delete", description: "Fixed NAICS nodes cannot be deleted." });
        return prev;
      } else {
        return prev;
      }

      let head = 0;
      while (head < queue.length) {
        const currentId = queue[head++];
        prev.filter(s => s.parentId === currentId && !s.isFixed).forEach(child => {
          if (!allIdsToDelete.has(child.id)) {
            allIdsToDelete.add(child.id);
            queue.push(child.id);
          }
        });
      }
      return prev.filter(s => !allIdsToDelete.has(s.id));
    });
  };

  const handleSaveWhiteboard = async () => {
    console.log(`%c[Whiteboard] handleSaveWhiteboard - CRITICAL CHECK:`, "color: orange; font-weight: bold;",
        {
            isUserLoggedIn: !!user,
            userId: user?.uid,
            currentFocusCodeForDocId: currentFocus?.code,
            numberOfUserShapesToSave: userShapes.length,
        }
    );
    if (!user || !currentFocus?.code) {
      toast({ variant: "destructive", title: "Cannot Save", description: "User not logged in or no whiteboard context (NAICS code)." });
      return;
    }
    setIsSaving(true);
    try {
      await saveShapesForNaics(currentFocus.code, userShapes, user.uid);
      toast({ title: "Whiteboard Saved", description: "Your collaborative changes have been saved." });
      queryClient.invalidateQueries({ queryKey: ['whiteboardShapes', currentFocus.code] });
    } catch (error: any) {
      console.error("[Whiteboard] saveShapes: Failed to save whiteboard shapes:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Could not save whiteboard. Check console.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const clearUserShapesForCurrentFocus = () => {
    if (!canEditWhiteboard || !currentFocus?.code) return;
    setUserShapes([]);
    toast({ title: "Contextual Ideas Cleared Locally", description: "Click 'Save Whiteboard' to make this change permanent." });
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

  const allDisplayableShapes = useMemo(() => {
    console.log(`%c[Whiteboard] Memoizing allDisplayableShapes. Fixed: ${fixedShapes.length} User: ${userShapes.length}`, "color: purple");
    return [...fixedShapes, ...userShapes];
  }, [fixedShapes, userShapes]);

  // Log userShapes state changes
  useEffect(() => {
    console.log('%c[Whiteboard] userShapes state CHANGED to:', 'color: dodgerblue', userShapes);
  }, [userShapes]);


  return (
    <Card className="w-full shadow-lg border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">
          {currentFocus?.name || 'Collaborative Ideas'}
          {currentFocus?.code && <span className="text-xs text-muted-foreground ml-2">({currentFocus.code})</span>}
        </CardTitle>
        <div className="flex items-center gap-1">
          {canEditWhiteboard && !!currentFocus && ( // Only show if there's a focus context
            <>
              <Button variant="outline" size="xs" onClick={() => addUserShape('rectangle')} disabled={isLoadingShapes || isSaving}>
                <Square className="h-3 w-3 mr-1" /> Add Idea
              </Button>
              <Button variant="outline" size="xs" onClick={clearUserShapesForCurrentFocus} className="text-destructive hover:text-destructive" disabled={isLoadingShapes || isSaving || userShapes.length === 0}>
                <Eraser className="h-3 w-3 mr-1" /> Clear Ideas
              </Button>
              <Button variant="default" size="xs" onClick={handleSaveWhiteboard} disabled={isLoadingShapes || isSaving || !user}>
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
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

            {allDisplayableShapes.map((shape) => {
              // console.log(`[Whiteboard] Rendering shape: ${shape.id}, type: ${shape.nodeType}, text: ${shape.text}, isFixed: ${shape.isFixed}`);
              return (
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
                  !shape.isFixed && "bg-background/90 border-primary cursor-default",
                  shape.nodeType === 'sector' && "bg-primary text-primary-foreground font-semibold border-primary-foreground/50 shadow-xl",
                  shape.nodeType === 'subsector' && "bg-secondary text-secondary-foreground border-secondary-foreground/40 shadow-lg",
                  shape.nodeType === 'industry' && "bg-card text-card-foreground border-border shadow-md",
                  shape.type === 'circle' && !shape.isFixed && "!rounded-full"
                )}
                style={{
                  left: `${shape.x}px`, top: `${shape.y}px`,
                  width: `${shape.isFixed || shape.nodeType !== 'user' ? shape.width : USER_NODE_WIDTH}px`,
                  height: `${shape.isFixed || shape.nodeType !== 'user' ? shape.height : USER_NODE_HEIGHT}px`,
                  zIndex: shape.isFixed ? 10 : 20,
                }}
                onMouseDown={(e) => { if (!shape.isFixed) e.stopPropagation(); }}
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
                      rows={Math.max(2, Math.min(4, Math.floor(shape.text.length / 20) + 1))}
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
            );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Whiteboard;

