
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
import DocumentEditorPlaceholder from '@/components/document-editor/DocumentEditor';

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
  docContent: string; // Non-optional, initialized to ""
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
const USER_NODE_MIN_HEIGHT = 80;
const NODE_HEIGHT = 70;
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
      textareaRef.current.style.height = 'auto';
      let newScrollHeight = textareaRef.current.scrollHeight;
      const newShapeHeight = Math.max(USER_NODE_MIN_HEIGHT, newScrollHeight + 8); // +8 for some padding

      textareaRef.current.style.height = `${newScrollHeight}px`;

      if (shape.height !== newShapeHeight) {
        onHeightChange(shape.id, newShapeHeight);
      }
    }
  }, [shape.text, shape.width, onHeightChange, shape.id, shape.height]);


  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateUserShapeText(shape.id, e.target.value);
  };

  return (
    <Textarea
      ref={textareaRef}
      value={shape.text}
      onChange={handleChange}
      placeholder={shape.type === 'rectangle' ? 'Idea...' : 'Concept...'}
      className="w-full h-full resize-none bg-transparent border-none focus:ring-0 text-xs p-2 text-center flex items-center justify-center overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
      rows={Math.max(2, Math.min(4, Math.floor(shape.text.length / (shape.width / 7)) + 1))} // Dynamic rows
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
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [hoveredUserShapeId, setHoveredUserShapeId] = useState<string | null>(null);

  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
  const whiteboardViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: CANVAS_PADDING, y: CANVAS_PADDING });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

  console.log(`%c[Whiteboard] Defining useQuery. Current Focus for queryKey:`, "color: purple;", currentFocus);
  const {
    data: fetchedUserShapesData,
    isLoading: isLoadingShapes,
    isSuccess: isSuccessShapes,
    isError: isErrorShapes,
    error: shapesQueryError,
    status: shapesQueryStatus,
  } = useQuery<Shape[], Error>({
    queryKey: ['whiteboardShapes', currentFocus?.code, user?.uid],
    queryFn: async () => {
      if (!currentFocus?.code) {
        console.log("[Whiteboard] useQuery: No currentFocus.code, returning empty array for user shapes.");
        return [];
      }
      console.log(`%c[Whiteboard] useQuery queryFn: Fetching shapes for NAICS context: '${currentFocus.code}' by user '${user?.uid}'`, "color: teal");
      const shapes = await getShapesForNaics(currentFocus.code);
      return Array.isArray(shapes) ? shapes : [];
    },
    enabled: !!currentFocus?.code && !!user?.uid,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (isSuccessShapes && fetchedUserShapesData) {
      console.log(`%c[Whiteboard] useEffect (process userShapes query): SUCCESS. Data length: ${fetchedUserShapesData.length}. Setting userShapes.`, "background: lightgreen; color: black;", fetchedUserShapesData);
      setUserShapes(fetchedUserShapesData);
    } else if (isErrorShapes && shapesQueryError) {
      console.error(`%c[Whiteboard] useEffect (process userShapes query): ERROR fetching user shapes.`, "background: salmon; color: black;", shapesQueryError);
      setUserShapes([]);
    } else if (!isLoadingShapes && !currentFocus?.code) {
      console.log(`%c[Whiteboard] useEffect (process userShapes query): No currentFocus or query not active, ensuring userShapes is empty.`, "background: lightgoldenrodyellow; color: black;");
      setUserShapes([]);
    }
  }, [isSuccessShapes, fetchedUserShapesData, isErrorShapes, shapesQueryError, isLoadingShapes, currentFocus?.code, setUserShapes]);


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

    if (!focusNode || (!sectorDataForLayout && focusNode.type === 'sector')) {
      console.warn(`%c[Whiteboard] generateShapesAndDimensions: No focusNode or sectorDataForLayout is null for sector type focus. FocusNode:`, "color: orange;", focusNode, "SectorData:", sectorDataForLayout);
      return { newGeneratedShapes: [], finalCanvasWidth: 800, finalCanvasHeight: 600 };
    }

    let rootNodeX = CANVAS_PADDING;
    let rootNodeY = CANVAS_PADDING;

    if (focusNode.type === 'sector' && sectorDataForLayout) {
      const sectorNodeWidth = NODE_WIDTH + 40;
      const sectorNode: Shape = {
        id: `fixed-sector-${focusNode.code}`, type: 'rectangle', text: `${focusNode.name}`,
        x: rootNodeX, y: rootNodeY, width: sectorNodeWidth, height: NODE_HEIGHT, parentId: null,
        isFixed: true, nodeType: 'sector', code: focusNode.code, docContent: ""
      };
      addShape(sectorNode);

      let currentColumnX = CANVAS_PADDING;
      let overallMaxYForSubSectors = sectorNode.y + sectorNode.height + VERTICAL_SPACING;

      (sectorDataForLayout.subSectors || []).forEach((sub) => {
        const maxIndustryNodeWidthInColumn = NODE_WIDTH; // Assuming industries also use NODE_WIDTH for simplicity here
        const currentSubSectorColumnWidth = Math.max(NODE_WIDTH, maxIndustryNodeWidthInColumn);

        const subSectorShape: Shape = {
          id: `fixed-subsector-${sub.code}`, type: 'rectangle', text: `${sub.name}`,
          x: currentColumnX + (currentSubSectorColumnWidth / 2) - (NODE_WIDTH / 2), // Center within its column
          y: sectorNode.y + sectorNode.height + VERTICAL_SPACING,
          width: NODE_WIDTH, height: NODE_HEIGHT, parentId: sectorNode.id,
          isFixed: true, nodeType: 'subsector', code: sub.code, docContent: ""
        };
        addShape(subSectorShape);
        let currentSubSectorBranchMaxY = subSectorShape.y + subSectorShape.height;

        let currentIndustryYOffset = VERTICAL_SPACING_INDUSTRY_START;
        (sub.industries || []).forEach((ind) => {
          const industryShape: Shape = {
            id: `fixed-industry-${ind.code}-${sub.code}`, type: 'rectangle', text: `${ind.name}`,
            x: subSectorShape.x + (NODE_WIDTH / 2) - (NODE_WIDTH / 2), // Center under sub-sector
            y: subSectorShape.y + NODE_HEIGHT + currentIndustryYOffset,
            width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorShape.id,
            isFixed: true, nodeType: 'industry', code: ind.code, docContent: ""
          };
          addShape(industryShape);
          currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        });
        currentSubSectorBranchMaxY = Math.max(currentSubSectorBranchMaxY, subSectorShape.y + NODE_HEIGHT + currentIndustryYOffset - VERTICAL_SPACING_INDUSTRY_ITEM);
        overallMaxYForSubSectors = Math.max(overallMaxYForSubSectors, currentSubSectorBranchMaxY);
        currentColumnX += currentSubSectorColumnWidth + HORIZONTAL_SPACING;
      });
      
      maxContentX = Math.max(maxContentX, currentColumnX - HORIZONTAL_SPACING); // Adjust for last spacing
      maxContentY = Math.max(maxContentY, overallMaxYForSubSectors);
      
      if ((sectorDataForLayout.subSectors || []).length > 0 && newGeneratedShapes[0]?.nodeType === 'sector') {
        const totalSubSectorsEffectiveWidth = currentColumnX - HORIZONTAL_SPACING - CANVAS_PADDING;
        newGeneratedShapes[0].x = CANVAS_PADDING + Math.max(0, (totalSubSectorsEffectiveWidth / 2) - (sectorNodeWidth / 2));
        maxContentX = Math.max(maxContentX, newGeneratedShapes[0].x + newGeneratedShapes[0].width);
      }


    } else if (focusNode.type === 'subsector' && fullSectorData) {
      const subSectorData = fullSectorData.subSectors.find(ss => ss.code === focusNode.code);
      if (subSectorData) {
        const subSectorNodeWidth = NODE_WIDTH + 20;
        const subSectorNode: Shape = {
          id: `fixed-subsector-${focusNode.code}`, type: 'rectangle', text: `${focusNode.name}`,
          x: rootNodeX, y: rootNodeY, width: subSectorNodeWidth, height: NODE_HEIGHT, parentId: null,
          isFixed: true, nodeType: 'subsector', code: focusNode.code, docContent: ""
        };
        addShape(subSectorNode);
        let currentIndustryYOffset = NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_START;
        (subSectorData.industries || []).forEach((ind) => {
          const industryShape: Shape = {
            id: `fixed-industry-${ind.code}-${focusNode.code}`, type: 'rectangle', text: `${ind.name}`,
            x: subSectorNode.x + (subSectorNodeWidth / 2) - (NODE_WIDTH / 2),
            y: subSectorNode.y + currentIndustryYOffset,
            width: NODE_WIDTH, height: NODE_HEIGHT, parentId: subSectorNode.id,
            isFixed: true, nodeType: 'industry', code: ind.code, docContent: ""
          };
          addShape(industryShape);
          currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
        });
        maxContentY = Math.max(maxContentY, subSectorNode.y + currentIndustryYOffset - VERTICAL_SPACING_INDUSTRY_ITEM);
      } else {
        console.warn(`[Whiteboard] generateShapes: SubSector data not found for code ${focusNode.code} in fullSectorData.`);
      }
    } else if (focusNode.type === 'industry' && fullSectorData) {
      let industryData: Industry | undefined;
      for (const sub of fullSectorData.subSectors) {
        const foundIndustry = sub.industries.find(ind => ind.code === focusNode.code);
        if (foundIndustry) {
          industryData = foundIndustry; break;
        }
      }
      if (industryData) {
        const industryNode: Shape = {
          id: `fixed-industry-${focusNode.code}`, type: 'rectangle', text: `${focusNode.name}`,
          x: rootNodeX, y: rootNodeY, width: NODE_WIDTH, height: NODE_HEIGHT, parentId: null,
          isFixed: true, nodeType: 'industry', code: focusNode.code, docContent: ""
        };
        addShape(industryNode);
      } else {
        console.warn(`[Whiteboard] generateShapes: Industry data not found for code ${focusNode.code} in fullSectorData.`);
      }
    }

    const finalCanvasWidth = Math.max(800, maxContentX + CANVAS_PADDING);
    const finalCanvasHeight = Math.max(600, maxContentY + CANVAS_PADDING);
    console.log(`%c[Whiteboard] generateShapesAndDimensions OUTPUT: newGeneratedShapes count: ${newGeneratedShapes.length}, canvas: ${finalCanvasWidth}x${finalCanvasHeight}`, "color: teal;");
    return { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight };
  }, [fullSectorData]);


  const layoutFixedShapesAndSetInitialView = useCallback(() => {
    console.log(`%c[Whiteboard] layoutFixedShapesAndSetInitialView: Triggered.`, "color: orange;", { fullSectorData: !!fullSectorData, currentFocus });
    if (currentFocus && whiteboardViewportRef.current) {
        const dataForLayout = currentFocus.type === 'sector' ? fullSectorData : fullSectorData;

        if (!dataForLayout && (currentFocus.type === 'subsector' || currentFocus.type === 'industry')) {
            console.warn("[Whiteboard] layoutFixedShapesAndSetInitialView: fullSectorData is missing for subsector/industry focused layout. Cannot generate shapes.");
            setFixedShapes([]);
            setCanvasDimensions({ width: 800, height: 600 });
            return;
        }
        
        const { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight } = generateShapesAndDimensions(dataForLayout, currentFocus);
        console.log(`%c[Whiteboard] layoutFixedShapesAndSetInitialView: setFixedShapes called. Count: ${newGeneratedShapes.length}. Canvas: ${finalCanvasWidth}x${finalCanvasHeight}`, "color: orange;");
        setFixedShapes(newGeneratedShapes);
        setCanvasDimensions({ width: finalCanvasWidth, height: finalCanvasHeight });

        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const newScaleVal = 1; 
        const rootNodeToCenter = newGeneratedShapes.find(s => s.code === currentFocus.code && s.nodeType === currentFocus.type) || newGeneratedShapes[0];
        
        const contentXToCenter = rootNodeToCenter ? rootNodeToCenter.x + rootNodeToCenter.width / 2 : finalCanvasWidth / 2;
        
        setScale(newScaleVal);
        setPan({
            x: (viewportWidth / 2) - (contentXToCenter * newScaleVal),
            y: CANVAS_PADDING * newScaleVal, 
        });
    } else if (!currentFocus) {
      console.log("%c[Whiteboard] layoutFixedShapesAndSetInitialView: No currentFocus, clearing fixed shapes.", "color: orange");
      setFixedShapes([]);
      setEditingShapeId(null);
      setCanvasDimensions({width: 800, height: 600});
      setPan({x: CANVAS_PADDING, y: CANVAS_PADDING});
      setScale(1);
    }
  }, [currentFocus, fullSectorData, generateShapesAndDimensions, setFixedShapes, setCanvasDimensions, setPan, setScale]);


  useEffect(() => {
    layoutFixedShapesAndSetInitialView();
  }, [layoutFixedShapesAndSetInitialView]);


  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.width = `${canvasDimensions.width}px`;
      canvasRef.current.style.height = `${canvasDimensions.height}px`;
    }
  }, [canvasDimensions]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 ) return; // Only pan with left mouse button
    const target = e.target as HTMLElement;
    // Allow panning if clicking directly on viewport or on the inner canvas (if it's large enough)
    if (target === whiteboardViewportRef.current || target === canvasRef.current) {
        setIsPanning(true);
        setPanStart({
            x: e.clientX - pan.x,
            y: e.clientY - pan.y,
        });
        if (whiteboardViewportRef.current) {
            whiteboardViewportRef.current.style.cursor = 'grabbing';
        }
        e.preventDefault(); // Prevent text selection during pan
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
    }
    window.addEventListener('resize', handleResize);
    return () => {
      if (currentViewportRef) {
        currentViewportRef.removeEventListener('wheel', handleWheel);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [handleWheel, handleResize]);


  const resetView = useCallback(() => {
    if (currentFocus && whiteboardViewportRef.current) {
        const dataForLayout = currentFocus.type === 'sector' ? fullSectorData : fullSectorData;
        if (!dataForLayout && (currentFocus.type === 'subsector' || currentFocus.type === 'industry')) {
             console.warn("[Whiteboard] resetView: fullSectorData is missing. Cannot reset view properly.");
             return;
        }
        const { newGeneratedShapes, finalCanvasWidth } = generateShapesAndDimensions(dataForLayout, currentFocus);
        const viewportWidth = whiteboardViewportRef.current.clientWidth;
        const newScaleVal = 1;
        const rootNodeToCenter = newGeneratedShapes.find(s => s.code === currentFocus.code && s.nodeType === currentFocus.type) || newGeneratedShapes[0];
        const contentXToCenter = rootNodeToCenter ? rootNodeToCenter.x + rootNodeToCenter.width / 2 : finalCanvasWidth / 2;

        setScale(newScaleVal);
        setPan({
            x: (viewportWidth / 2) - (contentXToCenter * newScaleVal),
            y: CANVAS_PADDING * newScaleVal,
        });
    } else {
        console.warn("[Whiteboard] resetView: No currentFocus or whiteboardViewportRef. Cannot reset.");
        setScale(1);
        setPan({ x: CANVAS_PADDING, y: CANVAS_PADDING });
        if (!fullSectorData && !currentFocus) { 
            setFixedShapes([]);
            setUserShapes([]);
            setEditingShapeId(null);
            setCanvasDimensions({width: 800, height: 600});
        }
    }
  }, [currentFocus, fullSectorData, generateShapesAndDimensions]);
  
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
        const parentWidth = parentNode.width;
        const parentHeight = parentNode.height;
    
        if (isSister) {
            effectiveParentId = parentNode.parentId; 
            const siblingsOfParentNode = userShapes.filter(s => s.parentId === effectiveParentId);
            const lastRelevantNode = siblingsOfParentNode.length > 0 ? siblingsOfParentNode[siblingsOfParentNode.length - 1] : parentNode;
            
            newX = lastRelevantNode.x + lastRelevantNode.width + HORIZONTAL_SPACING / 2;
            newY = lastRelevantNode.y; 
        } else { 
            effectiveParentId = parentNode.id; 
            const childrenOfParentNode = userShapes.filter(s => s.parentId === effectiveParentId);
            const lastChild = childrenOfParentNode.length > 0 ? childrenOfParentNode[childrenOfParentNode.length - 1] : null;
            
            newX = parentNode.x + (parentWidth / 2) - (NODE_WIDTH / 2); 
            newY = lastChild 
            ? lastChild.y + lastChild.height + VERTICAL_SPACING_INDUSTRY_ITEM 
            : parentNode.y + parentHeight + VERTICAL_SPACING_INDUSTRY_START; 
        }
    } else { 
        effectiveParentId = currentFocus ? fixedShapes.find(s => s.code === currentFocus?.code && s.nodeType === currentFocus?.type)?.id || null : null;
        const rootUserShapesForContext = userShapes.filter(s => s.parentId === effectiveParentId);
        newX = CANVAS_PADDING + 50 + (rootUserShapesForContext.length * (NODE_WIDTH + HORIZONTAL_SPACING / 2));
        newY = canvasDimensions.height - NODE_HEIGHT - CANVAS_PADDING - 50; 
    }

    const newShape: Shape = {
      id: newId, type, text: '', x: newX, y: newY,
      width: NODE_WIDTH, height: USER_NODE_MIN_HEIGHT, parentId: effectiveParentId,
      nodeType: 'user', createdBy: user.uid, lastEditedBy: user.uid, isFixed: false, code: null,
      docContent: ""
    };
    setUserShapes(prev => [...prev, newShape]);
    setEditingShapeId(newId); 
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
        setEditingShapeId(null);
      }
      return newShapes;
    });
  };

  const handleSaveWhiteboard = async () => {
    if (!user || !currentFocus?.code) {
      toast({ variant: "destructive", title: "Cannot Save", description: "User not logged in or no whiteboard context (NAICS code)." });
      return;
    }
    const shapesToSave = userShapes.map(s => ({...s})); // Create a shallow copy to avoid potential issues if state updates during save
    const firstUserShapeDocContent = shapesToSave.find(s => !s.isFixed)?.docContent;

    console.log(`%c[Whiteboard] handleSaveWhiteboard - CRITICAL CHECK:`, "color: #FF8C00; font-weight: bold;",
        {
            isUserLoggedIn: !!user,
            userId: user?.uid,
            currentFocusCodeForDocId: currentFocus?.code,
            numberOfUserShapesToSave: shapesToSave.length,
            docContentOfFirstUserShape: firstUserShapeDocContent ? `${firstUserShapeDocContent.substring(0, 50)}... (Length: ${firstUserShapeDocContent.length})` : "N/A or empty"
        }
    );

    setIsSaving(true);
    try {
      await saveShapesForNaics(currentFocus.code, shapesToSave, user.uid);
      toast({ title: "Whiteboard Saved", description: "Your collaborative ideas have been saved." });
      queryClient.invalidateQueries({ queryKey: ['whiteboardShapes', currentFocus.code, user.uid] });
    } catch (error: any) {
      console.error(`%c[Whiteboard] saveShapes: Failed to save whiteboard shapes:`, "color: red;", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: `${error.message || "Could not save whiteboard."}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const clearUserShapesForCurrentFocus = () => {
    if (!canEditWhiteboard || !currentFocus?.code) return;
    setUserShapes([]);
    setEditingShapeId(null); // Also clear editing state if shapes are cleared
    toast({ title: "Contextual Ideas Cleared Locally", description: "Click 'Save Whiteboard' to make this change permanent." });
  };

  const getShapeCenter = (shape: Shape, side: 'top' | 'bottom' | 'left' | 'right') => {
    const width = shape.width;
    const height = shape.height;
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
      console.log(`[Whiteboard] User shape clicked, setting editingShapeId to: ${shapeId}`);
      setEditingShapeId(shapeId);
    } else {
        console.log(`[Whiteboard] Fixed NAICS shape clicked, editingShapeId not set.`);
    }
  };

  const handleDocumentContentChange = (newContent: string) => {
    if (editingShapeId && user) {
        console.log(`%c[Whiteboard] handleDocumentContentChange for shape ${editingShapeId}. New content length: ${newContent.length}`, "color: sienna;");
      setUserShapes(prevUserShapes => {
        const updatedShapes = prevUserShapes.map(s =>
          s.id === editingShapeId ? { ...s, docContent: newContent, lastEditedBy: user.uid } : s
        );
        // Log to confirm the specific shape's docContent was updated in the candidate state
        const changedShape = updatedShapes.find(s => s.id === editingShapeId);
        console.log(`%c[Whiteboard] Shape ${editingShapeId} docContent in NEW state: ${changedShape?.docContent.substring(0,50)}...`, "color: sienna;");
        return updatedShapes;
      });
    }
  };

  const currentEditingShape = editingShapeId ? userShapes.find(s => s.id === editingShapeId) : null;

  console.log(`%c[Whiteboard] Render. isLoadingShapes: ${isLoadingShapes}, shapesQueryStatus: ${shapesQueryStatus}, shapesQueryError: ${!!shapesQueryError}, isSuccessShapes: ${isSuccessShapes}, isErrorShapes: ${isErrorShapes}, currentFocus: ${currentFocus?.code}, userShapes length: ${userShapes.length}`, "color: gray");
  console.log('[Whiteboard] Render - Pan:', pan, 'Scale:', scale);

  return (
    <div className="flex flex-col w-full">
      <Card className="w-full shadow-lg border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">
            {currentFocus?.name || 'Collaborative Ideas'}
            {currentFocus?.code && <span className="text-xs text-muted-foreground ml-2">({currentFocus.code})</span>}
          </CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
             <Button variant="outline" size="xs" onClick={resetView} title="Reset View">
              <Move className="h-3 w-3 mr-1" /> Reset View
            </Button>
            {canEditWhiteboard && !!currentFocus && (
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
                      onNodeClick({ code: shape.code, type: shape.nodeType as 'sector' | 'subsector' | 'industry', text: shape.text });
                    } else if (!shape.isFixed) {
                      handleUserShapeClick(shape.id);
                    }
                  }}
                  onMouseDown={(e) => { if (!shape.isFixed) e.stopPropagation(); }} 
                  onMouseEnter={() => !shape.isFixed && setHoveredUserShapeId(shape.id)}
                  onMouseLeave={() => !shape.isFixed && setHoveredUserShapeId(null)}
                  className={cn(
                    "absolute flex flex-col items-center justify-center p-1 text-center text-xs border-2 shadow-md rounded-md transition-all duration-100",
                    shape.isFixed ? "cursor-pointer" : "cursor-default",
                    shape.nodeType === 'sector' && "bg-primary text-primary-foreground font-semibold border-primary-foreground/50 shadow-xl",
                    shape.nodeType === 'subsector' && "bg-secondary text-secondary-foreground border-secondary-foreground/40 shadow-lg",
                    shape.nodeType === 'industry' && "bg-card text-card-foreground border-border shadow-md",
                    shape.nodeType === 'user' && "bg-background/90 border-primary shadow-md", 
                    shape.type === 'circle' && !shape.isFixed && "!rounded-full"
                  )}
                  style={{
                    left: `${shape.x}px`, top: `${shape.y}px`,
                    width: `${shape.width}px`,
                    minHeight: `${shape.isFixed ? NODE_HEIGHT : USER_NODE_MIN_HEIGHT}px`, 
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
            key={editingShapeId} 
            initialContent={currentEditingShape.docContent || ""}
            onContentChange={handleDocumentContentChange}
            title={`Document for: ${currentEditingShape.text || `Idea ${currentEditingShape.id.substring(0,6)}`}`}
            readOnly={!canEditWhiteboard || currentEditingShape.isFixed}
          />
        </div>
      )}
    </div>
  );
};

export default Whiteboard;

