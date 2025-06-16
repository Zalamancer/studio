
// src/app/news/article/[articleId]/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getNewsArticleById, updateNewsArticle } from '@/services/newsService';
import { uploadNewsCoverImage } from '@/services/storageService';
import type { ClientNewsArticle, UpdateNewsArticleData, NewsArticleStatus } from '@/types/news';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Send, ImageUp, ImageIcon, YoutubeIcon, Link2Icon, SquareCodeIcon, MinusIcon, PlusIcon, XIcon, Trash2, Edit3, CalendarCheck2, AlertTriangle, ArrowLeft, Newspaper } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
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
import { format } from 'date-fns';

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

const ArticlePage = () => {
  const params = useParams();
  const articleId = params?.articleId as string | undefined;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [article, setArticle] = useState<ClientNewsArticle | null>(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(true);
  const [errorLoadingArticle, setErrorLoadingArticle] = useState<string | null>(null);

  // Editor state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [storyContent, setStoryContent] = useState("<p><br></p>");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [currentCoverImageUrl, setCurrentCoverImageUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  const [showContextualUI, setShowContextualUI] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute' });

  const [isYouTubeDialogOpen, setIsYouTubeDialogOpen] = useState(false);
  const [youTubeUrlInput, setYouTubeUrlInput] = useState("");
  const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false);
  const [embedCodeInput, setEmbedCodeInput] = useState("");
  
  const isEditingAllowed = useMemo(() => {
    return article?.status === 'draft' && user?.uid === article?.userId;
  }, [article, user]);

  // Effect to fetch article data
  useEffect(() => {
    if (articleId) {
      setIsLoadingArticle(true);
      setErrorLoadingArticle(null);
      getNewsArticleById(articleId)
        .then((fetchedArticle) => {
          if (fetchedArticle) {
            setArticle(fetchedArticle);
          } else {
            setErrorLoadingArticle("Article not found.");
          }
        })
        .catch((err) => setErrorLoadingArticle(err.message || "Failed to load article."))
        .finally(() => setIsLoadingArticle(false));
    }
  }, [articleId]);

  // Effect to populate editor form when article data (for a draft) is available
  useEffect(() => {
    if (article && article.status === 'draft' && user?.uid === article.userId) {
      setTitle(article.title);
      setCategory(article.category);
      const initialContent = article.content || "<p><br></p>";
      setStoryContent(initialContent);
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = initialContent;
      }
      setCoverImagePreview(article.coverImageUrl || null);
      setCurrentCoverImageUrl(article.coverImageUrl || null);
    }
  }, [article, user?.uid]); // Depends on `article` and `user`

  const updateSelectionNonce = useCallback(() => setSelectionNonce(n => n + 1), []);

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

  useEffect(() => { if (isEditingAllowed) calculateAndUpdateToolbarStyle(); }, [focusedField, title, storyContent, selectionNonce, isToolbarExpanded, calculateAndUpdateToolbarStyle, isEditingAllowed]);
  useEffect(() => {
    const handleSelectionOrKey = () => { if (document.activeElement === contentEditableRef.current || document.activeElement === titleInputRef.current) updateSelectionNonce(); };
    if (isEditingAllowed) {
        document.addEventListener('selectionchange', handleSelectionOrKey); document.addEventListener('keyup', handleSelectionOrKey); document.addEventListener('click', handleSelectionOrKey);
    }
    return () => { document.removeEventListener('selectionchange', handleSelectionOrKey); document.removeEventListener('keyup', handleSelectionOrKey); document.removeEventListener('click', handleSelectionOrKey); };
  }, [updateSelectionNonce, isEditingAllowed]);

  const handleFocus = useCallback((field: 'title' | 'content') => { if (isEditingAllowed) setFocusedField(field); }, [isEditingAllowed]);
  const handleBlur = useCallback(() => {
    if (!isEditingAllowed) return;
    queueMicrotask(() => {
      const activeEl = document.activeElement;
      if (!((toolbarWrapperRef.current && toolbarWrapperRef.current.contains(activeEl)) || titleInputRef.current === activeEl || contentEditableRef.current === activeEl || isYouTubeDialogOpen || isEmbedDialogOpen)) {
        setFocusedField(null); setIsToolbarExpanded(false); setShowContextualUI(false); setSavedRange(null);
      }
    });
  }, [isYouTubeDialogOpen, isEmbedDialogOpen, isEditingAllowed]);

  const handleContentEditableInput = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => {
    if (!isEditingAllowed) return;
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
    updateSelectionNonce();
  }, [publishAttempted, setStoryError, updateSelectionNonce, isEditingAllowed]);

  const handleContentKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isEditingAllowed) return;
    const editorEl = contentEditableRef.current; if (!editorEl) return;
    const selection = window.getSelection(); if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0); const currentBlock = getCurrentBlockElement();
    if (event.key === 'Enter') { event.preventDefault(); document.execCommand('insertParagraph', false, undefined); setTimeout(() => { if (contentEditableRef.current) { setStoryContent(contentEditableRef.current.innerHTML); updateSelectionNonce();}}, 0); return; }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (range.collapsed && currentBlock) {
        const focusNode = selection.focusNode; const focusOffset = selection.focusOffset; let isAtBoundary = false;
        if (event.key === 'Backspace') {
          if ((focusNode === currentBlock && focusOffset === 0) || (focusNode && focusNode.nodeType === Node.TEXT_NODE && currentBlock.contains(focusNode) && focusOffset === 0 && !focusNode.previousSibling) || (focusNode && focusNode.nodeType === Node.ELEMENT_NODE && currentBlock.firstChild === focusNode && focusOffset === 0 && (focusNode.textContent === "" || (focusNode as HTMLElement).tagName === 'BR'))) isAtBoundary = true;
          const prevElement = currentBlock.previousElementSibling;
          if (isAtBoundary && prevElement && (prevElement.tagName === 'FIGURE' || prevElement.getAttribute('data-embed-wrapper') === 'true' || prevElement.tagName === 'PRE' || prevElement.tagName === 'HR')) {
            event.preventDefault(); prevElement.remove(); setStoryContent(editorEl.innerHTML || "<p><br></p>"); updateSelectionNonce(); return;
          }
        } else {
          if ((focusNode === currentBlock && focusOffset === currentBlock.childNodes.length) || (focusNode && focusNode.nodeType === Node.TEXT_NODE && currentBlock.contains(focusNode) && focusOffset === focusNode.textContent?.length && !focusNode.nextSibling) || (focusNode && focusNode.nodeType === Node.ELEMENT_NODE && currentBlock.lastChild === focusNode && focusOffset === focusNode.childNodes.length && (focusNode.textContent === "" || (focusNode as HTMLElement).tagName === 'BR'))) isAtBoundary = true;
          const nextElement = currentBlock.nextElementSibling;
          if (isAtBoundary && nextElement && (nextElement.tagName === 'FIGURE' || nextElement.getAttribute('data-embed-wrapper') === 'true' || nextElement.tagName === 'PRE' || nextElement.tagName === 'HR')) {
            event.preventDefault(); nextElement.remove(); setStoryContent(editorEl.innerHTML || "<p><br></p>"); updateSelectionNonce(); return;
          }
        }
      }
    }
  }, [getCurrentBlockElement, setStoryContent, updateSelectionNonce, isEditingAllowed]);

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); }
    if (!category) { setCategoryError("Category is required."); isValid = false; } else { setCategoryError(""); }
    const currentHTMLContent = contentEditableRef.current?.innerHTML || ""; const currentTextContent = contentEditableRef.current?.textContent || "";
    if (!currentTextContent.trim() && !/<img|<figure|<video|<pre|<hr/i.test(currentHTMLContent)) { setStoryError("Story content is required."); isValid = false; } else { setStoryError(""); }
    return isValid;
  }, [title, category]);

  const handleUpdateArticle = async (status: NewsArticleStatus) => {
    if (!user || !articleId || !isEditingAllowed) { toast({ variant: "destructive", title: "Error", description: "Cannot update article." }); return; }
    setPublishAttempted(true);
    if (!validateFields()) {
      if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
      else if (!category) { /* No direct focus */ }
      else if (contentEditableRef.current && storyError) contentEditableRef.current.focus();
      return;
    }
    setIsSubmitting(true);
    let newCoverImageUrl: string | null | undefined = undefined; 
    try {
      if (coverImageFile) {
        newCoverImageUrl = await uploadNewsCoverImage(coverImageFile, user.uid, articleId);
      } else if (coverImagePreview === null && currentCoverImageUrl !== null) {
        newCoverImageUrl = null; 
      }
      
      const articleUpdateData: UpdateNewsArticleData = {
        title: title.trim(), category, content: storyContent, status,
        ...(newCoverImageUrl !== undefined && { coverImageUrl: newCoverImageUrl }),
      };

      await updateNewsArticle(articleId, articleUpdateData);
      toast({ title: status === 'published' ? "Article Published!" : "Draft Updated!", description: `"${title.trim()}" has been successfully ${status}.` });
      setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
      setIsToolbarExpanded(false); setShowContextualUI(false);
      if (status === 'published') {
         router.push('/news');
      } else {
        getNewsArticleById(articleId).then(fetchedUpdatedArticle => {
          if (fetchedUpdatedArticle) {
            setArticle(fetchedUpdatedArticle); // Update local article state
            // The useEffect depending on 'article' will repopulate editor fields
            setCurrentCoverImageUrl(newCoverImageUrl === undefined ? currentCoverImageUrl : newCoverImageUrl);
          }
        });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not update the article." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const insertHTMLAndFocus = useCallback((htmlToInsert: string) => {
    if(!isEditingAllowed) return;
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
  }, [getCurrentBlockElement, updateSelectionNonce, contentEditableRef, setStoryContent, setIsToolbarExpanded, savedRange, isEditingAllowed]);

  const triggerInlineImageUpload = useCallback(() => {
    if (!isEditingAllowed) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    if (inlineImageInputRef.current) inlineImageInputRef.current.click();
  }, [isEditingAllowed]);
  const handleInlineImageFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditingAllowed) return;
    const file = event.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onloadend = () => { const dataUri = reader.result as string; insertHTMLAndFocus(`<figure class="my-4 flex flex-col items-center" contenteditable="false"><img src="${dataUri}" alt="User uploaded image" style="max-width: 100%; height: auto; display: block; border-radius: 0.25rem; margin-bottom: 0.5rem;" data-ai-hint="user uploaded" /><figcaption contenteditable="true" data-placeholder="Optional caption..." style="text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem;" class="w-full"></figcaption></figure><p><br></p>`); }; reader.readAsDataURL(file); if (inlineImageInputRef.current) inlineImageInputRef.current.value = ''; }
    setSavedRange(null);
  }, [insertHTMLAndFocus, isEditingAllowed]);

  const handleInsertYouTubeVideo = useCallback(() => {
    if (!isEditingAllowed) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    setIsYouTubeDialogOpen(true); setYouTubeUrlInput(""); setIsToolbarExpanded(false);
  }, [isEditingAllowed]);
  const handleYouTubeDialogSubmit = () => {
    if (youTubeUrlInput) {
      let videoId = ''; try { const urlObj = new URL(youTubeUrlInput); if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.substring(1); else if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) videoId = urlObj.searchParams.get('v')!; else videoId = youTubeUrlInput; } catch (e) { videoId = youTubeUrlInput; }
      if (videoId.match(/^[a-zA-Z0-9_-]{11}$/)) insertHTMLAndFocus(`<figure class="my-4 relative" contenteditable="false" style="padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.25rem;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure><p><br></p>`);
      else toast({ variant: 'destructive', title: 'Invalid YouTube URL/ID', description: 'Please enter a valid YouTube video URL or ID.' });
    }
    setIsYouTubeDialogOpen(false); setSavedRange(null);
  };

  const handleOpenEmbedDialog = useCallback(() => {
    if (!isEditingAllowed) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    setIsEmbedDialogOpen(true); setEmbedCodeInput(""); setIsToolbarExpanded(false);
  }, [isEditingAllowed]);
  const handleEmbedDialogSubmit = () => {
    if (embedCodeInput) {
      const sanitizedCode = embedCodeInput.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      if (sanitizedCode.trim()) insertHTMLAndFocus(`<div class="my-4 relative" data-embed-wrapper="true" contenteditable="false" style="padding-bottom: 100%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.25rem;"><div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">${sanitizedCode}</div></div><p><br></p>`);
      else toast({ variant: 'destructive', title: 'Invalid Embed Code', description: 'Please provide valid embed code (e.g., an iframe).' });
    }
    setIsEmbedDialogOpen(false); setSavedRange(null);
  };
  const handleInsertCodeBlock = useCallback(() => {
    if (!isEditingAllowed) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    insertHTMLAndFocus(`<pre class="my-4 p-3 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm" style="white-space: pre-wrap; word-wrap: break-word;" contenteditable="true"><code class="language-plaintext" style="display: block;">\n// Your code here...\n\n</code></pre><p><br></p>`);
  }, [insertHTMLAndFocus, isEditingAllowed]);
  const handleInsertSeparator = useCallback(() => {
    if (!isEditingAllowed) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    insertHTMLAndFocus(`<hr class="my-8 border-border" /><p><br></p>`);
  }, [insertHTMLAndFocus, isEditingAllowed]);

  const handleToggleToolbar = () => { if(isEditingAllowed) setIsToolbarExpanded(prev => { const newState = !prev; if (newState) { if (focusedField === 'title' && titleInputRef.current) titleInputRef.current.focus(); else if (focusedField === 'content' && contentEditableRef.current) contentEditableRef.current.focus(); } return newState; }); };
  const actionButtonClass = "p-2 hover:bg-muted rounded-full focus:outline-none focus:ring-1 focus:ring-primary"; const iconClass = "h-5 w-5 text-primary";

  const handleCoverImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditingAllowed) return;
    const file = event.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setCoverImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setCoverImageFile(null); setCoverImagePreview(currentCoverImageUrl); 
    }
  };

  if (authLoading || isLoadingArticle) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (errorLoadingArticle) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><AlertTriangle className="h-10 w-10 text-destructive mb-3"/><p className="text-lg font-semibold text-destructive">{errorLoadingArticle}</p><Button onClick={() => router.push('/news')} className="mt-4">Back to News</Button></div>;
  if (!article) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><AlertTriangle className="h-10 w-10 text-destructive mb-3"/><p className="text-lg font-semibold text-foreground">Article Not Found</p><Button onClick={() => router.push('/news')} className="mt-4">Back to News</Button></div>;

  // Published View
  if (article.status === 'published' && !isEditingAllowed) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <Button variant="outline" size="sm" onClick={() => router.push('/news')} className="mb-6 text-xs">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to News
        </Button>
        <article className="max-w-3xl mx-auto">
          <header className="mb-8">
            <p className="text-sm text-primary font-semibold mb-1">{article.category}</p>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{article.title}</h1>
            {article.publishedAt && (
              <p className="text-sm text-muted-foreground">
                Published on <time dateTime={new Date(article.publishedAt).toISOString()}>{format(new Date(article.publishedAt), 'PPP')}</time>
              </p>
            )}
          </header>
          {article.coverImageUrl && (
            <div className="mb-8 relative aspect-video rounded-lg overflow-hidden shadow-md">
              <Image src={article.coverImageUrl} alt={article.title} fill style={{objectFit:"cover"}} priority data-ai-hint="news cover article"/>
            </div>
          )}
          <div
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: article.content || "" }}
          />
        </article>
      </div>
    );
  }

  if (article.status === 'draft' && !isEditingAllowed) {
    return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><AlertTriangle className="h-10 w-10 text-destructive mb-3"/><p className="text-lg font-semibold text-foreground">Access Denied</p><p className="text-muted-foreground">You do not have permission to edit this draft.</p><Button onClick={() => router.push('/news')} className="mt-4">Back to News</Button></div>;
  }

  // Editor UI for Drafts
  return (
    <>
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Button variant="outline" size="sm" onClick={() => router.push('/news')} className="mb-4 text-xs">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to News
      </Button>
      <div ref={formWrapperRef} className="max-w-3xl mx-auto relative pt-5">
         {showContextualUI && isEditingAllowed && (<div ref={toolbarWrapperRef} style={toolbarStyle} className="flex items-center space-x-1">
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
        <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
           <div className="flex items-center gap-2 mr-auto">
            <div className="space-y-1">
              <Select onValueChange={(value) => { setCategory(value); if (publishAttempted) { if (value) setCategoryError(""); else setCategoryError("Category is required."); }}} value={category} disabled={isSubmitting || !isEditingAllowed}>
                <SelectTrigger className="text-xs py-1.5 h-9 w-auto min-w-[140px] sm:w-[160px] focus-visible:ring-0 focus-visible:ring-offset-0"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{newsCategories.map((cat) => (<SelectItem key={cat} value={cat} className="text-sm">{cat}</SelectItem>))}</SelectContent>
              </Select>
              {publishAttempted && categoryError && <p className="text-xs text-destructive mt-1">{categoryError}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => coverImageInputRef.current?.click()} className="text-xs py-1.5 h-9" disabled={isSubmitting || !isEditingAllowed}>
              <ImageUp className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Cover Image</span><span className="sm:hidden">Cover</span>
            </Button>
            <Input id="article-image-input-header" type="file" accept="image/*" className="hidden" ref={coverImageInputRef} onChange={handleCoverImageFileChange} disabled={isSubmitting || !isEditingAllowed} />
            <input type="file" ref={inlineImageInputRef} onChange={handleInlineImageFileChange} accept="image/*" style={{ display: 'none' }} disabled={isSubmitting || !isEditingAllowed} />
          </div>
          {isEditingAllowed && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => handleUpdateArticle('draft')} className="text-xs py-1.5 h-9 rounded-full" disabled={isSubmitting}><Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft</Button>
              <Button type="button" onClick={() => handleUpdateArticle('published')} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full" disabled={isSubmitting}><Send className="mr-1.5 h-3.5 w-3.5" /> Publish</Button>
            </div>
          )}
        </div>
        {coverImagePreview && (
          <div className="mb-4 relative group">
            <Image src={coverImagePreview} alt="Cover image preview" width={800} height={450} className="rounded-md object-cover w-full max-h-[300px] border" data-ai-hint="news cover"/>
            {isEditingAllowed && <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity p-1" onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); setCurrentCoverImageUrl(null); if(coverImageInputRef.current) coverImageInputRef.current.value = "";}} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        )}
        <div ref={titleWrapperRef} className="relative mb-4">
          <Input ref={titleInputRef} placeholder="Title" value={title} onChange={(e) => { setTitle(e.target.value); if (publishAttempted) { if (e.target.value.trim()) setTitleError(""); else setTitleError("Title is required."); } updateSelectionNonce(); }} onFocus={() => handleFocus('title')} onBlur={handleBlur} onKeyUp={updateSelectionNonce} onClick={updateSelectionNonce} className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2" autoComplete="off" disabled={isSubmitting || !isEditingAllowed} />
          {publishAttempted && titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
        </div>
        <div ref={contentWrapperRef} className="relative">
          <div
            key={articleId} // Add key to force re-mount if articleId changes (though not typical for this page structure)
            ref={contentEditableRef} contentEditable={isEditingAllowed && !isSubmitting} onInput={handleContentEditableInput} onFocus={() => handleFocus('content')} onBlur={handleBlur} onKeyDown={handleContentKeyDown} onClick={updateSelectionNonce} onKeyUp={updateSelectionNonce} data-placeholder="Tell your story..."
            className={cn("w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case", "focus:outline-none min-h-[150px]")}
            style={{ fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif", fontSize: "20px", lineHeight: "1.6", color: "hsl(var(--foreground))", direction: 'ltr' }}
            role="textbox" aria-multiline="true" aria-label="News article content" suppressContentEditableWarning={true} dir="ltr"
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
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

export default ArticlePage;
