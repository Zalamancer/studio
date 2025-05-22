// src/components/layout/MainLayout.tsx
"use client";

import React,
{
  useState,
  useEffect,
  useCallback
} from 'react';
import Link from 'next/link';
import {
  usePathname,
  useRouter
} from 'next/navigation';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Home, Compass, Network, FileText, LogOut, PlusCircle, UserCircle, CreditCard, Settings, User, Bell, Handshake, HelpingHand, Factory } from "lucide-react"; // Added Factory
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import type {
  CreatePostFormData
} from '@/components/CreatePostForm';
import type { RequestHelpFormData } from '@/components/RequestHelpForm';
import type {
  NewPostData
} from '@/types/post';
import {
  addPostToFirestore
} from '@/services/postService';
import {
  uploadPostImage
} from '@/services/storageService';
import {
  useMutation,
  useQueryClient
} from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { createNotification } from '@/services/notificationService';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { Timestamp } from 'firebase/firestore';
import { useIsMobile } from "@/hooks/use-mobile";
import dynamic from 'next/dynamic';

export interface Industry {
  name: string;
  code: string;
  description?: string;
}

export interface SubSector {
  name: string;
  code: string;
  description?: string;
  industries: Industry[];
}

export interface SectorWithSubSectors {
  name: string;
  code: string;
  description?: string;
  subSectors: SubSector[];
}

