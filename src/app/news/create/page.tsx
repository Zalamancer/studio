
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
        onMouseDown={(e) => e.preventDefault()} // Prevent focus shift
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
  const [storyContent, setStoryContent] = useState("<p><br></p>"); // Initial content with a paragraph
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

  const updateCursorPosition = useCallback(() => {
    if (contentEditableRef.current && document.activeElement === contentEditableRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (contentEditableRef.current.contains(range.startContainer)) {
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(contentEditableRef.current);
          preCaretRange.setEnd(range.startContainer, range.startOffset);
          setCursorPosition(preCaretRange.toString().length);
        } else {
          setCursorPosition(contentEditableRef.current.textContent?.length || 0);
        }
      } else {
         setCursorPosition(contentEditableRef.current.textContent?.length || 0);
      }
    } else if (titleInputRef.current && document.activeElement === titleInputRef.current) {
        setCursorPosition(titleInputRef.current.selectionStart || 0);
    }
  }, []);

  // Effect to initialize contentEditable div if storyContent is the initial empty paragraph,
  // or if it's externally reset to this structure.
  useEffect(() => {
    if (contentEditableRef.current && storyContent === "<p><br></p>" && contentEditableRef.current.innerHTML !== storyContent) {
      console.log("[useEffect] Initializing/Resetting contentEditable.innerHTML with:", storyContent);
      contentEditableRef.current.innerHTML = storyContent;
      // After setting initial content, ensure cursor is placed correctly.
      const pTag = contentEditableRef.current.querySelector('p');
      if (pTag) {
        const range = document.createRange();
        const sel = window.getSelection();
        // Ensure the pTag has some content for the range, like a ZWS or the BR
        if (pTag.firstChild) {
           range.setStart(pTag.firstChild, 0); 
        } else {
           pTag.appendChild(document.createElement('br')); // Ensure there's a BR to select
           range.setStart(pTag, 0);
        }
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
        updateCursorPosition();
      }
    }
  }, [storyContent, updateCursorPosition]);

  const getCurrentBlockElement = useCallback((): HTMLElement | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return contentEditableRef.current; 

    let node = selection.focusNode;
    if (!node || !contentEditableRef.current?.contains(node)) return contentEditableRef.current; 

    while (node && node !== contentEditableRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'].includes(tagName)) {
          if (contentEditableRef.current.contains(element)) {
            return element;
          }
        }
      }
      node = node.parentNode;
    }
    return contentEditableRef.current; // Fallback to the main contentEditable div itself
  }, []);


  const calculateCursorLineYOffset = useCallback((): number | null => {
    if (!contentEditableRef.current) return null;
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        // Use the first rect, which should be the caret or selection
        return rects[0].top + rects[0].height / 2; // Center of the caret/selection line
      }
    }

    // Fallback 1: If selection rects are not available (e.g., truly empty line),
    // try to get the Y-position of the current block element.
    const currentBlock = getCurrentBlockElement();
    if (currentBlock && currentBlock !== contentEditableRef.current) { // Ensure it's a child block, not the main div
        const blockRect = currentBlock.getBoundingClientRect();
        if (blockRect.height > 0) {
            const computedStyle = window.getComputedStyle(currentBlock);
            let lineHeight = parseFloat(computedStyle.lineHeight);
            if (isNaN(lineHeight) || lineHeight === 0) {
                const fontSize = parseFloat(computedStyle.fontSize) || 16;
                lineHeight = fontSize * 1.4; // Approximation if 'normal'
            }
            return blockRect.top + lineHeight / 2; // Middle of the block's first potential line
        }
    }
    
    // Fallback 2: If the contentEditable div itself is focused and considered "empty" or the above failed.
    // This often happens on initial load with <p><br></p> or if the div is truly empty.
    if (document.activeElement === contentEditableRef.current) {
        const mainDivRect = contentEditableRef.current.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(contentEditableRef.current);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        let lineHeight = parseFloat(computedStyle.lineHeight);
        if (isNaN(lineHeight) || lineHeight === 0) { // Handles 'normal' or unitless
            const fontSize = parseFloat(computedStyle.fontSize) || 16; // Default font size
            lineHeight = fontSize * 1.4; // Common approximation
        }
        // Position for the first line if div is empty or selection is at start
        return mainDivRect.top + paddingTop + (lineHeight / 2);
    }

    return null;
  }, [getCurrentBlockElement]);

  const calculateAndUpdateToolbarStyle = useCallback(() => {
    requestAnimationFrame(() => {
      const formEl = formWrapperRef.current;
      const titleEl = titleInputRef.current;
      const contentEl = contentEditableRef.current;
      let newToolbarStyle: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 50 };

      if (!formEl) {
        setToolbarStyle(newToolbarStyle);
        return;
      }
      const formRect = formEl.getBoundingClientRect();

      if (focusedField === 'title' && titleEl) {
        if (title.trim() === '') {
          const titleRect = titleEl.getBoundingClientRect();
          newToolbarStyle.top = `${Math.max(0, titleRect.top - formRect.top + (titleRect.height / 2) - (TOOLBAR_HEIGHT / 2))}px`;
          newToolbarStyle.left = `${Math.max(0, titleRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET)}px`;
          newToolbarStyle.display = 'flex';
        }
      } else if (focusedField === 'content' && contentEl) {
        const currentBlock = getCurrentBlockElement();
        console.log("[ToolbarCalc] Content Focused. currentBlock:", currentBlock, "currentBlock.textContent:", `"${currentBlock?.textContent?.trim()}"`);
        
        if (currentBlock && currentBlock.textContent?.trim() === "") {
          const lineYOffsetClient = calculateCursorLineYOffset();
          console.log("[ToolbarCalc] Current block is empty. lineYOffsetClient:", lineYOffsetClient);
          
          if (lineYOffsetClient !== null) {
            const contentRect = contentEl.getBoundingClientRect();
            newToolbarStyle.top = `${Math.max(0, lineYOffsetClient - formRect.top - (TOOLBAR_HEIGHT / 2))}px`;
            newToolbarStyle.left = `${Math.max(0, contentRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET)}px`;
            newToolbarStyle.display = 'flex';
          } else {
            console.log("[ToolbarCalc] lineYOffsetClient is null, hiding toolbar.");
          }
        } else {
           console.log("[ToolbarCalc] Current block is NOT empty or no block. Hiding toolbar.");
        }
      }
      setToolbarStyle(newToolbarStyle);
    });
  }, [focusedField, title, storyContent, cursorPosition, getCurrentBlockElement, calculateCursorLineYOffset]);


  useEffect(() => {
    calculateAndUpdateToolbarStyle();
  }, [focusedField, title, storyContent, cursorPosition, calculateAndUpdateToolbarStyle]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === contentEditableRef.current || document.activeElement === titleInputRef.current) {
        updateCursorPosition();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
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
    let newStoryContent = currentHTML;
    // If the div is visually empty but contains only a <br> (common browser behavior), treat it as empty for state.
    if (currentHTML === '<br>' || currentHTML.trim() === '<p><br></p>' || currentHTML.trim() === '<p></p>') {
        // Keep <p><br></p> as the "empty" state for block structure
        if (currentHTML.trim() === '<p></p>') newStoryContent = "<p><br></p>";
        else if (currentHTML.trim() === '<br>') newStoryContent = "<p><br></p>";
        // else if currentHTML.trim() is already <p><br></p>, it's fine.
    }

    setStoryContent(newStoryContent);
    updateCursorPosition(); 
    if (publishAttempted) {
      if (event.currentTarget.textContent?.trim() || /<img|<figure|<video/i.test(newStoryContent)) {
        setStoryError("");
      } else {
        setStoryError("Story content is required.");
      }
    }
  }, [publishAttempted, updateCursorPosition]);
  
  const handleContentKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.execCommand('insertParagraph', false, undefined); 
      
      // After execCommand, the DOM might be updated. We need to sync React state and then recalc toolbar.
      if (contentEditableRef.current) {
        setTimeout(() => {
          handleContentEditableInput({ currentTarget: contentEditableRef.current } as any); // Sync state
          updateCursorPosition(); // Update cursor position state
          calculateAndUpdateToolbarStyle(); // Recalculate toolbar
        }, 0);
      }
    }
  };

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); }
    if (!category) { setCategoryError("Category is required."); isValid = false; } else { setCategoryError(""); }
    if (!contentEditableRef.current?.textContent?.trim() && !/<img|<figure|<video/i.test(storyContent)) {
      setStoryError("Story content is required."); isValid = false;
    } else { setStoryError(""); }
    return isValid;
  }, [title, category, storyContent]);

  const handlePublish = () => {
    setPublishAttempted(true);
    if (!validateFields()) {
      if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
      else if (!category) { /* Error shown by its own check */ }
      else if (contentEditableRef.current && storyError) contentEditableRef.current.focus();
      return;
    }
    console.log("Publishing Article:", { title: title.trim(), category, storyContent });
    toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" published.` });
    
    setTitle(""); setCategory("");
    setStoryContent("<p><br></p>"); // Reset to initial empty paragraph structure
    setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
    setCursorPosition(0);
  };

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

        <div className="relative mb-4">
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
        
        <div className="relative">
          <div
            ref={contentEditableRef}
            contentEditable={true}
            onInput={handleContentEditableInput}
            onFocus={() => handleFocus('content')}
            onBlur={handleBlur}
            onKeyDown={handleContentKeyDown}
            onClick={() => { updateCursorPosition(); calculateAndUpdateToolbarStyle(); }}
            onKeyUp={() => { updateCursorPosition(); calculateAndUpdateToolbarStyle(); }}
            data-placeholder="Tell your story..."
            className={cn(
              "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case",
              "focus:outline-none min-h-[150px]" 
            )}
            style={{
              fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
              fontSize: "20px",
              lineHeight: "28px",
              color: "hsl(var(--foreground))",
            }}
            role="textbox"
            aria-multiline="true"
            aria-label="News article content"
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before,
          div[contentEditable="true"][data-placeholder]:where(:not(:has(*:not(br)))):before,
          div[contentEditable="true"][data-placeholder]:has(p:empty):before,
          div[contentEditable="true"][data-placeholder]:has(p:has(br:only-child)):before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none; 
            display: block; 
            position: absolute; 
            top: 0.5rem; /* Adjust to match py-2 */
            left: 0; 
          }
        `}</style>
      </div>
    </div>
  );
};

export default CreateNewsArticlePage;

    