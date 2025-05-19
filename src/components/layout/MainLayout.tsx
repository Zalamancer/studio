
// src/components/layout/MainLayout.tsx
"use client";

import React,
{
  useState,
  useEffect
} from 'react'; // Added useEffect
import Link from 'next/link';
import {
  usePathname,
  useRouter
} from 'next/navigation';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import {
  Button
} from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/components/ui/avatar";
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
} from "@/components/ui/dropdown-menu"; // Import Dropdown components
import {
  Home,
  Compass,
  Network,
  FileText,
  LogOut,
  PlusCircle,
  UserCircle,
  CreditCard,
  Settings,
  User,
  Bell
} from "lucide-react"; // Changed LineChart to Compass
import {
  signOut
} from '@/lib/firebase/auth';
import {
  useToast
} from "@/hooks/use-toast";
import {
  useAuth
} from '@/contexts/AuthContext';
import {
  CreatePostForm,
  type CreatePostFormData
} from '@/components/CreatePostForm';
import type {
  NewPostData
} from '@/types/post';
import {
  addPostToFirestore
} from '@/services/postService';
import {
  uploadPostImage
} from '@/services/storageService'; // Import storage service
import {
  useMutation,
  useQueryClient
} from '@tanstack/react-query';
import {
  ThemeToggle
} from '@/components/ThemeToggle';
import {
  cn
} from '@/lib/utils';
import {
  NotificationDropdown
} from '@/components/notifications/NotificationDropdown';
import {
  createNotification
} from '@/services/notificationService';
import {
  generateAnonymousName
} from '@/lib/pseudonymUtils';

const navItems = [{
  title: "Board",
  href: "/",
  icon: Home
}, {
  title: "Discover",
  href: "/discover",
  icon: Compass
}, {
  title: "Connect",
  href: "/connect",
  icon: Network
}, {
  title: "Contracts",
  href: "/contracts",
  icon: FileText
}, ];

