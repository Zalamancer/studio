
// src/app/discover/page.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { LayoutGrid, Scale, Package, Megaphone, Users, Cpu, Landmark, Stethoscope, Briefcase, Star, Factory, Hammer, Tractor, Trees, Wrench, ShoppingCart, Plane, Building2, Code, DollarSign, HomeIcon, Palette, Film, Utensils, UserCog, ShieldQuestion, Info, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getUserFavoriteSectors } from '@/services/userPreferenceService';
import { detailedSectorsData as allSectorsData } from '@/components/layout/MainLayout'; // Use the detailed data source

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

const DiscoverPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("All");

  // Fetch user's favorite sectors
  const { data: favoriteSectorCodes = [], isLoading: isLoadingFavorites } = useQuery<string[]>({
    queryKey: ['userFavoriteSectorsOnDiscoverPage', user?.uid],
    queryFn: () => user ? getUserFavoriteSectors(user.uid) : Promise.resolve([]),
    enabled: !!user,
  });

  const favoriteSectors = useMemo(() => {
    return allSectorsData.filter(sector => favoriteSectorCodes.includes(sector.code));
  }, [favoriteSectorCodes]);

  // Simplified sectors for display on this page
  const displaySectors = useMemo(() => {
    return allSectorsData.map(sector => ({
      code: sector.code,
      title: sector.name,
      hint: sector.subSectors?.[0]?.industries?.[0]?.name.toLowerCase().replace(/\s+/g, ' ') || sector.name.toLowerCase().replace(/\s+/g, ' ') || "industry", // Use first industry of first subsector or sector name as hint
      description: sector.description || `Explore opportunities in the ${sector.name} sector.`,
      icon: Factory, // Placeholder - ideally map icons based on sector.code or title
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
      </header>

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
