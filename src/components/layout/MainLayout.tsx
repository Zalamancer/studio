
// src/components/layout/MainLayout.tsx
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Home, Compass, Network, FileText, LogOut, PlusCircle, UserCircle, CreditCard, Settings, User, Bell } from "lucide-react"; // Changed LineChart to Compass
import { signOut } from '@/lib/firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { CreatePostForm, type CreatePostFormData, type SectorWithSubSectors, type SubSector, type Industry } from '@/components/CreatePostForm';
import type { NewPostData } from '@/types/post';
import { addPostToFirestore } from '@/services/postService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';

const navItems = [
  { title: "Board", href: "/", icon: Home },
  { title: "Discover", href: "/discover", icon: Compass },
  { title: "Connect", href: "/connect", icon: Network },
  { title: "Contracts", href: "/contracts", icon: FileText },
];

export const availableTags = [
    "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

// Define the detailed sector data structure including industries
export const detailedSectorsData: SectorWithSubSectors[] = [
  {
    name: "Agriculture, Forestry, Fishing and Hunting",
    code: "11",
    subSectors: [
      {
        name: "Crop Production",
        code: "111",
        industries: [
          { name: "Soybean Farming", code: "111110" },
          { name: "Oilseed (except Soybean) Farming", code: "111120" },
          { name: "Dry Pea and Bean Farming", code: "111130" },
          { name: "Wheat Farming", code: "111140" },
          { name: "Corn Farming", code: "111150" },
          { name: "Rice Farming", code: "111160" },
          { name: "Oilseed and Grain Combination Farming", code: "111191" },
          { name: "All Other Grain Farming", code: "111199" },
          { name: "Potato Farming", code: "111211" },
          { name: "Other Vegetable (except Potato) and Melon Farming", code: "111219" },
          { name: "Orange Groves", code: "111310" },
          { name: "Citrus (except Orange) Groves", code: "111320" },
          { name: "Apple Orchards", code: "111331" },
          { name: "Grape Vineyards", code: "111332" },
          { name: "Strawberry Farming", code: "111333" },
          { name: "Berry (except Strawberry) Farming", code: "111334" },
          { name: "Tree Nut Farming", code: "111335" },
          { name: "Fruit and Tree Nut Combination Farming", code: "111336" },
          { name: "Other Noncitrus Fruit Farming", code: "111339" },
          { name: "Mushroom Production", code: "111411" },
          { name: "Other Food Crops Grown Under Cover", code: "111419" },
          { name: "Nursery and Tree Production", code: "111421" },
          { name: "Floriculture Production", code: "111422" },
          { name: "Tobacco Farming", code: "111910" },
          { name: "Cotton Farming", code: "111920" },
          { name: "Sugarcane Farming", code: "111930" },
          { name: "Hay Farming", code: "111940" },
          { name: "Sugar Beet Farming", code: "111991" },
          { name: "Peanut Farming", code: "111992" },
          { name: "All Other Miscellaneous Crop Farming", code: "111998" },
        ],
      },
      {
        name: "Animal Production and Aquaculture",
        code: "112",
        industries: [
          { name: "Beef Cattle Ranching and Farming", code: "112111" },
          { name: "Cattle Feedlots", code: "112112" },
          { name: "Dairy Cattle and Milk Production", code: "112120" },
          { name: "Dual-Purpose Cattle Ranching and Farming", code: "112130" },
          { name: "Hog and Pig Farming", code: "112210" },
          { name: "Chicken Egg Production", code: "112310" },
          { name: "Broilers and Other Meat Type Chicken Production", code: "112320" },
          { name: "Turkey Production", code: "112330" },
          { name: "Poultry Hatcheries", code: "112340" },
          { name: "Other Poultry Production", code: "112390" },
          { name: "Sheep Farming", code: "112410" },
          { name: "Goat Farming", code: "112420" },
          { name: "Finfish Farming and Fish Hatcheries", code: "112511" },
          { name: "Shellfish Farming", code: "112512" },
          { name: "Other Aquaculture", code: "112519" },
          { name: "Apiculture", code: "112910" },
          { name: "Horses and Other Equine Production", code: "112920" },
          { name: "Fur-Bearing Animal and Rabbit Production", code: "112930" },
          { name: "All Other Animal Production", code: "112990" },
        ],
      },
      {
        name: "Forestry and Logging",
        code: "113",
        industries: [
          { name: "Timber Tract Operations", code: "113110" },
          { name: "Forest Nurseries and Gathering of Forest Products", code: "113210" },
          { name: "Logging", code: "113310" },
        ],
      },
      {
        name: "Fishing, Hunting and Trapping",
        code: "114",
        industries: [
          { name: "Finfish Fishing", code: "114111" },
          { name: "Shellfish Fishing", code: "114112" },
          { name: "Other Marine Fishing", code: "114119" },
          { name: "Hunting and Trapping", code: "114210" },
        ],
      },
      {
        name: "Support Activities for Agriculture and Forestry",
        code: "115",
        industries: [
          { name: "Cotton Ginning", code: "115111" },
          { name: "Soil Preparation, Planting, and Cultivating", code: "115112" },
          { name: "Crop Harvesting, Primarily by Machine", code: "115113" },
          { name: "Postharvest Crop Activities (except Cotton Ginning)", code: "115114" },
          { name: "Farm Labor Contractors and Crew Leaders", code: "115115" },
          { name: "Farm Management Services", code: "115116" },
          { name: "Support Activities for Animal Production", code: "115210" },
          { name: "Support Activities for Forestry", code: "115310" },
        ],
      },
    ],
  },
  {
    name: "Mining, Quarrying, and Oil and Gas Extraction",
    code: "21",
    subSectors: [
      { name: "Oil and Gas Extraction", code: "211", industries: [{ name: "Crude Petroleum and Natural Gas Extraction", code: "2111" }] },
      { name: "Mining (except Oil and Gas)", code: "212", industries: [{ name: "Coal Mining", code: "2121" }, { name: "Metal Ore Mining", code: "2122" }, { name: "Nonmetallic Mineral Mining and Quarrying", code: "2123" }] },
      { name: "Support Activities for Mining", code: "213", industries: [{ name: "Support Activities for Oil and Gas Operations", code: "2131" }] },
    ],
  },
  {
    name: "Utilities",
    code: "22",
    subSectors: [
      { name: "Electric Power Generation, Transmission and Distribution", code: "221", industries: [{ name: "Electric Power Generation", code: "2211" }] },
      { name: "Natural Gas Distribution", code: "222", industries: [{ name: "Natural Gas Distribution", code: "2212" }] }, // Example, NAICS combines water/sewage with gas but simplified here
      { name: "Water, Sewage and Other Systems", code: "223", industries: [{ name: "Water Supply and Irrigation Systems", code: "2213" }] },
    ],
  },
  {
    name: "Construction",
    code: "23",
    subSectors: [
      { name: "Construction of Buildings", code: "236", industries: [{ name: "Residential Building Construction", code: "2361" }, { name: "Nonresidential Building Construction", code: "2362" }] },
      { name: "Heavy and Civil Engineering Construction", code: "237", industries: [{ name: "Utility System Construction", code: "2371" }, { name: "Highway, Street, and Bridge Construction", code: "2373" }] },
      { name: "Specialty Trade Contractors", code: "238", industries: [{ name: "Foundation, Structure, and Building Exterior Contractors", code: "2381" }, { name: "Building Equipment Contractors", code: "2382" }] },
    ],
  },
  {
    name: "Manufacturing", // NAICS 31-33
    code: "31-33",
    subSectors: [
      {
        name: "Food Manufacturing", code: "311", industries: [
          { name: "Animal Food Manufacturing", code: "3111" },
          { name: "Grain and Oilseed Milling", code: "3112" },
          { name: "Sugar and Confectionery Product Manufacturing", code: "3113" },
          { name: "Fruit and Vegetable Preserving and Specialty Food Manufacturing", code: "3114" },
          { name: "Dairy Product Manufacturing", code: "3115" },
          { name: "Animal Slaughtering and Processing", code: "3116" },
          { name: "Seafood Product Preparation and Packaging", code: "3117" },
          { name: "Bakeries and Tortilla Manufacturing", code: "3118" },
          { name: "Other Food Manufacturing", code: "3119" },
        ]
      },
      {
        name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [
          { name: "Beverage Manufacturing", code: "3121" },
          { name: "Tobacco Manufacturing", code: "3122" },
        ]
      },
      {
        name: "Textile Mills", code: "313", industries: [
          { name: "Fiber, Yarn, and Thread Mills", code: "3131" },
          { name: "Fabric Mills", code: "3132" },
          { name: "Textile and Fabric Finishing and Fabric Coating Mills", code: "3133" },
        ]
      },
      {
        name: "Textile Product Mills", code: "314", industries: [
          { name: "Textile Furnishings Mills", code: "3141" },
          { name: "Other Textile Product Mills", code: "3149" },
        ]
      },
      {
        name: "Apparel Manufacturing", code: "315", industries: [
          { name: "Apparel Knitting Mills", code: "3151" },
          { name: "Cut and Sew Apparel Manufacturing", code: "3152" },
          { name: "Apparel Accessories and Other Apparel Manufacturing", code: "3159" },
        ]
      },
      {
        name: "Leather and Allied Product Manufacturing", code: "316", industries: [
          { name: "Leather and Hide Tanning and Finishing", code: "3161" },
          { name: "Footwear Manufacturing", code: "3162" },
          { name: "Other Leather and Allied Product Manufacturing", code: "3169" },
        ]
      },
      {
        name: "Wood Product Manufacturing", code: "321", industries: [
          { name: "Sawmills and Wood Preservation", code: "3211" },
          { name: "Veneer, Plywood, and Engineered Wood Product Manufacturing", code: "3212" },
          { name: "Other Wood Product Manufacturing", code: "3219" },
        ]
      },
      {
        name: "Paper Manufacturing", code: "322", industries: [
          { name: "Pulp, Paper, and Paperboard Mills", code: "3221" },
          { name: "Converted Paper Product Manufacturing", code: "3222" },
        ]
      },
      {
        name: "Printing and Related Support Activities", code: "323", industries: [
          { name: "Printing and Related Support Activities", code: "3231" },
        ]
      },
      {
        name: "Petroleum and Coal Products Manufacturing", code: "324", industries: [
          { name: "Petroleum Refineries", code: "324110" },
          { name: "Asphalt Paving, Roofing, and Saturated Materials Manufacturing", code: "32412" },
          { name: "Other Petroleum and Coal Products Manufacturing", code: "32419" },
        ]
      },
      {
        name: "Chemical Manufacturing", code: "325", industries: [
          { name: "Basic Chemical Manufacturing", code: "3251" },
          { name: "Resin, Synthetic Rubber, and Artificial and Synthetic Fibers and Filaments Manufacturing", code: "3252" },
          { name: "Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing", code: "3253" },
          { name: "Pharmaceutical and Medicine Manufacturing", code: "3254" },
          { name: "Paint, Coating, and Adhesive Manufacturing", code: "3255" },
          { name: "Soap, Cleaning Compound, and Toilet Preparation Manufacturing", code: "3256" },
          { name: "Other Chemical Product and Preparation Manufacturing", code: "3259" },
        ]
      },
      {
        name: "Plastics and Rubber Products Manufacturing", code: "326", industries: [
          { name: "Plastics Product Manufacturing", code: "3261" },
          { name: "Rubber Product Manufacturing", code: "3262" },
        ]
      },
      {
        name: "Nonmetallic Mineral Product Manufacturing", code: "327", industries: [
          { name: "Clay Product and Refractory Manufacturing", code: "3271" },
          { name: "Glass and Glass Product Manufacturing", code: "3272" },
          { name: "Cement and Concrete Product Manufacturing", code: "3273" },
          { name: "Lime and Gypsum Product Manufacturing", code: "3274" },
          { name: "Other Nonmetallic Mineral Product Manufacturing", code: "3279" },
        ]
      },
      {
        name: "Primary Metal Manufacturing", code: "331", industries: [
          { name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "3311" },
          { name: "Steel Product Manufacturing from Purchased Steel", code: "3312" },
          { name: "Alumina and Aluminum Production and Processing", code: "3313" },
          { name: "Nonferrous Metal (except Aluminum) Production and Processing", code: "3314" },
          { name: "Foundries", code: "3315" },
        ]
      },
      {
        name: "Fabricated Metal Product Manufacturing", code: "332", industries: [
          { name: "Forging and Stamping", code: "3321" },
          { name: "Cutlery and Handtool Manufacturing", code: "3322" },
          { name: "Architectural and Structural Metals Manufacturing", code: "3323" },
          { name: "Boiler, Tank, and Shipping Container Manufacturing", code: "3324" },
          { name: "Hardware Manufacturing", code: "3325" },
          { name: "Spring and Wire Product Manufacturing", code: "3326" },
          { name: "Machine Shops; Turned Product; and Screw, Nut, and Bolt Manufacturing", code: "3327" },
          { name: "Coating, Engraving, Heat Treating, and Allied Activities", code: "3328" },
          { name: "Other Fabricated Metal Product Manufacturing", code: "3329" },
        ]
      },
      {
        name: "Machinery Manufacturing", code: "333", industries: [
          { name: "Agriculture, Construction, and Mining Machinery Manufacturing", code: "3331" },
          { name: "Industrial Machinery Manufacturing", code: "3332" },
          { name: "Commercial and Service Industry Machinery Manufacturing", code: "3333" },
          { name: "Ventilation, Heating, Air-Conditioning, and Commercial Refrigeration Equipment Manufacturing", code: "3334" },
          { name: "Metalworking Machinery Manufacturing", code: "3335" },
          { name: "Engine, Turbine, and Power Transmission Equipment Manufacturing", code: "3336" },
          { name: "Other General Purpose Machinery Manufacturing", code: "3339" },
        ]
      },
      {
        name: "Computer and Electronic Product Manufacturing", code: "334", industries: [
          { name: "Computer and Peripheral Equipment Manufacturing", code: "3341" },
          { name: "Communications Equipment Manufacturing", code: "3342" },
          { name: "Audio and Video Equipment Manufacturing", code: "3343" },
          { name: "Semiconductor and Other Electronic Component Manufacturing", code: "3344" },
          { name: "Navigational, Measuring, Electromedical, and Control Instruments Manufacturing", code: "3345" },
          { name: "Manufacturing and Reproducing Magnetic and Optical Media", code: "3346" },
        ]
      },
      {
        name: "Electrical Equipment, Appliance, and Component Manufacturing", code: "335", industries: [
          { name: "Electric Lighting Equipment Manufacturing", code: "3351" },
          { name: "Household Appliance Manufacturing", code: "3352" },
          { name: "Electrical Equipment Manufacturing", code: "3353" },
          { name: "Other Electrical Equipment and Component Manufacturing", code: "3359" },
        ]
      },
      {
        name: "Transportation Equipment Manufacturing", code: "336", industries: [
          { name: "Motor Vehicle Manufacturing", code: "3361" },
          { name: "Motor Vehicle Body and Trailer Manufacturing", code: "3362" },
          { name: "Motor Vehicle Parts Manufacturing", code: "3363" },
          { name: "Aerospace Product and Parts Manufacturing", code: "3364" },
          { name: "Railroad Rolling Stock Manufacturing", code: "3365" },
          { name: "Ship and Boat Building", code: "3366" },
          { name: "Other Transportation Equipment Manufacturing", code: "3369" },
        ]
      },
      {
        name: "Furniture and Related Product Manufacturing", code: "337", industries: [
          { name: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", code: "3371" },
          { name: "Office Furniture (including Fixtures) Manufacturing", code: "3372" },
          { name: "Other Furniture Related Product Manufacturing", code: "3379" },
        ]
      },
      {
        name: "Miscellaneous Manufacturing", code: "339", industries: [
          { name: "Medical Equipment and Supplies Manufacturing", code: "3391" },
          { name: "Other Miscellaneous Manufacturing", code: "3399" },
        ]
      },
    ]
  },
  { name: "Wholesale Trade", code: "42", subSectors: [{ name: "Merchant Wholesalers, Durable Goods", code: "423", industries: [{name: "Motor Vehicle and Motor Vehicle Parts and Supplies Merchant Wholesalers", code: "4231"}] }, { name: "Merchant Wholesalers, Nondurable Goods", code: "424", industries: [{name: "Paper and Paper Product Merchant Wholesalers", code: "4241"}] }] },
  { name: "Retail Trade", code: "44-45", subSectors: [{ name: "Motor Vehicle and Parts Dealers", code: "441", industries: [{name: "Automobile Dealers", code: "4411"}] }, { name: "Clothing and Clothing Accessories Stores", code: "448", industries: [{name: "Clothing Stores", code: "4481"}] }] },
  { name: "Transportation and Warehousing", code: "48-49", subSectors: [{ name: "Air Transportation", code: "481", industries: [{name: "Scheduled Passenger Air Transportation", code: "4811"}] }, { name: "Truck Transportation", code: "484", industries: [{name: "General Freight Trucking", code: "4841"}] }, { name: "Warehousing and Storage", code: "493", industries: [{name: "General Warehousing and Storage", code: "4931"}] }] },
  { name: "Information", code: "51", subSectors: [{ name: "Publishing Industries (except Internet)", code: "511", industries: [{ name: "Newspaper, Periodical, Book, and Directory Publishers", code: "5111" }] }, { name: "Telecommunications", code: "517", industries: [{ name: "Wired and Wireless Telecommunications Carriers", code: "5173" }] }] }, // Updated 517 to 5173 for more specificity
  { name: "Finance and Insurance", code: "52", subSectors: [{ name: "Monetary Authorities - Central Bank", code: "521", industries: [{ name: "Monetary Authorities - Central Bank", code: "5211" }] }, { name: "Credit Intermediation and Related Activities", code: "522", industries: [{ name: "Commercial Banking", code: "5221" }] }, { name: "Insurance Carriers and Related Activities", code: "524", industries: [{ name: "Direct Life Insurance Carriers", code: "5241" }] }] },
  { name: "Real Estate and Rental and Leasing", code: "53", subSectors: [{ name: "Real Estate", code: "531", industries: [{ name: "Lessors of Real Estate", code: "5311" }] }, { name: "Rental and Leasing Services", code: "532", industries: [{ name: "Automotive Equipment Rental and Leasing", code: "5321" }] }] },
  { name: "Professional, Scientific, and Technical Services", code: "54", subSectors: [{ name: "Legal Services", code: "541", industries: [{ name: "Offices of Lawyers", code: "5411" }] }, { name: "Architectural, Engineering, and Related Services", code: "5413", industries: [{name: "Architectural Services", code: "541310"}] }, { name: "Computer Systems Design and Related Services", code: "5415", industries: [{name: "Custom Computer Programming Services", code: "541511"}] }] },
  { name: "Management of Companies and Enterprises", code: "55", subSectors: [{ name: "Management of Companies and Enterprises", code: "551", industries: [{ name: "Offices of Bank Holding Companies", code: "551111" }] }] },
  { name: "Administrative and Support and Waste Management and Remediation Services", code: "56", subSectors: [{ name: "Administrative and Support Services", code: "561", industries: [{ name: "Office Administrative Services", code: "5611" }] }, { name: "Waste Management and Remediation Services", code: "562", industries: [{ name: "Waste Collection", code: "5621" }] }] },
  { name: "Educational Services", code: "61", subSectors: [{ name: "Elementary and Secondary Schools", code: "611", industries: [{ name: "Elementary and Secondary Schools", code: "6111" }] }, { name: "Colleges, Universities, and Professional Schools", code: "6113", industries: [{name: "Colleges, Universities, and Professional Schools", code: "611310"}] } ] },
  { name: "Health Care and Social Assistance", code: "62", subSectors: [{ name: "Ambulatory Health Care Services", code: "621", industries: [{ name: "Offices of Physicians", code: "6211" }] }, { name: "Hospitals", code: "622", industries: [{ name: "General Medical and Surgical Hospitals", code: "6221" }] }, { name: "Social Assistance", code: "624", industries: [{ name: "Individual and Family Services", code: "6241" }] }] },
  { name: "Arts, Entertainment, and Recreation", code: "71", subSectors: [{ name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [{ name: "Performing Arts Companies", code: "7111" }] }, { name: "Museums, Historical Sites, and Similar Institutions", code: "712", industries: [{ name: "Museums", code: "7121" }] }] },
  { name: "Accommodation and Food Services", code: "72", subSectors: [{ name: "Accommodation", code: "721", industries: [{ name: "Traveler Accommodation", code: "7211" }] }, { name: "Food Services and Drinking Places", code: "722", industries: [{ name: "Full-Service Restaurants", code: "722511" }] }] }, // Used 722511 for more specificity
  { name: "Other Services (except Public Administration)", code: "81", subSectors: [{ name: "Repair and Maintenance", code: "811", industries: [{ name: "Automotive Repair and Maintenance", code: "8111" }] }, { name: "Personal and Laundry Services", code: "812", industries: [{ name: "Hair, Nail, and Skin Care Services", code: "8121" }] }] },
  { name: "Public Administration", code: "92", subSectors: [{ name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [{ name: "Executive Offices", code: "92111" }] }, { name: "National Security and International Affairs", code: "928", industries: [{ name: "National Security", code: "9281" }] }] }
];


const getInitials = (displayNameOrEmail: string | null | undefined): string => {
    if (!displayNameOrEmail) return '?';
    const name = displayNameOrEmail;
    if (name.includes('@') && !name.includes(' ')) {
        // For emails without spaces, take the first letter
        return name.charAt(0).toUpperCase();
    }
    const parts = name.split(' ').filter(Boolean); // Split by space and remove empty strings
    if (parts.length === 0) return '?';
    if (parts.length === 1) {
        // Single name part, take its first letter
        return parts[0].charAt(0).toUpperCase();
    }
    // Multiple name parts, take first letter of first and last part
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};


export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      router.push('/login');
    } catch (error) {
      console.error("Logout Error:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred during logout. Please try again.",
      });
    }
  };

  const addPostMutation = useMutation({
      mutationFn: addPostToFirestore,
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['posts'] }).then(() => {
              toast({
                  title: "Post Created",
                  description: "Your post has been added to the board.",
              });
              setIsCreatePostOpen(false);
          }).catch(err => {
              console.error("Error during post-success operations (invalidate/toast/close):", err);
               setIsCreatePostOpen(false); // Still close dialog on any post-success error
          });
       },
      onError: (error: Error) => {
          console.error("Add Post Mutation failed:", error);
          toast({
            variant: "destructive",
            title: "Post Failed",
            description: `Could not add your post: ${error.message}. Check console and Firestore rules.`,
          });
      },
  });

  const handleAddPost = (formData: CreatePostFormData) => {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Required",
            description: "You must be logged in to create a post.",
        });
        return;
    }

    // Find the full details for sector, sub-sector, and industry
    const mainSectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
    const subSectorDetails = mainSectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
    const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

    const newPostDataForService: NewPostData = {
        question: formData.question,
        description: formData.description,
        tags: formData.tags || [],
        sector: mainSectorDetails?.name || formData.sector, // Use name, fallback to code
        subSector: subSectorDetails?.name || formData.subSector, // Use name, fallback to code
        industry: industryDetails?.name || formData.industry, // Use name, fallback to code
        naicsCode: formData.industry || formData.subSector || formData.sector, // Most specific code
        userId: user.uid,
        businessType: "Startup", // Example, can be made dynamic later
        safetyIndicator: "Medium", // Example
        ratingScore: Math.floor(Math.random() * 3) + 3, // Example
    };
    addPostMutation.mutate(newPostDataForService);
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center">
          <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <span className="hidden font-bold sm:inline-block text-primary hover:text-primary/90 text-lg">
                AnonyCollab
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm lg:gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className={cn(
                    "transition-colors hover:text-foreground/80",
                    pathname === item.href ? 'text-foreground font-semibold' : 'text-foreground/60'
                  )}
                >
                  <item.icon className="mr-1 h-4 w-4 inline-block" aria-hidden="true" />
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>
           <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
             {user && (
                <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
                  <DialogTrigger asChild>
                     <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                       <PlusCircle className="mr-2 h-4 w-4" />
                       Create Post
                     </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                     <DialogHeader>
                       <DialogTitle>Create a New Post</DialogTitle>
                       <DialogDescription>
                         Share your question or need with the community. Keep it anonymous.
                       </DialogDescription>
                     </DialogHeader>
                     {isCreatePostOpen && ( // Conditionally render to re-mount form on open
                        <CreatePostForm
                           onSubmit={handleAddPost}
                           availableTags={availableTags}
                           detailedSectorsData={detailedSectorsData} // Pass the detailed data
                           isSubmitting={addPostMutation.isPending}
                        />
                     )}
                  </DialogContent>
                </Dialog>
             )}

            {user ? (
              <div className="flex items-center gap-2">
                <NotificationDropdown userId={user.uid} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="icon" aria-label="User Menu" className="rounded-full h-8 w-8">
                       <Avatar className="h-8 w-8">
                         <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? "User"} />
                         <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                           {getInitials(user.displayName || user.email)}
                         </AvatarFallback>
                       </Avatar>
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                       <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                     <DropdownMenuItem asChild className={cn("cursor-pointer w-full", pathname === `/profile/${user.uid}` && "bg-accent text-accent-foreground")}>
                      <Link href={`/profile/${user.uid}`} className="w-full">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild className={cn("cursor-pointer w-full", pathname === "/subscription" && "bg-accent text-accent-foreground")}>
                       <Link href="/subscription" className="w-full">
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Subscription</span>
                      </Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild className={cn("cursor-pointer w-full", pathname.startsWith("/settings") && "bg-accent text-accent-foreground")}>
                       <Link href="/settings/profile" className="w-full">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <ThemeToggle />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                       <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" asChild>
                   <Link href="/login">Login</Link>
                 </Button>
                 <Button variant="default" size="sm" asChild>
                   <Link href="/signup">Sign Up</Link>
                 </Button>
              </div>
            )}
           </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="py-4 border-t mt-auto">
          <div className="container mx-auto text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} AnonyCollab. All rights reserved.
          </div>
      </footer>
    </div>
  );
}
