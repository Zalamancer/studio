
// src/components/news/NewsCommentItem.tsx
"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Trash2, Send, Heart, CornerDownRight, Eye, EyeOff } from 'lucide-react';
import type { ClientComment, ClientSubComment, NewSubCommentData } from '@/types/comment';
import {
  toggleLikeNewsComment,
  toggleShadowBanNewsComment,
  deleteNewsComment,
  addNewsSubCommentToNewsComment,
  getNewsSubCommentsForComment,
  toggleLikeNewsSubComment,
  toggleShadowBanNewsSubComment,
  deleteNewsSubComment
} from '@/services/commentService';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { fetchUserProfileBasic, getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { TextWithMentions } from '@/components/board-page/TextWithMentions'; // Reusing this component

const IS_UID_REGEX_NEWS_COMMENT = /^[a-zA-Z0-9]{20,}$/;

const extractMentionedUidsForNewsReply = (text: string, profilesToSearch: UserProfileBasic[]): string[] => {
  const mentionRegex = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,28})/g;
  const textualMentions = new Set<string>();
  for (const match of text.matchAll(mentionRegex)) {
    if (match[1]) textualMentions.add(match[1].trim());
  }
  const resolvedUids = new Set<string>();
  for (const textualMention of textualMentions) {
    const foundProfile = profilesToSearch.find(p => p.mentionName?.toLowerCase() === textualMention.toLowerCase());
    if (foundProfile) resolvedUids.add(foundProfile.userId);
    else if (IS_UID_REGEX_NEWS_COMMENT.test(textualMention)) resolvedUids.add(textualMention);
  }
  return Array.from(resolvedUids);
};

interface NewsSubCommentItemProps {
  subComment: ClientSubComment;
  currentUserId: string | null;
  articleId: string;
  commentId: string; // Parent comment ID
  articleAuthorId: string;
  onDelete: () => void;
  onStartReply: (replyTo: ClientSubComment) => void;
}

