
// src/app/discover/page.tsx
"use client";

import React from 'react'; // Removed useState, useMemo
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'; // Removed CardDescription
import Image from 'next/image';
// Removed Link, useRouter as they are not directly used now after sector removal. Will re-evaluate if news items need them.
// Link IS used for news items. Router is not.
import Link from 'next/link';
// Removed Button as it was used for filters and sector cards. Will re-evaluate for news items.
// Button IS used by Carousel.
import { Button } from '@/components/ui/button';
// Removed ScrollArea, ScrollBar as sector filters are gone.
import { cn } from '@/lib/utils';
import { Newspaper, TrendingUp } from 'lucide-react'; // Removed many unused icons
// Removed useAuth, useQuery as favorite sectors are gone.
// Removed getUserFavoriteSectors, allSectorsData.
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// Filter categories are removed as they were for sectors
// const filterCategories = [ ... ];

const placeholderNewsItems = [
  {
    id: 'news-banner-1',
    title: "Tech Sector Sees Record Growth in Q3 driven by AI",
    summary: "Innovation in AI and cloud computing continues to drive significant expansion across the technology landscape, with startups and established players alike reporting strong results.",
    source: "Tech News Daily",
    date: "Oct 26, 2023",
    imageUrl: "https://placehold.co/800x400.png",
    aiHint: "technology abstract",
    link: "#",
    layoutType: 'banner',
  },
  {
    id: 'news-banner-2',
    title: "Retail Trends: The Shift to Hybrid Experiences",
    summary: "Retailers are blending online and offline strategies to meet evolving consumer demands for convenience and personalized shopping.",
    source: "Retail Insights",
    date: "Oct 25, 2023",
    imageUrl: "https://placehold.co/400x500.png",
    aiHint: "retail shopping",
    link: "#",
    layoutType: 'tall',
  },
  {
    id: 'news-banner-3',
    title: "Logistics Challenges in the Post-Pandemic Era",
    summary: "Supply chain resilience and last-mile delivery innovations are key focus areas for logistics companies globally.",
    source: "Supply Chain Mag",
    date: "Oct 24, 2023",
    imageUrl: "https://placehold.co/400x300.png",
    aiHint: "logistics cargo",
    link: "#",
    layoutType: 'standard',
  },
  {
    id: 'news-banner-4',
    title: "Healthcare Innovation: Telemedicine Adoption Surges",
    summary: "Telemedicine offers new avenues for patient care, remote consultations, and improved accessibility to medical expertise.",
    source: "Global Health Times",
    date: "Oct 23, 2023",
    imageUrl: "https://placehold.co/400x300.png",
    aiHint: "healthcare medicine",
    link: "#",
    layoutType: 'standard',
  },
];

const recentNewsItems = [
  {
    id: 'recent-news-1',
    title: "Sustainable Manufacturing Gains Traction",
    summary: "Companies are increasingly adopting eco-friendly practices, driven by consumer demand and regulatory changes.",
    source: "Eco Business News",
    date: "Nov 01, 2023",
    imageUrl: "https://placehold.co/500x300.png",
    aiHint: "sustainable factory",
    link: "#",
  },
  {
    id: 'recent-news-2',
    title: "The Future of Remote Work: A B2B Perspective",
    summary: "Exploring the tools and strategies businesses are using to thrive in a distributed work environment.",
    source: "Workplace Weekly",
    date: "Nov 03, 2023",
    imageUrl: "https://placehold.co/500x300.png",
    aiHint: "remote work",
    link: "#",
  },
  {
    id: 'recent-news-3',
    title: "Cybersecurity in B2B: New Threats and Defenses",
    summary: "As digital collaboration grows, so does the need for robust cybersecurity measures in B2B interactions.",
    source: "Security Today",
    date: "Nov 05, 2023",
    imageUrl: "https://placehold.co/500x300.png",
    aiHint: "cybersecurity abstract",
    link: "#",
  },
  {
    id: 'recent-news-4',
    title: "AI's Role in Optimizing Supply Chains",
    summary: "Leveraging artificial intelligence for predictive analytics and efficiency gains in global supply networks.",
    source: "Logistics AI Journal",
    date: "Nov 07, 2023",
    imageUrl: "https://placehold.co/500x300.png",
    aiHint: "supply chain",
    link: "#",
  },
];


