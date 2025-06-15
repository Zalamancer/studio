
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
const TOOLBAR_WIDTH_WITH_OFFSET = 60; // Approx width of toolbar + offset

interface InlineToolbarProps {
  style: React.CSSProperties;
  // Add action handlers as props later
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
  const isMobile = useIsMobile();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [storyContent, setStoryContent] = useState(""); // HTML content

  const [isSubmitting, setIsSubmitting] = useState(false);
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
    if (!element || !element.textContent) return "non-empty"; // Default to non-empty if ref isn't ready or no text

    const text = element.textContent;
    if (text.length === 0) {
      console.log("[Toolbar Debug] getCurrentLineText: Entire content is empty.");
      return "";
    }

    const currentCursorPos = Math.min(Math.max(0, cursorPosition), text.length);
    let lineStart = text.lastIndexOf('\n', currentCursorPos - 1) + 1;
    let lineEnd = text.indexOf('\n', currentCursorPos);
    if (lineEnd === -1) lineEnd = text.length;
    if (lineStart > lineEnd) lineStart = lineEnd; // Handle cursor on newline or end

    const currentLine = text.substring(lineStart, lineEnd);
    console.log(`[Toolbar Debug] getCurrentLineText: Line ("${currentLine.replace(/\n/g, "\\n")}") | Trimmed: ("${currentLine.trim()}"). Cursor: ${currentCursorPos}, Start: ${lineStart}, End: ${lineEnd}`);
    return currentLine.trim();
  }, [cursorPosition, contentEditableRef]);


  const calculateCursorLineYOffset = useCallback((element: HTMLElement, charOffset: number): number | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!element.contains(range.focusNode) && !(element === range.focusNode && range.focusOffset === 0 && element.childNodes.length === 0)) {
      // If focusNode is not within element, or if element is empty and focus is at offset 0,
      // this range might not be relevant to the element's content lines.
      // However, for an empty contentEditable, we might still want to position based on its top.
      if (element.innerHTML.trim() === "" || element.innerHTML.trim().toLowerCase() === "<br>") {
        const elementStyle = window.getComputedStyle(element);
        const paddingTop = parseFloat(elementStyle.paddingTop) || 0;
        const lineHeight = parseFloat(elementStyle.lineHeight) || (parseFloat(elementStyle.fontSize) * 1.4) || 28;
        return paddingTop + (lineHeight / 2);
      }
      return null;
    }
    
    const clientRects = range.getClientRects();
    if (clientRects.length > 0) {
      return clientRects[0].top - element.getBoundingClientRect().top + (clientRects[0].height / 2);
    } else {
      // Fallback for when getClientRects() returns nothing (e.g., line is truly empty)
      const elementStyle = window.getComputedStyle(element);
      const paddingTop = parseFloat(elementStyle.paddingTop) || 0;
      const lineHeight = parseFloat(elementStyle.lineHeight) || (parseFloat(elementStyle.fontSize) * 1.4) || 28;
      if (element.innerHTML.trim() === "" || element.innerHTML.trim().toLowerCase() === "<br>" || element.innerHTML.trim().toLowerCase() === "<p><br></p>") {
        return paddingTop + (lineHeight / 2);
      }
      // If it's an internal empty line and getClientRects fails, we have a problem.
      // Try to estimate based on the number of preceding newlines.
      // This is a simplified estimation.
      const textBeforeCursor = (element.textContent || "").substring(0, charOffset);
      const numNewlinesBefore = (textBeforeCursor.match(/\n/g) || []).length;
      return paddingTop + (numNewlinesBefore * lineHeight) + (lineHeight / 2);
    }
  }, []);


  const calculateAndUpdateToolbarStyle = useCallback(() => {
    requestAnimationFrame(() => {
      let newToolbarStyle: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 50 };
      const formEl = formWrapperRef.current;
      const titleWrapperEl = titleWrapperRef.current;
      const titleInputEl = titleInputRef.current;
      const contentWrapperEl = contentEditableWrapperRef.current;
      const contentEditableEl = contentEditableRef.current;

      if (!formEl) {
        setToolbarStyle(newToolbarStyle);
        return;
      }
      const formRect = formEl.getBoundingClientRect();

      if (focusedField === 'title' && titleWrapperEl && titleInputEl) {
        if (title.trim() === '') {
          const titleRect = titleWrapperEl.getBoundingClientRect();
          newToolbarStyle.top = `${titleRect.top - formRect.top + (titleRect.height / 2) - (TOOLBAR_HEIGHT / 2)}px`;
          newToolbarStyle.left = `${titleRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET}px`;
          newToolbarStyle.display = 'flex';
        } else {
          newToolbarStyle.display = 'none';
        }
      } else if (focusedField === 'content' && contentWrapperEl && contentEditableEl) {
        const currentLineText = getCurrentLineText();
        console.log(`[Toolbar Logic] Field: content, Current Line Text: "${currentLineText}"`);
        if (currentLineText === "") {
          const lineYOffset = calculateCursorLineYOffset(contentEditableEl, cursorPosition);
          const contentWrapperRect = contentWrapperEl.getBoundingClientRect();
          console.log(`[Toolbar Logic] Line is empty. LineYOffset: ${lineYOffset}`);
          if (lineYOffset !== null) {
            newToolbarStyle.top = `${(contentWrapperRect.top - formRect.top) + lineYOffset - (TOOLBAR_HEIGHT / 2)}px`;
            newToolbarStyle.left = `${contentWrapperRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET}px`;
            newToolbarStyle.display = 'flex';
          } else {
            // Fallback if lineYOffset is null (e.g. contentEditableEl has no height)
            // Position at top of contentEditableEl for now if it has some wrapper height
            const contentElRect = contentEditableEl.getBoundingClientRect();
             if (contentWrapperRect.height > 0) {
                newToolbarStyle.top = `${(contentWrapperRect.top - formRect.top) + 10 - (TOOLBAR_HEIGHT / 2)}px`; // Approx first line
                newToolbarStyle.left = `${contentWrapperRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET}px`;
                newToolbarStyle.display = 'flex';
            } else {
                 newToolbarStyle.display = 'none';
            }
          }
        } else {
          newToolbarStyle.display = 'none';
        }
      } else {
        newToolbarStyle.display = 'none';
      }
      setToolbarStyle(newToolbarStyle);
    });
  }, [focusedField, title, storyContent, cursorPosition, getCurrentLineText, calculateCursorLineYOffset]);


  useEffect(() => {
    calculateAndUpdateToolbarStyle();
  }, [calculateAndUpdateToolbarStyle]); // This useEffect will run when the callback itself changes (due to its own deps)

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
      setTimeout(updateCursorPosition, 0); // Ensure cursor position is updated after focus
    }
  }, [updateCursorPosition]);

  const handleBlur = useCallback(() => {
    queueMicrotask(() => {
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) {
        return;
      }
      if (contentEditableRef.current && contentEditableRef.current === document.activeElement) {
        return;
      }
      if (titleInputRef.current && titleInputRef.current === document.activeElement) {
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
    const currentStoryHTML = contentEditableRef.current?.innerHTML?.trim() || "";
    const hasMeaningfulContent = currentStoryText !== '' || /<img|<div|<p/.test(currentStoryHTML); // Basic check for non-empty text or presence of common block/image tags

    if (!hasMeaningfulContent) {
      setStoryError("Story content is required.");
      isValid = false;
    } else {
      setStoryError("");
    }
    return isValid;
  }, [title, category, storyContent]); // storyContent for re-validation

  const handlePublish = () => {
    setPublishAttempted(true);
    if (!validateFields()) {
      if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
      else if (!category) { /* No easy way to focus Select directly */ }
      else if (contentEditableRef.current && !storyError && (contentEditableRef.current.textContent || "").trim() === '') contentEditableRef.current.focus();
      return;
    }
    setIsSubmitting(true);
    console.log("Publishing Article Data:", { title: title.trim(), category, storyContent });
    new Promise(resolve => setTimeout(resolve, 1500)).then(() => {
      toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" published.` });
      setIsSubmitting(false);
      setTitle(""); setCategory(""); setStoryContent("");
      if (contentEditableRef.current) contentEditableRef.current.innerHTML = ""; // Ensure div is empty
      setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
    });
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
  }, [publishAttempted, updateCursorPosition]);


  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== storyContent) {
        contentEditableRef.current.innerHTML = storyContent;
    }
  }, [storyContent]);

  useEffect(() => {
    // This effect ensures the height is auto-adjusted when storyContent changes,
    // similar to how it would for a textarea.
    // This is important if storyContent is changed programmatically (e.g. loading saved content).
    const div = contentEditableRef.current;
    if (div) {
      div.style.height = 'auto'; // Reset height to recalculate scrollHeight
      if (div.scrollHeight > 0) {
        div.style.height = `${div.scrollHeight}px`;
      } else {
        // Fallback for empty or very small content to ensure min-height based on line-height
        const computedStyle = window.getComputedStyle(div);
        const minHeight = parseFloat(computedStyle.lineHeight) || 28; // Approx single line height
        div.style.height = `${minHeight}px`;
      }
    }
  }, [storyContent]); // Re-run when storyContent changes


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
                disabled={isSubmitting}
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
            <Button type="button" variant="outline" size="sm" onClick={() => coverImageInputRef.current?.click()} disabled={isSubmitting} className="text-xs py-1.5 h-9">
              <ImageUp className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cover Image</span>
              <span className="sm:hidden">Image</span>
            </Button>
            <Input id="article-image-input-header" type="file" accept="image/*" className="hidden" ref={coverImageInputRef} disabled={isSubmitting} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked. Data:", {title, category, storyContent})} disabled={isSubmitting} className="text-xs py-1.5 h-9 rounded-full">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
            </Button>
            <Button type="button" onClick={handlePublish} disabled={isSubmitting} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full">
              {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Publish
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
            disabled={isSubmitting}
            className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"
            autoComplete="off"
          />
          {publishAttempted && titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
        </div>
        
        <div ref={contentEditableWrapperRef} className="relative">
          <div
            ref={contentEditableRef}
            contentEditable={!isSubmitting}
            onInput={handleContentEditableInput}
            onFocus={() => handleFocus('content')}
            onBlur={handleBlur}
            onKeyUp={updateCursorPosition} // Update on key up for selection changes
            onClick={updateCursorPosition}  // Update on click for selection changes
            data-placeholder="Tell your story..."
            className={cn(
              "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-normal break-words normal-case min-h-0 overflow-y-hidden", // Added overflow-y-hidden and min-h-0
              "focus:outline-none",
            )}
            style={{
              fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
              fontSize: "20px",
              lineHeight: "28px", // Ensure this is set
              color: "hsl(var(--foreground))",
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
    