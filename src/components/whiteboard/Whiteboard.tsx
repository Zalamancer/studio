
"use client";

import React, { useState, useRef, MouseEvent as ReactMouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Square, Circle as CircleIcon, Trash2, Eraser, CornerDownRight, Users, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Shape {
  id: string;
  type: 'rectangle' | 'circle';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null; // ID of the parent node, null for root nodes
}

const Whiteboard: React.FC = () => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [nextRootShapeY, setNextRootShapeY] = useState(20);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const whiteboardRef = useRef<HTMLDivElement>(null);

  const addShape = (type: 'rectangle' | 'circle', parentId: string | null = null, siblingOfId?: string) => {
    let newX = 20;
    let newY = nextRootShapeY;

    if (parentId) {
      const parentShape = shapes.find(s => s.id === parentId);
      if (parentShape) {
        newX = parentShape.x;
        newY = parentShape.y + parentShape.height + 40; // Position below parent
      }
    } else if (siblingOfId) {
      const siblingShape = shapes.find(s => s.id === siblingOfId);
      if (siblingShape) {
        newX = siblingShape.x + siblingShape.width + 20; // Position to the right of sibling
        newY = siblingShape.y;
        if (newX + 150 > (whiteboardRef.current?.offsetWidth || 600) - 20) { // Basic wrapping
            newX = 20;
            newY = siblingShape.y + siblingShape.height + 40;
        }
      }
    } else {
      // Root node positioning
      if (shapes.filter(s => !s.parentId).length > 0) {
          const lastRoot = shapes.filter(s => !s.parentId).reduce((prev, curr) => (prev.y > curr.y ? prev : curr));
          newX = 20; // Reset X for new root row
          newY = lastRoot.y + lastRoot.height + 40;

          const potentialRightMostX = shapes.filter(s => !s.parentId && s.y === lastRoot.y)
                                      .reduce((maxX, s) => Math.max(maxX, s.x + s.width), 0);
          if (potentialRightMostX + 20 + 150 < (whiteboardRef.current?.offsetWidth || 600) -20){
            newX = potentialRightMostX + 20;
            newY = lastRoot.y;
          }
      }
      setNextRootShapeY(newY + 120);
    }
     // Ensure new shapes don't overflow initial Y too much if many children/sisters are added
     if (newY > (whiteboardRef.current?.offsetHeight || 400) - 120) {
        newY = (whiteboardRef.current?.offsetHeight || 400) - 120;
     }
     if (newX > (whiteboardRef.current?.offsetWidth || 600) - 170) {
        newX = (whiteboardRef.current?.offsetWidth || 600) - 170;
     }


    const newShape: Shape = {
      id: Date.now().toString(),
      type,
      text: '',
      x: Math.max(10, newX), // Ensure minimum x
      y: Math.max(10, newY), // Ensure minimum y
      width: type === 'rectangle' ? 150 : 100,
      height: 100,
      parentId,
    };
    setShapes((prevShapes) => [...prevShapes, newShape]);
  };

  const handleAddChild = (parentId: string, parentType: 'rectangle' | 'circle') => {
    addShape(parentType === 'rectangle' ? 'rectangle' : 'circle', parentId);
  };

  const handleAddSister = (siblingId: string) => {
    const siblingShape = shapes.find(s => s.id === siblingId);
    if (siblingShape) {
      addShape(siblingShape.type, siblingShape.parentId, siblingId);
    }
  };

  const updateShapeText = (id: string, newText: string) => {
    setShapes((prevShapes) =>
      prevShapes.map((shape) =>
        shape.id === id ? { ...shape, text: newText } : shape
      )
    );
  };

  const deleteShapeAndChildren = (id: string) => {
    setShapes((prevShapes) => {
      const shapesToDelete = new Set<string>();
      const findChildrenRecursive = (currentId: string) => {
        shapesToDelete.add(currentId);
        prevShapes.filter(s => s.parentId === currentId).forEach(child => findChildrenRecursive(child.id));
      };
      findChildrenRecursive(id);
      return prevShapes.filter((shape) => !shapesToDelete.has(shape.id));
    });
  };

  const clearAllShapes = () => {
    setShapes([]);
    setNextRootShapeY(20);
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
        <CardTitle className="text-lg font-medium">Tree Whiteboard</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => addShape('rectangle')}>
            <Square className="h-4 w-4 mr-1" /> Add Root Rectangle
          </Button>
          <Button variant="outline" size="sm" onClick={() => addShape('circle')}>
            <CircleIcon className="h-4 w-4 mr-1" /> Add Root Circle
          </Button>
          <Button variant="outline" size="sm" onClick={clearAllShapes} className="text-destructive hover:text-destructive">
            <Eraser className="h-4 w-4 mr-1" /> Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div
          ref={whiteboardRef}
          className="relative w-full h-[500px] border rounded-md bg-white overflow-auto"
          style={{ minHeight: '500px' }}
        >
          <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            {shapes.map(shape => {
              if (shape.parentId) {
                const parentShape = shapes.find(s => s.id === shape.parentId);
                if (parentShape) {
                  const parentPoint = getShapeCenter(parentShape, 'bottom');
                  const childPoint = getShapeCenter(shape, 'top');
                  return (
                    <line
                      key={`line-${shape.id}`}
                      x1={parentPoint.x}
                      y1={parentPoint.y}
                      x2={childPoint.x}
                      y2={childPoint.y}
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
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
              className={cn(
                "absolute flex flex-col p-2 border-2 border-primary shadow-md bg-background/90 cursor-grab", // Added cursor-grab
                shape.type === 'rectangle' ? 'rounded-md' : 'rounded-full'
              )}
              style={{
                left: `${shape.x}px`,
                top: `${shape.y}px`,
                width: `${shape.width}px`,
                height: `${shape.height}px`,
                zIndex: 10 // Ensure shapes are above lines
              }}
              onMouseEnter={() => setHoveredShapeId(shape.id)}
              onMouseLeave={() => setHoveredShapeId(null)}
            >
              <Textarea
                value={shape.text}
                onChange={(e) => updateShapeText(shape.id, e.target.value)}
                placeholder={shape.type === 'rectangle' ? 'Type...' : 'Type...'}
                className="w-full h-full resize-none bg-transparent border-none focus:ring-0 text-sm p-1 text-center flex items-center justify-center"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-3 -right-3 h-6 w-6 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-full p-1 opacity-50 hover:opacity-100 transition-opacity"
                onClick={() => deleteShapeAndChildren(shape.id)}
                aria-label="Delete shape and children"
              >
                <Trash2 className="h-3 w-3" />
              </Button>

              {hoveredShapeId === shape.id && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1 p-0.5 bg-background border rounded-md shadow-lg" style={{ zIndex: 20 }}>
                  <Button
                    variant="outline"
                    size="xs"
                    className="p-1 h-auto"
                    onClick={() => handleAddChild(shape.id, shape.type)}
                    title="Add Child"
                  >
                    <CornerDownRight className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    className="p-1 h-auto"
                    onClick={() => handleAddSister(shape.id)}
                    title="Add Sister"
                  >
                    <Users className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default Whiteboard;

    