
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
import { useIsMobile } from "@/hooks/use-mobile";
import DocumentEditorPlaceholder from '@/components/document-editor/DocumentEditor'; // Import the editor

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
  code?: string | null;
  createdBy?: string | null;
  lastEditedBy?: string | null;
  docContent?: string; // New: Content for the associated document
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
const USER_NODE_MIN_HEIGHT = 80; // Minimum height for user shapes
const HORIZONTAL_SPACING = 100;
const VERTICAL_SPACING = 120;
const VERTICAL_SPACING_INDUSTRY_START = 60;
const VERTICAL_SPACING_INDUSTRY_ITEM = 30;
const CANVAS_PADDING = 75;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5.0;
const ZOOM_SENSITIVITY = 0.0015;

interface UserShapeContentProps {
  shape: Shape;
  updateUserShapeText: (id: string, text: string) => void;
  onHeightChange: (id: string, newHeight: number) => void;
}

const UserShapeContent: React.FC<UserShapeContentProps> = React.memo(({ shape, updateUserShapeText, onHeightChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height to auto to correctly calculate scrollHeight
      let newScrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.max(USER_NODE_MIN_HEIGHT - 16, newScrollHeight); // -16 for padding
      textareaRef.current.style.height = `${newScrollHeight}px`;
      
      // Ensure the outer shape div height is also updated via callback
      // Add padding of textarea itself (e.g. 8px top/bottom)
      const outerShapeHeight = Math.max(USER_NODE_MIN_HEIGHT, newScrollHeight + 16);
      if (shape.height !== outerShapeHeight) {
        onHeightChange(shape.id, outerShapeHeight);
      }
    }
  }, [shape.text, shape.width, onHeightChange, shape.id, shape.height]);

  return (
    <Textarea
      ref={textareaRef}
      value={shape.text}
      onChange={(e) => updateUserShapeText(shape.id, e.target.value)}
      placeholder={shape.type === 'rectangle' ? 'Idea...' : 'Concept...'}
      className="w-full h-full resize-none bg-transparent border-none focus:ring-0 text-xs p-2 text-center flex items-center justify-center overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()} // Prevent canvas drag when editing text
      rows={1} // Start with 1 row, useEffect will adjust
    />
  );
});
UserShapeContent.displayName = 'UserShapeContent';


