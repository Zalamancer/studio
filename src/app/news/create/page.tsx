
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
import { useIsMobile } from "@/hooks/use-mobile"; // Corrected import

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
const TOOLBAR_WIDTH_WITH_OFFSET = 80; // How far left of the input edge the toolbar's left edge should be

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
  const [storyContent, setStoryContent] = useState("<p><br></p>"); // Start with an empty paragraph
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
    const activeEl = document.activeElement;
    if (contentEditableRef.current && activeEl === contentEditableRef.current) {
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
    } else if (titleInputRef.current && activeEl === titleInputRef.current) {
      setCursorPosition(titleInputRef.current.selectionStart || 0);
    }
  }, []);

  const getCurrentBlockElement = useCallback((): HTMLElement | null => {
    const selection = window.getSelection();
    if (!contentEditableRef.current || !selection || selection.rangeCount === 0) return contentEditableRef.current;

    let node = selection.focusNode;
    if (!node || !contentEditableRef.current.contains(node)) return contentEditableRef.current;

    while (node && node !== contentEditableRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'].includes(tagName)) {
          if (contentEditableRef.current.contains(element)) return element;
        }
      }
      node = node.parentNode;
    }
    return contentEditableRef.current; // Fallback to the main contentEditable div
  }, []);
  
  const getCurrentLineText = useCallback((): string => {
    const element = contentEditableRef.current;
    if (!element) return "non-empty-ref-null"; // Should not happen if focused

    const currentBlock = getCurrentBlockElement();
    // If the current block is the contentEditable div itself and it's effectively empty, treat it as an empty line
    if (currentBlock === element) {
      if (element.textContent?.trim() === "" || element.innerHTML === "<br>" || element.innerHTML === "<p><br></p>") {
        return "";
      }
    }
    // Otherwise, use the textContent of the specific block
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

    // Fallback if no selection rect (e.g., truly empty line or div just focused)
    const currentBlock = getCurrentBlockElement();
    if (currentBlock && currentBlock !== contentEl) {
      const blockRect = currentBlock.getBoundingClientRect();
      if (blockRect.height > 0) {
        const computedStyle = window.getComputedStyle(currentBlock);
        let lineHeight = parseFloat(computedStyle.lineHeight);
        if (isNaN(lineHeight) || lineHeight === 0) {
            const fontSize = parseFloat(computedStyle.fontSize) || 16;
            lineHeight = fontSize * 1.4; // Estimate line height based on font size
        }
        return blockRect.top + lineHeight / 2; // Middle of the first line of the block
      }
    }
    
    // Final fallback: if the whole contentEditable div is the target (e.g., completely empty)
    if (document.activeElement === contentEl) {
        const mainDivRect = contentEl.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(contentEl);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        let lineHeight = parseFloat(computedStyle.lineHeight);
        if (isNaN(lineHeight) || lineHeight === 0) {
             const fontSize = parseFloat(computedStyle.fontSize) || 16; // Default font size
             lineHeight = fontSize * 1.4; // Approximate line height
        }
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

      if (!formEl) { setToolbarStyle(newToolbarStyle); return; }
      const formRect = formEl.getBoundingClientRect();

      if (focusedField === 'title' && titleEl) {
        if (title.trim() === '') {
          const titleRect = titleEl.getBoundingClientRect();
          newToolbarStyle.top = `${Math.max(0, titleRect.top - formRect.top + (titleRect.height / 2) - (TOOLBAR_HEIGHT / 2))}px`;
          newToolbarStyle.left = `${titleRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET}px`; // Removed Math.max(0, ...)
          newToolbarStyle.display = 'flex';
        }
      } else if (focusedField === 'content' && contentEl) {
        const currentLineIsEmpty = getCurrentLineText() === "";
        if (currentLineIsEmpty) {
          const lineYOffsetClient = calculateCursorLineYOffset();
          if (lineYOffsetClient !== null) {
            const contentRect = contentEl.getBoundingClientRect();
            newToolbarStyle.top = `${Math.max(0, lineYOffsetClient - formRect.top - (TOOLBAR_HEIGHT / 2))}px`;
            newToolbarStyle.left = `${contentRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET}px`; // Removed Math.max(0, ...)
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
    setStoryContent(currentHTML);
    if (publishAttempted) {
        const currentText = event.currentTarget.textContent || "";
        if (currentText.trim() || /<img|<figure|<video/i.test(currentHTML)) {
            setStoryError("");
        } else {
            setStoryError("Story content is required.");
        }
    }
  }, [publishAttempted]);

  const handleContentKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.execCommand('insertParagraph', false, undefined);
      if (contentEditableRef.current) {
        setTimeout(() => {
          handleContentEditableInput({ currentTarget: contentEditableRef.current } as any);
          updateCursorPosition(); // Call after DOM update
          calculateAndUpdateToolbarStyle(); // Recalculate toolbar position
        }, 0);
      }
    }
  }, [handleContentEditableInput, updateCursorPosition, calculateAndUpdateToolbarStyle]);

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); }
    if (!category) { setCategoryError("Category is required."); isValid = false; } else { setCategoryError(""); }

    const currentContentText = contentEditableRef.current?.textContent?.trim() || "";
    const currentContentHTML = storyContent; // This is innerHTML
    if (!currentContentText && !/<img|<figure|<video/i.test(currentContentHTML)) {
      setStoryError("Story content is required."); isValid = false;
    } else { setStoryError(""); }
    return isValid;
  }, [title, category, storyContent]);

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
    setStoryContent("<p><br></p>"); // Reset to an empty paragraph
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = "<p><br></p>"; // Visually reset
      // Try to set cursor into the new paragraph (can be tricky)
      const pTag = contentEditableRef.current.querySelector('p');
      if (pTag) {
          const range = document.createRange();
          const sel = window.getSelection();
          range.setStart(pTag, 0); // Collapse to the start of the new paragraph
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
          contentEditableRef.current.focus();
      }
    }
    setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
    setCursorPosition(0);
    setFocusedField(null); // Unfocus
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
            onClick={updateCursorPosition} 
            onKeyUp={updateCursorPosition} 
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
            dangerouslySetInnerHTML={{ __html: storyContent }} // Managed by React now
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before,
          div[contentEditable="true"][data-placeholder]:has(p:empty):before,
          div[contentEditable="true"][data-placeholder]:has(p:has(br)):before,
          div[contentEditable="true"][data-placeholder]:has(div:empty):before,
          div[contentEditable="true"][data-placeholder]:has(div:has(br)):before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none; 
            display: block; 
            position: absolute; 
            top: 0.5rem; /* Match py-2 */
            left: 0; 
          }
          /* Ensure even if it has a <p><br></p> from execCommand, it's considered empty for placeholder */
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:empty:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:has(br:only-child):before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none; 
            display: block; 
            position: absolute; 
            top: 0.5rem; /* Match py-2 */
            left: 0; 
          }
        `}</style>
      </div>
    </div>
  );
};

export default CreateNewsArticlePage;
