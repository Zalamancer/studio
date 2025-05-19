
// src/components/layout/MainLayout.tsx
"use client";

import React, { useState, useEffect } from 'react'; // Added useEffect
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
} from "@/components/ui/dropdown-menu"; // Import Dropdown components
import { Home, Compass, Network, FileText, LogOut, PlusCircle, UserCircle, CreditCard, Settings, User, Bell } from "lucide-react"; // Changed LineChart to Compass
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { CreatePostForm, type CreatePostFormData } from '@/components/CreatePostForm';
import type { NewPostData } from '@/types/post';
import { addPostToFirestore } from '@/services/postService';
import { uploadPostImage } from '@/services/storageService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { createNotification } from '@/services/notificationService';
import { generateAnonymousName } from '@/lib/pseudonymUtils';

const navItems = [
  { title: "Board", href: "/", icon: Home },
  { title: "Discover", href: "/discover", icon: Compass },
  { title: "Connect", href: "/connect", icon: Network },
  { title: "Contracts", href: "/contracts", icon: FileText },
];

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
      { name: "Crop Production", code: "111", description: "Industries in the Crop Production subsector grow crops mainly for food and fiber.", industries: [
          { name: "Oilseed and Grain Farming", code: "1111", description: "Growing oilseed and/or grain crops and/or producing oilseed and grain seeds." },
          { name: "Vegetable and Melon Farming", code: "1112", description: "Growing vegetable and/or melon crops, producing seeds, and growing bedding plants." },
          { name: "Fruit and Tree Nut Farming", code: "1113", description: "Growing fruit and/or tree nut crops." },
          { name: "Greenhouse, Nursery, and Floriculture Production", code: "1114", description: "Growing crops of any kind under cover and/or growing nursery stock and flowers." },
          { name: "Other Crop Farming", code: "1119", description: "Growing other crops, such as tobacco, cotton, sugarcane, hay, sugar beets, peanuts." },
        ]
      },
      { name: "Animal Production and Aquaculture", code: "112", description: "Raising or fattening animals for the sale of animals or animal products and/or raising aquatic plants and animals in controlled environments.", industries: [
          { name: "Cattle Ranching and Farming", code: "1121", description: "Raising cattle, milking dairy cattle, or feeding cattle for fattening." },
          { name: "Hog and Pig Farming", code: "1122", description: "Raising hogs and pigs." },
          { name: "Poultry and Egg Production", code: "1123", description: "Breeding, hatching, and raising poultry for meat or egg production." },
          { name: "Sheep and Goat Farming", code: "1124", description: "Raising sheep, lambs, and goats." },
          { name: "Aquaculture", code: "1125", description: "Farm raising and production of aquatic animals or plants." },
          { name: "Other Animal Production", code: "1129", description: "Raising animals and insects (except cattle, hogs, poultry, sheep, goats, and aquaculture)." },
        ]
      },
      { name: "Forestry and Logging", code: "113", description: "Growing and harvesting timber on a long production cycle.", industries: [
          { name: "Timber Tract Operations", code: "1131", description: "Operation of timber tracts for the purpose of selling standing timber." },
          { name: "Forest Nurseries and Gathering of Forest Products", code: "1132", description: "Growing trees for reforestation and/or gathering forest products." },
          { name: "Logging", code: "1133", description: "Cutting timber, cutting and transporting timber, and producing wood chips in the field." },
        ]
      },
      { name: "Fishing, Hunting and Trapping", code: "114", description: "Harvesting fish and other wild animals from their natural habitats.", industries: [
          { name: "Fishing", code: "1141", description: "Commercial catching or taking of finfish, shellfish, or miscellaneous marine products." },
          { name: "Hunting and Trapping", code: "1142", description: "Commercial hunting and trapping, and operating commercial game preserves." },
        ]
      },
      { name: "Support Activities for Agriculture and Forestry", code: "115", description: "Providing support services that are an essential part of agricultural and forestry production.", industries: [
          { name: "Support Activities for Crop Production", code: "1151", description: "Providing support activities for growing crops." },
          { name: "Support Activities for Animal Production", code: "1152", description: "Performing support activities related to raising livestock." },
          { name: "Support Activities for Forestry", code: "1153", description: "Performing support activities related to forestry." },
        ]
      },
    ],
  },
  {
    name: "Mining, Quarrying, and Oil and Gas Extraction",
    code: "21",
    description: "Extracting naturally occurring mineral solids, liquid minerals, and gases.",
    subSectors: [
      { name: "Oil and Gas Extraction", code: "211", description: "Extracting crude petroleum and natural gas.", industries: [
          { name: "Crude Petroleum Extraction", code: "211120", description: "Extracting crude petroleum." },
          { name: "Natural Gas Extraction", code: "211130", description: "Extracting natural gas." }
        ]
      },
      { name: "Mining (except Oil and Gas)", code: "212", description: "Mining or quarrying metallic and nonmetallic minerals, except fuels.", industries: [
          { name: "Coal Mining", code: "2121", description: "Mining coal." },
          { name: "Metal Ore Mining", code: "2122", description: "Mining metal ores." },
          { name: "Nonmetallic Mineral Mining and Quarrying", code: "2123", description: "Mining or quarrying nonmetallic minerals." },
        ]
      },
      { name: "Support Activities for Mining", code: "213", description: "Providing support services, on a contract or fee basis, for mining, quarrying, and oil and gas extraction operations.", industries: [
          { name: "Support Activities for Oil and Gas Operations", code: "213111", description: "Drilling oil and gas wells and other support for oil and gas operations." },
          { name: "Support Activities for Coal Mining", code: "213113", description: "Performing support services for coal mining." },
          { name: "Support Activities for Metal Mining", code: "213114", description: "Performing support services for metal mining." },
          { name: "Support Activities for Nonmetallic Minerals (except Fuels) Mining", code: "213115", description: "Performing support services for nonmetallic minerals mining." },
        ]
      },
    ],
  },
  {
    name: "Utilities",
    code: "22",
    description: "Generating, transmitting, or distributing electricity, gas, steam, water, and sewage removal.",
    subSectors: [
      { name: "Electric Power Generation, Transmission and Distribution", code: "2211", description: "Generating, transmitting, and/or distributing electric power.", industries: [
          { name: "Hydroelectric Power Generation", code: "221111", description: "Generating electric power using hydroelectric generating units." },
          { name: "Fossil Fuel Electric Power Generation", code: "221112", description: "Generating electric power using fossil fuels." },
          { name: "Nuclear Electric Power Generation", code: "221113", description: "Generating electric power using nuclear reactors." },
          { name: "Other Electric Power Generation", code: "221118", description: "Generating electric power by other means (e.g., solar, wind, geothermal)." }, 
          { name: "Electric Power Transmission, Control, and Distribution", code: "22112", description: "Transmitting, controlling, and distributing electricity." },
        ]
      },
      { name: "Natural Gas Distribution", code: "2212", description: "Distributing natural gas to end users.", industries: [
          { name: "Natural Gas Distribution", code: "221210", description: "Operating natural gas distribution systems." }
        ]
      },
      { name: "Water, Sewage and Other Systems", code: "2213", description: "Operating water, sewage, and other systems.", industries: [
          { name: "Water Supply and Irrigation Systems", code: "221310", description: "Operating water treatment plants and/or water supply systems." },
          { name: "Sewage Treatment Facilities", code: "221320", description: "Operating sewer systems or sewage treatment facilities." },
          { name: "Steam and Air-Conditioning Supply", code: "221330", description: "Providing steam, heated air, or cooled air." },
        ]
      },
    ],
  },
  {
    name: "Construction",
    code: "23",
    description: "Constructing, repairing, and renovating buildings and engineering works.",
    subSectors: [
      { name: "Construction of Buildings", code: "236", description: "Constructing residential and nonresidential buildings.", industries: [
          { name: "Residential Building Construction", code: "2361", description: "Construction or remodeling of single-family and multifamily residential buildings." },
          { name: "Nonresidential Building Construction", code: "2362", description: "Construction or remodeling of industrial, commercial, and institutional buildings." }
        ]
      },
      { name: "Heavy and Civil Engineering Construction", code: "237", description: "Constructing heavy and civil engineering projects.", industries: [
          { name: "Utility System Construction", code: "2371", description: "Construction of water and sewer lines, oil and gas pipelines, power and communication lines." },
          { name: "Land Subdivision", code: "2372", description: "Servicing land and subdividing real property into lots." },
          { name: "Highway, Street, and Bridge Construction", code: "2373", description: "Construction of highways, streets, roads, airport runways, sidewalks, or bridges." },
          { name: "Other Heavy and Civil Engineering Construction", code: "2379", description: "Construction of other heavy projects like marine construction, dams, etc." }
        ]
      },
      { name: "Specialty Trade Contractors", code: "238", description: "Performing specialized activities related to building construction.", industries: [
          { name: "Foundation, Structure, and Building Exterior Contractors", code: "2381", description: "Concrete work, framing, roofing, siding." },
          { name: "Building Equipment Contractors", code: "2382", description: "Plumbing, HVAC, electrical work." },
          { name: "Building Finishing Contractors", code: "2383", description: "Drywall, painting, flooring." },
          { name: "Other Specialty Trade Contractors", code: "2389", description: "Site preparation, demolition, and other specialized trades." }
        ]
      }
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
        ]
      },
      { name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [
          { name: "Beverage Manufacturing", code: "3121" },
          { name: "Tobacco Manufacturing", code: "3122" },
        ]
      },
      { name: "Textile Mills", code: "313", industries: [
          { name: "Fiber, Yarn, and Thread Mills", code: "3131" },
          { name: "Fabric Mills", code: "3132" },
          { name: "Textile and Fabric Finishing and Fabric Coating Mills", code: "3133" }
        ]
      },
      { name: "Textile Product Mills", code: "314", industries: [
          { name: "Textile Furnishings Mills", code: "3141" },
          { name: "Other Textile Product Mills", code: "3149" },
        ]
      },
      { name: "Apparel Manufacturing", code: "315", industries: [
          { name: "Apparel Knitting Mills", code: "3151" },
          { name: "Cut and Sew Apparel Manufacturing", code: "3152" },
          { name: "Apparel Accessories and Other Apparel Manufacturing", code: "3159" }
        ]
      },
      { name: "Leather and Allied Product Manufacturing", code: "316", industries: [
          { name: "Leather and Hide Tanning and Finishing", code: "3161" },
          { name: "Footwear Manufacturing", code: "3162" },
          { name: "Other Leather and Allied Product Manufacturing", code: "3169" }
        ]
      },
      { name: "Wood Product Manufacturing", code: "321", industries: [
          { name: "Sawmills and Wood Preservation", code: "3211" },
          { name: "Veneer, Plywood, and Engineered Wood Product Manufacturing", code: "3212" },
          { name: "Other Wood Product Manufacturing", code: "3219" }
        ]
      },
      { name: "Paper Manufacturing", code: "322", industries: [
          { name: "Pulp, Paper, and Paperboard Mills", code: "3221" },
          { name: "Converted Paper Product Manufacturing", code: "3222" }
        ]
      },
      { name: "Printing and Related Support Activities", code: "323", industries: [
          { name: "Printing", code: "32311" }, 
          { name: "Support Activities for Printing", code: "32312" } 
        ]
      },
      { name: "Petroleum and Coal Products Manufacturing", code: "324", industries: [
          { name: "Petroleum Refineries", code: "32411" }, 
          { name: "Asphalt Paving, Roofing, and Saturated Materials Manufacturing", code: "32412" },
          { name: "Other Petroleum and Coal Products Manufacturing", code: "32419" }
        ]
      },
      { name: "Chemical Manufacturing", code: "325", industries: [
          { name: "Basic Chemical Manufacturing", code: "3251" },
          { name: "Resin, Synthetic Rubber, and Artificial and Synthetic Fibers and Filaments Manufacturing", code: "3252" },
          { name: "Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing", code: "3253" },
          { name: "Pharmaceutical and Medicine Manufacturing", code: "3254" },
          { name: "Paint, Coating, and Adhesive Manufacturing", code: "3255" },
          { name: "Soap, Cleaning Compound, and Toilet Preparation Manufacturing", code: "3256" },
          { name: "Other Chemical Product and Preparation Manufacturing", code: "3259" }
        ]
      },
      { name: "Plastics and Rubber Products Manufacturing", code: "326", industries: [
          { name: "Plastics Product Manufacturing", code: "3261" },
          { name: "Rubber Product Manufacturing", code: "3262" }
        ]
      },
      { name: "Nonmetallic Mineral Product Manufacturing", code: "327", industries: [
          { name: "Clay Product and Refractory Manufacturing", code: "3271" },
          { name: "Glass and Glass Product Manufacturing", code: "3272" },
          { name: "Cement and Concrete Product Manufacturing", code: "3273" },
          { name: "Lime and Gypsum Product Manufacturing", code: "3274" },
          { name: "Other Nonmetallic Mineral Product Manufacturing", code: "3279" }
        ]
      },
      { name: "Primary Metal Manufacturing", code: "331", industries: [
          { name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "3311" },
          { name: "Steel Product Manufacturing from Purchased Steel", code: "3312" },
          { name: "Alumina and Aluminum Production and Processing", code: "3313" },
          { name: "Nonferrous Metal (except Aluminum) Production and Processing", code: "3314" },
          { name: "Foundries", code: "3315" }
        ]
      },
      { name: "Fabricated Metal Product Manufacturing", code: "332", industries: [
          { name: "Forging and Stamping", code: "3321" },
          { name: "Cutlery and Handtool Manufacturing", code: "3322" },
          { name: "Architectural and Structural Metals Manufacturing", code: "3323" },
          { name: "Boiler, Tank, and Shipping Container Manufacturing", code: "3324" },
          { name: "Hardware Manufacturing", code: "3325" },
          { name: "Spring and Wire Product Manufacturing", code: "3326" },
          { name: "Machine Shops; Turned Product; and Screw, Nut, and Bolt Manufacturing", code: "3327" },
          { name: "Coating, Engraving, Heat Treating, and Allied Activities", code: "3328" },
          { name: "Other Fabricated Metal Product Manufacturing", code: "3329" }
        ]
      },
      { name: "Machinery Manufacturing", code: "333", industries: [
          { name: "Agriculture, Construction, and Mining Machinery Manufacturing", code: "3331" },
          { name: "Industrial Machinery Manufacturing", code: "3332" },
          { name: "Commercial and Service Industry Machinery Manufacturing", code: "3333" },
          { name: "Ventilation, Heating, Air-Conditioning, and Commercial Refrigeration Equipment Manufacturing", code: "3334" },
          { name: "Metalworking Machinery Manufacturing", code: "3335" },
          { name: "Engine, Turbine, and Power Transmission Equipment Manufacturing", code: "3336" },
          { name: "Other General Purpose Machinery Manufacturing", code: "3339" }
        ]
      },
      { name: "Computer and Electronic Product Manufacturing", code: "334", industries: [
          { name: "Computer and Peripheral Equipment Manufacturing", code: "3341" },
          { name: "Communications Equipment Manufacturing", code: "3342" },
          { name: "Audio and Video Equipment Manufacturing", code: "3343" },
          { name: "Semiconductor and Other Electronic Component Manufacturing", code: "3344" },
          { name: "Navigational, Measuring, Electromedical, and Control Instruments Manufacturing", code: "3345" },
          { name: "Manufacturing and Reproducing Magnetic and Optical Media", code: "3346" }
        ]
      },
      { name: "Electrical Equipment, Appliance, and Component Manufacturing", code: "335", industries: [
          { name: "Electric Lighting Equipment Manufacturing", code: "3351" },
          { name: "Household Appliance Manufacturing", code: "3352" },
          { name: "Electrical Equipment Manufacturing", code: "3353" },
          { name: "Other Electrical Equipment and Component Manufacturing", code: "3359" }
        ]
      },
      { name: "Transportation Equipment Manufacturing", code: "336", industries: [
          { name: "Motor Vehicle Manufacturing", code: "3361" },
          { name: "Motor Vehicle Body and Trailer Manufacturing", code: "3362" },
          { name: "Motor Vehicle Parts Manufacturing", code: "3363" },
          { name: "Aerospace Product and Parts Manufacturing", code: "3364" },
          { name: "Railroad Rolling Stock Manufacturing", code: "3365" },
          { name: "Ship and Boat Building", code: "3366" },
          { name: "Other Transportation Equipment Manufacturing", code: "3369" }
        ]
      },
      { name: "Furniture and Related Product Manufacturing", code: "337", industries: [
          { name: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", code: "3371" },
          { name: "Office Furniture (including Fixtures) Manufacturing", code: "3372" },
          { name: "Other Furniture Related Product Manufacturing", code: "3379" }
        ]
      },
      { name: "Miscellaneous Manufacturing", code: "339", industries: [
          { name: "Medical Equipment and Supplies Manufacturing", code: "3391" },
          { name: "Sporting and Athletic Goods Manufacturing", code: "339920" }, 
          { name: "Doll, Toy, and Game Manufacturing", code: "339930" }, 
          { name: "Office Supplies (except Paper) Manufacturing", code: "339940" }, 
          { name: "Sign Manufacturing", code: "339950" }, 
          { name: "All Other Miscellaneous Manufacturing", code: "339990" } 
        ]
      },
    ],
  },
  {
    name: "Wholesale Trade",
    code: "42",
    description: "Wholesaling merchandise, generally without transformation, and providing services incidental to the sale of merchandise.",
    subSectors: [
      { name: "Merchant Wholesalers, Durable Goods", code: "423", description: "Wholesaling durable goods.", industries: [
          { name: "Motor Vehicle and Motor Vehicle Parts and Supplies Merchant Wholesalers", code: "4231", description: "Wholesaling motor vehicles, parts, and supplies." },
          { name: "Furniture and Home Furnishing Merchant Wholesalers", code: "4232", description: "Wholesaling furniture and home furnishings." },
          { name: "Lumber and Other Construction Materials Merchant Wholesalers", code: "4233", description: "Wholesaling lumber and other construction materials." },
          { name: "Professional and Commercial Equipment and Supplies Merchant Wholesalers", code: "4234", description: "Wholesaling professional and commercial equipment." },
          { name: "Metal and Mineral (except Petroleum) Merchant Wholesalers", code: "4235", description: "Wholesaling metals and minerals." },
        ]
      },
      { name: "Merchant Wholesalers, Nondurable Goods", code: "424", description: "Wholesaling nondurable goods.", industries: [
          { name: "Paper and Paper Product Merchant Wholesalers", code: "4241", description: "Wholesaling paper and paper products." },
          { name: "Drugs and Druggists' Sundries Merchant Wholesalers", code: "4242", description: "Wholesaling drugs and druggists' sundries." },
          { name: "Apparel, Piece Goods, and Notions Merchant Wholesalers", code: "4243", description: "Wholesaling apparel and notions." },
          { name: "Grocery and Related Product Merchant Wholesalers", code: "4244", description: "Wholesaling groceries and related products." },
          { name: "Farm Product Raw Material Merchant Wholesalers", code: "4245", description: "Wholesaling farm product raw materials." },
        ]
      },
      { name: "Wholesale Electronic Markets and Agents and Brokers", code: "425", description: "Operating wholesale electronic markets and acting as agents or brokers.", industries: [
          { name: "Business to Business Electronic Markets", code: "425110", description: "Operating B2B electronic markets." },
          { name: "Wholesale Trade Agents and Brokers", code: "425120", description: "Acting as agents or brokers in wholesale trade." }
        ]
      }
    ]
  },
  {
    name: "Retail Trade",
    code: "44-45",
    description: "Retailing merchandise, generally without transformation, and rendering services incidental to the sale of merchandise.",
    subSectors: [
      { name: "Motor Vehicle and Parts Dealers", code: "441", description: "Retailing motor vehicles and parts.", industries: [
          { name: "Automobile Dealers", code: "4411", description: "Retailing new and used automobiles." },
          { name: "Other Motor Vehicle Dealers", code: "4412", description: "Retailing recreational vehicles, motorcycles, boats, etc." },
          { name: "Automotive Parts, Accessories, and Tire Stores", code: "4413", description: "Retailing automotive parts, accessories, and tires." }
        ]
      },
      { name: "Furniture and Home Furnishings Stores", code: "449", description: "Retailing furniture and home furnishings (NAICS 2022 Code for this group).", industries: [ // Note: 442 in 2017, 449 in 2022
          { name: "Furniture Stores", code: "449110", description: "Retailing furniture." }, 
          { name: "Home Furnishings Stores", code: "449120", description: "Retailing home furnishings (e.g., floor coverings, window treatments)." } 
        ]
      },
      { name: "Electronics and Appliance Retailers", code: "449", description: "Retailing electronics and appliances (NAICS 2022 Code for this group).", industries: [ // Note: 443 in 2017, 449 in 2022
          {name: "Electronics and Appliance Retailers", code: "449210", description: "Retailing electronics and appliances."} 
      ]},
      { name: "Building Material and Garden Equipment and Supplies Dealers", code: "444", description: "Retailing building materials and garden equipment.", industries: [
          { name: "Building Material and Supplies Dealers", code: "4441", description: "Retailing building materials and supplies." },
          { name: "Lawn and Garden Equipment and Supplies Stores", code: "4442", description: "Retailing lawn and garden equipment and supplies." }
        ]
      },
      { name: "Food and Beverage Retailers", code: "445", description: "Retailing food and beverages (NAICS 2022 Code).", industries: [
          {name: "Grocery and Convenience Retailers", code: "4451", description: "Retailing groceries and convenience items."},
          {name: "Specialty Food Retailers", code: "4452", description: "Retailing specialty foods."},
          {name: "Beer, Wine, and Liquor Retailers", code: "4453", description: "Retailing alcoholic beverages."}
      ]},
      { name: "Health and Personal Care Retailers", code: "456", description: "Retailing health and personal care products (NAICS 2022 Code).", industries: [ // Note: 446 in 2017, 456 in 2022
          { name: "Pharmacies and Drug Retailers", code: "456110", description: "Retailing prescription and nonprescription drugs."},
          { name: "Cosmetics, Beauty Supplies, and Perfume Retailers", code: "456120", description: "Retailing cosmetics and beauty supplies."}
      ]},
      { name: "Gasoline Stations and Fuel Dealers", code: "457", description: "Retailing automotive fuels (NAICS 2022 Code).", industries: [ // Note: 447 in 2017, 457 in 2022
          {name: "Gasoline Stations with Convenience Stores", code: "457110", description: "Retailing gasoline with convenience stores."},
          {name: "Other Gasoline Stations", code: "457120", description: "Retailing gasoline without convenience stores."}
      ]},
      { name: "Clothing, Clothing Accessories, Shoe, and Jewelry Retailers", code: "458", description: "Retailing clothing, accessories, shoes, and jewelry (NAICS 2022 Code).", industries: [ // Note: 448 in 2017, 458 in 2022
          {name: "Clothing and Clothing Accessories Retailers", code: "4581", description: "Retailing clothing and accessories."},
          {name: "Shoe Retailers", code: "458210", description: "Retailing shoes."},
          {name: "Jewelry, Watch, Precious Stone, and Silverware Retailers", code: "4583", description: "Retailing jewelry, watches, and silverware."}
      ]},
      { name: "Sporting Goods, Hobby, Musical Instrument, Book, and Miscellaneous Retailers", code: "459", description: "Retailing sporting goods, hobby supplies, musical instruments, books, and other miscellaneous items (NAICS 2022 Code).", industries: [ // Note: 451 in 2017, 459 in 2022
          { name: "Sporting Goods Retailers", code: "459110", description: "Retailing sporting goods."},
          { name: "Hobby, Toy, and Game Retailers", code: "459120", description: "Retailing hobby, toy, and game supplies."},
          { name: "Book Retailers", code: "459210", description: "Retailing books."}
      ]},
      { name: "General Merchandise Retailers", code: "455", description: "Retailing a general line of merchandise (NAICS 2022 Code).", industries: [ // Note: 452 in 2017, 455 in 2022
          {name: "Department Stores ", code: "455211", description: "Retailing a wide range of products with departments."},
          {name: "Warehouse Clubs and Supercenters", code: "455212", description: "Retailing a general line of groceries and general merchandise."}
        ]
      },
      { name: "Nonstore Retailers", code: "454", description: "Retailing merchandise using nonstore methods.", industries: [
          { name: "Electronic Shopping and Mail-Order Houses", code: "4541", description: "Retailing via e-commerce and mail order." },
          { name: "Vending Machine Operators", code: "4542", description: "Operating vending machines." },
          { name: "Direct Selling Establishments", code: "4543", description: "Retailing via door-to-door, home parties, etc." }
        ]
      }
    ]
  },
  {
    name: "Transportation and Warehousing",
    code: "48-49",
    description: "Providing transportation of passengers and cargo, warehousing and storing goods, and providing services incidental to transportation.",
    subSectors: [
      { name: "Air Transportation", code: "481", description: "Providing air transportation of passengers and/or cargo.", industries: [
          { name: "Scheduled Air Transportation", code: "4811", description: "Air transportation of passengers or cargo on a scheduled basis." },
          { name: "Nonscheduled Air Transportation", code: "4812", description: "Air transportation of passengers or cargo on a nonscheduled (charter) basis." }
        ]
      },
      { name: "Rail Transportation", code: "482", description: "Providing rail transportation of passengers and/or cargo.", industries: [
          { name: "Rail Transportation", code: "4821", description: "Operating railroads for passenger or cargo transport." }
        ]
      },
      { name: "Water Transportation", code: "483", description: "Providing water transportation of passengers and cargo.", industries: [
          { name: "Deep Sea, Coastal, and Great Lakes Water Transportation", code: "4831", description: "Transportation on deep seas, coastal waters, or Great Lakes." },
          { name: "Inland Water Transportation", code: "4832", description: "Transportation on inland waterways." }
        ]
      },
      { name: "Truck Transportation", code: "484", description: "Providing over-the-road truck transportation of cargo.", industries: [
          { name: "General Freight Trucking", code: "4841", description: "Trucking general freight." },
          { name: "Specialized Freight Trucking", code: "4842", description: "Trucking specialized freight (e.g., hazardous materials, refrigerated goods)." }
        ]
      },
      { name: "Transit and Ground Passenger Transportation", code: "485", description: "Providing transit and ground passenger transportation.", industries: [
          { name: "Urban Transit Systems", code: "4851", description: "Operating urban transit systems." },
          { name: "Taxi and Limousine Service", code: "4853", description: "Providing taxi and limousine services." },
          { name: "School and Employee Bus Transportation", code: "4854", description: "Providing school and employee bus transportation." }
        ]
      },
      { name: "Pipeline Transportation", code: "486", description: "Transporting goods through pipelines.", industries: [
          { name: "Pipeline Transportation of Crude Oil", code: "4861", description: "Transporting crude oil via pipeline." },
          { name: "Pipeline Transportation of Natural Gas", code: "4862", description: "Transporting natural gas via pipeline." }
        ]
      },
      { name: "Scenic and Sightseeing Transportation", code: "487", description: "Providing scenic and sightseeing transportation.", industries: [
          { name: "Scenic and Sightseeing Transportation, Land", code: "4871", description: "Land-based scenic and sightseeing transportation." },
          { name: "Scenic and Sightseeing Transportation, Water", code: "4872", description: "Water-based scenic and sightseeing transportation." }
        ]
      },
      { name: "Support Activities for Transportation", code: "488", description: "Providing services incidental to transportation.", industries: [
          { name: "Support Activities for Air Transportation", code: "4881", description: "Support for air transport (e.g., airports, air traffic control)." },
          { name: "Support Activities for Rail Transportation", code: "4882", description: "Support for rail transport (e.g., rail terminals)." },
          { name: "Support Activities for Water Transportation", code: "4883", description: "Support for water transport (e.g., ports, harbors)." }
        ]
      },
      { name: "Couriers and Messengers", code: "492", description: "Providing courier and messenger services.", industries: [
          { name: "Couriers and Express Delivery Services", code: "4921", description: "Providing courier and express delivery services." },
        ]
      },
      { name: "Warehousing and Storage", code: "493", description: "Operating warehousing and storage facilities.", industries: [
          { name: "General Warehousing and Storage", code: "493110", description: "Operating general merchandise warehousing and storage." }, 
          { name: "Refrigerated Warehousing and Storage", code: "493120", description: "Operating refrigerated warehousing and storage." } 
        ]
      }
    ]
  },
  {
    name: "Information",
    code: "51",
    description: "Producing and distributing information and cultural products, providing the means to transmit or distribute these products, and processing data.",
    subSectors: [
      { name: "Publishing Industries (except Internet)", code: "513", description: "Publishing newspapers, periodicals, books, software, and other works. (NAICS 2022)", industries: [ // Note: 511 in 2017, 513 in 2022
          { name: "Newspaper, Periodical, Book, and Directory Publishers", code: "5131", description: "Publishing newspapers, periodicals, books, and directories." },
          { name: "Software Publishers", code: "513210", description: "Publishing software." } 
        ]
      },
      { name: "Motion Picture and Sound Recording Industries", code: "512", description: "Producing and distributing motion pictures and sound recordings.", industries: [
          { name: "Motion Picture and Video Industries", code: "5121", description: "Producing and/or distributing motion pictures and videos." },
          { name: "Sound Recording Industries", code: "5122", description: "Producing and/or distributing sound recordings." }
        ]
      },
      { name: "Broadcasting and Content Providers", code: "516", description: "Operating radio and television broadcasting stations, and providing content (NAICS 2022).", industries: [ // Note: 515 in 2017, 516 in 2022
          { name: "Radio and Television Broadcasting Stations", code: "5161", description: "Operating radio and television broadcasting stations." }, 
          { name: "Content Providers, Web Search Portals, and Data Processing Services", code: "5162", description: "Providing content, operating web search portals, and data processing services." } 
        ]
      },
      { name: "Telecommunications", code: "517", description: "Operating, maintaining, and/or providing access to facilities for the transmission of voice, data, text, sound, and video.", industries: [
          { name: "Wired and Wireless Telecommunications Carriers (except Satellite)", code: "5171", description: "Operating wired and wireless telecommunications networks (except satellite)." }, 
          { name: "Satellite Telecommunications", code: "5174", description: "Operating satellite telecommunications networks." },
          { name: "Other Telecommunications", code: "5179", description: "Providing other telecommunications services, like VoIP." }
        ]
      }
    ]
  },
  {
    name: "Finance and Insurance",
    code: "52",
    description: "Transactions involving the creation, liquidation, or change in ownership of financial assets and/or facilitating financial transactions.",
    subSectors: [
      { name: "Monetary Authorities - Central Bank", code: "521", description: "Central banking functions.", industries: [
          {name: "Monetary Authorities - Central Bank", code: "521110", description: "Performing central banking functions."}
        ]
      },
      { name: "Credit Intermediation and Related Activities", code: "522", description: "Lending funds raised from depositors or other sources.", industries: [
          { name: "Depository Credit Intermediation (Commercial Banking)", code: "5221", description: "Accepting deposits and making loans." },
          { name: "Nondepository Credit Intermediation", code: "5222", description: "Providing credit without accepting deposits." },
          { name: "Activities Related to Credit Intermediation", code: "5223", description: "Facilitating credit intermediation (e.g., loan brokers)." }
        ]
      },
      { name: "Securities, Commodity Contracts, and Other Financial Investments and Related Activities", code: "523", description: "Underwriting, brokering, or dealing in securities, commodity contracts, and other financial investments.", industries: [
          { name: "Securities and Commodity Contracts Intermediation and Brokerage", code: "5231", description: "Acting as agents/principals in buying/selling securities or commodities." },
          { name: "Securities and Commodity Exchanges", code: "5232", description: "Providing marketplaces for securities and commodities." },
          { name: "Other Financial Investment Activities", code: "5239", description: "Managing portfolios, investment banking, etc." }
        ]
      },
      { name: "Insurance Carriers and Related Activities", code: "524", description: "Underwriting annuities and insurance policies or facilitating such underwriting.", industries: [
          { name: "Insurance Carriers", code: "5241", description: "Underwriting insurance policies (life, health, property, casualty)." },
          { name: "Agencies, Brokerages, and Other Insurance Related Activities", code: "5242", description: "Acting as agents or brokers in selling insurance or providing other insurance-related services." }
        ]
      },
      { name: "Funds, Trusts, and Other Financial Vehicles", code: "525", description: "Pooling collective investments, such as pension funds, health and welfare funds, and trusts.", industries: [
          { name: "Pension Funds", code: "525110", description: "Managing pension funds." },
          { name: "Health and Welfare Funds", code: "525120", description: "Managing health and welfare funds." },
          { name: "Trusts, Estates, and Agency Accounts", code: "5259", description: "Managing trusts, estates, and agency accounts." }
        ]
      }
    ]
  },
  {
    name: "Real Estate and Rental and Leasing",
    code: "53",
    description: "Renting, leasing, or otherwise allowing the use of tangible or intangible assets, and providing related services.",
    subSectors: [
      { name: "Real Estate", code: "531", description: "Acting as lessors, agents, and/or brokers in one or more aspects of the real estate markets.", industries: [
          { name: "Lessors of Real Estate", code: "5311", description: "Renting and leasing residential and nonresidential buildings, miniwarehouses, etc." },
          { name: "Offices of Real Estate Agents and Brokers", code: "5312", description: "Acting as agents or brokers in buying or selling real estate." },
          { name: "Activities Related to Real Estate", code: "5313", description: "Providing real estate appraisal services, property management, etc." }
        ]
      },
      { name: "Rental and Leasing Services", code: "532", description: "Providing tangible assets, such as automobiles, computers, consumer goods, and industrial machinery and equipment, to customers in return for a periodic payment.", industries: [
          { name: "Automotive Equipment Rental and Leasing", code: "5321", description: "Renting or leasing passenger cars, trucks, trailers, etc." },
          { name: "Consumer Goods Rental", code: "5322", description: "Renting consumer goods, such as videos, electronics, and home health equipment." },
          { name: "General Rental Centers", code: "5323", description: "Renting a range of consumer, commercial, and industrial equipment." },
          { name: "Commercial and Industrial Machinery and Equipment Rental and Leasing", code: "5324", description: "Renting or leasing commercial and industrial machinery and equipment." }
        ]
      },
      { name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533", description: "Holding intangible assets such as patents, trademarks, brand names, and/or franchise agreements for the purpose of earning royalties or licensing fees.", industries: [
          { name: "Lessors of Nonfinancial Intangible Assets", code: "5331", description: "Holding and leasing patents, trademarks, and franchise agreements." }
        ]
      }
    ]
  },
  {
    name: "Professional, Scientific, and Technical Services",
    code: "54",
    description: "Performing professional, scientific, and technical activities for others.",
    subSectors: [
      { name: "Legal Services", code: "5411", description: "Providing legal advice and representation.", industries: [
          { name: "Offices of Lawyers", code: "541110", description: "Practicing law." }
        ]
      },
      { name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "5412", description: "Providing accounting, tax, bookkeeping, and payroll services.", industries: [
          { name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "54121", description: "Includes CPA offices, tax preparation, bookkeeping, payroll services." }
        ]
      },
      { name: "Architectural, Engineering, and Related Services", code: "5413", description: "Providing architectural, engineering, and related services.", industries: [
          { name: "Architectural Services", code: "541310", description: "Planning and designing buildings and structures." },
          { name: "Engineering Services", code: "541330", description: "Applying physical laws and principles of engineering." },
          { name: "Surveying and Mapping (except Geophysical) Services", code: "541370", description: "Surveying and mapping land, air, and water." }
        ]
      },
      { name: "Specialized Design Services", code: "5414", description: "Providing specialized design services (except architectural, engineering, and computer systems design).", industries: [
          { name: "Interior Design Services", code: "541410", description: "Planning and designing interior spaces." },
          { name: "Graphic Design Services", code: "541430", description: "Creating visual concepts for communication." }
        ]
      },
      { name: "Computer Systems Design and Related Services", code: "5415", description: "Providing expertise in information technology.", industries: [
          { name: "Computer Systems Design and Related Services", code: "54151", description: "Includes custom software development, IT consulting, and facilities management." }
        ]
      },
      { name: "Management, Scientific, and Technical Consulting Services", code: "5416", description: "Providing management, scientific, and technical advice and assistance.", industries: [
          { name: "Management Consulting Services", code: "54161", description: "Providing advice and assistance on management issues." },
          { name: "Environmental Consulting Services", code: "541620", description: "Providing advice and assistance on environmental issues." }
        ]
      },
      { name: "Scientific Research and Development Services", code: "5417", description: "Engaging in research and experimental development in various sciences.", industries: [
          { name: "Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology)", code: "54171", description: "R&D in physical, engineering, and life sciences." },
        ]
      },
      { name: "Advertising, Public Relations, and Related Services", code: "5418", description: "Creating advertising campaigns and public relations strategies.", industries: [
          { name: "Advertising Agencies", code: "541810", description: "Creating and placing advertising." },
          { name: "Public Relations Agencies", code: "541820", description: "Managing public image and communication." }
        ]
      },
      { name: "Other Professional, Scientific, and Technical Services", code: "5419", description: "Providing various other professional, scientific, and technical services.", industries: [
          { name: "Photographic Services", code: "54192", description: "Providing photographic services." },
          { name: "Translation and Interpretation Services", code: "541930", description: "Translating and interpreting languages." },
          { name: "Veterinary Services", code: "541940", description: "Providing medical care for animals." }
        ]
      }
    ]
  },
  {
    name: "Management of Companies and Enterprises",
    code: "55",
    description: "Holding the securities of companies and enterprises for the purpose of owning a controlling interest or influencing management decisions.",
    subSectors: [
      { name: "Management of Companies and Enterprises", code: "551", description: "Establishments that hold the securities of (or other equity interests in) companies and enterprises for the purpose of owning a controlling interest or influencing management decisions, or establishments (except government establishments) that administer, oversee, and manage establishments of the company or enterprise and that normally undertake the strategic or organizational planning and decision-making role of the company or enterprise.", industries: [
          { name: "Offices of Bank Holding Companies", code: "551111", description: "Holding companies primarily engaged in holding the securities of banks." },
          { name: "Offices of Other Holding Companies", code: "551112", description: "Holding companies (except bank holding) primarily engaged in holding securities of other companies." },
          { name: "Corporate, Subsidiary, and Regional Managing Offices", code: "551114", description: "Managing establishments of the company or enterprise." }
        ]
      }
    ]
  },
  {
    name: "Administrative and Support and Waste Management and Remediation Services",
    code: "56",
    description: "Performing routine support activities for the day-to-day operations of other organizations or managing waste.",
    subSectors: [
        { name: "Administrative and Support Services", code: "561", description: "Providing routine support activities for the day-to-day operations of other organizations.", industries: [
            { name: "Office Administrative Services", code: "5611", description: "Providing day-to-day office administrative services." },
            { name: "Facilities Support Services", code: "5612", description: "Providing facilities support services." },
            { name: "Employment Services", code: "5613", description: "Listing employment vacancies and selecting, referring, and placing applicants." },
            { name: "Business Support Services", code: "5614", description: "Providing business support services like document preparation, call centers." },
            { name: "Travel Arrangement and Reservation Services", code: "5615", description: "Arranging and assembling tours and providing travel reservation services." },
            { name: "Investigation and Security Services", code: "5616", description: "Providing investigation, guard, and armored car services." },
            { name: "Services to Buildings and Dwellings", code: "5617", description: "Providing services to buildings and dwellings like exterminating, janitorial." },
            { name: "Other Support Services", code: "5619", description: "Providing other support services like packaging and labeling." }
        ]},
        { name: "Waste Management and Remediation Services", code: "562", description: "Collection, treatment, and disposal of waste materials.", industries: [
            { name: "Waste Collection", code: "5621", description: "Collecting and hauling nonhazardous or hazardous waste." },
            { name: "Waste Treatment and Disposal", code: "5622", description: "Operating landfills, incinerators, or other waste treatment facilities." },
            { name: "Remediation and Other Waste Management Services", code: "5629", description: "Providing remediation and other waste management services." }
        ]}
    ],
  },
  {
    name: "Educational Services",
    code: "61",
    description: "Providing instruction and training in a wide variety of subjects.",
    subSectors: [
        { name: "Elementary and Secondary Schools", code: "6111", description: "Providing academic instruction at the elementary and secondary school levels.", industries: [
            { name: "Elementary and Secondary Schools", code: "611110", description: "Kindergarten through 12th grade education."}
        ]},
        { name: "Junior Colleges", code: "6112", description: "Providing academic courses and granting associate degrees.", industries: [
            { name: "Junior Colleges", code: "611210", description: "Community colleges and junior colleges."}
        ]},
        { name: "Colleges, Universities, and Professional Schools", code: "6113", description: "Providing academic courses and granting baccalaureate or graduate degrees.", industries: [
            { name: "Colleges, Universities, and Professional Schools", code: "611310", description: "Higher education institutions."}
        ]},
        { name: "Business Schools and Computer and Management Training", code: "6114", description: "Offering courses in business, computer, and management training.", industries: [
            { name: "Business and Secretarial Schools", code: "611410", description: "Training in secretarial and office skills." },
            { name: "Computer Training", code: "611420", description: "Training in computer software and hardware." },
            { name: "Professional and Management Development Training", code: "611430", description: "Training in management and professional development."}
        ]},
        { name: "Technical and Trade Schools", code: "6115", description: "Offering vocational and technical training in a variety of technical subjects and trades.", industries: [
            { name: "Cosmetology and Barber Schools", code: "611511", description: "Training in cosmetology and barbering." },
            { name: "Flight Training", code: "611512", description: "Training for aviation professions." },
            { name: "Apprenticeship Training", code: "611513", description: "Providing formal apprenticeship training programs."}
        ]},
        { name: "Other Schools and Instruction", code: "6116", description: "Offering instruction in fine arts, athletics, languages, and other areas.", industries: [
            { name: "Fine Arts Schools", code: "611610", description: "Instruction in art, drama, and music." },
            { name: "Sports and Recreation Instruction", code: "611620", description: "Instruction in sports and recreation." },
            { name: "Language Schools", code: "611630", description: "Instruction in languages." }
        ]},
        { name: "Educational Support Services", code: "6117", description: "Providing noninstructional services that support educational processes.", industries: [
            { name: "Educational Support Services", code: "611710", description: "Includes educational testing and guidance counseling." }
        ]}
    ],
  },
  {
    name: "Health Care and Social Assistance",
    code: "62",
    description: "Providing health care and social assistance for individuals.",
    subSectors: [
        { name: "Ambulatory Health Care Services", code: "621", description: "Providing health care services directly or indirectly to ambulatory patients.", industries: [
            { name: "Offices of Physicians", code: "6211", description: "Practices of medical doctors." },
            { name: "Offices of Dentists", code: "6212", description: "Practices of dentists." },
            { name: "Offices of Other Health Practitioners", code: "6213", description: "Practices of chiropractors, optometrists, mental health practitioners, etc." },
            { name: "Outpatient Care Centers", code: "6214", description: "Providing outpatient care services." },
            { name: "Medical and Diagnostic Laboratories", code: "6215", description: "Providing laboratory testing services." },
            { name: "Home Health Care Services", code: "6216", description: "Providing health care services at home." }
        ]},
        { name: "Hospitals", code: "622", description: "Providing medical, diagnostic, and treatment services to inpatients.", industries: [
            { name: "General Medical and Surgical Hospitals", code: "6221", description: "General hospitals." },
            { name: "Psychiatric and Substance Abuse Hospitals", code: "6222", description: "Hospitals specializing in mental health and substance abuse." },
            { name: "Specialty (except Psychiatric and Substance Abuse) Hospitals", code: "6223", description: "Specialty hospitals like children's or cancer hospitals." }
        ]},
        { name: "Nursing and Residential Care Facilities", code: "623", description: "Providing residential care combined with either nursing, supervisory, or other types of care.", industries: [
            { name: "Nursing Care Facilities (Skilled Nursing Facilities)", code: "6231", description: "Providing inpatient nursing and rehabilitative services." },
            { name: "Residential Intellectual and Developmental Disability, Mental Health, and Substance Abuse Facilities", code: "6232", description: "Residential care for individuals with disabilities or substance abuse issues." },
            { name: "Continuing Care Retirement Communities and Assisted Living Facilities for the Elderly", code: "6233", description: "Care for the elderly." }
        ]},
        { name: "Social Assistance", code: "624", description: "Providing a wide variety of social assistance services directly to their clients.", industries: [
            { name: "Individual and Family Services", code: "6241", description: "Services for individuals and families, such as counseling, welfare, child protection." },
            { name: "Community Food and Housing, and Emergency and Other Relief Services", code: "6242", description: "Food banks, shelters, and emergency relief." },
            { name: "Vocational Rehabilitation Services", code: "6243", description: "Services to help individuals with employment barriers." },
            { name: "Child Care Services", code: "6244", description: "Providing day care services for children." }
        ]}
    ],
  },
  {
    name: "Arts, Entertainment, and Recreation",
    code: "71",
    description: "Operating facilities or providing services to meet varied cultural, entertainment, and recreational interests of their patrons.",
    subSectors: [
        { name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", description: "Producing or organizing live performances, sports events, and related activities.", industries: [
            { name: "Performing Arts Companies", code: "7111", description: "Theater, dance, music companies." },
            { name: "Spectator Sports", code: "7112", description: "Professional or semiprofessional sports clubs and events." },
            { name: "Promoters of Performing Arts, Sports, and Similar Events", code: "7113", description: "Organizing and promoting live events." },
            { name: "Agents and Managers for Artists, Athletes, Entertainers, and Other Public Figures", code: "7114", description: "Representing talent." },
            { name: "Independent Artists, Writers, and Performers", code: "7115", description: "Individuals primarily engaged in performing or creating artistic works." }
        ]},
        { name: "Museums, Historical Sites, and Similar Institutions", code: "712", description: "Preserving and exhibiting objects, sites, and natural wonders of historical, cultural, and/or educational value.", industries: [
            { name: "Museums", code: "712110", description: "Operating museums of art, history, science, etc." },
            { name: "Historical Sites", code: "712120", description: "Operating historical sites." },
            { name: "Zoos and Botanical Gardens", code: "712130", description: "Operating zoos and botanical gardens." }
        ]},
        { name: "Amusement, Gambling, and Recreation Industries", code: "713", description: "Providing amusement, gambling, and recreation activities.", industries: [
            { name: "Amusement Parks and Arcades", code: "7131", description: "Operating amusement parks, theme parks, and arcades." },
            { name: "Gambling Industries", code: "7132", description: "Operating casinos, lotteries, and other gambling establishments." },
            { name: "Other Amusement and Recreation Industries", code: "7139", description: "Golf courses, fitness centers, bowling alleys, marinas, etc." }
        ]}
    ],
  },
  {
    name: "Accommodation and Food Services",
    code: "72",
    description: "Providing customers with lodging and/or preparing meals, snacks, and beverages for immediate consumption.",
    subSectors: [
        { name: "Accommodation", code: "721", description: "Providing short-term lodging.", industries: [
            { name: "Traveler Accommodation", code: "7211", description: "Hotels, motels, and other lodging for travelers." },
            { name: "RV (Recreational Vehicle) Parks and Recreational Camps", code: "7212", description: "Operating RV parks and campgrounds." },
            { name: "Rooming and Boarding Houses, Dormitories, and Workers' Camps", code: "7213", description: "Providing rooming and boarding houses." }
        ]},
        { name: "Food Services and Drinking Places", code: "722", description: "Preparing meals, snacks, and beverages for immediate consumption.", industries: [
            { name: "Full-Service Restaurants", code: "722511", description: "Restaurants where patrons order and are served while seated." }, // Using 2022 code for FSR
            { name: "Limited-Service Restaurants", code: "722513", description: "Establishments where patrons generally order or select items and pay before eating." }, // Using 2022 code for LSR
            { name: "Cafeterias, Grill Buffets, and Buffets", code: "722514", description: "Self-service or buffet-style eating places." }, // Using 2022 code
            { name: "Snack and Nonalcoholic Beverage Bars", code: "722515", description: "Coffee shops, donut shops, ice cream parlors (primarily for immediate consumption)." }, // Using 2022 code
            { name: "Food Service Contractors", code: "722310", description: "Providing food services at institutional, governmental, commercial, or industrial locations." },
            { name: "Caterers", code: "722320", description: "Providing food services for events." },
            { name: "Mobile Food Services", code: "722330", description: "Preparing and serving food from mobile vehicles." },
            { name: "Drinking Places (Alcoholic Beverages)", code: "7224", description: "Preparing and serving alcoholic beverages for immediate consumption." }
        ]}
    ],
  },
  {
    name: "Other Services (except Public Administration)",
    code: "81",
    description: "Providing services not elsewhere classified.",
    subSectors: [
        { name: "Repair and Maintenance", code: "811", description: "Repairing and maintaining tangible goods.", industries: [
            { name: "Automotive Repair and Maintenance", code: "8111", description: "Repairing and maintaining motor vehicles." },
            { name: "Electronic and Precision Equipment Repair and Maintenance", code: "8112", description: "Repairing electronics and precision equipment." },
            { name: "Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance", code: "8113", description: "Repairing commercial and industrial machinery." },
            { name: "Personal and Household Goods Repair and Maintenance", code: "8114", description: "Repairing appliances, furniture, footwear, etc." }
        ]},
        { name: "Personal and Laundry Services", code: "812", description: "Providing personal care, death care, laundry, and other personal services.", industries: [
            { name: "Personal Care Services", code: "8121", description: "Hair salons, barber shops, nail salons, beauty spas." },
            { name: "Death Care Services", code: "8122", description: "Funeral homes and related services." },
            { name: "Drycleaning and Laundry Services", code: "8123", description: "Laundromats, dry cleaners." },
            { name: "Other Personal Services", code: "8129", description: "Pet care, photofinishing, parking lots." }
        ]},
        { name: "Religious, Grantmaking, Civic, Professional, and Similar Organizations", code: "813", description: "Promoting the interests of their members or a cause.", industries: [
            { name: "Religious Organizations", code: "8131", description: "Churches, temples, mosques, monasteries." },
            { name: "Grantmaking and Giving Services", code: "8132", description: "Foundations, charitable trusts." },
            { name: "Social Advocacy Organizations", code: "8133", description: "Human rights, environmental, wildlife organizations." },
            { name: "Civic and Social Organizations", code: "8134", description: "Community service clubs, scouting organizations." },
            { name: "Business, Professional, Labor, Political, and Similar Organizations", code: "8139", description: "Trade associations, labor unions, political organizations." }
        ]},
        { name: "Private Households", code: "814", description: "Employing people to work in private households.", industries: [
            { name: "Private Households", code: "814110", description: "Private households employing domestic personnel."}
        ]}
    ],
  },
  {
    name: "Public Administration",
    code: "92",
    description: "Activities of a governmental nature, that is, the enactment and judicial interpretation of laws and their pursuant regulations, and the administration of programs based on them.",
    subSectors: [
        { name: "Executive, Legislative, and Other General Government Support", code: "921", description: "Federal, state, and local government executive and legislative offices.", industries: [
            { name: "Executive Offices", code: "921110", description: "Offices of chief executives and their staff." },
            { name: "Legislative Bodies", code: "921120", description: "Senates, houses of representatives, city councils." },
            { name: "Public Finance Activities", code: "921130", description: "Administering public finance, taxation, and monetary policy." }
        ]},
        { name: "Justice, Public Order, and Safety Activities", code: "922", description: "Courts, police, fire protection, correctional institutions.", industries: [
            { name: "Courts", code: "922110", description: "Judicial courts." },
            { name: "Police Protection", code: "922120", description: "Police departments." },
            { name: "Fire Protection", code: "922160", description: "Fire departments." }
        ]},
        { name: "Administration of Human Resource Programs", code: "923", description: "Government agencies administering health, education, and welfare programs.", industries: [
            { name: "Administration of Education Programs", code: "923110", description: "Government agencies managing education." },
            { name: "Administration of Public Health Programs", code: "923120", description: "Government agencies managing public health." }
        ]},
        { name: "Administration of Environmental Quality Programs", code: "924", description: "Government agencies concerned with air and water quality, and solid waste management.", industries: [
            { name: "Administration of Air and Water Resource and Solid Waste Management Programs", code: "924110", description: "Environmental protection agencies." }
        ]},
        { name: "Administration of Economic Programs", code: "926", description: "Government agencies administering programs for economic development.", industries: [
            { name: "Administration of General Economic Programs", code: "926110", description: "Agencies for general economic development." }
        ]},
        { name: "National Security and International Affairs", code: "928", description: "National defense and international relations.", industries: [
            { name: "National Security", code: "928110", description: "Armed forces and defense agencies." },
            { name: "International Affairs", code: "928120", description: "Embassies, consulates, and international affairs agencies." }
        ]}
    ],
  }
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


