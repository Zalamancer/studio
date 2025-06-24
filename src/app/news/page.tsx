// src/app/news/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Newspaper, Edit2, Loader2, AlertTriangle, FilterX, Search, Tag, PlusCircle, ListFilter, Rss } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPublishedNewsArticles, getNewsArticlesByUserId } from '@/services/newsService';
import type { ClientNewsArticle } from '@/types/news';
import { cn } from '@/lib/utils';
import { ArticleListItem } from '@/components/news/ArticleListItem';
import { Input } from '@/components/ui/input';
import { getUserCollections } from '@/services/collectionService';
import type { ClientCollection } from '@/types/collection';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ClientTag } from '@/types/tag';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePage } from '@/contexts/PageContext';
import { useRouter } from 'next/navigation';
import { getFollowingIds } from '@/services/followService'; // New import

const EMPTY_TAG_ARRAY: ClientTag[] = []; // Stable reference for an empty array

const NewsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { isFilterViewVisible, setHandleCreateClick, searchTerm, setSearchTerm, setFilterContent } = usePage();
  const router = useRouter();

  const [activeArticleView, setActiveArticleView] = useState<'all' | 'my_articles' | 'followed'>('all');

  const { data: allPublishedArticles = [], isLoading: isLoadingAllArticles, error: allArticlesError } = useQuery<ClientNewsArticle[]>({
     queryKey: ['publishedNewsArticlesAll'],
     queryFn: () => getPublishedNewsArticles(100),
     staleTime: 1000 * 60 * 5,
  });
  
  const { data: userArticles = [], isLoading: isLoadingUserArticles, error: userArticlesError } = useQuery<ClientNewsArticle[]>({
    queryKey: ['userNewsArticlesAllStatuses', user?.uid],
    queryFn: () => user ? getNewsArticlesByUserId(user.uid) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: followedIds = [], isLoading: isLoadingFollowed } = useQuery<string[]>({
    queryKey: ['followedUserIds', user?.uid],
    queryFn: () => (user ? getFollowingIds(user.uid) : Promise.resolve([])),
    enabled: !!user && activeArticleView === 'followed', // Only fetch when this view is active
    staleTime: 1000 * 60 * 5,
  });

  const { data: userCollections = [] } = useQuery<ClientCollection[]>({
    queryKey: ['userCollections', user?.uid],
    queryFn: () => user ? getUserCollections(user.uid) : Promise.resolve([]),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  const savedItemIds = useMemo(() => {
    if (!userCollections || userCollections.length === 0) return new Set<string>();
    const ids = new Set<string>();
    userCollections.forEach(collection => {
        (collection.postIds || []).forEach(id => ids.add(id));
        (collection.articleIds || []).forEach(id => ids.add(id));
    });
    return ids;
  }, [userCollections]);

  const getCleanTextExcerpt = useCallback((htmlString: string | null | undefined, maxLength: number = 150): string => {
    if (typeof document === 'undefined' || !htmlString) return '';
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlString;
      tempDiv.querySelectorAll('pre, figure, hr, img, iframe, div[data-embed-wrapper="true"], h1, h2, h3, h4, h5, h6').forEach(el => el.remove());
      let textContent = tempDiv.textContent || tempDiv.innerText || "";
      textContent = textContent.replace(/\s\s+/g, ' ').trim();
      if (textContent.length <= maxLength) return textContent;
      let excerpt = textContent.substring(0, maxLength);
      const lastSpace = excerpt.lastIndexOf(' ');
      if (lastSpace > Math.floor(maxLength * 0.7)) excerpt = excerpt.substring(0, lastSpace);
      return excerpt + "...";
    } catch (e) {
      return htmlString.substring(0, maxLength) + (htmlString.length > maxLength ? "..." : "");
    }
  }, []);

  const filteredArticles = useMemo(() => {
    let articlesToDisplay: ClientNewsArticle[] = [];

    if (activeArticleView === 'my_articles' && user) {
      articlesToDisplay = userArticles;
    } else if (activeArticleView === 'followed' && user) {
      articlesToDisplay = allPublishedArticles.filter(article => followedIds.includes(article.userId));
    } else {
      articlesToDisplay = allPublishedArticles;
    }
    
    if (searchTerm.trim() !== '') {
      const lowerSearchTerm = searchTerm.toLowerCase();
      articlesToDisplay = articlesToDisplay.filter(
        article =>
          article.title.toLowerCase().includes(lowerSearchTerm) ||
          (article.tags && article.tags.some(tag => tag.toLowerCase().includes(lowerSearchTerm))) ||
          (article.content && getCleanTextExcerpt(article.content, 200).toLowerCase().includes(lowerSearchTerm))
      );
    }
    if (activeArticleView === 'my_articles') {
        return articlesToDisplay.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return articlesToDisplay.sort((a,b) => (b.publishedAt || b.updatedAt || 0) - (a.publishedAt || a.updatedAt || 0));
  }, [allPublishedArticles, userArticles, activeArticleView, user, searchTerm, getCleanTextExcerpt, followedIds]);

  const isLoading = authLoading || isLoadingAllArticles || (!!user && isLoadingUserArticles) || (activeArticleView === 'followed' && isLoadingFollowed);

  const handleCollectionUpdate = useCallback(() => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: ['userCollections', user.uid] });
    }
  }, [user, queryClient]);

  const clearAllFilters = useCallback(() => {
    setActiveArticleView('all');
    setSearchTerm('');
  }, [setSearchTerm]);
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeArticleView !== 'all') count++;
    return count;
  }, [activeArticleView]);

  const FilterContent = useCallback(() => (
    <div className="space-y-4 p-4 border-b">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">View</Label>
        <div className="grid grid-cols-3 gap-2 flex-shrink-0">
          <Button variant={activeArticleView === 'all' ? "secondary" : "ghost"} size="sm" onClick={() => setActiveArticleView('all')} className={cn("h-9 px-3 text-xs rounded-md", activeArticleView === 'all' && "font-semibold bg-primary/10 text-primary border border-primary/30")}>
            All Articles
          </Button>
          {user && (
            <>
              <Button variant={activeArticleView === 'my_articles' ? "secondary" : "ghost"} size="sm" onClick={() => setActiveArticleView('my_articles')} className={cn("h-9 px-3 text-xs rounded-md", activeArticleView === 'my_articles' && "font-semibold bg-primary/10 text-primary border border-primary/30")}>
                My Articles
              </Button>
              <Button variant={activeArticleView === 'followed' ? "secondary" : "ghost"} size="sm" onClick={() => setActiveArticleView('followed')} className={cn("h-9 px-3 text-xs rounded-md", activeArticleView === 'followed' && "font-semibold bg-primary/10 text-primary border border-primary/30")}>
                <Rss className="mr-1.5 h-3.5 w-3.5" /> Followed
              </Button>
            </>
          )}
        </div>
      </div>
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full h-9 text-xs text-primary hover:underline">
          <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear All Filters ({activeFilterCount})
        </Button>
      )}
    </div>
  ), [user, activeArticleView, activeFilterCount, clearAllFilters]);

  useEffect(() => {
    setFilterContent(<FilterContent />);
    setHandleCreateClick(() => router.push('/news/create'));
  }, [setFilterContent, setHandleCreateClick, router, FilterContent]);

  const getEmptyStateMessage = () => {
    if (searchTerm) return `No articles found for "${searchTerm}".`;
    if (activeArticleView === 'my_articles') return "You haven't created any articles yet.";
    if (activeArticleView === 'followed') return "You aren't following any authors yet, or they haven't posted.";
    return "No articles to show right now.";
  };

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-0 md:py-6 flex flex-col flex-1 relative">
      {isMobile && isFilterViewVisible && (
        <div className="absolute inset-x-0 top-0 bg-background z-40 h-full overflow-y-auto">
          <FilterContent />
        </div>
      )}

      <div className={cn("flex-1 mt-2", isMobile && "mt-0", isMobile && isFilterViewVisible && "hidden")}>
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-2 text-sm text-muted-foreground mt-2">Loading articles...</p></div>
        )}
        {(allArticlesError || (user && userArticlesError)) && !isLoading &&(
           <div className="text-destructive flex flex-col items-center gap-2 text-sm p-6 bg-destructive/5 rounded-md justify-center border border-destructive/20 mb-6"><AlertTriangle className="h-8 w-8 flex-shrink-0" /><p className="font-semibold">Error Loading Articles</p><p>{allArticlesError?.message || userArticlesError?.message || "An unexpected error occurred."}</p></div>
        )}
        {!isLoading && !allArticlesError && filteredArticles.length === 0 && (
          <div className="text-center py-10"><Newspaper className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" /><p className="text-lg font-medium text-muted-foreground">{getEmptyStateMessage()}</p>
            {activeArticleView === 'my_articles' && !searchTerm && user && (
               <Button asChild size="sm" className="mt-4"><Link href="/news/create"><PlusCircle className="mr-2 h-4 w-4"/>Create Your First Article</Link></Button>
            )}
          </div>
        )}
        {!isLoading && !allArticlesError && filteredArticles.length > 0 && (
          <div className="max-w-3xl mx-auto space-y-8">
            {filteredArticles.map((article) => (
              <ArticleListItem key={article.id} article={article} getCleanTextExcerpt={getCleanTextExcerpt} currentUserId={user?.uid || null} savedItemIds={savedItemIds} onCollectionUpdate={handleCollectionUpdate}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsPage;
