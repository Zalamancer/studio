
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
import { Loader2, Save, Send, ImageUp, ImageIcon, YoutubeIcon, Link2Icon, SquareCodeIcon, MinusIcon, PlusIcon, XIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from "@/hooks/use-is-mobile";

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
const TOOLBAR_HORIZONTAL_OFFSET = 80; 

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [storyContent, setStoryContent] = useState("<p><br></p>"); // Initial empty state for contentEditable
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectionNonce, setSelectionNonce] = useState(0); // New state to force effect updates

  const [publishAttempted, setPublishAttempted] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [storyError, setStoryError] = useState("");

  const formWrapperRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleWrapperRef = useRef<HTMLDivElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const toolbarWrapperRef = useRef<HTMLDivElement>(null);

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [showContextualUI, setShowContextualUI] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [showPlusButton, setShowPlusButton] = useState(false);

  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute' });

  // Set initial content for contentEditable on mount if it's empty
  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML.trim() === "") {
      contentEditableRef.current.innerHTML = "<p><br></p>";
    }
  }, []);

  const getCurrentBlockElement = useCallback((): HTMLElement | null => {
    const selection = window.getSelection();
    const contentEl = contentEditableRef.current;
    if (!contentEl) return null;

    if (!selection || selection.rangeCount === 0) {
      if (document.activeElement === contentEl && contentEl.lastChild && contentEl.lastChild.nodeType === Node.ELEMENT_NODE) {
        return contentEl.lastChild as HTMLElement;
      }
      return contentEl; // Fallback to the contentEditable div itself if no clear block
    }

    let node = selection.focusNode;

    // If focusNode is not inside contentEl (e.g., focus is on toolbar), try a different approach
    if (!node || !contentEl.contains(node)) {
      // Try to get the first block element if focus is outside but on contentEditable itself
      if (document.activeElement === contentEl && contentEl.firstChild && contentEl.firstChild.nodeType === Node.ELEMENT_NODE) {
        return contentEl.firstChild as HTMLElement;
      }
      // If still no valid node, default to contentEl itself or its first child block
      const firstChildBlock = contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr');
      return firstChildBlock ? firstChildBlock as HTMLElement : contentEl;
    }
    
    while (node && node !== contentEl) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        // List of common block-level elements or elements we treat as blocks for the toolbar
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'figure', 'hr'].includes(tagName)) {
          if (contentEl.contains(element)) return element; // Ensure it's still within contentEditable
        }
      }
      node = node.parentNode;
    }
    // Fallback if loop finishes without finding a suitable block (e.g., caret is directly in contentEditable with no children)
    const firstChildBlock = contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr');
    return firstChildBlock ? firstChildBlock as HTMLElement : contentEl;
  }, [contentEditableRef]);


  const getCurrentLineText = useCallback((): string => {
    const contentEl = contentEditableRef.current;
    if (focusedField === 'title' && titleInputRef.current) {
      return titleInputRef.current.value.trim();
    }
    if (focusedField === 'content' && contentEl) {
      const currentBlock = getCurrentBlockElement();
      if (currentBlock) {
        // Special handling for non-textual blocks
        if (currentBlock.tagName === 'PRE' && currentBlock.textContent?.trim() !== '') return 'PRE_HAS_CONTENT';
        if (currentBlock.tagName === 'FIGURE' && currentBlock.querySelector('img, iframe')) return 'FIGURE_HAS_CONTENT';
        if (currentBlock.tagName === 'HR') return 'HR_HAS_CONTENT';
        // For other blocks, get their text content
        return currentBlock.textContent?.trim() || "";
      }
      return "NO_CURRENT_BLOCK"; // Should ideally not happen if getCurrentBlockElement defaults to contentEl
    }
    return "NO_FOCUS_OR_UNHANDLED_FIELD";
  }, [focusedField, getCurrentBlockElement, titleInputRef, contentEditableRef]);


  const updateCursorPosition = useCallback(() => {
    const activeEl = document.activeElement;
    const selection = window.getSelection();
    let newPosition = 0;

    if (activeEl === titleInputRef.current && titleInputRef.current) {
      newPosition = titleInputRef.current.selectionStart || 0;
    } else if (activeEl === contentEditableRef.current && contentEditableRef.current && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (contentEditableRef.current.contains(range.startContainer)) {
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(contentEditableRef.current);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        newPosition = preCaretRange.toString().length;
      } else {
        // If selection is somehow outside, fall back to text length (less accurate for position)
        newPosition = contentEditableRef.current.textContent?.length || 0;
      }
    } else if (contentEditableRef.current) {
      // If focus is lost but we still need a position, default to end of content
       newPosition = contentEditableRef.current.textContent?.length || 0;
    }
    setCursorPosition(newPosition);
    setSelectionNonce(n => n + 1); // Force update for toolbar positioning effect
  }, [contentEditableRef, titleInputRef]);


  const calculateCursorLineYOffset = useCallback((): number | null => {
    const contentEl = contentEditableRef.current;
    if (focusedField === 'title' && titleInputRef.current) {
      const titleRect = titleInputRef.current.getBoundingClientRect();
      return titleRect.top + titleRect.height / 2;
    }
    if (focusedField === 'content' && contentEl) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();
        if (rects.length > 0) return rects[0].top + rects[0].height / 2;
        
        let container = range.startContainer;
        if (container.nodeType === Node.TEXT_NODE && container.parentElement) container = container.parentElement;
        if (container.nodeType === Node.ELEMENT_NODE && contentEl.contains(container)) {
          const elementRect = (container as HTMLElement).getBoundingClientRect();
          if (elementRect.height > 0) {
            const computedStyle = window.getComputedStyle(container as HTMLElement);
            const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
            let lineHeight = parseFloat(computedStyle.lineHeight);
            if (isNaN(lineHeight) || lineHeight <= 0) lineHeight = (parseFloat(computedStyle.fontSize) || 16) * 1.4;
            return elementRect.top + paddingTop + (lineHeight / 2);
          }
        }
      }
      const currentBlock = getCurrentBlockElement();
      if (currentBlock && currentBlock !== contentEl && currentBlock.offsetHeight > 0) {
        const blockRect = currentBlock.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(currentBlock);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        let lineHeight = parseFloat(computedStyle.lineHeight);
        if (isNaN(lineHeight) || lineHeight <= 0) lineHeight = (parseFloat(computedStyle.fontSize) || 16) * 1.4;
        return blockRect.top + paddingTop + (lineHeight / 2);
      }
      const mainDivRect = contentEl.getBoundingClientRect();
      const computedStyleMain = window.getComputedStyle(contentEl);
      const paddingTopMain = parseFloat(computedStyleMain.paddingTop) || 0;
      let lineHeightMain = parseFloat(computedStyleMain.lineHeight);
      if (isNaN(lineHeightMain) || lineHeightMain <= 0) lineHeightMain = (parseFloat(computedStyleMain.fontSize) || 20) * 1.4;
      return mainDivRect.top + paddingTopMain + (lineHeightMain / 2);
    }
    return null;
  }, [focusedField, contentEditableRef, titleInputRef, getCurrentBlockElement]);

  const calculateAndUpdateToolbarStyle = useCallback(() => {
    let local_showContextualUI = false;
    let local_showToolbar = false;
    let local_showPlusButton = false;
    let newToolbarStyle: React.CSSProperties | null = null;

    if (focusedField && (document.activeElement === titleInputRef.current || document.activeElement === contentEditableRef.current)) {
        const lineYOffsetClient = calculateCursorLineYOffset();
        if (lineYOffsetClient !== null) {
            let referenceElementRect: DOMRect | undefined;
            if (focusedField === 'title' && titleInputRef.current) {
                referenceElementRect = titleWrapperRef.current?.getBoundingClientRect();
            } else if (focusedField === 'content' && contentEditableRef.current) {
                referenceElementRect = contentWrapperRef.current?.getBoundingClientRect();
            }

            if (referenceElementRect && formWrapperRef.current) {
                const formRect = formWrapperRef.current.getBoundingClientRect();
                const newLeft = referenceElementRect.left - formRect.left - TOOLBAR_HORIZONTAL_OFFSET;
                const newTop = lineYOffsetClient - formRect.top - (TOOLBAR_HEIGHT / 2);
                newToolbarStyle = { top: `${newTop}px`, left: `${newLeft}px`, zIndex: 50, position: 'absolute' as 'absolute' };
            }

            const currentLineText = getCurrentLineText();
            const currentLineIsEmpty = currentLineText === "" || currentLineText === "NO_CURRENT_BLOCK";
            const shouldShowBaseUI = lineYOffsetClient !== null;

            if (shouldShowBaseUI) {
                if (isToolbarExpanded) {
                    local_showContextualUI = true;
                    local_showToolbar = true;
                    local_showPlusButton = false;
                } else if (currentLineIsEmpty) {
                    local_showContextualUI = true;
                    local_showToolbar = false;
                    local_showPlusButton = true;
                } else {
                    local_showContextualUI = false;
                    local_showToolbar = false;
                    local_showPlusButton = false;
                }
            }
        }
    }

    if (local_showContextualUI && newToolbarStyle) {
        if (toolbarStyle.top !== newToolbarStyle.top || toolbarStyle.left !== newToolbarStyle.left) {
             setToolbarStyle(newToolbarStyle);
        }
    }
    
    setShowContextualUI(local_showContextualUI);
    if (local_showContextualUI) { // Only update these if base UI is shown
        setShowToolbar(local_showToolbar);
        setShowPlusButton(local_showPlusButton);
    } else { // Ensure they are false if base UI is hidden
        setShowToolbar(false);
        setShowPlusButton(false);
    }

  }, [
      focusedField, 
      titleInputRef, contentEditableRef, titleWrapperRef, contentWrapperRef, formWrapperRef, // refs
      isToolbarExpanded, // state
      toolbarStyle, // state (for comparison)
      title, storyContent, // state (implicit for getCurrentLineText)
      calculateCursorLineYOffset, // memoized callback
      getCurrentLineText, // memoized callback
    ]);

  useEffect(() => {
    calculateAndUpdateToolbarStyle();
  }, [focusedField, title, storyContent, cursorPosition, isToolbarExpanded, selectionNonce, calculateAndUpdateToolbarStyle]);


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
    // If toolbar was previously expanded, keep it expanded
    // calculateAndUpdateToolbarStyle will handle actual visibility based on context
  }, []);

  const handleBlur = useCallback(() => {
    queueMicrotask(() => {
      const activeEl = document.activeElement;
      let isFocusWithinToolbarOrInput = false;
      if (
        (toolbarWrapperRef.current && toolbarWrapperRef.current.contains(activeEl)) ||
        titleInputRef.current === activeEl ||
        contentEditableRef.current === activeEl
      ) {
        isFocusWithinToolbarOrInput = true;
      }
      if (!isFocusWithinToolbarOrInput) {
        setFocusedField(null);
        setIsToolbarExpanded(false); // Collapse toolbar if focus is completely lost
        // calculateAndUpdateToolbarStyle will hide UI due to focusedField being null
      }
    });
  }, []);

  const handleContentEditableInput = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => {
    const currentHTML = event.currentTarget.innerHTML;
    if (currentHTML.trim() === "" || currentHTML.trim() === "<br>" || currentHTML.trim() === "<p><br></p>" || currentHTML.trim() === "<p></p>") {
      setStoryContent("<p><br></p>");
    } else {
      setStoryContent(currentHTML);
    }
    if (publishAttempted) {
      const currentText = event.currentTarget.textContent || "";
      if (currentText.trim() || /<img|<figure|<video|<pre|<hr/i.test(currentHTML)) {
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
      setTimeout(() => { // Ensure DOM update before reading innerHTML
        if (contentEditableRef.current) {
          setStoryContent(contentEditableRef.current.innerHTML);
          updateCursorPosition();
        }
      }, 0);
    }
  }, [updateCursorPosition]);

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); }
    if (!category) { setCategoryError("Category is required."); isValid = false; } else { setCategoryError(""); }
    const currentHTMLContent = contentEditableRef.current?.innerHTML || "";
    const currentTextContent = contentEditableRef.current?.textContent || "";
    if (!currentTextContent.trim() && !/<img|<figure|<video|<pre|<hr/i.test(currentHTMLContent)) {
      setStoryError("Story content is required."); isValid = false;
    } else { setStoryError(""); }
    return isValid;
  }, [title, category]);

  const handlePublish = () => {
    setPublishAttempted(true);
    if (!validateFields()) {
      if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
      else if (!category) {}
      else if (contentEditableRef.current && storyError) contentEditableRef.current.focus();
      return;
    }
    console.log("Publishing Article:", { title: title.trim(), category, storyContent });
    toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" would be published.` });
    setTitle(""); setCategory("");
    const initialEmptyContent = "<p><br></p>";
    setStoryContent(initialEmptyContent);
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = initialEmptyContent;
      // Try to set caret into the empty paragraph
      const pTag = contentEditableRef.current.querySelector('p');
      if (pTag) {
        const range = document.createRange(); const sel = window.getSelection();
        try { range.setStart(pTag, 0); range.collapse(true); sel?.removeAllRanges(); sel?.addRange(range); } catch (e) {}
      }
    }
    setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
    setCursorPosition(0);
    setIsToolbarExpanded(false); // Collapse toolbar
  };
  
  const insertHTMLAndFocus = useCallback((htmlToInsert: string) => {
    const targetFieldRef = focusedField === 'title' ? titleInputRef : contentEditableRef;
    const editorEl = targetFieldRef.current;
    
    if (!editorEl || !contentEditableRef.current) return;
    
    editorEl.focus(); // Ensure focus
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // If no selection, try to create one at the end of the current content
      const range = document.createRange();
      range.selectNodeContents(editorEl);
      range.collapse(false); // false to collapse to the end
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    
    let range = selection.getRangeAt(0);
    // Ensure the range is within the editorEl
    if (!editorEl.contains(range.startContainer)) {
      range.selectNodeContents(editorEl);
      range.collapse(false);
    }

    // Special handling for contentEditable: if the current block is empty, replace it.
    if (targetFieldRef === contentEditableRef) {
      const currentBlock = getCurrentBlockElement();
      if (currentBlock && currentBlock.contains(range.startContainer) && 
          (currentBlock.textContent?.trim() === "") && 
          (currentBlock.innerHTML.toLowerCase() === "<br>" || currentBlock.innerHTML.toLowerCase() === "" || currentBlock.innerHTML.toLowerCase() === "<p><br></p>" || currentBlock.innerHTML.toLowerCase() === "<p></p>")) {
        range.selectNodeContents(currentBlock); // Select the whole empty block to replace it
      }
    }
    
    // Delete selected content if any (e.g. if user selected text then clicked an insert button)
    if (!range.collapsed) {
      range.deleteContents();
    }

    document.execCommand('insertHTML', false, htmlToInsert);
    
    if (targetFieldRef === contentEditableRef && contentEditableRef.current) {
      setStoryContent(contentEditableRef.current.innerHTML); // Update state FROM DOM
    }

    // Toolbar logic is reactive, so set isToolbarExpanded to false.
    // The calculateAndUpdateToolbarStyle effect will run due to storyContent change
    // and hide the toolbar if the line is no longer empty.
    setIsToolbarExpanded(false); 
    
    // Re-focus logic (careful not to fight with selection)
    setTimeout(() => {
        if (editorEl) editorEl.focus();
        updateCursorPosition();
    }, 0);
    
  }, [focusedField, getCurrentBlockElement, updateCursorPosition, contentEditableRef, titleInputRef, setStoryContent, setIsToolbarExpanded]);

  const handleInsertImage = useCallback(() => insertHTMLAndFocus(`<figure class="my-4 flex flex-col items-center"><img src="${encodeURI(window.prompt("Enter image URL:") || 'https://placehold.co/600x400.png')}" alt="User inserted image" style="max-width: 100%; height: auto; display: block; border-radius: 0.25rem; margin-bottom: 0.5rem;" data-ai-hint="placeholder graphic" /><figcaption contenteditable="true" data-placeholder="Optional caption..." style="text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem;" class="w-full"></figcaption></figure><p><br></p>`), [insertHTMLAndFocus]);
  const handleInsertYouTubeVideo = useCallback(() => {
    const url = window.prompt("Enter YouTube video URL or ID:");
    if (url) {
      let videoId = '';
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.substring(1);
        else if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) videoId = urlObj.searchParams.get('v')!;
        else videoId = url; // Assume it's an ID if parsing fails
      } catch (e) { videoId = url; } // If URL constructor fails, assume it's an ID
      if (videoId.match(/^[a-zA-Z0-9_-]{11}$/)) { // Basic YouTube ID validation
        insertHTMLAndFocus(`<figure class="my-4 relative" style="padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 0.25rem;" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure><p><br></p>`);
      } else {
        toast({ variant: 'destructive', title: 'Invalid YouTube URL/ID', description: 'Please enter a valid YouTube video URL or ID.' });
      }
    }
  }, [insertHTMLAndFocus, toast]);
  const handleInsertEmbed = useCallback(() => {
    const embedCode = window.prompt("Paste embed code (e.g., Twitter, Vimeo). Ensure it's iframe-based or similar safe HTML.");
    if (embedCode) {
      // Basic script tag removal (not foolproof, proper sanitization is complex)
      const sanitizedCode = embedCode.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      insertHTMLAndFocus(`<div class="my-4" data-embed-wrapper="true">${sanitizedCode}</div><p><br></p>`);
    }
  }, [insertHTMLAndFocus]);
  const handleInsertCodeBlock = useCallback(() => insertHTMLAndFocus(`<pre class="my-4 p-3 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm" style="white-space: pre-wrap; word-wrap: break-word;" contenteditable="true"><code class="language-plaintext" style="display: block;">\n// Your code here...\n\n</code></pre><p><br></p>`), [insertHTMLAndFocus]);
  const handleInsertSeparator = useCallback(() => insertHTMLAndFocus(`<hr class="my-8 border-border" /><p><br></p>`), [insertHTMLAndFocus]);

  const handleToggleToolbar = () => {
    setIsToolbarExpanded(prev => {
      const newExpandedState = !prev;
      // If opening the toolbar, ensure focus is on the editor
      if (newExpandedState) {
          if (focusedField === 'title' && titleInputRef.current) titleInputRef.current.focus();
          else if (focusedField === 'content' && contentEditableRef.current) contentEditableRef.current.focus();
      }
      return newExpandedState;
    });
  };
  
  const actionButtonClass = "p-2 hover:bg-muted rounded-full focus:outline-none focus:ring-1 focus:ring-primary";
  const iconClass = "h-5 w-5 text-primary";

  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div ref={formWrapperRef} className="max-w-3xl mx-auto relative pt-5"> {/* Added pt-5 */}
        
        {showContextualUI && (
          <div ref={toolbarWrapperRef} style={toolbarStyle} className="flex items-center space-x-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleToggleToolbar}
              onMouseDown={(e) => e.preventDefault()} // Prevent focus steal
              className="p-0 bg-card border rounded-full shadow-lg hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary h-9 w-9 z-10 flex items-center justify-center"
              aria-expanded={isToolbarExpanded}
              aria-label={isToolbarExpanded ? "Close formatting options" : "Open formatting options"}
            >
              <PlusIcon className={cn("h-5 w-5 text-primary transition-transform duration-200 ease-in-out", isToolbarExpanded && "rotate-45")} />
            </Button>

            {isToolbarExpanded && (
              <div
                className="bg-card border p-0.5 rounded-full shadow-lg flex items-center space-x-0.5 ml-1 animate-in fade-in-50 slide-in-from-left-2 duration-200"
              >
                <button onClick={handleInsertImage} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert image" title="Insert image from URL">
                  <ImageIcon className={iconClass} />
                </button>
                <button onClick={handleInsertYouTubeVideo} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert YouTube video" title="Insert YouTube video">
                  <YoutubeIcon className={iconClass} />
                </button>
                <button onClick={handleInsertEmbed} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert embed" title="Insert embed (e.g., Twitter, Vimeo)">
                  <Link2Icon className={iconClass} />
                </button>
                <button onClick={handleInsertCodeBlock} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert code block" title="Insert code block">
                  <SquareCodeIcon className={iconClass} />
                </button>
                <button onClick={handleInsertSeparator} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert line separator" title="Insert line separator">
                  <MinusIcon className={iconClass} />
                </button>
              </div>
            )}
          </div>
        )}
        
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
              updateCursorPosition();
            }}
            onFocus={() => handleFocus('title')}
            onBlur={handleBlur}
            onKeyUp={updateCursorPosition} // Ensure cursorPosition updates on keyup
            onClick={updateCursorPosition} // Ensure cursorPosition updates on click
            className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"
            autoComplete="off"
          />
          {publishAttempted && titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
        </div>
        
        <div ref={contentWrapperRef} className="relative">
          <div
            ref={contentEditableRef}
            contentEditable={true}
            onInput={handleContentEditableInput}
            onFocus={() => handleFocus('content')}
            onBlur={handleBlur}
            onKeyDown={handleContentKeyDown} // Keep for Enter key
            onClick={updateCursorPosition} // Keep for caret positioning by click
            onKeyUp={updateCursorPosition} // Keep for caret positioning by key
            data-placeholder="Tell your story..."
            className={cn(
              "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case",
              "focus:outline-none min-h-[150px]"
            )}
            style={{
              fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
              fontSize: "20px",
              lineHeight: "1.6", 
              color: "hsl(var(--foreground))",
            }}
            role="textbox"
            aria-multiline="true"
            aria-label="News article content"
            suppressContentEditableWarning={true}
            // No dangerouslySetInnerHTML or direct children for content, managed by onInput
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:empty:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child > br:only-child:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:has(br:only-child):before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none; 
            display: block; /* Ensures the placeholder is treated as a block */
            position: absolute; /* Position relative to the contentEditable div */
            top: 0.5rem; /* Adjust as needed based on padding */
            left: 0; /* Adjust as needed based on padding */
          }
           /* Hide placeholder when contentEditable is not visually empty */
           div[contentEditable="true"][data-placeholder]:not(:empty):before,
           div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:empty):before,
           div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:has(br:only-child)):before {
             content: none;
           }
            /* Styling for inserted elements */
            div[contentEditable="true"] figure { margin-left: auto; margin-right: auto; max-width: 100%; }
            div[contentEditable="true"] figure img, 
            div[contentEditable="true"] figure iframe { display: block; margin-left: auto; margin-right: auto; max-width: 100%; border-radius: 0.25rem; }
            div[contentEditable="true"] figure figcaption { text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem; margin-top: 0.25rem; }
            div[contentEditable="true"] figure figcaption:empty:before { content: attr(data-placeholder); color: hsl(var(--muted-foreground) / 0.7); }
            div[contentEditable="true"] pre { background-color: hsl(var(--muted)); color: hsl(var(--muted-foreground)); padding: 1rem; border-radius: 0.375rem; overflow-x: auto; font-family: monospace; font-size: 0.875rem; line-height: 1.25rem; white-space: pre-wrap; word-wrap: break-word; }
            div[contentEditable="true"] pre code { display: block; white-space: pre-wrap !important; word-wrap: break-word !important; outline: none; }
            div[contentEditable="true"] hr { border-color: hsl(var(--border)); margin-top: 2rem; margin-bottom: 2rem; }
        `}</style>
      </div>
    </div>
  );
};

export default CreateNewsArticlePage;
        
      

```