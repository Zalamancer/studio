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
import { Loader2, Save, Send, ImageUp, PlusCircle } from 'lucide-react'; // Added PlusCircle for toolbar
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

// Toolbar Component (simplified and inline for now)
interface InlineToolbarProps {
  style: React.CSSProperties;
  // Add action handlers as props later, e.g., onAddImage, onFormatBold
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
      {/* Add more toolbar buttons here later (e.g., Bold, Italic, Image) */}
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
  const [storyContent, setStoryContent] = useState(""); // HTML content for the div

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [storyError, setStoryError] = useState("");

  const formWrapperRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleWrapperRef = useRef<HTMLDivElement>(null); // Wrapper for title input
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const contentEditableWrapperRef = useRef<HTMLDivElement>(null); // Wrapper for contentEditable div
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);


  // State for toolbar
  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0); // Character offset
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute', zIndex: 50 });
  const TOOLBAR_HEIGHT = 36; // Approximate height of the toolbar for centering
  const TOOLBAR_WIDTH_WITH_OFFSET = 60; // Toolbar width + desired offset from element


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
    // A more robust check for "empty" contentEditable might involve checking innerHTML for non-br tags too
    const hasMeaningfulContent = currentStoryText !== '' || (contentEditableRef.current?.innerHTML.includes('<img') || contentEditableRef.current?.innerHTML.includes('<div') || contentEditableRef.current?.innerHTML.includes('<p'));

    if (!hasMeaningfulContent) {
      setStoryError("Story content is required.");
      isValid = false;
    } else {
      setStoryError("");
    }
    return isValid;
  }, [title, category]); // storyContent removed as direct dependency, relies on ref.current


  const handlePublish = () => {
    setPublishAttempted(true);
    if (!validateFields()) {
      if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
      else if (!category) { /* No easy way to focus Select directly */ }
      else if (contentEditableRef.current && (contentEditableRef.current.textContent || "").trim() === '') contentEditableRef.current.focus();
      return;
    }

    setIsSubmitting(true);
    console.log("Publishing Article Data:", {
      title: title.trim(),
      category,
      storyContent: storyContent,
    });

    new Promise(resolve => setTimeout(resolve, 1500)).then(() => {
      toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" published.` });
      setIsSubmitting(false);
      setTitle("");
      setCategory("");
      setStoryContent(""); // This should trigger the useEffect to update innerHTML
      setPublishAttempted(false);
      setTitleError("");
      setCategoryError("");
      setStoryError("");
    });
  };

  // Update storyContent state from contentEditable div's innerHTML
  const handleContentEditableInput = (event: React.FormEvent<HTMLDivElement>) => {
    const currentHTML = event.currentTarget.innerHTML;
    setStoryContent(currentHTML); // Update state with HTML
    updateCursorPosition();

    if (publishAttempted) {
      const currentText = event.currentTarget.textContent || "";
      const hasNonTextualContent = /<img[^>]*>|<div[^>]*>|<p[^>]*>/.test(currentHTML);
      if (currentText.trim() !== '' || hasNonTextualContent || (currentHTML.trim() !== '' && currentHTML !== "<br>")) {
        setStoryError("");
      } else {
        setStoryError("Story content is required.");
      }
    }
  };
  
  // Effect to synchronize storyContent state with the contentEditable div's innerHTML
  // This is useful if storyContent is changed programmatically (e.g., on clear after publish)
  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== storyContent) {
      contentEditableRef.current.innerHTML = storyContent;
    }
  }, [storyContent]);


  // --- Toolbar Logic ---
  const getCursorPosition = useCallback((): number => {
    const element = contentEditableRef.current;
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
    setCursorPosition(getCursorPosition());
  }, [getCursorPosition]);


  const getCurrentLineText = useCallback((): string => {
    const element = contentEditableRef.current;
    if (!element || focusedField !== 'content') return "non-empty"; // Default to non-empty if not focused on content

    const text = element.textContent || "";
    if (text.length === 0) return "";

    // Ensure cursorPosition is within bounds
    const currentCursorPos = Math.min(Math.max(0, cursorPosition), text.length);

    let lineStart = text.lastIndexOf('\n', currentCursorPos - 1) + 1;
    
    // Handle case where cursor is at the very beginning of the text
    if (currentCursorPos === 0) lineStart = 0;

    let lineEndSearchPos = currentCursorPos;
    // If cursor is at the end of the text AND the text ends with a newline,
    // we consider the "current line" to be the one *before* that trailing newline
    // unless it's the only character.
    if (currentCursorPos === text.length && text.endsWith('\n') && text.length > 1) {
        lineEndSearchPos = currentCursorPos -1;
    }
    
    let lineEnd = text.indexOf('\n', lineEndSearchPos);
    if (lineEnd === -1) {
      lineEnd = text.length;
    }
    
    // Adjust if cursor is on an empty line at the end of the document
    if (currentCursorPos === text.length && text.endsWith('\n')) {
        if (lineStart === text.length) { // Cursor on a new line after the last actual newline
             // no-op, this means an empty line at the very end
        }
    } else if (currentCursorPos === text.length && !text.endsWith('\n') && lineStart === currentCursorPos ) {
         // cursor at the end of text on a new line not yet created by \n
    }


    return text.substring(lineStart, lineEnd).trim();
  }, [focusedField, cursorPosition, contentEditableRef]);


  const calculateAndUpdateToolbarStyle = useCallback(() => {
    requestAnimationFrame(() => {
      const newToolbarStyle: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 50 };
      const mainWrapperRect = formWrapperRef.current?.getBoundingClientRect();

      if (!mainWrapperRect) {
        setToolbarStyle(newToolbarStyle);
        return;
      }

      if (focusedField === 'title' && titleInputRef.current && titleWrapperRef.current) {
        if (title.trim() === '') {
          const titleRect = titleWrapperRef.current.getBoundingClientRect();
          newToolbarStyle.top = `${titleRect.top - mainWrapperRect.top + (titleRect.height / 2) - (TOOLBAR_HEIGHT / 2)}px`;
          newToolbarStyle.left = `${titleRect.left - mainWrapperRect.left - TOOLBAR_WIDTH_WITH_OFFSET}px`;
          newToolbarStyle.display = 'flex';
        }
      } else if (focusedField === 'content' && contentEditableRef.current && contentEditableWrapperRef.current) {
        const currentLineText = getCurrentLineText();
        if (currentLineText === "") {
          const selection = window.getSelection();
          let lineTopRelToViewport: number | null = null;

          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const clientRects = range.getClientRects();
            if (clientRects.length > 0) {
              lineTopRelToViewport = clientRects[0].top + (clientRects[0].height / 2);
            } else { // Fallback for completely empty div or when getClientRects fails
              const contentRect = contentEditableWrapperRef.current.getBoundingClientRect();
              const computedStyle = window.getComputedStyle(contentEditableRef.current);
              const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
              const firstLineApproxTop = contentRect.top + paddingTop;
              lineTopRelToViewport = firstLineApproxTop + ( (parseFloat(computedStyle.lineHeight) || 20) / 2);
            }
          }

          if (lineTopRelToViewport !== null) {
            const contentWrapperRect = contentEditableWrapperRef.current.getBoundingClientRect();
            newToolbarStyle.top = `${lineTopRelToViewport - mainWrapperRect.top - (TOOLBAR_HEIGHT / 2)}px`;
            newToolbarStyle.left = `${contentWrapperRect.left - mainWrapperRect.left - TOOLBAR_WIDTH_WITH_OFFSET}px`;
            newToolbarStyle.display = 'flex';
          }
        }
      }
      setToolbarStyle(newToolbarStyle);
    });
  }, [focusedField, title, storyContent, cursorPosition, getCurrentLineText]); // storyContent added

  useEffect(() => {
    calculateAndUpdateToolbarStyle();
  }, [calculateAndUpdateToolbarStyle]);
  
  // Update cursor position on selection change for contentEditable
  useEffect(() => {
    const handleSelectionChange = () => {
      if (focusedField === 'content') {
        updateCursorPosition();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [focusedField, updateCursorPosition]);


  const handleFocus = useCallback((field: 'title' | 'content') => {
    setFocusedField(field);
    if (field === 'content') {
      // Ensure cursor position is updated immediately on focus if needed
      // especially if the content was empty and user clicks into it.
      setTimeout(updateCursorPosition, 0);
    }
  }, [updateCursorPosition]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLDivElement>) => {
    // Delay hiding the toolbar to allow clicks on toolbar buttons
    setTimeout(() => {
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) {
        // Focus is on the toolbar, keep it open
        return;
      }
      if (contentEditableRef.current && contentEditableRef.current.contains(document.activeElement)) {
        // Focus is still within the content editable (e.g. user clicked inside but not on a button)
        return;
      }
       if (titleInputRef.current && titleInputRef.current === document.activeElement) {
        // Focus is still within the title input
        return;
      }
      setFocusedField(null);
    }, 0);
  }, []);


  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div ref={formWrapperRef} className="max-w-3xl mx-auto space-y-0 relative">
        {/* Toolbar rendered here, its style is controlled by toolbarStyle state */}
        <InlineToolbar style={toolbarStyle} />

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
            onKeyUp={updateCursorPosition} // for consistency, though less critical for input
            onClick={updateCursorPosition}  // for consistency
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
            onKeyUp={updateCursorPosition}
            onClick={updateCursorPosition}
            data-placeholder="Tell your story..."
            className={cn(
              "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case min-h-0", // min-h-0 to allow shrinking
              "focus:outline-none",
            )}
            style={{
              fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
              fontSize: "20px",
              lineHeight: "28px",
              color: "hsl(var(--foreground))", // Use theme color
              minHeight: "28px", // Minimum height for one line
            }}
            role="textbox"
            aria-multiline="true"
            aria-label="News article content"
            // dangerouslySetInnerHTML={{ __html: storyContent }} // Managed by useEffect now
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none;
            display: block; /* Or inline-block if preferred */
          }
          /* Try to hide placeholder even if there's just a <br> from browser */
          div[contentEditable="true"][data-placeholder]:has(br:only-child):before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none;
            display: block; /* Or inline-block if preferred */
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