export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleRouteChange = (url: string, { shallow }: { shallow?: boolean }) => {
      if (!shallow) { 
        setIsCreatePostOpen(false);
      }
    };
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
    mutationFn: async (newPostDataWithImage: NewPostData & { imageFile?: File | null | undefined; mentionedUserIds?: string[] }) => {
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
      const { imageFile, ...postDataForFirestore } = newPostDataWithImage;
      postDataForFirestore.imageUrls = uploadedImageUrls.length > 0 ? uploadedImageUrls : [];
      postDataForFirestore.mentionedUserIds = newPostDataWithImage.mentionedUserIds || [];
      console.log("[MainLayout] Data for Firestore (addPostMutation):", JSON.stringify(postDataForFirestore, null, 2));
      return addPostToFirestore(postDataForFirestore as NewPostData); 
    },
    onSuccess: (newlyCreatedPostId, variables) => { 
      console.log("[MainLayout] addPostMutation onSuccess. Newly created Post ID:", newlyCreatedPostId, "Variables:", variables);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['allPostsForSectorPage']});
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

    const newPostDataForService: NewPostData & { imageFile?: File | null; mentionedUserIds?: string[] } = {
        question: formData.question,
        description: formData.description,
        tags: formData.tags || [],
        sector: mainSectorDetails?.name || formData.sector, 
        subSector: subSectorDetails?.name || formData.subSector, 
        industry: industryDetails?.name || formData.industry, 
        naicsCode: formData.industry || formData.subSector || formData.sector, 
        userId: user.uid,
        businessType: "Startup", 
        safetyIndicator: "Medium", 
        ratingScore: Math.floor(Math.random() * 3) + 3, 
        imageFile: formData.imageFile, 
        imageUrls: [], 
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
