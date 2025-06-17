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
import { Label } from '@/components/ui/label';
import { Loader2, Save, Send, ImageUp, ImageIcon, YoutubeIcon, Link2Icon, SquareCodeIcon, MinusIcon, PlusIcon, XIcon, Trash2, Edit3, CalendarCheck2, AlertTriangle, ArrowLeft, Newspaper, RotateCcw, Bookmark, CheckCircle, MoreVertical, Tag, Search } from 'lucide-react';
import Image from 'next/image';
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
import { format, formatDistanceToNowStrict } from 'date-fns';
import { serverTimestamp } from 'firebase/firestore';
import { SaveToCollectionDialog } from '@/components/collections/SaveToCollectionDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserCollections } from '@/services/collectionService';
import type { ClientCollection } from '@/types/collection';
import { TagsInput } from '@/components/TagsInput';
import { Badge } from '@/components/ui/badge';

const TOOLBAR_HEIGHT = 36;
const TOOLBAR_HORIZONTAL_OFFSET = 40;

const ArticlePage = () => {
  const params = useParams();
  const articleId = params?.articleId as string | undefined;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [article, setArticle] = useState<ClientNewsArticle | null>(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(true);
  const [errorLoadingArticle, setErrorLoadingArticle] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [storyContent, setStoryContent] = useState("<p dir=\"ltr\"><br></p>");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [currentCoverImageUrl, setCurrentCoverImageUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraftOfPublished, setIsSavingDraftOfPublished] = useState(false);
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

  const [isSaveToCollectionDialogOpen, setIsSaveToCollectionDialogOpen] = useState(false);

  const [isHeaderSearchActive, setIsHeaderSearchActive] = useState(false);
  const [headerSearchTerm, setHeaderSearchTerm] = useState('');

  const { data: userCollections = [] } = useQuery<ClientCollection[]>({
    queryKey: ['userCollections', user?.uid, articleId],
    queryFn: () => user ? getUserCollections(user.uid) : Promise.resolve([]),
    enabled: !!user && !!articleId,
  });

  const isArticleSaved = useMemo(() => {
    if (!articleId || !userCollections || userCollections.length === 0) return false;
    return userCollections.some(collection => collection.postIds?.includes(articleId));
  }, [articleId, userCollections]);

  const handleCollectionUpdate = useCallback(() => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: ['userCollections', user.uid, articleId] });
    }
  }, [user, queryClient, articleId]);

  const isEditingAllowed = useMemo(() => {
    return !!user && !!article && user.uid === article.userId;
  }, [article, user]);

  useEffect(() => {
    if (articleId) {
      setIsLoadingArticle(true);
      setErrorLoadingArticle(null);
      setArticle(null);
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
    } else {
      setArticle(null);
      setIsLoadingArticle(false);
      setErrorLoadingArticle(null);
      setTitle("");
      setTags([]);
      setStoryContent("<p dir=\"ltr\"><br></p>");
      setCoverImagePreview(null);
      setCurrentCoverImageUrl(null);
    }
  }, [articleId]);

  useEffect(() => {
    if (article) {
      setTitle(article.title || "");
      setTags(article.tags || []);
      let contentToLoadInEditor = "<p dir=\"ltr\"><br></p>";

      if (isEditingAllowed) {
        if (article.status === 'published' && article.hasUnpublishedChanges && typeof article.draftContent === 'string') {
          contentToLoadInEditor = article.draftContent || "<p dir=\"ltr\"><br></p>";
          toast({ title: "Draft Loaded", description: "You are editing a saved draft of this published article.", duration: 4000 });
        } else {
          contentToLoadInEditor = article.content || "<p dir=\"ltr\"><br></p>";
        }
      } else if (article.status === 'published') {
        contentToLoadInEditor = article.content || "<p dir=\"ltr\"><br></p>";
      } else if (article.status === 'draft' && !isEditingAllowed) {
        contentToLoadInEditor = "<p dir=\"ltr\">Draft content not available for viewing.</p>";
      }
      
      setStoryContent(contentToLoadInEditor);

      setCoverImagePreview(article.coverImageUrl || null);
      setCurrentCoverImageUrl(article.coverImageUrl || null);
      setPublishAttempted(false);
      setTitleError("");
      setTagsError("");
      setStoryError("");
    }
  }, [article, isEditingAllowed, toast]);

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
  }, []);

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
  }, [focusedField, getCurrentBlockElement, titleInputRef]);

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
  }, [focusedField, calculateCursorLineYOffset, getCurrentLineText, isToolbarExpanded, titleInputRef, contentEditableRef, titleWrapperRef, contentWrapperRef, formWrapperRef]);

  useEffect(() => { if (isEditingAllowed) calculateAndUpdateToolbarStyle(); }, [focusedField, selectionNonce, isToolbarExpanded, calculateAndUpdateToolbarStyle, isEditingAllowed]);
  
  useEffect(() => {
    const handleInteraction = () => {
      if (contentEditableRef.current && (document.activeElement === contentEditableRef.current || 
          (titleInputRef.current && document.activeElement === titleInputRef.current))) {
        requestAnimationFrame(() => {
          updateSelectionNonce();
        });
      }
    };

    if (isEditingAllowed) {
      document.addEventListener('selectionchange', handleInteraction);
      document.addEventListener('keyup', handleInteraction);
    }
    return () => {
      document.removeEventListener('selectionchange', handleInteraction);
      document.removeEventListener('keyup', handleInteraction);
    };
  }, [updateSelectionNonce, isEditingAllowed, contentEditableRef, titleInputRef]);


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
    const isEmptyContent = currentHTML.trim() === "" || currentHTML.trim() === "<br>" || currentHTML.trim() === "<p><br></p>" || currentHTML.trim() === "<p></p>" || currentHTML.trim() === "<p dir=\"ltr\"><br></p>" || currentHTML.trim() === "<p dir=\"ltr\"></p>";
    
    const finalHTML = isEmptyContent ? "<p dir=\"ltr\"><br></p>" : currentHTML;
    setStoryContent(finalHTML); 

    if (isEmptyContent && finalHTML === "<p dir=\"ltr\"><br></p>") {
      queueMicrotask(() => {
        if (contentEditableRef.current) {
          const pTag = contentEditableRef.current.querySelector('p[dir="ltr"]');
          if (pTag) {
            const range = document.createRange();
            const sel = window.getSelection();
            try {
              range.setStart(pTag, 0);
              range.collapse(true);
              sel?.removeAllRanges();
              sel?.addRange(range);
            } catch (e) {}
          }
        }
      });
    }

    if (publishAttempted) {
      const currentText = event.currentTarget.textContent || "";
      if (currentText.trim() || /<img|<figure|<video|<pre|<hr/i.test(finalHTML)) {
        setStoryError("");
      } else {
        setStoryError("Story content is required.");
      }
    }
    updateSelectionNonce();
  }, [isEditingAllowed, publishAttempted, setStoryContent, setStoryError, updateSelectionNonce]);

  const handleContentKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isEditingAllowed) return;
    const editorEl = contentEditableRef.current; if (!editorEl) return;
    const selection = window.getSelection(); if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0); const currentBlock = getCurrentBlockElement();
    if (event.key === 'Enter') {
        event.preventDefault(); document.execCommand('insertParagraph', false, undefined);
        if (editorEl) setStoryContent(editorEl.innerHTML); 
        setTimeout(() => { if (contentEditableRef.current) { updateSelectionNonce();}}, 0);
        return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (range.collapsed && currentBlock) {
        const focusNode = selection.focusNode; const focusOffset = selection.focusOffset; let isAtBoundary = false;
        if (event.key === 'Backspace') {
          if ((focusNode === currentBlock && focusOffset === 0) || (focusNode && focusNode.nodeType === Node.TEXT_NODE && currentBlock.contains(focusNode) && focusOffset === 0 && !focusNode.previousSibling) || (focusNode && focusNode.nodeType === Node.ELEMENT_NODE && currentBlock.firstChild === focusNode && focusOffset === 0 && (focusNode.textContent === "" || (focusNode as HTMLElement).tagName === 'BR'))) isAtBoundary = true;
          const prevElement = currentBlock.previousElementSibling;
          if (isAtBoundary && prevElement && (prevElement.tagName === 'FIGURE' || prevElement.getAttribute('data-embed-wrapper') === 'true' || prevElement.tagName === 'PRE' || prevElement.tagName === 'HR')) {
            event.preventDefault(); prevElement.remove();
            if (editorEl) setStoryContent(editorEl.innerHTML); 
            updateSelectionNonce(); return;
          }
        } else { 
          if ((focusNode === currentBlock && focusOffset === currentBlock.childNodes.length) || (focusNode && focusNode.nodeType === Node.TEXT_NODE && currentBlock.contains(focusNode) && focusOffset === focusNode.textContent?.length && !focusNode.nextSibling) || (focusNode && focusNode.nodeType === Node.ELEMENT_NODE && currentBlock.lastChild === focusNode && focusOffset === focusNode.childNodes.length && (focusNode.textContent === "" || (focusNode as HTMLElement).tagName === 'BR'))) isAtBoundary = true;
          const nextElement = currentBlock.nextElementSibling;
          if (isAtBoundary && nextElement && (nextElement.tagName === 'FIGURE' || nextElement.getAttribute('data-embed-wrapper') === 'true' || nextElement.tagName === 'PRE' || nextElement.tagName === 'HR')) {
            event.preventDefault(); nextElement.remove();
            if (editorEl) setStoryContent(editorEl.innerHTML); 
            updateSelectionNonce(); return;
          }
        }
      }
    }
    setTimeout(() => {
        if (editorEl) setStoryContent(editorEl.innerHTML);
        updateSelectionNonce();
    },0);
  }, [getCurrentBlockElement, updateSelectionNonce, isEditingAllowed, setStoryContent]);

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); }
    if (tags.length === 0) { setTagsError("At least one tag is required."); isValid = false; } else { setTagsError(""); }
    const currentEditorHTML = contentEditableRef.current?.innerHTML || "<p dir=\"ltr\"><br></p>";
    const currentTextContent = contentEditableRef.current?.textContent || "";
    if (!currentTextContent.trim() && !/<img|<figure|<video|<pre|<hr/i.test(currentEditorHTML)) { setStoryError("Story content is required."); isValid = false; } else { setStoryError(""); }
    return isValid;
  }, [title, tags]);

  const handleUpdateArticle = async (
    newStatus: NewsArticleStatus,
    contentToSaveParam?: string | null,
    isSavingDraftOfPublishedArticleFlag: boolean = false
  ) => {
    if (!user || !articleId || !article || !isEditingAllowed) {
      toast({ variant: "destructive", title: "Error", description: "Cannot update article. Authorization or data missing." });
      return;
    }
    const latestEditorHTML = contentEditableRef.current?.innerHTML || "<p dir=\"ltr\"><br></p>";
    const contentForThisSaveOperation = contentToSaveParam !== undefined ? contentToSaveParam : latestEditorHTML;
    
    if ((newStatus === 'published' && !isSavingDraftOfPublishedArticleFlag) || (article.status === 'published' && !isSavingDraftOfPublishedArticleFlag) ) {
      setPublishAttempted(true);
      if (!validateFields()) { 
        if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
        else if (tags.length === 0) { /* Error for tags will be shown by TagsInput */ }
        else if (contentEditableRef.current && storyError) contentEditableRef.current.focus();
        return;
      }
    } else if (newStatus === 'draft' || isSavingDraftOfPublishedArticleFlag) { 
      if (!title.trim() || tags.length === 0) {
        setPublishAttempted(true); 
        let validationPassedForDraft = true;
        if (!title.trim()) { setTitleError("Title is required to save a draft."); validationPassedForDraft = false;} else { setTitleError("");}
        if (tags.length === 0) {setTagsError("At least one tag is required to save a draft."); validationPassedForDraft = false;} else {setTagsError("");}
        if (!validationPassedForDraft) {
          toast({variant: "destructive", title: "Cannot Save Draft", description: "Please provide a title and at least one tag."});
          return;
        }
      }
    }

    setIsSubmitting(true);
    if (isSavingDraftOfPublishedArticleFlag) setIsSavingDraftOfPublished(true);

    let newCoverImageUrl: string | null | undefined = undefined;
    try {
      if (coverImageFile) {
        newCoverImageUrl = await uploadNewsCoverImage(coverImageFile, user.uid, articleId);
      } else if (coverImagePreview === null && currentCoverImageUrl !== null) {
        newCoverImageUrl = null;
      }

      const articleUpdateData: UpdateNewsArticleData = {
        title: title.trim(),
        tags: tags,
        status: newStatus,
        content: contentForThisSaveOperation,
      };

      if (newCoverImageUrl !== undefined) {
        articleUpdateData.coverImageUrl = newCoverImageUrl;
      }

      await updateNewsArticle(articleId, articleUpdateData, isSavingDraftOfPublishedArticleFlag);
      
      setStoryContent(contentForThisSaveOperation); 

      let successTitle = "Update Successful";
      let successDescription = `Article "${title.trim()}" updated.`;

      if (isSavingDraftOfPublishedArticleFlag && article.status === 'published') {
        successTitle = "Draft Saved!";
        successDescription = `Your changes to "${title.trim()}" have been saved as a draft. The live article remains unchanged.`;
      } else if (newStatus === 'published') {
        if (article.status !== 'published' || article.hasUnpublishedChanges) {
          successTitle = "Article Published!";
          successDescription = `Changes to "${title.trim()}" are now live.`;
        } else {
          successTitle = "Live Article Updated!";
          successDescription = `Changes to "${title.trim()}" are now live.`;
        }
      } else if (newStatus === 'draft') {
        if (article.status === 'published') {
          successTitle = "Article Unpublished";
          successDescription = `"${title.trim()}" is no longer live. Its content is now a draft.`;
        } else {
          successTitle = "Draft Updated!";
          successDescription = `Draft for "${title.trim()}" has been saved.`;
        }
      }

      toast({ title: successTitle, description: successDescription });

      setPublishAttempted(false); setTitleError(""); setTagsError(""); setStoryError("");
      setIsToolbarExpanded(false); setShowContextualUI(false);

      const fetchedUpdatedArticle = await getNewsArticleById(articleId);
      if (fetchedUpdatedArticle) {
        setArticle(fetchedUpdatedArticle);
        setCurrentCoverImageUrl(newCoverImageUrl === undefined ? currentCoverImageUrl : newCoverImageUrl);
        setCoverImageFile(null);
      }

    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not update the article." });
    } finally {
      setIsSubmitting(false);
      setIsSavingDraftOfPublished(false);
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
      if (currentBlock && editorEl.contains(currentBlock) && (currentBlock.textContent?.trim() === "" || currentBlock.innerHTML.toLowerCase() === "<br>" || currentBlock.innerHTML.toLowerCase() === "<p></p>" || currentBlock.innerHTML.toLowerCase() === "&nbsp;") && currentBlock.innerHTML.toLowerCase() !== "<p dir=\"ltr\"><br></p>") {
        if (range.collapsed && (currentBlock.isSameNode(range.startContainer) || currentBlock.contains(range.startContainer))) {
          const isEditorAndEmptyOrSinglePBR = currentBlock.isSameNode(editorEl) && editorEl.innerHTML.trim().match(/^($|<br\s*\/?>|<p><br\s*\/?><\/p>|<p><\/p>|<p\sdir="ltr"><br\s*\/?><\/p>|<p\sdir="ltr"><\/p>)$/i);
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
      
      setStoryContent(editorEl.innerHTML || "<p dir=\"ltr\"><br></p>");
      
      setIsToolbarExpanded(false);
      queueMicrotask(() => { editorEl.focus(); updateSelectionNonce(); });
    });
  }, [getCurrentBlockElement, updateSelectionNonce, contentEditableRef, setIsToolbarExpanded, savedRange, isEditingAllowed, setStoryContent]);

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
    if (file) { const reader = new FileReader(); reader.onloadend = () => { const dataUri = reader.result as string; insertHTMLAndFocus(`<figure class="my-4 flex flex-col items-center" contenteditable="false"><img src="${dataUri}" alt="User uploaded image" style="max-width: 100%; height: auto; display: block; border-radius: 0.25rem; margin-bottom: 0.5rem;" data-ai-hint="user uploaded" /><figcaption contenteditable="true" data-placeholder="Optional caption..." style="text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem;" class="w-full"></figcaption></figure><p dir=\"ltr\"><br></p>`); }; reader.readAsDataURL(file); if (inlineImageInputRef.current) inlineImageInputRef.current.value = ''; }
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
      if (videoId.match(/^[a-zA-Z0-9_-]{11}$/)) insertHTMLAndFocus(`<figure class="my-4 relative" contenteditable="false" style="padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.25rem;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure><p dir=\"ltr\"><br></p>`);
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
      if (sanitizedCode.trim()) insertHTMLAndFocus(`<div class="my-4 relative" data-embed-wrapper="true" contenteditable="false" style="padding-bottom: 100%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.25rem;"><div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">${sanitizedCode}</div></div><p dir=\"ltr\"><br></p>`);
      else toast({ variant: 'destructive', title: 'Invalid Embed Code', description: 'Please provide valid embed code (e.g., an iframe).' });
    }
    setIsEmbedDialogOpen(false); setSavedRange(null);
  };
  const handleInsertCodeBlock = useCallback(() => {
    if (!isEditingAllowed) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    insertHTMLAndFocus(`<pre class="my-4 p-3 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm" style="white-space: pre-wrap; word-wrap: break-word;" contenteditable="true"><code class="language-plaintext" style="display: block;">\n// Your code here...\n\n</code></pre><p dir=\"ltr\"><br></p>`);
  }, [insertHTMLAndFocus, isEditingAllowed]);
  const handleInsertSeparator = useCallback(() => {
    if (!isEditingAllowed) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange());
    else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); }
    insertHTMLAndFocus(`<hr class="my-8 border-border" /><p dir=\"ltr\"><br></p>`);
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
      setCoverImageFile(null);
      setCoverImagePreview(currentCoverImageUrl);
    }
  };

  const toggleHeaderSearch = () => {
    setIsHeaderSearchActive(!isHeaderSearchActive);
    if (isHeaderSearchActive) { // If it was active and is now being closed
      setHeaderSearchTerm('');
    }
  };

  if (authLoading || isLoadingArticle) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (errorLoadingArticle) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><AlertTriangle className="h-10 w-10 text-destructive mb-3"/><p className="text-lg font-semibold text-destructive">{errorLoadingArticle}</p><Button onClick={() => router.push('/news')} className="mt-4">Back to News</Button></div>;
  if (!article) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><AlertTriangle className="h-10 w-10 text-destructive mb-3"/><p className="text-lg font-semibold text-foreground">Article Not Found</p><Button onClick={() => router.push('/news')} className="mt-4">Back to News</Button></div>;

  if (!isEditingAllowed && article.status === 'draft') {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-lg font-semibold text-foreground">Access Denied</p>
        <p className="text-muted-foreground">You do not have permission to view this draft.</p>
        <Button onClick={() => router.push('/news')} className="mt-4">Back to News</Button>
      </div>
    );
  }

  if (!isEditingAllowed && article.status === 'published') {
    const publishedDateStr = article.publishedAt ? format(new Date(article.publishedAt), 'PPP') : 'Not published';
    const lastEditedDateStr = article.updatedAt ? format(new Date(article.updatedAt), 'PPp') : '';
    const showLastEdited = article.status === 'published' && article.publishedAt && article.updatedAt && (article.updatedAt > (article.publishedAt + 60000));

    return (
      <>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" onClick={() => router.push('/news')} className="text-xs">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to News
          </Button>
          {user && articleId && article && (
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-1"
                title={isArticleSaved ? "Unsave Article" : "Save Article"}
                onClick={(e) => {e.stopPropagation(); setIsSaveToCollectionDialogOpen(true);}}
                aria-pressed={isArticleSaved}
            >
              <Bookmark className={cn("h-5 w-5", isArticleSaved ? "fill-primary text-primary" : "text-muted-foreground")} />
            </Button>
          )}
        </div>
        <article className="max-w-3xl mx-auto">
          <header className="mb-8">
            {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {article.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                </div>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{article.title}</h1>
            <p className="text-sm text-muted-foreground">
              {article.status === 'published'
                ? <>Published on <time dateTime={new Date(article.publishedAt || 0).toISOString()}>{publishedDateStr}</time></>
                : `Draft (Last saved: ${formatDistanceToNowStrict(new Date(article.updatedAt), { addSuffix: true })} ago)`}
              {showLastEdited && ` (Last edited: ${lastEditedDateStr})`}
            </p>
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
      {user && article && articleId && (
          <SaveToCollectionDialog
            isOpen={isSaveToCollectionDialogOpen}
            onOpenChange={(open) => {
              setIsSaveToCollectionDialogOpen(open);
              if (!open) handleCollectionUpdate();
            }}
            postId={articleId}
            postTitle={article.title}
          />
        )}
      </>
    );
  }

  // Editing View
  return (
    <>
    <div className="container mx-auto py-8 px-4 md:px-6" key={articleId}>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => router.push('/news')} className="text-xs h-9 px-3 flex-shrink-0">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to News
        </Button>
        
        <div className="flex items-center flex-grow min-w-0 gap-2">
           <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleHeaderSearch} 
              className="h-9 w-9 p-1.5 flex-shrink-0"
              title={isHeaderSearchActive ? "Close search" : "Search tags"}
            >
              <Search className={cn("h-5 w-5 transition-transform duration-200 ease-in-out", isHeaderSearchActive && "rotate-[30deg]")} />
            </Button>

            {isHeaderSearchActive ? (
              <div className="relative flex-grow min-w-0">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input 
                  type="text" // Changed from "search" to avoid browser default styling/clear buttons if not desired
                  placeholder="Search or add tags..." 
                  value={headerSearchTerm}
                  onChange={(e) => setHeaderSearchTerm(e.target.value)}
                  className="h-9 pl-9 text-xs w-full"
                  autoFocus
                />
              </div>
            ) : (
              <TagsInput
                  value={tags}
                  onChange={setTags}
                  disabled={isSubmitting || !isEditingAllowed}
                  error={publishAttempted && tagsError ? tagsError : null}
                  onPublishAttempt={publishAttempted}
                  className="flex-grow min-w-0 text-xs" // flex-grow will allow it to take space
                  placeholder="Add up to 5 tags (e.g., AI, SaaS, Funding)..."
                  maxTags={5}
              />
            )}
        </div>
        
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {user && articleId && article && (
            <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 p-1.5"
                title={isArticleSaved ? "Unsave Article" : "Save Article"}
                onClick={(e) => {e.stopPropagation(); setIsSaveToCollectionDialogOpen(true);}}
                aria-pressed={isArticleSaved}
                disabled={isSubmitting}
            >
              <Bookmark className={cn("h-5 w-5", isArticleSaved ? "fill-primary text-primary" : "text-muted-foreground")} />
            </Button>
          )}
          {isEditingAllowed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 p-1.5" disabled={isSubmitting}>
                  <MoreVertical className="h-5 w-5" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => coverImageInputRef.current?.click()} disabled={isSubmitting} className="cursor-pointer">
                  <ImageUp className="mr-2 h-4 w-4" />
                  <span>Change Cover Image</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {article?.status === 'draft' ? (
                  <>
                    <DropdownMenuItem onClick={() => handleUpdateArticle('draft', contentEditableRef.current?.innerHTML, false)} disabled={isSubmitting} className="cursor-pointer">
                      <Save className="mr-2 h-4 w-4" /> Save Draft
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateArticle('published', contentEditableRef.current?.innerHTML, false)} disabled={isSubmitting} className="cursor-pointer text-green-600 focus:text-green-700">
                      <Send className="mr-2 h-4 w-4" /> Publish
                    </DropdownMenuItem>
                  </>
                ) : ( 
                  <>
                    <DropdownMenuItem onClick={() => handleUpdateArticle('published', contentEditableRef.current?.innerHTML, true)} disabled={isSubmitting || isSavingDraftOfPublished} className="cursor-pointer">
                      {isSavingDraftOfPublished ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Draft of Published
                    </DropdownMenuItem>
                    
                    {article.hasUnpublishedChanges && article.draftContent ? (
                      <DropdownMenuItem onClick={() => handleUpdateArticle('published', article.draftContent || contentEditableRef.current?.innerHTML, false)} disabled={isSubmitting} className="cursor-pointer text-green-600 focus:text-green-700">
                        <CheckCircle className="mr-2 h-4 w-4" /> Publish Draft Changes
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleUpdateArticle('published', contentEditableRef.current?.innerHTML, false)} disabled={isSubmitting} className="cursor-pointer">
                        <Save className="mr-2 h-4 w-4" /> Update Live Article
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuItem onClick={() => handleUpdateArticle('draft', article.content, false)} disabled={isSubmitting} className="cursor-pointer text-orange-600 focus:text-orange-700">
                      <RotateCcw className="mr-2 h-4 w-4" /> Unpublish
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
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
        
        <Input id="article-image-input-header" type="file" accept="image/*" className="hidden" ref={coverImageInputRef} onChange={handleCoverImageFileChange} disabled={isSubmitting || !isEditingAllowed} />
        <input type="file" ref={inlineImageInputRef} onChange={handleInlineImageFileChange} accept="image/*" style={{ display: 'none' }} disabled={isSubmitting || !isEditingAllowed} />

        {coverImagePreview && (
          <div className="mb-4 relative group">
            <Image src={coverImagePreview} alt="Cover image preview" width={800} height={450} className="rounded-md object-cover w-full max-h-[300px] border" data-ai-hint="news cover"/>
            {isEditingAllowed && <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity p-1" onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); setCurrentCoverImageUrl(null); if(coverImageInputRef.current) coverImageInputRef.current.value = "";}} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        )}
         {article && article.status === 'published' && article.hasUnpublishedChanges && isEditingAllowed && (
            <div className="mb-3 p-2 text-sm bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              You are editing a saved draft. The live article may be different.
              <Button variant="link" size="xs" className="p-0 h-auto text-yellow-700 hover:text-yellow-800" onClick={() => {
                  if (contentEditableRef.current && article.content) {
                      setStoryContent(article.content); 
                      // No need to directly set innerHTML here if storyContent update triggers re-render
                  }
                  toast({title: "Viewing Live Content", description: "Editor now shows the live published content. Any unsaved draft changes were not applied."});
              }}>View live content</Button>
            </div>
        )}
        <div ref={titleWrapperRef} className="relative mb-4">
          <Input ref={titleInputRef} placeholder="Title" value={title} onChange={(e) => { setTitle(e.target.value); if (publishAttempted) { if (e.target.value.trim()) setTitleError(""); else setTitleError("Title is required."); } updateSelectionNonce(); }} onFocus={() => handleFocus('title')} onBlur={handleBlur} onKeyUp={updateSelectionNonce} className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2" autoComplete="off" disabled={isSubmitting || !isEditingAllowed} />
          {publishAttempted && titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
        </div>
        <div ref={contentWrapperRef} className="relative">
          <div
            key={articleId}
            ref={contentEditableRef} contentEditable={isEditingAllowed && !isSubmitting} onInput={handleContentEditableInput} onFocus={() => handleFocus('content')} onBlur={handleBlur} onKeyDown={handleContentKeyDown} onClick={updateSelectionNonce} onKeyUp={updateSelectionNonce} data-placeholder="Tell your story..."
            className={cn("w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case", "focus:outline-none min-h-[150px]")}
            style={{ fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif", fontSize: "20px", lineHeight: "1.6", color: "hsl(var(--foreground))", direction: 'ltr' }}
            role="textbox" aria-multiline="true" aria-label="News article content" suppressContentEditableWarning={true} dir="ltr"
            dangerouslySetInnerHTML={{ __html: storyContent }}
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
    {user && article && articleId && (
      <SaveToCollectionDialog
        isOpen={isSaveToCollectionDialogOpen}
        onOpenChange={(open) => {
            setIsSaveToCollectionDialogOpen(open);
            if (!open) handleCollectionUpdate();
        }}
        postId={articleId}
        postTitle={article.title}
      />
    )}
    </>
  );
};

export default ArticlePage;