export const detailedSectorsData: SectorWithSubSectors[] = [
  {
    name: "Agriculture, Forestry, Fishing and Hunting",
    code: "11",
    description: "Establishments primarily engaged in growing crops, raising animals, harvesting timber, and harvesting fish and other animals from a farm, ranch, or their natural habitats.",
    subSectors: [
      {
        name: "Crop Production", code: "111", industries: [
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
        ]
      },
      {
        name: "Animal Production and Aquaculture", code: "112", industries: [
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
        ]
      },
      {
        name: "Forestry and Logging", code: "113", industries: [
          { name: "Timber Tract Operations", code: "113110" },
          { name: "Forest Nurseries and Gathering of Forest Products", code: "113210" },
          { name: "Logging", code: "113310" },
        ]
      },
      {
        name: "Fishing, Hunting and Trapping", code: "114", industries: [
          { name: "Finfish Fishing", code: "114111" },
          { name: "Shellfish Fishing", code: "114112" },
          { name: "Other Marine Fishing", code: "114119" },
          { name: "Hunting and Trapping", code: "114210" },
        ]
      },
      {
        name: "Support Activities for Agriculture and Forestry", code: "115", industries: [
          { name: "Cotton Ginning", code: "115111" },
          { name: "Soil Preparation, Planting, and Cultivating", code: "115112" },
          { name: "Crop Harvesting, Primarily by Machine", code: "115113" },
          { name: "Postharvest Crop Activities (except Cotton Ginning)", code: "115114" },
          { name: "Farm Labor Contractors and Crew Leaders", code: "115115" },
          { name: "Farm Management Services", code: "115116" },
          { name: "Support Activities for Animal Production", code: "115210" },
          { name: "Support Activities for Forestry", code: "115310" },
        ]
      },
    ]
  },
  {
    name: "Mining, Quarrying, and Oil and Gas Extraction", code: "21", description: "Establishments that extract naturally occurring mineral solids, liquid minerals, and gases.",
    subSectors: [
      { name: "Oil and Gas Extraction", code: "211", industries: [{ name: "Crude Petroleum and Natural Gas Extraction", code: "211111" }, { name: "Natural Gas Liquid Extraction", code: "211130" }] },
      { name: "Coal Mining", code: "2121", industries: [{ name: "Bituminous Coal and Lignite Surface Mining", code: "212111" }, { name: "Bituminous Coal Underground Mining", code: "212112" }, { name: "Anthracite Mining", code: "212113" }] },
      { name: "Metal Ore Mining", code: "2122", industries: [{ name: "Iron Ore Mining", code: "212210" }, { name: "Gold Ore Mining", code: "212221" }, { name: "Silver Ore Mining", code: "212222" }, { name: "Copper, Nickel, Lead, and Zinc Mining", code: "212230" }] },
      { name: "Nonmetallic Mineral Mining and Quarrying", code: "2123", industries: [{ name: "Dimension Stone Mining and Quarrying", code: "212311" }, { name: "Crushed and Broken Limestone Mining and Quarrying", code: "212312" }, { name: "Construction Sand and Gravel Mining", code: "212321" }, { name: "Industrial Sand Mining", code: "212322" }, { name: "Clay and Ceramic and Refractory Minerals Mining", code: "212325" }] },
      { name: "Support Activities for Mining", code: "213", industries: [{ name: "Drilling Oil and Gas Wells", code: "213111" }, { name: "Support Activities for Oil and Gas Operations", code: "213112" }, { name: "Support Activities for Coal Mining", code: "213113" }] },
    ]
  },
  {
    name: "Utilities", code: "22", description: "Establishments engaged in providing utility services such as electric power, natural gas, steam supply, water supply, and sewage removal.",
    subSectors: [
      { name: "Electric Power Generation, Transmission and Distribution", code: "2211", industries: [{ name: "Hydroelectric Power Generation", code: "221111" }, { name: "Fossil Fuel Electric Power Generation", code: "221112" }, { name: "Nuclear Electric Power Generation", code: "221113" }, { name: "Electric Bulk Power Transmission and Control", code: "221121" }, { name: "Electric Power Distribution", code: "221122" }] },
      { name: "Natural Gas Distribution", code: "2212", industries: [{ name: "Natural Gas Distribution", code: "221210" }] },
      { name: "Water, Sewage and Other Systems", code: "2213", industries: [{ name: "Water Supply and Irrigation Systems", code: "221310" }, { name: "Sewage Treatment Facilities", code: "221320" }, { name: "Steam and Air-Conditioning Supply", code: "221330" }] },
    ]
  },
  {
    name: "Construction", code: "23", description: "Establishments primarily engaged in the construction of buildings and engineering projects.",
    subSectors: [
      { name: "Construction of Buildings", code: "236", industries: [{ name: "New Single-Family Housing Construction (except For-Sale Builders)", code: "236115" }, { name: "New Multifamily Housing Construction (except For-Sale Builders)", code: "236116" }, { name: "Industrial Building Construction", code: "236210" }, { name: "Commercial and Institutional Building Construction", code: "236220" }] },
      { name: "Heavy and Civil Engineering Construction", code: "237", industries: [{ name: "Water and Sewer Line and Related Structures Construction", code: "237110" }, { name: "Oil and Gas Pipeline and Related Structures Construction", code: "237120" }, { name: "Power and Communication Line and Related Structures Construction", code: "237130" }, { name: "Highway, Street, and Bridge Construction", code: "237310" }, { name: "Other Heavy and Civil Engineering Construction", code: "237990"}] },
      { name: "Specialty Trade Contractors", code: "238", industries: [{ name: "Plumbing, Heating, and Air-Conditioning Contractors", code: "238220" }, { name: "Electrical Contractors and Other Wiring Installation Contractors", code: "238210" }, { name: "Painting and Wall Covering Contractors", code: "238320" }, { name: "Site Preparation Contractors", code: "238910" }, {"name": "Masonry Contractors", code: "238140"}, {"name": "Roofing Contractors", code: "238160"} ] },
    ]
  },
  {
    name: "Manufacturing", code: "31-33", description: "Mechanical, physical, or chemical transformation of materials, substances, or components into new products.",
    subSectors: [
      { name: "Food Manufacturing", code: "311", industries: [
          { name: "Animal Food Manufacturing", code: "311119" },
          { name: "Grain and Oilseed Milling", code: "311211" },
          { name: "Sugar and Confectionery Product Manufacturing", code: "311313" },
          { name: "Fruit and Vegetable Preserving and Specialty Food Manufacturing", code: "311411" },
          { name: "Dairy Product Manufacturing", code: "311511" },
          { name: "Animal Slaughtering and Processing", code: "311611" },
          { name: "Seafood Product Preparation and Packaging", code: "311710" },
          { name: "Bakeries and Tortilla Manufacturing", code: "311812" },
          { name: "Other Food Manufacturing", code: "311911" },
      ]},
      { name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [
          { name: "Soft Drink and Ice Manufacturing", code: "312111" },
          { name: "Breweries", code: "312120" },
          { name: "Wineries", code: "312130" },
          { name: "Distilleries", code: "312140" },
          { name: "Tobacco Manufacturing", code: "312230" },
      ]},
      { name: "Textile Mills", code: "313", industries: [
          { name: "Fiber, Yarn, and Thread Mills", code: "313110" },
          { name: "Broadwoven Fabric Mills", code: "313210" },
          { name: "Narrow Fabric Mills and Schiffli Machine Embroidery", code: "313220" },
          { name: "Nonwoven Fabric Mills", code: "313230" },
          { name: "Knit Fabric Mills", code: "313240" },
          { name: "Textile and Fabric Finishing Mills", code: "313310" },
          { name: "Fabric Coating Mills", code: "313320" },
      ]},
      { name: "Textile Product Mills", code: "314", industries: [
          { name: "Carpet and Rug Mills", code: "314110" },
          { name: "Curtain and Linen Mills", code: "314120" },
          { name: "Textile Bag and Canvas Mills", code: "314910" },
          { name: "Rope, Cordage, Twine, Tire Cord, and Tire Fabric Mills", code: "314994" },
          { name: "All Other Miscellaneous Textile Product Mills", code: "314999" },
      ]},
      { name: "Apparel Manufacturing", code: "315", industries: [
          { name: "Apparel Knitting Mills", code: "315120" },
          { name: "Cut and Sew Apparel Contractors", code: "315210" },
          { name: "Men's and Boys' Cut and Sew Apparel Manufacturing", code: "315220" },
          { name: "Women's, Girls', and Infants' Cut and Sew Apparel Manufacturing", code: "315240" },
          { name: "Other Cut and Sew Apparel Manufacturing", code: "315280" },
          { name: "Apparel Accessories and Other Apparel Manufacturing", code: "315990" },
      ]},
      { name: "Leather and Allied Product Manufacturing", code: "316", industries: [
          { name: "Leather and Hide Tanning and Finishing", code: "316110" },
          { name: "Footwear Manufacturing", code: "316210" },
          { name: "Other Leather and Allied Product Manufacturing", code: "316990" },
      ]},
      { name: "Wood Product Manufacturing", code: "321", industries: [
          { name: "Sawmills", code: "321113" },
          { name: "Wood Preservation", code: "321114" },
          { name: "Veneer, Plywood, and Engineered Wood Product Manufacturing", code: "321210" },
          { name: "Other Millwork (including Flooring)", code: "321918" },
          { name: "Wood Container and Pallet Manufacturing", code: "321920" },
          { name: "All Other Wood Product Manufacturing", code: "321999" },
      ]},
      { name: "Paper Manufacturing", code: "322", industries: [
          { name: "Pulp, Paper, and Paperboard Mills", code: "3221" },
          { name: "Converted Paper Product Manufacturing", code: "3222" },
      ]},
      { name: "Printing and Related Support Activities", code: "323", industries: [
          { name: "Printing", code: "323111" },
          { name: "Support Activities for Printing", code: "323120" },
      ]},
      { name: "Petroleum and Coal Products Manufacturing", code: "324", industries: [
          { name: "Petroleum Refineries", code: "324110" },
          { name: "Asphalt Paving, Roofing, and Saturated Materials Manufacturing", code: "32412" },
          { name: "Other Petroleum and Coal Products Manufacturing", code: "32419" },
      ]},
      { name: "Chemical Manufacturing", code: "325", industries: [
          { name: "Basic Chemical Manufacturing", code: "3251" },
          { name: "Resin, Synthetic Rubber, and Artificial and Synthetic Fibers and Filaments Manufacturing", code: "3252" },
          { name: "Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing", code: "3253" },
          { name: "Pharmaceutical and Medicine Manufacturing", code: "3254" },
          { name: "Paint, Coating, and Adhesive Manufacturing", code: "3255" },
          { name: "Soap, Cleaning Compound, and Toilet Preparation Manufacturing", code: "3256" },
          { name: "Other Chemical Product and Preparation Manufacturing", code: "3259" },
      ]},
      { name: "Plastics and Rubber Products Manufacturing", code: "326", industries: [
          { name: "Plastics Product Manufacturing", code: "3261" },
          { name: "Rubber Product Manufacturing", code: "3262" },
      ]},
      { name: "Nonmetallic Mineral Product Manufacturing", code: "327", industries: [
          { name: "Clay Product and Refractory Manufacturing", code: "3271" },
          { name: "Glass and Glass Product Manufacturing", code: "3272" },
          { name: "Cement and Concrete Product Manufacturing", code: "3273" },
          { name: "Lime and Gypsum Product Manufacturing", code: "3274" },
          { name: "Other Nonmetallic Mineral Product Manufacturing", code: "3279" },
      ]},
      { name: "Primary Metal Manufacturing", code: "331", industries: [
          { name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "331110" },
          { name: "Steel Product Manufacturing from Purchased Steel", code: "3312" },
          { name: "Alumina and Aluminum Production and Processing", code: "3313" },
          { name: "Nonferrous Metal (except Aluminum) Production and Processing", code: "3314" },
          { name: "Foundries", code: "3315" },
      ]},
      { name: "Fabricated Metal Product Manufacturing", code: "332", industries: [
          { name: "Forging and Stamping", code: "3321" },
          { name: "Cutlery and Handtool Manufacturing", code: "3322" },
          { name: "Architectural and Structural Metals Manufacturing", code: "3323" },
          { name: "Boiler, Tank, and Shipping Container Manufacturing", code: "3324" },
          { name: "Hardware Manufacturing", code: "332510" },
          { name: "Spring and Wire Product Manufacturing", code: "3326" },
          { name: "Machine Shops; Turned Product; and Screw, Nut, and Bolt Manufacturing", code: "3327" },
          { name: "Coating, Engraving, Heat Treating, and Allied Activities", code: "3328" },
          { name: "Other Fabricated Metal Product Manufacturing", code: "3329" },
      ]},
      { name: "Machinery Manufacturing", code: "333", industries: [
          { name: "Agriculture, Construction, and Mining Machinery Manufacturing", code: "3331" },
          { name: "Industrial Machinery Manufacturing", code: "3332" },
          { name: "Commercial and Service Industry Machinery Manufacturing", code: "3333" },
          { name: "Ventilation, Heating, Air-Conditioning, and Commercial Refrigeration Equipment Manufacturing", code: "3334" },
          { name: "Metalworking Machinery Manufacturing", code: "3335" },
          { name: "Engine, Turbine, and Power Transmission Equipment Manufacturing", code: "3336" },
          { name: "Other General Purpose Machinery Manufacturing", code: "3339" },
      ]},
      { name: "Computer and Electronic Product Manufacturing", code: "334", industries: [
          { name: "Computer and Peripheral Equipment Manufacturing", code: "3341" },
          { name: "Communications Equipment Manufacturing", code: "3342" },
          { name: "Audio and Video Equipment Manufacturing", code: "334310" },
          { name: "Semiconductor and Other Electronic Component Manufacturing", code: "3344" },
          { name: "Navigational, Measuring, Electromedical, and Control Instruments Manufacturing", code: "3345" },
          { name: "Manufacturing and Reproducing Magnetic and Optical Media", code: "334610" },
      ]},
      { name: "Electrical Equipment, Appliance, and Component Manufacturing", code: "335", industries: [
          { name: "Electric Lighting Equipment Manufacturing", code: "3351" },
          { name: "Household Appliance Manufacturing", code: "3352" },
          { name: "Electrical Equipment Manufacturing", code: "3353" },
          { name: "Other Electrical Equipment and Component Manufacturing", code: "3359" },
      ]},
      { name: "Transportation Equipment Manufacturing", code: "336", industries: [
          { name: "Motor Vehicle Manufacturing", code: "3361" },
          { name: "Motor Vehicle Body and Trailer Manufacturing", code: "3362" },
          { name: "Motor Vehicle Parts Manufacturing", code: "3363" },
          { name: "Aerospace Product and Parts Manufacturing", code: "3364" },
          { name: "Railroad Rolling Stock Manufacturing", code: "336510" },
          { name: "Ship and Boat Building", code: "3366" },
          { name: "Other Transportation Equipment Manufacturing", code: "3369" },
      ]},
      { name: "Furniture and Related Product Manufacturing", code: "337", industries: [
          { name: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", code: "3371" },
          { name: "Office Furniture (including Fixtures) Manufacturing", code: "3372" },
          { name: "Other Furniture Related Product Manufacturing", code: "3379" },
      ]},
      { name: "Miscellaneous Manufacturing", code: "339", industries: [
          { name: "Medical Equipment and Supplies Manufacturing", code: "3391" },
          { name: "Other Miscellaneous Manufacturing", code: "3399" },
      ]},
    ]
  },
  {
    name: "Wholesale Trade", code: "42", description: "Establishments primarily engaged in wholesaling merchandise, generally without transformation.",
    subSectors: [
      { name: "Merchant Wholesalers, Durable Goods", code: "423", industries: [{ name: "Motor Vehicle and Motor Vehicle Parts and Supplies Merchant Wholesalers", code: "4231" }, { name: "Professional and Commercial Equipment and Supplies Merchant Wholesalers", code: "4234" }, { name: "Metal and Mineral (except Petroleum) Merchant Wholesalers", code: "4235" }] },
      { name: "Merchant Wholesalers, Nondurable Goods", code: "424", industries: [{ name: "Grocery and Related Product Merchant Wholesalers", code: "4244" }, { name: "Petroleum and Petroleum Products Merchant Wholesalers", code: "4247" }, { name: "Alcoholic Beverage Merchant Wholesalers", code: "4248" }] },
      { name: "Wholesale Electronic Markets and Agents and Brokers", code: "425", industries: [{ name: "Business to Business Electronic Markets", code: "425110" }, { name: "Wholesale Trade Agents and Brokers", code: "425120" }] },
    ]
  },
  {
    name: "Retail Trade", code: "44-45", description: "Establishments primarily engaged in retailing merchandise, generally without transformation.",
    subSectors: [
      { name: "Motor Vehicle and Parts Dealers", code: "441", industries: [{ name: "Automobile Dealers", code: "4411" }, { name: "Other Motor Vehicle Dealers", code: "4412" }, { name: "Automotive Parts, Accessories, and Tire Retailers", code: "4413" } ] },
      { name: "Furniture, Home Furnishings, Electronics, and Appliance Retailers", code: "449", industries: [{ name: "Furniture Retailers", code: "449110" }, { name: "Home Furnishings Retailers", code: "44912" }, { name: "Electronics and Appliance Retailers", code: "449210" }] },
      { name: "Food and Beverage Retailers", code: "445", industries: [{ name: "Grocery and Convenience Retailers", code: "4451" }, { name: "Specialty Food Retailers", code: "4452" }, { name: "Beer, Wine, and Liquor Retailers", code: "4453" }] },
      { name: "General Merchandise Retailers", code: "455", industries: [{ name: "Department Stores ", code: "4551" }, { name: "Warehouse Clubs, Supercenters, and Other General Merchandise Retailers", code: "4552" } ] },
      { name: "Miscellaneous Store Retailers", code: "459", industries: [{ name: "Sporting Goods, Hobby, and Musical Instrument Retailers", code: "4591" }, { name: "Book Retailers", code: "459210" }] },
    ]
  },
  {
    name: "Transportation and Warehousing", code: "48-49", description: "Establishments providing transportation of passengers and cargo, warehousing and storage for goods.",
    subSectors: [
      { name: "Air Transportation", code: "481", industries: [{ name: "Scheduled Air Transportation", code: "4811" }, { name: "Nonscheduled Air Transportation", code: "4812" }] },
      { name: "Rail Transportation", code: "482", industries: [{ name: "Rail Transportation", code: "4821" }] },
      { name: "Water Transportation", code: "483", industries: [{ name: "Deep Sea, Coastal, and Great Lakes Water Transportation", code: "4831" }, { name: "Inland Water Transportation", code: "4832" }] },
      { name: "Truck Transportation", code: "484", industries: [{ name: "General Freight Trucking", code: "4841" }, { name: "Specialized Freight Trucking", code: "4842" }] },
      { name: "Warehousing and Storage", code: "493", industries: [{ name: "Warehousing and Storage", code: "4931" }] },
      { name: "Pipeline Transportation", code: "486", industries: [{ name: "Pipeline Transportation of Crude Oil", code: "486110"}, {"name": "Pipeline Transportation of Natural Gas", code: "486210"}]},
      { name: "Scenic and Sightseeing Transportation", code: "487", industries: [{ name: "Scenic and Sightseeing Transportation, Land", code: "487110"}, {"name": "Scenic and Sightseeing Transportation, Water", code: "487210"}]},
      { name: "Support Activities for Transportation", code: "488", industries: [{ name: "Support Activities for Air Transportation", code: "4881"}, {"name": "Support Activities for Rail Transportation", code: "488210"}]},
      { name: "Couriers and Messengers", code: "492", industries: [{ name: "Couriers and Express Delivery Services", code: "492110"}, {"name": "Local Messengers and Local Delivery", code: "492210"}]},
    ]
  },
  {
    name: "Information", code: "51", description: "Establishments engaged in producing and distributing information and cultural products.",
    subSectors: [
      { name: "Publishing Industries (except Internet)", code: "513", industries: [{ name: "Newspaper, Periodical, Book, and Directory Publishers", code: "5131" }, { name: "Software Publishers", code: "5132" }] },
      { name: "Motion Picture and Sound Recording Industries", code: "512", industries: [{ name: "Motion Picture and Video Industries", code: "5121" }, { name: "Sound Recording Industries", code: "5122" }] },
      { name: "Broadcasting and Content Providers", code: "516", industries: [{ name: "Radio and Television Broadcasting Stations", code: "5161" }, {name: "Content Providers, Web Search Portals, and Data Processing Services", code: "5162"}] },
      { name: "Telecommunications", code: "517", industries: [{ name: "Wired and Wireless Telecommunications Carriers (except Satellite)", code: "5171" }, { name: "Satellite Telecommunications", code: "5174" }, {"name": "Other Telecommunications", code: "5179"}] },
      { name: "Data Processing, Hosting, and Related Services", code: "518", industries: [{ name: "Data Processing, Hosting, and Related Services", code: "518210" }] },
      { name: "Other Information Services", code: "519", industries: [{ name: "News Syndicates", code: "519210" }, { name: "Libraries and Archives", code: "519220" }] },
    ]
  },
  {
    name: "Finance and Insurance", code: "52", description: "Establishments primarily engaged in financial transactions or in facilitating financial transactions.",
    subSectors: [
      { name: "Monetary Authorities - Central Bank", code: "521", industries: [{ name: "Monetary Authorities - Central Bank", code: "521110" }] },
      { name: "Credit Intermediation and Related Activities", code: "522", industries: [{ name: "Commercial Banking", code: "522110" }, { name: "Savings Institutions", code: "522120" }, { name: "Credit Unions", code: "522130" }, { name: "Sales Financing", code: "522220" }, { name: "Consumer Lending", code: "522291" }] },
      { name: "Securities, Commodity Contracts, and Other Financial Investments and Related Activities", code: "523", industries: [{ name: "Investment Banking and Securities Dealing", code: "523110" }, { name: "Securities Brokerage", code: "523120" }, { name: "Commodity Contracts Dealing", code: "523130" } ] },
      { name: "Insurance Carriers and Related Activities", code: "524", industries: [{ name: "Direct Life Insurance Carriers", code: "524113" }, { name: "Direct Health and Medical Insurance Carriers", code: "524114" }, { name: "Direct Property and Casualty Insurance Carriers", code: "524126" }, { name: "Insurance Agencies and Brokerages", code: "524210" }] },
      { name: "Funds, Trusts, and Other Financial Vehicles", code: "525", industries: [{ name: "Pension Funds", code: "525110"}, {"name": "Health and Welfare Funds", code: "525120"}]}
    ]
  },
  {
    name: "Real Estate and Rental and Leasing", code: "53", description: "Establishments primarily engaged in renting, leasing, or otherwise allowing the use of tangible or intangible assets.",
    subSectors: [
      { name: "Real Estate", code: "531", industries: [{ name: "Lessors of Residential Buildings and Dwellings", code: "531110" }, { name: "Offices of Real Estate Agents and Brokers", code: "531210" }, { name: "Real Estate Property Managers", code: "53131" }] },
      { name: "Rental and Leasing Services", code: "532", industries: [{ name: "Automotive Equipment Rental and Leasing", code: "5321" }, { name: "Consumer Goods Rental", code: "5322" }, { name: "General Rental Centers", code: "532310" }] },
      { name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533", industries: [{ name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533110" }] },
    ]
  },
  {
    name: "Professional, Scientific, and Technical Services", code: "54", description: "Establishments that specialize in performing professional, scientific, and technical activities for others.",
    subSectors: [
      { name: "Legal Services", code: "5411", industries: [{ name: "Offices of Lawyers", code: "541110" }, { name: "Other Legal Services", code: "54119" }] },
      { name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "5412", industries: [{ name: "Offices of Certified Public Accountants", code: "541211" }, { name: "Tax Preparation Services", code: "541213" }] },
      { name: "Architectural, Engineering, and Related Services", code: "5413", industries: [{ name: "Architectural Services", code: "541310" }, { name: "Engineering Services", code: "541330" }, { name: "Geophysical Surveying and Mapping Services", code: "541360" }, { name: "Testing Laboratories and Services", code: "541380" }] },
      { name: "Computer Systems Design and Related Services", code: "5415", industries: [{ name: "Custom Computer Programming Services", code: "541511" }, { name: "Computer Systems Design Services", code: "541512" }, { name: "Computer Facilities Management Services", code: "541513" }] },
      { name: "Management, Scientific, and Technical Consulting Services", code: "5416", industries: [{ name: "Management Consulting Services", code: "54161" }, { name: "Environmental Consulting Services", code: "541620" }] },
      { name: "Advertising, Public Relations, and Related Services", code: "5418", industries: [{name: "Advertising Agencies", code: "541810"}, {name: "Public Relations Agencies", code: "541820"}] },
      { name: "Other Professional, Scientific, and Technical Services", code: "5419", industries: [{name: "Marketing Research and Public Opinion Polling", code: "541910"}, {name: "Photographic Services", code: "54192"}, {name: "Translation and Interpretation Services", code: "541930"}, {name: "Veterinary Services", code: "541940"}] },
    ]
  },
  {
    name: "Management of Companies and Enterprises", code: "55", description: "Establishments that hold the securities of companies and enterprises for the purpose of owning a controlling interest or influencing management decisions.",
    subSectors: [
      { name: "Management of Companies and Enterprises", code: "551", industries: [{ name: "Offices of Bank Holding Companies", code: "551111" }, { name: "Offices of Other Holding Companies", code: "551112" }] },
    ]
  },
  {
    name: "Administrative and Support and Waste Management and Remediation Services", code: "56", description: "Establishments performing routine support activities for the day-to-day operations of other organizations or managing waste.",
    subSectors: [
      { name: "Administrative and Support Services", code: "561", industries: [{ name: "Office Administrative Services", code: "561110" }, { name: "Facilities Support Services", code: "561210" }, { name: "Employment Services", code: "5613" }, { name: "Investigation and Security Services", code: "5616" }, {"name": "Document Preparation Services", code: "561410"}, {"name": "Travel Arrangement and Reservation Services", code: "5615"}] },
      { name: "Waste Management and Remediation Services", code: "562", industries: [{ name: "Waste Collection", code: "56211" }, { name: "Waste Treatment and Disposal", code: "56221" }, { name: "Remediation Services", code: "562910" }] },
    ]
  },
  {
    name: "Educational Services", code: "61", description: "Establishments that provide instruction and training in a wide variety of subjects.",
    subSectors: [
      { name: "Elementary and Secondary Schools", code: "6111", industries: [{ name: "Elementary and Secondary Schools", code: "611110" }] },
      { name: "Junior Colleges", code: "6112", industries: [{ name: "Junior Colleges", code: "611210" }] },
      { name: "Colleges, Universities, and Professional Schools", code: "6113", industries: [{ name: "Colleges, Universities, and Professional Schools", code: "611310" }] },
      { name: "Other Schools and Instruction", code: "6116", industries: [{ name: "Fine Arts Schools", code: "611610" }, { name: "Sports and Recreation Instruction", code: "611620" }, { name: "Language Schools", code: "611630"}] },
      { name: "Technical and Trade Schools", code: "6115", industries: [{ name: "Technical and Trade Schools", code: "61151"}] },
      { name: "Educational Support Services", code: "6117", industries: [{ name: "Educational Support Services", code: "611710"}] },
    ]
  },
  {
    name: "Health Care and Social Assistance", code: "62", description: "Establishments providing health care and social assistance for individuals.",
    subSectors: [
      { name: "Ambulatory Health Care Services", code: "621", industries: [{ name: "Offices of Physicians", code: "6211" }, { name: "Offices of Dentists", code: "621210" }, { name: "Offices of Other Health Practitioners", code: "6213" }, { name: "Medical and Diagnostic Laboratories", code: "62151" }, { name: "Home Health Care Services", code: "621610"}] },
      { name: "Hospitals", code: "622", industries: [{ name: "General Medical and Surgical Hospitals", code: "622110" }, { name: "Psychiatric and Substance Abuse Hospitals", code: "622210" }] },
      { name: "Nursing and Residential Care Facilities", code: "623", industries: [{ name: "Nursing Care Facilities (Skilled Nursing Facilities)", code: "623110" }, { name: "Residential Intellectual and Developmental Disability, Mental Health, and Substance Abuse Facilities", code: "6232" }] },
      { name: "Social Assistance", code: "624", industries: [{ name: "Individual and Family Services", code: "6241" }, { name: "Community Food and Housing, and Emergency and Other Relief Services", code: "6242" }, { name: "Vocational Rehabilitation Services", code: "624310"}] },
    ]
  },
  {
    name: "Arts, Entertainment, and Recreation", code: "71", description: "Establishments that operate facilities or provide services to meet varied cultural, entertainment, and recreational interests.",
    subSectors: [
      { name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [{ name: "Performing Arts Companies", code: "7111" }, { name: "Spectator Sports", code: "7112" }, { name: "Promoters of Performing Arts, Sports, and Similar Events", code: "7113" }, {"name": "Agents and Managers for Artists, Athletes, Entertainers, and Other Public Figures", code: "711410"}] },
      { name: "Museums, Historical Sites, and Similar Institutions", code: "712", industries: [{ name: "Museums", code: "712110" }, {"name": "Historical Sites", code: "712120"}] },
      { name: "Amusement, Gambling, and Recreation Industries", code: "713", industries: [{ name: "Amusement Parks and Arcades", code: "7131" }, { name: "Gambling Industries", code: "7132" }, { name: "Other Amusement and Recreation Industries (except Gambling)", code: "7139" }] },
    ]
  },
  {
    name: "Accommodation and Food Services", code: "72", description: "Establishments providing customers with lodging and/or preparing meals, snacks, and beverages for immediate consumption.",
    subSectors: [
      { name: "Accommodation", code: "721", industries: [{ name: "Hotels (except Casino Hotels) and Motels", code: "721110" }, { name: "RV (Recreational Vehicle) Parks and Recreational Camps", code: "721211" }, { name: "Rooming and Boarding Houses, Dormitories, and Workers' Camps", code: "721310" }] },
      { name: "Food Services and Drinking Places", code: "722", industries: [{ name: "Full-Service Restaurants", code: "722511" }, { name: "Limited-Service Restaurants", code: "722513" }, { name: "Cafeterias, Grill Buffets, and Buffets", code: "722514"}, { name: "Snack and Nonalcoholic Beverage Bars", code: "722515"}, { name: "Food Service Contractors", code: "722310" }, { name: "Caterers", code: "722320" }, { name: "Drinking Places (Alcoholic Beverages)", code: "722410" }] },
    ]
  },
  {
    name: "Other Services (except Public Administration)", code: "81", description: "Establishments engaged in providing services not elsewhere classified.",
    subSectors: [
      { name: "Repair and Maintenance", code: "811", industries: [{ name: "Automotive Repair and Maintenance", code: "8111" }, { name: "Electronic and Precision Equipment Repair and Maintenance", code: "81121" }, { name: "Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance", code: "811310" }] },
      { name: "Personal and Laundry Services", code: "812", industries: [{ name: "Personal Care Services (e.g., hair, skin, nail)", code: "8121" }, { name: "Drycleaning and Laundry Services", code: "8123" }, { name: "Other Personal Services (e.g., pet care, photofinishing)", code: "8129" }] },
      { name: "Religious, Grantmaking, Civic, Professional, and Similar Organizations", code: "813", industries: [{ name: "Religious Organizations", code: "813110" }, { name: "Grantmaking and Giving Services", code: "8132" }, { name: "Social Advocacy Organizations", code: "8133" }, {"name": "Business Associations", code: "813910"}] },
      { name: "Private Households", code: "814", industries: [{ name: "Private Households", code: "814110"}] },
    ]
  },
  {
    name: "Public Administration", code: "92", description: "Establishments of federal, state, and local government agencies that administer, oversee, and manage public programs.",
    subSectors: [
      { name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [{ name: "Executive Offices", code: "921110" }, { name: "Legislative Bodies", code: "921120" }, { name: "Public Finance Activities", code: "921130"}] },
      { name: "Justice, Public Order, and Safety Activities", code: "922", industries: [{ name: "Courts", code: "922110" }, { name: "Police Protection", code: "922120" }, { name: "Correctional Institutions", code: "922140" }, {"name": "Fire Protection", code: "922160"}] },
      { name: "National Security and International Affairs", code: "928", industries: [{ name: "National Security", code: "928110" }, { name: "International Affairs", code: "928120" }] },
      { name: "Administration of Economic Programs", code: "926", industries: [{ name: "Administration of General Economic Programs", code: "926110"}] },
    ]
  },
];


