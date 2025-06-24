
// src/app/news/create/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Send, ImageUp, ImageIcon, YoutubeIcon, Link2Icon, SquareCodeIcon, MinusIcon, PlusIcon, XIcon, Trash2, ArrowLeft, Search, X as CloseIcon, Tag, PlusCircle, MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from '@/components/ui/textarea';
import { createNewsArticle } from '@/services/newsService';
import { uploadNewsCoverImage } from '@/services/storageService';
import type { NewNewsArticleData, NewsArticleStatus } from '@/types/news';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { searchTags } from '@/services/tagService';
import type { ClientTag } from '@/types/tag';

const TOOLBAR_HEIGHT = 36;
const TOOLBAR_HORIZONTAL_OFFSET = 40;

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [storyContent, setStoryContent] = useState("<p><br></p>");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [tagsError, setTagsError] = useState("");
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
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  const [showContextualUI, setShowContextualUI] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute' });

  const [isYouTubeDialogOpen, setIsYouTubeDialogOpen] = useState(false);
  const [youTubeUrlInput, setYouTubeUrlInput] = useState("");
  const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false);
  const [embedCodeInput, setEmbedCodeInput] = useState("");

  // Header Search State
  const [isHeaderSearchActive, setIsHeaderSearchActive] = useState(false);
  const [headerSearchTerm, setHeaderSearchTerm] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<ClientTag[]>([]);
  const [isTagSuggestionsLoading, setIsTagSuggestionsLoading] = useState(false);
  const [isTagSuggestionsPopoverOpen, setIsTagSuggestionsPopoverOpen] = useState(false);
  const headerSearchInputRef = useRef<HTMLInputElement>(null);
  const tagSuggestionsPopoverContentRef = useRef<HTMLDivElement>(null);
  const [debouncedHeaderSearchTerm, setDebouncedHeaderSearchTerm] = useState('');


  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== storyContent) {
      contentEditableRef.current.innerHTML = storyContent;
    }
  }, [storyContent]);

  const updateSelectionNonce = useCallback(() => requestAnimationFrame(() => setSelectionNonce(n => n + 1)), []);

  const getCurrentBlockElement = useCallback((): HTMLElement | null => {
    const contentEl = contentEditableRef.current;
    if (!contentEl) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      if (document.activeElement === contentEl && contentEl.lastChild && contentEl.lastChild.nodeType === Node.ELEMENT_NODE) return contentEl.lastChild as HTMLElement;
      return contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr') as HTMLElement | null || contentEl;
    }
    let node = selection.focusNode;
    if (!node || !contentEl.contains(node)) {
      if (document.activeElement === contentEl && contentEl.firstChild && contentEl.firstChild.nodeType === Node.ELEMENT_NODE) return contentEl.firstChild as HTMLElement;
       return contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr') as HTMLElement | null || contentEl;
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
    return contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr') as HTMLElement | null || contentEl;
  }, [contentEditableRef]);

  const getCurrentLineText = useCallback((): string => {
    const contentEl = contentEditableRef.current;
    if (focusedField === 'title' && titleInputRef.current) return titleInputRef.current.value.trim();
    if (focusedField === 'content' && contentEl) {
      const currentBlock = getCurrentBlockElement();
      if (currentBlock) {
        if (currentBlock.tagName === 'PRE' && currentBlock.textContent?.trim() !== '') return 'PRE_HAS_CONTENT';
        if (currentBlock.tagName === 'FIGURE' && (currentBlock.querySelector('img') || currentBlock.querySelector('iframe'))) return 'FIGURE_HAS_CONTENT';
        if (currentBlock.tagName === 'DIV' && currentBlock.hasAttribute('data-embed-wrapper')) return 'EMBED_HAS_CONTENT';
        if (currentBlock.tagName === 'HR') return 'HR_HAS_CONTENT';
        return currentBlock.textContent?.trim() || "";
      }
      if (contentEl.innerHTML.trim() === "" || contentEl.innerHTML.trim() === "<br>" || contentEl.innerHTML.trim() === "<p><br></p>") return "EDITOR_IS_EMPTY";
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
    let shouldShowPlusButton = false; let shouldShowExpandedToolbar = false;
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
        const currentLineText = getCurrentLineText();
        const lineIsEmpty = currentLineText === "" || currentLineText === "EDITOR_IS_EMPTY" || currentLineText === "NO_CURRENT_BLOCK_FOUND";
        if (lineIsEmpty && !isToolbarExpanded) shouldShowPlusButton = true;
        if (isToolbarExpanded) shouldShowExpandedToolbar = true;
      }
    }
    setShowContextualUI(shouldShowPlusButton || shouldShowExpandedToolbar);
  }, [focusedField, calculateCursorLineYOffset, getCurrentLineText, isToolbarExpanded, titleInputRef, contentEditableRef, titleWrapperRef, contentWrapperRef, formWrapperRef, setToolbarStyle, setShowContextualUI]);

  useEffect(() => { calculateAndUpdateToolbarStyle(); }, [focusedField, selectionNonce, isToolbarExpanded, calculateAndUpdateToolbarStyle]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === contentEditableRef.current || document.activeElement === titleInputRef.current) {
        requestAnimationFrame(updateSelectionNonce);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateSelectionNonce]);

  const handleFocus = useCallback((field: 'title' | 'content') => {
    setFocusedField(field);
    requestAnimationFrame(updateSelectionNonce);
  }, [updateSelectionNonce]);

  const handleBlur = useCallback(() => {
    queueMicrotask(() => {
      const activeEl = document.activeElement;
      if (!((toolbarWrapperRef.current && toolbarWrapperRef.current.contains(activeEl)) || titleInputRef.current === activeEl || contentEditableRef.current === activeEl || isYouTubeDialogOpen || isEmbedDialogOpen)) {
        setFocusedField(null); setIsToolbarExpanded(false); setShowContextualUI(false); setSavedRange(null);
      }
    });
  }, [isYouTubeDialogOpen, isEmbedDialogOpen]);

  const handleContentEditableInput = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => {
    const currentHTML = event.currentTarget.innerHTML;
    if (currentHTML.trim() === "" || currentHTML.trim() === "<br>" || currentHTML.trim() === "<p><br></p>" || currentHTML.trim() === "<p></p>") {
      setStoryContent("<p><br></p>");
      if (event.currentTarget.innerHTML !== "<p><br></p>") { event.currentTarget.innerHTML = "<p><br></p>";
        const pTag = event.currentTarget.querySelector('p');
        if(pTag) { const range = document.createRange(); const sel = window.getSelection(); try { range.setStart(pTag, 0); range.collapse(true); sel?.removeAllRanges(); sel?.addRange(range); } catch(e) {}}
      }
    } else setStoryContent(currentHTML);
    if (publishAttempted) {
      const currentText = event.currentTarget.textContent || "";
      if (currentText.trim() || /<img|<figure|<video|<pre|<hr/i.test(currentHTML)) setStoryError(""); else setStoryError("Story content is required.");
    }
    requestAnimationFrame(updateSelectionNonce);
  }, [publishAttempted, setStoryError, updateSelectionNonce]);

  const handleContentKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const editorEl = contentEditableRef.current; if (!editorEl) return;
    const selection = window.getSelection(); if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0); const currentBlock = getCurrentBlockElement();
    if (event.key === 'Enter') {
      event.preventDefault();
      document.execCommand('insertParagraph', false, undefined);
      setTimeout(() => {
        if (contentEditableRef.current) {
          setStoryContent(contentEditableRef.current.innerHTML);
          requestAnimationFrame(updateSelectionNonce);
        }
      }, 0);
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (range.collapsed && currentBlock) {
        const focusNode = selection.focusNode; const focusOffset = selection.focusOffset; let isAtBoundary = false;
        if (event.key === 'Backspace') {
          if ((focusNode === currentBlock && focusOffset === 0) || (focusNode && focusNode.nodeType === Node.TEXT_NODE && currentBlock.contains(focusNode) && focusOffset === 0 && !focusNode.previousSibling) || (focusNode && focusNode.nodeType === Node.ELEMENT_NODE && currentBlock.firstChild === focusNode && focusOffset === 0 && (focusNode.textContent === "" || (focusNode as HTMLElement).tagName === 'BR'))) isAtBoundary = true;
          const prevElement = currentBlock.previousElementSibling;
          if (isAtBoundary && prevElement && (prevElement.tagName === 'FIGURE' || prevElement.getAttribute('data-embed-wrapper') === 'true' || prevElement.tagName === 'PRE' || prevElement.tagName === 'HR')) {
            event.preventDefault(); prevElement.remove(); setStoryContent(editorEl.innerHTML || "<p><br></p>"); requestAnimationFrame(updateSelectionNonce); return;
          }
        } else {
          if ((focusNode === currentBlock && focusOffset === currentBlock.childNodes.length) || (focusNode && focusNode.nodeType === Node.TEXT_NODE && currentBlock.contains(focusNode) && focusOffset === focusNode.textContent?.length && !focusNode.nextSibling) || (focusNode && focusNode.nodeType === Node.ELEMENT_NODE && currentBlock.lastChild === focusNode && focusOffset === focusNode.childNodes.length && (focusNode.textContent === "" || (focusNode as HTMLElement).tagName === 'BR'))) isAtBoundary = true;
          const nextElement = currentBlock.nextElementSibling;
          if (isAtBoundary && nextElement && (nextElement.tagName === 'FIGURE' || nextElement.getAttribute('data-embed-wrapper') === 'true' || nextElement.tagName === 'PRE' || nextElement.tagName === 'HR')) {
            event.preventDefault(); nextElement.remove(); setStoryContent(editorEl.innerHTML || "<p><br></p>"); requestAnimationFrame(updateSelectionNonce); return;
          }
        }
      }
    }
  }, [getCurrentBlockElement, setStoryContent, updateSelectionNonce]);

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); }
    if (tags.length === 0) { setTagsError("At least one tag is required."); isValid = false; } else { setTagsError(""); }
    const currentHTMLContent = contentEditableRef.current?.innerHTML || ""; const currentTextContent = contentEditableRef.current?.textContent || "";
    if (!currentTextContent.trim() && !/<img|<figure|<video|<pre|<hr/i.test(currentHTMLContent)) { setStoryError("Story content is required."); isValid = false; } else { setStoryError(""); }
    return isValid;
  }, [title, tags]);

  const handleFormSubmission = async (status: NewsArticleStatus) => {
    if (!user) { toast({ variant: "destructive", title: "Error", description: "You must be logged in." }); return; }
    setPublishAttempted(true);
    if (!validateFields()) {
      if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
      else if (tags.length === 0 && isHeaderSearchActive && headerSearchInputRef.current) headerSearchInputRef.current.focus();
      else if (contentEditableRef.current && storyError) contentEditableRef.current.focus();
      return;
    }
    setIsSubmitting(true);
    let coverImageUrlToSave: string | undefined = undefined;
    try {
      if (coverImageFile) {
        coverImageUrlToSave = await uploadNewsCoverImage(coverImageFile, user.uid, 'new_article_placeholder');
      }
      const articleData: NewNewsArticleData = {
        userId: user.uid, title: title.trim(), tags: tags, content: storyContent, status, coverImageUrl: coverImageUrlToSave,
      };
      const articleId = await createNewsArticle(articleData);
      toast({ title: status === 'published' ? "Article Published!" : "Draft Saved!", description: `"${title.trim()}" has been successfully ${status}.` });

      setTitle(""); setTags([]); setStoryContent("<p><br></p>"); setCoverImageFile(null); setCoverImagePreview(null);
      if (contentEditableRef.current) contentEditableRef.current.innerHTML = "<p><br></p>";

      setPublishAttempted(false); setTitleError(""); setTagsError(""); setStoryError("");
      setIsToolbarExpanded(false); setShowContextualUI(false);
      updateSelectionNonce();

      if (status === 'published') {
        router.push(`/news/article/${articleId}`);
      } else {
        router.push('/news');
      }

    } catch (error: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: error.message || "Could not save the article." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = () => handleFormSubmission('published');
  const handleSaveDraft = () => {
    if (!title.trim() || tags.length === 0) {
        setPublishAttempted(true);
        if (!title.trim()) setTitleError("Title is required to save a draft."); else setTitleError("");
        if (tags.length === 0) setTagsError("At least one tag is required to save a draft."); else setTagsError("");
        toast({variant: "destructive", title: "Cannot Save Draft", description: "Please provide a title and at least one tag."});
        return;
    }
    handleFormSubmission('draft');
  };

  const insertHTMLAndFocus = useCallback((htmlToInsert: string) => {
    const editorEl = contentEditableRef.current; if (!editorEl) return;
    queueMicrotask(() => {
      editorEl.focus(); const selection = window.getSelection(); let range: Range;
      if (savedRange && editorEl.contains(savedRange.commonAncestorContainer)) range = savedRange;
      else if (selection && selection.rangeCount > 0 && editorEl.contains(selection.getRangeAt(0).commonAncestorContainer)) range = selection.getRangeAt(0);
      else { range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); }
      if (selection) { selection.removeAllRanges(); selection.addRange(range); }
      setSavedRange(null);
      const currentBlock = getCurrentBlockElement();
      if (currentBlock && editorEl.contains(currentBlock) && (currentBlock.textContent?.trim() === "" || currentBlock.innerHTML.toLowerCase() === "<br>" || currentBlock.innerHTML.toLowerCase() === "<p></p>" || currentBlock.innerHTML.toLowerCase() === "&nbsp;") && currentBlock.innerHTML.toLowerCase() !== "<p><br></p>") {
        if (range.collapsed && (currentBlock.isSameNode(range.startContainer) || currentBlock.contains(range.startContainer))) {
          const isEditorAndEmptyOrSinglePBR = currentBlock.isSameNode(editorEl) && editorEl.innerHTML.trim().match(/^($|<br\s*\/?>|<p><br\s*\/?><\/p>|<p><\/p>)$/i);
          if (!isEditorAndEmptyOrSinglePBR || (isEditorAndEmptyOrSinglePBR && range.startOffset === 0 && range.endOffset === 0 && editorEl.childNodes.length <= 1)) range.selectNodeContents(currentBlock);
        }
      }
      if (!range.collapsed) range.deleteContents();
      const fragment = range.createContextualFragment(htmlToInsert); const lastNodeOfFragment = fragment.lastChild;
      range.insertNode(fragment);
      if (lastNodeOfFragment && editorEl.contains(lastNodeOfFragment)) {
        if (lastNodeOfFragment.nodeName === 'P' && (lastNodeOfFragment as HTMLElement).innerHTML.toLowerCase().includes('<br>')) range.setStart(lastNodeOfFragment, 0);
        else range.setStartAfter(lastNodeOfFragment);
        range.collapse(true);
      } else { range.selectNodeContents(editorEl); range.collapse(false); }
      if (selection) { selection.removeAllRanges(); selection.addRange(range); }
      setStoryContent(editorEl.innerHTML || "<p><br></p>"); setIsToolbarExpanded(false);
      queueMicrotask(() => { editorEl.focus(); updateSelectionNonce(); });
    });
  }, [getCurrentBlockElement, updateSelectionNonce, contentEditableRef, setStoryContent, setIsToolbarExpanded, savedRange]);

  const triggerInlineImageUpload = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    if (inlineImageInputRef.current) inlineImageInputRef.current.click();
  }, []);

  const handleInlineImageFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onloadend = () => { const dataUri = reader.result as string; insertHTMLAndFocus(`<figure class="my-4 flex flex-col items-center" contenteditable="false"><img src="${dataUri}" alt="User uploaded image" style="max-width: 100%; height: auto; display: block; border-radius: 0.25rem; margin-bottom: 0.5rem;" data-ai-hint="user uploaded" /><figcaption contenteditable="true" data-placeholder="Optional caption..." style="text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem;" class="w-full"></figcaption></figure><p><br></p>`); }; reader.readAsDataURL(file); if (inlineImageInputRef.current) inlineImageInputRef.current.value = ''; }
    setSavedRange(null);
  }, [insertHTMLAndFocus]);

  const handleInsertYouTubeVideo = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    setIsYouTubeDialogOpen(true); setYouTubeUrlInput(""); setIsToolbarExpanded(false);
  }, []);

  const handleYouTubeDialogSubmit = () => {
    if (youTubeUrlInput) {
      let videoId = ''; try { const urlObj = new URL(youTubeUrlInput); if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.substring(1); else if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) videoId = urlObj.searchParams.get('v')!; else videoId = youTubeUrlInput; } catch (e) { videoId = youTubeUrlInput; }
      if (videoId.match(/^[a-zA-Z0-9_-]{11}$/)) insertHTMLAndFocus(`<figure class="my-4 relative" contenteditable="false" style="padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.25rem;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure><p><br></p>`);
      else toast({ variant: 'destructive', title: 'Invalid YouTube URL/ID', description: 'Please enter a valid YouTube video URL or ID.' });
    }
    setIsYouTubeDialogOpen(false); setSavedRange(null);
  };

  const handleOpenEmbedDialog = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    setIsEmbedDialogOpen(true); setEmbedCodeInput(""); setIsToolbarExpanded(false);
  }, []);

  const handleEmbedDialogSubmit = () => {
    if (embedCodeInput) {
      const sanitizedCode = embedCodeInput.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      if (sanitizedCode.trim()) insertHTMLAndFocus(`<div class="my-4 relative" data-embed-wrapper="true" contenteditable="false" style="padding-bottom: 100%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.25rem;"><div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">${sanitizedCode}</div></div><p><br></p>`);
      else toast({ variant: 'destructive', title: 'Invalid Embed Code', description: 'Please provide valid embed code (e.g., an iframe).' });
    }
    setIsEmbedDialogOpen(false); setSavedRange(null);
  };

  const handleInsertCodeBlock = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    insertHTMLAndFocus(`<pre class="my-4 p-3 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm" style="white-space: pre-wrap; word-wrap: break-word;" contenteditable="true"><code class="language-plaintext" style="display: block;">\n// Your code here...\n\n</code></pre><p><br></p>`);
  }, [insertHTMLAndFocus]);

  const handleInsertSeparator = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    insertHTMLAndFocus(`<hr class="my-8 border-border" /><p><br></p>`);
  }, [insertHTMLAndFocus]);

  const handleToggleToolbar = () => { setIsToolbarExpanded(prev => { const newState = !prev; if (newState) { if (focusedField === 'title' && titleInputRef.current) titleInputRef.current.focus(); else if (focusedField === 'content' && contentEditableRef.current) contentEditableRef.current.focus(); } return newState; }); };
  const actionButtonClass = "p-2 hover:bg-muted rounded-full focus:outline-none focus:ring-1 focus:ring-primary"; const iconClass = "h-5 w-5 text-primary";

  const handleCoverImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setCoverImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setCoverImageFile(null); setCoverImagePreview(null);
    }
  };

  // Header Search Logic
  const toggleHeaderSearch = () => {
    setIsHeaderSearchActive(prev => {
      if (prev) {
        setHeaderSearchTerm('');
        setIsTagSuggestionsPopoverOpen(false);
      } else {
        setTimeout(() => headerSearchInputRef.current?.focus(), 0);
      }
      return !prev;
    });
  };

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedHeaderSearchTerm(headerSearchTerm);
    }, 300);
    return () => clearTimeout(timerId);
  }, [headerSearchTerm]);

  useEffect(() => {
    if (debouncedHeaderSearchTerm.trim() && isHeaderSearchActive) {
      setIsTagSuggestionsLoading(true);
      searchTags(debouncedHeaderSearchTerm.trim(), 7)
        .then(fetchedTags => {
          const currentSelectedLowercase = tags.map(t => t.toLowerCase());
          setTagSuggestions(fetchedTags.filter(tag => !currentSelectedLowercase.includes(tag.name.toLowerCase())));
          setIsTagSuggestionsPopoverOpen(true);
        })
        .catch(() => setTagSuggestions([]))
        .finally(() => setIsTagSuggestionsLoading(false));
    } else {
      setTagSuggestions([]);
      setIsTagSuggestionsPopoverOpen(false);
    }
  }, [debouncedHeaderSearchTerm, tags, isHeaderSearchActive]);

  const handleAddTagFromSearch = (tagToAdd: string) => {
    const trimmedTag = tagToAdd.trim();
    if (trimmedTag && !tags.map(t => t.toLowerCase()).includes(trimmedTag.toLowerCase())) {
      if (tags.length < 5) { // Example limit, adjust as needed
        setTags(prev => [...prev, trimmedTag]);
        if (publishAttempted && (tags.length + 1 > 0)) setTagsError("");
      } else {
        toast({ title: "Tag Limit Reached", description: "You can add a maximum of 5 tags.", variant: "default" });
      }
    }
    setHeaderSearchTerm('');
    setIsTagSuggestionsPopoverOpen(false);
    // Do not close search on add: setIsHeaderSearchActive(false);
    setTimeout(() => headerSearchInputRef.current?.focus(), 0);
  };
  
  const handleHeaderSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (headerSearchTerm.trim()) {
              handleAddTagFromSearch(headerSearchTerm.trim());
          }
      } else if (e.key === 'Escape') {
          setIsTagSuggestionsPopoverOpen(false);
      }
  };

  const handleRemoveTagFromDisplay = (tagToRemove: string) => {
    setTags(prev => {
      const newTags = prev.filter(t => t !== tagToRemove);
      if (publishAttempted && newTags.length === 0) {
        setTagsError("At least one tag is required.");
      } else if (publishAttempted && newTags.length > 0) {
        setTagsError("");
      }
      return newTags;
    });
  };

  useEffect(() => {
    const handleClickOutsidePopover = (event: MouseEvent) => {
      if (isTagSuggestionsPopoverOpen &&
          tagSuggestionsPopoverContentRef.current && !tagSuggestionsPopoverContentRef.current.contains(event.target as Node) &&
          headerSearchInputRef.current && !headerSearchInputRef.current.contains(event.target as Node)
      ) {
        setIsTagSuggestionsPopoverOpen(false);
      }
    };
    if (isTagSuggestionsPopoverOpen) document.addEventListener('mousedown', handleClickOutsidePopover);
    return () => document.removeEventListener('mousedown', handleClickOutsidePopover);
  }, [isTagSuggestionsPopoverOpen]);

  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <>
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => router.push('/news')} className="text-xs h-9 px-3 flex-shrink-0">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to News
        </Button>

        <div className="flex items-center gap-1.5 flex-grow min-w-[150px] sm:min-w-[200px]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleHeaderSearch}
            className="h-7 w-7 p-1 text-muted-foreground hover:text-foreground flex-shrink-0"
            aria-label={isHeaderSearchActive ? "Close tag search" : "Search and add tags"}
            disabled={isSubmitting}
          >
            {isHeaderSearchActive ? <CloseIcon className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>

          {isHeaderSearchActive ? (
            <div className="relative flex-grow">
              <Popover open={isTagSuggestionsPopoverOpen && (tagSuggestions.length > 0 || (headerSearchTerm.trim() && !isTagSuggestionsLoading))} onOpenChange={setIsTagSuggestionsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Input
                    ref={headerSearchInputRef}
                    type="text"
                    placeholder="Search or create tags..."
                    value={headerSearchTerm}
                    onChange={(e) => {
                      setHeaderSearchTerm(e.target.value);
                      if (e.target.value.trim()) setIsTagSuggestionsPopoverOpen(true);
                      else setIsTagSuggestionsPopoverOpen(false);
                    }}
                    onKeyDown={handleHeaderSearchKeyDown}
                    className="h-9 text-xs flex-grow"
                    disabled={isSubmitting}
                  />
                </PopoverTrigger>
                <PopoverContent ref={tagSuggestionsPopoverContentRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="bottom" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                  {isTagSuggestionsLoading ? (
                    <div className="flex items-center justify-center p-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5"/> Loading...</div>
                  ) : tagSuggestions.length > 0 ? (
                    tagSuggestions.map(tag => (
                      <Button key={tag.id} variant="ghost" size="sm" className="w-full justify-start text-xs h-auto py-1.5 px-2" onClick={() => handleAddTagFromSearch(tag.name)} onMouseDown={(e) => e.preventDefault()}>
                        <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground"/>{tag.name} <span className="ml-auto text-muted-foreground text-[10px]">({tag.usageCount})</span>
                      </Button>
                    ))
                  ) : headerSearchTerm.trim() && !isTagSuggestionsLoading ? (
                     <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-auto py-1.5 px-2 text-primary" onClick={() => handleAddTagFromSearch(headerSearchTerm.trim())} onMouseDown={(e) => e.preventDefault()}>
                        <PlusCircle className="h-3.5 w-3.5 mr-1.5"/> Create new tag &quot;{headerSearchTerm.trim()}&quot;
                    </Button>
                  ) : null}
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="flex-grow flex items-center gap-1.5 overflow-x-auto py-1.5 h-9">
              {tags.length > 0 ? (
                tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs flex-shrink-0 group/tagbadge relative pr-5">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTagFromDisplay(tag)}
                      className="ml-1 rounded-full outline-none opacity-0 group-hover/tagbadge:opacity-100 focus:opacity-100 absolute right-0.5 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-destructive/20"
                      aria-label={`Remove ${tag}`}
                      disabled={isSubmitting}
                    >
                      <CloseIcon className="h-3 w-3 text-destructive/70 hover:text-destructive" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic pl-1">No tags selected</span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 p-1">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => coverImageInputRef.current?.click()} disabled={isSubmitting} className="cursor-pointer">
                <ImageUp className="mr-2 h-4 w-4" />
                <span>Cover Image</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSaveDraft} disabled={isSubmitting} className="cursor-pointer">
                <Save className="mr-2 h-4 w-4" />
                <span>Save Draft</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePublish} disabled={isSubmitting} className="cursor-pointer text-green-600 focus:text-green-700">
                <Send className="mr-2 h-4 w-4" />
                <span>Publish</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div ref={formWrapperRef} className="max-w-3xl mx-auto relative pt-5">
        {showContextualUI && (<div ref={toolbarWrapperRef} style={toolbarStyle} className="flex items-center space-x-1">
            <Button type="button" variant="outline" size="icon" onClick={handleToggleToolbar} onMouseDown={(e) => e.preventDefault()} className="p-0 bg-card border rounded-full shadow-lg hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary h-9 w-9 z-10 flex items-center justify-center" aria-expanded={isToolbarExpanded} aria-label={isToolbarExpanded ? "Close formatting options" : "Open formatting options"}>
              <PlusIcon className={cn("h-5 w-5 text-primary transition-transform duration-200 ease-in-out", isToolbarExpanded && "rotate-45")} />
            </Button>
            {isToolbarExpanded && (<div className="bg-card border p-0.5 rounded-full shadow-lg flex items-center space-x-0.5 ml-1 animate-in fade-in-50 slide-in-from-left-2 duration-200">
                <button onClick={triggerInlineImageUpload} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert image" title="Upload image"><ImageIcon className={iconClass} /></button>
                <button onClick={handleInsertYouTubeVideo} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert YouTube video" title="Insert YouTube video"><YoutubeIcon className={iconClass} /></button>
                <button onClick={handleOpenEmbedDialog} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert embed" title="Insert embed (e.g., Twitter, Vimeo)"><Link2Icon className={iconClass} /></button>
                <button onClick={handleInsertCodeBlock} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert code block" title="Insert code block"><SquareCodeIcon className={iconClass} /></button>
                <button onClick={handleInsertSeparator} onMouseDown={(e) => e.preventDefault()} className={actionButtonClass} aria-label="Insert line separator" title="Insert line separator"><MinusIcon className={iconClass} /></button>
              </div>)}
          </div>)}

        <Input id="article-image-input-header" type="file" accept="image/*" className="hidden" ref={coverImageInputRef} onChange={handleCoverImageFileChange} disabled={isSubmitting} />
        <input type="file" ref={inlineImageInputRef} onChange={handleInlineImageFileChange} accept="image/*" style={{ display: 'none' }} disabled={isSubmitting} />

        {coverImagePreview && (
          <div className="mb-4 relative group">
            <Image src={coverImagePreview} alt="Cover image preview" width={800} height={450} className="rounded-md object-cover w-full max-h-[300px] border" data-ai-hint="news cover"/>
            <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity p-1" onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); if(coverImageInputRef.current) coverImageInputRef.current.value = "";}} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
        <div ref={titleWrapperRef} className="relative mb-4">
          <Input
            ref={titleInputRef}
            placeholder="Title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (publishAttempted) { if (e.target.value.trim()) setTitleError(""); else setTitleError("Title is required."); } requestAnimationFrame(updateSelectionNonce); }}
            onFocus={() => handleFocus('title')}
            onBlur={handleBlur}
            className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"
            autoComplete="off"
            disabled={isSubmitting}
          />
          {publishAttempted && titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
        </div>
        <div ref={contentWrapperRef} className="relative">
          <div
            ref={contentEditableRef}
            contentEditable={!isSubmitting}
            onInput={handleContentEditableInput}
            onFocus={() => handleFocus('content')}
            onBlur={handleBlur}
            onKeyDown={handleContentKeyDown}
            data-placeholder="Tell your story..."
            className={cn(
              "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case",
              "focus:outline-none min-h-[150px]"
            )}
            style={{
              fontFamily:
                "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
              fontSize: "20px",
              lineHeight: "1.6",
              color: "hsl(var(--foreground))"
            }}
            role="textbox"
            aria-multiline="true"
            aria-label="News article content"
            suppressContentEditableWarning={true}
            dir="ltr"
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        {publishAttempted && tagsError && <p className="text-xs text-destructive mt-2">{tagsError}</p>}

        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before, div[contentEditable="true"][data-placeholder] > p:first-child:last-child:empty:before, div[contentEditable="true"][data-placeholder] > p:first-child:last-child > br:only-child:before, div[contentEditable="true"][data-placeholder] > p:first-child:last-child:has(br:only-child):before { content: attr(data-placeholder); color: hsl(var(--muted-foreground) / 0.5); pointer-events: none; display: block; position: absolute; top: 0.5rem; left: 0; }
          div[contentEditable="true"][data-placeholder]:not(:empty):before, div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:empty):before, div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:has(br:only-child)):before { content: none; }
          div[contentEditable="true"] figure { margin-left: auto; margin-right: auto; max-width: 100%; } div[contentEditable="true"] figure img, div[contentEditable="true"] figure iframe { display: block; margin-left: auto; margin-right: auto; max-width: 100%; border-radius: 0.25rem; }
          div[contentEditable="true"] figure figcaption { text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem; margin-top: 0.25rem; } div[contentEditable="true"] figure figcaption:empty:before { content: attr(data-placeholder); color: hsl(var(--muted-foreground) / 0.7); }
          div[contentEditable="true"] pre { background-color: hsl(var(--muted)); color: hsl(var(--muted-foreground)); padding: 1rem; border-radius: 0.375rem; overflow-x: auto; font-family: monospace; font-size: 0.875rem; line-height: 1.25rem; white-space: pre-wrap; word-wrap: break-word; } div[contentEditable="true"] pre code { display: block; white-space: pre-wrap !important; word-wrap: break-word !important; outline: none; }
          div[contentEditable="true"] hr { border-color: hsl(var(--border)); margin-top: 2rem; margin-bottom: 2rem; }
          div[contentEditable="true"] div[data-embed-wrapper="true"] { margin: 1rem 0; } div[contentEditable="true"] div[data-embed-wrapper="true"] > div > * { width: 100%; height: 100%; border: 0; display: block; }
        `}</style>
      </div>
    </div>
    <Dialog open={isYouTubeDialogOpen} onOpenChange={(open) => { setIsYouTubeDialogOpen(open); if (!open) setSavedRange(null); }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Embed YouTube Video</DialogTitle><DialogDescription>Paste the YouTube video URL or video ID below.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="youtube-url" className="text-right col-span-1">URL/ID</Label><Input id="youtube-url" value={youTubeUrlInput} onChange={(e) => setYouTubeUrlInput(e.target.value)} className="col-span-3" placeholder="e.g., https://www.youtube.com/watch?v=VIDEO_ID" /></div></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => {setIsYouTubeDialogOpen(false); setSavedRange(null);}}>Cancel</Button><Button type="button" onClick={handleYouTubeDialogSubmit}>Embed Video</Button></DialogFooter>
        </DialogContent>
    </Dialog>
    <Dialog open={isEmbedDialogOpen} onOpenChange={(open) => { setIsEmbedDialogOpen(open); if (!open) setSavedRange(null); }}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Embed External Content</DialogTitle><DialogDescription>Paste your embed code (e.g., from Twitter, Vimeo, etc.). Ensure it&apos;s safe, typically iframe-based.</DialogDescription></DialogHeader>
          <div className="py-4"><Label htmlFor="embed-code" className="sr-only">Embed Code</Label><Textarea id="embed-code" value={embedCodeInput} onChange={(e) => setEmbedCodeInput(e.target.value)} className="min-h-[150px] font-mono text-xs" placeholder="<iframe src='...'></iframe>" /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => {setIsEmbedDialogOpen(false); setSavedRange(null);}}>Cancel</Button><Button type="button" onClick={handleEmbedDialogSubmit}>Embed Content</Button></DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
};
export default CreateNewsArticlePage;
