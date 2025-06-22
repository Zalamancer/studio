// src/app/news/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Newspaper, Edit2, Loader2, AlertTriangle, FilterX, Search, Tag, PlusCircle, ListFilter } from 'lucide-react';
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
import { searchTags } from '@/services/tagService';
import type { ClientTag } from '@/types/tag';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePage } from '@/contexts/PageContext';
import { useRouter } from 'next/navigation';

const EMPTY_TAG_ARRAY: ClientTag[] = []; // Stable reference for an empty array

const NewsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { isFilterViewVisible, setHandleCreateClick, searchTerm, setSearchTerm, setFilterContent } = usePage();
  const router = useRouter();

  const [activeArticleView, setActiveArticleView] = useState<'all' | 'my_articles'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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

  const { data: userCollections = [] } = useQuery<ClientCollection[]>({
    queryKey: ['userCollections', user?.uid],
    queryFn: () => user ? getUserCollections(user.uid) : Promise.resolve([]),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  // Simplified query: Fetch top tags, no more search term.
  const { data: fetchedTags, isLoading: isLoadingTagsForFilter } = useQuery<ClientTag[]>({
    queryKey: ['searchTagsForFilter', ''], // Static key to fetch popular tags
    queryFn: () => searchTags('', 20),
    staleTime: 1000 * 60 * 1,
  });
  const availableTagsForFilter = fetchedTags || EMPTY_TAG_ARRAY; // Use stable empty array

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
    let articlesToDisplay = activeArticleView === 'my_articles' && user ? userArticles : allPublishedArticles;
    if (selectedTags.length > 0) {
      articlesToDisplay = articlesToDisplay.filter(
        article => article.tags && selectedTags.every(filterTag => 
          article.tags!.map(t => t.toLowerCase()).includes(filterTag.toLowerCase())
        )
      );
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
  }, [allPublishedArticles, userArticles, activeArticleView, user, selectedTags, searchTerm, getCleanTextExcerpt]);

  const isLoading = authLoading || isLoadingAllArticles || (!!user && isLoadingUserArticles);

  const handleCollectionUpdate = useCallback(() => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: ['userCollections', user.uid] });
    }
  }, [user, queryClient]);

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedTags([]);
    setActiveArticleView('all');
    setSearchTerm('');
  }, [setSearchTerm]);
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeArticleView !== 'all') count++;
    if (selectedTags.length > 0) count++;
    return count;
  }, [selectedTags, activeArticleView]);

  const FilterContent = useCallback(() => (
    <div className="space-y-4 p-4 border-b">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">View</Label>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant={activeArticleView === 'all' ? "secondary" : "ghost"} size="sm" onClick={() => setActiveArticleView('all')} className={cn("h-9 px-3 text-xs rounded-full flex-1", activeArticleView === 'all' && "font-semibold bg-primary/10 text-primary border border-primary/30")}>
            All Articles
          </Button>
          {user && (
            <Button variant={activeArticleView === 'my_articles' ? "secondary" : "ghost"} size="sm" onClick={() => setActiveArticleView('my_articles')} className={cn("h-9 px-3 text-xs rounded-full flex-1", activeArticleView === 'my_articles' && "font-semibold bg-primary/10 text-primary border border-primary/30")}>
              My Articles
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Filter by Tags {selectedTags.length > 0 && `(${selectedTags.length})`}</Label>
        {/* Removed search input */}
        <div className="h-48 overflow-y-auto border rounded-md">
          <div className="p-3 space-y-1.5">
            {isLoadingTagsForFilter ? (
              <div className="flex justify-center p-2"><Loader2 className="h-4 w-4 animate-spin"/></div>
            ) : availableTagsForFilter.length > 0 ? (
              availableTagsForFilter.map((tag) => (
                <div key={tag.id} className="flex items-center space-x-2">
                  <Checkbox id={`tag-filter-${tag.id}`} checked={selectedTags.includes(tag.name)} onCheckedChange={() => handleTagToggle(tag.name)}/>
                  <Label htmlFor={`tag-filter-${tag.id}`} className="text-xs font-normal flex items-center justify-between w-full"><span>{tag.name}</span><span className="text-muted-foreground text-[10px]">({tag.usageCount})</span></Label>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center">No tags found.</p>
            )}
          </div>
        </div>
        {selectedTags.length > 0 && (
          <div className="pt-2 border-t"><Button variant="ghost" size="xs" onClick={() => setSelectedTags([])} className="w-full text-primary">Clear Tag Filters</Button></div>
        )}
      </div>
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full h-9 text-xs text-primary hover:underline">
          <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear All Filters ({activeFilterCount})
        </Button>
      )}
    </div>
  ), [user, activeArticleView, selectedTags, isLoadingTagsForFilter, availableTagsForFilter, activeFilterCount, clearAllFilters, handleTagToggle]);

  useEffect(() => {
    setFilterContent(<FilterContent />);
    setHandleCreateClick(() => router.push('/news/create'));
  }, [setFilterContent, setHandleCreateClick, router, FilterContent]);

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
          <div className="text-center py-10"><Newspaper className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" /><p className="text-lg font-medium text-muted-foreground">{searchTerm ? `No articles found for "${searchTerm}".` : selectedTags.length > 0 ? "No articles found with the selected tags." : activeArticleView === 'my_articles' ? "You haven't created any articles yet." : "No articles to show right now."}</p>
            {activeArticleView === 'my_articles' && !searchTerm && selectedTags.length === 0 && user && (
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
