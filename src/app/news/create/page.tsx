
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
import { useIsMobile } from '@/hooks/use-mobile'; // Corrected import path

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

const TOOLBAR_HEIGHT = 36; // Approximate height of the toolbar
const TOOLBAR_WIDTH_WITH_OFFSET = 60; // Width of toolbar + some offset from the text field

interface InlineToolbarProps {
  style: React.CSSProperties;
  // Add any actions the toolbar buttons should perform later
}

const InlineToolbar: React.FC<InlineToolbarProps> = ({ style }) => {
  return (
    <div
      style={style}
      className="bg-card border p-1 rounded-md shadow-lg flex items-center space-x-1" // Added flex, items-center, space-x-1
    >
      <button
        onMouseDown={(e) => e.preventDefault()} // Prevents focus stealing
        className="p-1.5 hover:bg-muted rounded focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Add element"
        title="Add element"
      >
        <PlusCircle className="h-5 w-5 text-primary" />
      </button>
      {/* Add other toolbar buttons here later, e.g., for headings, bold, image upload */}
    </div>
  );
};


const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const isMobileHook = useIsMobile(); // Renamed to avoid conflict if 'isMobile' is used elsewhere

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [storyContent, setStoryContent] = useState(""); // HTML content for the div

  const [publishAttempted, setPublishAttempted] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [storyError, setStoryError] = useState("");

  const formWrapperRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleWrapperRef = useRef<HTMLDivElement>(null); // To get title input's relative position
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const contentEditableWrapperRef = useRef<HTMLDivElement>(null); // To get content div's relative position
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null); // Ref for the toolbar itself

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0); // For contentEditable div
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
    if (!element) return "_REF_NULL_";

    const text = element.textContent;
    if (text === null || text === undefined) return "_TEXT_NULL_";
    if (text.trim() === "") return ""; // Handle completely empty or whitespace-only div

    // Ensure cursorPosition is within bounds of text.length
    const currentCursorPos = Math.min(Math.max(0, cursorPosition), text.length);
    
    let lineStart = text.lastIndexOf('\n', currentCursorPos - 1);
    lineStart = (lineStart === -1) ? 0 : lineStart + 1;

    let lineEnd = text.indexOf('\n', currentCursorPos);
    lineEnd = (lineEnd === -1) ? text.length : lineEnd;
    
    // Safeguard: if cursor is on an empty line created by Enter, lineStart might be > lineEnd or equal if at end.
    if (lineStart > lineEnd && currentCursorPos === lineStart && currentCursorPos > 0 && text[currentCursorPos-1] === '\n') {
       return "";
    }
     if (lineStart > lineEnd) { // Should not happen often, but as a fallback
        lineStart = lineEnd;
    }

    return text.substring(lineStart, lineEnd).trim();
  }, [cursorPosition, contentEditableRef]);


  const calculateCursorLineYOffset = useCallback((element: HTMLElement, charOffset: number): number | null => {
    const elementStyle = window.getComputedStyle(element);
    const paddingTop = parseFloat(elementStyle.paddingTop) || 0;
    const defaultLineHeight = parseFloat(elementStyle.lineHeight) || (parseFloat(elementStyle.fontSize || "20px") * 1.4) || 28;

    // Handle completely empty or just <br> contentEditable
    if (element.textContent?.trim() === "" || element.innerHTML.toLowerCase().trim() === "<br>" || element.innerHTML.trim() === "") {
        return paddingTop + (defaultLineHeight / 2);
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        if (element.textContent?.trim() === "") return paddingTop + (defaultLineHeight / 2); // Focused but not clicked
        return null;
    }

    const range = selection.getRangeAt(0);
    // If the cursor/range is not actually within the element, return null
    if (!element.contains(range.commonAncestorContainer) && !(element === range.commonAncestorContainer && range.startOffset === 0 && element.childNodes.length === 0) ) {
       // console.log("[ToolbarDebug] Cursor/Range not in element. commonAncestorContainer:", range.commonAncestorContainer, "element:", element);
       // If element itself is empty and focused, it's okay
       if (element.textContent?.trim() === "" && document.activeElement === element) {
         // This is fine, proceed to clientRects or fallback
       } else {
         return null; 
       }
    }
    
    const clientRects = range.getClientRects();
    if (clientRects.length > 0) {
      return clientRects[0].top - element.getBoundingClientRect().top + (clientRects[0].height / 2);
    } else {
      // Fallback if no client rects (e.g., cursor on an empty line within content, or end of text)
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
        const currentLine = getCurrentLineText();
        // console.log(`[ToolbarDebug] Content Focused. CurrentLine Text: "${currentLine}" (Length: ${currentLine.length})`);
        if (currentLine === "") {
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
            // console.log(`[ToolbarDebug] Content Line NOT Empty ("${currentLine}"), hiding toolbar.`);
        }
      } else {
          // console.log(`[ToolbarDebug] Toolbar hidden. focusedField: ${focusedField}`);
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
      setTimeout(updateCursorPosition, 0); // Ensure cursor position is updated on focus
    }
  }, [updateCursorPosition]);

  const handleBlur = useCallback(() => {
    // Use a microtask or timeout to allow click on toolbar to register before hiding it
    queueMicrotask(() => {
      // Check if the new activeElement is part of the toolbar
      if (
        toolbarRef.current && toolbarRef.current.contains(document.activeElement) ||
        contentEditableRef.current && contentEditableRef.current === document.activeElement ||
        titleInputRef.current && titleInputRef.current === document.activeElement
      ) {
        // Focus is still within an editable field or the toolbar, so don't hide
        return;
      }
      // console.log("[ToolbarDebug] Blurring, hiding toolbar.");
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
    const hasMeaningfulContent = currentStoryText !== '' || /<img|<div|<p/.test(storyContent); // Keep img/div/p check for potential future non-text elements

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
      else if (!category) { /* No easy way to focus Select, error message should be enough */ }
      else if (contentEditableRef.current && storyError && (contentEditableRef.current.textContent || "").trim() === '') contentEditableRef.current.focus();
      return;
    }
    console.log("Publishing Article:", { title: title.trim(), category, storyContent });
    toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" published.` });
    // Reset fields
    setTitle(""); setCategory(""); setStoryContent("");
    if (contentEditableRef.current) contentEditableRef.current.innerHTML = ""; // Clear contentEditable div
    setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
  };

  const handleContentEditableInput = useCallback((event: React.FormEvent<HTMLDivElement>) => {
    const currentHTML = event.currentTarget.innerHTML;
    setStoryContent(currentHTML);
    updateCursorPosition(); // Update cursor position on every input

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

  // Effect to manage contentEditable div innerHTML and auto-height
  useEffect(() => {
    const div = contentEditableRef.current;
    if (div) {
      // Sync div content if storyContent state changes externally (e.g., on reset)
      if (div.innerHTML !== storyContent) {
        div.innerHTML = storyContent;
      }
      // Auto-height adjustment
      div.style.height = 'auto'; // Reset height to get correct scrollHeight
      div.style.height = `${div.scrollHeight}px`;
    }
  }, [storyContent]); // Run when storyContent changes

  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div ref={formWrapperRef} className="max-w-3xl mx-auto space-y-0 relative"> {/* Removed space-y-6 from here */}
        {/* Toolbar Component */}
        <div ref={toolbarRef}>
          <InlineToolbar style={toolbarStyle} />
        </div>
        
        {/* Header Controls: Category, Image, Save/Publish */}
        <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap"> {/* Moved this block up */}
          <div className="flex items-center gap-2 mr-auto"> {/* Group category and image, push to left */}
            <div className="space-y-1">
              <Select
                onValueChange={(value) => {
                  setCategory(value);
                  if (publishAttempted) { // Validate on change if publish was attempted
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

          <div className="flex items-center gap-2"> {/* Save/Publish buttons */}
            <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked")} className="text-xs py-1.5 h-9 rounded-full">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
            </Button>
            <Button type="button" onClick={handlePublish} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full">
              <Send className="mr-1.5 h-3.5 w-3.5" /> Publish
            </Button>
          </div>
        </div>

        {/* Title Input */}
        <div ref={titleWrapperRef} className="relative mb-4">
          <Input
            ref={titleInputRef}
            placeholder="Title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (publishAttempted) { // Validate on change if publish was attempted
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
        
        {/* ContentEditable Div for Story */}
        <div ref={contentEditableWrapperRef} className="relative">
          <div
            ref={contentEditableRef}
            contentEditable={true}
            onInput={handleContentEditableInput}
            onFocus={() => handleFocus('content')}
            onBlur={handleBlur}
            onKeyUp={updateCursorPosition} // Update cursor on key up for selection changes
            onClick={updateCursorPosition}  // Update cursor on click
            data-placeholder="Tell your story..." // For CSS placeholder
            className={cn(
              "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case min-h-0",
              // Removed overflow-y-hidden to let scrollHeight work correctly, height is auto-adjusted
              "focus:outline-none", // Ensure no default browser outline
            )}
            style={{
              fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
              fontSize: "20px",
              lineHeight: "28px",
              color: "hsl(var(--foreground))", // Use theme color
            }}
            role="textbox"
            aria-multiline="true"
            aria-label="News article content"
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        
        {/* CSS for the placeholder */}
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5); /* Theme-aware placeholder color */
            pointer-events: none; /* Allow clicking through placeholder */
            display: block; /* Important for placeholder to show */
            position: absolute; /* Position relative to the contentEditable div */
            top: 0.5rem; /* Matches py-2 padding of the div */
            left: 0; /* Matches px-0 padding */
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

    
