
// src/components/collections/SelectedCollectionPosts.tsx
"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsForCollectionPage, removePostFromCollection, getArticlesForCollectionPage, removeArticleFromCollection } from '@/services/collectionService';
import type { ClientCollection } from '@/types/collection';
import type { Post } from '@/types/post';
import type { ClientNewsArticle } from '@/types/news';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, AlertTriangle, FolderOpen, ExternalLink } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';

interface SelectedCollectionPostsProps {
  collection: ClientCollection;
  currentUserId: string;
}

interface ItemToRemove {
  id: string;
  title: string;
  type: 'post' | 'article';
}

const PostItem: React.FC<{ post: Post, onRemove: (post: Post) => void, removeMutationPending: boolean }> = ({ post, onRemove, removeMutationPending }) => {
  const hasImage = post.imageUrls && post.imageUrls.length > 0;
  const postDate = post.createdAt instanceof Date 
    ? post.createdAt.toLocaleDateString() 
    : (post.createdAt as any)?.toDate?.().toLocaleDateString() || 'Date unavailable';

  return (
    <div className="p-3">
        <div className="grid grid-cols-12 gap-3 md:gap-4 items-start">
            {hasImage && (
                <Link href={`/?postId=${post.id}`} className="col-span-4 md:col-span-3 relative aspect-square rounded-md overflow-hidden bg-muted block" target="_blank" rel="noopener noreferrer">
                    <Image 
                        src={post.imageUrls![0]} 
                        alt="Post image" 
                        fill 
                        style={{ objectFit: "cover" }} 
                        data-ai-hint="abstract illustration" 
                        sizes="(max-width: 768px) 33vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 200px" 
                    />
                </Link>
            )}
            <div className={cn(hasImage ? "col-span-8 md:col-span-9" : "col-span-12", "flex flex-col h-full")}>
                <div className="flex justify-between items-start gap-2">
                    <Link href={`/?postId=${post.id}`} target="_blank" rel="noopener noreferrer" className="flex-grow min-w-0">
                        <h3 className="text-base font-semibold text-foreground hover:text-primary line-clamp-3" title={post.question}>
                            {post.question}
                        </h3>
                    </Link>
                    <div className="flex-shrink-0">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 p-1 text-destructive/80 hover:text-destructive" 
                            onClick={(e) => { e.stopPropagation(); onRemove(post); }} 
                            disabled={removeMutationPending} 
                            title="Remove from collection"
                        >
                            {removeMutationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {post.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                </div>
                <div className="flex-grow"></div>
            </div>
        </div>
    </div>
  );
};
PostItem.displayName = "PostItem";

const ArticleItem: React.FC<{ article: ClientNewsArticle, onRemove: (article: ClientNewsArticle) => void, removeMutationPending: boolean }> = ({ article, onRemove, removeMutationPending }) => {
    const hasImage = !!article.coverImageUrl;
    const publishedDate = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Draft';
  
    return (
      <div className="p-3">
        <div className="grid grid-cols-12 gap-3 md:gap-4 items-start">
          {hasImage && (
            <Link href={`/news/article/${article.id}`} className="col-span-4 md:col-span-3 relative aspect-square rounded-md overflow-hidden bg-muted block" target="_blank" rel="noopener noreferrer">
              <Image 
                src={article.coverImageUrl!} 
                alt={article.title} 
                fill 
                style={{ objectFit: "cover" }} 
                data-ai-hint="news cover" 
                sizes="(max-width: 768px) 33vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 200px" 
              />
            </Link>
          )}
          <div className={cn(hasImage ? "col-span-8 md:col-span-9" : "col-span-12", "flex flex-col h-full")}>
            <div className="flex justify-between items-start gap-2">
              <Link href={`/news/article/${article.id}`} target="_blank" rel="noopener noreferrer" className="flex-grow min-w-0">
                <h3 className="text-base font-semibold text-foreground hover:text-primary line-clamp-3" title={article.title}>
                  {article.title}
                </h3>
              </Link>
              <div className="flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 p-1 text-destructive/80 hover:text-destructive" 
                  onClick={(e) => { e.stopPropagation(); onRemove(article); }} 
                  disabled={removeMutationPending} 
                  title="Remove from collection"
                >
                  {removeMutationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {article.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
            </div>
             <div className="flex-grow"></div>
          </div>
        </div>
      </div>
    );
};
ArticleItem.displayName = "ArticleItem";

export const SelectedCollectionPosts: React.FC<SelectedCollectionPostsProps> = ({ collection, currentUserId }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [itemToRemove, setItemToRemove] = useState<ItemToRemove | null>(null);

  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['collectionPosts', collection.id],
    queryFn: () => getPostsForCollectionPage(collection.id),
    enabled: !!collection.id,
  });

  const { data: articles = [], isLoading: isLoadingArticles, error: articlesError } = useQuery<ClientNewsArticle[]>({
    queryKey: ['collectionArticles', collection.id],
    queryFn: () => getArticlesForCollectionPage(collection.id),
    enabled: !!collection.id,
  });

  const removeMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'post' | 'article' }) => {
      const removeFn = type === 'post' ? removePostFromCollection : removeArticleFromCollection;
      return removeFn(collection.id, id, currentUserId);
    },
    onSuccess: (_, variables) => {
      toast({ title: `${variables.type === 'post' ? 'Post' : 'Article'} Removed`, description: `Successfully removed from "${collection.name}".` });
      queryClient.invalidateQueries({ queryKey: [`collection${variables.type === 'post' ? 'Posts' : 'Articles'}`, collection.id] });
      queryClient.invalidateQueries({ queryKey: ['userCollections', currentUserId] });
      setItemToRemove(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error Removing Item", description: error.message });
      setItemToRemove(null);
    },
  });

  const handleConfirmRemove = () => {
    if (itemToRemove) {
      removeMutation.mutate({ id: itemToRemove.id, type: itemToRemove.type });
    }
  };

  const isLoading = isLoadingPosts || isLoadingArticles;
  const error = postsError || articlesError;

  return (
    <div className="h-full flex flex-col">
      {/* This header is removed to avoid duplication. The header in collections/page.tsx is now the single source. */}

      <Tabs defaultValue="posts" className="w-full flex-grow flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2 mb-4 flex-shrink-0">
          <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
          <TabsTrigger value="articles">Articles ({articles.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="posts" className="flex-grow min-h-0">
            <ScrollArea className="h-full">
            {isLoadingPosts && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
            {postsError && <div className="text-destructive flex items-center gap-2 text-sm p-4 bg-destructive/5 rounded-md justify-center"><AlertTriangle className="h-5 w-5 flex-shrink-0" /><div>Error loading posts: {postsError.message}</div></div>}
            {!isLoadingPosts && !postsError && posts.length === 0 && <div className="text-center py-10"><FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No posts saved in this collection.</p></div>}
            {!isLoadingPosts && !postsError && posts.length > 0 && (
                <div className="space-y-0">
                {posts.map((post, index) => (
                    <React.Fragment key={post.id}>
                    <div className="md:rounded-lg md:border md:shadow-sm md:hover:shadow-md transition-shadow bg-card">
                        <PostItem post={post} onRemove={() => setItemToRemove({ id: post.id, title: post.question, type: 'post' })} removeMutationPending={removeMutation.isPending && itemToRemove?.id === post.id} />
                    </div>
                    {index < posts.length - 1 && <Separator />}
                    </React.Fragment>
                ))}
                </div>
            )}
            </ScrollArea>
        </TabsContent>
        <TabsContent value="articles" className="flex-grow min-h-0">
            <ScrollArea className="h-full">
            {isLoadingArticles && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
            {articlesError && <div className="text-destructive flex items-center gap-2 text-sm p-4 bg-destructive/5 rounded-md justify-center"><AlertTriangle className="h-5 w-5 flex-shrink-0" /><div>Error loading articles: {articlesError.message}</div></div>}
            {!isLoadingArticles && !articlesError && articles.length === 0 && <div className="text-center py-10"><FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No articles saved in this collection.</p></div>}
            {!isLoadingArticles && !articlesError && articles.length > 0 && (
                <div className="space-y-0">
                {articles.map((article, index) => (
                    <React.Fragment key={article.id}>
                    <div className="md:rounded-lg md:border md:shadow-sm md:hover:shadow-md transition-shadow bg-card">
                        <ArticleItem article={article} onRemove={() => setItemToRemove({ id: article.id, title: article.title, type: 'article' })} removeMutationPending={removeMutation.isPending && itemToRemove?.id === article.id} />
                    </div>
                    {index < articles.length - 1 && <Separator />}
                    </React.Fragment>
                ))}
                </div>
            )}
            </ScrollArea>
        </TabsContent>
      </Tabs>
      
      <AlertDialog open={!!itemToRemove} onOpenChange={(open) => !open && setItemToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the {itemToRemove?.type} &quot;{itemToRemove?.title.substring(0, 50)}{itemToRemove && itemToRemove.title.length > 50 ? '...' : ''}&quot; from this collection?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToRemove(null)} disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove} disabled={removeMutation.isPending} className="bg-destructive hover:bg-destructive/90">
              {removeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Remove Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