const Whiteboard: React.FC<WhiteboardProps> = ({ sectorData: fullSectorData, focusNodeDetails: currentFocus, onNodeClick }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

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
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);


  const {
    data: fetchedUserShapesData,
    isLoading: isLoadingShapes,
    isError: isErrorShapes,
    error: shapesQueryError,
    status: shapesQueryStatus,
  } = useQuery<Shape[], Error>({
    queryKey: ['whiteboardShapes', currentFocus?.code, user?.uid], // Include user UID if shapes are user-specific
    queryFn: async () => {
      console.log(`%c[Whiteboard] useQuery queryFn: Fetching shapes for NAICS context: '${currentFocus?.code}'`, "color: cyan;");
      if (!currentFocus?.code) {
        console.log(`%c[Whiteboard] useQuery queryFn: Skipping fetch - no currentFocus.code.`, "color: orange;");
        return [];
      }
      // If collaborating, this would fetch shared shapes. If user-specific, it needs userId too.
      const shapes = await getShapesForNaics(currentFocus.code);
      return Array.isArray(shapes) ? shapes : [];
    },
    enabled: !!currentFocus?.code && !!user, // Only enable if there's a context and user
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (shapesQueryStatus === 'success' && fetchedUserShapesData) {
      console.log(`%c[Whiteboard] useEffect (process userShapes query): SUCCESS. Data length: ${fetchedUserShapesData.length}. Setting userShapes.`, "background: lightgreen; color: black;", fetchedUserShapesData);
      setUserShapes(fetchedUserShapesData.map(s => ({ ...s, docContent: s.docContent || "" })));
    } else if (shapesQueryStatus === 'error' && shapesQueryError) {
      console.error(`%c[Whiteboard] useEffect (process userShapes query): ERROR fetching user shapes.`, "background: salmon; color: black;", shapesQueryError);
      setUserShapes([]);
    } else if (shapesQueryStatus !== 'pending' && !currentFocus?.code) {
      console.log(`%c[Whiteboard] useEffect (process userShapes query): No currentFocus or query not active, ensuring userShapes is empty.`, "background: lightgoldenrodyellow; color: black;");
      setUserShapes([]);
    }
  }, [shapesQueryStatus, fetchedUserShapesData, shapesQueryError, currentFocus?.code]);


  useEffect(() => {
    console.log('%c[Whiteboard] userShapes state CHANGED to:', 'color: dodgerblue', userShapes);
  }, [userShapes]);


  const generateShapesAndDimensions = useCallback((sectorDataForLayout: SectorWithSubSectors | null, focusNode: FocusNodeDetails | null) => {
    console.log(`%c[Whiteboard] generateShapesAndDimensions INPUT:`, "color: teal;", { sectorDataForLayout: !!sectorDataForLayout, focusNode });
    const newGeneratedShapes: Shape[] = [];
    let maxContentX = 0;
    let maxContentY = 0;

    const addShape = (shape: Shape) => {
      newGeneratedShapes.push(shape);
      maxContentX = Math.max(maxContentX, shape.x + shape.width);
      maxContentY = Math.max(maxContentY, shape.y + shape.height);
    };

    if (!focusNode || !sectorDataForLayout) {
      return { newGeneratedShapes, finalCanvasWidth: 800, finalCanvasHeight: 600 };
    }

    if (focusNode.type === 'sector') {
      const sectorShape: Shape = {
        id: `fixed-sector-${focusNode.code}`, type: 'rectangle', text: `${focusNode.name}`,
        x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 40, height: NODE_HEIGHT, parentId: null,
        isFixed: true, nodeType: 'sector', code: focusNode.code
      };
      addShape(sectorShape);

      let currentColumnX = CANVAS_PADDING;
      let overallMaxBranchHeight = sectorShape.y + sectorShape.height;

      (sectorDataForLayout.subSectors || []).forEach((sub) => {
        let maxIndustryNodeWidthInColumn = NODE_WIDTH;
        (sub.industries || []).forEach(ind => { /* For width calculation if needed */ });

        const currentSubSectorColumnWidth = Math.max(NODE_WIDTH, maxIndustryNodeWidthInColumn);
        const subSectorShape: Shape = {
          id: `fixed-subsector-${sub.code}`, type: 'rectangle', text: `${sub.name}`,
          x: currentColumnX + (currentSubSectorColumnWidth / 2) - (NODE_WIDTH / 2),
          y: sectorShape.y + NODE_HEIGHT + VERTICAL_SPACING,
          width: NODE_WIDTH, height: NODE_HEIGHT, parentId: sectorShape.id,
          isFixed: true, nodeType: 'subsector', code: sub.code
        };
        addShape(subSectorShape);
        let currentSubBranchHeight = subSectorShape.y + subSectorShape.height;

        let currentIndustryYOffset = subSectorShape.y + NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;
        (sub.industries || []).forEach((ind) => {
          const industryShape: Shape = {
            id: `fixed-industry-${ind.code}-${sub.code}`, type: 'rectangle', text: `${ind.name}`,
            x: subSectorShape.x + (NODE_WIDTH / 2) - (NODE_WIDTH / 2), y: currentIndustryYOffset,
            width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorShape.id,
            isFixed: true, nodeType: 'industry', code: ind.code
          };
          addShape(industryShape);
          currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        });
        currentSubBranchHeight = Math.max(currentSubBranchHeight, currentIndustryYOffset - VERTICAL_SPACING_INDUSTRY_ITEM);
        overallMaxBranchHeight = Math.max(overallMaxBranchHeight, currentSubBranchHeight);
        currentColumnX += currentSubSectorColumnWidth + HORIZONTAL_SPACING;
      });
      maxContentX = Math.max(maxContentX, currentColumnX - HORIZONTAL_SPACING);
      maxContentY = Math.max(maxContentY, overallMaxBranchHeight);

      if ((sectorDataForLayout.subSectors || []).length > 0) {
        const totalSubSectorsEffectiveWidth = currentColumnX - HORIZONTAL_SPACING - CANVAS_PADDING;
        sectorShape.x = CANVAS_PADDING + Math.max(0, (totalSubSectorsEffectiveWidth / 2) - (sectorShape.width / 2));
        maxContentX = Math.max(maxContentX, sectorShape.x + sectorShape.width);
      }

    } else if (focusNode.type === 'subsector') {
      const subSectorData = sectorDataForLayout.subSectors.find(ss => ss.code === focusNode.code);
      if (subSectorData) {
        const subSectorShape: Shape = {
          id: `fixed-subsector-${focusNode.code}`, type: 'rectangle', text: `${focusNode.name}`,
          x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH + 20, height: NODE_HEIGHT, parentId: null,
          isFixed: true, nodeType: 'subsector', code: focusNode.code
        };
        addShape(subSectorShape);
        let currentIndustryYOffset = subSectorShape.y + NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;
        (subSectorData.industries || []).forEach((ind) => {
          const industryShape: Shape = {
            id: `fixed-industry-${ind.code}-${focusNode.code}`, type: 'rectangle', text: `${ind.name}`,
            x: subSectorShape.x + ((NODE_WIDTH + 20) / 2) - (NODE_WIDTH / 2), y: currentIndustryYOffset,
            width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorShape.id,
            isFixed: true, nodeType: 'industry', code: ind.code
          };
          addShape(industryShape);
          currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        });
      }
    } else if (focusNode.type === 'industry') {
      const industryShape: Shape = {
        id: `fixed-industry-${focusNode.code}`, type: 'rectangle', text: `${focusNode.name}`,
        x: CANVAS_PADDING, y: CANVAS_PADDING, width: NODE_WIDTH, height: NODE_HEIGHT, parentId: null,
        isFixed: true, nodeType: 'industry', code: focusNode.code
      };
      addShape(industryShape);
    }

    const finalCanvasWidth = Math.max(800, maxContentX + CANVAS_PADDING);
    const finalCanvasHeight = Math.max(600, maxContentY + CANVAS_PADDING);
    console.log(`%c[Whiteboard] generateShapesAndDimensions OUTPUT: newGeneratedShapes count: ${newGeneratedShapes.length}, canvas: ${finalCanvasWidth}x${finalCanvasHeight}`, "color: teal;");
    return { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight };
  }, []);


  const initialLayoutDone = useRef(false);

  useEffect(() => {
    console.log(`%c[Whiteboard] LayoutEffect: Triggered.`, "color: orange;", { fullSectorData: !!fullSectorData, currentFocus });
    if (currentFocus && fullSectorData && whiteboardViewportRef.current) {
      const { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight } = generateShapesAndDimensions(fullSectorData, currentFocus);
      console.log(`%c[Whiteboard] LayoutEffect: setFixedShapes called. Count: ${newGeneratedShapes.length}. Canvas: ${finalCanvasWidth}x${finalCanvasHeight}`, "color: orange;");
      setFixedShapes(newGeneratedShapes);
      setCanvasDimensions({ width: finalCanvasWidth, height: finalCanvasHeight });

      if (!initialLayoutDone.current || !isMobile) { // Center on initial load or if not mobile (resize handles it less aggressively)
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const initialScale = 1;
        const rootNode = newGeneratedShapes.find(s => s.code === currentFocus.code && s.nodeType === currentFocus.type) || newGeneratedShapes[0];
        
        const contentXToCenter = rootNode ? rootNode.x + rootNode.width / 2 : finalCanvasWidth / 2;
        const contentYToCenter = rootNode ? rootNode.y + rootNode.height / 2 : CANVAS_PADDING + NODE_HEIGHT / 2;

        setScale(initialScale);
        setPan({
            x: (viewportWidth / 2) - (contentXToCenter * initialScale),
            y: CANVAS_PADDING * initialScale,
        });
        initialLayoutDone.current = true;
      }
    } else if (!currentFocus) {
      console.log("%c[Whiteboard] LayoutEffect: No currentFocus, clearing fixed shapes.", "color: orange");
      setFixedShapes([]);
      setEditingShapeId(null); // Clear editing state when focus is lost
    }
  }, [fullSectorData, currentFocus, generateShapesAndDimensions, isMobile]);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.width = `${canvasDimensions.width}px`;
      canvasRef.current.style.height = `${canvasDimensions.height}px`;
    }
  }, [canvasDimensions]);

  const handleResize = useCallback(() => {
    if (whiteboardViewportRef.current && (fixedShapes.length > 0 || userShapes.length > 0)) {
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const viewportHeight = whiteboardViewportRef.current.clientHeight;
        
        let rootNodeToCenter = fixedShapes.find(s => s.code === currentFocus?.code && s.nodeType === currentFocus?.type) || fixedShapes[0] || userShapes[0];
        
        const contentXToCenter = rootNodeToCenter ? rootNodeToCenter.x + rootNodeToCenter.width / 2 : canvasDimensions.width / 2;
        const contentYToCenter = rootNodeToCenter ? rootNodeToCenter.y + rootNodeToCenter.height / 2 : canvasDimensions.height / 2;
        
        setPan({
            x: viewportWidth / 2 - contentXToCenter * scale,
            y: viewportHeight / 2 - contentYToCenter * scale,
        });
    }
  }, [scale, fixedShapes, userShapes, canvasDimensions, currentFocus]);

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
    if (currentFocus && fullSectorData && whiteboardViewportRef.current) {
      const { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight } = generateShapesAndDimensions(fullSectorData, currentFocus);
      const viewportWidth = whiteboardViewportRef.current.clientWidth;
      const newScale = 1;
      const rootNode = newGeneratedShapes.find(s => s.code === currentFocus.code && s.nodeType === currentFocus.type) || newGeneratedShapes[0];
      const rootNodeXOffset = rootNode ? rootNode.x : CANVAS_PADDING;
      const contentWidthToCenter = rootNode?.width ?? (finalCanvasWidth - 2 * CANVAS_PADDING);
      
      setScale(newScale);
      setPan({
        x: (viewportWidth / 2) - (rootNodeXOffset + contentWidthToCenter / 2) * newScale,
        y: CANVAS_PADDING * newScale,
      });
    } else {
      setScale(1);
      setPan({ x: CANVAS_PADDING, y: CANVAS_PADDING });
      if (!fullSectorData) { 
        setFixedShapes([]);
        setUserShapes([]);
        setEditingShapeId(null);
        setCanvasDimensions({width: 800, height: 600});
      }
    }
  }, [fullSectorData, currentFocus, generateShapesAndDimensions]);

  const canEditWhiteboard = !!user && !!currentFocus?.code;

  const addUserShape = (type: 'rectangle' | 'circle', parentShapeId: string | null = null, isSister = false) => {
    if (!canEditWhiteboard || !user || !currentFocus?.code) return;
    const newId = `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let newX = CANVAS_PADDING + 50;
    let newY = CANVAS_PADDING + 50;
    let effectiveParentId = parentShapeId;

    const allNodes = [...fixedShapes, ...userShapes];
    const defaultFixedParentForNewUserNode = fixedShapes.find(s => s.code === currentFocus?.code && s.nodeType === currentFocus?.type && s.isFixed) || fixedShapes[0];
    let parentNode = parentShapeId ? allNodes.find(s => s.id === parentShapeId) : defaultFixedParentForNewUserNode;

    if (parentNode) {
        const parentWidth = parentNode.width; // Use actual width
        const parentHeight = parentNode.height; // Use actual height
    
        if (isSister) {
            effectiveParentId = parentNode.parentId;
            const siblings = userShapes.filter(s => s.parentId === effectiveParentId);
            const lastRelevantNode = siblings.length > 0 ? siblings[siblings.length - 1] : parentNode;
            
            newX = lastRelevantNode.x + lastRelevantNode.width + HORIZONTAL_SPACING / 2;
            newY = lastRelevantNode.y;
    
        } else { 
            effectiveParentId = parentNode.id;
            const children = userShapes.filter(s => s.parentId === effectiveParentId);
            const lastChild = children.length > 0 ? children[children.length - 1] : null;
            
            newX = parentNode.x + (parentWidth / 2) - (NODE_WIDTH / 2); // Center user node under parent
            newY = lastChild 
            ? lastChild.y + lastChild.height + VERTICAL_SPACING_INDUSTRY_ITEM 
            : parentNode.y + parentHeight + VERTICAL_SPACING_INDUSTRY_START;
        }
    } else {
        effectiveParentId = currentFocus ? fixedShapes.find(s => s.code === currentFocus.code && s.nodeType === currentFocus.type)?.id || null : null;
        const rootUserShapesForContext = userShapes.filter(s => s.parentId === effectiveParentId);
        newX = CANVAS_PADDING + 50 + (rootUserShapesForContext.length * (NODE_WIDTH + HORIZONTAL_SPACING / 2));
        newY = canvasDimensions.height - NODE_HEIGHT - CANVAS_PADDING - 50; // Place at bottom for now
    }

    const newShape: Shape = {
      id: newId, type, text: '', x: newX, y: newY,
      width: NODE_WIDTH, height: USER_NODE_MIN_HEIGHT, parentId: effectiveParentId,
      nodeType: 'user', createdBy: user.uid, lastEditedBy: user.uid, isFixed: false, code: null,
      docContent: "" // Initialize docContent
    };
    setUserShapes(prev => [...prev, newShape]);
    setEditingShapeId(newId); // Open document editor for new shape
  };

  const updateUserShapeText = (id: string, text: string) => {
    if (!user) return;
    setUserShapes(prev => prev.map(s => s.id === id ? { ...s, text, lastEditedBy: user.uid } : s));
  };
  
  const updateUserShapeHeight = (id: string, newHeight: number) => {
    setUserShapes(prev => prev.map(s => s.id === id ? { ...s, height: Math.max(USER_NODE_MIN_HEIGHT, newHeight) } : s));
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
      const newShapes = prev.filter(s => !allIdsToDelete.has(s.id));
      if (editingShapeId && allIdsToDelete.has(editingShapeId)) {
        setEditingShapeId(null); // Close editor if deleted shape was being edited
      }
      return newShapes;
    });
  };

  const handleSaveWhiteboard = async () => {
    if (!user || !currentFocus?.code) {
      toast({ variant: "destructive", title: "Cannot Save", description: "User not logged in or no whiteboard context (NAICS code)." });
      return;
    }
    console.log(`%c[Whiteboard] handleSaveWhiteboard - CRITICAL CHECK:`, "color: #FF8C00; font-weight: bold;",
        {
            isUserLoggedIn: !!user,
            userId: user?.uid,
            currentFocusCodeForDocId: currentFocus?.code,
            numberOfUserShapesToSave: userShapes.length,
            userShapesData: JSON.stringify(userShapes.slice(0,2)) // Log first 2 shapes for brevity
        }
    );
    setIsSaving(true);
    try {
      await saveShapesForNaics(currentFocus.code, userShapes, user.uid);
      toast({ title: "Whiteboard Saved", description: "Your collaborative ideas have been saved." });
      queryClient.invalidateQueries({ queryKey: ['whiteboardShapes', currentFocus.code, user.uid] });
    } catch (error: any) {
      console.error(`%c[Whiteboard] saveShapesMutation: Failed to save whiteboard shapes:`, "color: red;", error);
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
    setEditingShapeId(null);
    toast({ title: "Contextual Ideas Cleared Locally", description: "Click 'Save Whiteboard' to make this change permanent." });
  };

  const getShapeCenter = (shape: Shape, side: 'top' | 'bottom' | 'left' | 'right') => {
    const width = shape.width; // Use actual shape width
    const height = shape.height; // Use actual shape height
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

  const handleUserShapeClick = (shapeId: string) => {
    if (!userShapes.find(s => s.id === shapeId)?.isFixed) {
      setEditingShapeId(shapeId);
    }
  };

  const handleDocumentContentChange = (newContent: string) => {
    if (editingShapeId && user) {
      setUserShapes(prev =>
        prev.map(s =>
          s.id === editingShapeId ? { ...s, docContent: newContent, lastEditedBy: user.uid } : s
        )
      );
    }
  };

  const currentEditingShape = userShapes.find(s => s.id === editingShapeId);


  console.log(`%c[Whiteboard] Render. isLoadingShapes: ${isLoadingShapes}, shapesQueryStatus: ${shapesQueryStatus}, shapesQueryError: ${!!shapesQueryError}, currentFocus: ${currentFocus?.code}, userShapes length: ${userShapes.length}`, "color: gray");

  return (
    <div className="flex flex-col w-full">
      <Card className="w-full shadow-lg border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">
            {currentFocus?.name || 'Collaborative Ideas'}
            {currentFocus?.code && <span className="text-xs text-muted-foreground ml-2">({currentFocus.code})</span>}
          </CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            {canEditWhiteboard && !!currentFocus && (
              <>
                <Button variant="outline" size="xs" onClick={() => addUserShape('rectangle')} disabled={isLoadingShapes || isSaving}>
                  <Square className="h-3 w-3 mr-1" /> Add Idea
                </Button>
                <Button variant="outline" size="xs" onClick={clearUserShapesForCurrentFocus} className="text-destructive hover:text-destructive" disabled={isLoadingShapes || isSaving || userShapes.length === 0}>
                  <Eraser className="h-3 w-3 mr-1" /> Clear My Ideas
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
                    } else if (!shape.isFixed) {
                      handleUserShapeClick(shape.id);
                    }
                  }}
                  onMouseDown={(e) => { if (!shape.isFixed) e.stopPropagation(); }}
                  onMouseEnter={() => !shape.isFixed && setHoveredUserShapeId(shape.id)}
                  onMouseLeave={() => !shape.isFixed && setHoveredUserShapeId(null)}
                  className={cn(
                    "absolute flex flex-col items-center justify-center p-2 text-center text-xs border-2 shadow-md rounded-md transition-all duration-100",
                    shape.isFixed ? "cursor-pointer" : "bg-background/90 border-primary cursor-default",
                    shape.nodeType === 'sector' && "bg-primary text-primary-foreground font-semibold border-primary-foreground/50 shadow-xl",
                    shape.nodeType === 'subsector' && "bg-secondary text-secondary-foreground border-secondary-foreground/40 shadow-lg",
                    shape.nodeType === 'industry' && "bg-card text-card-foreground border-border shadow-md",
                    shape.nodeType === 'user' && "bg-background/90 border-accent shadow-md",
                    shape.type === 'circle' && !shape.isFixed && "!rounded-full"
                  )}
                  style={{
                    left: `${shape.x}px`, top: `${shape.y}px`,
                    width: `${shape.width}px`,
                    height: `${shape.height}px`,
                    zIndex: shape.isFixed ? 10 : (editingShapeId === shape.id ? 25 : 20),
                  }}
                >
                  {shape.isFixed ? (
                    <span className="px-1 break-words select-none">{shape.text} {shape.code && `(${shape.code})`}</span>
                  ) : (
                    <>
                     <UserShapeContent
                        shape={shape}
                        updateUserShapeText={updateUserShapeText}
                        onHeightChange={updateUserShapeHeight}
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

      {editingShapeId && currentEditingShape && (
        <div className="mt-6 w-full">
          <DocumentEditorPlaceholder
            key={editingShapeId} // Force re-mount when editingShapeId changes
            initialContent={currentEditingShape.docContent || ""}
            onContentChange={handleDocumentContentChange}
            title={`Document for: ${currentEditingShape.text || `Idea ${currentEditingShape.id.substring(0,6)}`}`}
            readOnly={!canEditWhiteboard}
          />
        </div>
      )}
    </div>
  );
};

export default Whiteboard;

    