const NewsSubCommentItem: React.FC<NewsSubCommentItemProps> = React.memo(({
  subComment,
  currentUserId,
  articleId,
  commentId,
  articleAuthorId,
  onDelete,
  onStartReply
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOwnSubComment = subComment.userId === currentUserId;
  const isArticleAuthor = articleAuthorId === currentUserId;
  const [isLiking, setIsLiking] = useState(false);
  const [isBanning, setIsBanning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasLiked = !!(currentUserId && subComment.likedBy?.includes(currentUserId));
  const displayAnonymousName = subComment.mentionName || subComment.userName || generateAnonymousName(subComment.userId);

  const handleLikeSubComment = async () => {
    if (!user || isLiking) return;
    setIsLiking(true);
    try {
      await toggleLikeNewsSubComment(articleId, commentId, subComment.id, user.uid);
      queryClient.invalidateQueries({ queryKey: ['newsSubComments', articleId, commentId] });
    } catch (err) {
      toast({ variant: "destructive", title: "Like Failed", description: (err as Error).message });
    } finally {
      setIsLiking(false);
    }
  };

  const handleToggleShadowBanSubComment = async () => {
    if (!isArticleAuthor || isBanning) return;
    setIsBanning(true);
    try {
      await toggleShadowBanNewsSubComment(articleId, commentId, subComment.id, !subComment.isShadowBanned, currentUserId!);
      queryClient.invalidateQueries({ queryKey: ['newsSubComments', articleId, commentId] });
      toast({ title: `Reply ${!subComment.isShadowBanned ? "Hidden" : "Shown"}` });
    } catch (err) {
      toast({ variant: "destructive", title: "Action Failed", description: (err as Error).message });
    } finally {
      setIsBanning(false);
    }
  };
  
  const handleDeleteSubComment = async () => {
      if (!isOwnSubComment || isDeleting) return;
      setIsDeleting(true);
      try {
          await deleteNewsSubComment(articleId, commentId, subComment.id, currentUserId!);
          onDelete(); // This should trigger refetch in parent (NewsCommentItem)
          toast({ title: "Reply Deleted" });
      } catch (error: any) {
          toast({ variant: "destructive", title: "Delete Failed", description: error.message });
      } finally {
          setIsDeleting(false);
      }
  };

  return (
    <div className={cn("flex items-start gap-2 group", subComment.isShadowBanned && isArticleAuthor && "opacity-60 bg-yellow-50/50 p-1 rounded-md border border-dashed border-yellow-300")}>
      <Link href={`/profile/${subComment.userId}`} passHref>
        <Avatar className="h-6 w-6 mt-1 flex-shrink-0 cursor-pointer">
          <AvatarImage src={subComment.userAvatar} alt={displayAnonymousName} />
          <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">{getInitials(displayAnonymousName)}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-grow bg-background p-2 rounded-md min-w-0 border border-border/50">
        <div className="flex justify-between items-center mb-1">
          <Link href={`/profile/${subComment.userId}`} passHref><p className="text-xs font-medium text-foreground truncate hover:underline cursor-pointer">{displayAnonymousName}</p></Link>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <p className="text-xs text-muted-foreground">{new Date(subComment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            {user && (<Button variant="ghost" size="xs" onClick={handleLikeSubComment} disabled={isLiking} className={cn("text-xs h-auto p-0.5 flex items-center gap-0.5", hasLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500")} aria-pressed={hasLiked}>
              {isLiking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Heart className={cn("h-3 w-3", hasLiked && "fill-current")} />}
              {(subComment.likeCount ?? 0) > 0 && <span className="text-xs ml-0.5">({subComment.likeCount})</span>}
            </Button>)}
            {user && (<Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-muted-foreground/70 hover:text-primary opacity-0 group-hover:opacity-100" onClick={() => onStartReply(subComment)} title="Reply"><CornerDownRight className="h-3 w-3" /></Button>)}
            {isArticleAuthor && !isOwnSubComment && (<Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 opacity-0 group-hover:opacity-100" onClick={handleToggleShadowBanSubComment} disabled={isBanning} title={subComment.isShadowBanned ? "Unhide Reply" : "Hide Reply (Shadow Ban)"}>
                {isBanning ? <Loader2 className="h-3 w-3 animate-spin"/> : subComment.isShadowBanned ? <Eye className="h-3 w-3 text-green-600"/> : <EyeOff className="h-3 w-3 text-orange-500"/>}
            </Button>)}
            {isOwnSubComment && (<AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-muted-foreground/70 hover:text-destructive opacity-0 group-hover:opacity-100" disabled={isDeleting}><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Reply?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteSubComment} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent></AlertDialog>)}
          </div>
        </div>
        <p className="text-sm text-muted-foreground break-words"><TextWithMentions text={subComment.text} mentionedUserIds={subComment.mentionedUserIds || []} /></p>
        {subComment.isShadowBanned && isArticleAuthor && <Badge variant="outline" className="text-xs mt-1 bg-yellow-100 text-yellow-700 border-yellow-300">Hidden from others</Badge>}
      </div>
    </div>
  );
});
NewsSubCommentItem.displayName = 'NewsSubCommentItem';

interface NewsCommentItemProps {
  comment: ClientComment;
  currentUserId: string | null;
  articleId: string;
  articleAuthorId: string;
  onDelete: (commentId: string) => void;
}

export const NewsCommentItem: React.FC<NewsCommentItemProps> = React.memo(({ comment, currentUserId, articleId, articleAuthorId, onDelete }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwnComment = comment.userId === currentUserId;
  const isArticleAuthor = articleAuthorId === currentUserId;
  const [showReplies, setShowReplies] = useState(false);
  const [newReply, setNewReply] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isBanning, setIsBanning] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [debouncedMentionQuery, setDebouncedMentionQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const suggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const [replyingToSubComment, setReplyingToSubComment] = useState<ClientSubComment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasLiked = !!(currentUserId && comment.likedBy?.includes(currentUserId));
  const displayAnonymousName = comment.mentionName || comment.userName || generateAnonymousName(comment.userId);

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedMentionQuery(mentionQuery); }, 300);
    return () => clearTimeout(handler);
  }, [mentionQuery]);

  const { data: subComments = [], isLoading: isLoadingSubComments, refetch: refetchSubComments } = useQuery<ClientSubComment[]>({
    queryKey: ['newsSubComments', articleId, comment.id],
    queryFn: () => getNewsSubCommentsForComment(articleId, comment.id),
    enabled: showReplies && !!user,
    staleTime: 1000 * 60 * 1,
  });

  const { data: profilesForReplySuggestions = [], isLoading: isLoadingProfilesForReply } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForNewsReply', comment.id, debouncedMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedMentionQuery, debouncedMentionQuery ? 10 : 25),
    enabled: isReplying && showSuggestions && !!user,
  });

  const allRelevantProfilesForReplyContext = useMemo(() => { /* ... (same as CommentItem) ... */
    const profiles = new Map<string, UserProfileBasic>();
    if (user) profiles.set(user.uid, { userId: user.uid, mentionName: generateAnonymousName(user.uid), displayName: user.displayName || generateAnonymousName(user.uid) });
    if (articleAuthorId) profiles.set(articleAuthorId, { userId: articleAuthorId, mentionName: generateAnonymousName(articleAuthorId), displayName: generateAnonymousName(articleAuthorId) });
    profiles.set(comment.userId, { userId: comment.userId, mentionName: displayAnonymousName, displayName: displayAnonymousName, avatarUrl: comment.userAvatar });
    subComments.forEach(sc => { if (!profiles.has(sc.userId)) profiles.set(sc.userId, { userId: sc.userId, mentionName: sc.mentionName || sc.userName || generateAnonymousName(sc.userId), displayName: sc.userName || generateAnonymousName(sc.userId), avatarUrl: sc.userAvatar }); });
    profilesForReplySuggestions.forEach(p => { if (!profiles.has(p.userId)) profiles.set(p.userId, p); });
    return Array.from(profiles.values());
  }, [user, articleAuthorId, comment, subComments, profilesForReplySuggestions, displayAnonymousName]);

  const filteredSuggestionsForReply = useMemo(() => { /* ... (same as CommentItem) ... */
    if (!showSuggestions || !isReplying) return [];
    if (isLoadingProfilesForReply && debouncedMentionQuery) return [{ userId: 'loading-reply-news', mentionName: 'loading-reply-news', displayName: 'Loading users...' } as UserProfileBasic];
    let source = allRelevantProfilesForReplyContext.filter(p => p.userId !== currentUserId && !!p.mentionName);
    if (debouncedMentionQuery.trim()) {
      const queryLower = debouncedMentionQuery.toLowerCase();
      source = source.filter(p => p.mentionName.toLowerCase().includes(queryLower) || (p.displayName && p.displayName.toLowerCase().includes(queryLower)) || (p.companyName && p.companyName.toLowerCase().includes(queryLower)));
    } else {
        const threadParticipants = new Map<string, UserProfileBasic>();
        if(articleAuthorId && !threadParticipants.has(articleAuthorId)) threadParticipants.set(articleAuthorId, {userId: articleAuthorId, mentionName: generateAnonymousName(articleAuthorId), displayName: generateAnonymousName(articleAuthorId)});
        if(!threadParticipants.has(comment.userId)) threadParticipants.set(comment.userId, {userId: comment.userId, mentionName: displayAnonymousName, displayName: displayAnonymousName, avatarUrl: comment.userAvatar });
        subComments.forEach(sc => { if(!threadParticipants.has(sc.userId)) threadParticipants.set(sc.userId, {userId: sc.userId, mentionName: sc.mentionName || sc.userName || generateAnonymousName(sc.userId), displayName: sc.userName || generateAnonymousName(sc.userId), avatarUrl: sc.userAvatar }); });
        source = Array.from(threadParticipants.values()).filter(p => p.userId !== currentUserId);
        if (source.length === 0 && profilesForReplySuggestions.length > 0) source = profilesForReplySuggestions.filter(p => p.userId !== currentUserId && !!p.mentionName).slice(0,5);
    }
    if (source.length === 0 && debouncedMentionQuery.trim() !== '') return [{ userId: 'no-match-reply-news', mentionName: 'no-match-reply-news', displayName: `No users matching "@${debouncedMentionQuery}"` } as UserProfileBasic];
    if (source.length === 0) return [{ userId: 'no-users-reply-news', mentionName: 'no-users-reply-news', displayName: 'No users to suggest.' } as UserProfileBasic];
    return source.slice(0, 10);
  }, [debouncedMentionQuery, allRelevantProfilesForReplyContext, isLoadingProfilesForReply, showSuggestions, isReplying, currentUserId, comment.userId, subComments, displayAnonymousName, articleAuthorId, profilesForReplySuggestions]);


  const handleDeleteComment = async () => {
    if (!isOwnComment || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteNewsComment(articleId, comment.id, currentUserId!);
      onDelete(comment.id);
      toast({ title: "Comment Deleted" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Delete Failed", description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleShadowBanComment = async () => {
    if (!isArticleAuthor || isBanning) return;
    setIsBanning(true);
    try {
      await toggleShadowBanNewsComment(articleId, comment.id, !comment.isShadowBanned, currentUserId!);
      queryClient.invalidateQueries({ queryKey: ['newsComments', articleId] });
      toast({ title: `Comment ${!comment.isShadowBanned ? "Hidden" : "Shown"}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Failed", description: error.message });
    } finally {
      setIsBanning(false);
    }
  };

  const handleLikeComment = async () => {
    if (!user || isLiking) return;
    setIsLiking(true);
    try {
      await toggleLikeNewsComment(articleId, comment.id, user.uid);
      queryClient.invalidateQueries({ queryKey: ['newsComments', articleId] });
    } catch (err) {
      toast({ variant: "destructive", title: "Like Failed", description: (err as Error).message });
    } finally {
      setIsLiking(false);
    }
  };

  const handleReplySubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newReply.trim() || isSubmittingReply) return;
    setIsSubmittingReply(true);
    const finalMentionedUids = extractMentionedUidsForNewsReply(newReply.trim(), allRelevantProfilesForReplyContext);
    const replyData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'> = {
      userId: user.uid,
      text: newReply.trim(),
      mentionedUserIds: finalMentionedUids,
      isShadowBanned: false,
    };
    try {
      await addNewsSubCommentToNewsComment(articleId, comment.id, replyData);
      toast({ title: "Reply Added" });
      setNewReply(''); setShowSuggestions(false); setMentionQuery(''); setReplyingToSubComment(null);
      if (!showReplies) setShowReplies(true); else refetchSubComments();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Reply Failed", description: error.message });
    } finally {
      setIsSubmittingReply(false);
    }
  }, [user, newReply, isSubmittingReply, articleId, comment.id, showReplies, refetchSubComments, toast, allRelevantProfilesForReplyContext]);
  
  const evaluateMentionState = useCallback((text: string, cursorPosition: number) => { /* ... (same as CommentItem) ... */
    let activeQuery = null; const textBeforeCursor = text.substring(0, cursorPosition); const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
        const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
        if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) activeQuery = potentialQuery;
    }
    setMentionQuery(activeQuery !== null ? activeQuery : ''); setShowSuggestions(activeQuery !== null);
  }, [setMentionQuery, setShowSuggestions]);

  const handleMentionInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { /* ... (same as CommentItem) ... */
    const value = e.target.value; setNewReply(value); evaluateMentionState(value, e.target.selectionStart || 0);
  }, [setNewReply, evaluateMentionState]);

  const handleMentionInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => { /* ... (same as CommentItem) ... */
    evaluateMentionState(e.target.value, e.target.selectionStart || 0);
  }, [evaluateMentionState]);

  const handleSelectSuggestion = useCallback((profile: UserProfileBasic) => { /* ... (same as CommentItem) ... */
    if (!replyInputRef.current || !profile.mentionName) return; const currentValue = newReply; const cursorPosition = replyInputRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition); const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1) {
        const textBeforeMention = currentValue.substring(0, lastAtIndex); const textAfterCursor = currentValue.substring(cursorPosition);
        const mentionToInsert = profile.mentionName; setNewReply(`${textBeforeMention}@${mentionToInsert} ${textAfterCursor}`);
        const newCursorPosition = textBeforeMention.length + `@${mentionToInsert} `.length;
        setTimeout(() => { replyInputRef.current?.focus(); replyInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition); }, 0);
    }
    setShowSuggestions(false); setMentionQuery('');
  }, [newReply, setNewReply, setMentionQuery, setShowSuggestions]);

  useEffect(() => { /* ... (same as CommentItem for click outside popover) ... */
    const handleClickOutside = (event: MouseEvent) => { if (showSuggestions && suggestionsPopoverRef.current && !suggestionsPopoverRef.current.contains(event.target as Node) && replyInputRef.current && !replyInputRef.current.contains(event.target as Node)) { if (showSuggestions) setShowSuggestions(false); } };
    if (showSuggestions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);


  const toggleShowReplies = useCallback(() => setShowReplies(prev => !prev), []);
  const toggleReplyForm = useCallback(() => { setIsReplying(prev => { if (!prev) { setNewReply(''); setReplyingToSubComment(null); evaluateMentionState("", 0); setTimeout(() => replyInputRef.current?.focus(), 0); } else { setShowSuggestions(false); setMentionQuery(''); } return !prev; }); }, [evaluateMentionState, setNewReply]);
  const handleSubCommentDeleted = useCallback(() => refetchSubComments(), [refetchSubComments]);
  const handleStartSubCommentReply = useCallback((subCommentToReplyTo: ClientSubComment) => { if (!user) return; setIsReplying(true); const subCommentAuthorMentionName = subCommentToReplyTo.mentionName || subCommentToReplyTo.userName || generateAnonymousName(subCommentToReplyTo.userId); const initialReplyText = `@${subCommentAuthorMentionName} `; setNewReply(initialReplyText); setReplyingToSubComment(subCommentToReplyTo); evaluateMentionState(initialReplyText, initialReplyText.length); setTimeout(() => { replyInputRef.current?.focus(); if (replyInputRef.current) { const len = replyInputRef.current.value.length; replyInputRef.current.setSelectionRange(len, len); } }, 0); }, [user, setNewReply, setIsReplying, setReplyingToSubComment, evaluateMentionState]);


  return (
    <div className={cn("group border-b border-border/50 pb-4", comment.isShadowBanned && isArticleAuthor && "opacity-60 bg-yellow-50/50 p-2 rounded-md border-dashed border-yellow-300")}>
      <div className="flex items-start gap-3 ">
        <Link href={`/profile/${comment.userId}`} passHref><Avatar className="h-8 w-8 mt-1 flex-shrink-0 cursor-pointer"><AvatarImage src={comment.userAvatar} alt={displayAnonymousName} /><AvatarFallback className="text-xs bg-muted text-muted-foreground">{getInitials(displayAnonymousName)}</AvatarFallback></Avatar></Link>
        <div className="flex-grow bg-muted/50 p-3 rounded-lg min-w-0">
          <div className="flex justify-between items-center mb-1">
            <Link href={`/profile/${comment.userId}`} passHref><p className="text-sm font-medium text-foreground truncate hover:underline cursor-pointer">{displayAnonymousName}</p></Link>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <p className="text-xs text-muted-foreground">{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              {user && (<Button variant="ghost" size="xs" onClick={handleLikeComment} disabled={isLiking} className={cn("text-xs h-auto p-0.5 flex items-center gap-0.5", hasLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500")} aria-pressed={hasLiked}>
                {isLiking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Heart className={cn("h-3 w-3", hasLiked && "fill-current")} />}
                {(comment.likeCount ?? 0) > 0 && <span className="text-xs ml-0.5">({comment.likeCount})</span>}
              </Button>)}
              {isArticleAuthor && !isOwnComment && (<Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 opacity-0 group-hover:opacity-100" onClick={handleToggleShadowBanComment} disabled={isBanning} title={comment.isShadowBanned ? "Unhide Comment" : "Hide Comment (Shadow Ban)"}>
                {isBanning ? <Loader2 className="h-3 w-3 animate-spin"/> : comment.isShadowBanned ? <Eye className="h-3 w-3 text-green-600"/> : <EyeOff className="h-3 w-3 text-orange-500"/>}
              </Button>)}
              {isOwnComment && (<AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/70 hover:text-destructive opacity-0 group-hover:opacity-100" disabled={isDeleting}><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Comment?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. Deleting this comment will also remove all its replies.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteComment} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent></AlertDialog>)}
            </div>
          </div>
          <p className="text-sm text-muted-foreground break-words"><TextWithMentions text={comment.text} mentionedUserIds={comment.mentionedUserIds || []} /></p>
          {comment.isShadowBanned && isArticleAuthor && <Badge variant="outline" className="text-xs mt-1 bg-yellow-100 text-yellow-700 border-yellow-300">Hidden from others</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-3 pl-11 mt-2">
        {user && (<Button variant="ghost" size="xs" onClick={toggleReplyForm} className="text-xs text-muted-foreground hover:text-primary h-auto p-1"><CornerDownRight className="h-3 w-3 mr-1" /> Reply</Button>)}
        <Button variant="ghost" size="xs" onClick={toggleShowReplies} className="text-xs text-muted-foreground hover:text-primary h-auto p-1">{isLoadingSubComments ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : showReplies ? 'Hide Replies' : `View Replies ${subComments.length > 0 ? `(${subComments.length})` : ''}`}</Button>
      </div>
      {isReplying && user && (<Popover open={showSuggestions && filteredSuggestionsForReply.length > 0 && !['loading-reply-news', 'no-users-reply-news', 'no-match-reply-news'].includes(filteredSuggestionsForReply[0]?.userId)} onOpenChange={(open) => { setShowSuggestions(open); if (!open) setMentionQuery(''); }}>
          <PopoverTrigger asChild><form onSubmit={handleReplySubmit} className="flex items-center gap-2 pl-11 mt-2 relative">
            <Input ref={replyInputRef} type="text" placeholder={`Replying to ${displayAnonymousName}...`} value={newReply} onChange={handleMentionInputChange} onFocus={handleMentionInputFocus} onKeyDown={(e) => { if (showSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) { if (e.key !== 'Escape') e.preventDefault(); } }} onBlurCapture={() => setTimeout(() => { if (suggestionsPopoverRef.current && !suggestionsPopoverRef.current.contains(document.activeElement as Node) && replyInputRef.current !== document.activeElement) { if(showSuggestions) setShowSuggestions(false); } }, 150)} disabled={isSubmittingReply} className="flex-grow h-8 text-sm" aria-label="New reply input" autoComplete="off" />
            <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={!newReply.trim() || isSubmittingReply}>{isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}<span className="sr-only">Send Reply</span></Button>
          </form></PopoverTrigger>
          <PopoverContent ref={suggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
            {filteredSuggestionsForReply.map(profile => ( (profile.userId === 'loading-reply-news' || profile.userId === 'no-users-reply-news' || profile.userId === 'no-match-reply-news') ? (<div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>) : (<Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectSuggestion(profile)}><Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName} /><AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback></Avatar><div className="flex flex-col items-start"><span className={cn("text-muted-foreground", (profile.displayName && profile.displayName.toLowerCase() !== profile.mentionName.toLowerCase()) ? "" : "font-medium text-foreground")}>{profile.displayName || profile.mentionName}</span>{(profile.displayName && profile.displayName.toLowerCase() !== profile.mentionName.toLowerCase()) && <span className="font-medium text-foreground text-xs">@{profile.mentionName}</span>}</div></Button>) ))}
          </PopoverContent></Popover>)}
      {showReplies && (<div className="pl-11 mt-3 space-y-3 border-l-2 border-border ml-5">
        {isLoadingSubComments ? <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
          : subCommentsError ? <p className="text-xs text-destructive pl-2">Error loading replies.</p>
          : subComments.length === 0 ? <p className="text-xs text-muted-foreground pl-2">No replies yet.</p>
          : subComments.map((subComment) => (
            <NewsSubCommentItem key={subComment.id} subComment={subComment} currentUserId={currentUserId} articleId={articleId} commentId={comment.id} articleAuthorId={articleAuthorId} onDelete={handleSubCommentDeleted} onStartReply={handleStartSubCommentReply} />
          ))}
      </div>)}
    </div>
  );
});
NewsCommentItem.displayName = 'NewsCommentItem';

```
  </change>

  <change>
    <file>/src/app/news/article/[articleId]/page.tsx</file>
    <content><![CDATA[
// src/app/news/article/[articleId]/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getNewsArticleById, updateNewsArticle, toggleLikeNewsArticle, incrementNewsArticleCommentCount, decrementNewsArticleCommentCount } from '@/services/newsService';
import { uploadNewsCoverImage } from '@/services/storageService';
import type { ClientNewsArticle, UpdateNewsArticleData, NewsArticleStatus } from '@/types/news';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Send, ImageUp, ImageIcon, YoutubeIcon, Link2Icon, SquareCodeIcon, MinusIcon, XIcon, Trash2, Edit3, CalendarCheck2, AlertTriangle, ArrowLeft, Newspaper, RotateCcw, Bookmark, CheckCircle, MoreVertical, Search, X as CloseIcon, Tag, PlusCircle, MessageSquare, Heart } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { searchTags, getOrCreateTagsAndUpdateUsage } from '@/services/tagService';
import type { ClientTag } from '@/types/tag';
import { NewsCommentItem } from '@/components/news/NewsCommentItem';
import { addNewsCommentToArticle, getNewsCommentsForArticle } from '@/services/commentService';
import type { NewCommentData, ClientComment } from '@/types/comment';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { fetchUserProfileBasic, getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { TextWithMentions } from '@/components/board-page/TextWithMentions'; // Re-use existing for consistency
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';

const TOOLBAR_HEIGHT = 36;
const TOOLBAR_HORIZONTAL_OFFSET = 40;

const extractMentionedUidsForNewsComment = (text: string, profilesToSearch: UserProfileBasic[]): string[] => {
  const mentionRegex = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,28})/g;
  const textualMentions = new Set<string>();
  for (const match of text.matchAll(mentionRegex)) {
    if (match[1]) textualMentions.add(match[1].trim());
  }
  const resolvedUids = new Set<string>();
  for (const textualMention of textualMentions) {
    const foundProfile = profilesToSearch.find(p => p.mentionName?.toLowerCase() === textualMention.toLowerCase());
    if (foundProfile) resolvedUids.add(foundProfile.userId);
    else if (IS_VALID_FIREBASE_UID_REGEX.test(textualMention)) resolvedUids.add(textualMention);
  }
  return Array.from(resolvedUids);
};


const ArticlePage = () => {
  const params = useParams();
  const articleIdParam = params?.articleId as string | undefined;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Moved useQuery for article here
  const { data: article, isLoading: isLoadingArticle, error: errorLoadingArticle, refetch: refetchArticle } = useQuery<ClientNewsArticle | null>({
    queryKey: ['newsArticle', articleIdParam],
    queryFn: () => articleIdParam ? getNewsArticleById(articleIdParam) : Promise.resolve(null),
    enabled: !!articleIdParam,
  });

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [storyContent, setStoryContent] = useState("<p><br></p>");
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

  const [isHeaderSearchActive, setIsHeaderSearchActive] = useState(false);
  const [headerSearchTerm, setHeaderSearchTerm] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<ClientTag[]>([]);
  const [isTagSuggestionsLoading, setIsTagSuggestionsLoading] = useState(false);
  const [isTagSuggestionsPopoverOpen, setIsTagSuggestionsPopoverOpen] = useState(false);
  const headerSearchInputRef = useRef<HTMLInputElement>(null);
  const tagSuggestionsPopoverContentRef = useRef<HTMLDivElement>(null);
  const [debouncedHeaderSearchTerm, setDebouncedHeaderSearchTerm] = useState('');

  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const [isLikingArticle, setIsLikingArticle] = useState(false);


  const isEditingAllowed = useMemo(() => !!user && !!article && user.uid === article.userId, [article, user]);

  useEffect(() => {
    if (article) {
      setTitle(article.title || "");
      setTags(article.tags || []);
      let contentToLoadInEditor = "<p><br></p>";
      if (isEditingAllowed) {
        if (article.status === 'published' && article.hasUnpublishedChanges && typeof article.draftContent === 'string') {
          contentToLoadInEditor = article.draftContent;
          // toast({ title: "Draft Loaded", description: "You are editing a saved draft of this published article.", duration: 4000 });
        } else {
          contentToLoadInEditor = article.content || "<p><br></p>";
        }
      } else if (article.status === 'published') {
        contentToLoadInEditor = article.content || "<p><br></p>";
      }
      setStoryContent(contentToLoadInEditor);
      if (contentEditableRef.current && contentEditableRef.current.innerHTML !== contentToLoadInEditor) {
        contentEditableRef.current.innerHTML = contentToLoadInEditor;
      }
      setCoverImagePreview(article.coverImageUrl || null);
      setCurrentCoverImageUrl(article.coverImageUrl || null);
      setPublishAttempted(false); setTitleError(""); setTagsError(""); setStoryError("");
    } else if (!isLoadingArticle && articleIdParam && !errorLoadingArticle) {
      // Article might be null because it doesn't exist or access denied
      // Handled by the main return logic
    }
  }, [article, isEditingAllowed, isLoadingArticle, articleIdParam, errorLoadingArticle]);


  // --- Comment Section Logic ---
  const { data: newsComments = [], isLoading: isLoadingNewsComments, refetch: refetchNewsComments } = useQuery<ClientComment[]>({
    queryKey: ['newsComments', articleIdParam],
    queryFn: () => articleIdParam ? getNewsCommentsForArticle(articleIdParam) : Promise.resolve([]),
    enabled: !!articleIdParam && !!user, // Only fetch if article ID and user exist
  });

  const addNewsCommentMutation = useMutation({
    mutationFn: (data: { articleId: string; commentData: Omit<NewCommentData, 'likeCount' | 'likedBy' | 'isShadowBanned'> }) =>
      addNewsCommentToArticle(data.articleId, data.commentData),
    onSuccess: () => {
      toast({ title: "Comment Posted" });
      setNewComment('');
      refetchNewsComments();
      refetchArticle(); // To update commentCount on the article
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Failed to Post Comment", description: error.message }),
    onSettled: () => setIsSubmittingComment(false),
  });

  const { data: profilesForNewCommentSuggestions = [] } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForNewsComment', debouncedNewCommentMentionQuery, user?.uid],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, 10),
    enabled: showNewCommentSuggestions && !!user,
  });
  
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedNewCommentMentionQuery(newCommentMentionQuery); }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !articleIdParam || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    const finalMentionedUids = extractMentionedUidsForNewsComment(newComment.trim(), profilesForNewCommentSuggestions);
    const commentPayload: Omit<NewCommentData, 'likeCount' | 'likedBy' | 'isShadowBanned'> = {
      userId: user.uid,
      text: newComment.trim(),
      mentionName: generateAnonymousName(user.uid), // Get user's mention name
      mentionedUserIds: finalMentionedUids,
    };
    addNewsCommentMutation.mutate({ articleId: articleIdParam, commentData: commentPayload });
  };

  const evaluateNewCommentMentionState = useCallback((text: string, cursorPosition: number) => { /* ... (same as PostDetailPanel) ... */
    let activeQuery = null; const textBeforeCursor = text.substring(0, cursorPosition); const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\r\n|\r|\n/.test(potentialQuery)) activeQuery = potentialQuery;
    }
    setNewCommentMentionQuery(activeQuery !== null ? activeQuery : ''); setShowNewCommentSuggestions(activeQuery !== null);
  }, [setNewCommentMentionQuery, setShowNewCommentSuggestions]);
  const handleNewCommentInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const value = e.target.value; setNewComment(value); if (newCommentInputRef.current) evaluateNewCommentMentionState(value, newCommentInputRef.current.selectionStart || 0); }, [evaluateNewCommentMentionState, setNewComment, newCommentInputRef]);
  const handleNewCommentInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => { if (newCommentInputRef.current) evaluateNewCommentMentionState(e.target.value, newCommentInputRef.current.selectionStart || 0); }, [evaluateNewCommentMentionState, newCommentInputRef]);
  const handleSelectNewCommentSuggestion = useCallback((profile: UserProfileBasic) => { /* ... (same as PostDetailPanel) ... */
    if (!newCommentInputRef.current || !profile.mentionName) return; const currentValue = newComment; const cursorPosition = newCommentInputRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition); const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1) {
      const textBeforeMention = currentValue.substring(0, lastAtIndex); const textAfterCursor = currentValue.substring(cursorPosition);
      setNewComment(`${textBeforeMention}@${profile.mentionName} ${textAfterCursor}`);
      const newCursorPosition = textBeforeMention.length + `@${profile.mentionName} `.length;
      setTimeout(() => { newCommentInputRef.current?.focus(); newCommentInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition); }, 0);
    }
    setShowNewCommentSuggestions(false); setNewCommentMentionQuery('');
  }, [newComment, setNewComment, setShowNewCommentSuggestions, setNewCommentMentionQuery, newCommentInputRef]);
  useEffect(() => { /* ... (same as PostDetailPanel for click outside popover) ... */
    const handleClickOutside = (event: MouseEvent) => { if (showNewCommentSuggestions && newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(event.target as Node) && newCommentInputRef.current && !newCommentInputRef.current.contains(event.target as Node)) { setShowNewCommentSuggestions(false); } };
    if (showNewCommentSuggestions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewCommentSuggestions]);
  const filteredNewCommentSuggestions = useMemo(() => { /* ... (same as PostDetailPanel, adjust loading/no-match IDs if needed) ... */
    if (!showNewCommentSuggestions) return []; if (profilesForNewCommentSuggestions.length === 0 && debouncedNewCommentMentionQuery) return [{ userId: 'no-match-news-comment', displayName: `No users matching "@${debouncedNewCommentMentionQuery}"`, mentionName: 'no-match-news-comment' } as UserProfileBasic]; if (profilesForNewCommentSuggestions.length === 0) return [{ userId: 'no-users-news-comment', displayName: 'No users to suggest.', mentionName: 'no-users-news-comment' } as UserProfileBasic]; return profilesForNewCommentSuggestions.filter(p => p.userId !== user?.uid);
  }, [showNewCommentSuggestions, profilesForNewCommentSuggestions, debouncedNewCommentMentionQuery, user?.uid]);


  const handleCommentDeleted = useCallback(() => {
    refetchNewsComments();
    if (articleIdParam) decrementNewsArticleCommentCount(articleIdParam);
  }, [refetchNewsComments, articleIdParam]);

  const handleToggleLikeArticle = async () => {
    if (!user || !articleIdParam || isLikingArticle || isEditingAllowed) return;
    setIsLikingArticle(true);
    try {
      await toggleLikeNewsArticle(articleIdParam, user.uid);
      refetchArticle(); // Refetch article to update likeCount and likedBy
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to like article", description: error.message });
    } finally {
      setIsLikingArticle(false);
    }
  };
  const hasLikedArticle = useMemo(() => !!user && !!article && !!article.likedBy?.includes(user.uid), [user, article]);


  // --- Editor Toolbar & Content Handling Logic (copied from create page, needs adaptation if any differences) ---
  const updateSelectionNonce = useCallback(() => requestAnimationFrame(() => setSelectionNonce(n => n + 1)), []);
  const getCurrentBlockElement = useCallback((): HTMLElement | null => { const contentEl = contentEditableRef.current; if (!contentEl) return null; const selection = window.getSelection(); if (!selection || selection.rangeCount === 0) { if (document.activeElement === contentEl && contentEl.lastChild && contentEl.lastChild.nodeType === Node.ELEMENT_NODE) return contentEl.lastChild as HTMLElement; return contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr') as HTMLElement | null || contentEl; } let node = selection.focusNode; if (!node || !contentEl.contains(node)) { if (document.activeElement === contentEl && contentEl.firstChild && contentEl.firstChild.nodeType === Node.ELEMENT_NODE) return contentEl.firstChild as HTMLElement; return contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr') as HTMLElement | null || contentEl; } while (node && node !== contentEl) { if (node.nodeType === Node.ELEMENT_NODE) { const element = node as HTMLElement; const tagName = element.tagName.toLowerCase(); if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'figure', 'hr'].includes(tagName)) { if (contentEl.contains(element)) return element; } } node = node.parentNode; } return contentEl.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, hr') as HTMLElement | null || contentEl; }, [contentEditableRef]);
  const getCurrentLineText = useCallback((): string => { const contentEl = contentEditableRef.current; if (focusedField === 'title' && titleInputRef.current) return titleInputRef.current.value.trim(); if (focusedField === 'content' && contentEl) { const currentBlock = getCurrentBlockElement(); if (currentBlock) { if (currentBlock.tagName === 'PRE' && currentBlock.textContent?.trim() !== '') return 'PRE_HAS_CONTENT'; if (currentBlock.tagName === 'FIGURE' && (currentBlock.querySelector('img') || currentBlock.querySelector('iframe'))) return 'FIGURE_HAS_CONTENT'; if (currentBlock.tagName === 'DIV' && currentBlock.hasAttribute('data-embed-wrapper')) return 'EMBED_HAS_CONTENT'; if (currentBlock.tagName === 'HR') return 'HR_HAS_CONTENT'; return currentBlock.textContent?.trim() || ""; } if (contentEl.innerHTML.trim() === "" || contentEl.innerHTML.trim() === "<br>") return "EDITOR_IS_EMPTY"; return "NO_CURRENT_BLOCK_FOUND"; } return "NO_FOCUS_OR_UNHANDLED_FIELD"; }, [focusedField, getCurrentBlockElement, titleInputRef, contentEditableRef]);
  const calculateCursorLineYOffset = useCallback((): number | null => { const contentEl = contentEditableRef.current; if (focusedField === 'title' && titleInputRef.current) { const titleRect = titleInputRef.current.getBoundingClientRect(); return titleRect.top + titleRect.height / 2; } if (focusedField === 'content' && contentEl) { const selection = window.getSelection(); if (selection && selection.rangeCount > 0) { const range = selection.getRangeAt(0); const rects = range.getClientRects(); if (rects.length > 0) return rects[0].top + rects[0].height / 2; let container = range.startContainer; if (container.nodeType === Node.TEXT_NODE && container.parentElement) container = container.parentElement; if (container.nodeType === Node.ELEMENT_NODE && contentEl.contains(container)) { const elementRect = (container as HTMLElement).getBoundingClientRect(); if (elementRect.height > 0) { const computedStyle = window.getComputedStyle(container as HTMLElement); const paddingTop = parseFloat(computedStyle.paddingTop) || 0; let lineHeight = parseFloat(computedStyle.lineHeight); if (isNaN(lineHeight) || lineHeight <= 0) lineHeight = (parseFloat(computedStyle.fontSize) || 16) * 1.4; return elementRect.top + paddingTop + (lineHeight / 2); } } } const currentBlock = getCurrentBlockElement(); if (currentBlock && currentBlock !== contentEl && currentBlock.offsetHeight > 0) { const blockRect = currentBlock.getBoundingClientRect(); const computedStyle = window.getComputedStyle(currentBlock); const paddingTop = parseFloat(computedStyle.paddingTop) || 0; let lineHeight = parseFloat(computedStyle.lineHeight); if (isNaN(lineHeight) || lineHeight <= 0) lineHeight = (parseFloat(computedStyle.fontSize) || 16) * 1.4; return blockRect.top + paddingTop + (lineHeight / 2); } const mainDivRect = contentEl.getBoundingClientRect(); const computedStyleMain = window.getComputedStyle(contentEl); const paddingTopMain = parseFloat(computedStyleMain.paddingTop) || 0; let lineHeightMain = parseFloat(computedStyleMain.lineHeight); if (isNaN(lineHeightMain) || lineHeightMain <= 0) lineHeightMain = (parseFloat(computedStyleMain.fontSize) || 20) * 1.4; return mainDivRect.top + paddingTopMain + (lineHeightMain / 2); } return null; }, [focusedField, contentEditableRef, titleInputRef, getCurrentBlockElement]);
  const calculateAndUpdateToolbarStyle = useCallback(() => { let shouldShowPlusButton = false; let shouldShowExpandedToolbar = false; if (focusedField && (document.activeElement === titleInputRef.current || document.activeElement === contentEditableRef.current)) { const lineYOffsetClient = calculateCursorLineYOffset(); if (lineYOffsetClient !== null) { let referenceElementRect: DOMRect | undefined; if (focusedField === 'title' && titleWrapperRef.current) referenceElementRect = titleWrapperRef.current.getBoundingClientRect(); else if (focusedField === 'content' && contentWrapperRef.current) referenceElementRect = contentWrapperRef.current.getBoundingClientRect(); if (referenceElementRect && formWrapperRef.current) { const formRect = formWrapperRef.current.getBoundingClientRect(); const newLeft = referenceElementRect.left - formRect.left - TOOLBAR_HORIZONTAL_OFFSET; const newTop = lineYOffsetClient - formRect.top - (TOOLBAR_HEIGHT / 2); setToolbarStyle({ top: `${newTop}px`, left: `${newLeft}px`, zIndex: 50, position: 'absolute' }); } const currentLineText = getCurrentLineText(); const lineIsEmpty = currentLineText === "" || currentLineText === "EDITOR_IS_EMPTY" || currentLineText === "NO_CURRENT_BLOCK_FOUND"; if (lineIsEmpty && !isToolbarExpanded) shouldShowPlusButton = true; if (isToolbarExpanded) shouldShowExpandedToolbar = true; } } setShowContextualUI(shouldShowPlusButton || shouldShowExpandedToolbar); }, [focusedField, calculateCursorLineYOffset, getCurrentLineText, isToolbarExpanded, titleInputRef, contentEditableRef, titleWrapperRef, contentWrapperRef, formWrapperRef, setToolbarStyle, setShowContextualUI]);
  useEffect(() => { if (isEditingAllowed) { document.addEventListener('selectionchange', () => { if (document.activeElement === contentEditableRef.current || document.activeElement === titleInputRef.current) { requestAnimationFrame(updateSelectionNonce); } }); } return () => { if (isEditingAllowed) document.removeEventListener('selectionchange', () => requestAnimationFrame(updateSelectionNonce)); }; }, [isEditingAllowed, updateSelectionNonce]);
  useEffect(() => { if (isEditingAllowed) calculateAndUpdateToolbarStyle(); }, [focusedField, selectionNonce, isToolbarExpanded, calculateAndUpdateToolbarStyle, isEditingAllowed]);
  const handleFocus = useCallback((field: 'title' | 'content') => { if (isEditingAllowed) { setFocusedField(field); requestAnimationFrame(updateSelectionNonce); } }, [isEditingAllowed, updateSelectionNonce]);
  const handleBlur = useCallback(() => { if (!isEditingAllowed) return; queueMicrotask(() => { const activeEl = document.activeElement; if (!((toolbarWrapperRef.current && toolbarWrapperRef.current.contains(activeEl)) || titleInputRef.current === activeEl || contentEditableRef.current === activeEl || isYouTubeDialogOpen || isEmbedDialogOpen || (tagSuggestionsPopoverContentRef.current && tagSuggestionsPopoverContentRef.current.contains(activeEl)) || (headerSearchInputRef.current === activeEl))) { setFocusedField(null); setIsToolbarExpanded(false); setShowContextualUI(false); setSavedRange(null); } }); }, [isYouTubeDialogOpen, isEmbedDialogOpen, isEditingAllowed]);
  const handleContentEditableInput = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => { if (!isEditingAllowed) return; const currentHTML = event.currentTarget.innerHTML; if (currentHTML.trim() === "" || currentHTML.trim() === "<br>" || currentHTML.trim() === "<p><br></p>" || currentHTML.trim() === "<p></p>") { setStoryContent("<p><br></p>"); if (event.currentTarget.innerHTML !== "<p><br></p>") { event.currentTarget.innerHTML = "<p><br></p>"; const pTag = event.currentTarget.querySelector('p'); if(pTag) { const range = document.createRange(); const sel = window.getSelection(); try { range.setStart(pTag, 0); range.collapse(true); sel?.removeAllRanges(); sel?.addRange(range); } catch(e) {}} } } else setStoryContent(currentHTML); if (publishAttempted) { const currentText = event.currentTarget.textContent || ""; if (currentText.trim() || /<img|<figure|<video|<pre|<hr/i.test(currentHTML)) setStoryError(""); else setStoryError("Story content is required."); } requestAnimationFrame(updateSelectionNonce); }, [publishAttempted, setStoryError, updateSelectionNonce, isEditingAllowed]);
  const handleContentKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => { if (!isEditingAllowed) return; const editorEl = contentEditableRef.current; if (!editorEl) return; const selection = window.getSelection(); if (!selection || selection.rangeCount === 0) return; const range = selection.getRangeAt(0); const currentBlock = getCurrentBlockElement(); if (event.key === 'Enter') { event.preventDefault(); document.execCommand('insertParagraph', false, undefined); setTimeout(() => { if (contentEditableRef.current) { setStoryContent(contentEditableRef.current.innerHTML); requestAnimationFrame(updateSelectionNonce); }}, 0); return; } if (event.key === 'Backspace' || event.key === 'Delete') { if (range.collapsed && currentBlock) { const focusNode = selection.focusNode; const focusOffset = selection.focusOffset; let isAtBoundary = false; if (event.key === 'Backspace') { if ((focusNode === currentBlock && focusOffset === 0) || (focusNode && focusNode.nodeType === Node.TEXT_NODE && currentBlock.contains(focusNode) && focusOffset === 0 && !focusNode.previousSibling) || (focusNode && focusNode.nodeType === Node.ELEMENT_NODE && currentBlock.firstChild === focusNode && focusOffset === 0 && (focusNode.textContent === "" || (focusNode as HTMLElement).tagName === 'BR'))) isAtBoundary = true; const prevElement = currentBlock.previousElementSibling; if (isAtBoundary && prevElement && (prevElement.tagName === 'FIGURE' || prevElement.getAttribute('data-embed-wrapper') === 'true' || prevElement.tagName === 'PRE' || prevElement.tagName === 'HR')) { event.preventDefault(); prevElement.remove(); setStoryContent(editorEl.innerHTML || "<p><br></p>"); requestAnimationFrame(updateSelectionNonce); return; } } else { if ((focusNode === currentBlock && focusOffset === currentBlock.childNodes.length) || (focusNode && focusNode.nodeType === Node.TEXT_NODE && currentBlock.contains(focusNode) && focusOffset === focusNode.textContent?.length && !focusNode.nextSibling) || (focusNode && focusNode.nodeType === Node.ELEMENT_NODE && currentBlock.lastChild === focusNode && focusOffset === focusNode.childNodes.length && (focusNode.textContent === "" || (focusNode as HTMLElement).tagName === 'BR'))) isAtBoundary = true; const nextElement = currentBlock.nextElementSibling; if (isAtBoundary && nextElement && (nextElement.tagName === 'FIGURE' || nextElement.getAttribute('data-embed-wrapper') === 'true' || nextElement.tagName === 'PRE' || nextElement.tagName === 'HR')) { event.preventDefault(); nextElement.remove(); setStoryContent(editorEl.innerHTML || "<p><br></p>"); requestAnimationFrame(updateSelectionNonce); return; } } } } }, [getCurrentBlockElement, setStoryContent, updateSelectionNonce, isEditingAllowed]);
  const validateFields = useCallback(() => { let isValid = true; if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); } if (tags.length === 0) { setTagsError("At least one tag is required."); isValid = false; } else { setTagsError(""); } const currentHTMLContent = contentEditableRef.current?.innerHTML || ""; const currentTextContent = contentEditableRef.current?.textContent || ""; if (!currentTextContent.trim() && !/<img|<figure|<video|<pre|<hr/i.test(currentHTMLContent)) { setStoryError("Story content is required."); isValid = false; } else { setStoryError(""); } return isValid; }, [title, tags]);
  const handleUpdateArticle = async (newStatus: NewsArticleStatus, contentToSaveParam?: string | null, isSavingDraftOfPublishedArticleParam: boolean = false) => { if (!user || !articleIdParam || !article || !isEditingAllowed) { toast({ variant: "destructive", title: "Error", description: "Cannot update article. Auth or data missing." }); return; } if (newStatus === 'published' || isSavingDraftOfPublishedArticleParam) { setPublishAttempted(true); if (!validateFields()) { if (!title.trim() && titleInputRef.current) titleInputRef.current.focus(); else if (tags.length === 0 && isHeaderSearchActive && headerSearchInputRef.current) headerSearchInputRef.current.focus(); else if (contentEditableRef.current && storyError) contentEditableRef.current.focus(); return; } } setIsSubmitting(true); if (isSavingDraftOfPublishedArticleParam) setIsSavingDraftOfPublished(true); let newCoverImageUrl: string | null | undefined = undefined; try { if (coverImageFile) newCoverImageUrl = await uploadNewsCoverImage(coverImageFile, user.uid, articleIdParam); else if (coverImagePreview === null && currentCoverImageUrl !== null) newCoverImageUrl = null; const mainContentForService = contentToSaveParam !== undefined ? contentToSaveParam : storyContent; const articleUpdateData: UpdateNewsArticleData = { title: title.trim(), tags: tags, status: newStatus, }; if (isSavingDraftOfPublishedArticleParam && article.status === 'published') { articleUpdateData.draftContent = mainContentForService || null; articleUpdateData.hasUnpublishedChanges = true; } else if (newStatus === 'published') { articleUpdateData.content = mainContentForService || null; articleUpdateData.draftContent = null; articleUpdateData.hasUnpublishedChanges = false; } else if (newStatus === 'draft') { articleUpdateData.content = mainContentForService || null; articleUpdateData.draftContent = null; articleUpdateData.hasUnpublishedChanges = false; } else if (contentToSaveParam !== undefined) { articleUpdateData.content = mainContentForService || null; } if (newCoverImageUrl !== undefined) articleUpdateData.coverImageUrl = newCoverImageUrl; await updateNewsArticle(articleIdParam, articleUpdateData, isSavingDraftOfPublishedArticleParam); let successTitle = "Update Successful"; let successDescription = `Article "${title.trim()}" updated.`; if (isSavingDraftOfPublishedArticleParam && article.status === 'published') { successTitle = "Draft Saved!"; successDescription = `Your changes to "${title.trim()}" have been saved as a draft.`; } else if (newStatus === 'published') { if (article.status !== 'published') { successTitle = "Article Published!"; successDescription = `"${title.trim()}" is now live.`; } else { successTitle = "Live Article Updated!"; successDescription = `Changes to "${title.trim()}" are now live.`; } } else if (newStatus === 'draft') { if (article.status === 'published') { successTitle = "Article Unpublished"; successDescription = `"${title.trim()}" is no longer live. It's a draft.`; } else { successTitle = "Draft Updated!"; successDescription = `Draft for "${title.trim()}" has been saved.`; } } toast({ title: successTitle, description: successDescription }); setPublishAttempted(false); setTitleError(""); setTagsError(""); setStoryError(""); setIsToolbarExpanded(false); setShowContextualUI(false); refetchArticle(); // Refetch article to get updated data from server setCoverImageFile(null); } catch (error: any) { toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not update the article." }); } finally { setIsSubmitting(false); setIsSavingDraftOfPublished(false); } };
  const insertHTMLAndFocus = useCallback((htmlToInsert: string) => { if(!isEditingAllowed) return; const editorEl = contentEditableRef.current; if (!editorEl) return; queueMicrotask(() => { editorEl.focus(); const selection = window.getSelection(); let range: Range; if (savedRange && editorEl.contains(savedRange.commonAncestorContainer)) range = savedRange; else if (selection && selection.rangeCount > 0 && editorEl.contains(selection.getRangeAt(0).commonAncestorContainer)) range = selection.getRangeAt(0); else { range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); } if (selection) { selection.removeAllRanges(); selection.addRange(range); } setSavedRange(null); const currentBlock = getCurrentBlockElement(); if (currentBlock && editorEl.contains(currentBlock) && (currentBlock.textContent?.trim() === "" || currentBlock.innerHTML.toLowerCase() === "<br>" || currentBlock.innerHTML.toLowerCase() === "<p></p>" || currentBlock.innerHTML.toLowerCase() === "&nbsp;") && currentBlock.innerHTML.toLowerCase() !== "<p><br></p>") { if (range.collapsed && (currentBlock.isSameNode(range.startContainer) || currentBlock.contains(range.startContainer))) { const isEditorAndEmptyOrSinglePBR = currentBlock.isSameNode(editorEl) && editorEl.innerHTML.trim().match(/^($|<br\s*\/?>|<p><br\s*\/?><\/p>|<p><\/p>)$/i); if (!isEditorAndEmptyOrSinglePBR || (isEditorAndEmptyOrSinglePBR && range.startOffset === 0 && range.endOffset === 0 && editorEl.childNodes.length <= 1)) range.selectNodeContents(currentBlock); } } if (!range.collapsed) range.deleteContents(); const fragment = range.createContextualFragment(htmlToInsert); const lastNodeOfFragment = fragment.lastChild; range.insertNode(fragment); if (lastNodeOfFragment && editorEl.contains(lastNodeOfFragment)) { if (lastNodeOfFragment.nodeName === 'P' && (lastNodeOfFragment as HTMLElement).innerHTML.toLowerCase().includes('<br>')) range.setStart(lastNodeOfFragment, 0); else range.setStartAfter(lastNodeOfFragment); range.collapse(true); } else { range.selectNodeContents(editorEl); range.collapse(false); } if (selection) { selection.removeAllRanges(); selection.addRange(range); } setStoryContent(editorEl.innerHTML || "<p><br></p>"); setIsToolbarExpanded(false); queueMicrotask(() => { editorEl.focus(); updateSelectionNonce(); }); }); }, [getCurrentBlockElement, updateSelectionNonce, contentEditableRef, setStoryContent, setIsToolbarExpanded, savedRange, isEditingAllowed]);
  const triggerInlineImageUpload = useCallback(() => { if (!isEditingAllowed) return; const selection = window.getSelection(); if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange()); else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); } if (inlineImageInputRef.current) inlineImageInputRef.current.click(); }, [isEditingAllowed]);
  const handleInlineImageFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => { if (!isEditingAllowed) return; const file = event.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { const dataUri = reader.result as string; insertHTMLAndFocus(`<figure class="my-4 flex flex-col items-center" contenteditable="false"><img src="${dataUri}" alt="User uploaded image" style="max-width: 100%; height: auto; display: block; border-radius: 0.25rem; margin-bottom: 0.5rem;" data-ai-hint="user uploaded" /><figcaption contenteditable="true" data-placeholder="Optional caption..." style="text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem;" class="w-full"></figcaption></figure><p><br></p>`); }; reader.readAsDataURL(file); if (inlineImageInputRef.current) inlineImageInputRef.current.value = ''; } setSavedRange(null); }, [insertHTMLAndFocus, isEditingAllowed]);
  const handleInsertYouTubeVideo = useCallback(() => { if (!isEditingAllowed) return; const selection = window.getSelection(); if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange()); else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); } setIsYouTubeDialogOpen(true); setYouTubeUrlInput(""); setIsToolbarExpanded(false); }, [isEditingAllowed]);
  const handleYouTubeDialogSubmit = () => { if (youTubeUrlInput) { let videoId = ''; try { const urlObj = new URL(youTubeUrlInput); if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.substring(1); else if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) videoId = urlObj.searchParams.get('v')!; else videoId = youTubeUrlInput; } catch (e) { videoId = youTubeUrlInput; } if (videoId.match(/^[a-zA-Z0-9_-]{11}$/)) insertHTMLAndFocus(`<figure class="my-4 relative" contenteditable="false" style="padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.25rem;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure><p><br></p>`); else toast({ variant: 'destructive', title: 'Invalid YouTube URL/ID', description: 'Please enter a valid YouTube video URL or ID.' }); } setIsYouTubeDialogOpen(false); setSavedRange(null); };
  const handleOpenEmbedDialog = useCallback(() => { if (!isEditingAllowed) return; const selection = window.getSelection(); if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange()); else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); } setIsEmbedDialogOpen(true); setEmbedCodeInput(""); setIsToolbarExpanded(false); }, [isEditingAllowed]);
  const handleEmbedDialogSubmit = () => { if (embedCodeInput) { const sanitizedCode = embedCodeInput.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""); if (sanitizedCode.trim()) insertHTMLAndFocus(`<div class="my-4 relative" data-embed-wrapper="true" contenteditable="false" style="padding-bottom: 100%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.25rem;"><div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">${sanitizedCode}</div></div><p><br></p>`); else toast({ variant: 'destructive', title: 'Invalid Embed Code', description: 'Please provide valid embed code (e.g., an iframe).' }); } setIsEmbedDialogOpen(false); setSavedRange(null); };
  const handleInsertCodeBlock = useCallback(() => { if (!isEditingAllowed) return; const selection = window.getSelection(); if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange()); else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); } insertHTMLAndFocus(`<pre class="my-4 p-3 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm" style="white-space: pre-wrap; word-wrap: break-word;" contenteditable="true"><code class="language-plaintext" style="display: block;">\n// Your code here...\n\n</code></pre><p><br></p>`); }, [insertHTMLAndFocus, isEditingAllowed]);
  const handleInsertSeparator = useCallback(() => { if (!isEditingAllowed) return; const selection = window.getSelection(); if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) setSavedRange(selection.getRangeAt(0).cloneRange()); else { const editorEl = contentEditableRef.current; if (editorEl) { const range = document.createRange(); if (editorEl.lastChild) range.setStartAfter(editorEl.lastChild); else range.selectNodeContents(editorEl); range.collapse(false); setSavedRange(range); } else setSavedRange(null); } insertHTMLAndFocus(`<hr class="my-8 border-border" /><p><br></p>`); }, [insertHTMLAndFocus, isEditingAllowed]);
  const handleToggleToolbar = () => { if(isEditingAllowed) setIsToolbarExpanded(prev => { const newState = !prev; if (newState) { if (focusedField === 'title' && titleInputRef.current) titleInputRef.current.focus(); else if (focusedField === 'content' && contentEditableRef.current) contentEditableRef.current.focus(); } return newState; }); };
  const actionButtonClass = "p-2 hover:bg-muted rounded-full focus:outline-none focus:ring-1 focus:ring-primary"; const iconClass = "h-5 w-5 text-primary";
  const handleCoverImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { if (!isEditingAllowed) return; const file = event.target.files?.[0]; if (file) { setCoverImageFile(file); const reader = new FileReader(); reader.onloadend = () => setCoverImagePreview(reader.result as string); reader.readAsDataURL(file); } else { setCoverImageFile(null); setCoverImagePreview(currentCoverImageUrl); } };
  const toggleHeaderSearch = () => { setIsHeaderSearchActive(prev => { if (prev) { setHeaderSearchTerm(''); setIsTagSuggestionsPopoverOpen(false); } else { setTimeout(() => headerSearchInputRef.current?.focus(), 0); } return !prev; }); };
  useEffect(() => { const timerId = setTimeout(() => { setDebouncedHeaderSearchTerm(headerSearchTerm); }, 300); return () => clearTimeout(timerId); }, [headerSearchTerm]);
  useEffect(() => { if (debouncedHeaderSearchTerm.trim() && isHeaderSearchActive) { setIsTagSuggestionsLoading(true); searchTags(debouncedHeaderSearchTerm.trim(), 7).then(fetchedTags => { const currentSelectedLowercase = tags.map(t => t.toLowerCase()); setTagSuggestions(fetchedTags.filter(tag => !currentSelectedLowercase.includes(tag.name.toLowerCase()))); setIsTagSuggestionsPopoverOpen(true); }).catch(() => setTagSuggestions([])).finally(() => setIsTagSuggestionsLoading(false)); } else { setTagSuggestions([]); setIsTagSuggestionsPopoverOpen(false); } }, [debouncedHeaderSearchTerm, tags, isHeaderSearchActive]);
  const handleAddTagFromSearch = (tagToAdd: string) => { const trimmedTag = tagToAdd.trim(); if (trimmedTag && !tags.map(t => t.toLowerCase()).includes(trimmedTag.toLowerCase())) { if (tags.length < 5) { setTags(prev => [...prev, trimmedTag]); if (publishAttempted && (tags.length + 1 > 0)) setTagsError(""); } else { toast({ title: "Tag Limit Reached", description: "You can add a maximum of 5 tags.", variant: "default" }); } } setHeaderSearchTerm(''); setIsTagSuggestionsPopoverOpen(false); setTimeout(() => headerSearchInputRef.current?.focus(), 0); };
  const handleHeaderSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); if (headerSearchTerm.trim()) { handleAddTagFromSearch(headerSearchTerm.trim()); } } else if (e.key === 'Escape') { setIsTagSuggestionsPopoverOpen(false); } };
  const handleRemoveTagFromDisplay = (tagToRemove: string) => { if (!isEditingAllowed) return; setTags(prev => { const newTags = prev.filter(t => t !== tagToRemove); if (publishAttempted && newTags.length === 0) { setTagsError("At least one tag is required."); } else if (publishAttempted && newTags.length > 0) { setTagsError(""); } return newTags; }); };
  useEffect(() => { const handleClickOutsidePopover = (event: MouseEvent) => { if (isTagSuggestionsPopoverOpen && tagSuggestionsPopoverContentRef.current && !tagSuggestionsPopoverContentRef.current.contains(event.target as Node) && headerSearchInputRef.current && !headerSearchInputRef.current.contains(event.target as Node)) { setIsTagSuggestionsPopoverOpen(false); } }; if (isTagSuggestionsPopoverOpen) document.addEventListener('mousedown', handleClickOutsidePopover); return () => document.removeEventListener('mousedown', handleClickOutsidePopover); }, [isTagSuggestionsPopoverOpen]);


  if (authLoading || isLoadingArticle) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (errorLoadingArticle) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><AlertTriangle className="h-10 w-10 text-destructive mb-3"/><p className="text-lg font-semibold text-destructive">{errorLoadingArticle.message}</p><Button onClick={() => router.push('/news')} className="mt-4">Back to News</Button></div>;
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

  // Combined View for Published (Non-Editing) and Editing Mode
  const publishedDateStr = article.publishedAt ? format(new Date(article.publishedAt), 'PPP') : 'Not published';
  const lastEditedDateStr = article.updatedAt ? format(new Date(article.updatedAt), 'PPp') : '';
  const showLastEdited = article.status === 'published' && article.publishedAt && article.updatedAt && (article.updatedAt > (article.publishedAt + 60000));

  return (
    <>
    <div className="container mx-auto py-8 px-4 md:px-6" key={articleIdParam}>
      {/* Header Section */}
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
            className={cn("h-7 w-7 p-1 text-muted-foreground hover:text-foreground flex-shrink-0 transition-transform duration-200 ease-in-out", isHeaderSearchActive && "rotate-45")}
            aria-label={isHeaderSearchActive ? "Close tag search" : "Search and add tags"}
            disabled={isSubmitting || !isEditingAllowed}
          >
            {isHeaderSearchActive ? <CloseIcon className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>

          {isHeaderSearchActive && isEditingAllowed ? (
            <div className="relative flex-grow">
              <Popover open={isTagSuggestionsPopoverOpen && (tagSuggestions.length > 0 || (headerSearchTerm.trim() && !isTagSuggestionsLoading))} onOpenChange={setIsTagSuggestionsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Input
                    ref={headerSearchInputRef}
                    type="text"
                    placeholder="Search or create tags..."
                    value={headerSearchTerm}
                    onChange={(e) => { setHeaderSearchTerm(e.target.value); if (e.target.value.trim()) setIsTagSuggestionsPopoverOpen(true); else setIsTagSuggestionsPopoverOpen(false); }}
                    onKeyDown={handleHeaderSearchKeyDown}
                    className="h-9 text-xs flex-grow"
                    disabled={isSubmitting}
                  />
                </PopoverTrigger>
                <PopoverContent ref={tagSuggestionsPopoverContentRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="bottom" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                  {isTagSuggestionsLoading ? ( <div className="flex items-center justify-center p-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5"/> Loading...</div>
                  ) : tagSuggestions.length > 0 ? ( tagSuggestions.map(tag => ( <Button key={tag.id} variant="ghost" size="sm" className="w-full justify-start text-xs h-auto py-1.5 px-2" onClick={() => handleAddTagFromSearch(tag.name)} onMouseDown={(e) => e.preventDefault()}> <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground"/>{tag.name} <span className="ml-auto text-muted-foreground text-[10px]">({tag.usageCount})</span> </Button> ))
                  ) : headerSearchTerm.trim() && !isTagSuggestionsLoading ? ( <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-auto py-1.5 px-2 text-primary" onClick={() => handleAddTagFromSearch(headerSearchTerm.trim())} onMouseDown={(e) => e.preventDefault()}> <PlusCircle className="h-3.5 w-3.5 mr-1.5"/> Create new tag &quot;{headerSearchTerm.trim()}&quot; </Button>
                  ) : null}
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="flex-grow flex items-center gap-1.5 overflow-x-auto py-1.5 h-9 scrollbar-hide">
              {tags.length > 0 ? ( tags.map((tag) => ( <Badge key={tag} variant="secondary" className="text-xs flex-shrink-0 group/tagbadge relative pr-5"> {tag} {isEditingAllowed && ( <button type="button" onClick={() => handleRemoveTagFromDisplay(tag)} className="ml-1 rounded-full outline-none opacity-0 group-hover/tagbadge:opacity-100 focus:opacity-100 absolute right-0.5 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-destructive/20" aria-label={`Remove ${tag}`} disabled={isSubmitting}> <CloseIcon className="h-3 w-3 text-destructive/70 hover:text-destructive" /> </button> )} </Badge> ))
              ) : ( <span className="text-xs text-muted-foreground italic pl-1">No tags selected</span> )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
           {user && articleIdParam && article && article.userId !== user.uid && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-1"
                title={hasLikedArticle ? "Unlike Article" : "Like Article"}
                onClick={handleToggleLikeArticle}
                disabled={isLikingArticle}
              >
                {isLikingArticle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-5 w-5", hasLikedArticle ? "fill-red-500 text-red-500" : "text-muted-foreground")} />}
              </Button>
            )}
            <span className="text-xs text-muted-foreground mr-1">{article.likeCount || 0} Likes</span>
          {isEditingAllowed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 p-1"><MoreVertical className="h-4 w-4" /><span className="sr-only">More options</span></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => coverImageInputRef.current?.click()} disabled={isSubmitting} className="cursor-pointer"><ImageUp className="mr-2 h-4 w-4" /><span>Change Cover Image</span></DropdownMenuItem>
                <DropdownMenuSeparator />
                {article?.status === 'draft' ? ( <> <DropdownMenuItem onClick={() => handleUpdateArticle('draft', storyContent, false)} disabled={isSubmitting} className="cursor-pointer"><Save className="mr-2 h-4 w-4" /> Save Draft</DropdownMenuItem><DropdownMenuItem onClick={() => handleUpdateArticle('published', storyContent, false)} disabled={isSubmitting} className="cursor-pointer text-green-600 focus:text-green-700"><Send className="mr-2 h-4 w-4" /> Publish</DropdownMenuItem> </>
                ) : ( <> <DropdownMenuItem onClick={() => handleUpdateArticle('published', storyContent, true)} disabled={isSubmitting || isSavingDraftOfPublished} className="cursor-pointer">{isSavingDraftOfPublished ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft</DropdownMenuItem>
                    {article.hasUnpublishedChanges && article.draftContent ? ( <DropdownMenuItem onClick={() => handleUpdateArticle('published', article.draftContent || storyContent, false)} disabled={isSubmitting} className="cursor-pointer text-green-600 focus:text-green-700"><CheckCircle className="mr-2 h-4 w-4" /> Publish Draft Changes</DropdownMenuItem>
                    ) : ( <DropdownMenuItem onClick={() => handleUpdateArticle('published', storyContent, false)} disabled={isSubmitting} className="cursor-pointer"><Save className="mr-2 h-4 w-4" /> Update Live Article</DropdownMenuItem> )}
                    <DropdownMenuItem onClick={() => handleUpdateArticle('draft', article.content, false)} disabled={isSubmitting} className="cursor-pointer text-orange-600 focus:text-orange-700"><RotateCcw className="mr-2 h-4 w-4" /> Unpublish</DropdownMenuItem> </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Main Content Area: Editor or Read-only View */}
      <div ref={formWrapperRef} className="max-w-3xl mx-auto relative pt-5">
         {showContextualUI && isEditingAllowed && (<div ref={toolbarWrapperRef} style={toolbarStyle} className="flex items-center space-x-1">
            <Button type="button" variant="outline" size="icon" onClick={handleToggleToolbar} onMouseDown={(e) => e.preventDefault()} className="p-0 bg-card border rounded-full shadow-lg hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary h-9 w-9 z-10 flex items-center justify-center" aria-expanded={isToolbarExpanded} aria-label={isToolbarExpanded ? "Close formatting options" : "Open formatting options"}><PlusCircle className={cn("h-5 w-5 text-primary transition-transform duration-200 ease-in-out", isToolbarExpanded && "rotate-45")} /></Button>
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

        {coverImagePreview && ( <div className="mb-4 relative group"> <Image src={coverImagePreview} alt="Cover image preview" width={800} height={450} className="rounded-md object-cover w-full max-h-[300px] border" data-ai-hint="news cover"/> {isEditingAllowed && <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity p-1" onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); setCurrentCoverImageUrl(null); if(coverImageInputRef.current) coverImageInputRef.current.value = "";}} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>} </div> )}
        {article && article.status === 'published' && article.hasUnpublishedChanges && isEditingAllowed && ( <div className="mb-3 p-2 text-sm bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md flex items-center gap-2"> <AlertTriangle className="h-4 w-4" /> You are editing a saved draft. The live article may be different. <Button variant="link" size="xs" className="p-0 h-auto text-yellow-700 hover:text-yellow-800" onClick={() => { if (contentEditableRef.current && article.content) { setStoryContent(article.content); contentEditableRef.current.innerHTML = article.content; } toast({title: "Viewing Live Content", description: "Editor now shows the live published content."}); }}>View live content</Button> </div> )}

        {isEditingAllowed ? (
            <>
            <div ref={titleWrapperRef} className="relative mb-4">
                <Input ref={titleInputRef} placeholder="Title" value={title} onChange={(e) => { setTitle(e.target.value); if (publishAttempted) { if (e.target.value.trim()) setTitleError(""); else setTitleError("Title is required."); } requestAnimationFrame(updateSelectionNonce); }} onFocus={() => handleFocus('title')} onBlur={handleBlur} className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2" autoComplete="off" disabled={isSubmitting}/>
                {publishAttempted && titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
            </div>
            <div ref={contentWrapperRef} className="relative">
                <div key={articleIdParam} ref={contentEditableRef} contentEditable={!isSubmitting} onInput={handleContentEditableInput} onFocus={() => handleFocus('content')} onBlur={handleBlur} onKeyDown={handleContentKeyDown} data-placeholder="Tell your story..." className={cn("w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case", "focus:outline-none min-h-[150px]")} style={{ fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif", fontSize: "20px", lineHeight: "1.6", color: "hsl(var(--foreground))" }} role="textbox" aria-multiline="true" aria-label="News article content" suppressContentEditableWarning={true} dir="ltr" />
            </div>
            {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
            {publishAttempted && tagsError && <p className="text-xs text-destructive mt-2">{tagsError}</p>}
            </>
        ) : (
          <>
            <header className="mb-8">
                {article.tags && article.tags.length > 0 && ( <div className="flex flex-wrap gap-2 mb-2"> {article.tags.map(tag => ( <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge> ))} </div> )}
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{article.title}</h1>
                <p className="text-sm text-muted-foreground"> {article.status === 'published' ? <>Published on <time dateTime={new Date(article.publishedAt || 0).toISOString()}>{publishedDateStr}</time></> : `Draft (Last saved: ${formatDistanceToNowStrict(new Date(article.updatedAt), { addSuffix: true })} ago)`} {showLastEdited && ` (Last edited: ${lastEditedDateStr})`} </p>
            </header>
            {article.coverImageUrl && ( <div className="mb-8 relative aspect-video rounded-lg overflow-hidden shadow-md"> <Image src={article.coverImageUrl} alt={article.title} fill style={{objectFit:"cover"}} priority data-ai-hint="news cover article"/> </div> )}
            <div className="prose prose-lg dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: article.content || "" }} />
          </>
        )}
        <style jsx global>{` div[contentEditable="true"][data-placeholder]:empty:before, div[contentEditable="true"][data-placeholder] > p:first-child:last-child:empty:before, div[contentEditable="true"][data-placeholder] > p:first-child:last-child > br:only-child:before, div[contentEditable="true"][data-placeholder] > p:first-child:last-child:has(br:only-child):before { content: attr(data-placeholder); color: hsl(var(--muted-foreground) / 0.5); pointer-events: none; display: block; position: absolute; top: 0.5rem; left: 0; } div[contentEditable="true"][data-placeholder]:not(:empty):before, div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:empty):before, div[contentEditable="true"][data-placeholder] > p:first-child:last-child:not(:has(br:only-child)):before { content: none; } div[contentEditable="true"] figure { margin-left: auto; margin-right: auto; max-width: 100%; } div[contentEditable="true"] figure img, div[contentEditable="true"] figure iframe { display: block; margin-left: auto; margin-right: auto; max-width: 100%; border-radius: 0.25rem; } div[contentEditable="true"] figure figcaption { text-align: center; color: hsl(var(--muted-foreground)); font-style: italic; font-size: 0.9em; outline: none; padding: 0.25rem; margin-top: 0.25rem; } div[contentEditable="true"] figure figcaption:empty:before { content: attr(data-placeholder); color: hsl(var(--muted-foreground) / 0.7); } div[contentEditable="true"] pre { background-color: hsl(var(--muted)); color: hsl(var(--muted-foreground)); padding: 1rem; border-radius: 0.375rem; overflow-x: auto; font-family: monospace; font-size: 0.875rem; line-height: 1.25rem; white-space: pre-wrap; word-wrap: break-word; } div[contentEditable="true"] pre code { display: block; white-space: pre-wrap !important; word-wrap: break-word !important; outline: none; } div[contentEditable="true"] hr { border-color: hsl(var(--border)); margin-top: 2rem; margin-bottom: 2rem; } div[contentEditable="true"] div[data-embed-wrapper="true"] { margin: 1rem 0; } div[contentEditable="true"] div[data-embed-wrapper="true"] > div > * { width: 100%; height: 100%; border: 0; display: block; } `}</style>
      </div>

      {/* Comment Section */}
      {article.status === 'published' && articleIdParam && (
        <div className="max-w-3xl mx-auto mt-12 pt-8 border-t">
          <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" /> Comments ({article.commentCount || 0})
          </h3>
          {/* New Comment Input */}
          {user && (
            <Popover
              open={showNewCommentSuggestions && filteredNewCommentSuggestions.length > 0 && !['loading-main-comment', 'no-users-main-comment', 'no-match-main-comment'].includes(filteredNewCommentSuggestions[0]?.userId)}
              onOpenChange={(open) => { setShowNewCommentSuggestions(open); if (!open) setNewCommentMentionQuery(''); }}
            >
              <PopoverTrigger asChild>
                <form onSubmit={handleCommentSubmit} className="mb-8 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName || generateAnonymousName(user.uid)} />
                    <AvatarFallback>{getInitials(user.displayName || generateAnonymousName(user.uid))}</AvatarFallback>
                  </Avatar>
                  <Input
                    ref={newCommentInputRef}
                    placeholder="Add a public comment..."
                    value={newComment}
                    onChange={handleNewCommentInputChange}
                    onFocus={handleNewCommentInputFocus}
                    onKeyDownCapture={(e) => { if (showNewCommentSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) { if (e.key !== 'Escape') e.preventDefault(); } }}
                    onBlurCapture={() => setTimeout(() => { if (newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(document.activeElement as Node) && newCommentInputRef.current !== document.activeElement) { setShowNewCommentSuggestions(false); } }, 150)}
                    disabled={isSubmittingComment}
                    className="flex-grow"
                  />
                  <Button type="submit" disabled={!newComment.trim() || isSubmittingComment} size="sm">
                    {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Comment"}
                  </Button>
                </form>
              </PopoverTrigger>
              <PopoverContent ref={newCommentSuggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                {filteredNewCommentSuggestions.map(profile => (
                  (profile.userId === 'loading-main-comment' || profile.userId === 'no-users-main-comment' || profile.userId === 'no-match-main-comment') ? (<div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>)
                  : (<Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectNewCommentSuggestion(profile)}>
                      <Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName}/><AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback></Avatar>
                      <div className="flex flex-col items-start">
                          <span className={cn("text-muted-foreground", (profile.displayName && profile.displayName.toLowerCase() !== profile.mentionName.toLowerCase()) ? "" : "font-medium text-foreground")}>{profile.displayName || profile.mentionName}</span>
                          {(profile.displayName && profile.displayName.toLowerCase() !== profile.mentionName.toLowerCase()) && <span className="font-medium text-foreground text-xs">@{profile.mentionName}</span>}
                      </div>
                  </Button>)
                ))}
              </PopoverContent>
            </Popover>
          )}
          {/* Display Comments */}
          <div className="space-y-6">
            {isLoadingNewsComments && <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>}
            {!isLoadingNewsComments && newsComments.length === 0 && <p className="text-sm text-muted-foreground text-center">No comments yet.</p>}
            {newsComments.map(comment => (
              <NewsCommentItem
                key={comment.id}
                comment={comment}
                currentUserId={user?.uid || null}
                articleId={articleIdParam}
                articleAuthorId={article.userId}
                onDelete={handleCommentDeleted}
              />
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Dialogs for Editor Toolbar */}
    <Dialog open={isYouTubeDialogOpen} onOpenChange={(open) => { setIsYouTubeDialogOpen(open); if (!open) setSavedRange(null); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Embed YouTube Video</DialogTitle><DialogDescription>Paste the YouTube video URL or video ID below.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="youtube-url" className="text-right col-span-1">URL/ID</Label><Input id="youtube-url" value={youTubeUrlInput} onChange={(e) => setYouTubeUrlInput(e.target.value)} className="col-span-3" placeholder="e.g., https://www.youtube.com/watch?v=VIDEO_ID" /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => {setIsYouTubeDialogOpen(false); setSavedRange(null);}}>Cancel</Button><Button type="button" onClick={handleYouTubeDialogSubmit}>Embed Video</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={isEmbedDialogOpen} onOpenChange={(open) => { setIsEmbedDialogOpen(open); if (!open) setSavedRange(null); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Embed External Content</DialogTitle><DialogDescription>Paste your embed code (e.g., from Twitter, Vimeo, etc.). Ensure it&apos;s safe, typically iframe-based.</DialogDescription></DialogHeader><div className="py-4"><Label htmlFor="embed-code" className="sr-only">Embed Code</Label><Textarea id="embed-code" value={embedCodeInput} onChange={(e) => setEmbedCodeInput(e.target.value)} className="min-h-[150px] font-mono text-xs" placeholder="<iframe src='...'></iframe>" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => {setIsEmbedDialogOpen(false); setSavedRange(null);}}>Cancel</Button><Button type="button" onClick={handleEmbedDialogSubmit}>Embed Content</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
};

export default ArticlePage;
