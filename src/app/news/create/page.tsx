"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useIsMobile } from "@/hooks/use-mobile";

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
const TOOLBAR_WIDTH_WITH_OFFSET = 80; // Increased offset to move further left

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
        onMouseDown={(e) => e.preventDefault()} // Prevent focus steal
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
  const [storyContent, setStoryContent] = useState("<p><br></p>"); // Initialize with an empty paragraph structure
  const [cursorPosition, setCursorPosition] = useState(0);

  const [publishAttempted, setPublishAttempted] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [storyError, setStoryError] = useState("");

  const formWrapperRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute', zIndex: 50 });

  // Set initial innerHTML for contentEditableRef once on mount
  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== storyContent) {
      // Only set if it's truly different from initial state or browser hasn't already set it
      // Avoids unnecessary DOM manipulation if browser default is already <p><br></p>
      if (contentEditableRef.current.innerHTML.trim() === "" || contentEditableRef.current.innerHTML === "<br>") {
         contentEditableRef.current.innerHTML = storyContent; // storyContent is "<p><br></p>"
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount


  const updateCursorPosition = useCallback(() => {
    const activeEl = document.activeElement;
    let newPosition = 0;
    if (contentEditableRef.current && activeEl === contentEditableRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (contentEditableRef.current.contains(range.startContainer)) {
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(contentEditableRef.current);
          preCaretRange.setEnd(range.startContainer, range.startOffset);
          newPosition = preCaretRange.toString().length;
        } else {
          newPosition = contentEditableRef.current.textContent?.length || 0;
        }
      } else {
        newPosition = contentEditableRef.current.textContent?.length || 0;
      }
    } else if (titleInputRef.current && activeEl === titleInputRef.current) {
      newPosition = titleInputRef.current.selectionStart || 0;
    }
    setCursorPosition(newPosition);
  }, []);


  const getCurrentBlockElement = useCallback((): HTMLElement | null => {
    const selection = window.getSelection();
    const contentEl = contentEditableRef.current;
    if (!contentEl || !selection || selection.rangeCount === 0) return contentEl; // Default to the main div

    let node = selection.focusNode;
    if (!node || !contentEl.contains(node)) return contentEl; // Default if selection outside

    while (node && node !== contentEl) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        // Common block-level elements used in contentEditable
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tagName)) {
          if (contentEl.contains(element)) return element;
        }
      }
      node = node.parentNode;
    }
    // If loop finishes, means cursor is directly in contentEl or in a non-block child, so return contentEl itself as the "block"
    return contentEl;
  }, []);


  const getCurrentLineText = useCallback((): string => {
    const element = contentEditableRef.current;
    if (!element) return "error-no-ref";

    const currentBlock = getCurrentBlockElement();
    // If cursor is inside a specific block element (like <p>, <div> from Enter) or directly in contentEditable
    return currentBlock?.textContent?.trim() || "";
  }, [getCurrentBlockElement]);


  const calculateCursorLineYOffset = useCallback((): number | null => {
    const contentEl = contentEditableRef.current;
    if (!contentEl) return null;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        return rects[0].top + rects[0].height / 2; // Vertical center of the caret/selection
      }
    }
    
    // Fallback if no selection rect (e.g., truly empty line or just focused div)
    const currentBlock = getCurrentBlockElement(); // This could be a <p> or the main contentEl
    if (currentBlock) {
        const blockRect = currentBlock.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(currentBlock);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        let lineHeight = parseFloat(computedStyle.lineHeight);
        if (isNaN(lineHeight) || lineHeight === 0) { // Fallback for 'normal' or 0
            const fontSize = parseFloat(computedStyle.fontSize) || 16; // Default font size
            lineHeight = fontSize * 1.4; // Common multiplier for line height
        }
        // If the block itself has some height (e.g., it's a <p> even if empty)
        if (blockRect.height > 0) {
          return blockRect.top + paddingTop + (lineHeight / 2);
        }
    }
    // Final fallback: use the contentEditable div itself
    if (document.activeElement === contentEl) {
      const mainDivRect = contentEl.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(contentEl);
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
      let lineHeight = parseFloat(computedStyle.lineHeight);
      if (isNaN(lineHeight) || lineHeight === 0) {
        const fontSize = parseFloat(computedStyle.fontSize) || 16;
        lineHeight = fontSize * 1.4;
      }
      return mainDivRect.top + paddingTop + (lineHeight / 2);
    }
    return null; // Could not determine
  }, [getCurrentBlockElement]);


  const calculateAndUpdateToolbarStyle = useCallback(() => {
    requestAnimationFrame(() => {
      const formEl = formWrapperRef.current;
      const titleEl = titleInputRef.current;
      const contentEl = contentEditableRef.current;
      let newToolbarStyle: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 50 };

      if (!formEl) { setToolbarStyle(newToolbarStyle); return; }
      const formRect = formEl.getBoundingClientRect();

      if (focusedField === 'title' && titleEl) {
        if (title.trim() === "") {
          const titleRect = titleEl.getBoundingClientRect();
          const titleCenterY = titleRect.top + titleRect.height / 2;
          newToolbarStyle.top = `${titleCenterY - formRect.top - (TOOLBAR_HEIGHT / 2)}px`;
          newToolbarStyle.left = `${titleRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET}px`;
          newToolbarStyle.display = 'flex';
        }
      } else if (focusedField === 'content' && contentEl) {
        const currentLineIsEmpty = getCurrentLineText() === "";
        if (currentLineIsEmpty) {
          const lineYOffsetClient = calculateCursorLineYOffset(); // This is viewport-relative
          if (lineYOffsetClient !== null) {
            const contentRect = contentEl.getBoundingClientRect(); // For left positioning
            newToolbarStyle.top = `${lineYOffsetClient - formRect.top - (TOOLBAR_HEIGHT / 2)}px`;
            newToolbarStyle.left = `${contentRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET}px`;
            newToolbarStyle.display = 'flex';
          }
        }
      }
      setToolbarStyle(newToolbarStyle);
    });
  }, [focusedField, title, storyContent, cursorPosition, getCurrentLineText, calculateCursorLineYOffset]); // Added storyContent and cursorPosition

  useEffect(() => {
    calculateAndUpdateToolbarStyle();
  }, [focusedField, title, storyContent, cursorPosition, calculateAndUpdateToolbarStyle]);


  useEffect(() => {
    const handleSelectionOrKey = () => {
      if (document.activeElement === contentEditableRef.current || document.activeElement === titleInputRef.current) {
        updateCursorPosition();
      }
    };
    document.addEventListener('selectionchange', handleSelectionOrKey);
    document.addEventListener('keyup', handleSelectionOrKey);
    document.addEventListener('click', handleSelectionOrKey);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionOrKey);
      document.removeEventListener('keyup', handleSelectionOrKey);
      document.removeEventListener('click', handleSelectionOrKey);
    };
  }, [updateCursorPosition]);

  const handleFocus = useCallback((field: 'title' | 'content') => {
    setFocusedField(field);
  }, []);

  const handleBlur = useCallback(() => {
    queueMicrotask(() => {
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) return;
      if (titleInputRef.current && titleInputRef.current === document.activeElement) return;
      if (contentEditableRef.current && contentEditableRef.current === document.activeElement) return;
      setFocusedField(null);
    });
  }, []);

  const handleContentEditableInput = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => {
    const currentHTML = event.currentTarget.innerHTML;
    // Update React state directly from the DOM's innerHTML.
    // The browser and execCommand manage the DOM structure.
    setStoryContent(currentHTML);

    if (publishAttempted) {
        const currentText = event.currentTarget.textContent || "";
        if (currentText.trim() || /<img|<figure|<video/i.test(currentHTML)) {
            setStoryError("");
        } else {
            setStoryError("Story content is required.");
        }
    }
    updateCursorPosition();
  }, [publishAttempted, setStoryError, updateCursorPosition]);


  const handleContentKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.execCommand('insertParagraph', false, undefined);
      // After execCommand, the browser updates the DOM.
      // We need to update our React state to reflect this new DOM.
      if (contentEditableRef.current) {
        // Defer reading innerHTML to allow DOM to update from execCommand
        setTimeout(() => {
          const currentHTML = contentEditableRef.current!.innerHTML;
          setStoryContent(currentHTML);
          updateCursorPosition(); // To reflect new cursor position
          // calculateAndUpdateToolbarStyle(); // Toolbar will update via its useEffect
        }, 0);
      }
    }
  }, [updateCursorPosition]); // Removed calculateAndUpdateToolbarStyle from deps

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); }
    if (!category) { setCategoryError("Category is required."); isValid = false; } else { setCategoryError(""); }
    
    const currentContentText = contentEditableRef.current?.textContent?.trim() || "";
    // Check innerHTML for non-textual elements like images, if textContent is empty
    const currentContentHTML = contentEditableRef.current?.innerHTML || "";
    if (!currentContentText && !/<img|<figure|<video/i.test(currentContentHTML)) {
      setStoryError("Story content is required."); isValid = false;
    } else { setStoryError(""); }
    return isValid;
  }, [title, category]); // Removed storyContent from deps, uses ref directly

  const handlePublish = () => {
    setPublishAttempted(true);
    if (!validateFields()) {
      if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
      else if (!category) { /* Error displayed below Select */ }
      else if (contentEditableRef.current && storyError) contentEditableRef.current.focus();
      return;
    }
    console.log("Publishing Article:", { title: title.trim(), category, storyContent });
    toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" would be published.` });
    
    setTitle(""); setCategory("");
    const initialEmptyContent = "<p><br></p>";
    setStoryContent(initialEmptyContent);
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = initialEmptyContent; // Explicitly reset DOM
      const pTag = contentEditableRef.current.querySelector('p');
      if (pTag) { // Try to set cursor in the new empty paragraph
          const range = document.createRange();
          const sel = window.getSelection();
          range.setStart(pTag, 0); 
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
          contentEditableRef.current.focus(); // Re-focus for toolbar
      }
    }
    setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
    setCursorPosition(0);
    setFocusedField(null); // This will also trigger toolbar update
  };

  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div ref={formWrapperRef} className="max-w-3xl mx-auto space-y-0 relative"> {/* Added relative here */}
        
        <div ref={toolbarRef}> {/* Toolbar element */}
          <InlineToolbar style={toolbarStyle} />
        </div>
        
        <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
           <div className="flex items-center gap-2 mr-auto">
            <div className="space-y-1">
              <Select
                onValueChange={(value) => {
                  setCategory(value);
                  if (publishAttempted) { // Only update error if publish was attempted
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

        <div className="relative mb-4"> {/* Added relative here */}
          <Input
            ref={titleInputRef}
            placeholder="Title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (publishAttempted) { // Only update error if publish was attempted
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
        
        <div className="relative"> {/* Added relative here */}
          <div
            ref={contentEditableRef}
            contentEditable={true}
            onInput={handleContentEditableInput}
            onFocus={() => handleFocus('content')}
            onBlur={handleBlur}
            onKeyDown={handleContentKeyDown}
            onClick={updateCursorPosition} // Ensure cursor is updated on click
            onKeyUp={updateCursorPosition} // And on keyup
            data-placeholder="Tell your story..."
            className={cn(
              "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case",
              "focus:outline-none min-h-[150px]" // min-h ensure it's clickable even when empty
            )}
            style={{
              fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
              fontSize: "20px", // Matching Medium's story font size
              lineHeight: "28px", // Matching Medium's story line height
              color: "hsl(var(--foreground))", // Use theme color
            }}
            role="textbox"
            aria-multiline="true"
            aria-label="News article content"
            // DO NOT use dangerouslySetInnerHTML here if managing through onInput
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        
        {/* Adjusted CSS for placeholder to better handle <p><br></p> */}
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before { /* For truly empty div, if it ever happens */
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none; 
            display: block; 
            position: absolute; 
            top: 0.5rem; /* Match py-2 */
            left: 0; 
          }
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:empty:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:has(br:only-child):before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none; 
            display: block; 
            position: absolute; 
            top: 0.5rem; /* Match py-2 of the contentEditable div */
            left: 0; 
          }
          /* Hide default placeholder if our custom one is showing or if content is present */
           div[contentEditable="true"][data-placeholder]:not(:empty):before,
           div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:empty):before,
           div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:has(br:only-child)):before {
             content: none;
           }
        `}</style>
      </div>
    </div>
  );
};

export default CreateNewsArticlePage;
