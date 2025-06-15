
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
import { Loader2, Save, Send, ImageUp, XIcon, ImageIcon, YoutubeIcon, Link2Icon, SquareCodeIcon, MinusIcon, PlusIcon } from 'lucide-react';
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
const TOOLBAR_WIDTH_WITH_OFFSET = 80;


interface InlineToolbarProps {
  onClose: () => void;
  onInsertImage: () => void;
  onInsertYouTubeVideo: () => void;
  onInsertEmbed: () => void;
  onInsertCodeBlock: () => void;
  onInsertSeparator: () => void;
}

const InlineToolbar: React.FC<InlineToolbarProps> = ({
  onClose,
  onInsertImage,
  onInsertYouTubeVideo,
  onInsertEmbed,
  onInsertCodeBlock,
  onInsertSeparator,
}) => {
  const buttonClass = "p-2 hover:bg-muted rounded-full focus:outline-none focus:ring-1 focus:ring-primary";
  const iconSize = "h-5 w-5 text-primary";

  return (
    <div
      className="bg-card border p-0.5 rounded-full shadow-lg flex items-center space-x-0.5"
    >
      <button onClick={onClose} onMouseDown={(e) => e.preventDefault()} className={buttonClass} aria-label="Close toolbar" title="Close toolbar">
        <XIcon className={cn(iconSize, "text-muted-foreground hover:text-foreground")} />
      </button>
      <button onClick={onInsertImage} onMouseDown={(e) => e.preventDefault()} className={buttonClass} aria-label="Insert image" title="Insert image from URL">
        <ImageIcon className={iconSize} />
      </button>
      <button onClick={onInsertYouTubeVideo} onMouseDown={(e) => e.preventDefault()} className={buttonClass} aria-label="Insert YouTube video" title="Insert YouTube video">
        <YoutubeIcon className={iconSize} />
      </button>
      <button onClick={onInsertEmbed} onMouseDown={(e) => e.preventDefault()} className={buttonClass} aria-label="Insert embed" title="Insert embed (e.g., Twitter, Vimeo)">
        <Link2Icon className={iconSize} />
      </button>
      <button onClick={onInsertCodeBlock} onMouseDown={(e) => e.preventDefault()} className={buttonClass} aria-label="Insert code block" title="Insert code block">
        <SquareCodeIcon className={iconSize} />
      </button>
      <button onClick={onInsertSeparator} onMouseDown={(e) => e.preventDefault()} className={buttonClass} aria-label="Insert line separator" title="Insert line separator">
        <MinusIcon className={iconSize} />
      </button>
    </div>
  );
};


