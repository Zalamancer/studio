
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
} from "@/components/ui/dropdown-menu";
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
          { name: "Soybean Farming", code: "111110", description: "Growing soybeans and/or producing soybean seeds." },
          { name: "Oilseed (except Soybean) Farming", code: "111120", description: "Growing fibrous oilseed producing plants and/or producing oilseed seeds, such as sunflower, safflower, flax, rape, canola, and sesame." },
          { name: "Dry Pea and Bean Farming", code: "111130", description: "Growing dry peas, beans, and/or lentils." },
          { name: "Wheat Farming", code: "111140", description: "Growing wheat and/or producing wheat seeds." },
          { name: "Corn Farming", code: "111150", description: "Growing corn (except sweet corn) and/or producing corn seeds." },
          { name: "Rice Farming", code: "111160", description: "Growing rice (except wild rice) and/or producing rice seeds." },
          { name: "Oilseed and Grain Combination Farming", code: "111191", description: "Growing a combination of oilseed(s) and grain(s) with no one oilseed or grain accounting for one-half of the establishment's agricultural production." },
          { name: "All Other Grain Farming", code: "111199", description: "Growing grains and/or producing grain(s) seeds (except wheat, corn, rice, and oilseed/grain combinations)." },
          { name: "Potato Farming", code: "111211", description: "Growing potatoes and/or producing seed potatoes." },
          { name: "Other Vegetable (except Potato) and Melon Farming", code: "111219", description: "Growing melons and/or vegetables (except potatoes, dry peas, dry beans, corn, and sugar beets); producing vegetable/melon seeds; growing vegetable/melon bedding plants." },
          { name: "Orange Groves", code: "111310", description: "Growing oranges." },
          { name: "Citrus (except Orange) Groves", code: "111320", description: "Growing citrus fruits (except oranges)." },
          { name: "Apple Orchards", code: "111331", description: "Growing apples." },
          { name: "Grape Vineyards", code: "111332", description: "Growing grapes and/or growing grapes to sun dry into raisins." },
          { name: "Strawberry Farming", code: "111333", description: "Growing strawberries." },
          { name: "Berry (except Strawberry) Farming", code: "111334", description: "Growing berries (except strawberries)." },
          { name: "Tree Nut Farming", code: "111335", description: "Growing tree nuts." },
          { name: "Fruit and Tree Nut Combination Farming", code: "111336", description: "Growing a combination of fruit(s) and tree nut(s) with no one fruit or family of tree nuts accounting for one-half of the establishment's agricultural production." },
          { name: "Other Noncitrus Fruit Farming", code: "111339", description: "Growing noncitrus fruits (except apples, grapes, berries, and fruit/tree nut combinations)." },
          { name: "Mushroom Production", code: "111411", description: "Growing mushrooms under cover in mines underground, or in other controlled environments." },
          { name: "Other Food Crops Grown Under Cover", code: "111419", description: "Growing food crops (except mushrooms) under glass or protective cover." },
          { name: "Nursery and Tree Production", code: "111421", description: "Growing nursery products, nursery stock, shrubbery, bulbs, fruit stock, sod, and/or short rotation woody trees with a growth and harvest cycle of 10 years or less." },
          { name: "Floriculture Production", code: "111422", description: "Growing and/or producing floriculture products (e.g., cut flowers, potted plants, flower seeds) under cover and in open fields." },
          { name: "Tobacco Farming", code: "111910", description: "Growing tobacco." },
          { name: "Cotton Farming", code: "111920", description: "Growing cotton." },
          { name: "Sugarcane Farming", code: "111930", description: "Growing sugarcane." },
          { name: "Hay Farming", code: "111940", description: "Growing hay, alfalfa, clover, and/or mixed hay." },
          { name: "Sugar Beet Farming", code: "111991", description: "Growing sugar beets." },
          { name: "Peanut Farming", code: "111992", description: "Growing peanuts." },
          { name: "All Other Miscellaneous Crop Farming", code: "111998", description: "Growing crops not elsewhere classified or a combination of miscellaneous crops; gathering tea or maple sap." },
        ]
      },
      { name: "Animal Production and Aquaculture", code: "112", description: "Raising or fattening animals for the sale of animals or animal products and/or raising aquatic plants and animals in controlled environments.", industries: [
          { name: "Beef Cattle Ranching and Farming", code: "112111", description: "Raising cattle (including cattle for dairy herd replacements)." },
          { name: "Cattle Feedlots", code: "112112", description: "Feeding cattle for fattening." },
          { name: "Dairy Cattle and Milk Production", code: "112120", description: "Milking dairy cattle." },
          { name: "Dual-Purpose Cattle Ranching and Farming", code: "112130", description: "Raising cattle for both milking and meat production." },
          { name: "Hog and Pig Farming", code: "112210", description: "Raising hogs and pigs." },
          { name: "Chicken Egg Production", code: "112310", description: "Raising chickens for egg production." },
          { name: "Broilers and Other Meat Type Chicken Production", code: "112320", description: "Raising broilers, fryers, roasters, and other meat type chickens." },
          { name: "Turkey Production", code: "112330", description: "Raising turkeys for meat or egg production." },
          { name: "Poultry Hatcheries", code: "112340", description: "Hatching poultry of any kind." },
          { name: "Other Poultry Production", code: "112390", description: "Raising poultry (except chickens for meat or egg production and turkeys)." },
          { name: "Sheep Farming", code: "112410", description: "Raising sheep and lambs, or feeding lambs for fattening." },
          { name: "Goat Farming", code: "112420", description: "Raising goats." },
          { name: "Finfish Farming and Fish Hatcheries", code: "112511", description: "Farm raising finfish (e.g., catfish, trout) and/or hatching fish of any kind." },
          { name: "Shellfish Farming", code: "112512", description: "Farm raising shellfish (e.g., crayfish, shrimp, oysters)." },
          { name: "Other Aquaculture", code: "112519", description: "Farm raising of aquatic animals (except finfish and shellfish) and/or farm raising of aquatic plants." },
          { name: "Apiculture", code: "112910", description: "Raising bees for honey collection, pollination, or other bee products." },
          { name: "Horses and Other Equine Production", code: "112920", description: "Raising horses, mules, donkeys, and other equines." },
          { name: "Fur-Bearing Animal and Rabbit Production", code: "112930", description: "Raising fur-bearing animals including rabbits." },
          { name: "All Other Animal Production", code: "112990", description: "Raising animals not elsewhere classified or a combination of animals." },
        ]
      },
      { name: "Forestry and Logging", code: "113", description: "Growing and harvesting timber on a long production cycle.", industries: [
          { name: "Timber Tract Operations", code: "113110", description: "Operation of timber tracts for the purpose of selling standing timber." },
          { name: "Forest Nurseries and Gathering of Forest Products", code: "113210", description: "Growing trees for reforestation and/or gathering forest products, such as gums, barks, balsam needles." },
          { name: "Logging", code: "113310", description: "Cutting timber; cutting and transporting timber; producing wood chips in the field." },
        ]
      },
      { name: "Fishing, Hunting and Trapping", code: "114", description: "Harvesting fish and other wild animals from their natural habitats.", industries: [
          { name: "Finfish Fishing", code: "114111", description: "Commercial catching or taking of finfish from their natural habitat." },
          { name: "Shellfish Fishing", code: "114112", description: "Commercial catching or taking of shellfish from their natural habitat." },
          { name: "Other Marine Fishing", code: "114119", description: "Commercial catching or taking of marine animals (except finfish and shellfish)." },
          { name: "Hunting and Trapping", code: "114210", description: "Commercial hunting and trapping; operating commercial game preserves." },
        ]
      },
      { name: "Support Activities for Agriculture and Forestry", code: "115", description: "Providing support services that are an essential part of agricultural and forestry production.", industries: [
          { name: "Cotton Ginning", code: "115111", description: "Ginning cotton." },
          { name: "Soil Preparation, Planting, and Cultivating", code: "115112", description: "Performing soil preparation, planting, cultivating, and crop protecting services." },
          { name: "Crop Harvesting, Primarily by Machine", code: "115113", description: "Mechanical harvesting, picking, and combining of crops." },
          { name: "Postharvest Crop Activities (except Cotton Ginning)", code: "115114", description: "Performing services on crops after harvest to prepare them for market or further processing." },
          { name: "Farm Labor Contractors and Crew Leaders", code: "115115", description: "Supplying labor for agricultural production or harvesting." },
          { name: "Farm Management Services", code: "115116", description: "Providing farm management services on a contract or fee basis." },
          { name: "Support Activities for Animal Production", code: "115210", description: "Performing support activities related to raising livestock." },
          { name: "Support Activities for Forestry", code: "115310", description: "Performing support activities related to forestry." },
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
          { name: "Coal Mining", code: "212110", description: "Mining coal." }, // Specific 6-digit
          { name: "Iron Ore Mining", code: "212210", description: "Mining iron ores." },
          { name: "Copper, Nickel, Lead, and Zinc Mining", code: "212230", description: "Mining copper, nickel, lead, or zinc ores." }, // Broadened from multiple 6-digits
          { name: "Gold and Silver Ore Mining", code: "212220", description: "Mining gold or silver ores." }, // Broadened
          { name: "Other Metal Ore Mining", code: "212290", description: "Mining other metal ores." },
          { name: "Stone Mining and Quarrying", code: "212310", description: "Mining or quarrying dimension stone, crushed and broken stone." }, // Broadened
          { name: "Sand, Gravel, Clay, and Ceramic and Refractory Minerals Mining and Quarrying", code: "212320", description: "Mining or quarrying sand, gravel, clay, or ceramic and refractory minerals." }, // Broadened
          { name: "Other Nonmetallic Mineral Mining and Quarrying", code: "212390", description: "Mining or quarrying other nonmetallic minerals." },
        ]
      },
      { name: "Support Activities for Mining", code: "213", description: "Providing support services, on a contract or fee basis, for mining, quarrying, and oil and gas extraction operations.", industries: [
          { name: "Drilling Oil and Gas Wells", code: "213111", description: "Drilling oil and gas wells for others." },
          { name: "Support Activities for Oil and Gas Operations", code: "213112", description: "Performing other support services for oil and gas operations." },
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
          { name: "Fossil Fuel Electric Power Generation", code: "221112", description: "Generating electric power using fossil fuels (e.g., coal, oil, natural gas)." },
          { name: "Nuclear Electric Power Generation", code: "221113", description: "Generating electric power using nuclear reactors." },
          { name: "Solar Electric Power Generation", code: "221114", description: "Generating electric power using solar energy." },
          { name: "Wind Electric Power Generation", code: "221115", description: "Generating electric power using wind turbines." },
          { name: "Geothermal Electric Power Generation", code: "221116", description: "Generating electric power using geothermal energy." },
          { name: "Biomass Electric Power Generation", code: "221117", description: "Generating electric power using biomass." },
          { name: "Other Electric Power Generation", code: "221118", description: "Generating electric power by other means (e.g., tidal action, batteries)." },
          { name: "Electric Bulk Power Transmission and Control", code: "221121", description: "Operating electric power transmission systems and/or controlling the transmission of electricity from generating stations to distribution centers." },
          { name: "Electric Power Distribution", code: "221122", description: "Operating electric power distribution systems." },
        ]
      },
      { name: "Natural Gas Distribution", code: "2212", description: "Distributing natural gas to end users.", industries: [
          { name: "Natural Gas Distribution", code: "221210", description: "Operating natural gas distribution systems (e.g., mains, meters)." }
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
          { name: "Utility System Construction", code: "2371", description: "Construction of water and sewer lines, oil and gas pipelines, power and communication lines, and related structures." },
          { name: "Land Subdivision", code: "2372", description: "Servicing land and subdividing real property into lots, for subsequent sale to builders." },
          { name: "Highway, Street, and Bridge Construction", code: "2373", description: "Construction of highways (except elevated), streets, roads, airport runways, public sidewalks, or bridges." },
          { name: "Other Heavy and Civil Engineering Construction", code: "2379", description: "Construction of other heavy and civil engineering projects (e.g., marine construction, shaft sinking)." }
        ]
      },
      { name: "Specialty Trade Contractors", code: "238", description: "Performing specialized activities related to building construction.", industries: [
          { name: "Foundation, Structure, and Building Exterior Contractors", code: "2381", description: "Pouring concrete foundations, framing buildings, or other building exterior work." },
          { name: "Building Equipment Contractors", code: "2382", description: "Installing or servicing building equipment such as HVAC, plumbing, and electrical systems." },
          { name: "Building Finishing Contractors", code: "2383", description: "Finishing building interiors, such as drywall, painting, and flooring." },
          { name: "Other Specialty Trade Contractors", code: "2389", description: "Performing other specialized activities such as site preparation or demolition." }
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
          { name: "Resin, Synthetic Rubber, and Artificial and Synthetic Fibers Manufacturing", code: "3252" },
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
  { name: "Wholesale Trade", code: "42", description: "Wholesaling merchandise, generally without transformation, and providing services incidental to the sale of merchandise.",
    subSectors: [
        { name: "Merchant Wholesalers, Durable Goods", code: "423", description: "Wholesaling durable goods.", industries: [
            { name: "Motor Vehicle and Parts Merchant Wholesalers", code: "4231", description: "Wholesaling motor vehicles, parts, and supplies." },
            { name: "Furniture and Home Furnishing Merchant Wholesalers", code: "4232", description: "Wholesaling furniture and home furnishings." },
            { name: "Lumber and Other Construction Materials Merchant Wholesalers", code: "4233", description: "Wholesaling lumber and other construction materials." },
          ]
        },
        { name: "Merchant Wholesalers, Nondurable Goods", code: "424", description: "Wholesaling nondurable goods.", industries: [
            { name: "Paper and Paper Product Merchant Wholesalers", code: "4241", description: "Wholesaling paper and paper products." },
            { name: "Drugs and Druggists' Sundries Merchant Wholesalers", code: "4242", description: "Wholesaling drugs and druggists' sundries." },
            { name: "Grocery and Related Product Merchant Wholesalers", code: "4244", description: "Wholesaling groceries and related products." },
          ]
        },
        { name: "Wholesale Electronic Markets and Agents and Brokers", code: "425", description: "Operating wholesale electronic markets and acting as agents or brokers.", industries: [
            { name: "Business to Business Electronic Markets", code: "425110", description: "Operating B2B electronic markets." },
            { name: "Wholesale Trade Agents and Brokers", code: "425120", description: "Acting as agents or brokers in wholesale trade." }
          ]
        }
      ]
  },
  { name: "Retail Trade", code: "44-45", description: "Retailing merchandise, generally without transformation, and rendering services incidental to the sale of merchandise.",
    subSectors: [
        { name: "Motor Vehicle and Parts Dealers", code: "441", description: "Retailing motor vehicles and parts.", industries: [
            { name: "Automobile Dealers", code: "4411", description: "Retailing new and used automobiles." },
            { name: "Automotive Parts, Accessories, and Tire Stores", code: "4413", description: "Retailing automotive parts, accessories, and tires." }
          ]
        },
        { name: "Furniture and Home Furnishings Stores", code: "449", description: "Retailing furniture and home furnishings.", industries: [ // NAICS 2022 uses 449
            { name: "Furniture Stores", code: "449110", description: "Retailing furniture." },
            { name: "Home Furnishings Stores", code: "449120", description: "Retailing home furnishings (e.g., floor coverings, window treatments)." }
          ]
        },
        { name: "Electronics and Appliance Stores", code: "449", description: "Retailing electronics and appliances.", industries: [ // NAICS 2022 uses 449
            {name: "Electronics and Appliance Retailers", code: "449210", description: "Retailing electronics and appliances."}
        ]},
        { name: "Food and Beverage Stores", code: "445", description: "Retailing food and beverages.", industries: [
            {name: "Grocery and Convenience Retailers", code: "4451", description: "Retailing groceries and convenience items."}, // NAICS 2022 broadens this
            {name: "Specialty Food Retailers", code: "4452", description: "Retailing specialty foods."}
        ]},
        { name: "Gasoline Stations and Fuel Dealers", code: "457", description: "Retailing automotive fuels.", industries: [ // NAICS 2022 uses 457
            {name: "Gasoline Stations with Convenience Stores", code: "457110", description: "Retailing gasoline with convenience stores."}
        ]},
        { name: "Clothing, Clothing Accessories, Shoe, and Jewelry Retailers", code: "458", description: "Retailing clothing, accessories, shoes, and jewelry.", industries: [ // NAICS 2022 uses 458
            {name: "Clothing and Clothing Accessories Retailers", code: "4581", description: "Retailing clothing and accessories."},
            {name: "Shoe Retailers", code: "458210", description: "Retailing shoes."},
            {name: "Jewelry, Watch, Precious Stone, and Silverware Retailers", code: "4583", description: "Retailing jewelry, watches, and silverware."}
        ]},
         { name: "General Merchandise Retailers", code: "455", description: "Retailing a general line of merchandise.", industries: [ // NAICS 2022 uses 455
            {name: "Department Stores ", code: "455211", description: "Retailing a wide range of products with departments."},
            {name: "Warehouse Clubs and Supercenters", code: "455212", description: "Retailing a general line of groceries and general merchandise."}
          ]
        },
      ]
  },
  { name: "Transportation and Warehousing", code: "48-49", description: "Providing transportation of passengers and cargo, warehousing and storing goods, and providing services incidental to transportation.",
    subSectors: [
        { name: "Air Transportation", code: "481", description: "Providing air transportation of passengers and/or cargo.", industries: [
            { name: "Scheduled Passenger Air Transportation", code: "481111", description: "Air transportation of passengers on a scheduled basis." },
            { name: "Charter Air Transportation", code: "481211", description: "Air transportation of passengers or cargo on a charter basis." }
          ]
        },
        { name: "Rail Transportation", code: "482", description: "Providing rail transportation of passengers and/or cargo.", industries: [
            { name: "Line-Haul Railroads", code: "482111", description: "Operating railroads for the transport of passengers or cargo over a line-haul network." }
          ]
        },
        { name: "Water Transportation", code: "483", description: "Providing water transportation of passengers and cargo.", industries: [
            { name: "Deep Sea, Coastal, and Great Lakes Water Transportation", code: "4831", description: "Transportation of passengers or cargo on the deep seas, coastal waters, or Great Lakes." }
          ]
        },
        { name: "Truck Transportation", code: "484", description: "Providing over-the-road truck transportation of cargo.", industries: [
            { name: "General Freight Trucking", code: "4841", description: "Trucking general freight." },
            { name: "Specialized Freight Trucking", code: "4842", description: "Trucking specialized freight (e.g., hazardous materials, refrigerated goods)." }
          ]
        },
        { name: "Warehousing and Storage", code: "493", description: "Operating warehousing and storage facilities for general merchandise, refrigerated goods, and other warehouse products.", industries: [
            { name: "General Warehousing and Storage", code: "493110", description: "Operating general merchandise warehousing and storage." }
          ]
        }
      ]
  },
  { name: "Information", code: "51", description: "Producing and distributing information and cultural products, providing the means to transmit or distribute these products, and processing data.",
    subSectors: [
        { name: "Publishing Industries", code: "513", description: "Publishing newspapers, periodicals, books, software, and other works.", industries: [ // NAICS 2022
            { name: "Newspaper, Periodical, Book, and Directory Publishers", code: "5131", description: "Publishing newspapers, periodicals, books, and directories." },
            { name: "Software Publishers", code: "5132", description: "Publishing software." }
          ]
        },
        { name: "Motion Picture and Sound Recording Industries", code: "512", description: "Producing and distributing motion pictures and sound recordings.", industries: [
            { name: "Motion Picture and Video Industries", code: "5121", description: "Producing and/or distributing motion pictures and videos." },
            { name: "Sound Recording Industries", code: "5122", description: "Producing and/or distributing sound recordings." }
          ]
        },
        { name: "Broadcasting and Content Providers", code: "516", description: "Operating radio and television broadcasting stations, and providing content.", industries: [ // NAICS 2022
            { name: "Radio and Television Broadcasting", code: "5161", description: "Operating radio and television broadcasting stations." },
            { name: "Content Providers, Web Search Portals, and Data Processing Services", code: "5162", description: "Providing content, operating web search portals, and data processing services." }
          ]
        },
        { name: "Telecommunications", code: "517", description: "Operating, maintaining, and/or providing access to facilities for the transmission of voice, data, text, sound, and video.", industries: [
            { name: "Wired and Wireless Telecommunications Carriers (except Satellite)", code: "5171", description: "Operating wired and wireless telecommunications networks (except satellite)." },
            { name: "Satellite Telecommunications", code: "5174", description: "Operating satellite telecommunications networks." }
          ]
        }
      ]
  },
  { name: "Finance and Insurance", code: "52", description: "Transactions involving the creation, liquidation, or change in ownership of financial assets (financial transactions) and/or facilitating financial transactions.",
    subSectors: [
        { name: "Monetary Authorities - Central Bank", code: "521", description: "Central banking functions.", industries: [
            {name: "Monetary Authorities - Central Bank", code: "521110", description: "Performing central banking functions, such as issuing currency and acting as fiscal agent for the central government."}
          ]
        },
        { name: "Credit Intermediation and Related Activities", code: "522", description: "Lending funds raised from depositors or other sources.", industries: [
            { name: "Depository Credit Intermediation (Commercial Banking)", code: "5221", description: "Accepting deposits and making loans (e.g., commercial banks, savings institutions)." },
            { name: "Nondepository Credit Intermediation", code: "5222", description: "Providing credit without accepting deposits (e.g., sales financing, consumer lending)." }
          ]
        },
        { name: "Securities, Commodity Contracts, and Other Financial Investments", code: "523", description: "Underwriting, brokering, or dealing in securities, commodity contracts, and other financial investments.", industries: [
            { name: "Securities and Commodity Contracts Intermediation and Brokerage", code: "5231", description: "Acting as agents and/or principals in buying or selling securities or commodities." },
            { name: "Other Financial Investment Activities", code: "5239", description: "Managing portfolios of CVICs (capital venture investment corporations); investment banking." }
          ]
        },
        { name: "Insurance Carriers and Related Activities", code: "524", description: "Primarily engaged in underwriting (assuming the risk, assigning premiums, and so forth) annuities and insurance policies or facilitating such underwriting.", industries: [
            { name: "Insurance Carriers", code: "5241", description: "Underwriting insurance policies." },
            { name: "Agencies, Brokerages, and Other Insurance Related Activities", code: "5242", description: "Acting as agents or brokers in selling insurance or providing other insurance-related services." }
          ]
        }
      ]
  },
  { name: "Real Estate and Rental and Leasing", code: "53", description: "Renting, leasing, or otherwise allowing the use of tangible or intangible assets, and providing related services.",
    subSectors: [
        { name: "Real Estate", code: "531", industries: [
            { name: "Lessors of Real Estate", code: "5311"},
            { name: "Offices of Real Estate Agents and Brokers", code: "5312"},
            { name: "Activities Related to Real Estate", code: "5313"}
          ]
        },
        { name: "Rental and Leasing Services", code: "532", industries: [
            { name: "Automotive Equipment Rental and Leasing", code: "5321"},
            { name: "Consumer Goods Rental", code: "5322"},
            { name: "Commercial and Industrial Machinery and Equipment Rental and Leasing", code: "5324"}
          ]
        },
        { name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533", industries: [
            {name: "Lessors of Nonfinancial Intangible Assets", code: "5331"}
          ]
        }
      ]
  },
  { name: "Professional, Scientific, and Technical Services", code: "54", description: "Performing professional, scientific, and technical activities for others.",
    subSectors: [
        { name: "Legal Services", code: "5411", industries: [{name: "Offices of Lawyers", code: "541110"}] },
        { name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "5412", industries: [{name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "541210"}]},
        { name: "Architectural, Engineering, and Related Services", code: "5413", industries: [
            {name: "Architectural Services", code: "541310"},
            {name: "Engineering Services", code: "541330"},
            {name: "Surveying and Mapping (except Geophysical) Services", code: "541370"},
          ]
        },
        { name: "Computer Systems Design and Related Services", code: "5415", industries: [{ name: "Computer Systems Design and Related Services", code: "541510"}]},
        { name: "Management, Scientific, and Technical Consulting Services", code: "5416", industries: [
            {name: "Management Consulting Services", code: "541610"},
            {name: "Environmental Consulting Services", code: "541620"},
        ]},
        { name: "Scientific Research and Development Services", code: "5417", industries: [
            {name: "Research and Development in the Physical, Engineering, and Life Sciences", code: "541710"},
        ]},
        { name: "Advertising, Public Relations, and Related Services", code: "5418", industries: [
            {name: "Advertising Agencies", code: "541810"},
            {name: "Public Relations Agencies", code: "541820"},
        ]},
      ]
  },
  { name: "Management of Companies and Enterprises", code: "55", description: "Holding the securities of companies and enterprises for the purpose of owning a controlling interest or influencing management decisions.",
    subSectors: [
        { name: "Management of Companies and Enterprises", code: "551", industries: [
            {name: "Offices of Bank Holding Companies", code: "551111"},
            {name: "Offices of Other Holding Companies", code: "551112"},
          ]
        }
      ]
  },
  { name: "Administrative and Support and Waste Management and Remediation Services", code: "56", description: "Performing routine support activities for the day-to-day operations of other organizations or managing waste.",
    subSectors: [
        { name: "Administrative and Support Services", code: "561", industries: [
            {name: "Office Administrative Services", code: "5611"},
            {name: "Facilities Support Services", code: "5612"},
            {name: "Employment Services", code: "5613"},
            {name: "Business Support Services", code: "5614"},
            {name: "Travel Arrangement and Reservation Services", code: "5615"},
          ]
        },
        { name: "Waste Management and Remediation Services", code: "562", industries: [
            { name: "Waste Collection", code: "5621"},
            { name: "Waste Treatment and Disposal", code: "5622"},
            { name: "Remediation Services", code: "562910"}
          ]
        }
      ]
  },
  { name: "Educational Services", code: "61", description: "Providing instruction and training in a wide variety of subjects.",
    subSectors: [
        { name: "Elementary and Secondary Schools", code: "6111", industries: [{name: "Elementary and Secondary Schools", code: "611110"}] },
        { name: "Colleges, Universities, and Professional Schools", code: "6113", industries: [{name: "Colleges, Universities, and Professional Schools", code: "611310"}] },
        { name: "Business Schools and Computer and Management Training", code: "6114", industries: [
            {name: "Business and Secretarial Schools", code: "611410"},
            {name: "Computer Training", code: "611420"},
        ]},
        { name: "Technical and Trade Schools", code: "6115", industries: [{name: "Technical and Trade Schools", code: "611510"}]},
        { name: "Other Schools and Instruction", code: "6116", industries: [
            {name: "Fine Arts Schools", code: "611610"},
            {name: "Sports and Recreation Instruction", code: "611620"},
        ]},
      ]
  },
  { name: "Health Care and Social Assistance", code: "62", description: "Providing health care and social assistance for individuals.",
    subSectors: [
        { name: "Ambulatory Health Care Services", code: "621", industries: [
            {name: "Offices of Physicians", code: "6211"},
            {name: "Offices of Dentists", code: "6212"},
            {name: "Offices of Other Health Practitioners", code: "6213"},
            {name: "Outpatient Care Centers", code: "6214"},
            {name: "Home Health Care Services", code: "6216"},
          ]
        },
        { name: "Hospitals", code: "622", industries: [
            {name: "General Medical and Surgical Hospitals", code: "6221"},
            {name: "Psychiatric and Substance Abuse Hospitals", code: "6222"},
          ]
        },
        { name: "Nursing and Residential Care Facilities", code: "623", industries: [
            {name: "Nursing Care Facilities (Skilled Nursing Facilities)", code: "6231"},
            {name: "Residential Intellectual and Developmental Disability Facilities", code: "623210"},
          ]
        },
        { name: "Social Assistance", code: "624", industries: [
            {name: "Individual and Family Services", code: "6241"},
            {name: "Community Food and Housing, and Emergency Services", code: "6242"},
            {name: "Child Care Services", code: "6244"}
          ]
        }
      ]
  },
  { name: "Arts, Entertainment, and Recreation", code: "71", description: "Operating facilities or providing services to meet varied cultural, entertainment, and recreational interests of their patrons.",
    subSectors: [
        { name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [
            {name: "Performing Arts Companies", code: "7111"},
            {name: "Spectator Sports", code: "7112"},
            {name: "Promoters of Performing Arts, Sports, and Similar Events", code: "7113"},
          ]
        },
        { name: "Museums, Historical Sites, and Similar Institutions", code: "712", industries: [
            {name: "Museums", code: "712110"},
            {name: "Historical Sites", code: "712120"},
          ]
        },
        { name: "Amusement, Gambling, and Recreation Industries", code: "713", industries: [
            {name: "Amusement Parks and Arcades", code: "7131"},
            {name: "Gambling Industries", code: "7132"},
            {name: "Other Amusement and Recreation Industries (e.g., Golf Courses, Skiing Facilities)", code: "7139"}
          ]
        }
      ]
  },
  { name: "Accommodation and Food Services", code: "72", description: "Providing customers with lodging and/or preparing meals, snacks, and beverages for immediate consumption.",
    subSectors: [
        { name: "Accommodation", code: "721", industries: [
            {name: "Traveler Accommodation (Hotels, Motels, etc.)", code: "7211"},
            {name: "RV (Recreational Vehicle) Parks and Recreational Camps", code: "7212"},
          ]
        },
        { name: "Food Services and Drinking Places", code: "722", industries: [
            {name: "Full-Service Restaurants", code: "722511"},
            {name: "Limited-Service Restaurants", code: "722513"},
            {name: "Drinking Places (Alcoholic Beverages)", code: "722410"}
          ]
        }
      ]
  },
  { name: "Other Services (except Public Administration)", code: "81", description: "Providing services not elsewhere classified.",
    subSectors: [
        { name: "Repair and Maintenance", code: "811", industries: [
            {name: "Automotive Repair and Maintenance", code: "8111"},
            {name: "Electronic and Precision Equipment Repair and Maintenance", code: "8112"},
            {name: "Commercial and Industrial Machinery and Equipment Repair and Maintenance", code: "8113"},
          ]
        },
        { name: "Personal and Laundry Services", code: "812", industries: [
            {name: "Personal Care Services (e.g., Hair Salons, Barber Shops)", code: "8121"},
            {name: "Drycleaning and Laundry Services", code: "8123"},
          ]
        },
        { name: "Religious, Grantmaking, Civic, Professional, and Similar Organizations", code: "813", industries: [
            {name: "Religious Organizations", code: "8131"},
            {name: "Civic and Social Organizations", code: "8134"},
          ]
        }
      ]
  },
  { name: "Public Administration", code: "92", description: "Activities of a governmental nature, that is, the enactment and judicial interpretation of laws and their pursuant regulations, and the administration of programs based on them.",
    subSectors: [
        { name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [
            {name: "Executive Offices", code: "921110"},
            {name: "Legislative Bodies", code: "921120"},
          ]
        },
        { name: "Justice, Public Order, and Safety Activities", code: "922", industries: [
            {name: "Courts", code: "922110"},
            {name: "Police Protection", code: "922120"},
            {name: "Correctional Institutions", code: "922140"},
          ]
        },
        { name: "Administration of Economic Programs", code: "926", industries: [
            {name: "Administration of General Economic Programs", code: "926110"},
          ]
        },
        { name: "National Security and International Affairs", code: "928", industries: [
            {name: "National Security", code: "928110"},
          ]
        }
      ]
  }
];


