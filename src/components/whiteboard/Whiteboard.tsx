
"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brush, Eraser, Palette, Square, Circle as CircleIcon } from 'lucide-react'; // Added Palette, Square, CircleIcon

const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
const brushSizes = [2, 5, 10, 15];

const Whiteboard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState(colors[0]);
  const [currentBrushSize, setCurrentBrushSize] = useState(brushSizes[1]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Adjust canvas size for HiDPI displays and ensure it fills the container
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const context = canvas.getContext('2d');
      if (context) {
        context.scale(window.devicePixelRatio, window.devicePixelRatio);
        context.lineCap = 'round';
        context.strokeStyle = currentColor;
        context.lineWidth = currentBrushSize;
        contextRef.current = context;
      }
    }
  }, []); // Empty dependency array ensures this runs once on mount

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = currentColor;
    }
  }, [currentColor]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = currentBrushSize;
    }
  }, [currentBrushSize]);

  const startDrawing = ({ nativeEvent }: React.MouseEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = nativeEvent;
    if (contextRef.current) {
      contextRef.current.beginPath();
      contextRef.current.moveTo(offsetX, offsetY);
      setIsDrawing(true);
    }
  };

  const finishDrawing = () => {
    if (contextRef.current) {
      contextRef.current.closePath();
      setIsDrawing(false);
    }
  };

  const draw = ({ nativeEvent }: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current) {
      return;
    }
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas && contextRef.current) {
      contextRef.current.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
    }
  };

  return (
    <Card className="w-full shadow-lg border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Whiteboard</CardTitle>
        <div className="flex items-center gap-2">
          {/* Color Palette */}
          <div className="flex items-center gap-1 p-1 border rounded-md bg-muted">
            {colors.map((color) => (
              <Button
                key={color}
                variant="outline"
                size="icon"
                className={`h-6 w-6 rounded-sm p-0 ${currentColor === color ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setCurrentColor(color)}
                aria-label={`Set color to ${color}`}
              />
            ))}
          </div>
          {/* Brush Size */}
           <div className="flex items-center gap-1 p-1 border rounded-md bg-muted">
            {brushSizes.map((size) => (
              <Button
                key={size}
                variant="outline"
                size="icon"
                className={`h-6 w-6 p-0 ${currentBrushSize === size ? 'ring-2 ring-primary ring-offset-1 bg-secondary' : ''}`}
                onClick={() => setCurrentBrushSize(size)}
                aria-label={`Set brush size to ${size}`}
              >
                <CircleIcon style={{ transform: `scale(${0.2 + size * 0.04})` }} className="fill-current" />
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={clearCanvas}>
            <Eraser className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={finishDrawing}
          onMouseMove={draw}
          onMouseLeave={finishDrawing} // Stop drawing if mouse leaves canvas
          className="w-full h-[400px] border rounded-md bg-white cursor-crosshair touch-none"
          // Set initial width and height for SSR, will be adjusted by useEffect
          // Using a common aspect ratio, e.g., 16:9 or 4:3 for initial sizing.
          // For a fixed height of 400px, width could be e.g., 711px (16:9)
          width={711}
          height={400}
        />
      </CardContent>
    </Card>
  );
};

export default Whiteboard;
