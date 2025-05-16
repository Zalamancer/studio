
// src/app/discover/[sectorCode]/page.tsx
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FilterX, Star, Tag, Briefcase, Building, Info } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Post } from '@/types/post';
import { Timestamp } from 'firebase/firestore';

// Hardcoded data for Manufacturing sector (NAICS 31-33)
const manufacturingSectorData = {
  code: "31-33",
  title: "Manufacturing",
  description: "The Manufacturing sector comprises establishments engaged in the mechanical, physical, or chemical transformation of materials, substances, or components into new products...",
  subSectors: [
    { code: "311", title: "Food Manufacturing", description: "Industries transform livestock and agricultural products into products for intermediate or final consumption.", industries: [
        { code: "3111", title: "Animal Food Manufacturing", description: "Manufacturing food and feed for animals." },
        { code: "3112", title: "Grain and Oilseed Milling", description: "Milling flour/meal, manufacturing malt, crushing oilseeds, etc." },
        { code: "3113", title: "Sugar and Confectionery Product Manufacturing", description: "Processing sugar, cacao, and making confectionery." },
        { code: "3114", title: "Fruit and Vegetable Preserving and Specialty Food Manufacturing", description: "Freezing, pickling, canning, dehydrating fruits/vegetables." },
        { code: "3115", title: "Dairy Product Manufacturing", description: "Manufacturing dairy products from milk and substitutes." },
        { code: "3116", title: "Animal Slaughtering and Processing", description: "Slaughtering animals and preparing processed meats." },
        { code: "3117", title: "Seafood Product Preparation and Packaging", description: "Canning, smoking, salting, drying, freezing seafood." },
        { code: "3118", title: "Bakeries and Tortilla Manufacturing", description: "Manufacturing bread, bakery products, pasta, tortillas." },
        { code: "3119", title: "Other Food Manufacturing", description: "Snack foods, coffee, tea, syrups, condiments, etc." },
    ]},
    { code: "312", title: "Beverage and Tobacco Product Manufacturing", description: "Manufacturing beverages and tobacco products.", industries: [
        { code: "3121", title: "Beverage Manufacturing", description: "Soft drinks, ice, water, brewery, winery, distillery products." },
        { code: "3122", title: "Tobacco Manufacturing", description: "Stemming, redrying, manufacturing cigarettes and tobacco products." },
    ]},
    { code: "313", title: "Textile Mills", description: "Transforming fibers into yarn or fabric.", industries: [
        { code: "3131", title: "Fiber, Yarn, and Thread Mills", description: "Spinning yarn, manufacturing thread, texturizing fibers." },
        { code: "3132", title: "Fabric Mills", description: "Weaving, braiding, knitting fabrics." },
        { code: "3133", title: "Textile and Fabric Finishing and Fabric Coating Mills", description: "Finishing, coating, laminating textiles." },
    ]},
    { code: "314", title: "Textile Product Mills", description: "Making textile products (except apparel) from purchased materials.", industries: [
        { code: "3141", title: "Textile Furnishings Mills", description: "Carpets, rugs, curtains, linens." },
        { code: "3149", title: "Other Textile Product Mills", description: "Bags, canvas, rope, twine, tire cord, embroidery, etc." },
    ]},
    { code: "315", title: "Apparel Manufacturing", description: "Manufacturing apparel by cutting and sewing fabric or knitting.", industries: [
        { code: "3151", title: "Apparel Knitting Mills", description: "Knitting apparel or knitting fabric and then manufacturing apparel." },
        { code: "3152", title: "Cut and Sew Apparel Manufacturing", description: "Manufacturing cut and sew apparel from woven or purchased knit fabric." },
        { code: "3159", title: "Apparel Accessories and Other Apparel Manufacturing", description: "Belts, caps, gloves, hats, neckties, etc." },
    ]},
    { code: "316", title: "Leather and Allied Product Manufacturing", description: "Tanning hides and fabricating leather or substitute products.", industries: [
        { code: "3161", title: "Leather and Hide Tanning and Finishing", description: "Tanning, currying, finishing hides; dyeing furs." },
        { code: "3162", title: "Footwear Manufacturing", description: "Manufacturing footwear (except orthopedic extension)." },
        { code: "3169", title: "Other Leather and Allied Product Manufacturing", description: "Luggage, handbags, wallets, belts (from purchased leather/substitutes)." },
    ]},
    { code: "321", title: "Wood Product Manufacturing", description: "Manufacturing lumber, plywood, veneers, containers, flooring, trusses, etc.", industries: [
        { code: "3211", title: "Sawmills and Wood Preservation", description: "Sawing lumber, treating wood." },
        { code: "3212", title: "Veneer, Plywood, and Engineered Wood Product Manufacturing", description: "Manufacturing veneer, plywood, engineered wood members." },
        { code: "3219", title: "Other Wood Product Manufacturing", description: "Millwork, containers, pallets, mobile homes, prefabricated buildings, etc." },
    ]},
     { code: "322", title: "Paper Manufacturing", description: "Making pulp, paper, or converted paper products.", industries: [
        { code: "3221", title: "Pulp, Paper, and Paperboard Mills", description: "Manufacturing pulp, paper, or paperboard." },
        { code: "3222", title: "Converted Paper Product Manufacturing", description: "Converting paper/paperboard into containers, bags, stationery, sanitary products, etc." },
    ]},
    { code: "323", title: "Printing and Related Support Activities", description: "Printing products and performing support activities like binding.", industries: [
        { code: "3231", title: "Printing and Related Support Activities", description: "Commercial printing, screen printing, book printing, prepress/postpress services." },
    ]},
    { code: "324", title: "Petroleum and Coal Products Manufacturing", description: "Transforming crude petroleum and coal into usable products.", industries: [
        { code: "3241", title: "Petroleum and Coal Products Manufacturing", description: "Refining petroleum, manufacturing asphalt, coke oven products, etc." },
    ]},
    { code: "325", title: "Chemical Manufacturing", description: "Transforming raw materials by chemical processes.", industries: [
        { code: "3251", title: "Basic Chemical Manufacturing", description: "Petrochemicals, industrial gases, dyes, pigments, inorganic/organic chemicals." },
        { code: "3252", title: "Resin, Synthetic Rubber, and Artificial Synthetic Fibers Manufacturing", description: "Manufacturing synthetic resins, rubber, fibers, filaments." },
        { code: "3253", title: "Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing", description: "Manufacturing fertilizers, pesticides, compost, agricultural chemicals." },
        { code: "3254", title: "Pharmaceutical and Medicine Manufacturing", description: "Manufacturing medicinal chemicals, pharmaceutical preparations, diagnostic substances." },
        { code: "3255", title: "Paint, Coating, and Adhesive Manufacturing", description: "Manufacturing paints, coatings, adhesives, glues, caulking." },
        { code: "3256", title: "Soap, Cleaning Compound, and Toilet Preparation Manufacturing", description: "Manufacturing soaps, detergents, polishes, cosmetics." },
        { code: "3259", title: "Other Chemical Product and Preparation Manufacturing", description: "Printing ink, explosives, photographic film, custom compounding, etc." },
    ]},
    { code: "326", title: "Plastics and Rubber Products Manufacturing", description: "Processing plastics materials and raw rubber.", industries: [
        { code: "3261", title: "Plastics Product Manufacturing", description: "Processing plastics resins into intermediate or final products." },
        { code: "3262", title: "Rubber Product Manufacturing", description: "Processing rubber into tires, hoses, belting, mechanical goods, etc." },
    ]},
    { code: "327", title: "Nonmetallic Mineral Product Manufacturing", description: "Transforming mined nonmetallic minerals.", industries: [
        { code: "3271", title: "Clay Product and Refractory Manufacturing", description: "Pottery, ceramics, plumbing fixtures, bricks, tiles, refractories." },
        { code: "3272", title: "Glass and Glass Product Manufacturing", description: "Manufacturing glass and glass products." },
        { code: "3273", title: "Cement and Concrete Product Manufacturing", description: "Cement, ready-mix concrete, concrete pipe, brick, block." },
        { code: "3274", title: "Lime and Gypsum Product Manufacturing", description: "Manufacturing lime and gypsum products." },
        { code: "3279", title: "Other Nonmetallic Mineral Product Manufacturing", description: "Abrasives, cut stone, mineral wool, insulation, etc." },
    ]},
    { code: "331", title: "Primary Metal Manufacturing", description: "Smelting and refining ferrous and nonferrous metals.", industries: [
        { code: "3311", title: "Iron and Steel Mills and Ferroalloy Manufacturing", description: "Manufacturing pig iron, steel, ferroalloys." },
        { code: "3312", title: "Steel Product Manufacturing from Purchased Steel", description: "Manufacturing pipe, tube, wire, shapes from purchased steel." },
        { code: "3313", title: "Alumina and Aluminum Production and Processing", description: "Refining alumina, producing/processing aluminum." },
        { code: "3314", title: "Nonferrous Metal (except Aluminum) Production and Processing", description: "Smelting, refining, rolling, drawing nonferrous metals (except aluminum)." },
        { code: "3315", title: "Foundries", description: "Pouring molten metal into molds to form castings." },
    ]},
    { code: "332", title: "Fabricated Metal Product Manufacturing", description: "Transforming metal into intermediate or end products.", industries: [
        { code: "3321", title: "Forging and Stamping", description: "Manufacturing forgings, stampings, custom roll forming, powder metallurgy parts." },
        { code: "3322", title: "Cutlery and Handtool Manufacturing", description: "Cookware, utensils, cutlery, flatware, saw blades, handtools." },
        { code: "3323", title: "Architectural and Structural Metals Manufacturing", description: "Prefabricated metal buildings, structural metal, plate work, windows, doors, sheet metal work." },
        { code: "3324", title: "Boiler, Tank, and Shipping Container Manufacturing", description: "Power boilers, heat exchangers, metal tanks, containers." },
        { code: "3325", title: "Hardware Manufacturing", description: "Manufacturing metal hardware (hinges, handles, keys, locks)." },
        { code: "3326", title: "Spring and Wire Product Manufacturing", description: "Manufacturing springs and fabricated wire products." },
        { code: "3327", title: "Machine Shops; Turned Product; and Screw, Nut, and Bolt Manufacturing", description: "Machine shops, precision turned products, fasteners." },
        { code: "3328", title: "Coating, Engraving, Heat Treating, and Allied Activities", description: "Heat treating, coating, engraving, plating metals." },
        { code: "3329", title: "Other Fabricated Metal Product Manufacturing", description: "Valves, bearings, ammunition, small arms, pipe fittings, safes, ladders, etc." },
    ]},
    { code: "333", title: "Machinery Manufacturing", description: "Creating end products that apply mechanical force.", industries: [
        { code: "3331", title: "Agriculture, Construction, and Mining Machinery Manufacturing", description: "Farm, construction, mining machinery." },
        { code: "3332", title: "Industrial Machinery Manufacturing", description: "Food, semiconductor, sawmill, paper, printing, textile machinery." },
        { code: "3333", title: "Commercial and Service Industry Machinery Manufacturing", description: "Optical instruments, photographic equipment, vending machines, office machinery." },
        { code: "3334", title: "Ventilation, Heating, Air-Conditioning, and Commercial Refrigeration Equipment Manufacturing", description: "HVAC and commercial refrigeration equipment." },
        { code: "3335", title: "Metalworking Machinery Manufacturing", description: "Machine tools, cutting tools, dies, jigs, fixtures, industrial molds." },
        { code: "3336", title: "Engine, Turbine, and Power Transmission Equipment Manufacturing", description: "Engines (except auto/aircraft), turbines, power transmission equipment." },
        { code: "3339", title: "Other General Purpose Machinery Manufacturing", description: "Pumps, compressors, material handling, packaging, welding equipment, etc." },
    ]},
    { code: "334", title: "Computer and Electronic Product Manufacturing", description: "Manufacturing computers, peripherals, communications equipment, components.", industries: [
        { code: "3341", title: "Computer and Peripheral Equipment Manufacturing", description: "Computers, storage devices, printers, monitors, terminals." },
        { code: "3342", title: "Communications Equipment Manufacturing", description: "Telephone apparatus, radio/TV broadcast, wireless equipment." },
        { code: "3343", title: "Audio and Video Equipment Manufacturing", description: "TVs, stereos, speakers, video cameras, jukeboxes." },
        { code: "3344", title: "Semiconductor and Other Electronic Component Manufacturing", description: "Semiconductors, capacitors, resistors, PCBs, connectors." },
        { code: "3345", title: "Navigational, Measuring, Electromedical, and Control Instruments Manufacturing", description: "Navigational, measuring, medical, control instruments." },
        { code: "3346", title: "Manufacturing and Reproducing Magnetic and Optical Media", description: "Blank tapes/disks, mass duplication." },
    ]},
    { code: "335", title: "Electrical Equipment, Appliance, and Component Manufacturing", description: "Manufacturing products that generate, distribute, and use electrical power.", industries: [
        { code: "3351", title: "Electric Lighting Equipment Manufacturing", description: "Lighting fixtures, bulbs, tubes, parts." },
        { code: "3352", title: "Household Appliance Manufacturing", description: "Small and major electrical appliances." },
        { code: "3353", title: "Electrical Equipment Manufacturing", description: "Transformers, motors, generators, switchgear, controls." },
        { code: "3359", title: "Other Electrical Equipment and Component Manufacturing", description: "Batteries, wire, cable, wiring devices, surge suppressors." },
    ]},
    { code: "336", title: "Transportation Equipment Manufacturing", description: "Producing equipment for transporting people and goods.", industries: [
        { code: "3361", title: "Motor Vehicle Manufacturing", description: "Automobiles, light/heavy duty trucks, chassis." },
        { code: "3362", title: "Motor Vehicle Body and Trailer Manufacturing", description: "Vehicle bodies, cabs, trailers, motor homes, campers." },
        { code: "3363", title: "Motor Vehicle Parts Manufacturing", description: "Engines, electrical, steering, suspension, brakes, transmission parts." },
        { code: "3364", title: "Aerospace Product and Parts Manufacturing", description: "Aircraft, missiles, space vehicles, engines, parts." },
        { code: "3365", title: "Railroad Rolling Stock Manufacturing", description: "Locomotives, rail cars, track maintenance equipment." },
        { code: "3366", title: "Ship and Boat Building", description: "Operating shipyards and boat yards." },
        { code: "3369", title: "Other Transportation Equipment Manufacturing", description: "Motorcycles, bicycles, military vehicles, tanks, snowmobiles, golf carts." },
    ]},
    { code: "337", title: "Furniture and Related Product Manufacturing", description: "Manufacturing furniture and related articles.", industries: [
        { code: "3371", title: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", description: "Household, institutional furniture, kitchen cabinets, countertops." },
        { code: "3372", title: "Office Furniture (including Fixtures) Manufacturing", description: "Office furniture, store fixtures, partitions, shelving, lockers." },
        { code: "3379", title: "Other Furniture Related Product Manufacturing", description: "Mattresses, blinds, shades." },
    ]},
    { code: "339", title: "Miscellaneous Manufacturing", description: "Manufacturing a wide range of products not classified elsewhere.", industries: [
        { code: "3391", title: "Medical Equipment and Supplies Manufacturing", description: "Surgical/medical instruments, appliances, dental/ophthalmic goods." },
        { code: "3399", title: "Other Miscellaneous Manufacturing", description: "Jewelry, sporting goods, toys, office supplies, signs, musical instruments, etc." },
    ]},
  ]
};

// Fallback data for sectors without detailed sub-sectors
const genericSectorData = (code: string, title: string) => ({
    code,
    title,
    description: `Information and posts related to the ${title} sector (NAICS ${code}). Detailed sub-sector data is being compiled.`,
    subSectors: [], // No detailed sub-sectors for generic view
});

// Mock Post Data (replace with actual data fetching)
const mockPosts: Post[] = [
  { id: 'post1', userId: 'userA', tags: ['Innovation'], question: 'Seeking partners for AI in food processing', description: 'Looking for tech companies specializing in AI for optimizing food manufacturing processes.', sector: 'Manufacturing', businessType: 'SME', safetyIndicator: 'High', ratingScore: 4, naicsCode: '3119', createdAt: Timestamp.now() },
  { id: 'post2', userId: 'userB', tags: ['Efficiency', 'Logistics'], question: 'Need help with textile supply chain', description: 'Our textile mill is facing challenges with supply chain visibility. Seeking solutions.', sector: 'Manufacturing', businessType: 'Large Enterprise', safetyIndicator: 'Medium', ratingScore: 5, naicsCode: '3131', createdAt: Timestamp.now() },
  { id: 'post3', userId: 'userC', tags: ['Sustainability'], question: 'Sustainable packaging for beverages?', description: 'Beverage manufacturer looking for eco-friendly packaging alternatives.', sector: 'Manufacturing', businessType: 'Startup', safetyIndicator: 'Medium', ratingScore: 3, naicsCode: '3121', createdAt: Timestamp.now() },
  { id: 'post4', userId: 'userD', tags: ['Robotics'], question: 'Automation in wood product manufacturing', description: 'Exploring robotic solutions for our wood products assembly line.', sector: 'Manufacturing', businessType: 'SME', safetyIndicator: 'High', ratingScore: 4.5, naicsCode: '3219', createdAt: Timestamp.now() },
  { id: 'post5', userId: 'userE', tags: ['New Materials'], question: 'Advanced chemical for plastics', description: 'Researching new chemical compounds for enhancing plastic durability.', sector: 'Manufacturing', businessType: 'Research Institute', safetyIndicator: 'Low', ratingScore: 4, naicsCode: '3252', createdAt: Timestamp.now() }, // Corrected naicsCode to be a sub-sector level
  // Add more generic posts for other sectors if needed for testing
  { id: 'post6', userId: 'userF', tags: ['Software'], question: 'Need a CRM for a small construction business', description: 'Looking for CRM recommendations suitable for construction project management.', sector: 'Construction', businessType: 'SME', safetyIndicator: 'High', ratingScore: 4, naicsCode: '23', createdAt: Timestamp.now() },
];


const SectorDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const sectorCode = params?.sectorCode as string | undefined;

  const [selectedSubSector, setSelectedSubSector] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);

  const sectorData = useMemo(() => {
    if (sectorCode === "31-33") {
      return manufacturingSectorData;
    }
    // Placeholder for fetching other sector data by code
    // For now, return a generic structure
    // In a real app, you'd fetch this from a service based on sectorCode
    const allSectorsList = [ // This should ideally come from a shared source or API
        { code: "11", title: "Agriculture, Forestry, Fishing and Hunting" },
        { code: "21", title: "Mining, Quarrying, and Oil and Gas Extraction" },
        { code: "22", title: "Utilities" },
        { code: "23", title: "Construction" },
        // ... add all other sectors
    ];
    const currentSectorInfo = allSectorsList.find(s => s.code === sectorCode);
    if (currentSectorInfo) {
        return genericSectorData(sectorCode, currentSectorInfo.title);
    }
    return null; // Sector not found or not implemented
  }, [sectorCode]);

  const handleSubSectorSelect = (subSectorCode: string | null) => {
    setSelectedSubSector(current => (current === subSectorCode ? null : subSectorCode));
    setSelectedIndustry(null);
  };

  const handleIndustrySelect = (industryCode: string | null) => {
    setSelectedIndustry(current => (current === industryCode ? null : industryCode));
  };

  const clearFilters = () => {
    setSelectedSubSector(null);
    setSelectedIndustry(null);
  };

  const filteredPosts = useMemo(() => {
    if (!sectorData) return [];

    let postsToFilter = mockPosts.filter(post => {
        // Filter by main sector if not manufacturing (where mock data is specific)
        if (sectorData.code !== "31-33") {
             // This assumes posts have a 'sector' field matching the sectorData.title or sectorData.code
            return post.sector === sectorData.title || (post.naicsCode && post.naicsCode.startsWith(sectorData.code.substring(0,2))); // Check if NAICS starts with 2-digit code
        }
        // For manufacturing, allow broader match if no sub-filters
        return post.sector === "Manufacturing";
    });

    if (selectedIndustry) {
      return postsToFilter.filter(post => post.naicsCode === selectedIndustry);
    }
    if (selectedSubSector) {
      const subSectorInfo = sectorData.subSectors.find(ss => ss.code === selectedSubSector);
      if (subSectorInfo) {
        const industryCodesInSubSector = subSectorInfo.industries.map(ind => ind.code);
        return postsToFilter.filter(post =>
          post.naicsCode === selectedSubSector ||
          (post.naicsCode && industryCodesInSubSector.includes(post.naicsCode))
        );
      }
    }
    return postsToFilter;
  }, [sectorData, selectedSubSector, selectedIndustry]);


  if (!sectorCode) {
    // This case should ideally be handled by Next.js routing (e.g., 404 if no sectorCode)
    // but adding a fallback for safety.
    return (
        <div className="container mx-auto p-8 text-center">
            <p className="text-xl text-muted-foreground">Loading sector information...</p>
            <p className="text-sm text-muted-foreground mt-2">If this persists, please go back and try again.</p>
            <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
        </div>
    );
  }

  if (!sectorData) {
    return (
      <div className="container mx-auto p-8">
        <Link href="/discover" className="inline-flex items-center text-primary hover:underline mb-6 text-sm">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Discover
        </Link>
        <Card className="shadow-lg border-border">
            <CardHeader>
                <CardTitle className="text-2xl text-destructive flex items-center gap-2">
                    <Info className="h-6 w-6" /> Sector Not Found
                </CardTitle>
            </CardHeader>
            <CardContent>
                 <p className="text-muted-foreground">
                    Sorry, we couldn't find details for NAICS sector code <strong className="text-foreground">{sectorCode}</strong>.
                 </p>
                 <p className="text-muted-foreground mt-2">
                    It's possible this sector is not yet detailed or the code is incorrect.
                 </p>
                 <Button onClick={() => router.push('/discover')} className="mt-6">
                    Return to Discover Page
                 </Button>
            </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Link href="/discover" className="inline-flex items-center text-primary hover:underline mb-4 text-sm">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Discover
        </Link>
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                {sectorData.title} ({sectorData.code})
                </h1>
                <p className="text-md text-muted-foreground max-w-3xl">{sectorData.description}</p>
            </div>
            <Button
                variant={isFavorited ? "default" : "outline"}
                size="sm"
                onClick={() => setIsFavorited(!isFavorited)}
                className="mt-2 ml-4 flex-shrink-0"
                aria-pressed={isFavorited}
            >
                <Star className={cn("h-4 w-4 mr-2", isFavorited && "fill-yellow-400 text-yellow-500")}/>
                {isFavorited ? "Favorited" : "Favorite Sector"}
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar: Filters */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Filter by Industry</CardTitle>
              <CardDescription>
                {sectorData.subSectors && sectorData.subSectors.length > 0
                  ? "Select sub-sectors and industries to narrow down posts."
                  : `No detailed industry filters available for ${sectorData.title}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
                {(selectedSubSector || selectedIndustry) && (
                    <Button onClick={clearFilters} variant="ghost" size="sm" className="mb-3 text-primary w-full justify-start">
                        <FilterX className="h-4 w-4 mr-2" /> Clear All Filters
                    </Button>
                )}
                {sectorData.subSectors && sectorData.subSectors.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full space-y-1.5">
                    {sectorData.subSectors.map((subsector) => (
                      <AccordionItem key={subsector.code} value={`subsector-${subsector.code}`}>
                        <AccordionTrigger
                          onClick={() => handleSubSectorSelect(subsector.code)}
                          className={cn(
                            "text-md font-medium hover:no-underline px-3 py-2.5 rounded-md border text-left",
                            selectedSubSector === subsector.code && !selectedIndustry ? "bg-primary/10 text-primary border-primary" : "bg-muted/30 hover:bg-muted/50"
                          )}
                        >
                          {subsector.code}: {subsector.title}
                        </AccordionTrigger>
                        <AccordionContent className="px-1 pt-2 pb-1 border-none">
                          {subsector.industries && subsector.industries.length > 0 && (
                            <Accordion type="single" collapsible className="w-full space-y-1 pl-3 border-l-2 ml-2">
                              {subsector.industries.map((industry) => (
                                <AccordionItem key={industry.code} value={`industry-${industry.code}`} className="border-b-0">
                                  <AccordionTrigger
                                    onClick={() => handleIndustrySelect(industry.code)}
                                    className={cn(
                                      "text-sm font-normal hover:no-underline px-2 py-1.5 rounded-md text-left",
                                      selectedIndustry === industry.code ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted/20"
                                    )}
                                  >
                                    {industry.code}: {industry.title}
                                  </AccordionTrigger>
                                  <AccordionContent className="px-2 pt-1 pb-0 text-xs text-muted-foreground">
                                    {industry.description}
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                    <p className="text-sm text-muted-foreground p-4 text-center">Detailed industry filters for this sector will be available soon.</p>
                )}
            </CardContent>
          </Card>
        </div>

        {/* Right Content: Posts */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Posts in {selectedIndustry ? sectorData.subSectors.flatMap(ss => ss.industries).find(ind => ind.code === selectedIndustry)?.title ?? 'Selected Industry'
                           : selectedSubSector ? sectorData.subSectors.find(ss => ss.code === selectedSubSector)?.title ?? 'Selected Sub-Sector'
                           : sectorData.title}
              </CardTitle>
              <CardDescription>
                {selectedIndustry ? `Showing posts related to industry NAICS ${selectedIndustry}.`
                : selectedSubSector ? `Showing posts related to sub-sector NAICS ${selectedSubSector}.`
                : `Showing all posts for ${sectorData.title}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Placeholder for "Create Post" button within this sector context */}
              {/* <div className="mb-4">
                <Button>Create Post in {sectorData.title}</Button>
              </div> */}
              {filteredPosts.length > 0 ? (
                <div className="space-y-4">
                  {filteredPosts.map((post) => (
                    <Card key={post.id} className="shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                             <CardTitle className="text-md font-semibold hover:text-primary cursor-pointer">
                                {/* Link to the main page, passing postId to open the sheet */}
                                <Link href={`/?postId=${post.id}`}>{post.question}</Link>
                             </CardTitle>
                             <CardDescription className="text-xs pt-0.5">
                                Posted on: {post.createdAt instanceof Timestamp ? post.createdAt.toDate().toLocaleDateString() : 'Date unavailable'}
                             </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {post.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{post.description}</p>}
                            <div className="flex flex-wrap gap-1.5">
                                {post.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                                {post.naicsCode && <Badge variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1"/>NAICS: {post.naicsCode}</Badge>}
                            </div>
                        </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No posts found matching your current filters for this sector.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SectorDetailPage;

    