const getInitials = (nameOrEmail: string | null | undefined): string => {
    if (!nameOrEmail) return '?';
    const nameToProcess = nameOrEmail.startsWith('@') ? nameOrEmail.substring(1) : nameOrEmail;

    const pseudonymRegex = /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{3}$/;
    if (pseudonymRegex.test(nameToProcess)) {
        const match = nameToProcess.match(/^([A-Z])[a-z]+([A-Z])/);
        if (match && match[1] && match[2]) return match[1] + match[2];
        if (match && match[1]) return match[1];
    }

    const parts = nameToProcess.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};


export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
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
    mutationFn: async (newPostDataWithImage: NewPostData & { imageFile?: File | null; mentionedUserIds?: string[] }) => {
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
      // Ensure imageUrls is always an array, even if empty
      postDataForFirestore.imageUrls = uploadedImageUrls.length > 0 ? uploadedImageUrls : [];
      postDataForFirestore.mentionedUserIds = newPostDataWithImage.mentionedUserIds || [];

      console.log("[MainLayout] Data for Firestore (addPostMutation):", JSON.stringify(postDataForFirestore, null, 2));
      
      return addPostToFirestore(postDataForFirestore as NewPostData);
    },
    onSuccess: (newlyCreatedPostId, variables) => {
      console.log("[MainLayout] addPostMutation onSuccess. Newly created Post ID:", newlyCreatedPostId, "Variables:", variables);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['allPostsForSectorPage'] });
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
        description: `Could not add your post: ${error.message}. Check console for details.`,
      });
      setIsCreatePostOpen(false); // Ensure dialog closes even on error
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
