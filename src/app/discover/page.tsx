
// src/app/discover/page.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { LayoutGrid, Scale, Package, Megaphone, Users, Cpu, Landmark, Stethoscope, Briefcase, Star, Factory, Hammer, Tractor, Trees, Wrench, ShoppingCart, Plane, Building2, Code, DollarSign, HomeIcon, Palette, Film, Utensils, UserCog, ShieldQuestion, Info, Loader2, Newspaper, TrendingUp, Brush } from 'lucide-react'; // Added Brush for Miro
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getUserFavoriteSectors } from '@/services/userPreferenceService';
import { detailedSectorsData as allSectorsData } from '@/components/layout/MainLayout';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const filterCategories = [
  { name: "All", icon: LayoutGrid },
  { name: "Legal", icon: Scale },
  { name: "Product", icon: Package },
  { name: "Collaboration", icon: Users },
  { name: "Marketing", icon: Megaphone },
  { name: "Technology", icon: Cpu },
  { name: "Finance", icon: Landmark },
  { name: "Healthcare", icon: Stethoscope },
];

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
  const router = useRouter();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("All");

  const { data: favoriteSectorCodes = [], isLoading: isLoadingFavorites } = useQuery<string[]>({
    queryKey: ['userFavoriteSectorsOnDiscoverPage', user?.uid],
    queryFn: () => user ? getUserFavoriteSectors(user.uid) : Promise.resolve([]),
    enabled: !!user,
  });

  const favoriteSectors = useMemo(() => {
    return allSectorsData.filter(sector => favoriteSectorCodes.includes(sector.code));
  }, [favoriteSectorCodes]);

  const displaySectors = useMemo(() => {
    return allSectorsData.map(sector => ({
      code: sector.code,
      title: sector.name,
      hint: sector.subSectors?.[0]?.industries?.[0]?.name.toLowerCase().replace(/\s+/g, ' ') || sector.name.toLowerCase().replace(/\s+/g, ' ') || "industry",
      description: sector.description || `Explore opportunities in the ${sector.name} sector.`,
      icon: Factory,
    }));
  }, []);

  const filteredDisplaySectors = activeFilter === "All"
    ? displaySectors
    : displaySectors.filter(sector => sector.title.toLowerCase().includes(activeFilter.toLowerCase()) || sector.description.toLowerCase().includes(activeFilter.toLowerCase()));

  const handleSectorClick = (sectorCode: string) => {
    const path = `/discover/${sectorCode}`;
    router.push(path);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Explore Sectors
        </h1>
        <p className="text-lg text-muted-foreground mt-1">
          Dive into various industries to find collaboration opportunities and insights.
        </p>
         <Button 
            variant="outline" 
            className="mt-4" 
            onClick={() => window.open('https://miro.com/app/dashboard/', '_blank')}
          >
            <Brush className="mr-2 h-4 w-4" /> Create on Miro Board
          </Button>
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

      <div className="mb-8">
        <ScrollArea className="w-full whitespace-nowrap rounded-md">
          <div className="flex space-x-2 pb-2">
            {filterCategories.map((category) => (
              <Button
                key={category.name}
                variant={activeFilter === category.name ? "default" : "outline"}
                className={cn(
                  "h-9 rounded-md px-3 text-sm",
                  activeFilter === category.name && "bg-primary text-primary-foreground"
                )}
                onClick={() => setActiveFilter(category.name)}
              >
                <category.icon className="mr-2 h-4 w-4" />
                {category.name}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center">
          <Star className="mr-2 h-5 w-5 text-yellow-500" /> Favorite Sectors
        </h2>
        {isLoadingFavorites && user && (
            <div className="flex items-center justify-center p-6 border border-dashed rounded-lg bg-muted/30">
                <Loader2 className="h-8 w-8 text-primary animate-spin mr-3" />
                <p className="text-muted-foreground text-sm">Loading favorites...</p>
            </div>
        )}
        {!isLoadingFavorites && user && favoriteSectors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {favoriteSectors.map((sector) => (
              <Card key={sector.code + "-fav"} className="p-3.5 shadow-sm hover:shadow-md transition-shadow bg-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-grow min-w-0">
                    <Image
                      src={`https://placehold.co/48x48.png`}
                      alt={sector.name}
                      width={40}
                      height={40}
                      className="rounded-md object-cover mt-0.5 flex-shrink-0"
                      data-ai-hint={allSectorsData.find(s => s.code === sector.code)?.subSectors?.[0]?.industries?.[0]?.name.toLowerCase().replace(/\s+/g, ' ') || sector.name.toLowerCase().replace(/\s+/g, ' ') || "industry"}
                    />
                    <div className="flex-grow overflow-hidden">
                      <h3 className="font-semibold text-base text-foreground truncate">{sector.name}</h3>
                      <p className="text-xs text-muted-foreground">NAICS: {sector.code}</p>
                       <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {sector.description || `Explore opportunities in the ${sector.name} sector.`}
                       </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-accent hover:bg-accent/90 text-accent-foreground flex-shrink-0 self-center px-4 py-2"
                    onClick={() => handleSectorClick(sector.code)}
                    aria-label={`Explore ${sector.name}`}
                  >
                    Explore
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
        {!isLoadingFavorites && (!user || favoriteSectors.length === 0) && (
          <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-lg bg-muted/30">
            <Info className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">{user ? "You haven't favorited any sectors yet." : "Log in to see your favorite sectors."}</p>
            <p className="text-xs text-muted-foreground mt-1">{user ? "Click the star on a sector's detail page to add it here." : ""}</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          {activeFilter === "All" ? "All Sectors" : `More in ${activeFilter}`}
        </h2>
        {filteredDisplaySectors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredDisplaySectors.map((sector) => (
             <Card key={sector.code + "-all"} className="p-3.5 shadow-sm hover:shadow-md transition-shadow bg-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-grow min-w-0">
                    <Image
                       src={`https://placehold.co/48x48.png`}
                       alt={sector.title}
                       width={40}
                       height={40}
                       className="rounded-md object-cover mt-0.5 flex-shrink-0"
                       data-ai-hint={sector.hint}
                    />
                    <div className="flex-grow overflow-hidden">
                      <h3 className="font-semibold text-base text-foreground truncate">{sector.title}</h3>
                      <p className="text-xs text-muted-foreground">NAICS: {sector.code}</p>
                       <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {sector.description}
                       </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-accent hover:bg-accent/90 text-accent-foreground flex-shrink-0 self-center px-4 py-2"
                    onClick={() => handleSectorClick(sector.code)}
                    aria-label={`Explore ${sector.title}`}
                  >
                     Explore
                  </Button>
                </div>
             </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No sectors found matching your filter.</p>
        )}
      </section>
    </div>
  );
};

export default DiscoverPage;
