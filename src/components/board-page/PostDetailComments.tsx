// src/components/board-page/PostDetailComments.tsx
"use client";

import React from 'react'; // Removed unnecessary imports: useState, useEffect, useRef, useCallback, useMemo
import { useQuery } from '@tanstack/react-query'; // Removed useMutation, useQueryClient as they move to Panel
// Removed Button, Input, Popover, Avatar as they move to Panel or are unused here
import { Loader2, MessageCircle } from 'lucide-react'; // Kept MessageCircle
// Removed Post type, NewCommentData
import type { ClientComment } from '@/types/comment';
import type { User as FirebaseUser } from 'firebase/auth';
import { getCommentsForPost } from '@/services/commentService';
// Removed: fetchUserProfileBasic, getSuggestibleUsers, generateAnonymousName, getInitials, extractMentionedUids
import { CommentItem } from './CommentItem';
// Removed: cn

interface PostDetailCommentsProps {
  post: Post;
  currentUser: FirebaseUser | null;
}

export const PostDetailComments: React.FC<PostDetailCommentsProps> = React.memo(({ post, currentUser }) => {
  // Removed state and logic for new comment input and mentions, as it's moved to PostDetailPanel
  // Removed addCommentMutation

  const { data: comments = [], isLoading: isLoadingComments, refetch: refetchComments } = useQuery<ClientComment[]>({
    queryKey: ['comments', post.id],
    queryFn: () => currentUser ? getCommentsForPost(post.id) : Promise.resolve([]),
    enabled: !!post.id && !!currentUser,
  });

  const handleCommentDeleted = React.useCallback(() => refetchComments(), [refetchComments]);

  // Removed logic for new comment mention suggestions (generalSuggestibleUsers, newCommentMentionProfilesMap, filteredNewCommentSuggestions)

  return (
    <div className="mt-4 px-4"> {/* Adjusted padding, can be fine-tuned */}
      <h4 className="text-md font-semibold mb-3 flex items-center gap-2 text-foreground">
        <MessageCircle className="h-5 w-5 text-primary" /> Comments ({currentUser && !isLoadingComments ? comments.length : '...'})
      </h4>
      {isLoadingComments && currentUser ? (
        <div className="space-y-4">
          <div className="h-16 w-full bg-muted rounded animate-pulse"></div>
          <div className="h-16 w-full bg-muted rounded animate-pulse"></div>
        </div>
      ) : !currentUser ? (
        <p className="text-sm text-muted-foreground text-center py-4">Login to view and add comments.</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUser?.uid ?? null}
              postId={post.id}
              onDelete={handleCommentDeleted}
              postAuthorId={post.userId}
              // Removed props related to new reply state management from CommentItem as it will be handled in PostDetailPanel
            />
          ))}
        </div>
      )}
      {/* New comment input form will be moved to PostDetailPanel's footer */}
    </div>
  );
});

PostDetailComments.displayName = 'PostDetailComments';
