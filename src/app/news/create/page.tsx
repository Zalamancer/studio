
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
import { Loader2, Save, Send, ImageUp, XIcon, ImageIcon, YoutubeIcon, Link2Icon, SquareCodeIcon, MinusIcon } from 'lucide-react';
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
const TOOLBAR_WIDTH_WITH_OFFSET = 80; // How far left of the input field the toolbar should appear

interface InlineToolbarProps {
  style: React.CSSProperties;
  onClose: () => void;
  onInsertImage: () => void;
  onInsertYouTubeVideo: () => void;
  onInsertEmbed: () => void;
  onInsertCodeBlock: () => void;
  onInsertSeparator: () => void;
}

const InlineToolbar: React.FC<InlineToolbarProps> = ({
  style,
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
      style={style}
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
  const isMobileHook = useIsMobile();

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
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute', zIndex: 50 });
  const [showToolbar, setShowToolbar] = useState(false);

  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML.trim() === "") {
      contentEditableRef.current.innerHTML = "<p><br></p>"; // Ensure initial block structure for new page load
    }
  }, []);


  const updateCursorPosition = useCallback(() => {
    let newPosition = 0;
    const activeEl = document.activeElement;
    const selection = window.getSelection();

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
            newPosition = contentEditableRef.current.textContent?.length || 0;
        }
    } else if (contentEditableRef.current) { // Fallback if no specific selection found in contentEditable
        newPosition = contentEditableRef.current.textContent?.length || 0;
    }
    setCursorPosition(newPosition);
  }, []);


  const getCurrentBlockElement = useCallback((): HTMLElement | null => {
    const selection = window.getSelection();
    const contentEl = contentEditableRef.current;
    if (!contentEl) return null;
    if (!selection || selection.rangeCount === 0) return contentEl.firstChild as HTMLElement || contentEl; // Fallback to first child or contentEl itself

    let node = selection.focusNode;
    if (!node || !contentEl.contains(node)) return contentEl.firstChild as HTMLElement || contentEl;

    while (node && node !== contentEl) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'figure'].includes(tagName)) {
          if (contentEl.contains(element)) return element;
        }
      }
      node = node.parentNode;
    }
    return contentEl.firstChild as HTMLElement || contentEl; // Fallback to first child if no block found (e.g. root focus)
  }, []);

  const getCurrentLineText = useCallback((): string => {
    const currentBlock = getCurrentBlockElement();
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
        return rects[0].top + rects[0].height / 2;
      }
    }

    const currentBlock = getCurrentBlockElement();
    if (currentBlock && currentBlock !== contentEl) { // If we're inside a specific block
      const blockRect = currentBlock.getBoundingClientRect();
      if (blockRect.height > 0) {
         const computedStyle = window.getComputedStyle(currentBlock);
         const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
         let lineHeight = parseFloat(computedStyle.lineHeight);
         if (isNaN(lineHeight) || lineHeight <= 0) { // Ensure lineHeight is positive
            const fontSize = parseFloat(computedStyle.fontSize) || 16; // Default font size
            lineHeight = fontSize * 1.4; // Estimate line height
         }
         return blockRect.top + paddingTop + (lineHeight / 2);
      }
    }

    // Fallback for completely empty contentEditable or when focus is at root
    if (contentEl.textContent?.trim() === "" || (currentBlock === contentEl && (contentEl.innerHTML === "" || contentEl.innerHTML === "<p><br></p>" || contentEl.innerHTML === "<p></p>"))) {
        const mainDivRect = contentEl.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(contentEl);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        let lineHeight = parseFloat(computedStyle.lineHeight);
        if (isNaN(lineHeight) || lineHeight <= 0) {
            const fontSize = parseFloat(computedStyle.fontSize) || 20;
            lineHeight = fontSize * 1.4;
        }
        return mainDivRect.top + paddingTop + (lineHeight / 2);
    }
    return null;
  }, [getCurrentBlockElement]);

  const calculateAndUpdateToolbarStyle = useCallback(() => {
    requestAnimationFrame(() => {
        const formEl = formWrapperRef.current;
        const titleWrapperEl = titleWrapperRef.current;
        const contentWrapperEl = contentWrapperRef.current; // Wrapper around contentEditable for left calculation
        const contentEditableEl = contentEditableRef.current;

        if (!formEl) { setShowToolbar(false); return; }
        const formRect = formEl.getBoundingClientRect();
        let shouldShow = false;
        let newTop = 0;
        let newLeft = 0;

        if (focusedField === 'title' && titleWrapperEl) {
            if (title.trim() === "") {
                const titleRect = titleWrapperEl.getBoundingClientRect();
                newTop = titleRect.top - formRect.top + (titleRect.height / 2) - (TOOLBAR_HEIGHT / 2);
                newLeft = titleRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET;
                shouldShow = true;
            }
        } else if (focusedField === 'content' && contentWrapperEl && contentEditableEl) {
            const currentLine = getCurrentLineText();
            if (currentLine === "") {
                const lineYOffsetClient = calculateCursorLineYOffset();
                if (lineYOffsetClient !== null) {
                    const contentRect = contentWrapperEl.getBoundingClientRect(); // Use wrapper for left
                    newTop = lineYOffsetClient - formRect.top - (TOOLBAR_HEIGHT / 2);
                    newLeft = contentRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET;
                    shouldShow = true;
                }
            }
        }
        
        setShowToolbar(shouldShow);
        if (shouldShow) {
            setToolbarStyle({ top: `${newTop}px`, left: `${newLeft}px`, zIndex: 50, position: 'absolute' });
        }
    });
  }, [focusedField, title, storyContent, cursorPosition, getCurrentLineText, calculateCursorLineYOffset]); // storyContent and cursorPosition re-added


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
    document.addEventListener('click', handleSelectionOrKey); // Click also moves cursor
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
    queueMicrotask(() => { // Delay to allow toolbar button clicks to register
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) return;
      if (titleInputRef.current && titleInputRef.current === document.activeElement) return;
      if (contentEditableRef.current && contentEditableRef.current === document.activeElement) return;
      setFocusedField(null);
      // setShowToolbar(false); // Let calculateAndUpdateToolbarStyle handle this based on focusedField
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
      setTimeout(() => {
        if (contentEditableRef.current) {
          setStoryContent(contentEditableRef.current.innerHTML);
          updateCursorPosition();
          // calculateAndUpdateToolbarStyle will be triggered by state changes
        }
      }, 0);
    }
  }, [updateCursorPosition]);

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); }
    if (!category) { setCategoryError("Category is required."); isValid = false; } else { setCategoryError(""); }
    const currentContentText = contentEditableRef.current?.textContent?.trim() || "";
    const currentContentHTML = contentEditableRef.current?.innerHTML || "";
    if (!currentContentText && !/<img|<figure|<video|<pre|<hr/i.test(currentContentHTML)) {
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
      // Attempt to place cursor in the new empty paragraph
        const pTag = contentEditableRef.current.querySelector('p');
        if (pTag) {
            const range = document.createRange();
            const sel = window.getSelection();
            try {
                range.setStart(pTag, 0); // Or pTag.firstChild if <br> is always there
                range.collapse(true);
                sel?.removeAllRanges();
                sel?.addRange(range);
            } catch (e) {
                // console.warn("Error setting cursor after publish:", e);
            }
        }
    }
    setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
    setCursorPosition(0); // Reset cursor position state
    setFocusedField(null); // This will trigger re-evaluation and hide toolbar
  };

  const handleCloseToolbar = () => {
    setShowToolbar(false); // Explicitly hide
    setFocusedField(null); // Remove focus context so it doesn't reappear immediately
  };

  const insertHTMLAndFocus = useCallback((htmlToInsert: string) => {
    if (!contentEditableRef.current) return;

    contentEditableRef.current.focus(); // Ensure focus before execCommand
    let selection = window.getSelection();
    let range: Range | undefined;

    if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
        if (!contentEditableRef.current.contains(range.startContainer)) {
            range = undefined;
        }
    }
    
    // If no valid range, or if the current block is truly empty, create range there
    if (!range || (getCurrentBlockElement() === contentEditableRef.current && contentEditableRef.current.textContent?.trim() === "")) {
        selection = window.getSelection();
        range = document.createRange();
        const targetNodeForRange = contentEditableRef.current.firstChild || contentEditableRef.current;
        if (targetNodeForRange) {
            try {
                range.selectNodeContents(targetNodeForRange);
                range.collapse(targetNodeForRange.nodeType === Node.TEXT_NODE ? false : (targetNodeForRange.childNodes.length === 0));
            } catch (e) {
                // Fallback if selectNodeContents fails (e.g. on empty text node)
                range.setStart(targetNodeForRange, 0);
                range.collapse(true);
            }
        } else { // If contentEditable is truly empty (no children)
             range.setStart(contentEditableRef.current, 0);
             range.collapse(true);
        }
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    document.execCommand('insertHTML', false, htmlToInsert);

    if (contentEditableRef.current) {
      setStoryContent(contentEditableRef.current.innerHTML); // Update state from DOM
      // Attempt to re-focus and update cursor after DOM change
      contentEditableRef.current.focus();
      updateCursorPosition();
    }
    // The toolbar should naturally hide now because calculateAndUpdateToolbarStyle will re-evaluate
    // and the current line will no longer be empty.
  }, [updateCursorPosition, getCurrentBlockElement]);


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
        else videoId = url;
      } catch (e) { videoId = url; }

      if (videoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
        const html = `<figure class="my-4 relative" style="padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 0.25rem;" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure><p><br></p>`;
        insertHTMLAndFocus(html);
      } else {
        toast({ variant: 'destructive', title: 'Invalid YouTube URL/ID' });
      }
    }
  }, [insertHTMLAndFocus, toast]);

  const handleInsertEmbed = useCallback(() => {
    const embedCode = window.prompt("Paste embed code (e.g., Twitter, Vimeo). Ensure it's iframe-based or similar safe HTML.");
    if (embedCode) {
      const sanitizedCode = embedCode.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      const html = `<div class="my-4" data-embed-wrapper="true">${sanitizedCode}</div><p><br></p>`;
      insertHTMLAndFocus(html);
    }
  }, [insertHTMLAndFocus]);

  const handleInsertCodeBlock = useCallback(() => {
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
      <div ref={formWrapperRef} className="max-w-3xl mx-auto space-y-0 relative">
        
        {showToolbar && (
          <div ref={toolbarRef}>
            <InlineToolbar
              style={toolbarStyle}
              onClose={handleCloseToolbar}
              onInsertImage={handleInsertImage}
              onInsertYouTubeVideo={handleInsertYouTubeVideo}
              onInsertEmbed={handleInsertEmbed}
              onInsertCodeBlock={handleInsertCodeBlock}
              onInsertSeparator={handleInsertSeparator}
            />
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
            onKeyUp={updateCursorPosition} // Update on key up too
            onClick={updateCursorPosition} // Update on click
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
          div[contentEditable="true"][data-placeholder]:empty:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:empty:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:has(br:only-child):before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none; 
            display: block; 
            position: absolute; 
            top: 0.5rem; 
            left: 0; 
          }
           div[contentEditable="true"][data-placeholder]:not(:empty):before,
           div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:empty):before,
           div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:has(br:only-child)):before {
             content: none;
           }
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
                outline: none; 
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
                border-radius: 0.375rem; 
                overflow-x: auto;
                font-family: monospace;
                font-size: 0.875rem; 
                line-height: 1.25rem;
                white-space: pre-wrap; 
                word-wrap: break-word; 
            }
            div[contentEditable="true"] pre code {
                display: block; 
                white-space: pre-wrap !important; 
                word-wrap: break-word !important;
                outline: none;
            }
            div[contentEditable="true"] hr {
                border-color: hsl(var(--border));
                margin-top: 2rem;
                margin-bottom: 2rem;
            }
        `}</style>
      </div>
    </div>
  );
};

export default CreateNewsArticlePage;

