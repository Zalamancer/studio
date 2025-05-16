
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
import { LayoutGrid, Scale, Package, Megaphone, Users, Cpu, Landmark, Stethoscope, Briefcase, Star, Factory, Hammer, Tractor, Trees, Wrench, ShoppingCart, Plane, Building2, Code, DollarSign, HomeIcon, Palette, Film, Utensils, UserCog, ShieldQuestion, Info } from 'lucide-react'; // Added Star, Info icons

const sectors = [
  { code: "11", title: "Agriculture, Forestry, Fishing and Hunting", hint: "farming crops", description: "Activities related to growing crops, raising animals, harvesting timber, and fishing.", icon: Trees },
  { code: "21", title: "Mining, Quarrying, and Oil and Gas Extraction", hint: "mining equipment", description: "Extraction of naturally occurring mineral solids, such as coal and ores; liquid minerals, such as crude petroleum; and gases, such as natural gas.", icon: Hammer },
  { code: "22", title: "Utilities", hint: "power lines", description: "Generating, transmitting, and distributing electricity, gas, steam, water, and sewage removal.", icon: Wrench },
  { code: "23", title: "Construction", hint: "construction site", description: "Building, repairing, and renovating buildings and engineering projects (e.g., highways and utility systems).", icon: Building2 },
  { code: "31-33", title: "Manufacturing", hint: "factory assembly", description: "Mechanical, physical, or chemical transformation of materials, substances, or components into new products.", icon: Factory },
  { code: "42", title: "Wholesale Trade", hint: "warehouse pallets", description: "Selling or arranging for the purchase or sale of goods for resale, capital or durable nonconsumer goods, and raw and intermediate materials.", icon: Package },
  { code: "44-45", title: "Retail Trade", hint: "shopping mall", description: "Retailing merchandise, generally without transformation, and rendering services incidental to the sale of merchandise.", icon: ShoppingCart },
  { code: "48-49", title: "Transportation and Warehousing", hint: "trucks highway", description: "Providing transportation of passengers and cargo, warehousing and storing goods, and support activities.", icon: Plane },
  { code: "51", title: "Information", hint: "data center", description: "Producing and distributing information and cultural products, providing the means to transmit or distribute these products, and processing data.", icon: Code },
  { code: "52", title: "Finance and Insurance", hint: "stock market", description: "Financial transactions (e.g., raising funds by taking deposits, issuing securities) and/or facilitating financial transactions.", icon: DollarSign },
  { code: "53", title: "Real Estate and Rental and Leasing", hint: "modern house", description: "Renting, leasing, or otherwise allowing the use of tangible or intangible assets, and related services.", icon: HomeIcon },
  { code: "54", title: "Professional, Scientific, and Technical Services", hint: "scientist laboratory", description: "Performing professional, scientific, and technical activities for others, requiring a high degree of expertise and training.", icon: Briefcase },
  { code: "55", title: "Management of Companies and Enterprises", hint: "office boardroom", description: "Holding the securities of companies and enterprises for the purpose of owning a controlling interest or influencing management decisions.", icon: Users },
  { code: "56", title: "Administrative and Support and Waste Management and Remediation Services", hint: "office support", description: "Performing routine support activities for the day-to-day operations of other organizations, or waste management services.", icon: UserCog },
  { code: "61", title: "Educational Services", hint: "classroom students", description: "Providing instruction and training in a wide variety of subjects. These establishments may be privately owned or public institutions.", icon: Landmark },
  { code: "62", title: "Health Care and Social Assistance", hint: "doctor patient", description: "Providing health care and social assistance for individuals. Establishments in this sector deliver services by trained professionals.", icon: Stethoscope },
  { code: "71", title: "Arts, Entertainment, and Recreation", hint: "concert stage", description: "Operating facilities or providing services to meet varied cultural, entertainment, and recreational interests of their patrons.", icon: Film },
  { code: "72", title: "Accommodation and Food Services", hint: "restaurant chef", description: "Providing customers with lodging and/or preparing meals, snacks, and beverages for immediate consumption.", icon: Utensils },
  { code: "81", title: "Other Services (except Public Administration)", hint: "mechanic workshop", description: "Providing services not elsewhere classified, including repairs, religious activities, grantmaking, advocacy, and personal care.", icon: Palette },
  { code: "92", title: "Public Administration", hint: "government building", description: "Governmental activities of administration, legislation, and judicial and regulatory functions at the federal, state, or local levels.", icon: ShieldQuestion },
];

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
  const [activeFilter, setActiveFilter] = useState("All");
  // Placeholder for favorited sector codes. In a real app, this would come from user preferences/backend.
  const [favoriteSectorCodes, setFavoriteSectorCodes] = useState<string[]>([]);

  const favoriteSectors = useMemo(() => {
    return sectors.filter(sector => favoriteSectorCodes.includes(sector.code));
  }, [favoriteSectorCodes]);

  // Placeholder filtering logic for "All Sectors" - adjust if needed
  const filteredSectors = activeFilter === "All"
    ? sectors
    : sectors.filter(sector => sector.title.toLowerCase().includes(activeFilter.toLowerCase()) || sector.description.toLowerCase().includes(activeFilter.toLowerCase()));

  const handleSectorClick = (sectorCode: string) => {
    // Consistently navigate to the dynamic sector detail page
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

      {/* Filter Bar */}
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

      {/* Favorite Sectors Section */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center">
          <Star className="mr-2 h-5 w-5 text-yellow-500" /> Favorite Sectors
        </h2>
        {favoriteSectors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {favoriteSectors.map((sector) => (
              <Card key={sector.code + "-fav"} className="p-3.5 shadow-sm hover:shadow-md transition-shadow bg-card">
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
                        {sector.description || `Explore opportunities in the ${sector.title} sector.`}
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
          <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-lg bg-muted/30">
            <Info className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">You haven't favorited any sectors yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click the star on a sector's detail page to add it here.</p>
          </div>
        )}
      </section>

      {/* All Sectors Section */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          {activeFilter === "All" ? "All Sectors" : `More in ${activeFilter}`}
        </h2>
        {filteredSectors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSectors.map((sector) => (
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
                        {sector.description || `Explore opportunities in the ${sector.title} sector.`}
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
    
