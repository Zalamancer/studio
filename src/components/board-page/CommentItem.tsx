"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { Loader2, Trash2, Send, Heart, CornerDownRight } from 'lucide-react';
import type { ClientComment, ClientSubComment, NewSubCommentData } from '@/types/comment';
import { deleteCommentFromPost, toggleLikeComment, addSubCommentToComment, getSubCommentsForComment } from '@/services/commentService';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { generateAnonymousName, getInitials as getSharedInitials } from '@/lib/pseudonymUtils';
import { fetchUserProfileBasic, getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { TextWithMentions } from './TextWithMentions';
import { SubCommentItem } from './SubCommentItem';

// Define IS_UID_REGEX here or import from a shared location
const IS_UID_REGEX_COMMENT = /^[a-zA-Z0-9]{20,}$/;

interface CommentItemProps {
  comment: ClientComment;
  currentUserId: string | null;
  postId: string;
  onDelete: () => void;
  extractMentionedUids: (text: string, profilesToSearch: UserProfileBasic[]) => string[]; // Pass this down
}

export const CommentItem: React.FC<CommentItemProps> = React.memo(({
  comment,
  currentUserId,
  postId,
  onDelete,
  extractMentionedUids,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwnComment = comment.userId === currentUserId;
  const [showReplies, setShowReplies] = useState(false);
  const [newReply, setNewReply] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [debouncedMentionQuery, setDebouncedMentionQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const suggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const [replyingToSubComment, setReplyingToSubComment] = useState<ClientSubComment | null>(null);

  const hasLiked = !!(currentUserId && comment.likedBy?.includes(currentUserId));
  const [isDeleting, setIsDeleting] = useState(false);
  const displayAnonymousName = generateAnonymousName(comment.userId);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMentionQuery(mentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [mentionQuery]);

  const {
    data: subComments = [],
    isLoading: isLoadingSubComments,
    error: subCommentsError,
    refetch: refetchSubComments,
  } = useQuery<ClientSubComment[]>({
    queryKey: ['subComments', postId, comment.id],
    queryFn: () => getSubCommentsForComment(postId, comment.id),
    enabled: showReplies && !!user,
    staleTime: 1000 * 60 * 1,
  });

  const { data: suggestedProfilesForReply = [], isLoading: isLoadingProfilesForReply } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForReply', comment.id, debouncedMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedMentionQuery, debouncedMentionQuery ? 10 : 25),
    enabled: isReplying && showSuggestions && !!user,
    staleTime: 1000 * 60 * 1,
    retry: 1,
  });

  const filteredSuggestionsForReply = useMemo(() => {
    if (!showSuggestions || !isReplying) return [];
    if (isLoadingProfilesForReply) {
      return [{ userId: 'loading-reply', mentionName: 'loading-reply', displayName: 'Loading users...' } as UserProfileBasic];
    }
    const profilesSource = suggestedProfilesForReply.filter(p => p.userId !== currentUserId && !!p.mentionName);
    let results: UserProfileBasic[];
    if (mentionQuery.trim() === '') {
      results = profilesSource.slice(0, 5);
    } else {
      const queryLower = mentionQuery.toLowerCase();
      results = profilesSource.filter(
        p => p.mentionName.toLowerCase().includes(queryLower) ||
          (p.actualDisplayName && p.actualDisplayName.toLowerCase().includes(queryLower)) ||
          (p.companyName && p.companyName.toLowerCase().includes(queryLower))
      ).slice(0, 10);
    }
    if (results.length === 0 && mentionQuery.trim() !== '') {
      return [{ userId: 'no-match-reply', mentionName: 'no-match-reply', displayName: `No users matching "@${mentionQuery}"` } as UserProfileBasic];
    }
    if (results.length === 0) {
      return [{ userId: 'no-users-reply', mentionName: 'no-users-reply', displayName: 'No users to suggest.' } as UserProfileBasic];
    }
    return results;
  }, [mentionQuery, suggestedProfilesForReply, isLoadingProfilesForReply, showSuggestions, isReplying, currentUserId]);

  const profilesForReplyMentionResolution = useMemo(() => {
    const profiles: UserProfileBasic[] = [];
    if (user && user.uid) {
      profiles.push({
        userId: user.uid,
        mentionName: generateAnonymousName(user.uid),
        displayName: user.displayName || generateAnonymousName(user.uid),
        avatarUrl: user.photoURL || undefined,
        actualDisplayName: user.displayName || undefined,
      });
    }
    if (comment.userId && !profiles.find(p => p.userId === comment.userId)) {
      profiles.push({
        userId: comment.userId,
        mentionName: comment.userName || generateAnonymousName(comment.userId),
        displayName: comment.userName || generateAnonymousName(comment.userId),
        avatarUrl: comment.userAvatar,
      });
    }
    subComments.forEach(sc => {
      if (!profiles.find(p => p.userId === sc.userId)) {
        profiles.push({
          userId: sc.userId,
          mentionName: sc.userName || generateAnonymousName(sc.userId),
          displayName: sc.userName || generateAnonymousName(sc.userId),
          avatarUrl: sc.userAvatar,
        });
      }
    });
    (suggestedProfilesForReply || []).forEach(suggestedProfile => {
      if (!profiles.find(p => p.userId === suggestedProfile.userId)) {
        profiles.push(suggestedProfile);
      }
    });
    return profiles;
  }, [user, comment, subComments, suggestedProfilesForReply]);

  const handleDeleteClick = useCallback(async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteCommentFromPost(postId, comment.id);
      toast({ title: "Comment Deleted" });
      onDelete();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Delete Failed", description: `Could not delete comment: ${error.message}` });
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, postId, comment.id, toast, onDelete]);

  const handleReplySubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newReply.trim() || isSubmittingReply) return;
    setIsSubmittingReply(true);
    const finalMentionedUids = extractMentionedUids(newReply.trim(), profilesForReplyMentionResolution);
    const replyData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'> = {
      userId: user.uid,
      text: newReply.trim(),
      mentionedUserIds: finalMentionedUids,
    };
    try {
      await addSubCommentToComment(postId, comment.id, replyData);
      toast({ title: "Reply Added" });
      setNewReply('');
      setShowSuggestions(false);
      setMentionQuery('');
      setReplyingToSubComment(null);
      if (!showReplies) setShowReplies(true);
      else refetchSubComments();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Reply Failed", description: `Could not add reply: ${error.message}` });
    } finally {
      setIsSubmittingReply(false);
    }
  }, [user, newReply, isSubmittingReply, postId, comment.id, showReplies, refetchSubComments, toast, extractMentionedUids, profilesForReplyMentionResolution]);

  const evaluateMentionState = useCallback((text: string, cursorPosition: number) => {
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) {
        activeQuery = potentialQuery;
      }
    }
    setMentionQuery(activeQuery !== null ? activeQuery : '');
    setShowSuggestions(activeQuery !== null);
  }, [setMentionQuery, setShowSuggestions]);

  const handleMentionInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewReply(value);
    evaluateMentionState(value, e.target.selectionStart || 0);
  }, [setNewReply, evaluateMentionState]);

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
        replyInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    }
    setShowSuggestions(false);
    setMentionQuery('');
  }, [newReply, setNewReply, setMentionQuery, setShowSuggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSuggestions && suggestionsPopoverRef.current && !suggestionsPopoverRef.current.contains(event.target as Node) && replyInputRef.current && !replyInputRef.current.contains(event.target as Node)) {
        if (showSuggestions) setShowSuggestions(false);
      }
    };
    if (showSuggestions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);

  const handleLikeClick = useCallback(async () => {
    if (!user || isLiking) return;
    setIsLiking(true);
    const previousComments = queryClient.getQueryData<ClientComment[]>(['comments', postId]);
    queryClient.setQueryData<ClientComment[]>(['comments', postId], (oldComments = []) =>
      oldComments.map(c => {
        if (c.id === comment.id) {
          const currentlyLiked = c.likedBy?.includes(user!.uid);
          return {
            ...c,
            likeCount: currentlyLiked ? (c.likeCount ?? 1) - 1 : (c.likeCount ?? 0) + 1,
            likedBy: currentlyLiked ? c.likedBy?.filter(uid => uid !== user!.uid) ?? [] : [...(c.likedBy ?? []), user!.uid],
          };
        }
        return c;
      })
    );
    try {
      await toggleLikeComment(postId, comment.id, user.uid);
    } catch (err) {
      toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
      if (previousComments) queryClient.setQueryData(['comments', postId], previousComments);
    } finally {
      setIsLiking(false);
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    }
  }, [user, isLiking, queryClient, postId, comment.id, toast]);

  const toggleShowReplies = useCallback(() => setShowReplies(prev => !prev), []);

  const toggleReplyForm = useCallback(() => {
    setIsReplying(prev => {
      if (!prev) {
        setNewReply('');
        setReplyingToSubComment(null);
        evaluateMentionState("", 0);
        setTimeout(() => replyInputRef.current?.focus(), 0);
      } else {
        setShowSuggestions(false);
        setMentionQuery('');
      }
      return !prev;
    });
  }, [evaluateMentionState, setNewReply]);

  const handleSubCommentDeleted = useCallback(() => refetchSubComments(), [refetchSubComments]);

  // const handleStartSubCommentReply = useCallback((subCommentToReplyTo: ClientSubComment) => {
  //   if (!user) return;
  //   setIsReplying(true);
  //   const subCommentAuthorMentionName = generateAnonymousName(subCommentToReplyTo.userId);
  //   const initialReplyText = `@${subCommentAuthorMentionName} `;
  //   setNewReply(initialReplyText);
  //   setReplyingToSubComment(subCommentToReplyTo);
  //   evaluateMentionState(initialReplyText, initialReplyText.length);
  //   setTimeout(() => {
  //     replyInputRef.current?.focus();
  //     if (replyInputRef.current) {
  //       const len = replyInputRef.current.value.length;
  //       replyInputRef.current.setSelectionRange(len, len);
  //     }
  //   }, 0);
  // }, [user, setNewReply, setIsReplying, setReplyingToSubComment, evaluateMentionState]);


  return (
    <div className="group border-b border-border/50 pb-4">
      <div className="flex items-start gap-3 ">
        <Link href={`/profile/${comment.userId}`} passHref>
          <Avatar className="h-8 w-8 mt-1 flex-shrink-0 cursor-pointer">
            <AvatarImage src={comment.userAvatar} alt={displayAnonymousName} />
            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
              {getSharedInitials(displayAnonymousName)}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-grow bg-muted/50 p-3 rounded-lg min-w-0">
          <div className="flex justify-between items-center mb-1">
            <Link href={`/profile/${comment.userId}`} passHref>
              <p className="text-sm font-medium text-foreground truncate hover:underline cursor-pointer">
                {displayAnonymousName}
              </p>
            </Link>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <p className="text-xs text-muted-foreground">
                {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {user && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleLikeClick}
                  disabled={isLiking}
                  className={cn("text-xs h-auto p-0.5 flex items-center gap-0.5", hasLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500")}
                  aria-pressed={hasLiked}
                >
                  {isLiking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Heart className={cn("h-3 w-3", hasLiked ? "fill-current" : "")} />}
                  {(comment.likeCount ?? 0) > 0 ? <span className="text-xs ml-0.5">({comment.likeCount})</span> : ''}
                </Button>
              )}
              {isOwnComment && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground/70 hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      disabled={isDeleting}
                      aria-label="Delete comment"
                    >
                      {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Comment?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this comment? This action cannot be undone. Deleting the comment will also remove all replies.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteClick} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground break-words">
            <TextWithMentions text={comment.text} mentionedUserIds={comment.mentionedUserIds || []} IS_UID_REGEX={IS_UID_REGEX_COMMENT}/>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 pl-11 mt-2">
        {user && (
          <Button variant="ghost" size="xs" onClick={toggleReplyForm} className="text-xs text-muted-foreground hover:text-primary h-auto p-1">
            <CornerDownRight className="h-3 w-3 mr-1" /> Reply
          </Button>
        )}
        <Button variant="ghost" size="xs" onClick={toggleShowReplies} className="text-xs text-muted-foreground hover:text-primary h-auto p-1">
          {isLoadingSubComments ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : showReplies ? 'Hide Replies' : `View Replies ${subComments && subComments.length > 0 ? `(${subComments.length})` : ''}`}
        </Button>
      </div>

      {isReplying && user && (
        <Popover
          open={showSuggestions && filteredSuggestionsForReply.length > 0 && (filteredSuggestionsForReply[0]?.userId !== 'loading-reply' && filteredSuggestionsForReply[0]?.userId !== 'no-users-reply' && filteredSuggestionsForReply[0]?.userId !== 'no-match-reply')}
          onOpenChange={(open) => { setShowSuggestions(open); if (!open) setMentionQuery(''); }}
        >
          <PopoverTrigger asChild>
            <form onSubmit={handleReplySubmit} className="flex items-center gap-2 pl-11 mt-2 relative">
              <Input
                ref={replyInputRef}
                type="text"
                placeholder={`Replying to ${displayAnonymousName}... (@mention someone)`}
                value={newReply}
                onChange={handleMentionInputChange}
                onFocus={handleMentionInputChange}
                onKeyDown={(e) => { if (showSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) { if (e.key !== 'Escape') e.preventDefault(); } }}
                onBlurCapture={() => setTimeout(() => { if (suggestionsPopoverRef.current && !suggestionsPopoverRef.current.contains(document.activeElement as Node) && replyInputRef.current !== document.activeElement) { if (showSuggestions) setShowSuggestions(false); } }, 150)}
                disabled={isSubmittingReply}
                className="flex-grow h-8 text-sm"
                aria-label="New reply input"
                autoComplete="off"
              />
              <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={!newReply.trim() || isSubmittingReply}>
                {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}
                <span className="sr-only">Send Reply</span>
              </Button>
            </form>
          </PopoverTrigger>
          <PopoverContent ref={suggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
            {filteredSuggestionsForReply.map(profile => {
              const displayableName = profile.actualDisplayName || profile.companyName;
              const showSecondaryNameLine = displayableName && profile.mentionName && displayableName.toLowerCase() !== profile.mentionName.toLowerCase();
              return (
                profile.userId === 'loading-reply' || profile.userId === 'no-users-reply' || profile.userId === 'no-match-reply' ? (
                  <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                ) : (
                  <Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectSuggestion(profile)}>
                    <Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName} /><AvatarFallback className="text-xs">{getSharedInitials(profile.mentionName)}</AvatarFallback></Avatar>
                    <div className="flex flex-col items-start">
                      {showSecondaryNameLine && (<span className="font-medium text-foreground">{displayableName}</span>)}
                      <span className={cn("text-muted-foreground", !showSecondaryNameLine && "font-medium text-foreground")}>@{profile.mentionName}</span>
                    </div>
                  </Button>
                )
              );
            })}
          </PopoverContent>
        </Popover>
      )}

      {showReplies && (
        <div className="pl-11 mt-3 space-y-3 border-l-2 border-border ml-5">
          {isLoadingSubComments ? <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
            : subCommentsError ? <p className="text-xs text-destructive pl-2">Error loading replies.</p>
            : subComments && subComments.length === 0 ? <p className="text-xs text-muted-foreground pl-2">No replies yet.</p>
            : subComments && subComments.map((subComment) => (
              <SubCommentItem
                key={subComment.id}
                subComment={subComment}
                currentUserId={currentUserId}
                postId={postId}
                commentId={comment.id}
                onDelete={handleSubCommentDeleted}
                // onStartReply={handleStartSubCommentReply} // Removed for now
              />
            ))}
        </div>
      )}
    </div>
  );
});
CommentItem.displayName = 'CommentItem';