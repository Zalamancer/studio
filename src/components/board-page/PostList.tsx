// src/components/board-page/PostList.tsx
"use client";

import React from 'react';
import { Loader2 } from "lucide-react";
import { PostCard } from './PostCard';
import type { Post } from '@/types/post';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';

interface PostListProps {
  posts: Post[];
  isLoading: boolean;
  onPostSelect: (post: Post) => void;
  selectedPostId?: string | null;
  noResultsMessage?: string;
}

export const PostList: React.FC<PostListProps> = ({
  posts,
  isLoading,
  onPostSelect,
  selectedPostId,
  noResultsMessage = "No posts found.",
}) => {

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading posts...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <ScrollArea className="flex-grow overflow-y-auto min-h-0 bg-muted/30 md:bg-background">
        <div className="p-1 lg:columns-2 lg:gap-4">
          {posts.length > 0 ? (
            posts.map((post, index) => (
              <PostCard key={post.id} post={post} onOpen={onPostSelect} isSelected={selectedPostId === post.id} isPriority={index < 2}/>
            ))
          ) : (
            <div className="col-span-full text-center py-10">
              <p className="text-muted-foreground">
                {noResultsMessage}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

PostList.displayName = "PostList";
