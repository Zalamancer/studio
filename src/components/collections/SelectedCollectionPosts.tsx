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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Added Tabs

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
  const postDate = post.createdAt instanceof Date ? post.createdAt.toLocaleDateString() : 'Date unavailable';
  const hasImage = post.imageUrls && post.imageUrls.length > 0;

  return (
    <div className="p-3">
      <div className="md:hidden">
        <h3 className="text-base font-semibold text-foreground hover:text-primary mb-1 line-clamp-3" title={post.question}>
          <Link href={`/?postId=${post.id}`} target="_blank" rel="noopener noreferrer">{post.question}</Link>
        </h3>
        <div className="flex justify-between items-center gap-2 mb-3">
          <div className="flex-grow min-w-0 overflow-x-auto horizontal-scroll-with-fade">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              {post.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
            </div>
          </div>
          <div className="flex-shrink-0 ml-2">
            <Button variant="ghost" size="icon" className="h-7 w-7 p-1 text-destructive/80 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(post); }} disabled={removeMutationPending} title="Remove from collection">
              {removeMutationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-3 items-start">
          {hasImage && <div className="col-span-4 relative aspect-square rounded-md overflow-hidden bg-muted"><Image src={post.imageUrls![0]} alt="Post image" fill style={{ objectFit: "cover" }} data-ai-hint="abstract illustration" sizes="(max-width: 768px) 33vw, 100px" /></div>}
          <div className={cn(hasImage ? "col-span-8" : "col-span-12")}>
            <p className="text-sm text-muted-foreground line-clamp-3">{post.descriptionDetails || 'No additional details provided.'}</p>
            <p className="text-xs text-muted-foreground/80 mt-2">Added on: {postDate}</p>
          </div>
        </div>
      </div>
      <div className="hidden md:grid md:grid-cols-12 md:gap-4 md:items-start">
        {hasImage && <div className="md:col-span-4 lg:col-span-3 relative aspect-square rounded-md overflow-hidden bg-muted"><Image src={post.imageUrls![0]} alt="Post image" fill style={{ objectFit: "cover" }} data-ai-hint="abstract illustration" sizes="(max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 200px" /></div>}
        <div className={cn(hasImage ? "md:col-span-8 lg:col-span-9" : "md:col-span-12", "flex flex-col h-full")}>
          <div className="flex justify-between items-start gap-2">
            <Link href={`/?postId=${post.id}`} target="_blank" rel="noopener noreferrer" className="flex-grow min-w-0"><h3 className="text-base font-semibold text-foreground hover:text-primary" title={post.question}>{post.question}</h3></Link>
            <div className="flex-shrink-0"><Button variant="ghost" size="icon" className="h-7 w-7 p-1 text-destructive/80 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(post); }} disabled={removeMutationPending} title="Remove from collection">{removeMutationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">{post.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}</div>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-2 flex-grow">{post.descriptionDetails || 'No additional details provided.'}</p>
          <div className="flex justify-between items-center mt-2 pt-2 border-t"><p className="text-xs text-muted-foreground/80">Added on: {postDate}</p><Link href={`/?postId=${post.id}`} className="text-xs text-primary hover:underline flex items-center gap-1" target="_blank" rel="noopener noreferrer">View Post <ExternalLink className="h-3 w-3" /></Link></div>
        </div>
      </div>
    </div>
  );
};
PostItem.displayName = "PostItem";

const ArticleItem: React.FC<{ article: ClientNewsArticle, onRemove: (article: ClientNewsArticle) => void, removeMutationPending: boolean }> = ({ article, onRemove, removeMutationPending }) => {
    const articleDate = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Date unavailable';
    const hasImage = !!article.coverImageUrl;
  
    return (
      <div className="p-3">
        {/* Mobile Layout */}
        <div className="md:hidden">
          <h3 className="text-base font-semibold text-foreground hover:text-primary mb-1 line-clamp-3" title={article.title}>
            <Link href={`/news/article/${article.id}`} target="_blank" rel="noopener noreferrer">{article.title}</Link>
          </h3>
          <div className="flex justify-between items-center gap-2 mb-3">
            <div className="flex-grow min-w-0 overflow-x-auto horizontal-scroll-with-fade">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                {article.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
              </div>
            </div>
            <div className="flex-shrink-0 ml-2">
              <Button variant="ghost" size="icon" className="h-7 w-7 p-1 text-destructive/80 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(article); }} disabled={removeMutationPending} title="Remove from collection">
                {removeMutationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-3 items-start">
            {hasImage && <div className="col-span-4 relative aspect-square rounded-md overflow-hidden bg-muted"><Image src={article.coverImageUrl!} alt={article.title} fill style={{ objectFit: "cover" }} data-ai-hint="news cover" sizes="(max-width: 768px) 33vw, 100px" /></div>}
            <div className={cn(hasImage ? "col-span-8" : "col-span-12")}>
              <p className="text-sm text-muted-foreground line-clamp-3">{article.content ? article.content.substring(0, 150) + "..." : 'No preview available.'}</p>
              <p className="text-xs text-muted-foreground/80 mt-2">Published on: {articleDate}</p>
            </div>
          </div>
        </div>
  
        {/* Desktop Layout */}
        <div className="hidden md:grid md:grid-cols-12 md:gap-4 md:items-start">
          {hasImage && <div className="md:col-span-4 lg:col-span-3 relative aspect-square rounded-md overflow-hidden bg-muted"><Image src={article.coverImageUrl!} alt={article.title} fill style={{ objectFit: "cover" }} data-ai-hint="news cover" sizes="(max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 200px" /></div>}
          <div className={cn(hasImage ? "md:col-span-8 lg:col-span-9" : "md:col-span-12", "flex flex-col h-full")}>
            <div className="flex justify-between items-start gap-2">
              <Link href={`/news/article/${article.id}`} target="_blank" rel="noopener noreferrer" className="flex-grow min-w-0"><h3 className="text-base font-semibold text-foreground hover:text-primary" title={article.title}>{article.title}</h3></Link>
              <div className="flex-shrink-0"><Button variant="ghost" size="icon" className="h-7 w-7 p-1 text-destructive/80 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(article); }} disabled={removeMutationPending} title="Remove from collection">{removeMutationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">{article.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}</div>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2 flex-grow">{article.content ? article.content.substring(0, 200) + "..." : 'No preview available.'}</p>
            <div className="flex justify-between items-center mt-2 pt-2 border-t"><p className="text-xs text-muted-foreground/80">Published on: {articleDate}</p><Link href={`/news/article/${article.id}`} className="text-xs text-primary hover:underline flex items-center gap-1" target="_blank" rel="noopener noreferrer">View Article <ExternalLink className="h-3 w-3" /></Link></div>
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
    <div>
      <div className="mb-6 px-4 md:px-0">
        <h2 className="text-2xl font-bold truncate text-foreground">{collection.name}</h2>
        <p className="text-sm text-muted-foreground truncate">{collection.description || `Items saved in this collection.`}</p>
      </div>

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
          <TabsTrigger value="articles">Articles ({articles.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="posts">
          {isLoadingPosts && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {postsError && <div className="text-destructive flex items-center gap-2 text-sm p-4 bg-destructive/5 rounded-md justify-center"><AlertTriangle className="h-5 w-5 flex-shrink-0" /><div>Error loading posts: {postsError.message}</div></div>}
          {!isLoadingPosts && !postsError && posts.length === 0 && <div className="text-center py-10"><FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No posts saved in this collection.</p></div>}
          {!isLoadingPosts && !postsError && posts.length > 0 && (
            <div className="md:space-y-4">
              {posts.map((post, index) => (
                <React.Fragment key={post.id}>
                  <div className="md:rounded-lg md:border md:shadow-sm md:hover:shadow-md md:mb-4 transition-shadow bg-background">
                    <PostItem post={post} onRemove={() => setItemToRemove({ id: post.id, title: post.question, type: 'post' })} removeMutationPending={removeMutation.isPending && itemToRemove?.id === post.id} />
                  </div>
                  {index < posts.length - 1 && <Separator className="md:hidden" />}
                </React.Fragment>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="articles">
          {isLoadingArticles && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {articlesError && <div className="text-destructive flex items-center gap-2 text-sm p-4 bg-destructive/5 rounded-md justify-center"><AlertTriangle className="h-5 w-5 flex-shrink-0" /><div>Error loading articles: {articlesError.message}</div></div>}
          {!isLoadingArticles && !articlesError && articles.length === 0 && <div className="text-center py-10"><FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No articles saved in this collection.</p></div>}
          {!isLoadingArticles && !articlesError && articles.length > 0 && (
            <div className="md:space-y-4">
              {articles.map((article, index) => (
                <React.Fragment key={article.id}>
                  <div className="md:rounded-lg md:border md:shadow-sm md:hover:shadow-md md:mb-4 transition-shadow bg-background">
                     <ArticleItem article={article} onRemove={() => setItemToRemove({ id: article.id, title: article.title, type: 'article' })} removeMutationPending={removeMutation.isPending && itemToRemove?.id === article.id} />
                  </div>
                  {index < articles.length - 1 && <Separator className="md:hidden" />}
                </React.Fragment>
              ))}
            </div>
          )}
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
