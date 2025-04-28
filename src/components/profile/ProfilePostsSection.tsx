// src/components/profile/ProfilePostsSection.tsx
"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPostsByUserId } from '@/services/postService';
import type { Post } from '@/types/post';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card'; // Adjusted Card imports
import { Badge } from '@/components/ui/badge';
import { Timestamp } from 'firebase/firestore';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProfilePostsSectionProps {
  userId: string;
}

const ProfilePostCard = React.memo(({ post, onOpen }: { post: Post, onOpen: () => void }) => {
  const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : 'Date unavailable';

  return (
      <Card
        className="mb-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer break-inside-avoid bg-card"
        onClick={onOpen}
        aria-label={`View details for post: ${post.question}`}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      >
        <CardHeader className="p-4">
           <div className="flex flex-wrap gap-1 mb-2">
                {post.tags?.map((tag, index) => (
                 <Badge key={`${post.id}-profile-tag-${index}`} variant="secondary" className="text-xs cursor-default">
                   {tag}
                 </Badge>
                ))}
            </div>
           <h3 className="text-base font-semibold leading-snug text-card-foreground">{post.question}</h3>
           {post.description && (
             <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {post.description}
             </p>
          )}
           <p className="mt-2 text-xs text-muted-foreground/80">
              Posted: {postDate}
           </p>
        </CardHeader>
      </Card>
  );
});
ProfilePostCard.displayName = 'ProfilePostCard';


export const ProfilePostsSection: React.FC<ProfilePostsSectionProps> = ({ userId }) => {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const {
    data: posts = [],
    isLoading,
    error,
    isError,
  } = useQuery<Post[], Error>({
    queryKey: ['userPosts', userId],
    queryFn: () => getPostsByUserId(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <p className="text-muted-foreground">Loading posts...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center p-6 text-destructive gap-2 border rounded-lg bg-destructive/10">
        <AlertTriangle className="h-5 w-5" />
        <p>Error loading posts: {error?.message}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="text-muted-foreground text-center p-6 border rounded-lg bg-muted/50">
        This user hasn't posted anything yet.
      </p>
    );
  }

  return (
      <div>
          {/* Post Feed - Masonry Layout */}
         <div className="columns-1 sm:columns-2 gap-4 space-y-4">
             {posts.map((post) => (
                 <ProfilePostCard key={post.id} post={post} onOpen={() => setSelectedPost(post)} />
             ))}
         </div>

         {/* Post Detail Side Panel (Similar to main page) */}
         <Sheet open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
             <SheetContent className="sm:max-w-lg w-[90vw] p-0" side="right">
                 <ScrollArea className="h-screen">
                 {selectedPost && (
                     <div className="p-6 flex flex-col h-full">
                         <SheetHeader className="space-y-2.5 text-left mb-6 border-b pb-4">
                             <SheetTitle className="text-xl font-semibold">{selectedPost.question}</SheetTitle>
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                 {selectedPost.tags?.map((tag, index) => (
                                 <Badge key={`${selectedPost.id}-detail-tag-${index}`} variant="secondary" className="text-xs cursor-default">{tag}</Badge>
                                 ))}
                             </div>
                              <SheetDescription className="text-sm pt-1">
                                 Posted on: {selectedPost.createdAt instanceof Timestamp ? selectedPost.createdAt.toDate().toLocaleDateString() : 'Date unavailable'}
                             </SheetDescription>
                         </SheetHeader>

                         <div className="space-y-4 text-sm flex-grow">
                              {selectedPost.description && (
                                  <div>
                                      <strong className="text-foreground">Details:</strong>
                                      <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{selectedPost.description}</p>
                                  </div>
                              )}
                              {/* Add other relevant post details if needed */}
                         </div>
                         {/* Footer can be added if actions are needed (e.g., navigating to the post on the main board) */}
                         {/* <div className="mt-6 pt-4 border-t flex justify-end gap-2"> ... </div> */}
                     </div>
                 )}
                 </ScrollArea>
             </SheetContent>
         </Sheet>
      </div>
  );
};