const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [storyContent, setStoryContent] = useState("<p><br></p>");
  const [cursorPosition, setCursorPosition] = useState(0);

  const [publishAttempted, setPublishAttempted] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [storyError, setStoryError] = useState("");

  const formWrapperRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleWrapperRef = useRef<HTMLDivElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLDivElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute' });
  const [showToolbar, setShowToolbar] = useState(false);
  const [showPlusButton, setShowPlusButton] = useState(false);

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
        // If no selection, and the div is empty or has only <p><br></p>, return the <p> or the div itself.
        if (contentEl.innerHTML === "<p><br></p>" || contentEl.innerHTML === "<p></p>") {
            return contentEl.firstChild as HTMLElement || contentEl;
        }
        return contentEl.firstChild as HTMLElement || contentEl;
    }

    let node = selection.focusNode;
    if (!node || !contentEl.contains(node)) {
      // Fallback if focusNode is somehow outside, or null
      if (contentEl.firstChild) return contentEl.firstChild as HTMLElement;
      return contentEl;
    }
    
    // Traverse up to find the containing block element within contentEditableRef
    while (node && node !== contentEl) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        // More comprehensive list of block-level or paragraph-like elements
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'figure'].includes(tagName)) {
            if (contentEl.contains(element)) return element; // Ensure it's still within our editor
        }
      }
      node = node.parentNode;
    }
    // If no specific block found (e.g., cursor is directly in the contentEditable div itself,
    // or in a text node that's a direct child), return the first child block or the div itself.
    return contentEl.firstChild as HTMLElement || contentEl;
  }, []);


  const getCurrentLineText = useCallback((): string => {
    const contentEl = contentEditableRef.current;
    if (!contentEl || !contentEl.textContent) return "";

    // If focusedField is title, return its value for simplicity
    if (focusedField === 'title' && titleInputRef.current) {
        return titleInputRef.current.value;
    }

    // For contentEditable, we rely on block elements
    if (focusedField === 'content') {
        const currentBlock = getCurrentBlockElement();
        return currentBlock?.textContent?.trim() || "";
    }
    return ""; // Default for other cases or if no focus
  }, [focusedField, getCurrentBlockElement]);


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
        // Fallback if range is not in contentEditable (should be rare if focused)
        newPosition = contentEditableRef.current.textContent?.length || 0;
      }
    } else if (contentEditableRef.current) {
      // If not focused but we need a position (e.g., after programmatic change)
      newPosition = contentEditableRef.current.textContent?.length || 0;
    }
    setCursorPosition(newPosition);
  }, []);

  const calculateCursorLineYOffset = useCallback((): number | null => {
    const contentEl = contentEditableRef.current;
    if (!contentEl) return null;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Try to get client rects from the selection range itself
        const rects = range.getClientRects();
        if (rects.length > 0) {
            return rects[0].top + rects[0].height / 2; // Center of the caret/selection
        }
        // Fallback if range.getClientRects() returns nothing (e.g. collapsed in empty element)
        // Try using the focusNode's parent element if it's a text node
        let container = range.startContainer;
        if (container.nodeType === Node.TEXT_NODE && container.parentElement) {
            container = container.parentElement;
        }
        if (container.nodeType === Node.ELEMENT_NODE && contentEl.contains(container)) {
            const elementRect = (container as HTMLElement).getBoundingClientRect();
            if (elementRect.height > 0) { // Ensure the element has some height
                 // Try to get closer to the actual line
                const tempRange = document.createRange();
                tempRange.selectNodeContents(container as HTMLElement);
                const tempRects = tempRange.getClientRects();
                if(tempRects.length > 0) return tempRects[0].top + tempRects[0].height / 2;
                return elementRect.top + elementRect.height / 2; // Fallback to center of element
            }
        }
    }
    
    // If selection didn't give a Y, try current block
    const currentBlock = getCurrentBlockElement();
    if (currentBlock && currentBlock !== contentEl) { // Ensure it's a child block, not the main div
        const blockRect = currentBlock.getBoundingClientRect();
        if (blockRect.height > 0) { // Only use if the block has rendered height
            const computedStyle = window.getComputedStyle(currentBlock);
            const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
            let lineHeight = parseFloat(computedStyle.lineHeight);
            if (isNaN(lineHeight) || lineHeight <= 0) { // Fallback for lineHeight 'normal'
                const fontSize = parseFloat(computedStyle.fontSize) || 16; // Default font size
                lineHeight = fontSize * 1.4; // Common multiplier for line height
            }
            return blockRect.top + paddingTop + (lineHeight / 2); // Middle of the first line
        }
    }

    // Final fallback: position based on the contentEditable div itself (for very empty states)
    const mainDivRect = contentEl.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(contentEl);
    const paddingTopMain = parseFloat(computedStyle.paddingTop) || 0;
    let lineHeightMain = parseFloat(computedStyle.lineHeight);
    if (isNaN(lineHeightMain) || lineHeightMain <= 0) {
        const fontSizeMain = parseFloat(computedStyle.fontSize) || 20; // Default font size for content area
        lineHeightMain = fontSizeMain * 1.4;
    }
    return mainDivRect.top + paddingTopMain + (lineHeightMain / 2);

  }, [getCurrentBlockElement]);


  const calculateAndUpdateToolbarStyle = useCallback(() => {
    requestAnimationFrame(() => {
      const formEl = formWrapperRef.current;
      const titleWrapperEl = titleWrapperRef.current;
      const contentWrapperEl = contentWrapperRef.current; // Make sure this exists
      const contentEditableEl = contentEditableRef.current; // Make sure this exists

      if (!formEl) {
        setShowToolbar(false);
        setShowPlusButton(false);
        return;
      }

      const formRect = formEl.getBoundingClientRect();
      let shouldShowContextualUI = false;
      let newTop = 0;
      let newLeft = 0;
      let targetLineY: number | null = null;

      if (focusedField === 'title' && titleWrapperEl && titleInputRef.current) {
        if (title.trim() === "") {
          const titleRect = titleWrapperEl.getBoundingClientRect();
          targetLineY = titleRect.top + (titleRect.height / 2); // Center of title input
          newLeft = titleRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET;
          shouldShowContextualUI = true;
        }
      } else if (focusedField === 'content' && contentWrapperEl && contentEditableEl) {
        const currentLineIsEmpty = getCurrentLineText() === "";
        if (currentLineIsEmpty) {
          targetLineY = calculateCursorLineYOffset();
          if (targetLineY !== null) {
            // Get the left edge of the contentWrapper (which contains contentEditable)
            const contentRect = contentWrapperEl.getBoundingClientRect();
            newLeft = contentRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET;
            shouldShowContextualUI = true;
          }
        }
      }
      
      if (shouldShowContextualUI && targetLineY !== null) {
        newTop = targetLineY - formRect.top - (TOOLBAR_HEIGHT / 2);
        setToolbarStyle({ top: `${newTop}px`, left: `${newLeft}px`, zIndex: 50 });
        
        if (showToolbar) { // If full toolbar is meant to be active
            setShowPlusButton(false);
        } else { // Full toolbar is not active (either closed or never opened for this line)
            setShowPlusButton(true); // So show the plus button
            // setShowToolbar(false); // Ensure full toolbar is indeed hidden
        }
      } else {
        setShowToolbar(false);
        setShowPlusButton(false);
      }
    });
  }, [focusedField, title, getCurrentLineText, calculateCursorLineYOffset, showToolbar]); // Added showToolbar

  useEffect(() => {
    calculateAndUpdateToolbarStyle();
  }, [focusedField, title, storyContent, cursorPosition, calculateAndUpdateToolbarStyle, showToolbar]); // showToolbar re-added

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
    // Delay hiding to allow clicks on toolbar/plus button
    queueMicrotask(() => {
      const activeEl = document.activeElement;
      let isInteractiveToolbarElementFocused = false;
      if ((toolbarRef.current && toolbarRef.current.contains(activeEl)) || (plusButtonRef.current && plusButtonRef.current.contains(activeEl))) {
        isInteractiveToolbarElementFocused = true;
      }
      
      // Do not hide if an input within the toolbar or the toolbar itself is focused
      if (titleInputRef.current === activeEl || contentEditableRef.current === activeEl || isInteractiveToolbarElementFocused) {
        return; // Still focused on an editable area or its toolbar
      }
      setFocusedField(null); // No longer focused on title or content (and not on toolbar)
      // setShowToolbar(false); // Explicitly hide full toolbar on blur if not clicking on it
      // setShowPlusButton(false); // Also hide plus button
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
      setTimeout(() => { // Allow DOM to update
        if (contentEditableRef.current) {
          setStoryContent(contentEditableRef.current.innerHTML);
          updateCursorPosition(); // Update cursor after DOM and state change
        }
      }, 0);
    }
  }, [updateCursorPosition]);


  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); }
    if (!category) { setCategoryError("Category is required."); isValid = false; } else { setCategoryError(""); }
    
    const currentBlock = getCurrentBlockElement();
    const currentContentText = currentBlock?.textContent?.trim() || ""; // Use current block's text
    const currentFullContentHTML = contentEditableRef.current?.innerHTML || ""; // Use full HTML for non-text check
    
    if (!currentContentText && !/<img|<figure|<video|<pre|<hr/i.test(currentFullContentHTML)) {
      setStoryError("Story content is required."); isValid = false;
    } else { setStoryError(""); }
    return isValid;
  }, [title, category, getCurrentBlockElement]);


  const handlePublish = () => {
    setPublishAttempted(true);
    if (!validateFields()) {
      if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
      else if (!category) {} // No direct focus target for category select
      else if (contentEditableRef.current && storyError) contentEditableRef.current.focus();
      return;
    }
    // Placeholder for actual publish logic
    console.log("Publishing Article:", { title: title.trim(), category, storyContent });
    toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" would be published.` });
    
    // Reset form
    setTitle(""); setCategory("");
    const initialEmptyContent = "<p><br></p>";
    setStoryContent(initialEmptyContent);
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = initialEmptyContent;
      // Try to reset cursor to the beginning of the empty paragraph
      const pTag = contentEditableRef.current.querySelector('p');
      if (pTag) {
        const range = document.createRange();
        const sel = window.getSelection();
        try {
          range.setStart(pTag, 0); // Set to start of paragraph
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch (e) {
          // console.error("Error setting cursor:", e);
        }
      }
    }
    setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
    setCursorPosition(0); // Reset cursor position state
    setShowToolbar(false); // Hide toolbar
    setShowPlusButton(false); // Hide plus button
    setFocusedField(null); // Unfocus
  };

  const handleCloseToolbar = () => {
    setShowToolbar(false);
    setFocusedField(null); // Explicitly unfocus from the perspective of toolbar logic
    // Plus button visibility will be re-evaluated by calculateAndUpdateToolbarStyle
  };
  
  const handleOpenToolbarFromPlus = () => {
    setShowToolbar(true);
    setShowPlusButton(false); 
    // Ensure focus for toolbar context
    if (focusedField === 'title' && titleInputRef.current) titleInputRef.current.focus();
    else if (focusedField === 'content' && contentEditableRef.current) contentEditableRef.current.focus();
    else if (contentEditableRef.current) contentEditableRef.current.focus(); // Default to content if no specific focus
  };

  const insertHTMLAndFocus = useCallback((htmlToInsert: string) => {
    const targetFieldRef = focusedField === 'title' ? titleInputRef : contentEditableRef;
    if (!targetFieldRef.current) return; // Safety check
  
    targetFieldRef.current.focus(); // Ensure focus before execCommand
  
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // If no selection, create one at the end of the current content or start
      const range = document.createRange();
      range.selectNodeContents(targetFieldRef.current);
      range.collapse(false); // false for end, true for start
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  
    let range = selection.getRangeAt(0);
  
    // Check if the current selection is within the intended editable area
    if (!targetFieldRef.current.contains(range.startContainer)) {
      // If not, reset range to the end of the target field
      range.selectNodeContents(targetFieldRef.current);
      range.collapse(false);
    }
  
    // If a current block is targeted (e.g., an empty <p>) and selection is inside,
    // delete its contents first to replace it, like when adding an image to an empty line.
    const currentBlock = targetFieldRef === contentEditableRef ? getCurrentBlockElement() : null;
    if (currentBlock && range.startContainer !== currentBlock && currentBlock.contains(range.startContainer)) {
      if (currentBlock.textContent?.trim() === "" && currentBlock.innerHTML.toLowerCase() === "<br>") {
        // If it's an empty paragraph with just a <br>, select the whole paragraph to replace it
        range.selectNodeContents(currentBlock);
      }
    }
     // Delete contents of selection if not collapsed
    if (!range.collapsed) {
        range.deleteContents();
    }

  
    document.execCommand('insertHTML', false, htmlToInsert);
  
    // Update React state from the DOM
    if (targetFieldRef === contentEditableRef && contentEditableRef.current) {
      setStoryContent(contentEditableRef.current.innerHTML);
      // Re-focus and attempt to place cursor after inserted content
      contentEditableRef.current.focus(); 
      // More robust cursor placement might be needed depending on browser inconsistencies
    } else if (targetFieldRef === titleInputRef && titleInputRef.current) {
      // For input, directly setting value and dispatching input event is more reliable
      // However, execCommand might have worked for title, check if title needs this or direct manipulation
      // For simplicity, assume execCommand worked or title doesn't use this path for complex HTML.
      // If title needs direct manipulation:
      // titleInputRef.current.value = titleInputRef.current.value + htmlToInsert; // Or more complex logic
      // setTitle(titleInputRef.current.value);
      // titleInputRef.current.focus();
    }
    updateCursorPosition(); // This will trigger toolbar style recalculation
    // setShowToolbar(false); // Let calculateAndUpdateToolbarStyle decide based on new content
    // setFocusedField(null); // Let blur handler or next focus decide
  }, [focusedField, getCurrentBlockElement, updateCursorPosition]);


  const handleInsertImage = useCallback(() => {
    const url = window.prompt("Enter image URL:");
    if (url) {
      const html = `<figure class="my-4 flex flex-col items-center"><img src="${encodeURI(url)}" alt="User inserted image" style="max-width: 100%; height: auto; display: block; border-radius: 0.25rem; margin-bottom: 0.5rem;" /><figcaption contenteditable="true" data-placeholder="Optional caption..." style="text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem;" class="w-full"></figcaption></figure><p><br></p>`;
      insertHTMLAndFocus(html);
    }
  }, [insertHTMLAndFocus]);

  const handleInsertYouTubeVideo = useCallback(() => {
    const url = window.prompt("Enter YouTube video URL or ID:");
    if (url) {
      let videoId = '';
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.substring(1);
        else if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) videoId = urlObj.searchParams.get('v')!;
        else videoId = url; // Assume it's an ID if parsing fails or not a standard YouTube URL
      } catch (e) { videoId = url; } // If URL parsing fails, assume it's an ID

      if (videoId.match(/^[a-zA-Z0-9_-]{11}$/)) { // Basic YouTube ID validation
        const html = `<figure class="my-4 relative" style="padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 0.25rem;" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure><p><br></p>`;
        insertHTMLAndFocus(html);
      } else {
        toast({ variant: 'destructive', title: 'Invalid YouTube URL/ID', description: 'Please provide a valid YouTube video URL or ID.' });
      }
    }
  }, [insertHTMLAndFocus, toast]);

  const handleInsertEmbed = useCallback(() => {
    const embedCode = window.prompt("Paste embed code (e.g., Twitter, Vimeo). Ensure it's iframe-based or similar safe HTML.");
    if (embedCode) {
      // Basic sanitization: remove script tags. For production, use a proper HTML sanitizer.
      const sanitizedCode = embedCode.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      const html = `<div class="my-4" data-embed-wrapper="true">${sanitizedCode}</div><p><br></p>`;
      insertHTMLAndFocus(html);
    }
  }, [insertHTMLAndFocus]);

  const handleInsertCodeBlock = useCallback(() => {
    // Insert a preformatted block. User can then type or paste code into it.
    const html = `<pre class="my-4 p-3 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm" style="white-space: pre-wrap; word-wrap: break-word;" contenteditable="true"><code class="language-plaintext" style="display: block;">\n// Your code here...\n\n</code></pre><p><br></p>`;
    insertHTMLAndFocus(html);
  }, [insertHTMLAndFocus]);

  const handleInsertSeparator = useCallback(() => {
    const html = `<hr class="my-8 border-border" /><p><br></p>`;
    insertHTMLAndFocus(html);
  }, [insertHTMLAndFocus]);


  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div ref={formWrapperRef} className="max-w-3xl mx-auto relative pt-5">
        
        {showToolbar && (
          <div ref={toolbarRef} style={{...toolbarStyle, position: 'absolute'}}>
            <InlineToolbar
              onClose={handleCloseToolbar}
              onInsertImage={handleInsertImage}
              onInsertYouTubeVideo={handleInsertYouTubeVideo}
              onInsertEmbed={handleInsertEmbed}
              onInsertCodeBlock={handleInsertCodeBlock}
              onInsertSeparator={handleInsertSeparator}
            />
          </div>
        )}

        {!showToolbar && showPlusButton && (
             <div ref={plusButtonRef} style={{...toolbarStyle, position: 'absolute'}}>
                <button
                    onClick={handleOpenToolbarFromPlus}
                    onMouseDown={(e) => e.preventDefault()}
                    className="p-2 bg-card border rounded-full shadow-lg hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Open formatting toolbar"
                    title="Open formatting toolbar"
                >
                    <PlusIcon className="h-5 w-5 text-primary" />
                </button>
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
            onKeyUp={updateCursorPosition}
            onClick={updateCursorPosition}
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
              lineHeight: "1.6", 
              color: "hsl(var(--foreground))",
            }}
            role="textbox"
            aria-multiline="true"
            aria-label="News article content"
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        
        <style jsx global>{`
          /* Updated CSS for placeholder when contentEditable has <p><br></p> or <p></p> */
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:empty:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child > br:only-child:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:has(br:only-child):before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none; 
            display: block; 
            position: absolute; /* Ensure it doesn't affect layout */
            top: 0.5rem; /* Adjust as per your py-2 on the contentEditable */
            left: 0;
          }
           /* Hide placeholder if content is not visually empty */
           div[contentEditable="true"][data-placeholder]:not(:empty):before,
           div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:empty):before,
           div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:has(br:only-child)):before {
             content: none;
           }
            /* Styling for embedded content */
            div[contentEditable="true"] figure {
                margin-left: auto;
                margin-right: auto;
                max-width: 100%; 
            }
            div[contentEditable="true"] figure img, 
            div[contentEditable="true"] figure iframe {
                display: block;
                margin-left: auto;
                margin-right: auto;
                max-width: 100%;
                border-radius: 0.25rem; 
            }
            div[contentEditable="true"] figure figcaption {
                text-align: center;
                color: hsl(var(--muted-foreground));
                font-style: italic;
                font-size: 0.9em;
                outline: none; /* Allow editing without visual focus ring on caption itself */
                padding: 0.25rem;
                margin-top: 0.25rem;
            }
            div[contentEditable="true"] figure figcaption:empty:before {
                content: attr(data-placeholder);
                color: hsl(var(--muted-foreground) / 0.7);
            }
            div[contentEditable="true"] pre {
                background-color: hsl(var(--muted));
                color: hsl(var(--muted-foreground));
                padding: 1rem;
                border-radius: 0.375rem; /* Corresponds to rounded-md */
                overflow-x: auto;
                font-family: monospace;
                font-size: 0.875rem; /* text-sm */
                line-height: 1.25rem; /* For text-sm */
                white-space: pre-wrap; /* Allow wrapping within pre */
                word-wrap: break-word; /* Break long words */
            }
            div[contentEditable="true"] pre code {
                display: block; /* Ensure code takes full width of pre for wrapping */
                white-space: pre-wrap !important; /* Override user-agent styles */
                word-wrap: break-word !important; /* Override user-agent styles */
                outline: none; /* No focus outline on code block itself */
            }
            div[contentEditable="true"] hr {
                border-color: hsl(var(--border));
                margin-top: 2rem; /* my-8 */
                margin-bottom: 2rem; /* my-8 */
            }
        `}</style>
      </div>
    </div>
  );
};

export default CreateNewsArticlePage;

