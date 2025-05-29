
// src/components/board-page/PostDetailComments.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, MessageCircle, Send } from 'lucide-react';
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import type { NewCommentData, ClientComment } from '@/types/comment';
import type { UserProfileBasic } from '@/types/connection';
import { addCommentToPost, getCommentsForPost } from '@/services/commentService';
import { fetchUserProfileBasic, getSuggestibleUsers } from '@/services/connectionService'; // Assuming getSuggestibleUsers for mentions
import { useToast } from '@/hooks/use-toast';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { CommentItem } from './CommentItem'; // Assuming CommentItem is a separate component
import { extractMentionedUids } from '@/lib/mentionUtils'; // Using centralized util
import { cn } from '@/lib/utils';

interface PostDetailCommentsProps {
  post: Post;
  currentUser: FirebaseUser | null;
}

export const PostDetailComments: React.FC<PostDetailCommentsProps> = React.memo(({ post, currentUser }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newComment, setNewComment] = useState('');
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  const [replyingTo, setReplyingTo] = useState<ClientComment | null>(null);
  const [activeReplyInputFor, setActiveReplyInputFor] = useState<string | null>(null);


  const { data: comments = [], isLoading: isLoadingComments, refetch: refetchComments } = useQuery<ClientComment[]>({
    queryKey: ['comments', post.id],
    queryFn: () => currentUser ? getCommentsForPost(post.id) : Promise.resolve([]),
    enabled: !!post.id && !!currentUser,
  });

  const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsersForPanel', post.id, debouncedNewCommentMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!post && !!currentUser && showNewCommentSuggestions,
    staleTime: 1000 * 60 * 5,
  });

  const newCommentMentionProfilesMap = useMemo(() => {
    const map = new Map<string, UserProfileBasic>();
    if (generalSuggestibleUsers) {
      generalSuggestibleUsers.forEach(profile => map.set(profile.userId, profile));
    }
    return map;
  }, [generalSuggestibleUsers]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedNewCommentMentionQuery(newCommentMentionQuery), 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

  const addCommentMutation = useMutation({
    mutationFn: (commentDataWithPostId: NewCommentData & { postId: string }) => {
        const { postId: pId, ...restData } = commentDataWithPostId;
        return addCommentToPost(pId, restData);
    },
    onSuccess: () => {
        setNewComment(''); setNewCommentMentionQuery(''); setShowNewCommentSuggestions(false);
        toast({ title: "Comment Added" });
        queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Comment Failed", description: `Could not add comment: ${error.message}.` }),
  });

  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !post || !newComment.trim() || addCommentMutation.isPending) return;
    
    const profilesToSearchForMentions: UserProfileBasic[] = [...newCommentMentionProfilesMap.values()];
    if (post.userId && !profilesToSearchForMentions.find(p => p.userId === post.userId)) {
        const authorProfile = await fetchUserProfileBasic(post.userId);
        if (authorProfile) profilesToSearchForMentions.push(authorProfile);
    }
    comments.forEach(async (comment) => {
        if (comment.userId && !profilesToSearchForMentions.find(p => p.userId === comment.userId)) {
            const commenterProfile = await fetchUserProfileBasic(comment.userId);
            if(commenterProfile) profilesToSearchForMentions.push(commenterProfile);
        }
    });
    const finalMentionedUids = extractMentionedUids(newComment.trim(), profilesToSearchForMentions);

    const commentData: NewCommentData & { postId: string } = {
      postId: post.id,
      userId: currentUser.uid,
      text: newComment.trim(),
      mentionName: generateAnonymousName(currentUser.uid),
      mentionedUserIds: finalMentionedUids,
      likeCount: 0,
      likedBy: [],
    };
    addCommentMutation.mutate(commentData);
  }, [currentUser, post, newComment, addCommentMutation, newCommentMentionProfilesMap, comments, queryClient, toast]);

  const evaluateNewCommentMentionState = useCallback((text: string, cursorPosition: number) => {
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\\n/.test(potentialQuery)) activeQuery = potentialQuery;
    }
    setNewCommentMentionQuery(activeQuery !== null ? activeQuery : '');
    setShowNewCommentSuggestions(activeQuery !== null);
  }, []);

  const handleNewCommentInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    evaluateNewCommentMentionState(value, e.target.selectionStart || 0);
  }, [evaluateNewCommentMentionState]);

  const handleNewCommentInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    evaluateNewCommentMentionState(e.target.value, e.target.selectionStart || 0);
  }, [evaluateNewCommentMentionState]);

  const handleSelectNewCommentSuggestion = useCallback((profile: UserProfileBasic) => {
    if (!newCommentInputRef.current || !profile.mentionName) return;
    const currentValue = newComment; const cursorPosition = newCommentInputRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition); const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1) {
      const textBeforeMention = currentValue.substring(0, lastAtIndex); const textAfterCursor = currentValue.substring(cursorPosition);
      setNewComment(`@${profile.mentionName} ${textAfterCursor}`); // Simpler insertion for now
      const newCursorPosition = `@${profile.mentionName} `.length;
      setTimeout(() => {
        newCommentInputRef.current?.focus();
        newCommentInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    }
    setShowNewCommentSuggestions(false); setNewCommentMentionQuery('');
  }, [newComment]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNewCommentSuggestions && newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(event.target as Node) && newCommentInputRef.current && !newCommentInputRef.current.contains(event.target as Node)) {
        setShowNewCommentSuggestions(false);
      }
    };
    if (showNewCommentSuggestions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewCommentSuggestions]);

  const filteredNewCommentSuggestions = useMemo(() => {
    if (!showNewCommentSuggestions) return [];
    if (isLoadingGeneralSuggestions) return [{ userId: 'loading-main-comment', mentionName: 'loading-main-comment', displayName: 'Loading users...' } as UserProfileBasic];
    let source = Array.from(newCommentMentionProfilesMap.values()).filter(p => p.userId !== currentUser?.uid);
    if (debouncedNewCommentMentionQuery.trim() === '') { /* Show from general list */ }
    else {
      const queryLower = debouncedNewCommentMentionQuery.toLowerCase();
      source = source.filter(p => p.mentionName.toLowerCase().includes(queryLower) || (p.displayName && p.displayName.toLowerCase().includes(queryLower)));
    }
    if (source.length === 0 && debouncedNewCommentMentionQuery.trim() !== '') return [{ userId: 'no-match-main-comment', mentionName: 'no-match-main-comment', displayName: `No users matching "@${debouncedNewCommentMentionQuery}"` } as UserProfileBasic];
    if (source.length === 0) return [{ userId: 'no-users-main-comment', mentionName: 'no-users-main-comment', displayName: 'No users to suggest here.' } as UserProfileBasic];
    return source.slice(0, 10);
  }, [showNewCommentSuggestions, isLoadingGeneralSuggestions, newCommentMentionProfilesMap, debouncedNewCommentMentionQuery, currentUser?.uid]);
  
  const handleCommentDeleted = useCallback(() => refetchComments(), [refetchComments]);


  return (
    <div className="mt-6 border-t pt-4">
      <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" /> Comments ({currentUser && !isLoadingComments ? comments.length : '...'})
      </h4>
      {isLoadingComments && currentUser ? (
        <div className="space-y-4"> <div className="h-16 w-full bg-muted rounded animate-pulse"></div> <div className="h-16 w-full bg-muted rounded animate-pulse"></div> </div>
      ) : !currentUser ? (
        <p className="text-sm text-muted-foreground text-center py-4">Login to view and add comments.</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id} comment={comment} currentUserId={currentUser?.uid ?? null} postId={post.id}
              onDelete={handleCommentDeleted} postAuthorId={post.userId}
              replyingTo={replyingTo?.id === comment.id ? replyingTo : null} onSetReplyingTo={setReplyingTo}
              activeReplyInputFor={activeReplyInputFor} onSetActiveReplyInputFor={setActiveReplyInputFor}
            />
          ))}
        </div>
      )}

      {currentUser && (
        <Popover
          open={showNewCommentSuggestions && filteredNewCommentSuggestions.length > 0 && (filteredNewCommentSuggestions[0]?.userId !== 'loading-main-comment' && filteredNewCommentSuggestions[0]?.userId !== 'no-users-main-comment' && filteredNewCommentSuggestions[0]?.userId !== 'no-match-main-comment')}
          onOpenChange={(open) => { setShowNewCommentSuggestions(open); if (!open) setNewCommentMentionQuery(''); }}
        >
          <PopoverTrigger asChild>
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Input
                ref={newCommentInputRef} type="text" placeholder="Add a comment... (@mention someone)" value={newComment}
                onChange={handleNewCommentInputChange} onFocus={handleNewCommentInputFocus}
                disabled={!currentUser || addCommentMutation.isPending} className="flex-grow bg-background"
                aria-label="New comment input" autoComplete="off"
              />
              <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={!newComment.trim() || !currentUser || addCommentMutation.isPending}>
                {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}
                <span className="sr-only">Send Comment</span>
              </Button>
            </form>
          </PopoverTrigger>
          <PopoverContent ref={newCommentSuggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
            {filteredNewCommentSuggestions.map(profile => {
              const displayableName = profile.companyName || profile.actualDisplayName || profile.mentionName;
              const showSecondaryNameLine = (profile.companyName || profile.actualDisplayName) && (profile.companyName || profile.actualDisplayName)!.toLowerCase() !== profile.mentionName.toLowerCase();
              return (
                ['loading-main-comment', 'no-users-main-comment', 'no-match-main-comment'].includes(profile.userId) ? (
                  <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                ) : (
                  <Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectNewCommentSuggestion(profile)}>
                    <Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName} /><AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback></Avatar>
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
    </div>
  );
});

PostDetailComments.displayName = 'PostDetailComments';
