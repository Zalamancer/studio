
// src/components/board-page/PostDetailPanel.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation'; // For redirect after bid/offer
import { Card, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, DollarSign, HandHelping, User } from 'lucide-react'; // Added User icon for fallback
import { cn } from '@/lib/utils';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils'; // Corrected import from getSharedInitials
import { IS_VALID_FIREBASE_UID_REGEX as IS_UID_REGEX_COMPONENT } from '@/lib/utils';
import { extractMentionedUids } from '@/lib/mentionUtils';
import { addCommentToPost, getCommentsForPost } from '@/services/commentService';
import type { NewCommentData, ClientComment } from '@/types/comment';
import { fetchUserProfileBasic, getSuggestibleUsers, getConnectionStatus } from '@/services/connectionService';
import type { UserProfileBasic, ConnectionStatus } from '@/types/connection';
import { addBidToPost, getBidsForPost } from '@/services/bidService';
import type { ClientBid, NewBidData } from '@/types/bid';
import { findOrCreateConversation } from '@/services/messagingService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


import { PostDetailHeader } from './PostDetailHeader';
import { PostDetailContentBody } from './PostDetailContentBody';
import { PostDetailBidding } from './PostDetailBidding';
import { PostDetailComments } from './PostDetailComments';
// PostDetailActions was removed

interface PostDetailPanelProps {
  post: Post;
  currentUser: FirebaseUser | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
}

