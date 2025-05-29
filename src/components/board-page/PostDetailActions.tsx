
// src/components/board-page/PostDetailActions.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
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
import { Loader2, Trash2 } from 'lucide-react';
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import { ConnectionButton } from '@/components/ConnectionButton'; // For the Connect button

interface PostDetailActionsProps {
  post: Post;
  currentUser: FirebaseUser | null;
  onDeletePost: (postId: string) => void;
  deletePostMutationIsPending: boolean;
}

export const PostDetailActions: React.FC<PostDetailActionsProps> = React.memo(({
  post,
  currentUser,
  onDeletePost,
  deletePostMutationIsPending
}) => {
  if (!currentUser) return null; // No actions for non-logged-in users

  const isOwnPost = post.userId === currentUser.uid;

  return (
    <div className="flex justify-end gap-2 pt-1">
      {!isOwnPost && post.userId && (
        <ConnectionButton
          targetUserId={post.userId}
          targetUserName={post.userId} // Will be resolved to mentionName by ConnectionButton or its service
          size="sm"
        />
      )}
      {isOwnPost && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={deletePostMutationIsPending}>
              {deletePostMutationIsPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Post
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your post and all associated comments and bids.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletePostMutationIsPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDeletePost(post.id)}
                disabled={deletePostMutationIsPending}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deletePostMutationIsPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
});

PostDetailActions.displayName = 'PostDetailActions';
