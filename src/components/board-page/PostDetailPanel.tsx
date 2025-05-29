
// src/components/board-page/PostDetailPanel.tsx
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Added Label import
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send, DollarSign, HandHelping, User, X, Trash2, CalendarDays, Star, MessageSquare, Info, AtSign, Briefcase, FileText } from 'lucide-react'; // Added more icons
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
import { ZodError, z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, useForm } from "@/components/ui/form"; // Import useForm
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"; // Import Tabs components

import { PostDetailHeader } from './PostDetailHeader';
import { PostDetailContentBody } from './PostDetailContentBody';
import { PostDetailBidding } from './PostDetailBidding';
import { PostDetailComments } from './PostDetailComments';

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
  const user = currentUser;

  const [newComment, setNewComment] = useState('');
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Moved from BoardPageContent - For bids
  const { data: bids = [], isLoading: isLoadingBids } = useQuery<ClientBid[]>({
    queryKey: ['bids', post?.id],
    queryFn: () => (post && user) ? getBidsForPost(post.id) : Promise.resolve([]),
    enabled: !!post?.id && !!user && post.requestType === 'help_request',
  });

  const addBidMutation = useMutation({
    mutationFn: addBidToPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bids', post?.id] });
      toast({ title: "Bid Placed Successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Bid Failed", description: error.message });
    },
  });

  // Moved from BoardPageContent - For comments
  const { data: comments = [], isLoading: isLoadingComments, refetch: refetchComments } = useQuery<ClientComment[]>({
    queryKey: ['comments', post?.id],
    queryFn: () => (post && user) ? getCommentsForPost(post.id) : Promise.resolve([]),
    enabled: !!post?.id && !!user,
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

  const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsersForPanel', post?.id, user?.uid, debouncedNewCommentMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!post && !!user && showNewCommentSuggestions,
    staleTime: 1000 * 60 * 5,
  });

  const newCommentMentionProfilesMap = useMemo(() => {
    const map = new Map<string, UserProfileBasic>();
    if (generalSuggestibleUsers) {
      generalSuggestibleUsers.forEach(profile => {
        if (user && profile.userId !== user.uid) {
          map.set(profile.userId, profile);
        }
      });
    }
    if (post?.userId && user && post.userId !== user.uid && !map.has(post.userId)) {
      map.set(post.userId, { userId: post.userId, mentionName: generateAnonymousName(post.userId), displayName: generateAnonymousName(post.userId) });
    }
    comments.forEach(comment => {
      if (comment.userId && user && comment.userId !== user.uid && !map.has(comment.userId)) {
        map.set(comment.userId, { userId: comment.userId, mentionName: comment.mentionName || generateAnonymousName(comment.userId), displayName: comment.userName || generateAnonymousName(comment.userId), avatarUrl: comment.userAvatar });
      }
    });
    return map;
  }, [generalSuggestibleUsers, user, post?.userId, comments]);

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
      if (post) queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      if (post) queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Comment Failed", description: `Could not add comment: ${error.message}.` });
    },
    onSettled: () => {
      setIsSubmittingComment(false);
    }
  });

  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post || !newComment.trim() || addCommentMutation.isPending) return;
    setIsSubmittingComment(true);

    const profilesToSearch = Array.from(newCommentMentionProfilesMap.values());
    const finalMentionedUids = extractMentionedUids(newComment.trim(), profilesToSearch);

    const commentData: NewCommentData & { postId: string } = {
      postId: post.id,
      userId: user.uid,
      text: newComment.trim(),
      mentionName: generateAnonymousName(user.uid),
      mentionedUserIds: finalMentionedUids,
      likeCount: 0,
      likedBy: [],
    };
    addCommentMutation.mutate(commentData);
  }, [user, post, newComment, addCommentMutation, newCommentMentionProfilesMap, queryClient, toast, setIsSubmittingComment]);

  const evaluateNewCommentMentionState = useCallback((text: string, cursorPosition: number) => {
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) {
        activeQuery = potentialQuery;
      }
    }
    setNewCommentMentionQuery(activeQuery !== null ? activeQuery : '');
    setShowNewCommentSuggestions(activeQuery !== null);
  }, [setNewCommentMentionQuery, setShowNewCommentSuggestions]);

  const handleNewCommentInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    evaluateNewCommentMentionState(value, e.target.selectionStart || 0);
  }, [setNewComment, evaluateNewCommentMentionState]);

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
  }, [newComment, setNewComment, setShowNewCommentSuggestions, setNewCommentMentionQuery]);

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
    if (isLoadingGeneralSuggestions && debouncedNewCommentMentionQuery) return [{ userId: 'loading-main-comment', mentionName: 'loading...', displayName: 'Loading users...' } as UserProfileBasic];

    let profilesSource = Array.from(newCommentMentionProfilesMap.values());

    if (debouncedNewCommentMentionQuery.trim() === '') {
      const threadParticipantIds = new Set<string>();
      if (post?.userId && user && post.userId !== user.uid) threadParticipantIds.add(post.userId);
      comments.forEach(c => { if (user && c.userId !== user.uid) threadParticipantIds.add(c.userId); });
      const threadProfiles = Array.from(threadParticipantIds).map(id => newCommentMentionProfilesMap.get(id)).filter(Boolean) as UserProfileBasic[];
      const generalProfilesForEmptyQuery = profilesSource.filter(p => !threadParticipantIds.has(p.userId));
      profilesSource = [...threadProfiles, ...generalProfilesForEmptyQuery].slice(0, 5);
    } else {
      const queryLower = debouncedNewCommentMentionQuery.toLowerCase();
      profilesSource = profilesSource.filter(p =>
        p.mentionName.toLowerCase().includes(queryLower) ||
        (p.companyName && p.companyName.toLowerCase().includes(queryLower)) ||
        (p.actualDisplayName && p.actualDisplayName.toLowerCase().includes(queryLower))
      ).slice(0, 10);
    }
    if (profilesSource.length === 0 && debouncedNewCommentMentionQuery.trim() !== '') return [{ userId: 'no-match-main-comment', mentionName: 'no-match', displayName: `No users matching "@${debouncedNewCommentMentionQuery}"` } as UserProfileBasic];
    if (profilesSource.length === 0) return [{ userId: 'no-users-main-comment', mentionName: 'no-users', displayName: 'No users to suggest.' } as UserProfileBasic];
    return profilesSource;
  }, [showNewCommentSuggestions, isLoadingGeneralSuggestions, newCommentMentionProfilesMap, debouncedNewCommentMentionQuery, post?.userId, comments, user]);

  // Delete Post Mutation (passed from parent)
  const [deletePostMutationIsPending, setDeletePostMutationIsPending] = useState(false); // Example, should use actual mutation's pending state

  const handleDeletePostClick = () => {
    if (post && post.id) {
      // This is just a placeholder for how the parent's delete mutation would be called
      // The actual deletePostMutation.isPending would come from the parent if that mutation lives there
      // For now, we'll simulate:
      setDeletePostMutationIsPending(true);
      onDelete(post.id);
      // Parent would handle reset of its pending state
    }
  };
  
  const { data: connectionStatus } = useQuery<ConnectionStatus | null>({
    queryKey: ['connectionStatus', currentUser?.uid, post?.userId],
    queryFn: () => (currentUser && post?.userId) ? getConnectionStatus(currentUser.uid, post.userId) : Promise.resolve(null),
    enabled: !!currentUser && !!post?.userId && currentUser.uid !== post.userId,
  });

  if (!post) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card className="flex flex-col flex-1 overflow-hidden bg-card border-border rounded-lg shadow-xl">
      <PostDetailHeader
        post={post}
        currentUser={user}
        onClose={onClose}
        onDelete={handleDeletePostClick}
        deletePostMutationIsPending={deletePostMutationIsPending} // Pass this down
        connectionStatus={connectionStatus}
      />
      <ScrollArea className="flex-grow bg-background">
        <div className="p-4">
          <PostDetailContentBody post={post} />
          {post.requestType === 'help_request' && post.userId !== user?.uid && post.maxBudget != null && (
            <PostDetailBidding
              post={post}
              currentUser={user}
              onClosePanel={onClose} // Example prop
              bids={bids}
              isLoadingBids={isLoadingBids}
              addBidMutation={addBidMutation} // Pass mutation
            />
          )}
          <PostDetailComments
            post={post}
            currentUser={user}
            comments={comments}
            isLoadingComments={isLoadingComments}
            refetchComments={refetchComments}
          />
        </div>
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
                 const displayableName = profile.actualDisplayName || profile.companyName || profile.mentionName;
                 const showSecondaryNameLine = (profile.actualDisplayName || profile.companyName) && (profile.actualDisplayName || profile.companyName)!.toLowerCase() !== profile.mentionName.toLowerCase();
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
        ) : (
          <p className="text-xs text-muted-foreground text-center w-full">
            <Link href="/login" className="text-primary hover:underline">Log in</Link> to add comments or bids.
          </p>
        )}
      </CardFooter>
    </Card>
  );
});

PostDetailPanel.displayName = "PostDetailPanel";
export { PostDetailPanel }; // Ensure named export
