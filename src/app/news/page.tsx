// src/app/news/page.tsx
"use client";

import React from 'react';
import { Newspaper, TrendingUp, Banknote, Landmark, Handshake, CalendarDaysIcon } from 'lucide-react';
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

interface NewsItem {
  id: string;
  title: string;
  category: string;
  date: string;
  source: string;
  imageUrl: string;
  imageHint: string;
  excerpt: string;
  link: string;
}

interface NewsCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  items: NewsItem[];
}

const mockNewsData: NewsCategory[] = [
  {
    id: 'collaborative',
    title: 'Collaborative Ventures',
    icon: Handshake,
    items: [
      { id: 'c1', title: 'AnonyCollab Platform Sees Record Sign-ups in Q3', category: 'collaborative', date: 'Oct 26, 2023', source: 'Platform Weekly', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'teamwork charts', excerpt: 'New features and strong community engagement drive growth.', link: '#' },
      { id: 'c2', title: 'Cross-Industry Partnerships Flourishing on AnonyCollab', category: 'collaborative', date: 'Oct 20, 2023', source: 'Collaboration Today', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'connected world', excerpt: 'Businesses are finding innovative ways to connect and co-create.', link: '#' },
      { id: 'c3', title: 'The Future of Anonymous B2B Networking', category: 'collaborative', date: 'Oct 15, 2023', source: 'Tech Innovators Mag', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'futuristic network', excerpt: 'Exploring how platforms like AnonyCollab are changing the landscape.', link: '#' },
      { id: 'c4', title: 'Guide: Maximizing Your Collaboration Plan Success', category: 'collaborative', date: 'Oct 10, 2023', source: 'AnonyCollab Blog', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'strategy board', excerpt: 'Tips and tricks for leveraging the new planning tools effectively.', link: '#' },
    ],
  },
  {
    id: 'financial',
    title: 'Financial Insights',
    icon: Banknote,
    items: [
      { id: 'f1', title: 'Market Trends: Q4 Investment Outlook', category: 'financial', date: 'Oct 25, 2023', source: 'Finance Globe', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'stock market', excerpt: 'Analysts predict cautious optimism in key sectors.', link: '#' },
      { id: 'f2', title: 'Navigating Startup Funding in a Bear Market', category: 'financial', date: 'Oct 18, 2023', source: 'VC Insights', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'investment money', excerpt: 'Strategies for securing capital in challenging economic times.', link: '#' },
      { id: 'f3', title: 'The Rise of Decentralized Finance (DeFi) in B2B', category: 'financial', date: 'Oct 12, 2023', source: 'Crypto Business', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'digital currency', excerpt: 'How DeFi solutions are impacting business transactions and investments.', link: '#' },
    ],
  },
  {
    id: 'political',
    title: 'Political & Regulatory Landscape',
    icon: Landmark,
    items: [
      { id: 'p1', title: 'New Data Privacy Laws: What Businesses Need to Know', category: 'political', date: 'Oct 23, 2023', source: 'Legal Business Review', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'government law', excerpt: 'Understanding compliance for upcoming GDPR-like regulations.', link: '#' },
      { id: 'p2', title: 'Impact of Trade Agreements on Small Businesses', category: 'political', date: 'Oct 16, 2023', source: 'Global Policy Watch', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'international trade', excerpt: 'Analyzing the opportunities and challenges for SMEs.', link: '#' },
    ],
  },
  {
    id: 'opportunities',
    title: 'New Opportunities',
    icon: TrendingUp,
    items: [
      { id: 'o1', title: 'Emerging Tech Hubs for 2024', category: 'opportunities', date: 'Oct 27, 2023', source: 'Startup Ecosystems', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'city skyline', excerpt: 'Discover the next wave of innovation centers worldwide.', link: '#' },
      { id: 'o2', title: 'Grant Opportunities for Green Tech Startups', category: 'opportunities', date: 'Oct 19, 2023', source: 'Eco Grants Org', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'renewable energy', excerpt: 'Funding avenues for businesses focused on sustainability.', link: '#' },
      { id: 'o3', title: 'Call for Speakers: Global Innovation Summit', category: 'opportunities', date: 'Oct 11, 2023', source: 'EventCoord', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'conference stage', excerpt: 'Share your expertise at one of the year\'s biggest tech events.', link: '#' },
    ],
  },
  {
    id: 'events',
    title: 'Upcoming Events',
    icon: CalendarDaysIcon,
    items: [
      { id: 'e1', title: 'Webinar: AI in B2B Marketing - Nov 15', category: 'events', date: 'Nov 15, 2023', source: 'Marketing Masters', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'webinar screen', excerpt: 'Learn how to leverage AI for your marketing strategies.', link: '#' },
      { id: 'e2', title: 'AnonyCollab Community Meetup - Dec 5', category: 'events', date: 'Dec 05, 2023', source: 'AnonyCollab Events', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'community event', excerpt: 'Connect with fellow platform users and share insights.', link: '#' },
      { id: 'e3', title: 'TechCrunch Disrupt 2024 - Call for Startups', category: 'events', date: 'Application Deadline: Jan 31, 2024', source: 'TechCrunch', imageUrl: 'https://placehold.co/600x400.png', imageHint: 'startup pitch', excerpt: 'Showcase your startup to investors and industry leaders.', link: '#' },
    ],
  }
];

const NewsPage = () => {
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
      </header>

      <div className="space-y-12">
        {mockNewsData.map((category) => (
          <section key={category.id} aria-labelledby={`category-title-${category.id}`}>
            <div className="flex items-center mb-4">
              <category.icon className="h-6 w-6 text-primary mr-2" />
              <h2 id={`category-title-${category.id}`} className="text-2xl font-semibold text-foreground">
                {category.title}
              </h2>
            </div>
            {category.items.length > 0 ? (
              <Carousel
                opts={{
                  align: "start",
                  loop: category.items.length > 3, // Loop only if more items than typically visible
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-4">
                  {category.items.map((item) => (
                    <CarouselItem key={item.id} className="pl-4 basis-full md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                      <Card className="h-full flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow rounded-lg border-border">
                        <CardHeader className="p-0">
                          <div className="aspect-[16/9] relative w-full">
                            <Image
                              src={item.imageUrl}
                              alt={item.title}
                              fill
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              className="object-cover"
                              data-ai-hint={item.imageHint}
                            />
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 flex-grow flex flex-col">
                          <CardTitle className="text-md font-semibold leading-snug mb-1 line-clamp-2">
                            <Link href={item.link} className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                              {item.title}
                            </Link>
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground mb-2 line-clamp-3 flex-grow">
                            {item.excerpt}
                          </CardDescription>
                          <div className="text-xs text-muted-foreground/80 mt-auto pt-2">
                            <span>{item.source}</span> &bull; <span>{item.date}</span>
                          </div>
                        </CardContent>
                        <CardFooter className="p-3 border-t">
                           <Button variant="outline" size="xs" asChild className="w-full text-xs h-8">
                            <Link href={item.link} target="_blank" rel="noopener noreferrer">Read More</Link>
                          </Button>
                        </CardFooter>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {category.items.length > 1 && ( // Show nav buttons only if more than one item
                  <>
                    <CarouselPrevious className="absolute left-[-10px] top-1/2 -translate-y-1/2 z-10 hidden md:flex" />
                    <CarouselNext className="absolute right-[-10px] top-1/2 -translate-y-1/2 z-10 hidden md:flex" />
                  </>
                )}
              </Carousel>
            ) : (
              <p className="text-sm text-muted-foreground">No news items in this category yet.</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default NewsPage;
