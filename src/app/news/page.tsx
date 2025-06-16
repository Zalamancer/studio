
// src/app/news/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Newspaper, Edit2, Loader2, AlertTriangle, Filter, Search, ChevronRight } from 'lucide-react'; // Added Filter, Search, ChevronRight
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getPublishedNewsArticles, getNewsArticlesByUserId } from '@/services/newsService'; // Added getNewsArticlesByUserId
import type { ClientNewsArticle } from '@/types/news';
import { cn } from '@/lib/utils';
import { ArticleListItem } from '@/components/news/ArticleListItem'; // New component
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"; // For filter bar
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';


const newsCategoriesForFilter = [
  { id: 'for_you', title: 'For you' },
  { id: 'following', title: 'Following' }, // Placeholder
  { id: 'featured', title: 'Featured', isNew: true }, // Placeholder
  { id: 'collaborative_ventures', title: 'Collaborative Ventures' },
  { id: 'financial_insights', title: 'Financial Insights' },
  { id: 'political_regulatory', title: 'Political & Regulatory' },
  { id: 'new_opportunities', title: 'New Opportunities' },
  { id: 'events', title: 'Events' },
  { id: 'platform_updates', title: 'Platform Updates' },
  { id: 'industry_analysis', title: 'Industry Analysis' },
  { id: 'case_studies', title: 'Case Studies' },
  // Add more relevant categories if needed, matching your article categories
];


const NewsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<string>('for_you'); // Default filter
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all published articles initially
  const { data: allPublishedArticles = [], isLoading: isLoadingAllArticles, error: allArticlesError } = useQuery<ClientNewsArticle[]>({
     queryKey: ['publishedNewsArticlesAll'], // Different key to not interfere with original limited query if used elsewhere
     queryFn: () => getPublishedNewsArticles(100), // Fetch a larger number for client-side filtering
     staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Fetch user's own articles (drafts and published)
  const { data: userArticles = [], isLoading: isLoadingUserArticles, error: userArticlesError } = useQuery<ClientNewsArticle[]>({
    queryKey: ['userNewsArticlesAllStatuses', user?.uid],
    queryFn: () => user ? getNewsArticlesByUserId(user.uid) : Promise.resolve([]),
    enabled: !!user,
  });

  const filteredArticles = useMemo(() => {
    let articlesToDisplay = allPublishedArticles;

    if (selectedFilter === 'my_articles' && user) {
      articlesToDisplay = userArticles.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else if (selectedFilter !== 'for_you' && selectedFilter !== 'following' && selectedFilter !== 'featured' && selectedFilter !== 'my_articles') {
      articlesToDisplay = allPublishedArticles.filter(
        article => article.category.toLowerCase() === selectedFilter.toLowerCase()
      );
    } else if (selectedFilter === 'for_you') {
      // "For you" could be all published, or personalized in the future
      articlesToDisplay = allPublishedArticles;
    }
    // Placeholders for following/featured
    else if (selectedFilter === 'following') articlesToDisplay = []; 
    else if (selectedFilter === 'featured') articlesToDisplay = allPublishedArticles.slice(0, 5); // Example: first 5 as featured


    if (searchTerm.trim() !== '') {
      const lowerSearchTerm = searchTerm.toLowerCase();
      articlesToDisplay = articlesToDisplay.filter(
        article =>
          article.title.toLowerCase().includes(lowerSearchTerm) ||
          article.category.toLowerCase().includes(lowerSearchTerm) ||
          (article.content && getCleanTextExcerpt(article.content, 200).toLowerCase().includes(lowerSearchTerm))
      );
    }
    if (selectedFilter !== 'my_articles') { // Don't sort "My Articles" by publishedAt if it includes drafts
      return articlesToDisplay.sort((a,b) => (b.publishedAt || b.updatedAt || 0) - (a.publishedAt || a.updatedAt || 0));
    }
    return articlesToDisplay;

  }, [allPublishedArticles, userArticles, selectedFilter, searchTerm, user]);

  const isLoading = authLoading || isLoadingAllArticles || (!!user && isLoadingUserArticles);


  // Function to get a clean text excerpt (moved from old page)
  const getCleanTextExcerpt = useCallback((htmlString: string | null | undefined, maxLength: number = 150): string => {
    if (typeof document === 'undefined' || !htmlString) return '';
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlString;
      // Remove non-content elements
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


  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6">
      {/* Top Filter Bar */}
      <div className="mb-6 sticky top-14 (or your header height) z-40 bg-background py-3 border-b">
        <div className="flex items-center justify-between">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex items-center gap-1 pb-2">
              {user && (
                  <Button
                    variant={selectedFilter === 'my_articles' ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("h-8 px-3 text-xs rounded-full shrink-0", selectedFilter === 'my_articles' && "font-semibold bg-primary/10 text-primary border border-primary/30")}
                    onClick={() => setSelectedFilter('my_articles')}
                  >
                   My Articles
                  </Button>
              )}
              {newsCategoriesForFilter.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedFilter === cat.title.toLowerCase() ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("h-8 px-3 text-xs rounded-full shrink-0", selectedFilter === cat.title.toLowerCase() && "font-semibold bg-primary/10 text-primary border border-primary/30")}
                  onClick={() => setSelectedFilter(cat.title.toLowerCase())}
                >
                  {cat.title}
                  {cat.isNew && <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-green-500 text-white rounded-sm">New</span>}
                </Button>
              ))}
            </div>
             <span className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent md:hidden" />
          </ScrollArea>
          {/* Could add a ChevronRight here for mobile if list overflows */}
        </div>
        <div className="mt-3 relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 h-9 text-xs w-full rounded-md border-input focus:ring-primary focus:border-primary"
                aria-label="Search articles"
            />
        </div>
      </div>


      {/* Create Article Button - Prominent for Desktop, perhaps different for mobile */}
       <div className="mb-6 flex justify-end">
          {user && (
            <Button asChild size="sm">
                <Link href="/news/create"><Edit2 className="mr-2 h-4 w-4" /> Create News Article</Link>
            </Button>
          )}
       </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-2 text-sm text-muted-foreground mt-2">Loading articles...</p>
        </div>
      )}

      {(allArticlesError || (user && userArticlesError)) && !isLoading &&(
         <div className="text-destructive flex flex-col items-center gap-2 text-sm p-6 bg-destructive/5 rounded-md justify-center border border-destructive/20 mb-6">
           <AlertTriangle className="h-8 w-8 flex-shrink-0" />
           <p className="font-semibold">Error Loading Articles</p>
           <p>{allArticlesError?.message || userArticlesError?.message || "An unexpected error occurred."}</p>
         </div>
      )}

      {!isLoading && !allArticlesError && filteredArticles.length === 0 && (
        <div className="text-center py-10">
          <Newspaper className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-muted-foreground">
            {searchTerm ? `No articles found for "${searchTerm}"` : (selectedFilter === 'for_you' || selectedFilter === 'my_articles') ? "No articles to show right now." : `No articles found in "${selectedFilter.replace(/_/g, ' ')}".`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedFilter === 'my_articles' && !userArticlesError && !userArticles.find(a => a.status === 'draft' || a.status === 'published') ? "You haven't created any articles yet." : "Try adjusting your filters or search term."}
          </p>
        </div>
      )}

      {!isLoading && !allArticlesError && filteredArticles.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-8"> {/* Changed from grid to single column centered */}
          {filteredArticles.map((article) => (
            <ArticleListItem key={article.id} article={article} getCleanTextExcerpt={getCleanTextExcerpt} currentUserId={user?.uid || null} />
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsPage;
