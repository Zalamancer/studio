
// src/components/document-editor/DocumentEditor.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bold, Italic, Underline, List, ListOrdered, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface DocumentEditorProps {
  initialContent: string;
  onContentChange: (content: string) => void;
  readOnly?: boolean;
  title?: string;
}

const DocumentEditorPlaceholder: React.FC<DocumentEditorProps> = ({
  initialContent,
  onContentChange,
  readOnly = false,
  title = "Collaborative Document"
}) => {
  const [editorContent, setEditorContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [listCounter, setListCounter] = useState(1); // For numbered list simulation

  // Sync internal state if initialContent prop changes (e.g., user selects a different shape)
  useEffect(() => {
    setEditorContent(initialContent);
  }, [initialContent]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorContent(e.target.value);
    onContentChange(e.target.value);
  };

  const handleInsertListMarker = (type: 'bullet' | 'number') => {
    if (readOnly || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;

    // Find the beginning of the current line
    let lineStartIndex = start;
    while (lineStartIndex > 0 && currentValue[lineStartIndex - 1] !== '\n') {
      lineStartIndex--;
    }

    const marker = type === 'bullet' ? "• " : `${listCounter}. `;
    if (type === 'number') setListCounter(prev => prev + 1);


    const textBeforeLine = currentValue.substring(0, lineStartIndex);
    const currentLine = currentValue.substring(lineStartIndex, currentValue.indexOf('\n', lineStartIndex) === -1 ? currentValue.length : currentValue.indexOf('\n', lineStartIndex));
    const textAfterLine = currentValue.substring(currentValue.indexOf('\n', lineStartIndex) === -1 ? currentValue.length : currentValue.indexOf('\n', lineStartIndex));
    
    let newText;
    // Basic toggle: if line already starts with a similar marker, remove it.
    // This is very rudimentary.
    if (currentLine.trim().startsWith("• ") || /^\d+\.\s/.test(currentLine.trim())) {
        const existingMarkerMatch = currentLine.match(/^(\s*(?:• |\d+\.\s))/);
        if (existingMarkerMatch) {
            newText = textBeforeLine + currentLine.substring(existingMarkerMatch[0].length) + textAfterLine;
             if (type === 'number' && /^\d+\.\s/.test(currentLine.trim())) setListCounter(1); // Reset counter if removing numbered list
        } else {
            newText = textBeforeLine + marker + currentLine + textAfterLine;
        }
    } else {
        newText = textBeforeLine + marker + currentLine + textAfterLine;
    }
    
    setEditorContent(newText);
    onContentChange(newText);

    // Try to set cursor after the marker
    // This is tricky and might not be perfect
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStartIndex + marker.length, lineStartIndex + marker.length);
    }, 0);
  };


  return (
    <Card className="w-full shadow-lg border-border">
      <CardHeader className="border-b">
        <CardTitle className="text-lg font-semibold text-foreground truncate">
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Basic text editor. Document content is saved with the whiteboard.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mock Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b bg-muted/50 sticky top-0 z-10">
          <Button variant="ghost" size="icon" title="Bold (Placeholder)" disabled>
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Italic (Placeholder)" disabled>
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Underline (Placeholder)" disabled>
            <Underline className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
           <Button variant="ghost" size="icon" title="Bulleted List" onClick={() => handleInsertListMarker('bullet')} disabled={readOnly}>
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Numbered List" onClick={() => handleInsertListMarker('number')} disabled={readOnly}>
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        {/* Text Area for Editing */}
        <div className="p-4">
          <Textarea
            ref={textareaRef}
            value={editorContent}
            onChange={handleTextChange}
            placeholder="Start typing your document here..."
            className="w-full min-h-[300px] p-3 border-0 focus:ring-0 focus-visible:ring-0 shadow-none rounded-none resize-y text-base leading-relaxed"
            aria-label="Document content editor"
            readOnly={readOnly}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentEditorPlaceholder;
    