const DiscoverPage = () => {
  // Removed state for activeFilter, favoriteSectorCodes, isLoadingFavorites
  // Removed memos for favoriteSectors, displaySectors, filteredDisplaySectors
  // Removed handleSectorClick function

  return (
    <div className="container mx-auto p-4 md:p-6 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Discover Insights
        </h1>
        <p className="text-lg text-muted-foreground mt-1">
          Stay updated with the latest industry news and trends.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center">
          <Newspaper className="mr-2 h-6 w-6 text-primary" /> Industry News & Insights
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-min">
          {placeholderNewsItems.map((news, index) => (
            <Card
              key={news.id}
              className={cn(
                "shadow-lg hover:shadow-xl transition-shadow flex flex-col",
                news.layoutType === 'banner' && index === 0 && "sm:col-span-2 md:col-span-2 lg:col-span-2",
                news.layoutType === 'tall' && index === 1 && "sm:row-span-2 md:row-span-1 lg:row-span-2",
                news.layoutType === 'banner' && index > 0 && "sm:col-span-2"
              )}
            >
              <a href={news.link} target="_blank" rel="noopener noreferrer" className="block flex flex-col flex-grow">
                <div className={cn(
                  "relative w-full overflow-hidden rounded-t-lg",
                  news.layoutType === 'banner' ? "aspect-[2/1] sm:aspect-[2.5/1]" :
                  news.layoutType === 'tall' ? "aspect-[3/4] sm:aspect-auto sm:flex-grow" :
                  "aspect-[4/3]"
                )}>
                  <Image
                    src={news.imageUrl}
                    alt={news.title}
                    fill
                    style={{objectFit:"cover"}}
                    data-ai-hint={news.aiHint}
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
                <CardHeader className="p-3 flex-grow">
                  <CardTitle className="text-sm md:text-base font-semibold line-clamp-2 leading-tight">{news.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-2">{news.summary}</p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground/80">
                    <span className="truncate pr-1">{news.source}</span>
                    <span>{news.date}</span>
                  </div>
                </CardContent>
              </a>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center">
          <TrendingUp className="mr-2 h-6 w-6 text-primary" /> Recent News Updates
        </h2>
        <Carousel
          opts={{
            align: "start",
            loop: recentNewsItems.length > 3,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {recentNewsItems.map((news) => (
              <CarouselItem key={news.id} className="pl-4 basis-full sm:basis-1/2 md:basis-1/3">
                <div className="p-1 h-full">
                  <Card className="shadow-md hover:shadow-lg transition-shadow h-full flex flex-col">
                    <a href={news.link} target="_blank" rel="noopener noreferrer" className="block flex flex-col flex-grow">
                      <div className="relative w-full aspect-[16/9] overflow-hidden rounded-t-lg">
                        <Image
                          src={news.imageUrl}
                          alt={news.title}
                          fill
                          style={{objectFit:"cover"}}
                          data-ai-hint={news.aiHint}
                          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 33vw"
                        />
                      </div>
                      <CardHeader className="p-3 flex-grow">
                        <CardTitle className="text-sm font-semibold line-clamp-2 leading-tight">{news.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-3 mb-2">{news.summary}</p>
                        <div className="flex justify-between items-center text-xs text-muted-foreground/80">
                          <span className="truncate pr-1">{news.source}</span>
                          <span>{news.date}</span>
                        </div>
                      </CardContent>
                    </a>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="absolute left-[-10px] sm:left-[-20px] top-1/2 -translate-y-1/2 z-10 disabled:opacity-30" />
          <CarouselNext className="absolute right-[-10px] sm:right-[-20px] top-1/2 -translate-y-1/2 z-10 disabled:opacity-30" />
        </Carousel>
      </section>

      {/* Filter categories ScrollArea removed */}
      {/* Favorite Sectors section removed */}
      {/* All Sectors section removed */}
    </div>
  );
};

export default DiscoverPage;
