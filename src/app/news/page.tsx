// src/app/news/page.tsx
"use client";

import React, { useMemo } from 'react'; // Removed useState as mock data is now primarily for general feed
import { Newspaper, TrendingUp, Banknote, Landmark, Handshake, CalendarDaysIcon, Edit2, FileText, Send } from 'lucide-react'; // Added Edit2, FileText, Send
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
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useQuery } from '@tanstack/react-query'; // Import useQuery
import { getNewsArticlesByUserId, getPublishedNewsArticles } from '@/services/newsService'; // Import news service
import type { ClientNewsArticle } from '@/types/news'; // Import types
import { Loader2 } from 'lucide-react'; // For loading state
import { formatDistanceToNowStrict } from 'date-fns'; // For relative dates

interface NewsItem { // This is now effectively a ClientNewsArticle with additional UI-specific fields if needed
  id: string;
  title: string;
  category: string; // Can be derived or kept for filtering if general feed uses it
  date: string; // Formatted date string
  source?: string; // Optional source for general news
  imageUrl?: string | null;
  aiHint: string;
  excerpt: string;
  link: string; // Link to view the full article (could be internal or external)
  status?: 'draft' | 'published'; // For user's articles
  userId?: string; // For user's articles
  publishedAt?: number | null; // Milliseconds
}

// General mock news data - can be replaced by getPublishedNewsArticles later
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

  const { data: userArticles, isLoading: isLoadingUserArticles } = useQuery<ClientNewsArticle[]>({
    queryKey: ['userNewsArticles', user?.uid],
    queryFn: () => user ? getNewsArticlesByUserId(user.uid) : Promise.resolve([]),
    enabled: !!user,
  });

  // Placeholder for general published articles - can be activated later
  const { data: generalPublishedArticles, isLoading: isLoadingGeneralArticles } = useQuery<ClientNewsArticle[]>({
     queryKey: ['publishedNewsArticles'],
     queryFn: () => getPublishedNewsArticles(15), // Fetch more for categories
     // enabled: true, // Enable when ready to switch from mock
  });
  
  const transformToNewsItem = (article: ClientNewsArticle): NewsItem => ({
    id: article.id,
    title: article.title,
    category: article.category, // Keep original category
    date: article.publishedAt ? formatDistanceToNowStrict(new Date(article.publishedAt), { addSuffix: true }) : formatDistanceToNowStrict(new Date(article.updatedAt), { addSuffix: true }),
    excerpt: article.content.substring(0, 100).replace(/<[^>]+>/g, '') + '...', // Basic excerpt
    imageUrl: article.coverImageUrl,
    aiHint: article.category.toLowerCase().replace(/\s+/g, '-').substring(0,15) || 'news item', // Basic AI hint from category
    link: `/news/article/${article.id}`, // Assuming a dynamic route for articles
    status: article.status,
    userId: article.userId,
    publishedAt: article.publishedAt,
  });

  const categorizedNews = useMemo(() => {
    const userDrafts: NewsItem[] = userArticles?.filter(a => a.status === 'draft').map(transformToNewsItem) || [];
    const userPublished: NewsItem[] = userArticles?.filter(a => a.status === 'published').map(transformToNewsItem) || [];

    // Map general mock data for now
    const generalFeed: { [key: string]: NewsItem[] } = {};
    newsCategoriesConfig.forEach(catConfig => {
      if (catConfig.dataKey.startsWith('general')) {
        generalFeed[catConfig.dataKey] = generalMockNewsData
          .filter(item => item.category.toLowerCase().includes(catConfig.title.toLowerCase().split(' ')[0])) // Simple match
          .map((item, index) => ({
            ...item,
            id: `${catConfig.id}-${index}`,
            date: item.category === 'Events' ? 'Various Dates' : new Date(Date.now() - index * 24 * 60 * 60 * 1000 * (Math.random()*5 + 1)).toLocaleDateString(), // Mock date
            link: '#',
            publishedAt: Date.now() - index * 24 * 60 * 60 * 1000 * (Math.random()*5 + 1),
          }));
      }
    });
    
    // If using fetched general articles:
    /*
    const generalFeedFromFetch: { [key: string]: NewsItem[] } = {};
    if (generalPublishedArticles) {
        generalPublishedArticles.forEach(article => {
            const categoryKey = `general${article.category.replace(/\s+/g, '')}` as const;
            if (!generalFeedFromFetch[categoryKey]) generalFeedFromFetch[categoryKey] = [];
            generalFeedFromFetch[categoryKey].push(transformToNewsItem(article));
        });
    }
    */

    return {
      userDrafts,
      userPublished,
      ...generalFeed, // Spread mock general feed for now
      // ...generalFeedFromFetch, // Or spread fetched general feed when ready
    };
  }, [userArticles, generalPublishedArticles]); // Add generalPublishedArticles if using fetched data

  const isLoading = authLoading || isLoadingUserArticles || isLoadingGeneralArticles; // Add isLoadingGeneralArticles if used

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

      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (
        <div className="space-y-12">
          {newsCategoriesConfig.map((categoryConfig) => {
            const items = categorizedNews[categoryConfig.dataKey] || [];
            if (!user && categoryConfig.dataKey.startsWith('user')) return null; // Don't show user sections if not logged in
            if (items.length === 0 && !categoryConfig.showIfEmpty && !categoryConfig.dataKey.startsWith('user')) return null;

            return (
              <section key={categoryConfig.id} aria-labelledby={`category-title-${categoryConfig.id}`}>
                <div className="flex items-center mb-4">
                  <categoryConfig.icon className="h-6 w-6 text-primary mr-2" />
                  <h2 id={`category-title-${categoryConfig.id}`} className="text-2xl font-semibold text-foreground">
                    {categoryConfig.title}
                  </h2>
                </div>
                {items.length > 0 ? (
                  <Carousel
                    opts={{ align: "start", loop: items.length > 3 }}
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
                    {items.length > 1 && (<> <CarouselPrevious className="absolute left-[-10px] top-1/2 -translate-y-1/2 z-10 hidden md:flex" /> <CarouselNext className="absolute right-[-10px] top-1/2 -translate-y-1/2 z-10 hidden md:flex" /> </>)}
                  </Carousel>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {categoryConfig.dataKey.startsWith('user') ? `You have no ${categoryConfig.title.toLowerCase().replace('your ','')}.` : `No news items in this category yet.`}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NewsPage;
