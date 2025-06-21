// src/components/collections/SelectedCollectionPosts.tsx
"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsForCollectionPage, removePostFromCollection } from '@/services/collectionService';
import type { ClientCollection } from '@/types/collection';
import type { Post } from '@/types/post';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, AlertTriangle, FolderOpen, ExternalLink } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils'; // Import cn

interface SelectedCollectionPostsProps {
  collection: ClientCollection;
  currentUserId: string;
}

interface PostToRemove {
  postId: string;
  postTitle: string;
}

export const SelectedCollectionPosts: React.FC<SelectedCollectionPostsProps> = ({ collection, currentUserId }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [postToRemove, setPostToRemove] = useState<PostToRemove | null>(null);

  const { data: posts = [], isLoading, error } = useQuery<Post[]>({
    queryKey: ['collectionPosts', collection.id],
    queryFn: () => getPostsForCollectionPage(collection.id),
    enabled: !!collection.id,
  });

  const removePostMutation = useMutation({
    mutationFn: ({ postIdToRemove }: { postIdToRemove: string }) => {
      return removePostFromCollection(collection.id, postIdToRemove, currentUserId);
    },
    onSuccess: (_, variables) => {
      toast({ title: "Post Removed", description: `Successfully removed from "${collection.name}".` });
      queryClient.invalidateQueries({ queryKey: ['collectionPosts', collection.id] });
      queryClient.invalidateQueries({ queryKey: ['userCollections', currentUserId] }); // To update post count on card
      setPostToRemove(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error Removing Post", description: error.message });
      setPostToRemove(null);
    },
  });

  const handleConfirmRemovePost = () => {
    if (postToRemove) {
      removePostMutation.mutate({ postIdToRemove: postToRemove.postId });
    }
  };

  return (
    <div>
      <div className="mb-6 px-4 md:px-0">
        <h2 className="text-2xl font-bold truncate text-foreground">{collection.name}</h2>
        <p className="text-sm text-muted-foreground truncate">
          {collection.description || "Posts saved in this collection."}
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading posts...</p>
        </div>
      )}
      {error && (
        <div className="text-destructive flex items-center gap-2 text-sm p-4 bg-destructive/5 rounded-md justify-center mx-4 md:mx-0">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>Error loading posts: {error.message}</div>
        </div>
      )}
      {!isLoading && !error && posts.length === 0 && (
        <div className="text-center py-10">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">This collection is empty.</p>
          <p className="text-xs text-muted-foreground mt-1">Add posts from the main board.</p>
        </div>
      )}
      {!isLoading && !error && posts.length > 0 && (
        <div className="md:space-y-4">
          {posts.map((post) => {
            const postDate = post.createdAt
              ? (post.createdAt instanceof Timestamp
                  ? post.createdAt.toDate()
                  : new Date(post.createdAt as any)
                ).toLocaleDateString()
              : 'Date unavailable';
            const hasImage = post.imageUrls && post.imageUrls.length > 0;

            return (
              <Card key={post.id} className="md:shadow-sm md:hover:shadow-md transition-shadow bg-background rounded-none md:rounded-lg border-b md:border">
                <div className="p-3">
                  {/* Mobile Layout */}
                  <div className="md:hidden">
                    {/* Row 1: Title */}
                    <Link href={`/?postId=${post.id}`} target="_blank" rel="noopener noreferrer">
                      <h3 className="text-sm font-semibold text-foreground hover:text-primary" title={post.question}>
                        {post.question}
                      </h3>
                    </Link>
                    {/* Row 2: Tags + Delete */}
                    <div className="flex justify-between items-center gap-2 mt-2">
                       <div className="flex-grow min-w-0 overflow-x-auto horizontal-scroll-with-fade">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                              {post.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                          </div>
                      </div>
                       <div className="flex-shrink-0 ml-2">
                          <Button
                              variant="ghost" size="icon" className="h-7 w-7 p-1 text-destructive/80 hover:text-destructive"
                              onClick={() => setPostToRemove({ postId: post.id, postTitle: post.question })}
                              disabled={removePostMutation.isPending && removePostMutation.variables?.postIdToRemove === post.id}
                              title="Remove from collection"
                          >
                              {removePostMutation.isPending && removePostMutation.variables?.postIdToRemove === post.id
                              ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                       </div>
                    </div>
                     {/* Row 3: Image + Description Grid */}
                    <div className="grid grid-cols-12 gap-3 items-start mt-3">
                      {hasImage && (
                        <div className="col-span-4 relative aspect-square rounded-md overflow-hidden bg-muted">
                          <Image src={post.imageUrls[0]} alt="Post image" fill style={{objectFit:"cover"}} data-ai-hint="abstract illustration" sizes="(max-width: 768px) 33vw, 100px"/>
                        </div>
                      )}
                      <div className={cn(hasImage ? "col-span-8" : "col-span-12")}>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {post.descriptionDetails || 'No additional details provided.'}
                        </p>
                        <p className="text-xs text-muted-foreground/80 mt-2">
                          Added on: {postDate}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:grid md:grid-cols-12 md:gap-4 items-start">
                      {/* Left Column: Image */}
                      {hasImage && (
                          <div className="md:col-span-4 lg:col-span-3 relative aspect-square rounded-md overflow-hidden bg-muted">
                              <Image src={post.imageUrls[0]} alt="Post image" fill style={{objectFit:"cover"}} data-ai-hint="abstract illustration" sizes="(max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 200px"/>
                          </div>
                      )}
                      {/* Right Column: Details */}
                      <div className={cn(hasImage ? "md:col-span-8 lg:col-span-9" : "md:col-span-12", "flex flex-col h-full")}>
                          <div className="flex justify-between items-start gap-2">
                               <Link href={`/?postId=${post.id}`} target="_blank" rel="noopener noreferrer" className="flex-grow min-w-0">
                                  <h3 className="text-base font-semibold text-foreground hover:text-primary" title={post.question}>
                                      {post.question}
                                  </h3>
                              </Link>
                               <div className="flex-shrink-0">
                                  <Button
                                      variant="ghost" size="icon" className="h-7 w-7 p-1 text-destructive/80 hover:text-destructive"
                                      onClick={() => setPostToRemove({ postId: post.id, postTitle: post.question })}
                                      disabled={removePostMutation.isPending && removePostMutation.variables?.postIdToRemove === post.id}
                                      title="Remove from collection"
                                  >
                                      {removePostMutation.isPending && removePostMutation.variables?.postIdToRemove === post.id
                                      ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                               </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {post.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-2 flex-grow">
                               {post.descriptionDetails || 'No additional details provided.'}
                          </p>
                          <div className="flex justify-between items-center mt-2 pt-2 border-t">
                              <p className="text-xs text-muted-foreground/80">
                                  Added on: {postDate}
                              </p>
                               <Link href={`/?postId=${post.id}`} className="text-xs text-primary hover:underline flex items-center gap-1" target="_blank" rel="noopener noreferrer">
                                  View Post <ExternalLink className="h-3 w-3" />
                              </Link>
                          </div>
                      </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!postToRemove} onOpenChange={(open) => !open && setPostToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the post &quot;{postToRemove?.postTitle.substring(0,50)}{postToRemove && postToRemove.postTitle.length > 50 ? '...' : ''}&quot; from this collection?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPostToRemove(null)} disabled={removePostMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemovePost}
              disabled={removePostMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removePostMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remove Post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
