
// src/app/news/page.tsx
"use client"; 

import React, { useMemo, useEffect, useState } from 'react'; // Added useState
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
import { useIsMobile } from "@/hooks/use-mobile"; 

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
}

// This generalMockNewsData is fine as a fallback if the generalPublishedArticles query fails or is loading
const generalMockNewsData: Omit<NewsItem, 'id' | 'date' | 'link' | 'publishedAt'>[] = [
  { title: 'Market Trends: Q4 Investment Outlook', category: 'Financial Insights', source: 'Finance Globe', imageUrl: 'https://placehold.co/600x400.png', aiHint: 'stock market', excerpt: 'Analysts predict cautious optimism in key sectors.' },
  { title: 'New Data Privacy Laws: What Businesses Need to Know', category: 'Political & Regulatory', source: 'Legal Business Review', imageUrl: 'https://placehold.co/600x400.png', aiHint: 'government law', excerpt: 'Understanding compliance for upcoming GDPR-like regulations.' },
  { title: 'Emerging Tech Hubs for 2024', category: 'New Opportunities', source: 'Startup Ecosystems', imageUrl: 'https://placehold.co/600x400.png', aiHint: 'city skyline', excerpt: 'Discover the next wave of innovation centers worldwide.' },
  { title: 'Webinar: AI in B2B Marketing - Nov 15', category: 'Events', source: 'Marketing Masters', imageUrl: 'https://placehold.co/600x400.png', aiHint: 'webinar screen', excerpt: 'Learn how to leverage AI for your marketing strategies.' },
];

const newsCategoriesConfig = [
  { id: 'user_drafts', title: 'Your Drafts', icon: FileText, dataKey: 'userDrafts' as const, showIfEmpty: true },
  { id: 'user_published', title: 'Your Published Articles', icon: Send, dataKey: 'userPublished' as const, showIfEmpty: true },
  { id: 'collaborative', title: 'Collaborative Ventures', icon: Handshake, dataKey: 'generalCollaborative' as const },
  { id: 'financial', title: 'Financial Insights', icon: Banknote, dataKey: 'generalFinancial' as const },
  { id: 'political', title: 'Political & Regulatory Landscape', icon: Landmark, dataKey: 'generalPolitical' as const },
  { id: 'opportunities', title: 'New Opportunities', icon: TrendingUp, dataKey: 'generalOpportunities' as const },
  { id: 'events', title: 'Upcoming Events', icon: CalendarDaysIcon, dataKey: 'generalEvents' as const },
];


const NewsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile(); 
  const [localUserArticles, setLocalUserArticles] = useState<ClientNewsArticle[]>([]);

  const { data: userArticlesDataFromQuery, isLoading: isLoadingUserArticles, error: userArticlesError } = useQuery<ClientNewsArticle[]>({
    queryKey: ['userNewsArticles', user?.uid],
    queryFn: () => {
        console.log(`%c[NewsPage] Fetching user articles for UID: ${user?.uid}`, "color: teal");
        return user ? getNewsArticlesByUserId(user.uid) : Promise.resolve([]);
    },
    enabled: !!user && !authLoading, // Ensure auth is not loading before enabling
  });

  // Update local state when query data changes
  useEffect(() => {
    if (userArticlesDataFromQuery) {
      setLocalUserArticles(userArticlesDataFromQuery);
      console.log(`%c[NewsPage] userArticlesDataFromQuery updated (count: ${userArticlesDataFromQuery.length}):`, "color: green;", userArticlesDataFromQuery.slice(0,2));
    }
  }, [userArticlesDataFromQuery]);


  const { data: generalPublishedArticles, isLoading: isLoadingGeneralArticles, error: generalArticlesError } = useQuery<ClientNewsArticle[]>({
     queryKey: ['publishedNewsArticles'],
     queryFn: () => getPublishedNewsArticles(15),
  });
  
  useEffect(() => {
    if (generalPublishedArticles) {
        console.log(`%c[NewsPage] Received generalPublishedArticles (count: ${generalPublishedArticles.length}). First two:`, "color: green;", generalPublishedArticles.slice(0,2));
    }
    if (generalArticlesError) {
        console.error(`%c[NewsPage] Error fetching generalPublishedArticles:`, "color: red;", generalArticlesError);
    }
  }, [generalPublishedArticles, generalArticlesError]);
  
  const transformToNewsItem = (article: ClientNewsArticle): NewsItem => ({
    id: article.id,
    title: article.title,
    category: article.category,
    date: article.publishedAt ? formatDistanceToNowStrict(new Date(article.publishedAt), { addSuffix: true }) : formatDistanceToNowStrict(new Date(article.updatedAt), { addSuffix: true }),
    excerpt: article.content.substring(0, 100).replace(/<[^>]+>/g, '') + '...',
    imageUrl: article.coverImageUrl,
    aiHint: article.category.toLowerCase().replace(/\s+/g, '-').substring(0,15) || 'news item',
    link: `/news/article/${article.id}`,
    status: article.status,
    userId: article.userId,
    publishedAt: article.publishedAt,
  });

  const categorizedNews = useMemo(() => {
    console.log(`%c[NewsPage] Memoizing categorizedNews. Input localUserArticles:`, "color: blue;", localUserArticles);
    const userDrafts: NewsItem[] = localUserArticles?.filter(a => a.status === 'draft').map(transformToNewsItem) || [];
    const userPublished: NewsItem[] = localUserArticles?.filter(a => a.status === 'published').map(transformToNewsItem) || [];
    console.log(`%c  [NewsPage] Client-side filtered: Drafts count: ${userDrafts.length}, Published by user count: ${userPublished.length}`, "color: blue;");

    const generalFeed: { [key: string]: NewsItem[] } = {};
    if (generalPublishedArticles) {
        newsCategoriesConfig.forEach(catConfig => {
            if (catConfig.dataKey.startsWith('general')) {
                generalFeed[catConfig.dataKey] = generalPublishedArticles
                    .filter(article => article.category.toLowerCase().includes(catConfig.title.toLowerCase().split(' ')[0]))
                    .map(transformToNewsItem);
            }
        });
    } else { // Fallback to mock data if generalPublishedArticles is not yet loaded or fails
        newsCategoriesConfig.forEach(catConfig => {
            if (catConfig.dataKey.startsWith('general')) {
                generalFeed[catConfig.dataKey] = generalMockNewsData
                .filter(item => item.category.toLowerCase().includes(catConfig.title.toLowerCase().split(' ')[0]))
                .map((item, index) => ({
                    ...item,
                    id: `${catConfig.id}-mock-${index}`,
                    date: item.category === 'Events' ? 'Various Dates' : new Date(Date.now() - index * 24 * 60 * 60 * 1000 * (Math.random()*5 + 1)).toLocaleDateString(),
                    link: '#', // Mock link
                    publishedAt: Date.now() - index * 24 * 60 * 60 * 1000 * (Math.random()*5 + 1),
                }));
            }
        });
    }
    
    console.log(`%c[NewsPage] Final categorizedNews structure:`, "color: blue;", { userDrafts, userPublished, ...generalFeed });

    return {
      userDrafts,
      userPublished,
      ...generalFeed,
    };
  }, [localUserArticles, generalPublishedArticles]); // Depend on localUserArticles

  const isLoading = authLoading || isLoadingUserArticles || isLoadingGeneralArticles;

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

      {(isLoadingUserArticles && !localUserArticles.length) && ( // Show loading if user articles are loading and local state is empty
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-2 text-sm text-muted-foreground">Loading your articles...</p>
        </div>
      )}
      {userArticlesError && (
         <div className="text-destructive flex flex-col items-center gap-2 text-sm p-6 bg-destructive/5 rounded-md justify-center border border-destructive/20 mb-6">
           <AlertTriangle className="h-8 w-8 flex-shrink-0" />
           <p className="font-semibold">Error Loading Your Articles</p>
           <p>{userArticlesError.message || "An unexpected error occurred."}</p>
         </div>
      )}


      <div className="space-y-12">
        {newsCategoriesConfig.map((categoryConfig) => {
          const items = categorizedNews[categoryConfig.dataKey] || [];
          
          if (!user && categoryConfig.dataKey.startsWith('user')) return null;
          
          const isLoadingThisSection = categoryConfig.dataKey.startsWith('user') ? (isLoadingUserArticles && !localUserArticles.length) : (isLoadingGeneralArticles && !generalPublishedArticles);
          const sectionHasError = categoryConfig.dataKey.startsWith('user') ? !!userArticlesError : !!generalArticlesError;


          if (items.length === 0 && !categoryConfig.showIfEmpty && !categoryConfig.dataKey.startsWith('user') && !isLoadingThisSection && !sectionHasError) return null;

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
                  opts={{ align: "start", loop: items.length > (isMobile ? 1 : 3) }}
                  className="w-full"
                >
                  <CarouselContent className="-ml-4">
                    {items.map((item) => (
                      <CarouselItem key={item.id} className="pl-4 basis-full md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                        <Card className="h-full flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow rounded-lg border-border">
                          <CardHeader className="p-0">
                            {item.imageUrl ? (
                              <div className="aspect-[16/9] relative w-full">
                                <Image
                                  src={item.imageUrl} alt={item.title} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  className="object-cover" data-ai-hint={item.aiHint}
                                />
                              </div>
                            ) : (
                              <div className="aspect-[16/9] relative w-full bg-muted flex items-center justify-center">
                                <Newspaper className="h-12 w-12 text-muted-foreground/50" />
                              </div>
                            )}
                          </CardHeader>
                          <CardContent className="p-4 flex-grow flex flex-col">
                            <CardTitle className="text-md font-semibold leading-snug mb-1 line-clamp-2">
                              <Link href={item.link} className="hover:text-primary transition-colors">
                                {item.title}
                              </Link>
                            </CardTitle>
                             {item.status && (
                              <Badge variant={item.status === 'draft' ? 'outline' : 'secondary'} className="text-xs mb-1 self-start">
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
                  {items.length > (isMobile ? 1 : 3) && (<> <CarouselPrevious className="absolute left-[-10px] top-1/2 -translate-y-1/2 z-10 hidden md:flex" /> <CarouselNext className="absolute right-[-10px] top-1/2 -translate-y-1/2 z-10 hidden md:flex" /> </>)}
                </Carousel>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {categoryConfig.dataKey.startsWith('user') ? `You have no ${categoryConfig.title.toLowerCase().replace('your ','')}.` : `No news items in this category yet.`}
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
    
