// src/components/layout/MainLayout.tsx
"use client";

import React,
{
  useState,
  useEffect
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
  Bell,
  Handshake, 
  HelpingHand 
} from "lucide-react"; 
import { signOut } from '@/lib/firebase/auth'; 
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import {
  CreatePostForm,
  type CreatePostFormData,
} from '@/components/CreatePostForm';
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
import {
  ThemeToggle
} from '@/components/ThemeToggle';
import {
  cn
} from '@/lib/utils';
import {
  NotificationDropdown
} from '@/components/notifications/NotificationDropdown';
import { createNotification } from '@/services/notificationService';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { Timestamp } from 'firebase/firestore';
import { useIsMobile } from "@/hooks/use-mobile";


// This data is now the single source of truth for sector hierarchy.
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
      { name: "Coal Mining", code: "212", industries: [{ name: "Bituminous Coal and Lignite Surface Mining", code: "212111" }, { name: "Bituminous Coal Underground Mining", code: "212112" }, { name: "Anthracite Mining", code: "212113" }] },
      { name: "Metal Ore Mining", code: "212", industries: [{ name: "Iron Ore Mining", code: "212210" }, { name: "Gold Ore Mining", code: "212221" }, { name: "Silver Ore Mining", code: "212222" }, { name: "Copper, Nickel, Lead, and Zinc Mining", code: "212230" }] },
      { name: "Nonmetallic Mineral Mining and Quarrying", code: "212", industries: [{ name: "Dimension Stone Mining and Quarrying", code: "212311" }, { name: "Crushed and Broken Limestone Mining and Quarrying", code: "212312" }, { name: "Construction Sand and Gravel Mining", code: "212321" }, { name: "Industrial Sand Mining", code: "212322" }, { name: "Clay and Ceramic and Refractory Minerals Mining", code: "212325" }] },
      { name: "Support Activities for Mining", code: "213", industries: [{ name: "Drilling Oil and Gas Wells", code: "213111" }, { name: "Support Activities for Oil and Gas Operations", code: "213112" }, { name: "Support Activities for Coal Mining", code: "213113" }] },
    ]
  },
  {
    name: "Utilities", code: "22", description: "Establishments engaged in providing utility services such as electric power, natural gas, steam supply, water supply, and sewage removal.",
    subSectors: [
      { name: "Electric Power Generation, Transmission and Distribution", code: "221", industries: [{ name: "Hydroelectric Power Generation", code: "221111" }, { name: "Fossil Fuel Electric Power Generation", code: "221112" }, { name: "Nuclear Electric Power Generation", code: "221113" }, { name: "Electric Bulk Power Transmission and Control", code: "221121" }, { name: "Electric Power Distribution", code: "221122" }] },
      { name: "Natural Gas Distribution", code: "221", industries: [{ name: "Natural Gas Distribution", code: "221210" }] },
      { name: "Water, Sewage and Other Systems", code: "221", industries: [{ name: "Water Supply and Irrigation Systems", code: "221310" }, { name: "Sewage Treatment Facilities", code: "221320" }, { name: "Steam and Air-Conditioning Supply", code: "221330" }] },
    ]
  },
  {
    name: "Construction", code: "23", description: "Establishments primarily engaged in the construction of buildings and engineering projects.",
    subSectors: [
      { name: "Construction of Buildings", code: "236", industries: [{ name: "Residential Building Construction", code: "23611" }, { name: "Nonresidential Building Construction", code: "236220" }] },
      { name: "Heavy and Civil Engineering Construction", code: "237", industries: [{ name: "Water and Sewer Line and Related Structures Construction", code: "237110" }, { name: "Oil and Gas Pipeline and Related Structures Construction", code: "237120" }, { name: "Power and Communication Line and Related Structures Construction", code: "237130" }, { name: "Highway, Street, and Bridge Construction", code: "237310" }] },
      { name: "Specialty Trade Contractors", code: "238", industries: [{ name: "Plumbing, Heating, and Air-Conditioning Contractors", code: "238220" }, { name: "Electrical Contractors and Other Wiring Installation Contractors", code: "238210" }, { name: "Painting and Wall Covering Contractors", code: "238320" }, { name: "Site Preparation Contractors", code: "238910" }] },
    ]
  },
  {
    name: "Manufacturing", code: "31-33", description: "Mechanical, physical, or chemical transformation of materials, substances, or components into new products.",
    subSectors: [
      { name: "Food Manufacturing", code: "311", industries: [{ name: "Animal Food Manufacturing", code: "3111" }, { name: "Grain and Oilseed Milling", code: "3112" }, { name: "Sugar and Confectionery Product Manufacturing", code: "3113" }, {name: "Fruit and Vegetable Preserving and Specialty Food Manufacturing", code: "3114"}]},
      { name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [{ name: "Beverage Manufacturing", code: "3121" }, { name: "Tobacco Manufacturing", code: "3122" }] },
      { name: "Textile Mills", code: "313", industries: [{ name: "Fiber, Yarn, and Thread Mills", code: "3131" }, { name: "Fabric Mills", code: "3132" }] },
      { name: "Apparel Manufacturing", code: "315", industries: [{ name: "Apparel Knitting Mills", code: "3151" }, { name: "Cut and Sew Apparel Manufacturing", code: "3152" }] },
      { name: "Chemical Manufacturing", code: "325", industries: [{ name: "Basic Chemical Manufacturing", code: "3251" }, { name: "Pharmaceutical and Medicine Manufacturing", code: "3254" }] },
      { name: "Transportation Equipment Manufacturing", code: "336", industries: [{ name: "Motor Vehicle Manufacturing", code: "3361" }, { name: "Aerospace Product and Parts Manufacturing", code: "3364" }] },
      { name: "Wood Product Manufacturing", code: "321", industries: [{name: "Sawmills and Wood Preservation", code: "3211"}, {name: "Veneer, Plywood, and Engineered Wood Product Manufacturing", code: "3212"}]},
      { name: "Paper Manufacturing", code: "322", industries: [{name: "Pulp, Paper, and Paperboard Mills", code: "3221"}, {name: "Converted Paper Product Manufacturing", code: "3222"}]},
      { name: "Plastics and Rubber Products Manufacturing", code: "326", industries: [{name: "Plastics Product Manufacturing", code: "3261"}, {name: "Rubber Product Manufacturing", code: "3262"}]},
      { name: "Primary Metal Manufacturing", code: "331", industries: [{name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "3311"}, {name: "Steel Product Manufacturing from Purchased Steel", code: "3312"}]}
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
    ]
  },
  {
    name: "Information", code: "51", description: "Establishments engaged in producing and distributing information and cultural products.",
    subSectors: [
      { name: "Publishing Industries (except Internet)", code: "513", industries: [{ name: "Newspaper, Periodical, Book, and Directory Publishers", code: "5131" }, { name: "Software Publishers", code: "5132" }] },
      { name: "Motion Picture and Sound Recording Industries", code: "512", industries: [{ name: "Motion Picture and Video Industries", code: "5121" }, { name: "Sound Recording Industries", code: "5122" }] },
      { name: "Broadcasting and Content Providers", code: "516", industries: [{ name: "Radio and Television Broadcasting Stations", code: "5161" }, {name: "Content Providers, Web Search Portals, and Data Processing Services", code: "5162"}] },
      { name: "Telecommunications", code: "517", industries: [{ name: "Wired and Wireless Telecommunications Carriers (except Satellite)", code: "5171" }, { name: "Satellite Telecommunications", code: "5174" }, {"name": "Other Telecommunications", code: "5179"}] },
    ]
  },
  {
    name: "Finance and Insurance", code: "52", description: "Establishments primarily engaged in financial transactions or in facilitating financial transactions.",
    subSectors: [
      { name: "Monetary Authorities - Central Bank", code: "521", industries: [{ name: "Monetary Authorities - Central Bank", code: "5211" }] },
      { name: "Credit Intermediation and Related Activities", code: "522", industries: [{ name: "Depository Credit Intermediation", code: "5221" }, { name: "Nondepository Credit Intermediation", code: "5222" }, { name: "Activities Related to Credit Intermediation", code: "5223" }] },
      { name: "Securities, Commodity Contracts, and Other Financial Investments and Related Activities", code: "523", industries: [{ name: "Securities and Commodity Contracts Intermediation and Brokerage", code: "5231" }, { name: "Securities and Commodity Exchanges", code: "5232" }] },
      { name: "Insurance Carriers and Related Activities", code: "524", industries: [{ name: "Insurance Carriers", code: "5241" }, { name: "Agencies, Brokerages, and Other Insurance Related Activities", code: "5242" }] },
    ]
  },
  {
    name: "Real Estate and Rental and Leasing", code: "53", description: "Establishments primarily engaged in renting, leasing, or otherwise allowing the use of tangible or intangible assets.",
    subSectors: [
      { name: "Real Estate", code: "531", industries: [{ name: "Lessors of Real Estate", code: "5311" }, { name: "Offices of Real Estate Agents and Brokers", code: "5312" }, { name: "Activities Related to Real Estate", code: "5313" }] },
      { name: "Rental and Leasing Services", code: "532", industries: [{ name: "Automotive Equipment Rental and Leasing", code: "5321" }, { name: "Consumer Goods Rental", code: "5322" }, { name: "General Rental Centers", code: "5323" }] },
      { name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533", industries: [{ name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "5331" }] },
    ]
  },
  {
    name: "Professional, Scientific, and Technical Services", code: "54", description: "Establishments that specialize in performing professional, scientific, and technical activities for others.",
    subSectors: [
      { name: "Legal Services", code: "541", industries: [{ name: "Offices of Lawyers", code: "541110" }, { name: "Other Legal Services", code: "54119" }] },
      { name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "541", industries: [{ name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "54121" }] },
      { name: "Architectural, Engineering, and Related Services", code: "541", industries: [{ name: "Architectural Services", code: "541310" }, { name: "Engineering Services", code: "541330" }, { name: "Geophysical Surveying and Mapping Services", code: "541360" }] },
      { name: "Computer Systems Design and Related Services", code: "541", industries: [{ name: "Computer Systems Design and Related Services", code: "54151" }] },
      { name: "Management, Scientific, and Technical Consulting Services", code: "541", industries: [{ name: "Management Consulting Services", code: "54161" }, { name: "Environmental Consulting Services", code: "541620" }] },
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
      { name: "Administrative and Support Services", code: "561", industries: [{ name: "Office Administrative Services", code: "5611" }, { name: "Facilities Support Services", code: "5612" }, { name: "Employment Services", code: "5613" }, { name: "Investigation and Security Services", code: "5616" }] },
      { name: "Waste Management and Remediation Services", code: "562", industries: [{ name: "Waste Collection", code: "5621" }, { name: "Waste Treatment and Disposal", code: "5622" }, { name: "Remediation and Other Waste Management Services", code: "5629" }] },
    ]
  },
  {
    name: "Educational Services", code: "61", description: "Establishments that provide instruction and training in a wide variety of subjects.",
    subSectors: [
      { name: "Elementary and Secondary Schools", code: "611", industries: [{ name: "Elementary and Secondary Schools", code: "6111" }] },
      { name: "Junior Colleges", code: "611", industries: [{ name: "Junior Colleges", code: "6112" }] },
      { name: "Colleges, Universities, and Professional Schools", code: "611", industries: [{ name: "Colleges, Universities, and Professional Schools", code: "6113" }] },
      { name: "Other Schools and Instruction", code: "611", industries: [{ name: "Business and Secretarial Schools", code: "611410" }, { name: "Fine Arts Schools", code: "611610" }] },
    ]
  },
  {
    name: "Health Care and Social Assistance", code: "62", description: "Establishments providing health care and social assistance for individuals.",
    subSectors: [
      { name: "Ambulatory Health Care Services", code: "621", industries: [{ name: "Offices of Physicians", code: "6211" }, { name: "Offices of Dentists", code: "6212" }, { name: "Medical and Diagnostic Laboratories", code: "6215" }] },
      { name: "Hospitals", code: "622", industries: [{ name: "General Medical and Surgical Hospitals", code: "6221" }, { name: "Psychiatric and Substance Abuse Hospitals", code: "6222" }] },
      { name: "Nursing and Residential Care Facilities", code: "623", industries: [{ name: "Nursing Care Facilities (Skilled Nursing Facilities)", code: "6231" }, { name: "Residential Intellectual and Developmental Disability, Mental Health, and Substance Abuse Facilities", code: "6232" }] },
      { name: "Social Assistance", code: "624", industries: [{ name: "Individual and Family Services", code: "6241" }, { name: "Community Food and Housing, and Emergency and Other Relief Services", code: "6242" }] },
    ]
  },
  {
    name: "Arts, Entertainment, and Recreation", code: "71", description: "Establishments that operate facilities or provide services to meet varied cultural, entertainment, and recreational interests.",
    subSectors: [
      { name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [{ name: "Performing Arts Companies", code: "7111" }, { name: "Spectator Sports", code: "7112" }, { name: "Promoters of Performing Arts, Sports, and Similar Events", code: "7113" }] },
      { name: "Museums, Historical Sites, and Similar Institutions", code: "712", industries: [{ name: "Museums, Historical Sites, and Similar Institutions", code: "7121" }] },
      { name: "Amusement, Gambling, and Recreation Industries", code: "713", industries: [{ name: "Amusement Parks and Arcades", code: "7131" }, { name: "Gambling Industries", code: "7132" }, { name: "Other Amusement and Recreation Industries", code: "7139" }] },
    ]
  },
  {
    name: "Accommodation and Food Services", code: "72", description: "Establishments providing customers with lodging and/or preparing meals, snacks, and beverages for immediate consumption.",
    subSectors: [
      { name: "Accommodation", code: "721", industries: [{ name: "Traveler Accommodation", code: "7211" }, { name: "RV (Recreational Vehicle) Parks and Recreational Camps", code: "7212" }, { name: "Rooming and Boarding Houses, Dormitories, and Workers' Camps", code: "7213" }] },
      { name: "Food Services and Drinking Places", code: "722", industries: [{ name: "Full-Service Restaurants", code: "722511" }, { name: "Limited-Service Restaurants", code: "722513" }, { name: "Special Food Services", code: "7223" }, { name: "Drinking Places (Alcoholic Beverages)", code: "7224" }] },
    ]
  },
  {
    name: "Other Services (except Public Administration)", code: "81", description: "Establishments engaged in providing services not elsewhere classified.",
    subSectors: [
      { name: "Repair and Maintenance", code: "811", industries: [{ name: "Automotive Repair and Maintenance", code: "8111" }, { name: "Electronic and Precision Equipment Repair and Maintenance", code: "8112" }, { name: "Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance", code: "8113" }] },
      { name: "Personal and Laundry Services", code: "812", industries: [{ name: "Personal Care Services", code: "8121" }, { name: "Drycleaning and Laundry Services", code: "8123" }, { name: "Other Personal Services", code: "8129" }] },
      { name: "Religious, Grantmaking, Civic, Professional, and Similar Organizations", code: "813", industries: [{ name: "Religious Organizations", code: "8131" }, { name: "Grantmaking and Giving Services", code: "8132" }, { name: "Social Advocacy Organizations", code: "8133" }] },
    ]
  },
  {
    name: "Public Administration", code: "92", description: "Establishments of federal, state, and local government agencies that administer, oversee, and manage public programs.",
    subSectors: [
      { name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [{ name: "Executive Offices", code: "921110" }, { name: "Legislative Bodies", code: "921120" }] },
      { name: "Justice, Public Order, and Safety Activities", code: "922", industries: [{ name: "Courts", code: "922110" }, { name: "Police Protection", code: "922120" }, { name: "Correctional Institutions", code: "922140" }] },
      { name: "National Security and International Affairs", code: "928", industries: [{ name: "National Security", code: "928110" }, { name: "International Affairs", code: "928120" }] },
    ]
  },
];


