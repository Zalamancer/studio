
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"; // Import ScrollArea and ScrollBar
import { Loader2, Sparkles, HandHelping, Briefcase } from "lucide-react";
import { PostCard } from './PostCard';
import type { Post } from '@/types/post';
import { availableTags } from '@/components/layout/MainLayout';
import { cn } from '@/lib/utils';

interface PostListProps {
  posts: Post[];
  isLoading: boolean;
  onPostSelect: (post: Post) => void;
  selectedPostId?: string | null;
}

export const PostList: React.FC<PostListProps> = ({ posts, isLoading, onPostSelect, selectedPostId }) => {
  const [activeTab, setActiveTab] = useState<string>("recommended");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  }, []);

  const filteredPostsByTags = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    let filtered = selectedTags.length === 0 ? posts : posts.filter(post => 
        Array.isArray(post.tags) && selectedTags.every(tag => post.tags.includes(tag))
    );
    return filtered.sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : (typeof a.createdAt === 'number' ? a.createdAt : 0);
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : (typeof b.createdAt === 'number' ? b.createdAt : 0);
        return timeB - timeA;
    });
  }, [posts, selectedTags]);

  const helpRequestPosts = useMemo(() => 
    filteredPostsByTags.filter(post => post.requestType === 'help_request'), 
    [filteredPostsByTags]
  );
  const opportunitiesPosts = useMemo(() => 
    filteredPostsByTags.filter(post => post.requestType === 'post' || !post.requestType), 
    [filteredPostsByTags]
  );

  const renderPostsGrid = useCallback((postsToRender: Post[]) => (
    <div className="columns-1 md:columns-2 gap-4 space-y-4">
      {postsToRender.length > 0 ? (
        postsToRender.map((post) => (
          <PostCard 
            key={post.id} 
            post={post} 
            onOpen={onPostSelect} 
            isSelected={selectedPostId === post.id} 
          />
        ))
      ) : (
        <div className="col-span-full text-center py-10">
          <p className="text-muted-foreground">
            {isLoading ? "Loading..." : (selectedTags.length > 0 ? "No posts found matching the selected tags." : "No posts available in this category yet.")}
          </p>
        </div>
      )}
    </div>
  ), [isLoading, selectedTags, onPostSelect, selectedPostId]);

  if (isLoading && posts.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading posts...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 px-1">
        <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-muted-foreground mr-2 flex-shrink-0">Filter by Tag:</span>
            <ScrollArea className="w-full whitespace-nowrap rounded-md flex-grow min-w-0">
                <div className="flex space-x-2 pb-2">
                    {availableTags.map((tag) => (
                    <Button
                        key={tag}
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleTagClick(tag)}
                        className={cn(
                        "rounded-full px-3 py-1 text-xs transition-colors duration-150 flex-shrink-0", // Added flex-shrink-0
                        selectedTags.includes(tag) ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                        aria-pressed={selectedTags.includes(tag)}
                    >
                        {tag}
                    </Button>
                    ))}
                    {selectedTags.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTags([])} className="text-xs text-primary hover:underline p-1 h-auto flex-shrink-0">
                        Clear Filters
                    </Button>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-grow">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="recommended" className="flex items-center gap-1.5 text-xs sm:text-sm"><Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Recommended</TabsTrigger>
          <TabsTrigger value="help_requests" className="flex items-center gap-1.5 text-xs sm:text-sm"><HandHelping className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Help Requests</TabsTrigger>
          <TabsTrigger value="opportunities" className="flex items-center gap-1.5 text-xs sm:text-sm"><Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Opportunities</TabsTrigger>
        </TabsList>
        <TabsContent value="recommended" className="mt-0 flex-grow overflow-hidden">
          <ScrollArea className="h-full pr-2"> {renderPostsGrid(filteredPostsByTags)} </ScrollArea>
        </TabsContent>
        <TabsContent value="help_requests" className="mt-0 flex-grow overflow-hidden">
          <ScrollArea className="h-full pr-2"> {renderPostsGrid(helpRequestPosts)} </ScrollArea>
        </TabsContent>
        <TabsContent value="opportunities" className="mt-0 flex-grow overflow-hidden">
          <ScrollArea className="h-full pr-2"> {renderPostsGrid(opportunitiesPosts)} </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

PostList.displayName = "PostList";
