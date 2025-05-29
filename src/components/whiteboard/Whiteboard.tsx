
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
  docContent: string;
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
const HORIZONTAL_SPACING = 100; // Space between sub-sector columns
const VERTICAL_SPACING = 120; // Sector to Sub-sectors
const VERTICAL_SPACING_INDUSTRY_START = 60; // Sub-sector to its first Industry
const VERTICAL_SPACING_INDUSTRY_ITEM = 30; // Between vertically stacked Industries
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
      const newShapeHeight = Math.max(USER_NODE_MIN_HEIGHT, newScrollHeight + 8);

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
      rows={Math.max(2, Math.min(4, Math.floor(shape.text.length / (shape.width / 7)) + 1))}
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
      if (!currentFocus?.code || !user?.uid) {
        return [];
      }
      const shapes = await getShapesForNaics(currentFocus.code);
      return Array.isArray(shapes) ? shapes : [];
    },
    enabled: !!currentFocus?.code && !!user?.uid,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (isSuccessShapes && fetchedUserShapesData) {
      setUserShapes(fetchedUserShapesData);
    } else if (isErrorShapes && shapesQueryError) {
      setUserShapes([]);
    } else if (!isLoadingShapes && !currentFocus?.code) {
      setUserShapes([]);
    }
  }, [isSuccessShapes, fetchedUserShapesData, isErrorShapes, shapesQueryError, isLoadingShapes, currentFocus?.code, setUserShapes]);

  const generateShapesAndDimensions = useCallback((sectorDataForLayout: SectorWithSubSectors | null, focusNode: FocusNodeDetails | null) => {
    const newGeneratedShapes: Shape[] = [];
    let maxContentX = 0;
    let maxContentY = 0;

    const addShape = (shape: Shape) => {
      newGeneratedShapes.push(shape);
      maxContentX = Math.max(maxContentX, shape.x + shape.width);
      maxContentY = Math.max(maxContentY, shape.y + shape.height);
    };

    if (!focusNode || !sectorDataForLayout) {
      return { newGeneratedShapes: [], finalCanvasWidth: 800, finalCanvasHeight: 600 };
    }

    let rootNodeX = CANVAS_PADDING;
    let rootNodeY = CANVAS_PADDING;
    let rootNodeData: { name: string, code: string, type: Shape['nodeType'], industries?: Industry[] } | null = null;
    let childrenNodesData: Array<{ name: string, code: string, type: Shape['nodeType'], industries?: Industry[] }> = [];

    if (focusNode.type === 'sector') {
      rootNodeData = { name: focusNode.name, code: focusNode.code, type: 'sector' };
      childrenNodesData = (sectorDataForLayout.subSectors || []).map(ss => ({ ...ss, type: 'subsector' }));
    } else if (focusNode.type === 'subsector') {
      const subSector = sectorDataForLayout.subSectors.find(ss => ss.code === focusNode.code);
      if (subSector) {
        rootNodeData = { name: focusNode.name, code: focusNode.code, type: 'subsector', industries: subSector.industries };
        childrenNodesData = (subSector.industries || []).map(ind => ({ ...ind, type: 'industry' }));
      }
    } else if (focusNode.type === 'industry') {
      rootNodeData = { name: focusNode.name, code: focusNode.code, type: 'industry' };
      // Industries don't have NAICS children in this visualization
    }

    if (!rootNodeData) return { newGeneratedShapes: [], finalCanvasWidth: 800, finalCanvasHeight: 600 };

    const rootNodeWidth = NODE_WIDTH + (rootNodeData.type === 'sector' ? 40 : rootNodeData.type === 'subsector' ? 20 : 0);
    const rootShape: Shape = {
      id: `fixed-${rootNodeData.type}-${rootNodeData.code}`, type: 'rectangle', text: `${rootNodeData.name}`,
      x: rootNodeX, y: rootNodeY, width: rootNodeWidth, height: NODE_HEIGHT, parentId: null,
      isFixed: true, nodeType: rootNodeData.type, code: rootNodeData.code, docContent: ""
    };
    addShape(rootShape);

    let currentColumnX = CANVAS_PADDING;
    let overallMaxYForChildren = rootShape.y + rootShape.height + VERTICAL_SPACING;

    if (focusNode.type === 'sector' || focusNode.type === 'subsector') { // SubSectors or Industries as children
        childrenNodesData.forEach((childData) => {
            const maxGrandChildNodeWidthInColumn = NODE_WIDTH; // Industries always take NODE_WIDTH here
            const currentChildColumnWidth = Math.max(NODE_WIDTH, maxGrandChildNodeWidthInColumn);

            const childShape: Shape = {
                id: `fixed-${childData.type}-${childData.code}`, type: 'rectangle', text: `${childData.name}`,
                x: currentColumnX + (currentChildColumnWidth / 2) - (NODE_WIDTH / 2),
                y: rootShape.y + rootShape.height + VERTICAL_SPACING,
                width: NODE_WIDTH, height: NODE_HEIGHT, parentId: rootShape.id,
                isFixed: true, nodeType: childData.type, code: childData.code, docContent: ""
            };
            addShape(childShape);
            let currentChildBranchMaxY = childShape.y + childShape.height;

            if (childData.type === 'subsector' && childData.industries) {
                let currentIndustryYOffset = VERTICAL_SPACING_INDUSTRY_START;
                childData.industries.forEach((ind) => {
                    const industryShape: Shape = {
                        id: `fixed-industry-${ind.code}-${childData.code}`, type: 'rectangle', text: `${ind.name}`,
                        x: childShape.x + (NODE_WIDTH / 2) - (NODE_WIDTH / 2),
                        y: childShape.y + NODE_HEIGHT + currentIndustryYOffset,
                        width: NODE_WIDTH, height: NODE_HEIGHT, parentId: childShape.id,
                        isFixed: true, nodeType: 'industry', code: ind.code, docContent: ""
                    };
                    addShape(industryShape);
                    currentIndustryYOffset += NODE_HEIGHT + VERTICAL_SPACING_INDUSTRY_ITEM;
                });
                currentChildBranchMaxY = Math.max(currentChildBranchMaxY, childShape.y + NODE_HEIGHT + currentIndustryYOffset - VERTICAL_SPACING_INDUSTRY_ITEM);
            }
            overallMaxYForChildren = Math.max(overallMaxYForChildren, currentChildBranchMaxY);
            currentColumnX += currentChildColumnWidth + HORIZONTAL_SPACING;
        });
    }

    maxContentX = Math.max(maxContentX, currentColumnX - HORIZONTAL_SPACING);
    maxContentY = Math.max(maxContentY, overallMaxYForChildren);

    if (childrenNodesData.length > 0 && newGeneratedShapes[0]?.id === rootShape.id) {
        const totalChildrenEffectiveWidth = currentColumnX - HORIZONTAL_SPACING - CANVAS_PADDING;
        newGeneratedShapes[0].x = CANVAS_PADDING + Math.max(0, (totalChildrenEffectiveWidth / 2) - (rootShape.width / 2));
        maxContentX = Math.max(maxContentX, newGeneratedShapes[0].x + newGeneratedShapes[0].width);
    }

    const finalCanvasWidth = Math.max(800, maxContentX + CANVAS_PADDING);
    const finalCanvasHeight = Math.max(600, maxContentY + CANVAS_PADDING);
    return { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight };
  }, [fullSectorData]); // Removed NODE_WIDTH, etc., as they are module-level constants

  const layoutAndSetInitialView = useCallback(() => {
    if (currentFocus && whiteboardViewportRef.current) {
      const { newGeneratedShapes, finalCanvasWidth, finalCanvasHeight } = generateShapesAndDimensions(fullSectorData, currentFocus);
      setFixedShapes(newGeneratedShapes);
      setCanvasDimensions({ width: finalCanvasWidth, height: finalCanvasHeight });

      const viewportWidth = whiteboardViewportRef.current.clientWidth;
      const rootNodeToCenter = newGeneratedShapes.find(s => s.code === currentFocus.code && s.nodeType === currentFocus.type) || newGeneratedShapes[0];
      const contentXToCenter = rootNodeToCenter ? rootNodeToCenter.x + rootNodeToCenter.width / 2 : finalCanvasWidth / 2;

      const newScaleVal = 1;
      setScale(newScaleVal);
      setPan({
        x: (viewportWidth / 2) - (contentXToCenter * newScaleVal),
        y: CANVAS_PADDING * newScaleVal,
      });
    } else if (!currentFocus) {
      setFixedShapes([]);
      setUserShapes([]);
      setEditingShapeId(null);
      setCanvasDimensions({ width: 800, height: 600 });
      setPan({ x: CANVAS_PADDING, y: CANVAS_PADDING });
      setScale(1);
    }
  }, [currentFocus, fullSectorData, generateShapesAndDimensions, setScale, setPan, setFixedShapes, setUserShapes, setEditingShapeId, setCanvasDimensions]);

  useEffect(() => {
    layoutAndSetInitialView();
  }, [layoutAndSetInitialView]);

  useEffect(() => {
    const currentCanvasRef = canvasRef.current;
    if (currentCanvasRef) {
      currentCanvasRef.style.width = `${canvasDimensions.width}px`;
      currentCanvasRef.style.height = `${canvasDimensions.height}px`;
    }
  }, [canvasDimensions]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target === whiteboardViewportRef.current || target === canvasRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      if (whiteboardViewportRef.current) whiteboardViewportRef.current.style.cursor = 'grabbing';
      e.preventDefault();
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
      let rootNodeToCenter = fixedShapes.find(s => s.code === currentFocus?.code && s.nodeType === currentFocus?.type) || fixedShapes[0] || userShapes[0];
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
    layoutAndSetInitialView();
  }, [layoutAndSetInitialView]);

  const canEditWhiteboard = !!user && !!currentFocus?.code;

  const addUserShape = useCallback((type: 'rectangle' | 'circle', parentShapeId: string | null = null, isSister = false) => {
    if (!canEditWhiteboard || !user || !currentFocus?.code) return;
    const newId = `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let newX = CANVAS_PADDING + 50;
    let newY = CANVAS_PADDING + 50;
    let effectiveParentId = parentShapeId;
    const allNodes = [...fixedShapes, ...userShapes];
    const defaultFixedParentForNewUserNode = fixedShapes.find(s => s.code === currentFocus?.code && s.nodeType === currentFocus?.type && s.isFixed) || fixedShapes[0];
    let parentNode = parentShapeId ? allNodes.find(s => s.id === parentShapeId) : defaultFixedParentForNewUserNode;

    if (parentNode) {
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
        newX = parentNode.x + (parentNode.width / 2) - (NODE_WIDTH / 2);
        newY = lastChild
          ? lastChild.y + lastChild.height + VERTICAL_SPACING_INDUSTRY_ITEM
          : parentNode.y + parentNode.height + VERTICAL_SPACING_INDUSTRY_START;
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
  }, [canEditWhiteboard, user, currentFocus, fixedShapes, userShapes, canvasDimensions.height, setUserShapes, setEditingShapeId]);

  const updateUserShapeText = useCallback((id: string, text: string) => {
    if (!user) return;
    setUserShapes(prev => prev.map(s => s.id === id ? { ...s, text, lastEditedBy: user.uid } : s));
  }, [user, setUserShapes]);

  const updateUserShapeHeight = useCallback((id: string, newHeight: number) => {
    setUserShapes(prev => prev.map(s => s.id === id ? { ...s, height: Math.max(USER_NODE_MIN_HEIGHT, newHeight) } : s));
  }, [setUserShapes]);

  const deleteUserShape = useCallback((idToDelete: string) => {
    setUserShapes(prev => {
      const allIdsToDelete = new Set<string>();
      const queue: string[] = [idToDelete];
      const shapeToDelete = prev.find(s => s.id === idToDelete);
      if (shapeToDelete && !shapeToDelete.isFixed) {
        allIdsToDelete.add(idToDelete);
      } else if (shapeToDelete?.isFixed) {
        toast({ variant: "destructive", title: "Cannot Delete", description: "Fixed NAICS nodes cannot be deleted." });
        return prev;
      } else return prev;
      let head = 0;
      while (head < queue.length) {
        const currentId = queue[head++];
        prev.filter(s => s.parentId === currentId && !s.isFixed).forEach(child => {
          if (!allIdsToDelete.has(child.id)) { allIdsToDelete.add(child.id); queue.push(child.id); }
        });
      }
      const newShapes = prev.filter(s => !allIdsToDelete.has(s.id));
      if (editingShapeId && allIdsToDelete.has(editingShapeId)) setEditingShapeId(null);
      return newShapes;
    });
  }, [editingShapeId, setEditingShapeId, setUserShapes, toast]);

  const handleSaveWhiteboard = useCallback(async () => {
    if (!user || !currentFocus?.code) {
      toast({ variant: "destructive", title: "Cannot Save", description: "User not logged in or no whiteboard context." });
      return;
    }
    const shapesToSave = userShapes.map(s => ({ ...s }));
    setIsSaving(true);
    try {
      await saveShapesForNaics(currentFocus.code, shapesToSave, user.uid);
      toast({ title: "Whiteboard Saved", description: "Your ideas have been saved." });
      queryClient.invalidateQueries({ queryKey: ['whiteboardShapes', currentFocus.code] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Failed", description: `${error.message || "Could not save whiteboard."}` });
    } finally {
      setIsSaving(false);
    }
  }, [user, currentFocus, userShapes, queryClient, toast, setIsSaving]);

  const clearUserShapesForCurrentFocus = useCallback(() => {
    if (!canEditWhiteboard || !currentFocus?.code) return;
    setUserShapes([]);
    setEditingShapeId(null);
    toast({ title: "Contextual Ideas Cleared Locally", description: "Click 'Save Whiteboard' to make this change permanent." });
  }, [canEditWhiteboard, currentFocus, setUserShapes, setEditingShapeId, toast]);

  const getShapeCenter = useCallback((shape: Shape, side: 'top' | 'bottom' | 'left' | 'right') => {
    const width = shape.width;
    const height = shape.height;
    switch (side) {
      case 'top': return { x: shape.x + width / 2, y: shape.y };
      case 'bottom': return { x: shape.x + width / 2, y: shape.y + height };
      case 'left': return { x: shape.x, y: shape.y + height / 2 };
      case 'right': return { x: shape.x + width, y: shape.y + height / 2 };
    }
  }, []); // Empty dependency array as it uses only shape properties and module constants

  const allDisplayableShapes = useMemo(() => {
    return [...fixedShapes, ...userShapes];
  }, [fixedShapes, userShapes]);

  const handleUserShapeClick = useCallback((shapeId: string) => {
    if (!userShapes.find(s => s.id === shapeId)?.isFixed) {
      setEditingShapeId(shapeId);
    }
  }, [userShapes, setEditingShapeId]);

  const handleDocumentContentChange = useCallback((newContent: string) => {
    if (editingShapeId && user) {
      setUserShapes(prevUserShapes =>
        prevUserShapes.map(s =>
          s.id === editingShapeId ? { ...s, docContent: newContent, lastEditedBy: user.uid } : s
        )
      );
    }
  }, [editingShapeId, user, setUserShapes]);

  const currentEditingShape = useMemo(() => editingShapeId ? userShapes.find(s => s.id === editingShapeId) : null, [editingShapeId, userShapes]);

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

      {currentEditingShape && (
        <div className="mt-6 w-full">
          <DocumentEditorPlaceholder
            key={currentEditingShape.id}
            initialContent={currentEditingShape.docContent || ""}
            onContentChange={handleDocumentContentChange}
            title={`Notes for: ${currentEditingShape.text || `Idea ${currentEditingShape.id.substring(0,6)}`}`}
            readOnly={!canEditWhiteboard || currentEditingShape.isFixed}
          />
        </div>
      )}
    </div>
  );
};

export default Whiteboard;
