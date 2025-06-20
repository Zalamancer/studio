
// src/components/profile/ProfilePostsSection.tsx
"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPostsByUserId } from '@/services/postService';
import type { Post } from '@/types/post';
import { Loader2, AlertTriangle, Link2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
           {post.imageUrls && post.imageUrls.length > 0 && (
             <div className="mt-2 rounded-md overflow-hidden aspect-video relative">
               <Image
                 src={post.imageUrls[0]}
                 alt={post.question}
                 fill
                 sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                 style={{ objectFit: 'cover' }}
                 data-ai-hint="post image"
               />
             </div>
           )}
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
         <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
             {posts.map((post) => (
                 <ProfilePostCard key={post.id} post={post} onOpen={() => setSelectedPost(post)} />
             ))}
         </div>

         <Sheet open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
             <SheetContent className="sm:max-w-lg w-[90vw] p-0 flex flex-col" side="right">
                 {selectedPost && (
                     <>
                         <ScrollArea className="flex-grow">
                             <div className="p-6 pb-0">
                                 <SheetHeader className="space-y-2.5 text-left mb-6 border-b pb-4">
                                     <SheetTitle className="text-xl font-semibold">{selectedPost.question}</SheetTitle>
                                     <div className="flex flex-wrap items-center gap-2 pt-1">
                                         {selectedPost.tags?.map((tag, index) => (
                                         <Badge key={`${selectedPost.id}-profile-detail-tag-${index}`} variant="secondary" className="text-xs cursor-default">{tag}</Badge>
                                         ))}
                                     </div>
                                     <SheetDescription className="text-sm pt-1">
                                         Posted on: {selectedPost.createdAt instanceof Timestamp ? selectedPost.createdAt.toDate().toLocaleDateString() : 'Date unavailable'}
                                     </SheetDescription>
                                 </SheetHeader>

                                 {selectedPost.imageUrls && selectedPost.imageUrls.length > 0 && (
                                 <div className="mb-4 rounded-lg overflow-hidden shadow-md">
                                     <Carousel className="w-full">
                                     <CarouselContent>
                                         {selectedPost.imageUrls.map((url, index) => (
                                         <CarouselItem key={index}>
                                             <div className="aspect-video relative">
                                             <Image
                                                 src={url}
                                                 alt={`Post image ${index + 1}`}
                                                 fill
                                                 sizes="(max-width: 640px) 100vw, 576px"
                                                 style={{ objectFit: 'contain' }}
                                                 className="rounded-md"
                                                 data-ai-hint="uploaded content"
                                             />
                                             </div>
                                         </CarouselItem>
                                         ))}
                                     </CarouselContent>
                                     {selectedPost.imageUrls.length > 1 && (
                                         <>
                                         <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2" />
                                         <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2" />
                                         </>
                                     )}
                                     </Carousel>
                                 </div>
                                 )}

                                 <div className="space-y-4 text-sm mb-6">
                                     {selectedPost.description && (
                                     <div>
                                         <strong className="text-foreground">Details:</strong>
                                         <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{selectedPost.description}</p>
                                     </div>
                                     )}

                                     <div className="grid grid-cols-1 gap-y-2 mt-4 border-t pt-4">
                                        <div>
                                            <strong className="block text-foreground">Sector:</strong>
                                            <span className="text-muted-foreground">{selectedPost.sector || 'N/A'}</span>
                                        </div>
                                        {selectedPost.subSector && (
                                            <div>
                                            <strong className="block text-foreground">Sub-Sector:</strong>
                                            <span className="text-muted-foreground">{selectedPost.subSector}</span>
                                            </div>
                                        )}
                                        {selectedPost.industry && (
                                            <div>
                                            <strong className="block text-foreground">Industry:</strong>
                                            <span className="text-muted-foreground">{selectedPost.industry}</span>
                                            </div>
                                        )}
                                        {selectedPost.naicsCode && (
                                            <div>
                                            <strong className="block text-foreground">NAICS Code:</strong>
                                            <Badge variant="outline" className="text-xs ml-1">{selectedPost.naicsCode}</Badge>
                                            </div>
                                        )}
                                     </div>

                                     <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4">
                                        <div>
                                            <strong className="block text-foreground">Business Type:</strong>
                                            <span className="text-muted-foreground">{selectedPost.businessType || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <strong className="text-foreground">Safety Indicator:</strong>
                                            <span className={cn(
                                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                            selectedPost.safetyIndicator === 'High' ? "bg-primary text-primary-foreground"
                                            : selectedPost.safetyIndicator === 'Medium' ? "bg-secondary text-secondary-foreground"
                                            : "bg-destructive text-destructive-foreground"
                                            )}>
                                            {selectedPost.safetyIndicator || 'N/A'}
                                            </span>
                                        </div>
                                        <div>
                                            <strong className="block text-foreground">Rating Score:</strong>
                                            <span className="text-muted-foreground">{selectedPost.ratingScore ? `${selectedPost.ratingScore} / 5` : 'N/A'}</span>
                                        </div>
                                     </div>
                                 </div>
                             </div>
                         </ScrollArea>
                         <SheetFooter className="p-6 border-t bg-background sticky bottom-0">
                            <Button variant="default" size="sm" asChild className="w-full">
                                <Link href={`/?postId=${selectedPost.id}`}>
                                    <Link2 className="mr-2 h-4 w-4" />
                                    View Full Post & Comments on Board
                                </Link>
                            </Button>
                         </SheetFooter>
                     </>
                 )}
             </SheetContent>
         </Sheet>
      </div>
  );
};
