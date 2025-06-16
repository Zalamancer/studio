
// src/app/news/page.tsx
"use client"; 

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Newspaper, TrendingUp, Banknote, Landmark, Handshake, CalendarDaysIcon, Edit2, FileText, Send, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getNewsArticlesByUserId, getPublishedNewsArticles } from '@/services/newsService';
import type { ClientNewsArticle } from '@/types/news';
import { formatDistanceToNowStrict } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from "@/hooks/use-is-mobile"; 

interface NewsItem {
  id: string;
  title: string;
  category: string;
  date: string;
  source?: string;
  imageUrl?: string | null;
  aiHint: string;
  excerpt: string;
  link: string;
  status?: 'draft' | 'published';
  userId?: string;
  publishedAt?: number | null;
  updatedAt: number; // Added for sorting and display
}

const newsCategoriesConfig = [
  { id: 'user_drafts', title: 'Your Drafts', icon: FileText, dataKey: 'userDrafts' as const, showIfEmpty: true, requiresAuth: true },
  { id: 'user_published', title: 'Your Published Articles', icon: Send, dataKey: 'userPublished' as const, showIfEmpty: true, requiresAuth: true },
  { id: 'collaborative', title: 'Collaborative Ventures', icon: Handshake, dataKey: 'generalCollaborative' as const },
  { id: 'financial', title: 'Financial Insights', icon: Banknote, dataKey: 'generalFinancial' as const },
  { id: 'political', title: 'Political & Regulatory Landscape', icon: Landmark, dataKey: 'generalPolitical' as const },
  { id: 'opportunities', title: 'New Opportunities', icon: TrendingUp, dataKey: 'generalOpportunities' as const },
  { id: 'events', title: 'Upcoming Events', icon: CalendarDaysIcon, dataKey: 'generalEvents' as const },
];

function getCleanTextExcerpt(htmlString: string | null | undefined, maxLength: number = 120): string {
  if (typeof document === 'undefined' || !htmlString) return 'No content preview available.';
  
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;

    // Remove non-textual block elements specifically
    tempDiv.querySelectorAll('pre, figure, hr, img, iframe, div[data-embed-wrapper="true"]').forEach(el => el.remove());
    
    let textContent = tempDiv.textContent || tempDiv.innerText || "";
    textContent = textContent.replace(/\s\s+/g, ' ').trim(); // Consolidate multiple spaces and trim

    if (textContent.length === 0) return 'No text content found.';

    if (textContent.length <= maxLength) {
      return textContent;
    }
    
    let excerpt = textContent.substring(0, maxLength);
    // Try to cut at a sentence boundary if a period is found near the end
    const lastPeriod = excerpt.lastIndexOf('.');
    if (lastPeriod > Math.floor(maxLength * 0.7) && lastPeriod < excerpt.length -1) { // Ensure period is not the last char
      excerpt = excerpt.substring(0, lastPeriod + 1);
    } else {
      // Fallback to word boundary
      const lastSpace = excerpt.lastIndexOf(' ');
      if (lastSpace > Math.floor(maxLength * 0.6)) { 
         excerpt = excerpt.substring(0, lastSpace);
      }
      excerpt += "...";
    }
    return excerpt;
  } catch (e) {
    console.error("Error parsing HTML for excerpt:", e);
    return htmlString.substring(0, maxLength) + (htmlString.length > maxLength ? "..." : ""); // Basic fallback
  }
}


const NewsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile(); 
  const [localUserArticles, setLocalUserArticles] = useState<ClientNewsArticle[]>([]);

  const { data: userArticlesDataFromQuery, isLoading: isLoadingUserArticles, error: userArticlesError } = useQuery<ClientNewsArticle[]>({
    queryKey: ['userNewsArticles', user?.uid],
    queryFn: () => {
        return user ? getNewsArticlesByUserId(user.uid) : Promise.resolve([]);
    },
    enabled: !!user && !authLoading,
  });

  useEffect(() => {
    if (userArticlesDataFromQuery) {
      setLocalUserArticles(userArticlesDataFromQuery);
    }
  }, [userArticlesDataFromQuery]);


  const { data: generalPublishedArticles, isLoading: isLoadingGeneralArticles, error: generalArticlesError } = useQuery<ClientNewsArticle[]>({
     queryKey: ['publishedNewsArticles'],
     queryFn: () => getPublishedNewsArticles(15),
  });
  
  const transformToNewsItem = useCallback((article: ClientNewsArticle): NewsItem => ({
    id: article.id,
    title: article.title,
    category: article.category,
    date: article.status === 'published' && article.publishedAt 
        ? formatDistanceToNowStrict(new Date(article.publishedAt), { addSuffix: true }) 
        : formatDistanceToNowStrict(new Date(article.updatedAt), { addSuffix: true }), // Fallback to updatedAt for drafts
    excerpt: getCleanTextExcerpt(article.content, 120),
    imageUrl: article.coverImageUrl,
    aiHint: article.category.toLowerCase().replace(/\s+/g, '-').substring(0,15) || 'news item',
    link: `/news/article/${article.id}`,
    status: article.status,
    userId: article.userId,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
  }), []);

  const categorizedNews = useMemo(() => {
    const userDrafts: NewsItem[] = localUserArticles?.filter(a => a.status === 'draft').map(transformToNewsItem).sort((a, b) => b.updatedAt - a.updatedAt) || [];
    const userPublished: NewsItem[] = localUserArticles?.filter(a => a.status === 'published').map(transformToNewsItem).sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0)) || [];

    const generalFeed: { [key: string]: NewsItem[] } = {};
    if (generalPublishedArticles) {
        newsCategoriesConfig.forEach(catConfig => {
            if (catConfig.dataKey.startsWith('general')) {
                generalFeed[catConfig.dataKey] = generalPublishedArticles
                    .filter(article => article.category.toLowerCase().includes(catConfig.title.toLowerCase().split(' ')[0]))
                    .map(transformToNewsItem);
            }
        });
    }
    return {
      userDrafts,
      userPublished,
      ...generalFeed,
    };
  }, [localUserArticles, generalPublishedArticles, transformToNewsItem]); 

  const isLoading = authLoading || (user && isLoadingUserArticles) || isLoadingGeneralArticles;

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-[calc(100vh-8rem)]">
      <header className="mb-10 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center justify-center">
          <Newspaper className="mr-3 h-8 w-8 text-primary" />
          Latest News & Updates
        </h1>
        <p className="text-lg text-muted-foreground mt-1 max-w-2xl mx-auto">
          Stay informed about AnonyCollab, industry insights, financial trends, and new opportunities.
        </p>
         {user && (
          <Button asChild className="mt-4">
            <Link href="/news/create"><Edit2 className="mr-2 h-4 w-4" /> Create News Article</Link>
          </Button>
        )}
      </header>

      {(isLoadingUserArticles && user && !localUserArticles.length) && ( 
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-2 text-sm text-muted-foreground">Loading your articles...</p>
        </div>
      )}
      {userArticlesError && user && (
         <div className="text-destructive flex flex-col items-center gap-2 text-sm p-6 bg-destructive/5 rounded-md justify-center border border-destructive/20 mb-6">
           <AlertTriangle className="h-8 w-8 flex-shrink-0" />
           <p className="font-semibold">Error Loading Your Articles</p>
           <p>{userArticlesError.message || "An unexpected error occurred."}</p>
         </div>
      )}


      <div className="space-y-12">
        {newsCategoriesConfig.map((categoryConfig) => {
          if (categoryConfig.requiresAuth && !user) return null;
          
          const items = categorizedNews[categoryConfig.dataKey] || [];
          const isLoadingThisSection = 
            (categoryConfig.dataKey.startsWith('user') && user && isLoadingUserArticles && !localUserArticles.length) ||
            (categoryConfig.dataKey.startsWith('general') && isLoadingGeneralArticles && !generalPublishedArticles);
          const sectionHasError = 
            (categoryConfig.dataKey.startsWith('user') && user && !!userArticlesError) ||
            (categoryConfig.dataKey.startsWith('general') && !!generalArticlesError);


          if (items.length === 0 && !categoryConfig.showIfEmpty && !isLoadingThisSection && !sectionHasError) return null;

          return (
            <section key={categoryConfig.id} aria-labelledby={`category-title-${categoryConfig.id}`}>
              <div className="flex items-center mb-4">
                <categoryConfig.icon className="h-6 w-6 text-primary mr-2" />
                <h2 id={`category-title-${categoryConfig.id}`} className="text-2xl font-semibold text-foreground">
                  {categoryConfig.title}
                </h2>
              </div>
              {isLoadingThisSection && items.length === 0 ? (
                  <div className="flex justify-center items-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary"/> <span className="ml-2 text-muted-foreground text-sm">Loading...</span></div>
              ) : sectionHasError && items.length === 0 ? (
                  <p className="text-sm text-destructive text-center py-4">Could not load articles for this section.</p>
              ) : items.length > 0 ? (
                <Carousel
                  opts={{ align: "start", loop: items.length > (isMobile ? 1 : (items.length > 2 ? 3: items.length)) }}
                  className="w-full"
                >
                  <CarouselContent className="-ml-4">
                    {items.map((item) => (
                      <CarouselItem key={item.id} className="pl-4 basis-full md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                        <Card className="h-full flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow rounded-lg border-border">
                          <CardHeader className="p-0">
                            {item.imageUrl ? (
                              <Link href={item.link} className="block aspect-[16/9] relative w-full">
                                <Image
                                  src={item.imageUrl} alt={item.title} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  className="object-cover" data-ai-hint={item.aiHint}
                                />
                              </Link>
                            ) : (
                               <Link href={item.link} className="block aspect-[16/9] relative w-full bg-muted flex items-center justify-center">
                                <Newspaper className="h-12 w-12 text-muted-foreground/50" />
                               </Link>
                            )}
                          </CardHeader>
                          <CardContent className="p-4 flex-grow flex flex-col">
                            <CardTitle className="text-md font-semibold leading-snug mb-1 line-clamp-2">
                              <Link href={item.link} className="hover:text-primary transition-colors">
                                {item.title}
                              </Link>
                            </CardTitle>
                             {item.status && (
                              <Badge variant={item.status === 'draft' ? 'outline' : 'secondary'} className="text-xs mb-1 self-start cursor-default border-dashed">
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                              </Badge>
                            )}
                            <CardDescription className="text-xs text-muted-foreground mb-2 line-clamp-3 flex-grow">
                              {item.excerpt}
                            </CardDescription>
                            <div className="text-xs text-muted-foreground/80 mt-auto pt-2">
                              {item.source && <span>{item.source} &bull; </span>}
                              <span>{item.date}</span>
                            </div>
                          </CardContent>
                          <CardFooter className="p-3 border-t">
                             <Button variant="outline" size="xs" asChild className="w-full text-xs h-8">
                              <Link href={item.link}>{item.status === 'draft' ? "Edit Draft" : "Read More"}</Link>
                            </Button>
                          </CardFooter>
                        </Card>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {items.length > (isMobile ? 1 : (items.length > 2 ? 3 : items.length)) && (<> <CarouselPrevious className="absolute left-[-10px] top-1/2 -translate-y-1/2 z-10 hidden md:flex" /> <CarouselNext className="absolute right-[-10px] top-1/2 -translate-y-1/2 z-10 hidden md:flex" /> </>)}
                </Carousel>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {categoryConfig.dataKey.startsWith('user') && user ? `You have no ${categoryConfig.title.toLowerCase().replace('your ','')}.` : `No news items in this category yet.`}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default NewsPage;
    