const navItems = [
  { title: "Board", href: "/", icon: Home },
  { title: "Discover", href: "/discover", icon: Compass },
  { title: "Connect", href: "/connect", icon: Network },
  { title: "Contracts", href: "/contracts", icon: FileText },
];

export const availableTags = [
  "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

// Dynamically import forms
const DynamicCreatePostForm = dynamic(() =>
  import('@/components/CreatePostForm').then((mod) => mod.CreatePostForm),
  { loading: () => <p className="p-4 text-center">Loading form...</p> }
);

const DynamicRequestHelpForm = dynamic(() =>
  import('@/components/CreatePostForm').then((mod) => mod.CreatePostForm),
  { loading: () => <p className="p-4 text-center">Loading form...</p> }
);

const DynamicThemeToggle = dynamic(() =>
  import('@/components/ThemeToggle').then((mod) => mod.ThemeToggle),
  { loading: () => <DropdownMenuItem disabled>Theme...</DropdownMenuItem> }
);

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
  const isMobile = useIsMobile();

  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isRequestHelpDialogOpen, setIsRequestHelpDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const setVisualViewportHeight = () => {
      if (typeof window !== 'undefined') {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh-dynamic', `${vh}px`);
      }
    };
    if (isMobile) {
      setVisualViewportHeight();
      window.addEventListener('resize', setVisualViewportHeight);
      window.addEventListener('orientationchange', setVisualViewportHeight);
    }
    return () => {
      if (isMobile) {
        window.removeEventListener('resize', setVisualViewportHeight);
        window.removeEventListener('orientationchange', setVisualViewportHeight);
      }
    };
  }, [isMobile]);


  useEffect(() => {
    if (isCreatePostOpen) setIsCreatePostOpen(false);
    if (isRequestHelpDialogOpen) setIsRequestHelpDialogOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);


  const addPostMutation = useMutation({
    mutationFn: async (newPostDataWithImage: NewPostData & {
      imageFile?: File | null | undefined;
    }) => {
      if (!user) {
        throw new Error("User not authenticated to create post.");
      }
      let uploadedImageUrls: string[] = [];
      if (newPostDataWithImage.imageFile) {
        try {
          const singleUploadedUrl = await uploadPostImage(newPostDataWithImage.imageFile, user.uid);
          if (!singleUploadedUrl) {
            throw new Error("Image upload succeeded but returned no URL.");
          }
          uploadedImageUrls.push(singleUploadedUrl);
        } catch (uploadError) {
          console.error("[MainLayout] Image upload failed in mutationFn:", uploadError);
          throw uploadError;
        }
      }

      const finalImageUrls = uploadedImageUrls.length > 0 ? uploadedImageUrls : [];
      const { imageFile, ...postDataForFirestoreBase } = newPostDataWithImage;

      const mentionedUserIds = Array.isArray(newPostDataWithImage.mentionedUserIds) ? newPostDataWithImage.mentionedUserIds : [];

      const postDataForFirestore: NewPostData = {
        ...postDataForFirestoreBase,
        imageUrls: finalImageUrls,
        mentionedUserIds: mentionedUserIds,
        requestType: 'post', // Regular post
      };
      return addPostToFirestore(postDataForFirestore);
    },
    onSuccess: (newlyCreatedPostId, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['allPostsForSectorPage'] });
      toast({
        title: "Post Created",
        description: "Your post has been added to the board.",
      });
      setIsCreatePostOpen(false);


      if (user && newlyCreatedPostId && variables.mentionedUserIds && variables.mentionedUserIds.length > 0) {
        variables.mentionedUserIds.forEach(async (mentionedUid) => {
          if (mentionedUid !== user.uid) {
            try {
              await createNotification({
                userId: mentionedUid,
                type: 'mention',
                senderId: user.uid,
                postId: newlyCreatedPostId,
                postQuestion: variables.question,
                textSnippet: variables.description ? variables.description.substring(0, 100) : "You were mentioned!",
              });
            } catch (notifyError) {
              console.error(`[MainLayout] Failed to create mention notification for post ${newlyCreatedPostId}:`, notifyError);
            }
          }
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Post Failed",
        description: `Could not submit your post: ${error.message}.`,
      });
    },
  });

  const addHelpRequestMutation = useMutation({
      mutationFn: async (newHelpRequestDataWithImage: NewPostData & {
          imageFile?: File | null | undefined;
      }) => {
          if (!user) {
              throw new Error("User not authenticated to request help.");
          }
          let uploadedImageUrls: string[] = [];
          if (newHelpRequestDataWithImage.imageFile) {
              try {
                  const singleUploadedUrl = await uploadPostImage(newHelpRequestDataWithImage.imageFile, user.uid);
                  if (!singleUploadedUrl) {
                      throw new Error("Image upload succeeded but returned no URL for help request.");
                  }
                  uploadedImageUrls.push(singleUploadedUrl);
              } catch (uploadError) {
                  console.error("[MainLayout] Image upload failed for help request in mutationFn:", uploadError);
                  throw uploadError;
              }
          }

          const finalImageUrls = uploadedImageUrls.length > 0 ? uploadedImageUrls : [];
          const { imageFile, ...postDataForFirestoreBase } = newHelpRequestDataWithImage;

          const mentionedUserIds = Array.isArray(newHelpRequestDataWithImage.mentionedUserIds) ? newHelpRequestDataWithImage.mentionedUserIds : [];


          const postDataForFirestore: NewPostData = {
              ...postDataForFirestoreBase,
              imageUrls: finalImageUrls,
              mentionedUserIds: mentionedUserIds,
              requestType: 'help_request',
          };
          return addPostToFirestore(postDataForFirestore);
      },
      onSuccess: (newlyCreatedPostId, variables) => {
          queryClient.invalidateQueries({ queryKey: ['posts'] });
          queryClient.invalidateQueries({ queryKey: ['userPosts'] });
          queryClient.invalidateQueries({ queryKey: ['allPostsForSectorPage'] });
          toast({
              title: "Help Request Submitted",
              description: "Your request for help has been posted.",
          });
          setIsRequestHelpDialogOpen(false);

          if (user && newlyCreatedPostId && variables.mentionedUserIds && variables.mentionedUserIds.length > 0) {
              variables.mentionedUserIds.forEach(async (mentionedUid) => {
                  if (mentionedUid !== user.uid) { // Don't notify self for mentioning self in post
                      try {
                          await createNotification({
                              userId: mentionedUid,
                              type: 'mention',
                              senderId: user.uid,
                              postId: newlyCreatedPostId,
                              postQuestion: variables.question,
                              textSnippet: variables.descriptionDetails ? variables.descriptionDetails.substring(0, 100) : "You were mentioned in a help request!",
                          });
                      } catch (notifyError) {
                          console.error(`[MainLayout] Failed to create mention notification for help request ${newlyCreatedPostId}:`, notifyError);
                      }
                  }
              });
          }
      },
      onError: (error: Error) => {
          toast({
              variant: "destructive",
              title: "Request Failed",
              description: `Could not submit your help request: ${error.message}.`,
          });
      },
  });


  const handleAddPost = useCallback(
    (formData: CreatePostFormData) => {
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

      const newPostDataForService: NewPostData & { imageFile?: File | null } = {
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
        ratingScore: 0,
        imageFile: formData.imageFile,
        imageUrls: [],
        mentionedUserIds: formData.mentionedUserIds,
        requestType: 'post',
      };
      addPostMutation.mutate(newPostDataForService);
    },
    [user, toast, addPostMutation, queryClient]
  );

  const handleRequestHelpSubmit = useCallback(
    (formData: CreatePostFormData) => { // Using CreatePostFormData as it's a duplicate
      if (!user) {
        toast({ variant: "destructive", title: "Authentication Required" });
        return;
      }
      const mainSectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
      const subSectorDetails = mainSectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
      const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

      const newHelpRequestData: NewPostData & { imageFile?: File | null } = {
        question: formData.question,
        description: formData.description, // From CreatePostForm, will be general description
        tags: formData.tags || [],
        sector: mainSectorDetails?.name || formData.sector,
        subSector: subSectorDetails?.name || formData.subSector,
        industry: industryDetails?.name || formData.industry,
        naicsCode: formData.industry || formData.subSector || formData.sector,
        userId: user.uid,
        businessType: "Project",
        safetyIndicator: "Medium",
        ratingScore: 0,
        imageFile: formData.imageFile,
        imageUrls: [],
        mentionedUserIds: formData.mentionedUserIds,
        requestType: 'help_request', // Key difference
      };
      addHelpRequestMutation.mutate(newHelpRequestData);
    },
    [user, toast, addHelpRequestMutation, queryClient]
  );


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

  const rootLayoutClasses = cn(
    "flex flex-col bg-background",
    isMobile ? "h-[calc(var(--vh-dynamic,1vh)*100)]" : "min-h-screen"
  );


  return (
    <div className={rootLayoutClasses}>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center">
          <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <Factory className="h-6 w-6 text-primary" />
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
                    "transition-colors hover:text-foreground/80 flex items-center",
                    pathname === item.href ? 'text-foreground font-semibold' : 'text-foreground/60'
                  )}
                >
                  <item.icon className="mr-1 h-4 w-4" aria-hidden="true" />
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-4">
            {user && (
              <>
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
                      {isCreatePostOpen && user && (
                        <DynamicCreatePostForm
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

                <Dialog open={isRequestHelpDialogOpen} onOpenChange={setIsRequestHelpDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                      <Handshake className="mr-2 h-4 w-4" />
                      Request Help
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                      <DialogTitle>Request Assistance</DialogTitle>
                      <DialogDescription>
                        Describe the help you need. This will be posted to the board.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
                      {isRequestHelpDialogOpen && user && (
                        <DynamicRequestHelpForm
                          onSubmit={handleRequestHelpSubmit}
                          availableTags={availableTags}
                          detailedSectorsData={detailedSectorsData}
                          isSubmitting={addHelpRequestMutation.isPending}
                          currentUserId={user.uid}
                        />
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                {user.uid && <NotificationDropdown userId={user.uid} />}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="User Menu" className="rounded-full h-8 w-8">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.photoURL ?? undefined} alt={getInitials(user.displayName || user.email)} />
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
                    <DynamicThemeToggle />
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

      <main className={cn(
        "flex-1 flex flex-col",
        isMobile ? "pb-14" : "pb-0"
      )}>
        {children}
      </main>

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden h-14">
          <div className="container mx-auto flex justify-around items-center h-full">
            {navItems.map((item) => (
              <Link
                key={`mobile-${item.title}`}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center text-xs px-2 py-1 rounded-md transition-colors w-1/4 h-full",
                  pathname === item.href ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'
                )}
              >
                <item.icon className="h-5 w-5 mb-0.5" />
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}

      {!isMobile && (
        <footer className="py-4 border-t md:mt-auto">
          <div className="container mx-auto text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} AnonyCollab. All rights reserved.
          </div>
        </footer>
      )}
    </div>
  );
}
