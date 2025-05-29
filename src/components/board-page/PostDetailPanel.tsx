
// src/components/board-page/PostDetailPanel.tsx
"use client";

import React from 'react';
import { Card, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query'; // For delete mutation

import { PostDetailHeader } from './PostDetailHeader';
import { PostDetailContentBody } from './PostDetailContentBody';
import { PostDetailBidding } from './PostDetailBidding';
import { PostDetailComments } from './PostDetailComments';
import { PostDetailActions } from './PostDetailActions';

interface PostDetailPanelProps {
  post: Post;
  currentUser: FirebaseUser | null;
  onClose: () => void;
  onDelete: (postId: string) => void; // Callback for deleting the post
  deletePostMutationIsPending: boolean; // Pass loading state for delete
}

export const PostDetailPanel: React.FC<PostDetailPanelProps> = React.memo(({
  post,
  currentUser,
  onClose,
  onDelete,
  deletePostMutationIsPending
}) => {

  if (!post) {
    // This case should ideally be handled by the parent,
    // but as a safeguard:
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full border rounded-lg bg-card/50 text-muted-foreground p-8 sticky top-20 max-h-[calc(100vh-6rem)]">
        <p>No post selected.</p>
      </div>
    );
  }

  return (
    <Card className="flex flex-col flex-1 overflow-hidden bg-card h-full border-border rounded-lg shadow-xl sticky top-20 max-h-[calc(100vh-6rem)]">
      <PostDetailHeader post={post} onClose={onClose} />
      <ScrollArea className="flex-grow bg-background">
        <PostDetailContentBody post={post} />
        <PostDetailBidding post={post} currentUser={currentUser} onClosePanel={onClose} />
        <PostDetailComments post={post} currentUser={currentUser} />
      </ScrollArea>
      <CardFooter className="p-4 border-t bg-card flex-shrink-0">
        <PostDetailActions
          post={post}
          currentUser={currentUser}
          onDeletePost={onDelete}
          deletePostMutationIsPending={deletePostMutationIsPending}
        />
      </CardFooter>
    </Card>
  );
});

PostDetailPanel.displayName = "PostDetailPanel";
