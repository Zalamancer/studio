
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Send, ImageUp, PlusCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const newsCategories = [
  "Collaborative Ventures",
  "Financial Insights",
  "Political & Regulatory",
  "New Opportunities",
  "Events",
  "Platform Updates",
  "Industry Analysis",
  "Case Studies",
];

const TOOLBAR_HEIGHT = 36; 
const TOOLBAR_WIDTH_WITH_OFFSET = 60; 

interface InlineToolbarProps {
  style: React.CSSProperties;
}

const InlineToolbar: React.FC<InlineToolbarProps> = ({ style }) => {
  return (
    <div
      style={style}
      className="bg-card border p-1 rounded-md shadow-lg flex items-center space-x-1"
    >
      <button
        onMouseDown={(e) => e.preventDefault()}
        className="p-1.5 hover:bg-muted rounded focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Add element"
        title="Add element"
      >
        <PlusCircle className="h-5 w-5 text-primary" />
      </button>
    </div>
  );
};

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const isMobileHook = useIsMobile();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [storyContent, setStoryContent] = useState(""); 

  const [publishAttempted, setPublishAttempted] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [storyError, setStoryError] = useState("");

  const formWrapperRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleWrapperRef = useRef<HTMLDivElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const contentEditableWrapperRef = useRef<HTMLDivElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute', zIndex: 50 });

  const getCursorPosition = useCallback((element: HTMLElement | null): number => {
    if (!element) return 0;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (element.contains(range.startContainer)) {
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        return preCaretRange.toString().length;
      }
    }
    return element.textContent?.length || 0;
  }, []);

  const updateCursorPosition = useCallback(() => {
    const newPos = getCursorPosition(contentEditableRef.current);
    setCursorPosition(newPos);
  }, [getCursorPosition, contentEditableRef]);

  const getCurrentLineText = useCallback((): string => {
    const element = contentEditableRef.current;
    if (!element) return "error_no_ref"; 

    const text = element.textContent || "";
    if (text === "") return ""; 

    const currentCursorPos = Math.min(Math.max(0, cursorPosition), text.length);

    let lineStart = 0;
    if (currentCursorPos > 0) {
        lineStart = text.lastIndexOf('\n', currentCursorPos - 1) + 1;
    }

    let lineEnd = text.indexOf('\n', currentCursorPos);
    if (lineEnd === -1) {
        lineEnd = text.length;
    }
    
    if (lineStart > lineEnd && currentCursorPos === lineStart) {
         return ""; // Cursor is at the start of a new empty line formed by Enter at end of content
    }
    if (lineStart > lineEnd) { 
        return ""; 
    }

    const lineSubstring = text.substring(lineStart, lineEnd);
    return lineSubstring.trim() === "" ? "" : lineSubstring;
  }, [contentEditableRef, cursorPosition]);

  const calculateCursorLineYOffset = useCallback((element: HTMLElement, charOffset: number): number | null => {
    const elementStyle = window.getComputedStyle(element);
    const paddingTop = parseFloat(elementStyle.paddingTop) || 0;
    const defaultLineHeight = parseFloat(elementStyle.lineHeight) || (parseFloat(elementStyle.fontSize || "20px") * 1.4) || 28;

    if (element.textContent?.trim() === "" || element.innerHTML.toLowerCase().trim() === "<br>" || element.innerHTML.trim() === "") {
        return paddingTop + (defaultLineHeight / 2);
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        if (element.textContent?.trim() === "") return paddingTop + (defaultLineHeight / 2);
        return null;
    }

    const range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer) && !(element === range.commonAncestorContainer && range.startOffset === 0 && element.childNodes.length === 0)) {
       if (element.textContent?.trim() === "" && document.activeElement === element) {
         // This is fine, proceed
       } else {
         return null; 
       }
    }
    
    const clientRects = range.getClientRects();
    if (clientRects.length > 0) {
      return clientRects[0].top - element.getBoundingClientRect().top + (clientRects[0].height / 2);
    } else {
      const textContent = element.textContent || "";
      const boundedCharOffset = Math.min(charOffset, textContent.length);
      const textBeforeCursor = textContent.substring(0, boundedCharOffset);
      const numNewlinesBefore = (textBeforeCursor.match(/\n/g) || []).length;
      return paddingTop + (numNewlinesBefore * defaultLineHeight) + (defaultLineHeight / 2);
    }
  }, []);

  const calculateAndUpdateToolbarStyle = useCallback(() => {
    requestAnimationFrame(() => {
      const formEl = formWrapperRef.current;
      const titleWrapperEl = titleWrapperRef.current;
      const contentWrapperEl = contentEditableWrapperRef.current;
      const contentEditableEl = contentEditableRef.current;

      let showToolbar = false;
      let top = 0;
      let left = 0;
      let newToolbarStyle: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 50 };

      if (!formEl) {
        setToolbarStyle(newToolbarStyle);
        return;
      }
      const formRect = formEl.getBoundingClientRect();

      if (focusedField === 'title' && titleWrapperEl) {
        if (title.trim() === '') {
          showToolbar = true;
          const titleRect = titleWrapperEl.getBoundingClientRect();
          top = titleRect.top - formRect.top + (titleRect.height / 2) - (TOOLBAR_HEIGHT / 2);
          left = titleRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET;
        }
      } else if (focusedField === 'content' && contentWrapperEl && contentEditableEl) {
        const currentLineIsEmptyForToolbar = getCurrentLineText() === "";
        // console.log(`[ToolbarDebug] Content Focused. currentLineIsEmptyForToolbar: ${currentLineIsEmptyForToolbar}, cursorPos: ${cursorPosition}, textContent: "${contentEditableEl.textContent?.substring(0,50)}..."`);
        
        if (currentLineIsEmptyForToolbar) {
          const lineYOffset = calculateCursorLineYOffset(contentEditableEl, cursorPosition);
          // console.log(`[ToolbarDebug] Content Line Empty. lineYOffset: ${lineYOffset}`);
          if (lineYOffset !== null) {
            showToolbar = true;
            const contentWrapperRect = contentWrapperEl.getBoundingClientRect();
            top = (contentWrapperRect.top - formRect.top) + lineYOffset - (TOOLBAR_HEIGHT / 2);
            left = contentWrapperRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET;
            // console.log(`[ToolbarDebug] SHOWING TOOLBAR for content. Top: ${top}, Left: ${left}`);
          } else {
            // console.log(`[ToolbarDebug] lineYOffset is NULL, hiding toolbar for content.`);
            showToolbar = false; 
          }
        } else {
            // console.log(`[ToolbarDebug] Content Line NOT Empty according to getCurrentLineText(), hiding toolbar.`);
            showToolbar = false;
        }
      } else {
          // console.log(`[ToolbarDebug] Toolbar hidden. focusedField: ${focusedField}`);
          showToolbar = false;
      }

      if (showToolbar) {
        newToolbarStyle.display = 'flex';
        newToolbarStyle.top = `${Math.max(0, top)}px`; 
        newToolbarStyle.left = `${Math.max(0, left)}px`;
      }
      setToolbarStyle(newToolbarStyle);
    });
  }, [focusedField, title, storyContent, cursorPosition, getCurrentLineText, calculateCursorLineYOffset]);

  useEffect(() => {
    calculateAndUpdateToolbarStyle();
  }, [focusedField, title, storyContent, cursorPosition, calculateAndUpdateToolbarStyle]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (focusedField === 'content' && document.activeElement === contentEditableRef.current) {
        updateCursorPosition();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [focusedField, updateCursorPosition]);

  const handleFocus = useCallback((field: 'title' | 'content') => {
    setFocusedField(field);
    if (field === 'content') {
      setTimeout(updateCursorPosition, 0);
    }
  }, [updateCursorPosition]);

  const handleBlur = useCallback(() => {
    queueMicrotask(() => {
      if (
        toolbarRef.current && toolbarRef.current.contains(document.activeElement) ||
        (contentEditableRef.current && contentEditableRef.current === document.activeElement) ||
        (titleInputRef.current && titleInputRef.current === document.activeElement)
      ) {
        return;
      }
      setFocusedField(null);
    });
  }, [toolbarRef, contentEditableRef, titleInputRef]);

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) {
      setTitleError("Title is required.");
      isValid = false;
    } else {
      setTitleError("");
    }
    if (!category) {
      setCategoryError("Category is required.");
      isValid = false;
    } else {
      setCategoryError("");
    }
    
    const currentStoryText = contentEditableRef.current?.textContent?.trim() || "";
    const hasMeaningfulContent = currentStoryText !== '' || /<img|<div|<p/.test(storyContent);

    if (!hasMeaningfulContent) {
      setStoryError("Story content is required.");
      isValid = false;
    } else {
      setStoryError("");
    }
    return isValid;
  }, [title, category, storyContent]);

  const handlePublish = () => {
    setPublishAttempted(true);
    if (!validateFields()) {
      if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
      else if (!category) { /* Error shown */ }
      else if (contentEditableRef.current && storyError && (contentEditableRef.current.textContent || "").trim() === '') contentEditableRef.current.focus();
      return;
    }
    console.log("Publishing Article:", { title: title.trim(), category, storyContent });
    toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" published.` });
    setTitle(""); setCategory(""); setStoryContent("");
    if (contentEditableRef.current) contentEditableRef.current.innerHTML = "";
    setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
  };

  const handleContentEditableInput = useCallback((event: React.FormEvent<HTMLDivElement>) => {
    const currentHTML = event.currentTarget.innerHTML;
    setStoryContent(currentHTML);
    updateCursorPosition();

    if (publishAttempted) {
      const currentText = event.currentTarget.textContent?.trim() || "";
      const hasMeaningfulContent = currentText !== '' || /<img|<div|<p/.test(currentHTML);
      if (hasMeaningfulContent) {
        setStoryError("");
      } else {
        setStoryError("Story content is required.");
      }
    }
  }, [publishAttempted, updateCursorPosition, setStoryContent, setStoryError]);

  useEffect(() => {
    const div = contentEditableRef.current;
    if (div) {
      if (div.innerHTML !== storyContent) {
        div.innerHTML = storyContent;
      }
      // Auto-height for contentEditable div is implicitly handled by browser as long as it's not constrained by CSS.
      // Ensure it does not have fixed height or `overflow: hidden/scroll` that would prevent natural expansion.
    }
  }, [storyContent]);

  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div ref={formWrapperRef} className="max-w-3xl mx-auto space-y-0 relative">
        <div ref={toolbarRef}>
          <InlineToolbar style={toolbarStyle} />
        </div>
        
        <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
          <div className="flex items-center gap-2 mr-auto">
            <div className="space-y-1">
              <Select
                onValueChange={(value) => {
                  setCategory(value);
                  if (publishAttempted) {
                    if (value) setCategoryError("");
                    else setCategoryError("Category is required.");
                  }
                }}
                value={category}
              >
                <SelectTrigger className="text-xs py-1.5 h-9 w-auto min-w-[140px] sm:w-[160px] focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {newsCategories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-sm">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {publishAttempted && categoryError && <p className="text-xs text-destructive mt-1">{categoryError}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => coverImageInputRef.current?.click()} className="text-xs py-1.5 h-9">
              <ImageUp className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cover Image</span>
              <span className="sm:hidden">Image</span>
            </Button>
            <Input id="article-image-input-header" type="file" accept="image/*" className="hidden" ref={coverImageInputRef} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked")} className="text-xs py-1.5 h-9 rounded-full">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
            </Button>
            <Button type="button" onClick={handlePublish} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full">
              <Send className="mr-1.5 h-3.5 w-3.5" /> Publish
            </Button>
          </div>
        </div>

        <div ref={titleWrapperRef} className="relative mb-4">
          <Input
            ref={titleInputRef}
            placeholder="Title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (publishAttempted) {
                if (e.target.value.trim()) setTitleError("");
                else setTitleError("Title is required.");
              }
            }}
            onFocus={() => handleFocus('title')}
            onBlur={handleBlur}
            className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"
            autoComplete="off"
          />
          {publishAttempted && titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
        </div>
        
        <div ref={contentEditableWrapperRef} className="relative">
          <div
            ref={contentEditableRef}
            contentEditable={true}
            onInput={handleContentEditableInput}
            onFocus={() => handleFocus('content')}
            onBlur={handleBlur}
            onKeyUp={updateCursorPosition}
            onClick={updateCursorPosition}
            data-placeholder="Tell your story..."
            className={cn(
              "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case min-h-0",
              // Removed overflow-y-hidden. ContentEditable divs generally handle their own overflow or expand naturally.
              "focus:outline-none",
            )}
            style={{
              fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
              fontSize: "20px",
              lineHeight: "28px",
              color: "hsl(var(--foreground))",
              minHeight: "100px", // Provide a sensible minimum height for empty state
            }}
            role="textbox"
            aria-multiline="true"
            aria-label="News article content"
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none;
            display: block;
            position: absolute;
            top: 0.5rem; 
            left: 0;
          }
          div[contentEditable="true"][data-placeholder]:not(:empty):before {
            display: none;
          }
        `}</style>
      </div>
    </div>
  );
};

export default CreateNewsArticlePage;
