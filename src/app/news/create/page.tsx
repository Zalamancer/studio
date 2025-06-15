
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

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
const TOOLBAR_HORIZONTAL_OFFSET = 40; 

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [storyContent, setStoryContent] = useState("<p><br></p>"); 

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
  const inlineImageInputRef = useRef<HTMLInputElement>(null);
  const toolbarWrapperRef = useRef<HTMLDivElement>(null);

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [selectionNonce, setSelectionNonce] = useState(0);
  const [savedRange, setSavedRange] = useState<Range | null>(null); // To store selection before dialogs

  const [showContextualUI, setShowContextualUI] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute' });
  
  const [isYouTubeDialogOpen, setIsYouTubeDialogOpen] = useState(false);
  const [youTubeUrlInput, setYouTubeUrlInput] = useState("");
  const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false);
  const [embedCodeInput, setEmbedCodeInput] = useState("");

  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML.trim() === "") {
      contentEditableRef.current.innerHTML = "<p><br></p>";
    }
  }, []);

  const updateSelectionNonce = useCallback(() => {
    setSelectionNonce(n => n + 1);
  }, []);

  const getCurrentBlockElement = useCallback((): HTMLElement | null => {
    const contentEl = contentEditableRef.current;
    if (!contentEl) return null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      if (document.activeElement === contentEl && contentEl.lastChild && contentEl.lastChild.nodeType === Node.ELEMENT_NODE) {
        return contentEl.lastChild as HTMLElement;
      }
      const firstChildBlockFallback = contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr');
      return firstChildBlockFallback ? firstChildBlockFallback as HTMLElement : contentEl;
    }

    let node = selection.focusNode;
    if (!node || !contentEl.contains(node)) {
        if (document.activeElement === contentEl && contentEl.firstChild && contentEl.firstChild.nodeType === Node.ELEMENT_NODE) {
            return contentEl.firstChild as HTMLElement;
        }
        const firstChildBlock = contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr');
        return firstChildBlock ? firstChildBlock as HTMLElement : contentEl;
    }
    
    while (node && node !== contentEl) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'figure', 'hr'].includes(tagName)) {
          if (contentEl.contains(element)) return element;
        }
      }
      node = node.parentNode;
    }
    const firstChildBlockFinal = contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr');
    return firstChildBlockFinal ? firstChildBlockFinal as HTMLElement : contentEl;
  }, [contentEditableRef]);


  const getCurrentLineText = useCallback((): string => {
    const contentEl = contentEditableRef.current;
    if (focusedField === 'title' && titleInputRef.current) {
      return titleInputRef.current.value.trim();
    }
    if (focusedField === 'content' && contentEl) {
      const currentBlock = getCurrentBlockElement();
      if (currentBlock) {
        if (currentBlock.tagName === 'PRE' && currentBlock.textContent?.trim() !== '') return 'PRE_HAS_CONTENT';
        if (currentBlock.tagName === 'FIGURE' && (currentBlock.querySelector('img') || currentBlock.querySelector('iframe'))) return 'FIGURE_HAS_CONTENT';
        if (currentBlock.tagName === 'DIV' && currentBlock.hasAttribute('data-embed-wrapper')) return 'EMBED_HAS_CONTENT';
        if (currentBlock.tagName === 'HR') return 'HR_HAS_CONTENT';
        return currentBlock.textContent?.trim() || "";
      }
      if (contentEl.innerHTML.trim() === "" || contentEl.innerHTML.trim() === "<br>") return "EDITOR_IS_EMPTY";
      return "NO_CURRENT_BLOCK_FOUND";
    }
    return "NO_FOCUS_OR_UNHANDLED_FIELD";
  }, [focusedField, getCurrentBlockElement, titleInputRef, contentEditableRef]);
  
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
    let shouldShowBaseUI = false;
    const currentLineText = getCurrentLineText();
    const lineIsEmpty = currentLineText === "" || currentLineText === "EDITOR_IS_EMPTY" || currentLineText === "NO_CURRENT_BLOCK_FOUND";

    if (focusedField && (document.activeElement === titleInputRef.current || document.activeElement === contentEditableRef.current)) {
      const lineYOffsetClient = calculateCursorLineYOffset();
      if (lineYOffsetClient !== null) {
        let referenceElementRect: DOMRect | undefined;
        if (focusedField === 'title' && titleWrapperRef.current) referenceElementRect = titleWrapperRef.current.getBoundingClientRect();
        else if (focusedField === 'content' && contentWrapperRef.current) referenceElementRect = contentWrapperRef.current.getBoundingClientRect();
        
        if (referenceElementRect && formWrapperRef.current) {
          const formRect = formWrapperRef.current.getBoundingClientRect();
          const newLeft = referenceElementRect.left - formRect.left - TOOLBAR_HORIZONTAL_OFFSET;
          const newTop = lineYOffsetClient - formRect.top - (TOOLBAR_HEIGHT / 2);
          setToolbarStyle({ top: `${newTop}px`, left: `${newLeft}px`, zIndex: 50, position: 'absolute' });
        }
        if (lineIsEmpty || isToolbarExpanded) shouldShowBaseUI = true;
      }
    }
    setShowContextualUI(shouldShowBaseUI);
    if (!shouldShowBaseUI && isToolbarExpanded) setIsToolbarExpanded(false);
  }, [focusedField, getCurrentLineText, isToolbarExpanded, calculateCursorLineYOffset, titleInputRef, contentEditableRef, titleWrapperRef, contentWrapperRef, formWrapperRef]);

  useEffect(() => {
    calculateAndUpdateToolbarStyle();
  }, [focusedField, title, storyContent, selectionNonce, isToolbarExpanded, calculateAndUpdateToolbarStyle]);

  useEffect(() => {
    const handleSelectionOrKey = () => {
      if (document.activeElement === contentEditableRef.current || document.activeElement === titleInputRef.current) {
        updateSelectionNonce();
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
  }, [updateSelectionNonce]);


  const handleFocus = useCallback((field: 'title' | 'content') => {
    setFocusedField(field);
  }, []);

  const handleBlur = useCallback(() => {
    queueMicrotask(() => {
      const activeEl = document.activeElement;
      let isFocusWithinToolbarOrInput = false;
      if ((toolbarWrapperRef.current && toolbarWrapperRef.current.contains(activeEl)) || 
          titleInputRef.current === activeEl || 
          contentEditableRef.current === activeEl || 
          isYouTubeDialogOpen || isEmbedDialogOpen) { // Include dialog states
        isFocusWithinToolbarOrInput = true;
      }
      if (!isFocusWithinToolbarOrInput) {
        setFocusedField(null);
        setIsToolbarExpanded(false); 
        setShowContextualUI(false);
        setSavedRange(null); // Clear saved range on blur if dialogs aren't open
      }
    });
  }, [isYouTubeDialogOpen, isEmbedDialogOpen]);


  const handleContentEditableInput = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => {
    const currentHTML = event.currentTarget.innerHTML;
    if (currentHTML.trim() === "" || currentHTML.trim() === "<br>" || currentHTML.trim() === "<p><br></p>" || currentHTML.trim() === "<p></p>") {
      setStoryContent("<p><br></p>");
    } else {
      setStoryContent(currentHTML);
    }
    if (publishAttempted) {
      const currentText = event.currentTarget.textContent || "";
      if (currentText.trim() || /<img|<figure|<video|<pre|<hr/i.test(currentHTML)) setStoryError("");
      else setStoryError("Story content is required.");
    }
    updateSelectionNonce();
  }, [publishAttempted, setStoryError, updateSelectionNonce]);


  const handleContentKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault(); 
      document.execCommand('insertParagraph', false, undefined); 
      setTimeout(() => {
        if (contentEditableRef.current) {
          setStoryContent(contentEditableRef.current.innerHTML);
          updateSelectionNonce();
        }
      }, 0);
    }
  }, [updateSelectionNonce]);


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
      else if (!category) { /* No direct focus for select */ }
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
      const pTag = contentEditableRef.current.querySelector('p');
      if (pTag) {
        const range = document.createRange(); const sel = window.getSelection();
        try { range.setStart(pTag, 0); range.collapse(true); sel?.removeAllRanges(); sel?.addRange(range); } catch (e) {}
      }
    }
    setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
    setIsToolbarExpanded(false); 
    setShowContextualUI(false); 
    updateSelectionNonce();
  };
  
  const insertHTMLAndFocus = useCallback((htmlToInsert: string) => {
    const editorEl = contentEditableRef.current;
    if (!editorEl) return;
     // No need to check focusedField here, as we use savedRange or current focus
    
    editorEl.focus(); // Ensure editor has focus for selection manipulation

    queueMicrotask(() => { // Use microtask to operate after focus/selection updates
      const selection = window.getSelection();
      let range: Range;

      if (savedRange && editorEl.contains(savedRange.commonAncestorContainer)) {
        range = savedRange;
        if (selection) { // Restore the selection to the saved range
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else if (selection && selection.rangeCount > 0 && editorEl.contains(selection.getRangeAt(0).commonAncestorContainer)) {
        range = selection.getRangeAt(0); // Use current selection if it's within the editor
      } else {
        // Fallback: selection is outside, or no selection create range at the end of editor
        range = document.createRange();
        range.selectNodeContents(editorEl);
        range.collapse(false); // to the end
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      setSavedRange(null); // Clear saved range after use or if it was invalid

      const currentBlock = getCurrentBlockElement();
      if (currentBlock && editorEl.contains(currentBlock) &&
          (currentBlock.textContent?.trim() === "" || currentBlock.innerHTML.toLowerCase() === "<br>" || currentBlock.innerHTML.toLowerCase() === "<p></p>" || currentBlock.innerHTML.toLowerCase() === "&nbsp;")) {
        if (range.collapsed && (currentBlock.isSameNode(range.startContainer) || currentBlock.contains(range.startContainer))) {
          const isEditorAndEmpty = currentBlock.isSameNode(editorEl) && editorEl.innerHTML.trim().match(/^($|<br\s*\/?>)$/i);
          if (!isEditorAndEmpty || (isEditorAndEmpty && range.startOffset === 0 && range.endOffset === 0 && editorEl.childNodes.length <= 1)) {
            range.selectNodeContents(currentBlock);
          }
        }
      }

      if (!range.collapsed) {
        range.deleteContents();
      }

      const fragment = range.createContextualFragment(htmlToInsert);
      // Find the last <p> in the fragment, this is where the caret should go.
      // All our inserted HTML should end with <p><br></p>
      let lastParagraphInFragment: Node | null = null;
      if (fragment.lastChild && fragment.lastChild.nodeName === 'P') {
        lastParagraphInFragment = fragment.lastChild;
      } else {
        // This is a fallback, should not happen if htmlToInsert is correct
        const tempP = document.createElement('p');
        tempP.innerHTML = '<br>';
        fragment.appendChild(tempP);
        lastParagraphInFragment = tempP;
      }
      
      range.insertNode(fragment);

      if (lastParagraphInFragment && editorEl.contains(lastParagraphInFragment)) {
        const pElement = lastParagraphInFragment as HTMLParagraphElement;
        if (pElement.innerHTML.trim() === "") pElement.innerHTML = "<br>"; // Ensure caret visibility
        range.setStart(pElement, 0);
        range.collapse(true);
      } else {
         // Fallback if lastParagraphInFragment somehow isn't what we expect
         range.selectNodeContents(editorEl);
         range.collapse(false); // To the end
      }
      
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      setStoryContent(editorEl.innerHTML);
      setIsToolbarExpanded(false);
      
      setTimeout(() => { // Another timeout to ensure DOM update before re-focus/nonce
        editorEl.focus();
        updateSelectionNonce();
      }, 0);
    });
  }, [getCurrentBlockElement, updateSelectionNonce, contentEditableRef, setStoryContent, setIsToolbarExpanded, savedRange]); // Removed focusedField
  
  const triggerInlineImageUpload = useCallback(() => {
    const selection = window.getSelection(); // Save selection before dialog/input
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      setSavedRange(selection.getRangeAt(0).cloneRange());
    } else {
      const editorEl = contentEditableRef.current;
      if (editorEl) {
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        range.collapse(false);
        setSavedRange(range);
      } else {
        setSavedRange(null);
      }
    }
    if (inlineImageInputRef.current) inlineImageInputRef.current.click();
  }, []);

  const handleInlineImageFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        insertHTMLAndFocus(
          `<figure class="my-4 flex flex-col items-center" contenteditable="false"><img src="${dataUri}" alt="User uploaded image" style="max-width: 100%; height: auto; display: block; border-radius: 0.25rem; margin-bottom: 0.5rem;" data-ai-hint="user uploaded" /><figcaption contenteditable="true" data-placeholder="Optional caption..." style="text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem;" class="w-full"></figcaption></figure><p><br></p>`
        );
      };
      reader.readAsDataURL(file);
      if (inlineImageInputRef.current) inlineImageInputRef.current.value = ''; 
    }
    setSavedRange(null); // Clear saved range after processing
  }, [insertHTMLAndFocus]);
  
  const handleInsertYouTubeVideo = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      setSavedRange(selection.getRangeAt(0).cloneRange());
    } else {
      const editorEl = contentEditableRef.current;
      if (editorEl) {
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        range.collapse(false);
        setSavedRange(range);
      } else {
        setSavedRange(null);
      }
    }
    setIsYouTubeDialogOpen(true);
    setYouTubeUrlInput("");
    setIsToolbarExpanded(false);
  }, []);

  const handleYouTubeDialogSubmit = () => {
    if (youTubeUrlInput) {
      let videoId = '';
      try {
        const urlObj = new URL(youTubeUrlInput);
        if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.substring(1);
        else if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) videoId = urlObj.searchParams.get('v')!;
        else videoId = youTubeUrlInput;
      } catch (e) { videoId = youTubeUrlInput; }
      if (videoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
        insertHTMLAndFocus(
          `<figure class="my-4 relative" contenteditable="false" style="padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 0.25rem;" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure><p><br></p>`
        );
      } else {
        toast({ variant: 'destructive', title: 'Invalid YouTube URL/ID', description: 'Please enter a valid YouTube video URL or ID.' });
      }
    }
    setIsYouTubeDialogOpen(false);
    setSavedRange(null);
  };

  const handleOpenEmbedDialog = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      setSavedRange(selection.getRangeAt(0).cloneRange());
    } else {
      const editorEl = contentEditableRef.current;
      if (editorEl) {
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        range.collapse(false);
        setSavedRange(range);
      } else {
        setSavedRange(null);
      }
    }
    setIsEmbedDialogOpen(true);
    setEmbedCodeInput("");
    setIsToolbarExpanded(false);
  }, []);

  const handleEmbedDialogSubmit = () => {
    if (embedCodeInput) {
      const sanitizedCode = embedCodeInput.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      if (sanitizedCode.trim()) {
        insertHTMLAndFocus(`<div class="my-4" data-embed-wrapper="true" contenteditable="false">${sanitizedCode}</div><p><br></p>`);
      } else {
        toast({ variant: 'destructive', title: 'Invalid Embed Code', description: 'Please provide valid embed code (e.g., an iframe).' });
      }
    }
    setIsEmbedDialogOpen(false);
    setSavedRange(null);
  };

  const handleInsertCodeBlock = useCallback(() => {
    const selection = window.getSelection(); // Capture selection before direct insertion
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      setSavedRange(selection.getRangeAt(0).cloneRange());
    } else {
      const editorEl = contentEditableRef.current;
      if (editorEl) {
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        range.collapse(false);
        setSavedRange(range);
      } else {
        setSavedRange(null);
      }
    }
    insertHTMLAndFocus(`<pre class="my-4 p-3 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm" style="white-space: pre-wrap; word-wrap: break-word;" contenteditable="true"><code class="language-plaintext" style="display: block;">\n// Your code here...\n\n</code></pre><p><br></p>`);
  }, [insertHTMLAndFocus]);
  
  const handleInsertSeparator = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      setSavedRange(selection.getRangeAt(0).cloneRange());
    } else {
      const editorEl = contentEditableRef.current;
      if (editorEl) {
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        range.collapse(false);
        setSavedRange(range);
      } else {
        setSavedRange(null);
      }
    }
    insertHTMLAndFocus(`<hr class="my-8 border-border" /><p><br></p>`);
  }, [insertHTMLAndFocus]);
  
  const handleToggleToolbar = () => {
    setIsToolbarExpanded(prev => {
      const newExpandedState = !prev;
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
    <>
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div ref={formWrapperRef} className="max-w-3xl mx-auto relative pt-5"> 
        
        {showContextualUI && (
          <div ref={toolbarWrapperRef} style={toolbarStyle} className="flex items-center space-x-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleToggleToolbar}
              onMouseDown={(e) => e.preventDefault()}
              className="p-0 bg-card border rounded-full shadow-lg hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary h-9 w-9 z-10 flex items-center justify-center"
              aria-expanded={isToolbarExpanded}
              aria-label={isToolbarExpanded ? "Close formatting options" : "Open formatting options"}
            >
              <PlusIcon className={cn("h-5 w-5 text-primary transition-transform duration-200 ease-in-out", isToolbarExpanded && "rotate-45")} />
            </Button>

            {isToolbarExpanded && (
              <div className="bg-card border p-0.5 rounded-full shadow-lg flex items-center space-x-0.5 ml-1 animate-in fade-in-50 slide-in-from-left-2 duration-200">
                <button onClick={triggerInlineImageUpload} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert image" title="Upload image"><ImageIcon className={iconClass} /></button>
                <button onClick={handleInsertYouTubeVideo} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert YouTube video" title="Insert YouTube video"><YoutubeIcon className={iconClass} /></button>
                <button onClick={handleOpenEmbedDialog} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert embed" title="Insert embed (e.g., Twitter, Vimeo)"><Link2Icon className={iconClass} /></button>
                <button onClick={handleInsertCodeBlock} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert code block" title="Insert code block"><SquareCodeIcon className={iconClass} /></button>
                <button onClick={handleInsertSeparator} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert line separator" title="Insert line separator"><MinusIcon className={iconClass} /></button>
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
           <div className="flex items-center gap-2 mr-auto"> 
            <div className="space-y-1">
              <Select onValueChange={(value) => { setCategory(value); if (publishAttempted) { if (value) setCategoryError(""); else setCategoryError("Category is required."); }}} value={category}>
                <SelectTrigger className="text-xs py-1.5 h-9 w-auto min-w-[140px] sm:w-[160px] focus-visible:ring-0 focus-visible:ring-offset-0"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{newsCategories.map((cat) => (<SelectItem key={cat} value={cat} className="text-sm">{cat}</SelectItem>))}</SelectContent>
              </Select>
              {publishAttempted && categoryError && <p className="text-xs text-destructive mt-1">{categoryError}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => coverImageInputRef.current?.click()} className="text-xs py-1.5 h-9">
              <ImageUp className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cover Image</span><span className="sm:hidden">Image</span>
            </Button>
            <Input id="article-image-input-header" type="file" accept="image/*" className="hidden" ref={coverImageInputRef} />
            <input type="file" ref={inlineImageInputRef} onChange={handleInlineImageFileChange} accept="image/*" style={{ display: 'none' }} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked")} className="text-xs py-1.5 h-9 rounded-full"><Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft</Button>
            <Button type="button" onClick={handlePublish} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full"><Send className="mr-1.5 h-3.5 w-3.5" /> Publish</Button>
          </div>
        </div>
        
        <div ref={titleWrapperRef} className="relative mb-4">
          <Input ref={titleInputRef} placeholder="Title" value={title} onChange={(e) => { setTitle(e.target.value); if (publishAttempted) { if (e.target.value.trim()) setTitleError(""); else setTitleError("Title is required."); } updateSelectionNonce(); }} onFocus={() => handleFocus('title')} onBlur={handleBlur} onKeyUp={updateSelectionNonce} onClick={updateSelectionNonce} className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2" autoComplete="off" />
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
            onClick={updateSelectionNonce} 
            onKeyUp={updateSelectionNonce}  
            data-placeholder="Tell your story..."
            className={cn("w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case", "focus:outline-none min-h-[150px]")}
            style={{ fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif", fontSize: "20px", lineHeight: "1.6", color: "hsl(var(--foreground))", direction: 'ltr' }}
            role="textbox"
            aria-multiline="true"
            aria-label="News article content"
            suppressContentEditableWarning={true}
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:empty:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child > br:only-child:before,
          div[contentEditable="true"][data-placeholder] > p:first-child:last-child:has(br:only-child):before { content: attr(data-placeholder); color: hsl(var(--muted-foreground) / 0.5); pointer-events: none; display: block; position: absolute; top: 0.5rem; left: 0; }
           div[contentEditable="true"][data-placeholder]:not(:empty):before,
           div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:empty):before,
           div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:has(br:only-child)):before { content: none; }
            div[contentEditable="true"] figure { margin-left: auto; margin-right: auto; max-width: 100%; }
            div[contentEditable="true"] figure img, div[contentEditable="true"] figure iframe { display: block; margin-left: auto; margin-right: auto; max-width: 100%; border-radius: 0.25rem; }
            div[contentEditable="true"] figure figcaption { text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem; margin-top: 0.25rem; }
            div[contentEditable="true"] figure figcaption:empty:before { content: attr(data-placeholder); color: hsl(var(--muted-foreground) / 0.7); }
            div[contentEditable="true"] pre { background-color: hsl(var(--muted)); color: hsl(var(--muted-foreground)); padding: 1rem; border-radius: 0.375rem; overflow-x: auto; font-family: monospace; font-size: 0.875rem; line-height: 1.25rem; white-space: pre-wrap; word-wrap: break-word; }
            div[contentEditable="true"] pre code { display: block; white-space: pre-wrap !important; word-wrap: break-word !important; outline: none; }
            div[contentEditable="true"] hr { border-color: hsl(var(--border)); margin-top: 2rem; margin-bottom: 2rem; }
            div[contentEditable="true"] div[data-embed-wrapper] { margin: 1rem 0; position: relative; }
            div[contentEditable="true"] div[data-embed-wrapper] > * { max-width: 100%; display: block; margin-left: auto; margin-right: auto; }
        `}</style>
      </div>
    </div>

    <Dialog open={isYouTubeDialogOpen} onOpenChange={(open) => { setIsYouTubeDialogOpen(open); if (!open) setSavedRange(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Embed YouTube Video</DialogTitle><DialogDescription>Paste the YouTube video URL or video ID below.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="youtube-url" className="text-right col-span-1">URL/ID</Label><Input id="youtube-url" value={youTubeUrlInput} onChange={(e) => setYouTubeUrlInput(e.target.value)} className="col-span-3" placeholder="e.g., https://www.youtube.com/watch?v=VIDEO_ID" /></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => {setIsYouTubeDialogOpen(false); setSavedRange(null);}}>Cancel</Button><Button type="button" onClick={handleYouTubeDialogSubmit}>Embed Video</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmbedDialogOpen} onOpenChange={(open) => { setIsEmbedDialogOpen(open); if (!open) setSavedRange(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Embed External Content</DialogTitle><DialogDescription>Paste your embed code (e.g., from Twitter, Vimeo, etc.). Ensure it&apos;s safe, typically iframe-based.</DialogDescription></DialogHeader>
          <div className="py-4"><Label htmlFor="embed-code" className="sr-only">Embed Code</Label><Textarea id="embed-code" value={embedCodeInput} onChange={(e) => setEmbedCodeInput(e.target.value)} className="min-h-[150px] font-mono text-xs" placeholder="<iframe src='...'></iframe>" /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => {setIsEmbedDialogOpen(false); setSavedRange(null);}}>Cancel</Button><Button type="button" onClick={handleEmbedDialogSubmit}>Embed Content</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateNewsArticlePage;
        
      

