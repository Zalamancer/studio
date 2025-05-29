
// Tip: This component is getting large. Consider extracting Bidding and Comments sections
// into their own child components in the future if more functionality is added to them.
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send, DollarSign, HandHelping, User, X, Trash2, MessageSquare, Info, AtSign, Briefcase, FileText, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
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

interface PostDetailPanelProps {
  post: Post | null; // Allow post to be null initially or if not found
  currentUser: FirebaseUser | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
  deletePostMutationIsPending?: boolean; // Make it optional
}

export const PostDetailPanel: React.FC<PostDetailPanelProps> = React.memo(({
  post,
  currentUser,
  onClose,
  onDelete,
  deletePostMutationIsPending = false, // Default to false
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = currentUser;

  // --- State for New Comment Input ---
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  // Debounce mention query for new comments
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

  // Fetch general users for @mention suggestions in the new comment input
  const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsersForPanel', post?.id, user?.uid, debouncedNewCommentMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!post && !!user && showNewCommentSuggestions,
    staleTime: 1000 * 60 * 5, // 5 minutes
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
      if (post) {
        queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
        queryClient.invalidateQueries({ queryKey: ['posts'] }); // To update commentCount on PostCard
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Comment Failed", description: `Could not add comment: ${error.message}.` });
    },
    onSettled: () => {
      setIsSubmittingComment(false);
    }
  });

  const evaluateNewCommentMentionState = useCallback((text: string, cursorPosition: number) => {
    console.log("[PostDetailPanel] evaluateNewCommentMentionState - Text:", text, "Cursor:", cursorPosition);
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\r\n|\r|\n/.test(potentialQuery)) {
        activeQuery = potentialQuery;
      }
    }
    setNewCommentMentionQuery(activeQuery !== null ? activeQuery : '');
    setShowNewCommentSuggestions(activeQuery !== null);
    console.log("[PostDetailPanel] evaluateNewCommentMentionState - Active Query:", activeQuery, "Show Suggestions:", activeQuery !== null);
  }, [setNewCommentMentionQuery, setShowNewCommentSuggestions]);


  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);

    const profilesToSearch = [...generalSuggestibleUsers];
    // Ensure post author is in the search list if not already from general suggestions
    if (post.userId && !profilesToSearch.some(p => p.userId === post.userId)) {
        const authorProfile = await fetchUserProfileBasic(post.userId);
        if (authorProfile) profilesToSearch.push(authorProfile);
    }

    const finalMentionedUids = extractMentionedUids(newComment.trim(), profilesToSearch);
    console.log("[PostDetailPanel] handleCommentSubmit - Final mentioned UIDs:", finalMentionedUids);

    const commentData: NewCommentData & { postId: string } = {
      postId: post.id,
      userId: user.uid,
      text: newComment.trim(),
      mentionName: generateAnonymousName(user.uid), // Use the standard mention name
      mentionedUserIds: finalMentionedUids,
      likeCount: 0,
      likedBy: [],
    };
    addCommentMutation.mutate(commentData);
  }, [user, post, newComment, isSubmittingComment, generalSuggestibleUsers, addCommentMutation, toast, queryClient]);


  const handleNewCommentInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    if (newCommentInputRef.current) {
      evaluateNewCommentMentionState(value, newCommentInputRef.current.selectionStart || 0);
    }
  }, [evaluateNewCommentMentionState, setNewComment]);

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
      const mentionToInsert = profile.mentionName;
      setNewComment(`${textBeforeMention}@${mentionToInsert} ${textAfterCursor}`);
      const newCursorPosition = textBeforeMention.length + `@${mentionToInsert} `.length;
      setTimeout(() => {
        newCommentInputRef.current?.focus();
        newCommentInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    }
    setShowNewCommentSuggestions(false);
    setNewCommentMentionQuery('');
  }, [newComment, setNewComment, setShowNewCommentSuggestions, setNewCommentMentionQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showNewCommentSuggestions &&
        newCommentSuggestionsPopoverRef.current &&
        !newCommentSuggestionsPopoverRef.current.contains(event.target as Node) &&
        newCommentInputRef.current &&
        !newCommentInputRef.current.contains(event.target as Node)
      ) {
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
    if (isLoadingGeneralSuggestions && debouncedNewCommentMentionQuery) return [{ userId: 'loading-main-comment', displayName: 'Loading users...', mentionName: 'loading-main-comment', companyName: undefined, actualDisplayName: undefined } as UserProfileBasic];

    let source = generalSuggestibleUsers;
    // The getSuggestibleUsers service already filters if debouncedNewCommentMentionQuery is present
    // If debouncedNewCommentMentionQuery is empty, getSuggestibleUsers returns a broader list (e.g., top 25)

    if (source.length === 0 && debouncedNewCommentMentionQuery.trim() !== '') return [{ userId: 'no-match-main-comment', displayName: `No users matching "@${debouncedNewCommentMentionQuery}"`, mentionName: 'no-match-main-comment', companyName: undefined, actualDisplayName: undefined } as UserProfileBasic];
    if (source.length === 0) return [{ userId: 'no-users-main-comment', displayName: 'No users to suggest.', mentionName: 'no-users-main-comment', companyName: undefined, actualDisplayName: undefined } as UserProfileBasic];
    
    return source.slice(0, 10); // Show up to 10 suggestions
  }, [showNewCommentSuggestions, isLoadingGeneralSuggestions, generalSuggestibleUsers, debouncedNewCommentMentionQuery]);


  const { data: connectionStatus } = useQuery<ConnectionStatus | null>({
    queryKey: ['connectionStatus', currentUser?.uid, post?.userId],
    queryFn: () => (currentUser && post?.userId) ? getConnectionStatus(currentUser.uid, post.userId) : Promise.resolve(null),
    enabled: !!currentUser && !!post?.userId && currentUser.uid !== post?.userId,
  });

  if (!post) {
    return (
      <Card className="md:col-span-1 flex flex-col flex-1 items-center justify-center bg-card border-border rounded-lg shadow-xl p-8 sticky top-20 h-[calc(100vh-6.5rem)] max-h-[calc(100vh-6.5rem)]">
        <MessageSquare className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="text-lg text-muted-foreground">Select a post to view details</p>
      </Card>
    );
  }
  
  console.log("[PostDetailPanel] Rendering. Post ID:", post.id, "User Shapes length:", post.commentCount); // Example userShapes logging if it were a prop

  return (
    <Card className="flex flex-col flex-1 overflow-hidden bg-card border-border rounded-lg shadow-xl sticky top-20 h-[calc(100vh-6.5rem)] max-h-[calc(100vh-6.5rem)]">
      <PostDetailHeader
        post={post}
        currentUser={user}
        onClose={onClose}
        onDelete={() => onDelete(post.id)}
        deletePostMutationIsPending={deletePostMutationIsPending}
        connectionStatus={connectionStatus}
      />
      <ScrollArea className="flex-grow bg-background"> {/* Main content scroll */}
        <PostDetailContentBody post={post} />
        <PostDetailBidding post={post} currentUser={user} onClosePanel={onClose} />
        <PostDetailComments post={post} currentUser={user} />
      </ScrollArea>
      <CardFooter className="p-3 border-t bg-card flex-shrink-0">
        {user ? (
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
                  onKeyDownCapture={(e) => {
                    if (showNewCommentSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
                      if (e.key !== 'Escape') e.preventDefault(); // Prevent default for arrow keys and Enter if suggestions are open
                    }
                  }}
                  onBlurCapture={() => setTimeout(() => {
                    if (newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(document.activeElement as Node) && newCommentInputRef.current !== document.activeElement) {
                      if (showNewCommentSuggestions) setShowNewCommentSuggestions(false);
                    }
                  }, 150)} // Delay to allow click on suggestion
                  disabled={!user || isSubmittingComment}
                  className="flex-grow bg-background h-9 text-sm"
                  aria-label="New comment input"
                  autoComplete="off"
                />
                <Button type="submit" size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" disabled={!newComment.trim() || !user || isSubmittingComment}>
                  {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}
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
                const displayableName = profile.displayName; // This is already derived: actual || company || mention
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
                      onMouseDown={(e) => e.preventDefault()} // Prevent input blur on click
                      onClick={() => handleSelectNewCommentSuggestion(profile)}
                    >
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={profile.avatarUrl} alt={profile.mentionName} />
                        <AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start">
                        {showSecondaryNameLine ? (
                          <span className="font-medium text-foreground">{displayableName}</span>
                        ) : null}
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
        ) : (
          <p className="text-xs text-muted-foreground text-center w-full">
            Login to add comments or bids.
          </p>
        )}
      </CardFooter>
    </Card>
  );
});

PostDetailPanel.displayName = "PostDetailPanel";

    