export const availableTags = [
  "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

// Defines the structure for individual industries
export interface Industry {
  name: string;
  code: string;
  description?: string; // Optional description for an industry
}

// Defines the structure for sub-sectors, which contain industries
export interface SubSector {
  name: string;
  code: string;
  description?: string; // Optional description for a sub-sector
  industries: Industry[];
}

// Defines the structure for main sectors, which contain sub-sectors
export interface SectorWithSubSectors {
  name: string;
  code: string;
  description?: string; // Optional description for a main sector
  subSectors: SubSector[];
}


// Export this detailed data structure
export const detailedSectorsData: SectorWithSubSectors[] = [
  {
    name: "Agriculture, Forestry, Fishing and Hunting",
    code: "11",
    description: "Establishments primarily engaged in growing crops, raising animals, harvesting timber, and harvesting fish and other animals from a farm, ranch, or their natural habitats.",
    subSectors: [
      {
        name: "Crop Production",
        code: "111",
        description: "Industries in the Crop Production subsector grow crops mainly for food and fiber.",
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
        description: "Raising or fattening animals for the sale of animals or animal products and/or raising aquatic plants and animals in controlled environments.",
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
        description: "Growing and harvesting timber on a long production cycle.",
        industries: [
          { name: "Timber Tract Operations", code: "113110" },
          { name: "Forest Nurseries and Gathering of Forest Products", code: "113210" },
          { name: "Logging", code: "113310" },
        ],
      },
      {
        name: "Fishing, Hunting and Trapping",
        code: "114",
        description: "Harvesting fish and other wild animals from their natural habitats.",
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
        description: "Providing support services that are an essential part of agricultural and forestry production.",
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
    description: "Extracting naturally occurring mineral solids, liquid minerals, and gases.",
    subSectors: [
      {
        name: "Oil and Gas Extraction",
        code: "211",
        description: "Extracting crude petroleum and natural gas.",
        industries: [
          { name: "Crude Petroleum Extraction", code: "211120" },
          { name: "Natural Gas Extraction", code: "211130" },
        ],
      },
      {
        name: "Coal Mining",
        code: "2121", // Note: NAICS 2022 groups all coal mining under 2121
        description: "Mining coal.",
        industries: [
          { name: "Bituminous Coal and Lignite Surface Mining", code: "212111" },
          { name: "Bituminous Coal Underground Mining", code: "212112" },
          { name: "Anthracite Mining", code: "212113" },
        ],
      },
      {
        name: "Metal Ore Mining",
        code: "2122",
        description: "Mining metallic minerals (ores).",
        industries: [
          { name: "Iron Ore Mining", code: "212210" },
          { name: "Gold Ore Mining", code: "212221" },
          { name: "Silver Ore Mining", code: "212222" },
          { name: "Copper, Nickel, Lead, and Zinc Mining", code: "212230" }, // Grouped in NAICS 2022
          { name: "All Other Metal Ore Mining", code: "212290" }, // Grouped in NAICS 2022
        ],
      },
      {
        name: "Nonmetallic Mineral Mining and Quarrying",
        code: "2123",
        description: "Mining or quarrying nonmetallic minerals, except fuels.",
        industries: [
          { name: "Stone Mining and Quarrying", code: "21231" }, // This is a 5-digit code, representing a group
          { name: "Sand, Gravel, Clay, and Ceramic and Refractory Minerals Mining and Quarrying", code: "21232" }, // 5-digit
          { name: "Other Nonmetallic Mineral Mining and Quarrying", code: "21239" }, // 5-digit
        ],
      },
      {
        name: "Support Activities for Mining",
        code: "213",
        description: "Providing support services for mining, quarrying, and oil and gas extraction operations.",
        industries: [
          { name: "Support Activities for Oil and Gas Operations", code: "213111" },
          { name: "Support Activities for Coal Mining", code: "213113" },
          { name: "Support Activities for Metal Mining", code: "213114" },
          { name: "Support Activities for Nonmetallic Minerals (except Fuels) Mining", code: "213115" },
        ],
      },
    ],
  },
  {
    name: "Utilities",
    code: "22",
    description: "Generating, transmitting, or distributing electricity, gas, steam, water, and sewage removal.",
    subSectors: [
      {
        name: "Electric Power Generation, Transmission and Distribution",
        code: "2211",
        description: "Generating, transmitting, and/or distributing electric power.",
        industries: [
          { name: "Hydroelectric Power Generation", code: "221111" },
          { name: "Fossil Fuel Electric Power Generation", code: "221112" },
          { name: "Nuclear Electric Power Generation", code: "221113" },
          { name: "Other Electric Power Generation", code: "221118" }, // Solar, Wind, Geothermal, etc.
          { name: "Electric Power Transmission, Control, and Distribution", code: "22112" }, // This is a 5-digit group
        ],
      },
      {
        name: "Natural Gas Distribution",
        code: "2212", // NAICS 2022 has this directly under 2212, often 221210
        description: "Distributing natural gas to end users.",
        industries: [
          { name: "Natural Gas Distribution", code: "221210" },
        ],
      },
      {
        name: "Water, Sewage and Other Systems",
        code: "2213",
        description: "Operating water, sewage, and other systems.",
        industries: [
          { name: "Water Supply and Irrigation Systems", code: "221310" },
          { name: "Sewage Treatment Facilities", code: "221320" },
          { name: "Steam and Air-Conditioning Supply", code: "221330" },
        ],
      },
    ],
  },
  {
    name: "Construction",
    code: "23",
    description: "Constructing, repairing, and renovating buildings and engineering works.",
    subSectors: [
      {
        name: "Construction of Buildings",
        code: "236",
        description: "Constructing residential and nonresidential buildings.",
        industries: [
          { name: "Residential Building Construction", code: "2361" }, // 5-digit group
          { name: "Nonresidential Building Construction", code: "2362" }, // 5-digit group
        ],
      },
      {
        name: "Heavy and Civil Engineering Construction",
        code: "237",
        description: "Constructing heavy and civil engineering projects.",
        industries: [
          { name: "Utility System Construction", code: "2371" }, // 5-digit group
          { name: "Land Subdivision", code: "237210" },
          { name: "Highway, Street, and Bridge Construction", code: "237310" },
          { name: "Other Heavy and Civil Engineering Construction", code: "237990" },
        ],
      },
      {
        name: "Specialty Trade Contractors",
        code: "238",
        description: "Performing specialized activities related to building construction.",
        industries: [
          { name: "Foundation, Structure, and Building Exterior Contractors", code: "2381" }, // 5-digit group
          { name: "Building Equipment Contractors", code: "2382" }, // 5-digit group
          { name: "Building Finishing Contractors", code: "2383" }, // 5-digit group
          { name: "Other Specialty Trade Contractors", code: "2389" }, // 5-digit group
        ],
      },
    ],
  },
  {
    name: "Manufacturing",
    code: "31-33",
    description: "Mechanical, physical, or chemical transformation of materials, substances, or components into new products.",
    subSectors: [
      { name: "Food Manufacturing", code: "311", industries: [
        { name: "Animal Food Manufacturing", code: "3111" },
        { name: "Grain and Oilseed Milling", code: "3112" },
        { name: "Sugar and Confectionery Product Manufacturing", code: "3113" },
        { name: "Fruit and Vegetable Preserving and Specialty Food Manufacturing", code: "3114" },
        { name: "Dairy Product Manufacturing", code: "3115" },
        { name: "Animal Slaughtering and Processing", code: "3116" },
        { name: "Seafood Product Preparation and Packaging", code: "3117" },
        { name: "Bakeries and Tortilla Manufacturing", code: "3118" },
        { name: "Other Food Manufacturing", code: "3119" },
      ]},
      { name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [
        { name: "Beverage Manufacturing", code: "3121" },
        { name: "Tobacco Manufacturing", code: "312230" }, // Specific code for Tobacco Manufacturing
      ]},
      { name: "Textile Mills", code: "313", industries: [
        { name: "Fiber, Yarn, and Thread Mills", code: "313110" },
        { name: "Fabric Mills", code: "3132" }, // Group
        { name: "Textile and Fabric Finishing and Fabric Coating Mills", code: "3133" }, // Group
      ]},
      { name: "Textile Product Mills", code: "314", industries: [
        { name: "Textile Furnishings Mills", code: "3141" }, // Group
        { name: "Other Textile Product Mills", code: "3149" }, // Group
      ]},
      { name: "Apparel Manufacturing", code: "315", industries: [
        { name: "Apparel Knitting Mills", code: "315120" },
        { name: "Cut and Sew Apparel Manufacturing", code: "3152" }, // Group
        { name: "Apparel Accessories and Other Apparel Manufacturing", code: "315990" },
      ]},
      { name: "Leather and Allied Product Manufacturing", code: "316", industries: [
        { name: "Leather and Hide Tanning and Finishing", code: "316110" },
        { name: "Footwear Manufacturing", code: "316210" },
        { name: "Other Leather and Allied Product Manufacturing", code: "316990" },
      ]},
      { name: "Wood Product Manufacturing", code: "321", industries: [
        { name: "Sawmills and Wood Preservation", code: "3211" }, // Group
        { name: "Veneer, Plywood, and Engineered Wood Product Manufacturing", code: "3212" }, // Group
        { name: "Other Wood Product Manufacturing", code: "3219" }, // Group
      ]},
      { name: "Paper Manufacturing", code: "322", industries: [
        { name: "Pulp, Paper, and Paperboard Mills", code: "3221" }, // Group
        { name: "Converted Paper Product Manufacturing", code: "3222" }, // Group
      ]},
      { name: "Printing and Related Support Activities", code: "323", industries: [
        { name: "Printing", code: "32311" }, // Group
        { name: "Support Activities for Printing", code: "323120" },
      ]},
      { name: "Petroleum and Coal Products Manufacturing", code: "324", industries: [
        { name: "Petroleum Refineries", code: "324110" },
        { name: "Asphalt Paving, Roofing, and Saturated Materials Manufacturing", code: "32412" }, // Group
        { name: "Other Petroleum and Coal Products Manufacturing", code: "32419" }, // Group
      ]},
      { name: "Chemical Manufacturing", code: "325", industries: [
        { name: "Basic Chemical Manufacturing", code: "3251" }, // Group
        { name: "Resin, Synthetic Rubber, and Artificial and Synthetic Fibers and Filaments Manufacturing", code: "3252" }, // Group
        { name: "Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing", code: "3253" }, // Group
        { name: "Pharmaceutical and Medicine Manufacturing", code: "3254" }, // Group
        { name: "Paint, Coating, and Adhesive Manufacturing", code: "3255" }, // Group
        { name: "Soap, Cleaning Compound, and Toilet Preparation Manufacturing", code: "3256" }, // Group
        { name: "Other Chemical Product and Preparation Manufacturing", code: "3259" }, // Group
      ]},
      { name: "Plastics and Rubber Products Manufacturing", code: "326", industries: [
        { name: "Plastics Product Manufacturing", code: "3261" }, // Group
        { name: "Rubber Product Manufacturing", code: "3262" }, // Group
      ]},
      { name: "Nonmetallic Mineral Product Manufacturing", code: "327", industries: [
        { name: "Clay Product and Refractory Manufacturing", code: "3271" }, // Group
        { name: "Glass and Glass Product Manufacturing", code: "3272" }, // Group
        { name: "Cement and Concrete Product Manufacturing", code: "3273" }, // Group
        { name: "Lime and Gypsum Product Manufacturing", code: "3274" }, // Group
        { name: "Other Nonmetallic Mineral Product Manufacturing", code: "3279" }, // Group
      ]},
      { name: "Primary Metal Manufacturing", code: "331", industries: [
        { name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "331110" },
        { name: "Steel Product Manufacturing from Purchased Steel", code: "3312" }, // Group
        { name: "Alumina and Aluminum Production and Processing", code: "3313" }, // Group
        { name: "Nonferrous Metal (except Aluminum) Production and Processing", code: "3314" }, // Group
        { name: "Foundries", code: "3315" }, // Group
      ]},
      { name: "Fabricated Metal Product Manufacturing", code: "332", industries: [
        { name: "Forging and Stamping", code: "3321" }, // Group
        { name: "Cutlery and Handtool Manufacturing", code: "3322" }, // Group
        { name: "Architectural and Structural Metals Manufacturing", code: "3323" }, // Group
        { name: "Boiler, Tank, and Shipping Container Manufacturing", code: "3324" }, // Group
        { name: "Hardware Manufacturing", code: "332510" },
        { name: "Spring and Wire Product Manufacturing", code: "3326" }, // Group
        { name: "Machine Shops; Turned Product; and Screw, Nut, and Bolt Manufacturing", code: "3327" }, // Group
        { name: "Coating, Engraving, Heat Treating, and Allied Activities", code: "3328" }, // Group
        { name: "Other Fabricated Metal Product Manufacturing", code: "3329" }, // Group
      ]},
      { name: "Machinery Manufacturing", code: "333", industries: [
        { name: "Agriculture, Construction, and Mining Machinery Manufacturing", code: "3331" }, // Group
        { name: "Industrial Machinery Manufacturing", code: "33324" }, // Group
        { name: "Commercial and Service Industry Machinery Manufacturing", code: "333310" },
        { name: "Ventilation, Heating, Air-Conditioning, and Commercial Refrigeration Equipment Manufacturing", code: "3334" }, // Group
        { name: "Metalworking Machinery Manufacturing", code: "3335" }, // Group
        { name: "Engine, Turbine, and Power Transmission Equipment Manufacturing", code: "3336" }, // Group
        { name: "Other General Purpose Machinery Manufacturing", code: "3339" }, // Group
      ]},
      { name: "Computer and Electronic Product Manufacturing", code: "334", industries: [
        { name: "Computer and Peripheral Equipment Manufacturing", code: "3341" }, // Group
        { name: "Communications Equipment Manufacturing", code: "3342" }, // Group
        { name: "Audio and Video Equipment Manufacturing", code: "334310" },
        { name: "Semiconductor and Other Electronic Component Manufacturing", code: "3344" }, // Group
        { name: "Navigational, Measuring, Electromedical, and Control Instruments Manufacturing", code: "3345" }, // Group
        { name: "Manufacturing and Reproducing Magnetic and Optical Media", code: "334610" },
      ]},
      { name: "Electrical Equipment, Appliance, and Component Manufacturing", code: "335", industries: [
        { name: "Electric Lighting Equipment Manufacturing", code: "33513" }, // Group
        { name: "Household Appliance Manufacturing", code: "3352" }, // Group
        { name: "Electrical Equipment Manufacturing", code: "3353" }, // Group
        { name: "Other Electrical Equipment and Component Manufacturing", code: "3359" }, // Group
      ]},
      { name: "Transportation Equipment Manufacturing", code: "336", industries: [
        { name: "Motor Vehicle Manufacturing", code: "3361" }, // Group
        { name: "Motor Vehicle Body and Trailer Manufacturing", code: "3362" }, // Group
        { name: "Motor Vehicle Parts Manufacturing", code: "3363" }, // Group
        { name: "Aerospace Product and Parts Manufacturing", code: "3364" }, // Group
        { name: "Railroad Rolling Stock Manufacturing", code: "336510" },
        { name: "Ship and Boat Building", code: "3366" }, // Group
        { name: "Other Transportation Equipment Manufacturing", code: "3369" }, // Group
      ]},
      { name: "Furniture and Related Product Manufacturing", code: "337", industries: [
        { name: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", code: "3371" }, // Group
        { name: "Office Furniture (including Fixtures) Manufacturing", code: "3372" }, // Group
        { name: "Other Furniture Related Product Manufacturing", code: "3379" }, // Group
      ]},
      { name: "Miscellaneous Manufacturing", code: "339", industries: [
        { name: "Medical Equipment and Supplies Manufacturing", code: "3391" }, // Group
        { name: "Sporting and Athletic Goods Manufacturing", code: "339920" },
        { name: "Doll, Toy, and Game Manufacturing", code: "339930" },
        { name: "Office Supplies (except Paper) Manufacturing", code: "339940" },
        { name: "Sign Manufacturing", code: "339950" },
        { name: "All Other Miscellaneous Manufacturing", code: "33999" }, // Group
      ]},
    ],
  },
  {
    name: "Wholesale Trade",
    code: "42",
    description: "Wholesaling merchandise, generally without transformation, and providing services incidental to the sale of merchandise.",
    subSectors: [
      { name: "Merchant Wholesalers, Durable Goods", code: "423", industries: [
          { name: "Motor Vehicle and Parts Wholesalers", code: "4231" },
          { name: "Furniture and Home Furnishing Wholesalers", code: "4232" },
          { name: "Lumber and Construction Material Wholesalers", code: "4233" },
        ]
      },
      { name: "Merchant Wholesalers, Nondurable Goods", code: "424", industries: [
          { name: "Paper and Paper Product Wholesalers", code: "4241" },
          { name: "Drugs and Druggists' Sundries Wholesalers", code: "4242" },
          { name: "Apparel and Piece Goods Wholesalers", code: "4243" },
        ]
      },
      { name: "Wholesale Electronic Markets and Agents and Brokers", code: "425", industries: [
          { name: "Business to Business Electronic Markets", code: "425110" },
          { name: "Wholesale Trade Agents and Brokers", code: "425120" },
        ]
      },
    ],
  },
  {
    name: "Retail Trade",
    code: "44-45",
    description: "Retailing merchandise, generally without transformation, and rendering services incidental to the sale of merchandise.",
    subSectors: [
      { name: "Motor Vehicle and Parts Dealers", code: "441", industries: [
        { name: "Automobile Dealers", code: "4411" },
        { name: "Other Motor Vehicle Dealers", code: "4412" },
        { name: "Automotive Parts, Accessories, and Tire Retailers", code: "4413" }, // Updated name NAICS 2022
      ]},
      { name: "Furniture, Home Furnishings, Electronics, and Appliance Retailers", code: "449", // Combined from 442 and 443 in NAICS 2022
        industries: [
          { name: "Furniture and Home Furnishings Retailers", code: "4491" },
          { name: "Electronics and Appliance Retailers", code: "4492" },
      ]},
      { name: "Building Material and Garden Equipment and Supplies Dealers", code: "444", industries: [
        { name: "Building Material and Supplies Dealers", code: "4441" },
        { name: "Lawn and Garden Equipment and Supplies Retailers", code: "444240" }, // Specific NAICS 2022
      ]},
      { name: "Food and Beverage Retailers", code: "445", // Updated from 445 (old) to 455 in NAICS 2022
        industries: [
          { name: "Grocery and Convenience Retailers", code: "4451" }, // Specific NAICS 2022
          { name: "Specialty Food Retailers", code: "4452" }, // Specific NAICS 2022
          { name: "Beer, Wine, and Liquor Retailers", code: "4453" }, // Specific NAICS 2022
      ]},
      { name: "Health and Personal Care Retailers", code: "456", // New NAICS 2022 code
        industries: [
          { name: "Pharmacies and Drug Retailers", code: "456110" },
          { name: "Cosmetics, Beauty Supplies, and Perfume Retailers", code: "456120" },
          { name: "Optical Goods Retailers", code: "456130" },
          { name: "Other Health and Personal Care Retailers", code: "45619" },
      ]},
      { name: "Gasoline Stations and Fuel Dealers", code: "457", // Updated NAICS 2022 grouping
        industries: [
          { name: "Gasoline Stations with Convenience Stores", code: "457110" },
          { name: "Other Gasoline Stations", code: "457120" },
          { name: "Fuel Dealers", code: "457210"},
      ]},
      { name: "Clothing, Clothing Accessories, Shoe, and Jewelry Retailers", code: "458", // New NAICS 2022 code
        industries: [
          { name: "Clothing and Clothing Accessories Retailers", code: "4581" },
          { name: "Shoe Retailers", code: "458210" },
          { name: "Jewelry, Watch, Precious Stone, and Silverware Retailers", code: "4583" }, // Group
      ]},
      { name: "Sporting Goods, Hobby, Book, and Music Retailers", code: "459", // Updated in NAICS 2022
        industries: [
          { name: "Sporting Goods Retailers", code: "459110" },
          { name: "Hobby, Toy, and Game Retailers", code: "459120" },
          { name: "Book Retailers", code: "459210" },
          { name: "Other Sporting Goods, Hobby, Book, and Music Retailers", code: "459130" }, // Includes Music
      ]},
      { name: "General Merchandise Retailers", code: "455", // Updated from 452 in NAICS 2022
        industries: [
          { name: "Department Stores", code: "455211" },
          { name: "Warehouse Clubs, Supercenters, and Other General Merchandise Retailers", code: "455219" }, // Combines warehouse clubs/supercenters and other
      ]},
      { name: "Miscellaneous Retailers", code: "459", // Updated NAICS 2022, previous 453 is now part of 459
        industries: [
          { name: "Florists", code: "459310" },
          { name: "Office Supplies, Stationery, and Gift Retailers", code: "459410" },
          { name: "Used Merchandise Retailers", code: "459510" },
          { name: "Other Miscellaneous Retailers", code: "4599" }, // Group
      ]},
      { name: "Nonstore Retailers", code: "454", industries: [ // Code changed to 459 in NAICS 2022 and subcategories changed
        { name: "Electronic Shopping", code: "459610" },
        { name: "Vending Machine Operators", code: "459920" },
        { name: "Direct Selling Establishments", code: "459991" },
      ]},
    ],
  },
  {
    name: "Transportation and Warehousing",
    code: "48-49",
    description: "Providing transportation of passengers and cargo, warehousing and storing goods, and providing services incidental to transportation.",
    subSectors: [
      { name: "Air Transportation", code: "481", industries: [
          { name: "Scheduled Air Transportation", code: "4811" },
          { name: "Nonscheduled Air Transportation", code: "4812" },
        ]
      },
      { name: "Rail Transportation", code: "482", industries: [
          { name: "Rail Transportation", code: "4821" },
        ]
      },
      { name: "Water Transportation", code: "483", industries: [
          { name: "Deep Sea, Coastal, and Great Lakes Water Transportation", code: "4831" },
          { name: "Inland Water Transportation", code: "4832" },
        ]
      },
      { name: "Truck Transportation", code: "484", industries: [
          { name: "General Freight Trucking", code: "4841" },
          { name: "Specialized Freight Trucking", code: "4842" },
        ]
      },
      { name: "Transit and Ground Passenger Transportation", code: "485", industries: [
          { name: "Urban Transit Systems", code: "4851" },
          { name: "Taxi and Limousine Service", code: "4853" },
          { name: "School and Employee Bus Transportation", code: "4854" },
        ]
      },
      { name: "Pipeline Transportation", code: "486", industries: [
          { name: "Pipeline Transportation of Crude Oil", code: "4861" },
          { name: "Pipeline Transportation of Natural Gas", code: "4862" },
        ]
      },
      { name: "Scenic and Sightseeing Transportation", code: "487", industries: [
          { name: "Scenic and Sightseeing Transportation, Land", code: "4871" },
          { name: "Scenic and Sightseeing Transportation, Water", code: "4872" },
        ]
      },
      { name: "Support Activities for Transportation", code: "488", industries: [
          { name: "Support Activities for Air Transportation", code: "4881" },
          { name: "Support Activities for Rail Transportation", code: "4882" },
          { name: "Support Activities for Water Transportation", code: "4883" },
        ]
      },
      { name: "Couriers and Messengers", code: "492", industries: [
          { name: "Couriers and Express Delivery Services", code: "4921" },
        ]
      },
      { name: "Warehousing and Storage", code: "493", industries: [
          { name: "General Warehousing and Storage", code: "493110" },
          { name: "Refrigerated Warehousing and Storage", code: "493120" },
        ]
      },
    ],
  },
  {
    name: "Information",
    code: "51",
    description: "Producing and distributing information and cultural products, providing the means to transmit or distribute these products, and processing data.",
    subSectors: [
      { name: "Publishing Industries (except Internet)", code: "513", // NAICS 2022 code
        industries: [
          { name: "Newspaper, Periodical, Book, and Directory Publishers", code: "5131" },
          { name: "Software Publishers", code: "513210" },
        ]
      },
      { name: "Motion Picture and Sound Recording Industries", code: "512", industries: [
          { name: "Motion Picture and Video Industries", code: "5121" },
          { name: "Sound Recording Industries", code: "5122" },
        ]
      },
      { name: "Broadcasting and Content Providers", code: "516", // NAICS 2022 code
        industries: [
          { name: "Radio and Television Broadcasting Stations", code: "5161" },
          { name: "Content Providers, Web Search Portals, and Data Processing Services", code: "5162" },
        ]
      },
      { name: "Telecommunications", code: "517", industries: [
          { name: "Wired and Wireless Telecommunications Carriers (except Satellite)", code: "5171" },
          { name: "Satellite Telecommunications", code: "517410" }, // More specific in 2022
          { name: "Other Telecommunications", code: "5179" }, // Group for things like resellers
        ]
      },
    ],
  },
  {
    name: "Finance and Insurance",
    code: "52",
    description: "Transactions involving the creation, liquidation, or change in ownership of financial assets and/or facilitating financial transactions.",
    subSectors: [
      { name: "Monetary Authorities - Central Bank", code: "521", industries: [
          { name: "Monetary Authorities - Central Bank", code: "521110" }
        ]
      },
      { name: "Credit Intermediation and Related Activities", code: "522", industries: [
          { name: "Depository Credit Intermediation (Commercial Banking)", code: "5221" },
          { name: "Nondepository Credit Intermediation", code: "5222" },
          { name: "Activities Related to Credit Intermediation", code: "5223" },
        ]
      },
      { name: "Securities, Commodity Contracts, and Other Financial Investments and Related Activities", code: "523", industries: [
          { name: "Securities and Commodity Contracts Intermediation and Brokerage", code: "5231" },
          { name: "Securities and Commodity Exchanges", code: "523210" },
          { name: "Other Financial Investment Activities", code: "5239" },
        ]
      },
      { name: "Insurance Carriers and Related Activities", code: "524", industries: [
          { name: "Insurance Carriers", code: "5241" },
          { name: "Agencies, Brokerages, and Other Insurance Related Activities", code: "5242" },
        ]
      },
      { name: "Funds, Trusts, and Other Financial Vehicles", code: "525", industries: [
          { name: "Pension Funds", code: "525110" },
          { name: "Health and Welfare Funds", code: "525120" },
          { name: "Other Investment Pools and Funds", code: "525990" }, // Includes trusts, estates
        ]
      },
    ],
  },
  {
    name: "Real Estate and Rental and Leasing",
    code: "53",
    description: "Renting, leasing, or otherwise allowing the use of tangible or intangible assets, and providing related services.",
    subSectors: [
      { name: "Real Estate", code: "531", industries: [
          { name: "Lessors of Real Estate", code: "5311" },
          { name: "Offices of Real Estate Agents and Brokers", code: "531210" },
          { name: "Activities Related to Real Estate", code: "5313" },
        ]
      },
      { name: "Rental and Leasing Services", code: "532", industries: [
          { name: "Automotive Equipment Rental and Leasing", code: "5321" },
          { name: "Consumer Goods Rental", code: "5322" },
          { name: "General Rental Centers", code: "532310" },
          { name: "Commercial and Industrial Machinery and Equipment Rental and Leasing", code: "5324" },
        ]
      },
      { name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533", industries: [
          { name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533110" }
        ]
      },
    ],
  },
  {
    name: "Professional, Scientific, and Technical Services",
    code: "54",
    description: "Performing professional, scientific, and technical activities for others.",
    subSectors: [
      { name: "Legal Services", code: "5411", industries: [
          { name: "Offices of Lawyers", code: "541110" },
          { name: "Other Legal Services", code: "54119" }, // e.g., paralegal, notary
        ]
      },
      { name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "5412", industries: [
          { name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "54121" }, // Group
        ]
      },
      { name: "Architectural, Engineering, and Related Services", code: "5413", industries: [
          { name: "Architectural Services", code: "541310" },
          { name: "Engineering Services", code: "541330" },
          { name: "Surveying and Mapping (except Geophysical) Services", code: "541370" },
        ]
      },
      { name: "Specialized Design Services", code: "5414", industries: [
          { name: "Interior Design Services", code: "541410" },
          { name: "Graphic Design Services", code: "541430" },
          { name: "Other Specialized Design Services", code: "541490" },
        ]
      },
      { name: "Computer Systems Design and Related Services", code: "5415", industries: [
          { name: "Computer Systems Design and Related Services", code: "54151" }, // Group
        ]
      },
      { name: "Management, Scientific, and Technical Consulting Services", code: "5416", industries: [
          { name: "Management Consulting Services", code: "54161" }, // Group
          { name: "Environmental Consulting Services", code: "541620" },
          { name: "Other Scientific and Technical Consulting Services", code: "541690" },
        ]
      },
      { name: "Scientific Research and Development Services", code: "5417", industries: [
          { name: "Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology)", code: "54171" }, // Group
          { name: "Research and Development in Biotechnology (except Nanobiotechnology)", code: "541713" }, // NAICS 2022
          { name: "Research and Development in Nanotechnology", code: "541716"}, // NAICS 2022
        ]
      },
      { name: "Advertising, Public Relations, and Related Services", code: "5418", industries: [
          { name: "Advertising Agencies", code: "541810" },
          { name: "Public Relations Agencies", code: "541820" },
          { name: "Media Buying Agencies", code: "541830" },
          { name: "Other Services Related to Advertising", code: "541890" },
        ]
      },
      { name: "Other Professional, Scientific, and Technical Services", code: "5419", industries: [
          { name: "Photographic Services", code: "54192" }, // Group
          { name: "Translation and Interpretation Services", code: "541930" },
          { name: "Veterinary Services", code: "541940" },
          { name: "All Other Professional, Scientific, and Technical Services", code: "541990" },
        ]
      },
    ],
  },
  {
    name: "Management of Companies and Enterprises",
    code: "55",
    description: "Holding the securities of companies and enterprises for the purpose of owning a controlling interest or influencing management decisions.",
    subSectors: [
      { name: "Management of Companies and Enterprises", code: "551", industries: [
          { name: "Offices of Bank Holding Companies", code: "551111" },
          { name: "Offices of Other Holding Companies", code: "551112" },
          { name: "Corporate, Subsidiary, and Regional Managing Offices", code: "551114" },
        ]
      },
    ],
  },
  {
    name: "Administrative and Support and Waste Management and Remediation Services",
    code: "56",
    description: "Performing routine support activities for the day-to-day operations of other organizations or managing waste.",
    subSectors: [
      {
        name: "Administrative and Support Services",
        code: "561",
        description: "Providing routine support activities for the day-to-day operations of other organizations.",
        industries: [
          { name: "Office Administrative Services", code: "561110" },
          { name: "Facilities Support Services", code: "561210" },
          { name: "Employment Services", code: "5613" }, // Group
          { name: "Business Support Services", code: "5614" }, // Group
          { name: "Travel Arrangement and Reservation Services", code: "5615" }, // Group
          { name: "Investigation and Security Services", code: "5616" }, // Group
          { name: "Services to Buildings and Dwellings", code: "5617" }, // Group
          { name: "Other Support Services", code: "5619" }, // Group
        ],
      },
      {
        name: "Waste Management and Remediation Services",
        code: "562",
        description: "Collection, treatment, and disposal of waste materials.",
        industries: [
          { name: "Waste Collection", code: "5621" }, // Group
          { name: "Waste Treatment and Disposal", code: "5622" }, // Group
          { name: "Remediation and Other Waste Management Services", code: "5629" }, // Group
        ],
      },
    ],
  },
  {
    name: "Educational Services",
    code: "61",
    description: "Providing instruction and training in a wide variety of subjects.",
    subSectors: [
      { name: "Elementary and Secondary Schools", code: "6111", industries: [
          { name: "Elementary and Secondary Schools", code: "611110" },
        ]
      },
      { name: "Junior Colleges", code: "6112", industries: [
          { name: "Junior Colleges", code: "611210" },
        ]
      },
      { name: "Colleges, Universities, and Professional Schools", code: "6113", industries: [
          { name: "Colleges, Universities, and Professional Schools", code: "611310" },
        ]
      },
      { name: "Business Schools and Computer and Management Training", code: "6114", industries: [
          { name: "Business and Secretarial Schools", code: "611410" },
          { name: "Computer Training", code: "611420" },
          { name: "Professional and Management Development Training", code: "611430" },
        ]
      },
      { name: "Technical and Trade Schools", code: "6115", industries: [
          { name: "Cosmetology and Barber Schools", code: "611511" },
          { name: "Flight Training", code: "611512" },
          { name: "Apprenticeship Training", code: "611513" },
          { name: "Other Technical and Trade Schools", code: "611519" },
        ]
      },
      { name: "Other Schools and Instruction", code: "6116", industries: [
          { name: "Fine Arts Schools", code: "611610" },
          { name: "Sports and Recreation Instruction", code: "611620" },
          { name: "Language Schools", code: "611630" },
          { name: "Exam Preparation and Tutoring", code: "611691" }, // NAICS 2022
          { name: "All Other Schools and Instruction", code: "611699" },
        ]
      },
      { name: "Educational Support Services", code: "6117", industries: [
          { name: "Educational Support Services", code: "611710" },
        ]
      },
    ],
  },
  {
    name: "Health Care and Social Assistance",
    code: "62",
    description: "Providing health care and social assistance for individuals.",
    subSectors: [
      { name: "Ambulatory Health Care Services", code: "621", industries: [
          { name: "Offices of Physicians", code: "6211" }, // Group
          { name: "Offices of Dentists", code: "621210" },
          { name: "Offices of Other Health Practitioners", code: "6213" }, // Group
          { name: "Outpatient Care Centers", code: "6214" }, // Group
          { name: "Medical and Diagnostic Laboratories", code: "6215" }, // Group
          { name: "Home Health Care Services", code: "621610" },
          { name: "Other Ambulatory Health Care Services", code: "6219" }, // Group
        ]
      },
      { name: "Hospitals", code: "622", industries: [
          { name: "General Medical and Surgical Hospitals", code: "6221" }, // Group
          { name: "Psychiatric and Substance Abuse Hospitals", code: "6222" }, // Group
          { name: "Specialty (except Psychiatric and Substance Abuse) Hospitals", code: "6223" }, // Group
        ]
      },
      { name: "Nursing and Residential Care Facilities", code: "623", industries: [
          { name: "Nursing Care Facilities (Skilled Nursing Facilities)", code: "6231" }, // Group
          { name: "Residential Intellectual and Developmental Disability, Mental Health, and Substance Abuse Facilities", code: "6232" }, // Group
          { name: "Continuing Care Retirement Communities and Assisted Living Facilities for the Elderly", code: "6233" }, // Group
          { name: "Other Residential Care Facilities", code: "6239" }, // Group
        ]
      },
      { name: "Social Assistance", code: "624", industries: [
          { name: "Individual and Family Services", code: "6241" }, // Group
          { name: "Community Food and Housing, and Emergency and Other Relief Services", code: "6242" }, // Group
          { name: "Vocational Rehabilitation Services", code: "624310" },
          { name: "Child Care Services", code: "6244" }, // Group
        ]
      },
    ],
  },
  {
    name: "Arts, Entertainment, and Recreation",
    code: "71",
    description: "Operating facilities or providing services to meet varied cultural, entertainment, and recreational interests of their patrons.",
    subSectors: [
      { name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [
          { name: "Performing Arts Companies", code: "7111" },
          { name: "Spectator Sports", code: "7112" },
          { name: "Promoters of Performing Arts, Sports, and Similar Events", code: "7113" },
          { name: "Agents and Managers for Artists, Athletes, Entertainers, and Other Public Figures", code: "7114" },
          { name: "Independent Artists, Writers, and Performers", code: "7115" },
        ]
      },
      { name: "Museums, Historical Sites, and Similar Institutions", code: "712", industries: [
          { name: "Museums", code: "712110" },
          { name: "Historical Sites", code: "712120" },
          { name: "Zoos and Botanical Gardens", code: "712130" },
          { name: "Nature Parks and Other Similar Institutions", code: "712190" },
        ]
      },
      { name: "Amusement, Gambling, and Recreation Industries", code: "713", industries: [
          { name: "Amusement Parks and Arcades", code: "7131" },
          { name: "Gambling Industries", code: "7132" },
          { name: "Other Amusement and Recreation Industries", code: "7139" }, // (e.g., golf courses, skiing facilities, marinas, fitness centers)
        ]
      },
    ],
  },
  {
    name: "Accommodation and Food Services",
    code: "72",
    description: "Providing customers with lodging and/or preparing meals, snacks, and beverages for immediate consumption.",
    subSectors: [
      { name: "Accommodation", code: "721", industries: [
          { name: "Traveler Accommodation", code: "7211" }, // Hotels, Motels, B&Bs
          { name: "RV (Recreational Vehicle) Parks and Recreational Camps", code: "7212" },
          { name: "Rooming and Boarding Houses, Dormitories, and Workers' Camps", code: "7213" },
        ]
      },
      { name: "Food Services and Drinking Places", code: "722", industries: [
          { name: "Full-Service Restaurants", code: "722511" },
          { name: "Limited-Service Restaurants", code: "722513" }, // Fast food, cafeterias
          { name: "Special Food Services", code: "7223" }, // Caterers, food service contractors
          { name: "Drinking Places (Alcoholic Beverages)", code: "7224" },
        ]
      },
    ],
  },
  {
    name: "Other Services (except Public Administration)",
    code: "81",
    description: "Providing services not elsewhere classified.",
    subSectors: [
      { name: "Repair and Maintenance", code: "811", industries: [
          { name: "Automotive Repair and Maintenance", code: "8111" },
          { name: "Electronic and Precision Equipment Repair and Maintenance", code: "8112" },
          { name: "Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance", code: "8113" },
          { name: "Personal and Household Goods Repair and Maintenance", code: "8114" },
        ]
      },
      { name: "Personal and Laundry Services", code: "812", industries: [
          { name: "Personal Care Services", code: "8121" }, // Hair, nail, skin care
          { name: "Death Care Services", code: "8122" },
          { name: "Drycleaning and Laundry Services", code: "8123" },
          { name: "Other Personal Services", code: "8129" }, // Pet care, photofinishing
        ]
      },
      { name: "Religious, Grantmaking, Civic, Professional, and Similar Organizations", code: "813", industries: [
          { name: "Religious Organizations", code: "8131" },
          { name: "Grantmaking and Giving Services", code: "8132" },
          { name: "Social Advocacy Organizations", code: "8133" },
          { name: "Civic and Social Organizations", code: "8134" },
          { name: "Business, Professional, Labor, Political, and Similar Organizations", code: "8139" },
        ]
      },
      { name: "Private Households", code: "814", industries: [
          { name: "Private Households", code: "814110" },
        ]
      },
    ],
  },
  {
    name: "Public Administration",
    code: "92",
    description: "Activities of a governmental nature, that is, the enactment and judicial interpretation of laws and their pursuant regulations, and the administration of programs based on them.",
    subSectors: [
      { name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [
        { name: "Executive Offices", code: "921110"},
        { name: "Legislative Bodies", code: "921120"},
        { name: "Public Finance Activities", code: "921130"},
      ]},
      { name: "Justice, Public Order, and Safety Activities", code: "922", industries: [
        { name: "Courts", code: "922110"},
        { name: "Police Protection", code: "922120"},
        { name: "Correctional Institutions", code: "922140"},
      ]},
      { name: "Administration of Human Resource Programs", code: "923", industries: [
        { name: "Administration of Education Programs", code: "923110"},
        { name: "Administration of Public Health Programs", code: "923120"},
      ]},
      { name: "Administration of Environmental Quality Programs", code: "924", industries: [
        { name: "Administration of Air and Water Resource and Solid Waste Management Programs", code: "924110"},
      ]},
      { name: "Administration of Economic Programs", code: "926", industries: [ // NAICS 2022 also includes 925: Space Research and Technology
        { name: "Administration of General Economic Programs", code: "926110"},
      ]},
      { name: "National Security and International Affairs", code: "928", industries: [
        { name: "National Security", code: "928110"},
        { name: "International Affairs", code: "928120"},
      ]},
    ],
  },
];


const getInitials = (nameOrEmail: string | null | undefined): string => {
  if (!nameOrEmail) return '?';
  let nameToProcess = nameOrEmail;

  if (nameOrEmail.startsWith('@')) {
    nameToProcess = nameOrEmail.substring(1);
  }

  const pseudonymRegex = /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{3}$/;
  if (pseudonymRegex.test(nameToProcess)) {
    const match = nameToProcess.match(/^([A-Z])[a-z]+([A-Z])/);
    if (match && match[1] && match[2]) return match[1] + match[2];
    if (match && match[1]) return match[1];
  }

  const parts = nameToProcess.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1 && parts[0].length > 0) return parts[0].charAt(0).toUpperCase();
  if (parts.length > 1 && parts[0].length > 0 && parts[parts.length - 1].length > 0) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  if (parts[0].length > 0) return parts[0].charAt(0).toUpperCase(); // Fallback for names like " Company"
  return '?';
};


export default function MainLayout({
  children
}: {
  children: React.ReactNode
}) {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // This effect will run when the component mounts and when `pathname` changes.
    // We close the dialog if the pathname changes, indicating navigation.
    setIsCreatePostOpen(false);
  }, [pathname]);


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
    mutationFn: async (newPostDataWithImage: NewPostData & {
      imageFile?: File | null | undefined;mentionedUserIds?: string[]
    }) => {
      if (!user) {
        throw new Error("User not authenticated to create post.");
      }
      let uploadedImageUrls: string[] = [];
      if (newPostDataWithImage.imageFile) {
        console.log("[MainLayout] Attempting to upload image:", newPostDataWithImage.imageFile.name);
        try {
          const singleUploadedUrl = await uploadPostImage(newPostDataWithImage.imageFile, user.uid);
          console.log("[MainLayout] Image uploaded successfully, URL:", singleUploadedUrl);
          if (!singleUploadedUrl) {
            console.error("[MainLayout] uploadPostImage returned null/undefined without throwing an error.");
            throw new Error("Image upload succeeded but returned no URL.");
          }
          uploadedImageUrls.push(singleUploadedUrl);
        } catch (uploadError) {
          console.error("[MainLayout] Image upload failed in mutationFn:", uploadError);
          throw uploadError;
        }
      } else {
        console.log("[MainLayout] No image file to upload.");
      }

      // Ensure imageUrls is always an array, even if empty.
      const finalImageUrls = uploadedImageUrls.length > 0 ? uploadedImageUrls : [];

      const {
        imageFile,
        ...postDataForFirestore
      } = newPostDataWithImage;
      postDataForFirestore.imageUrls = finalImageUrls; // Assign the processed array
      postDataForFirestore.mentionedUserIds = newPostDataWithImage.mentionedUserIds || [];
      console.log("[MainLayout] Data for Firestore (addPostMutation):", JSON.stringify(postDataForFirestore, null, 2));
      return addPostToFirestore(postDataForFirestore as NewPostData);
    },
    onSuccess: (newlyCreatedPostId, variables) => {
      console.log("[MainLayout] addPostMutation onSuccess. Newly created Post ID:", newlyCreatedPostId, "Variables:", variables);
      queryClient.invalidateQueries({
        queryKey: ['posts']
      });
      queryClient.invalidateQueries({
        queryKey: ['userPosts']
      });
      queryClient.invalidateQueries({
        queryKey: ['allPostsForSectorPage']
      });
      toast({
        title: "Post Created",
        description: "Your post has been added to the board.",
      });
      setIsCreatePostOpen(false);

      if (user && newlyCreatedPostId && variables.mentionedUserIds && variables.mentionedUserIds.length > 0) {
        console.log(`[MainLayout] Post created, triggering notifications for ${variables.mentionedUserIds.length} mentions.`);
        variables.mentionedUserIds.forEach(async (mentionedUid) => {
          if (mentionedUid !== user.uid) {
            try {
              await createNotification({
                userId: mentionedUid,
                type: 'mention',
                senderId: user.uid,
                postId: newlyCreatedPostId,
                postQuestion: variables.question,
                textSnippet: variables.description ? variables.description.substring(0, 100) : "Check out this new post!",
              });
              console.log(`[MainLayout] Notification created for mentioned user ${mentionedUid} in post ${newlyCreatedPostId}`);
            } catch (notifyError) {
              console.error(`[MainLayout] Failed to create notification for mentioned user ${mentionedUid} in post ${newlyCreatedPostId}:`, notifyError);
            }
          }
        });
      }
    },
    onError: (error: Error, variables) => {
      console.error("[MainLayout] addPostMutation onError. Error:", error, "Variables:", variables);
      toast({
        variant: "destructive",
        title: "Post Failed",
        description: `Could not add your post: ${error.message}. Check console and Firestore rules.`,
      });
      // Do not close dialog on error, user might want to retry or fix input
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

    const mainSectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
    const subSectorDetails = mainSectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
    const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

    const newPostDataForService: NewPostData & {
      imageFile?: File | null;mentionedUserIds?: string[]
    } = {
      question: formData.question,
      description: formData.description,
      tags: formData.tags || [],
      sector: mainSectorDetails?.name || formData.sector,
      subSector: subSectorDetails?.name || formData.subSector,
      industry: industryDetails?.name || formData.industry,
      naicsCode: formData.industry || formData.subSector || formData.sector,
      userId: user.uid,
      businessType: "Startup", // Example, consider making this a form field
      safetyIndicator: "Medium", // Example, consider making this a form field
      ratingScore: Math.floor(Math.random() * 3) + 3, // Example random score
      imageFile: formData.imageFile,
      imageUrls: [], // Will be populated by the mutation if imageFile exists
      mentionedUserIds: formData.mentionedUserIds || [],
    };

    console.log("[MainLayout] Calling addPostMutation.mutate with:", newPostDataForService);
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
                   <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl p-0">
                     <DialogHeader className="p-6 pb-4 border-b">
                       <DialogTitle>Create a New Post</DialogTitle>
                       <DialogDescription>
                         Share your question or need with the community. Keep it anonymous.
                       </DialogDescription>
                     </DialogHeader>
                     <div className="p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
                        {isCreatePostOpen && (
                            <CreatePostForm
                               onSubmit={handleAddPost}
                               availableTags={availableTags}
                               detailedSectorsData={detailedSectorsData}
                               isSubmitting={addPostMutation.isPending}
                               currentUserId={user.uid}
                            />
                        )}
                     </div>
                  </DialogContent>
                </Dialog>
             )}

            {user ? (
              <div className="flex items-center gap-2">
                {user.uid && <NotificationDropdown userId={user.uid} />}
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
                      <Link href={`/profile/${user.uid}`} className="w-full cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild className={cn("cursor-pointer w-full", pathname === "/subscription" && "bg-accent text-accent-foreground")}>
                       <Link href="/subscription" className="w-full cursor-pointer">
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Subscription</span>
                      </Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild className={cn("cursor-pointer w-full", pathname.startsWith("/settings") && "bg-accent text-accent-foreground")}>
                       <Link href="/settings/profile" className="w-full cursor-pointer">
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
