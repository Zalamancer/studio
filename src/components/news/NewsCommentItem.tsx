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
import { Badge } from "@/components/ui/badge";
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
          onDelete(); 
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
            <p className="text-xs text-muted-foreground">
              {new Date(subComment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            {user && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleLikeSubComment}
                disabled={isLiking}
                className={cn(
                  "text-xs h-auto p-0.5 flex items-center gap-0.5",
                  hasLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500"
                )}
                aria-pressed={hasLiked}
              >
                {isLiking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Heart className={cn("h-3 w-3", hasLiked && "fill-current")} />
                )}
                {(subComment.likeCount ?? 0) > 0 && <span className="text-xs ml-0.5">({subComment.likeCount})</span>}
              </Button>
            )}
            {user && (
                 <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-muted-foreground/70 hover:text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" onClick={() => onStartReply(subComment)} title="Reply">
                    <CornerDownRight className="h-3 w-3" />
                 </Button>
            )}
            {isArticleAuthor && !isOwnSubComment && (
              <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 opacity-0 group-hover/memberitem:opacity-100 focus-visible:opacity-100" onClick={handleToggleShadowBanSubComment} disabled={isBanning} title={subComment.isShadowBanned ? "Unhide Reply" : "Hide Reply (Shadow Ban)"}>
                {isBanning ? <Loader2 className="h-3 w-3 animate-spin"/> : subComment.isShadowBanned ? <Eye className="h-3 w-3 text-green-600"/> : <EyeOff className="h-3 w-3 text-orange-500"/>}
              </Button>
            )}
            {isOwnSubComment && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground/70 hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    disabled={isDeleting}
                    aria-label="Delete reply"
                  >
                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Reply?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSubComment} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                      {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground break-words">
           <TextWithMentions text={subComment.text} mentionedUserIds={subComment.mentionedUserIds || []} />
        </p>
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

  const { data: subComments = [], isLoading: isLoadingSubComments, error: subCommentsError, refetch: refetchSubComments } = useQuery<ClientSubComment[]>({
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

  const allRelevantProfilesForReplyContext = useMemo(() => {
    const profiles = new Map<string, UserProfileBasic>();
    if (user) profiles.set(user.uid, { userId: user.uid, mentionName: generateAnonymousName(user.uid), displayName: user.displayName || generateAnonymousName(user.uid) });
    if (articleAuthorId) profiles.set(articleAuthorId, { userId: articleAuthorId, mentionName: generateAnonymousName(articleAuthorId), displayName: generateAnonymousName(articleAuthorId) });
    profiles.set(comment.userId, { userId: comment.userId, mentionName: displayAnonymousName, displayName: displayAnonymousName, avatarUrl: comment.userAvatar });
    subComments.forEach(sc => { if (!profiles.has(sc.userId)) profiles.set(sc.userId, { userId: sc.userId, mentionName: sc.mentionName || sc.userName || generateAnonymousName(sc.userId), displayName: sc.userName || generateAnonymousName(sc.userId), avatarUrl: sc.userAvatar }); });
    profilesForReplySuggestions.forEach(p => { if (!profiles.has(p.userId)) profiles.set(p.userId, p); });
    return Array.from(profiles.values());
  }, [user, articleAuthorId, comment, subComments, profilesForReplySuggestions, displayAnonymousName]);

  const filteredSuggestionsForReply = useMemo(() => {
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
  
  const evaluateMentionState = useCallback((text: string, cursorPosition: number) => {
    let activeQuery = null; const textBeforeCursor = text.substring(0, cursorPosition); const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
        const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
        if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) activeQuery = potentialQuery;
    }
    setMentionQuery(activeQuery !== null ? activeQuery : ''); setShowSuggestions(activeQuery !== null);
  }, [setMentionQuery, setShowSuggestions]);

  const handleMentionInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value; setNewReply(value); 
    if(replyInputRef.current) evaluateMentionState(value, replyInputRef.current.selectionStart || 0);
  }, [setNewReply, evaluateMentionState]);

  const handleMentionInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if(replyInputRef.current) evaluateMentionState(e.target.value, replyInputRef.current.selectionStart || 0);
  }, [evaluateMentionState]);

  const handleSelectSuggestion = useCallback((profile: UserProfileBasic) => {
    if (!replyInputRef.current || !profile.mentionName) return;
    const currentValue = newReply;
    const cursorPosition = replyInputRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1) {
      const textBeforeMention = currentValue.substring(0, lastAtIndex);
      const textAfterCursor = currentValue.substring(cursorPosition);
      const mentionToInsert = profile.mentionName;
      setNewReply(`${textBeforeMention}@${mentionToInsert} ${textAfterCursor}`);
      const newCursorPosition = textBeforeMention.length + `@${mentionToInsert} `.length;
      setTimeout(() => {
        replyInputRef.current?.focus();
        if (replyInputRef.current) { 
          replyInputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      }, 0);
    } 
    setShowSuggestions(false);
    setMentionQuery('');
  }, [newReply, setNewReply, setMentionQuery, setShowSuggestions]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (showSuggestions && suggestionsPopoverRef.current && !suggestionsPopoverRef.current.contains(event.target as Node) && replyInputRef.current && !replyInputRef.current.contains(event.target as Node)) { if (showSuggestions) setShowSuggestions(false); } };
    if (showSuggestions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);


  const toggleShowReplies = useCallback(() => setShowReplies(prev => !prev), []);
  const toggleReplyForm = useCallback(() => { setIsReplying(prev => { if (!prev) { setNewReply(''); setReplyingToSubComment(null); if(replyInputRef.current) evaluateMentionState("", 0); setTimeout(() => replyInputRef.current?.focus(), 0); } else { setShowSuggestions(false); setMentionQuery(''); } return !prev; }); }, [evaluateMentionState, setNewReply]);
  const handleSubCommentDeleted = useCallback(() => refetchSubComments(), [refetchSubComments]);
  const handleStartSubCommentReply = useCallback((subCommentToReplyTo: ClientSubComment) => { if (!user) return; setIsReplying(true); const subCommentAuthorMentionName = subCommentToReplyTo.mentionName || subCommentToReplyTo.userName || generateAnonymousName(subCommentToReplyTo.userId); const initialReplyText = `@${subCommentAuthorMentionName} `; setNewReply(initialReplyText); setReplyingToSubComment(subCommentToReplyTo); if(replyInputRef.current) evaluateMentionState(initialReplyText, initialReplyText.length); setTimeout(() => { replyInputRef.current?.focus(); if (replyInputRef.current) { const len = replyInputRef.current.value.length; replyInputRef.current.setSelectionRange(len, len); } }, 0); }, [user, setNewReply, setIsReplying, setReplyingToSubComment, evaluateMentionState]);


  return (
    <div className={cn("group border-b border-border/50 pb-4", comment.isShadowBanned && isArticleAuthor && "opacity-60 bg-yellow-50/50 p-2 rounded-md border-dashed border-yellow-300")}>
      <div className="flex items-start gap-3 ">
        <Link href={`/profile/${comment.userId}`} passHref><Avatar className="h-8 w-8 mt-1 flex-shrink-0 cursor-pointer"><AvatarImage src={comment.userAvatar} alt={displayAnonymousName} /><AvatarFallback className="text-xs bg-muted text-muted-foreground">{getInitials(displayAnonymousName)}</AvatarFallback></Avatar></Link>
        <div className="flex-grow bg-muted/50 p-3 rounded-lg min-w-0">
          <div className="flex justify-between items-center mb-1">
            <Link href={`/profile/${comment.userId}`} passHref><p className="text-sm font-medium text-foreground truncate hover:underline cursor-pointer">{displayAnonymousName}</p></Link>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <p className="text-xs text-muted-foreground">
                {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
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
          : subCommentsError ? <p className="text-xs text-destructive pl-2">{`Error loading replies: ${subCommentsError.message}`}</p>
          : subComments.length === 0 ? <p className="text-xs text-muted-foreground pl-2">No replies yet.</p>
          : subComments.map((subComment) => (
            <NewsSubCommentItem key={subComment.id} subComment={subComment} currentUserId={currentUserId} articleId={articleId} commentId={comment.id} articleAuthorId={articleAuthorId} onDelete={handleSubCommentDeleted} onStartReply={handleStartSubCommentReply} />
          ))}
      </div>)}
    </div>
  );
});
NewsCommentItem.displayName = 'NewsCommentItem';