export const PostDetailPanel: React.FC<PostDetailPanelProps> = React.memo(({
  post,
  currentUser,
  onClose,
  onDelete,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();

  // --- State and Logic for New Comment Input ---
  const [newComment, setNewComment] = useState('');
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

  const { data: commentsData = [], isLoading: isLoadingComments } = useQuery<ClientComment[]>({
    queryKey: ['comments', post.id],
    queryFn: () => currentUser ? getCommentsForPost(post.id) : Promise.resolve([]),
    enabled: !!post.id && !!currentUser,
  });

  // Fetch profiles for users involved in the comment thread (post author, existing commenters)
  const userIdsForCommentMentions = useMemo(() => {
    const ids = new Set<string>();
    if (post.userId) ids.add(post.userId);
    commentsData.forEach(comment => ids.add(comment.userId));
    commentsData.forEach(comment => {
      comment.replies?.forEach(reply => ids.add(reply.userId));
    });
    return Array.from(ids).filter(id => id !== currentUser?.uid && IS_UID_REGEX_COMPONENT.test(id));
  }, [post.userId, commentsData, currentUser?.uid]);

  const { data: commentMentionProfilesMap = new Map<string, UserProfileBasic>() } = useQuery<Map<string, UserProfileBasic | null>>({
    queryKey: ['userProfilesForCommentMentions', post.id, userIdsForCommentMentions.join(',')],
    queryFn: async () => {
      const profiles = new Map<string, UserProfileBasic | null>();
      if (userIdsForCommentMentions.length === 0) return profiles;
      await Promise.all(
        userIdsForCommentMentions.map(async (id) => {
          const profile = await fetchUserProfileBasic(id);
          if (profile) profiles.set(id, profile);
        })
      );
      return profiles;
    },
    enabled: userIdsForCommentMentions.length > 0 && !!currentUser,
  });

  // Suggestible users for new top-level comments (can be a broader list or similar to thread participants)
   const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsersForPanel', post?.id, currentUser?.uid, debouncedNewCommentMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!post && !!currentUser && showNewCommentSuggestions,
    staleTime: 1000 * 60 * 5,
  });

  const addCommentMutation = useMutation({
    mutationFn: (commentDataWithPostId: NewCommentData & { postId: string }) => {
      const { postId: pId, ...restData } = commentDataWithPostId;
      return addCommentToPost(pId, restData);
    },
    onSuccess: () => {
      setNewComment('');
      setNewCommentMentionQuery('');
      setShowNewCommentSuggestions(false);
      toast({ title: "Comment Added" });
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Comment Failed", description: `Could not add comment: ${error.message}.` });
    },
  });

  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !post || !newComment.trim() || addCommentMutation.isPending) return;

    const profilesToSearch = Array.from(commentMentionProfilesMap.values()).filter(Boolean) as UserProfileBasic[];
    if (post.userId && !profilesToSearch.find(p => p.userId === post.userId)) {
        const authorProfile = await fetchUserProfileBasic(post.userId);
        if (authorProfile) profilesToSearch.push(authorProfile);
    }
    
    const finalMentionedUids = extractMentionedUids(newComment.trim(), profilesToSearch);

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
  }, [currentUser, post, newComment, addCommentMutation.isPending, commentMentionProfilesMap, queryClient, toast]); // Added addCommentMutation.isPending

  const evaluateNewCommentMentionState = useCallback((text: string, cursorPosition: number) => {
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) { // Corrected regex
        activeQuery = potentialQuery;
      }
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
    const currentValue = newComment;
    const cursorPosition = newCommentInputRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1) {
      const textBeforeMention = currentValue.substring(0, lastAtIndex);
      const textAfterCursor = currentValue.substring(cursorPosition);
      setNewComment(`${textBeforeMention}@${profile.mentionName} ${textAfterCursor}`);
      const newCursorPosition = textBeforeMention.length + `@${profile.mentionName} `.length;
      setTimeout(() => {
        newCommentInputRef.current?.focus();
        newCommentInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    }
    setShowNewCommentSuggestions(false);
    setNewCommentMentionQuery('');
  }, [newComment]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNewCommentSuggestions && newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(event.target as Node) && newCommentInputRef.current && !newCommentInputRef.current.contains(event.target as Node)) {
        setShowNewCommentSuggestions(false);
      }
    };
    if (showNewCommentSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNewCommentSuggestions]);
  
  const filteredNewCommentSuggestions = useMemo(() => {
    if (!showNewCommentSuggestions) return [];
    if (isLoadingGeneralSuggestions) return [{ userId: 'loading-main-comment', mentionName: 'loading...', displayName: 'Loading users...' } as UserProfileBasic];
    
    let source = generalSuggestibleUsers.filter(p => p.userId !== currentUser?.uid);

    if (debouncedNewCommentMentionQuery.trim() === '') {
      // No specific filtering, show general suggestions
    } else {
      const queryLower = debouncedNewCommentMentionQuery.toLowerCase();
      source = source.filter(p => 
        p.mentionName.toLowerCase().includes(queryLower) ||
        (p.companyName && p.companyName.toLowerCase().includes(queryLower)) ||
        (p.displayName && p.displayName.toLowerCase().includes(queryLower)) // Check against derived displayName too
      );
    }
    if (source.length === 0 && debouncedNewCommentMentionQuery.trim() !== '') return [{ userId: 'no-match-main-comment', mentionName: 'no-match', displayName: `No users matching "@${debouncedNewCommentMentionQuery}"` } as UserProfileBasic];
    if (source.length === 0) return [{ userId: 'no-users-main-comment', mentionName: 'no-users', displayName: 'No users to suggest.' } as UserProfileBasic];
    return source.slice(0, 10);
  }, [showNewCommentSuggestions, isLoadingGeneralSuggestions, generalSuggestibleUsers, debouncedNewCommentMentionQuery, currentUser?.uid]);


  const { data: connectionStatus } = useQuery<ConnectionStatus | null>({
    queryKey: ['connectionStatus', currentUser?.uid, post.userId],
    queryFn: () => (currentUser && post.userId && currentUser.uid !== post.userId) ? getConnectionStatus(currentUser.uid, post.userId) : Promise.resolve(null),
    enabled: !!currentUser && !!post.userId && currentUser.uid !== post.userId,
  });
  
  const [deletePostMutationIsPending, setDeletePostMutationIsPending] = useState(false); // Local state for delete pending

  const handleDeleteWithPanelClose = async () => {
    setDeletePostMutationIsPending(true);
    try {
        onDelete(post.id); // Call the prop
        // The original deletePostMutation from page.tsx will handle toasts and query invalidation.
        // The panel will close because selectedPost becomes null in page.tsx.
    } catch (error) {
        // Error handling is done in page.tsx's mutation
    } finally {
        setDeletePostMutationIsPending(false);
    }
  };


  if (!post) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card className="flex flex-col flex-1 overflow-hidden bg-card border-border rounded-lg shadow-xl sticky top-20 max-h-[calc(100vh-6rem)]">
      <PostDetailHeader
        post={post}
        currentUser={currentUser}
        onClose={onClose}
        onDelete={handleDeleteWithPanelClose}
        deletePostMutationIsPending={deletePostMutationIsPending}
        connectionStatus={connectionStatus}
      />
      <ScrollArea className="flex-grow bg-background">
        <PostDetailContentBody post={post} />
        <PostDetailBidding post={post} currentUser={currentUser} onClosePanel={onClose} />
        <PostDetailComments post={post} currentUser={currentUser} />
      </ScrollArea>
      <CardFooter className="p-3 border-t bg-card flex-shrink-0">
        {currentUser && (
           <Popover
            open={showNewCommentSuggestions && filteredNewCommentSuggestions.length > 0 && !['loading-main-comment', 'no-users-main-comment', 'no-match-main-comment'].includes(filteredNewCommentSuggestions[0]?.userId)}
            onOpenChange={(open) => { setShowNewCommentSuggestions(open); if (!open) setNewCommentMentionQuery(''); }}
          >
            <PopoverTrigger asChild>
              <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 w-full">
                <Input
                  ref={newCommentInputRef}
                  type="text"
                  placeholder="Add a comment... (@mention someone)"
                  value={newComment}
                  onChange={handleNewCommentInputChange}
                  onFocus={handleNewCommentInputFocus}
                  disabled={!currentUser || addCommentMutation.isPending}
                  className="flex-grow bg-background h-9 text-sm"
                  aria-label="New comment input"
                  autoComplete="off"
                />
                <Button type="submit" size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" disabled={!newComment.trim() || !currentUser || addCommentMutation.isPending}>
                  {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}
                  <span className="sr-only">Send Comment</span>
                </Button>
              </form>
            </PopoverTrigger>
            <PopoverContent
              ref={newCommentSuggestionsPopoverRef}
              className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto"
              side="top"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {filteredNewCommentSuggestions.map(profile => {
                const displayableName = profile.companyName || profile.displayName; // Use companyName as preferred secondary
                const showSecondaryNameLine = displayableName && profile.mentionName && displayableName.toLowerCase() !== profile.mentionName.toLowerCase();
                
                return (
                  (profile.userId === 'loading-main-comment' || profile.userId === 'no-users-main-comment' || profile.userId === 'no-match-main-comment') ? (
                    <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                  ) : (
                    <Button
                      key={profile.userId}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-auto px-2 py-1 text-xs"
                      onMouseDown={(e) => e.preventDefault()} 
                      onClick={() => handleSelectNewCommentSuggestion(profile)}
                    >
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={profile.avatarUrl} alt={profile.mentionName} />
                        <AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start">
                        {showSecondaryNameLine && (
                          <span className="font-medium text-foreground">{displayableName}</span>
                        )}
                        <span className={cn("text-muted-foreground", !showSecondaryNameLine && "font-medium text-foreground")}>
                          @{profile.mentionName}
                        </span>
                      </div>
                    </Button>
                  )
                );
              })}
            </PopoverContent>
          </Popover>
        )}
      </CardFooter>
    </Card>
  );
});

PostDetailPanel.displayName = "PostDetailPanel";
export default PostDetailPanel; // Default export for dynamic import