const navItems = [
  { title: "Board", href: "/", icon: Home },
  { title: "Discover", href: "/discover", icon: Compass },
  { title: "Connect", href: "/connect", icon: Network },
  { title: "Contracts", href: "/contracts", icon: FileText },
];

export const formSectors = detailedSectorsData.map(sector => ({
  name: sector.name,
  code: sector.code,
}));

export const availableTags = [
  "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];


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
    if (isCreatePostOpen) setIsCreatePostOpen(false);
    if (isRequestHelpDialogOpen) setIsRequestHelpDialogOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);


  const addPostMutation = useMutation({
    mutationFn: async (newPostDataWithImage: NewPostData & {
      imageFile?: File | null | undefined; mentionedUserIds?: string[]
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

      const finalImageUrls = uploadedImageUrls.length > 0 ? uploadedImageUrls : [];
      const { imageFile, ...postDataForFirestoreBase } = newPostDataWithImage;

      const postDataForFirestore: NewPostData = {
        ...postDataForFirestoreBase,
        imageUrls: finalImageUrls,
        mentionedUserIds: newPostDataWithImage.mentionedUserIds || [],
      };

      console.log("[MainLayout] Data for Firestore (addPostMutation):", JSON.stringify(postDataForFirestore, null, 2));
      return addPostToFirestore(postDataForFirestore);
    },
    onSuccess: (newlyCreatedPostId, variables) => {
      console.log("[MainLayout] addPostMutation onSuccess. Newly created Post ID:", newlyCreatedPostId, "Variables:", variables);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['allPostsForSectorPage'] });
      toast({
        title: variables.requestType === 'help_request' ? "Help Request Submitted" : "Post Created",
        description: variables.requestType === 'help_request' ? "Your request for help has been posted." : "Your post has been added to the board.",
      });
      setIsCreatePostOpen(false);
      setIsRequestHelpDialogOpen(false);


      if (user && newlyCreatedPostId && variables.mentionedUserIds && variables.mentionedUserIds.length > 0) {
        console.log(`[MainLayout] Post/Request created, triggering notifications for ${variables.mentionedUserIds.length} mentions.`);
        variables.mentionedUserIds.forEach(async (mentionedUid) => {
          if (mentionedUid !== user.uid) { 
            try {
              await createNotification({
                userId: mentionedUid,
                type: 'mention',
                senderId: user.uid,
                postId: newlyCreatedPostId,
                postQuestion: variables.question,
                textSnippet: variables.description ? variables.description.substring(0, 100) : (variables.requestType === 'help_request' ? "You were mentioned in a help request!" : "You were mentioned in a new post!"),
              });
              console.log(`[MainLayout] Mention notification created for user ${mentionedUid} in post/request ${newlyCreatedPostId}`);
            } catch (notifyError) {
              console.error(`[MainLayout] Failed to create mention notification for user ${mentionedUid} in post/request ${newlyCreatedPostId}:`, notifyError);
            }
          }
        });
      }
    },
    onError: (error: Error, variables) => {
      console.error("[MainLayout] addPostMutation onError. Error:", error, "Variables:", variables);
      toast({
        variant: "destructive",
        title: variables.requestType === 'help_request' ? "Request Failed" : "Post Failed",
        description: `Could not submit your ${variables.requestType === 'help_request' ? 'help request' : 'post'}: ${error.message}. Check console and Firestore rules.`,
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
      requestType: 'post', 
    };

    console.log("[MainLayout] Calling addPostMutation.mutate with (regular post):", newPostDataForService);
    addPostMutation.mutate(newPostDataForService);
  };

  const handleRequestHelpSubmit = (formData: CreatePostFormData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required" });
      return;
    }
    const mainSectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
    const subSectorDetails = mainSectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
    const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

    const newHelpRequestData: NewPostData & { imageFile?: File | null; mentionedUserIds?: string[] } = {
      question: formData.question,
      description: formData.description,
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
      mentionedUserIds: formData.mentionedUserIds || [],
      requestType: 'help_request', 
    };
    console.log("[MainLayout] Calling addHelpRequestMutation (same as addPostMutation) with (help request):", newHelpRequestData);
    addPostMutation.mutate(newHelpRequestData); 
  };


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
                      {isCreatePostOpen && (
                        <CreatePostForm
                          onSubmit={handleAddPost}
                          availableTags={availableTags}
                          detailedSectorsData={detailedSectorsData}
                          isSubmitting={addPostMutation.isPending && addPostMutation.variables?.requestType === 'post'}
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
                      {isRequestHelpDialogOpen && (
                        <CreatePostForm 
                          onSubmit={handleRequestHelpSubmit}
                          availableTags={availableTags}
                          detailedSectorsData={detailedSectorsData}
                          isSubmitting={addPostMutation.isPending && addPostMutation.variables?.requestType === 'help_request'}
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

      <main className="flex-1 flex flex-col pb-14 md:pb-0"> {/* Ensure main can grow and provide height context */}
        {children}
      </main>

      {/* Bottom Navigation for Mobile */}
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

      {!isMobile && (
          <footer className="py-4 border-t mt-auto">
            <div className="container mx-auto text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} AnonyCollab. All rights reserved.
            </div>
          </footer>
      )}
    </div>
  );
}
