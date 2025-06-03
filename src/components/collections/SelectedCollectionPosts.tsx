
// src/components/collections/SelectedCollectionPosts.tsx
"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsForCollectionPage, removePostFromCollection } from '@/services/collectionService';
import type { ClientCollection } from '@/types/collection';
import type { Post } from '@/types/post';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
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
    <Card className="shadow-lg border-border">
      <CardHeader>
        <CardTitle className="truncate">{collection.name}</CardTitle>
        <CardDescription className="truncate">
          {collection.description || "Posts saved in this collection."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Loading posts...</p>
          </div>
        )}
        {error && (
          <div className="text-destructive flex items-center gap-2 text-sm p-4 bg-destructive/5 rounded-md justify-center">
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
          <div className="space-y-4 max-h-[calc(100vh-20rem)] overflow-y-auto pr-2">
            {posts.map((post) => (
              <Card key={post.id} className="shadow-sm hover:shadow-md transition-shadow bg-muted/30">
                <CardHeader className="p-3 pb-2">
                  <div className="flex justify-between items-start">
                    <Link href={`/?postId=${post.id}`} passHref legacyBehavior>
                      <a className="text-sm font-semibold text-foreground hover:text-primary line-clamp-2 flex-grow" target="_blank" rel="noopener noreferrer">
                        {post.question}
                      </a>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-1 text-destructive hover:text-destructive flex-shrink-0 ml-2"
                      onClick={() => setPostToRemove({ postId: post.id, postTitle: post.question })}
                      disabled={removePostMutation.isPending && removePostMutation.variables?.postIdToRemove === post.id}
                      title="Remove from collection"
                    >
                      {removePostMutation.isPending && removePostMutation.variables?.postIdToRemove === post.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                   {post.imageUrls && post.imageUrls.length > 0 && (
                        <div className="mt-1.5 rounded overflow-hidden aspect-[16/9] relative max-h-24">
                            <Image src={post.imageUrls[0]} alt="Post image" fill style={{objectFit:"cover"}} data-ai-hint="abstract illustration"/>
                        </div>
                   )}
                </CardHeader>
                <CardContent className="p-3 pt-1">
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {post.tags.slice(0,3).map(tag => <Badge key={`${post.id}-${tag}`} variant="secondary" className="text-xs">{tag}</Badge>)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Added on: {post.createdAt instanceof Timestamp ? post.createdAt.toDate().toLocaleDateString() : 'Date unavailable'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      
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
    </Card>
  );
};

    