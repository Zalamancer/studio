
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea'; // For text input within shapes
import { Square, Circle as CircleIcon, Trash2, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Shape {
  id: string;
  type: 'rectangle' | 'circle';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const Whiteboard: React.FC = () => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [nextShapeY, setNextShapeY] = useState(10); // For simple stacking of new shapes

  const addShape = (type: 'rectangle' | 'circle') => {
    const newShape: Shape = {
      id: Date.now().toString(), // Simple unique ID
      type,
      text: '',
      x: 10, // Default X position
      y: nextShapeY, // Stack new shapes vertically
      width: type === 'rectangle' ? 150 : 100,
      height: 100,
    };
    setShapes((prevShapes) => [...prevShapes, newShape]);
    setNextShapeY((prevY) => prevY + 120); // Increment Y for next shape, adjust as needed
     if (nextShapeY > 300) { // Reset Y if it gets too low, basic wrapping
        setNextShapeY(10);
    }
  };

  const updateShapeText = (id: string, newText: string) => {
    setShapes((prevShapes) =>
      prevShapes.map((shape) =>
        shape.id === id ? { ...shape, text: newText } : shape
      )
    );
  };

  const deleteShape = (id: string) => {
    setShapes((prevShapes) => prevShapes.filter((shape) => shape.id !== id));
  };

  const clearAllShapes = () => {
    setShapes([]);
    setNextShapeY(10); // Reset stacking position
  };

  return (
    <Card className="w-full shadow-lg border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Whiteboard</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => addShape('rectangle')}>
            <Square className="h-4 w-4 mr-1" /> Add Rectangle
          </Button>
          <Button variant="outline" size="sm" onClick={() => addShape('circle')}>
            <CircleIcon className="h-4 w-4 mr-1" /> Add Circle
          </Button>
          <Button variant="outline" size="sm" onClick={clearAllShapes} className="text-destructive hover:text-destructive">
            <Eraser className="h-4 w-4 mr-1" /> Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div
          className="relative w-full h-[400px] border rounded-md bg-white overflow-auto" // Changed to a div container
          style={{ minHeight: '400px' }} // Ensure it has a minimum height
        >
          {shapes.map((shape) => (
            <div
              key={shape.id}
              className={cn(
                "absolute flex flex-col p-2 border-2 border-primary shadow-md bg-background/80 group",
                shape.type === 'rectangle' ? 'rounded-md' : 'rounded-full'
              )}
              style={{
                left: `${shape.x}px`,
                top: `${shape.y}px`,
                width: `${shape.width}px`,
                height: `${shape.height}px`,
              }}
            >
              <Textarea
                value={shape.text}
                onChange={(e) => updateShapeText(shape.id, e.target.value)}
                placeholder={shape.type === 'rectangle' ? 'Type in rectangle...' : 'Type in circle...'}
                className="w-full h-full resize-none bg-transparent border-none focus:ring-0 text-sm p-1"
                // Ensure text area fills the shape and has no extra styling interfering
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded-full p-1"
                onClick={() => deleteShape(shape.id)}
                aria-label="Delete shape"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default Whiteboard;

