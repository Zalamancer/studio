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
  DialogClose
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Home, Compass, Network, FileText, LogOut, PlusCircle, UserCircle, CreditCard, Settings, User, Bell, Factory, Handshake, HelpingHand } from "lucide-react";
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import type {
  CreatePostFormData
} from '@/components/CreatePostForm'; // Ensure correct type import path
import {
  RequestHelpFormData
} from '@/components/RequestHelpForm';
import type {
  NewPostData,
  SectorWithSubSectors,
  SubSector,
  Industry
} from '@/types/post';
import {
  addPostToFirestore
} from '@/services/postService';
import {
  uploadPostImage
} from '@/services/storageService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { createNotification } from '@/services/notificationService';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { Timestamp } from 'firebase/firestore';
import { useIsMobile } from "@/hooks/use-mobile";
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { getReviewsForProfile } from '@/services/reviewService';


export const detailedSectorsData: SectorWithSubSectors[] = [
  {
    name: "Agriculture, Forestry, Fishing and Hunting", code: "11",
    description: "Growing crops, raising animals, harvesting timber, and fishing.",
    subSectors: [
      { name: "Crop Production", code: "111", industries: [
          { name: "Oilseed and Grain Farming", code: "1111" },
          { name: "Vegetable and Melon Farming", code: "1112" },
          { name: "Fruit and Tree Nut Farming", code: "1113" },
          { name: "Greenhouse, Nursery, and Floriculture Production", code: "1114" },
          { name: "Other Crop Farming", code: "1119" },
        ]
      },
      { name: "Animal Production and Aquaculture", code: "112", industries: [
          { name: "Cattle Ranching and Farming", code: "1121" },
          { name: "Hog and Pig Farming", code: "1122" },
          { name: "Poultry and Egg Production", code: "1123" },
          { name: "Sheep and Goat Farming", code: "1124" },
          { name: "Aquaculture", code: "1125" },
          { name: "Other Animal Production", code: "1129" },
        ]
      },
      { name: "Forestry and Logging", code: "113", industries: [
          { name: "Timber Tract Operations", code: "1131" },
          { name: "Forest Nurseries and Gathering of Forest Products", code: "1132" },
          { name: "Logging", code: "1133" },
        ]
      },
      { name: "Fishing, Hunting and Trapping", code: "114", industries: [
          { name: "Fishing", code: "1141" },
          { name: "Hunting and Trapping", code: "1142" },
        ]
      },
      { name: "Support Activities for Agriculture and Forestry", code: "115", industries: [
          { name: "Support Activities for Crop Production", code: "1151" },
          { name: "Support Activities for Animal Production", code: "1152" },
          { name: "Support Activities for Forestry", code: "1153" },
        ]
      },
    ]
  },
  {
    name: "Mining, Quarrying, and Oil and Gas Extraction", code: "21",
    description: "Extracting naturally occurring mineral solids, liquids, and gases.",
    subSectors: [
      { name: "Oil and Gas Extraction", code: "211", industries: [{ name: "Crude Petroleum and Natural Gas Extraction", code: "2111" }] },
      { name: "Coal Mining", code: "2121", industries: [{ name: "Coal Mining", code: "21211" }] },
      { name: "Metal Ore Mining", code: "2122", industries: [{ name: "Iron Ore Mining", code: "21221" }, { name: "Gold and Silver Ore Mining", code: "21222" }] },
      { name: "Nonmetallic Mineral Mining and Quarrying", code: "2123", industries: [{ name: "Stone Mining and Quarrying", code: "21231" }, { name: "Sand, Gravel, Clay, and Ceramic and Refractory Minerals Mining and Quarrying", code: "21232" }] },
      { name: "Support Activities for Mining", code: "213", industries: [{ name: "Support Activities for Oil and Gas Operations", code: "213111" }, {name: "Support Activities for Coal Mining", code: "213113"}] },
    ]
  },
  {
    name: "Utilities", code: "22",
    description: "Providing utility services like electric power, natural gas, water, and sewage.",
    subSectors: [
      { name: "Electric Power Generation, Transmission and Distribution", code: "2211", industries: [{ name: "Electric Power Generation", code: "22111" }, { name: "Electric Power Transmission, Control, and Distribution", code: "22112" }] },
      { name: "Natural Gas Distribution", code: "2212", industries: [{ name: "Natural Gas Distribution", code: "221210" }] },
      { name: "Water, Sewage and Other Systems", code: "2213", industries: [{ name: "Water Supply and Irrigation Systems", code: "221310" }, { name: "Sewage Treatment Facilities", code: "221320" }] },
    ]
  },
  {
    name: "Construction", code: "23",
    description: "Construction of buildings and engineering projects.",
    subSectors: [
      { name: "Construction of Buildings", code: "236", industries: [{ name: "Residential Building Construction", code: "2361" }, { name: "Nonresidential Building Construction", code: "2362" }] },
      { name: "Heavy and Civil Engineering Construction", code: "237", industries: [{ name: "Utility System Construction", code: "2371" }, { name: "Highway, Street, and Bridge Construction", code: "2373" }, { name: "Other Heavy and Civil Engineering Construction", code: "2379" }] },
      { name: "Specialty Trade Contractors", code: "238", industries: [{ name: "Foundation, Structure, and Building Exterior Contractors", code: "2381" }, { name: "Building Equipment Contractors", code: "2382" }, { name: "Building Finishing Contractors", code: "2383" }, { name: "Other Specialty Trade Contractors", code: "2389" }] },
    ]
  },
  {
    name: "Manufacturing", code: "31-33",
    description: "Mechanical, physical, or chemical transformation of materials into new products.",
    subSectors: [
      { name: "Food Manufacturing", code: "311", industries: [ { name: "Animal Food Manufacturing", code: "3111" }, { name: "Grain and Oilseed Milling", code: "3112" }, { name: "Sugar and Confectionery Product Manufacturing", code: "3113" }, { name: "Fruit and Vegetable Preserving and Specialty Food Manufacturing", code: "3114"}, { name: "Dairy Product Manufacturing", code: "3115"}, { name: "Animal Slaughtering and Processing", code: "3116"}, { name: "Seafood Product Preparation and Packaging", code: "3117"}, { name: "Bakeries and Tortilla Manufacturing", code: "3118"}, { name: "Other Food Manufacturing", code: "3119"}] },
      { name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [ { name: "Beverage Manufacturing", code: "3121" }, { name: "Tobacco Manufacturing", code: "3122" } ] },
      { name: "Textile Mills", code: "313", industries: [ { name: "Fiber, Yarn, and Thread Mills", code: "3131" }, { name: "Fabric Mills", code: "3132" }, {name: "Textile and Fabric Finishing and Fabric Coating Mills", code: "3133" } ] },
      { name: "Textile Product Mills", code: "314", industries: [ { name: "Textile Furnishings Mills", code: "3141" }, { name: "Other Textile Product Mills", code: "3149" } ] },
      { name: "Apparel Manufacturing", code: "315", industries: [ { name: "Apparel Knitting Mills", code: "3151" }, { name: "Cut and Sew Apparel Manufacturing", code: "3152" }, { name: "Apparel Accessories and Other Apparel Manufacturing", code: "3159" } ] },
      { name: "Leather and Allied Product Manufacturing", code: "316", industries: [ { name: "Leather and Hide Tanning and Finishing", code: "3161" }, { name: "Footwear Manufacturing", code: "3162" }, { name: "Other Leather and Allied Product Manufacturing", code: "3169" } ] },
      { name: "Wood Product Manufacturing", code: "321", industries: [ { name: "Sawmills and Wood Preservation", code: "3211" }, { name: "Veneer, Plywood, and Engineered Wood Product Manufacturing", code: "3212" }, { name: "Other Wood Product Manufacturing", code: "3219" } ] },
      { name: "Paper Manufacturing", code: "322", industries: [ { name: "Pulp, Paper, and Paperboard Mills", code: "3221" }, { name: "Converted Paper Product Manufacturing", code: "3222" } ] },
      { name: "Printing and Related Support Activities", code: "323", industries: [ { name: "Printing and Related Support Activities", code: "3231" } ] },
      { name: "Petroleum and Coal Products Manufacturing", code: "324", industries: [ { name: "Petroleum and Coal Products Manufacturing", code: "3241" } ] },
      { name: "Chemical Manufacturing", code: "325", industries: [ { name: "Basic Chemical Manufacturing", code: "3251" }, { name: "Resin, Synthetic Rubber, and Artificial Synthetic Fibers and Filaments Manufacturing", code: "3252" }, { name: "Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing", code: "3253" }, { name: "Pharmaceutical and Medicine Manufacturing", code: "3254"}, { name: "Paint, Coating, and Adhesive Manufacturing", code: "3255"}, { name: "Soap, Cleaning Compound, and Toilet Preparation Manufacturing", code: "3256"}, { name: "Other Chemical Product and Preparation Manufacturing", code: "3259"} ] },
      { name: "Plastics and Rubber Products Manufacturing", code: "326", industries: [ { name: "Plastics Product Manufacturing", code: "3261" }, { name: "Rubber Product Manufacturing", code: "3262" } ] },
      { name: "Nonmetallic Mineral Product Manufacturing", code: "327", industries: [ { name: "Clay Product and Refractory Manufacturing", code: "3271" }, { name: "Glass and Glass Product Manufacturing", code: "3272" }, { name: "Cement and Concrete Product Manufacturing", code: "3273" }, { name: "Lime and Gypsum Product Manufacturing", code: "3274"}, { name: "Other Nonmetallic Mineral Product Manufacturing", code: "3279"} ] },
      { name: "Primary Metal Manufacturing", code: "331", industries: [ { name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "3311" }, { name: "Steel Product Manufacturing from Purchased Steel", code: "3312" }, { name: "Alumina and Aluminum Production and Processing", code: "3313" }, { name: "Nonferrous Metal (except Aluminum) Production and Processing", code: "3314"}, { name: "Foundries", code: "3315"} ] },
      { name: "Fabricated Metal Product Manufacturing", code: "332", industries: [ { name: "Forging and Stamping", code: "3321" }, { name: "Cutlery and Handtool Manufacturing", code: "3322" }, { name: "Architectural and Structural Metals Manufacturing", code: "3323" }, { name: "Boiler, Tank, and Shipping Container Manufacturing", code: "3324"}, { name: "Hardware Manufacturing", code: "3325"}, { name: "Spring and Wire Product Manufacturing", code: "3326"}, { name: "Machine Shops; Turned Product; and Screw, Nut, and Bolt Manufacturing", code: "3327"}, { name: "Coating, Engraving, Heat Treating, and Allied Activities", code: "3328"}, { name: "Other Fabricated Metal Product Manufacturing", code: "3329"}] },
      { name: "Machinery Manufacturing", code: "333", industries: [ { name: "Agriculture, Construction, and Mining Machinery Manufacturing", code: "3331" }, { name: "Industrial Machinery Manufacturing", code: "3332" }, { name: "Commercial and Service Industry Machinery Manufacturing", code: "3333" }, { name: "Ventilation, Heating, Air-Conditioning, and Commercial Refrigeration Equipment Manufacturing", code: "3334"}, { name: "Metalworking Machinery Manufacturing", code: "3335"}, { name: "Engine, Turbine, and Power Transmission Equipment Manufacturing", code: "3336"}, { name: "Other General Purpose Machinery Manufacturing", code: "3339"} ] },
      { name: "Computer and Electronic Product Manufacturing", code: "334", industries: [ { name: "Computer and Peripheral Equipment Manufacturing", code: "3341" }, { name: "Communications Equipment Manufacturing", code: "3342" }, { name: "Audio and Video Equipment Manufacturing", code: "3343" }, { name: "Semiconductor and Other Electronic Component Manufacturing", code: "3344"}, { name: "Navigational, Measuring, Electromedical, and Control Instruments Manufacturing", code: "3345"}, { name: "Manufacturing and Reproducing Magnetic and Optical Media", code: "3346"} ] },
      { name: "Electrical Equipment, Appliance, and Component Manufacturing", code: "335", industries: [ { name: "Electric Lighting Equipment Manufacturing", code: "3351" }, { name: "Household Appliance Manufacturing", code: "3352" }, { name: "Electrical Equipment Manufacturing", code: "3353" }, { name: "Other Electrical Equipment and Component Manufacturing", code: "3359"} ] },
      { name: "Transportation Equipment Manufacturing", code: "336", industries: [ { name: "Motor Vehicle Manufacturing", code: "3361" }, { name: "Motor Vehicle Body and Trailer Manufacturing", code: "3362" }, { name: "Motor Vehicle Parts Manufacturing", code: "3363" }, { name: "Aerospace Product and Parts Manufacturing", code: "3364"}, { name: "Railroad Rolling Stock Manufacturing", code: "3365"}, { name: "Ship and Boat Building", code: "3366"}, { name: "Other Transportation Equipment Manufacturing", code: "3369"} ] },
      { name: "Furniture and Related Product Manufacturing", code: "337", industries: [ { name: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", code: "3371" }, { name: "Office Furniture (including Fixtures) Manufacturing", code: "3372" }, { name: "Other Furniture Related Product Manufacturing", code: "3379" } ] },
      { name: "Miscellaneous Manufacturing", code: "339", industries: [ { name: "Medical Equipment and Supplies Manufacturing", code: "3391" }, { name: "Other Miscellaneous Manufacturing", code: "3399" } ] },
    ]
  },
  {
    name: "Wholesale Trade", code: "42",
    description: "Wholesaling merchandise, generally without transformation.",
    subSectors: [
      { name: "Merchant Wholesalers, Durable Goods", code: "423", industries: [{ name: "Motor Vehicle and Parts", code: "4231" }, { name: "Professional Equipment", code: "4234" }, { name: "Metal and Mineral (except Petroleum)", code: "4235"}] },
      { name: "Merchant Wholesalers, Nondurable Goods", code: "424", industries: [{ name: "Paper and Paper Products", code: "4241" }, { name: "Apparel and Notions", code: "4243" }, { name: "Grocery and Related Products", code: "4244"}] },
      { name: "Wholesale Electronic Markets and Agents and Brokers", code: "425", industries: [{ name: "Wholesale Electronic Markets and Agents and Brokers", code: "4251"}] },
    ]
  },
  {
    name: "Retail Trade", code: "44-45",
    description: "Retailing merchandise, generally without transformation.",
    subSectors: [
      { name: "Motor Vehicle and Parts Dealers", code: "441", industries: [{ name: "Automobile Dealers", code: "4411" }, { name: "Other Motor Vehicle Dealers", code: "4412" }, { name: "Automotive Parts, Accessories, and Tire Retailers", code: "4413"}] },
      { name: "Furniture, Home Furnishings, Electronics, and Appliance Retailers", code: "449", industries: [{ name: "Furniture Retailers", code: "449110" }, { name: "Home Furnishings Retailers", code: "44912" }, { name: "Electronics and Appliance Retailers", code: "449210" }]},
      { name: "Building Material and Garden Equipment and Supplies Dealers", code: "444", industries: [{ name: "Building Material and Supplies Dealers", code: "4441" }]},
      { name: "Food and Beverage Retailers", code: "445", industries: [{ name: "Grocery and Convenience Retailers", code: "4451" }, {name: "Specialty Food Retailers", code: "4452"}] },
      { name: "Health and Personal Care Retailers", code: "456", industries: [{name: "Pharmacies and Drug Retailers", code: "456110"}]},
      { name: "Gasoline Stations and Fuel Dealers", code: "457", industries: [{name: "Gasoline Stations", code: "4571"}] },
      { name: "Clothing, Clothing Accessories, Shoe, and Jewelry Retailers", code: "458", industries: [{name: "Clothing and Clothing Accessories Retailers", code: "4581"}, {name: "Shoe Retailers", code: "458210"}, {name: "Jewelry, Luggage, and Leather Goods Retailers", code: "4583"}] },
      { name: "General Merchandise Retailers", code: "455", industries: [{name: "Department Stores and Other General Merchandise Retailers", code: "45521"}] },
      { name: "Miscellaneous Store Retailers", code: "459", industries: [{name: "Sporting Goods, Hobby, and Musical Instrument Retailers", code: "4591"}, { name: "Book Retailers and News Dealers", code: "459210"}] },
    ]
  },
  {
    name: "Transportation and Warehousing", code: "48-49",
    description: "Transportation of passengers and cargo, warehousing and storage.",
    subSectors: [
      { name: "Air Transportation", code: "481", industries: [{ name: "Scheduled Air Transportation", code: "4811" }, { name: "Nonscheduled Air Transportation", code: "4812" }] },
      { name: "Rail Transportation", code: "482", industries: [{ name: "Rail Transportation", code: "4821" }] },
      { name: "Water Transportation", code: "483", industries: [{ name: "Deep Sea, Coastal, and Great Lakes Water Transportation", code: "4831" }, { name: "Inland Water Transportation", code: "4832" }] },
      { name: "Truck Transportation", code: "484", industries: [{ name: "General Freight Trucking", code: "4841" }, { name: "Specialized Freight Trucking", code: "4842" }] },
      { name: "Transit and Ground Passenger Transportation", code: "485", industries: [{ name: "Urban Transit Systems", code: "4851" }, {name: "Taxi and Limousine Service", code: "4853"}] },
      { name: "Pipeline Transportation", code: "486", industries: [{ name: "Pipeline Transportation of Crude Oil", code: "4861" }]},
      { name: "Scenic and Sightseeing Transportation", code: "487", industries: [{ name: "Scenic and Sightseeing Transportation, Land", code: "4871" }]},
      { name: "Support Activities for Transportation", code: "488", industries: [{ name: "Support Activities for Air Transportation", code: "4881" }]},
      { name: "Couriers and Messengers", code: "492", industries: [{ name: "Couriers and Express Delivery Services", code: "4921" }]},
      { name: "Warehousing and Storage", code: "493", industries: [{ name: "Warehousing and Storage", code: "4931" }] },
    ]
  },
  {
    name: "Information", code: "51",
    description: "Producing and distributing information and cultural products.",
    subSectors: [
      { name: "Publishing Industries (except Internet)", code: "513", industries: [{ name: "Newspaper, Periodical, Book, and Directory Publishers", code: "5131" }, { name: "Software Publishers", code: "513210" }] },
      { name: "Motion Picture and Sound Recording Industries", code: "512", industries: [{ name: "Motion Picture and Video Industries", code: "5121" }, { name: "Sound Recording Industries", code: "5122" }] },
      { name: "Broadcasting (except Internet)", code: "516", industries: [{name: "Radio and Television Broadcasting", code: "5161"}] },
      { name: "Telecommunications", code: "517", industries: [{ name: "Wired and Wireless Telecommunications Carriers", code: "5171" }, { name: "Satellite Telecommunications", code: "5174" }, { name: "Other Telecommunications", code: "5179"}] },
      { name: "Data Processing, Hosting, and Related Services", code: "518", industries: [{ name: "Data Processing, Hosting, and Related Services", code: "5182" }] },
      { name: "Other Information Services", code: "519", industries: [{name: "News Syndicates", code: "519210" }, { name: "Libraries and Archives", code: "519220"}] },
    ]
  },
  {
    name: "Finance and Insurance", code: "52",
    description: "Financial transactions and facilitating financial transactions.",
    subSectors: [
      { name: "Monetary Authorities - Central Bank", code: "521", industries: [{ name: "Monetary Authorities - Central Bank", code: "5211" }] },
      { name: "Credit Intermediation and Related Activities", code: "522", industries: [{ name: "Depository Credit Intermediation (Commercial Banking, Savings Institutions, Credit Unions)", code: "5221" }, { name: "Nondepository Credit Intermediation", code: "5222" }, { name: "Activities Related to Credit Intermediation (e.g., loan brokers)", code: "5223"}] },
      { name: "Securities, Commodity Contracts, and Other Financial Investments and Related Activities", code: "523", industries: [{ name: "Securities and Commodity Contracts Intermediation and Brokerage", code: "5231" }, { name: "Securities and Commodity Exchanges", code: "5232" }, {name: "Other Financial Investment Activities (e.g., investment funds, trusts)", code: "5239"}] },
      { name: "Insurance Carriers and Related Activities", code: "524", industries: [{ name: "Insurance Carriers", code: "5241" }, { name: "Agencies, Brokerages, and Other Insurance Related Activities", code: "5242" }] },
      { name: "Funds, Trusts, and Other Financial Vehicles", code: "525", industries: [{ name: "Pension Funds", code: "525110" }, {name: "Health and Welfare Funds", code: "525120"}] }, // Simplified
    ]
  },
  {
    name: "Real Estate and Rental and Leasing", code: "53",
    description: "Renting, leasing, or otherwise allowing the use of assets.",
    subSectors: [
      { name: "Real Estate", code: "531", industries: [{ name: "Lessors of Real Estate", code: "5311" }, { name: "Offices of Real Estate Agents and Brokers", code: "5312" }, {name: "Activities Related to Real Estate", code: "5313" }] },
      { name: "Rental and Leasing Services", code: "532", industries: [{ name: "Automotive Equipment Rental and Leasing", code: "5321" }, {name: "Consumer Goods Rental", code: "5322" }, {name: "General Rental Centers", code: "532310"}] },
      { name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533", industries: [{name: "Lessors of Nonfinancial Intangible Assets", code: "5331"}] },
    ]
  },
  {
    name: "Professional, Scientific, and Technical Services", code: "54",
    description: "Performing professional, scientific, and technical activities for others.",
    subSectors: [
      { name: "Legal Services", code: "5411", industries: [{ name: "Offices of Lawyers", code: "541110" }] },
      { name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "5412", industries: [{ name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "54121" }] },
      { name: "Architectural, Engineering, and Related Services", code: "5413", industries: [{ name: "Architectural Services", code: "541310" }, { name: "Engineering Services", code: "541330" }] },
      { name: "Computer Systems Design and Related Services", code: "5415", industries: [{ name: "Custom Computer Programming Services", code: "541511" }, { name: "Computer Systems Design Services", code: "541512" }] },
      { name: "Management, Scientific, and Technical Consulting Services", code: "5416", industries: [{ name: "Management Consulting Services", code: "54161" }]},
      { name: "Scientific Research and Development Services", code: "5417", industries: [{ name: "Research and Development in the Physical, Engineering, and Life Sciences", code: "54171" }]},
      { name: "Advertising, Public Relations, and Related Services", code: "5418", industries: [{ name: "Advertising Agencies", code: "541810" }]},
      { name: "Other Professional, Scientific, and Technical Services", code: "5419", industries: [{ name: "Photographic Services", code: "54192" }, { name: "Veterinary Services", code: "541940" }]},
    ]
  },
  {
    name: "Management of Companies and Enterprises", code: "55",
    description: "Holding securities of companies for controlling interest or influencing management.",
    subSectors: [
      { name: "Management of Companies and Enterprises", code: "551", industries: [{ name: "Offices of Bank Holding Companies", code: "551111" }, { name: "Offices of Other Holding Companies", code: "551112" }] },
    ]
  },
  {
    name: "Administrative and Support and Waste Management and Remediation Services", code: "56",
    description: "Routine support activities for other organizations or managing waste.",
    subSectors: [
      { name: "Administrative and Support Services", code: "561", industries: [
        { name: "Office Administrative Services", code: "5611" },
        { name: "Facilities Support Services", code: "5612" },
        { name: "Employment Services", code: "5613" },
        { name: "Business Support Services", code: "5614" },
        { name: "Travel Arrangement and Reservation Services", code: "5615" },
        { name: "Investigation and Security Services", code: "5616" },
        { name: "Services to Buildings and Dwellings", code: "5617" },
        { name: "Other Support Services", code: "5619" },
      ]},
      { name: "Waste Management and Remediation Services", code: "562", industries: [
        { name: "Waste Collection", code: "5621" },
        { name: "Waste Treatment and Disposal", code: "5622" },
        { name: "Remediation and Other Waste Management Services", code: "5629" },
      ]},
    ]
  },
  {
    name: "Educational Services", code: "61",
    description: "Providing instruction and training in a wide variety of subjects.",
    subSectors: [
      { name: "Elementary and Secondary Schools", code: "6111", industries: [{ name: "Elementary and Secondary Schools", code: "611110" }] },
      { name: "Junior Colleges", code: "6112", industries: [{ name: "Junior Colleges", code: "611210" }] },
      { name: "Colleges, Universities, and Professional Schools", code: "6113", industries: [{ name: "Colleges, Universities, and Professional Schools", code: "611310" }] },
      { name: "Business Schools and Computer and Management Training", code: "6114", industries: [{ name: "Business and Secretarial Schools", code: "611410" }] },
      { name: "Technical and Trade Schools", code: "6115", industries: [{ name: "Technical and Trade Schools", code: "61151" }] },
      { name: "Other Schools and Instruction", code: "6116", industries: [{ name: "Fine Arts Schools", code: "611610" }] },
      { name: "Educational Support Services", code: "6117", industries: [{ name: "Educational Support Services", code: "611710" }] },
    ]
  },
  {
    name: "Health Care and Social Assistance", code: "62",
    description: "Providing health care and social assistance for individuals.",
    subSectors: [
      { name: "Ambulatory Health Care Services", code: "621", industries: [
        { name: "Offices of Physicians", code: "6211" },
        { name: "Offices of Dentists", code: "6212" },
        { name: "Offices of Other Health Practitioners", code: "6213" },
        { name: "Outpatient Care Centers", code: "6214" },
        { name: "Medical and Diagnostic Laboratories", code: "6215" },
        { name: "Home Health Care Services", code: "6216" },
        { name: "Other Ambulatory Health Care Services", code: "6219" },
      ]},
      { name: "Hospitals", code: "622", industries: [
        { name: "General Medical and Surgical Hospitals", code: "6221" },
        { name: "Psychiatric and Substance Abuse Hospitals", code: "6222" },
        { name: "Specialty (except Psychiatric and Substance Abuse) Hospitals", code: "6223" },
      ]},
      { name: "Nursing and Residential Care Facilities", code: "623", industries: [
        { name: "Nursing Care Facilities (Skilled Nursing Facilities)", code: "6231" },
        { name: "Residential Intellectual and Developmental Disability, Mental Health, and Substance Abuse Facilities", code: "6232" },
        { name: "Continuing Care Retirement Communities and Assisted Living Facilities for the Elderly", code: "6233" },
        { name: "Other Residential Care Facilities", code: "6239" },
      ]},
      { name: "Social Assistance", code: "624", industries: [
        { name: "Individual and Family Services", code: "6241" },
        { name: "Community Food and Housing, and Emergency and Other Relief Services", code: "6242" },
        { name: "Vocational Rehabilitation Services", code: "6243" },
        { name: "Child Care Services", code: "6244" },
      ]},
    ]
  },
  {
    name: "Arts, Entertainment, and Recreation", code: "71",
    description: "Operating facilities or providing services for cultural, entertainment, and recreational interests.",
    subSectors: [
      { name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [
        { name: "Performing Arts Companies", code: "7111" },
        { name: "Spectator Sports", code: "7112" },
        { name: "Promoters of Performing Arts, Sports, and Similar Events", code: "7113" },
        { name: "Agents and Managers for Artists, Athletes, Entertainers, and Other Public Figures", code: "7114" },
        { name: "Independent Artists, Writers, and Performers", code: "7115" },
      ]},
      { name: "Museums, Historical Sites, and Similar Institutions", code: "712", industries: [
        { name: "Museums, Historical Sites, and Similar Institutions", code: "7121" },
      ]},
      { name: "Amusement, Gambling, and Recreation Industries", code: "713", industries: [
        { name: "Amusement Parks and Arcades", code: "7131" },
        { name: "Gambling Industries", code: "7132" },
        { name: "Other Amusement and Recreation Industries (e.g., golf courses, skiing facilities, marinas, fitness centers)", code: "7139" },
      ]},
    ]
  },
  {
    name: "Accommodation and Food Services", code: "72",
    description: "Providing lodging and/or preparing meals, snacks, and beverages.",
    subSectors: [
      { name: "Accommodation", code: "721", industries: [
        { name: "Traveler Accommodation (e.g., hotels, motels, B&Bs)", code: "7211" },
        { name: "RV (Recreational Vehicle) Parks and Recreational Camps", code: "7212" },
        { name: "Rooming and Boarding Houses, Dormitories, and Workers' Camps", code: "7213" },
      ]},
      { name: "Food Services and Drinking Places", code: "722", industries: [
        { name: "Full-Service Restaurants", code: "722511" }, // More specific code
        { name: "Limited-Service Restaurants", code: "722513" }, // More specific code
        { name: "Cafeterias, Grill Buffets, and Buffets", code: "722514" }, // More specific
        { name: "Snack and Nonalcoholic Beverage Bars", code: "722515" }, // More specific
        { name: "Food Service Contractors", code: "722310" },
        { name: "Caterers", code: "722320" },
        { name: "Mobile Food Services", code: "722330" },
        { name: "Drinking Places (Alcoholic Beverages)", code: "7224" },
      ]},
    ]
  },
  {
    name: "Other Services (except Public Administration)", code: "81",
    description: "Providing services not elsewhere classified.",
    subSectors: [
      { name: "Repair and Maintenance", code: "811", industries: [
        { name: "Automotive Repair and Maintenance", code: "8111" },
        { name: "Electronic and Precision Equipment Repair and Maintenance", code: "8112" },
        { name: "Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance", code: "8113" },
        { name: "Personal and Household Goods Repair and Maintenance", code: "8114" },
      ]},
      { name: "Personal and Laundry Services", code: "812", industries: [
        { name: "Personal Care Services (e.g., hair salons, barber shops, nail salons)", code: "8121" },
        { name: "Death Care Services", code: "8122" },
        { name: "Drycleaning and Laundry Services", code: "8123" },
        { name: "Other Personal Services (e.g., pet care, photofinishing)", code: "8129" },
      ]},
      { name: "Religious, Grantmaking, Civic, Professional, and Similar Organizations", code: "813", industries: [
        { name: "Religious Organizations", code: "8131" },
        { name: "Grantmaking and Giving Services", code: "8132" },
        { name: "Social Advocacy Organizations", code: "8133" },
        { name: "Civic and Social Organizations", code: "8134" },
        { name: "Business, Professional, Labor, Political, and Similar Organizations", code: "8139" },
      ]},
      { name: "Private Households", code: "814", industries: [{ name: "Private Households", code: "8141" }] },
    ]
  },
  {
    name: "Public Administration", code: "92",
    description: "Government agencies administering public programs.",
    subSectors: [
      { name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [{ name: "Executive Offices", code: "921110" }, {name: "Legislative Bodies", code: "921120"}] },
      { name: "Justice, Public Order, and Safety Activities", code: "922", industries: [{ name: "Police Protection", code: "922120" }, {name: "Correctional Institutions", code: "922140"}] },
      { name: "Administration of Human Resource Programs", code: "923", industries: [{name: "Administration of Education Programs", code: "923110"}] },
      { name: "Administration of Environmental Quality Programs", code: "924", industries: [{name: "Administration of Air and Water Resource and Solid Waste Management Programs", code: "924110"}] },
      { name: "Administration of Housing Programs, Urban Planning, and Community Development", code: "925", industries: [{name: "Administration of Housing Programs", code: "925110"}] },
      { name: "Administration of Economic Programs", code: "926", industries: [{name: "Administration of General Economic Programs", code: "926110"}] },
      { name: "Space Research and Technology", code: "927", industries: [{name: "Space Research and Technology", code: "927110"}] },
      { name: "National Security and International Affairs", code: "928", industries: [{name: "National Security", code: "928110"}] },
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

// Dynamic imports for form components
const DynamicCreatePostForm = dynamic(() =>
  import('@/components/CreatePostForm').then((mod) => mod.CreatePostForm),
  {
    loading: () => <div className="p-4 text-center"><p className="text-sm text-muted-foreground">Loading form...</p></div>,
    ssr: false
  }
);

const DynamicRequestHelpForm = dynamic(() =>
  import('@/components/RequestHelpForm').then((mod) => mod.RequestHelpForm),
  {
    loading: () => <div className="p-4 text-center"><p className="text-sm text-muted-foreground">Loading form...</p></div>,
    ssr: false
  }
);

const DynamicThemeToggle = dynamic(() =>
  import('@/components/ThemeToggle').then((mod) => mod.ThemeToggle),
  {
    loading: () => <DropdownMenuItem disabled className="justify-between">Theme <span className="text-xs text-muted-foreground">...</span></DropdownMenuItem>,
    ssr: false
  }
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
    if (isCreatePostOpen && !user) setIsCreatePostOpen(false);
    if (isRequestHelpDialogOpen && !user) setIsRequestHelpDialogOpen(false);
  }, [user, isCreatePostOpen, isRequestHelpDialogOpen]);

  const addPostMutation = useMutation({
    mutationFn: async (newPostDataWithImage: NewPostData & {
      imageFile?: File | null | undefined;
      mentionedUserIds?: string[];
    }) => {
      if (!user) {
        throw new Error("User not authenticated to create post.");
      }
      console.log('%c[MainLayout] addPostMutation: Initiated by user:', "color: magenta;", user.uid);

      let currentRatingScore = 0;
      try {
        console.log(`%c[MainLayout] addPostMutation: Fetching reviews for user ${user.uid} to calculate rating score.`, "color: #FF00FF;"); // Magenta for visibility
        const reviews = await getReviewsForProfile(user.uid);
        console.log(`%c[MainLayout] addPostMutation: Fetched ${reviews.length} reviews for user ${user.uid}.`, "color: #FF00FF;");
        if (reviews && reviews.length > 0) {
          const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
          currentRatingScore = totalRating / reviews.length;
          console.log(`%c[MainLayout] addPostMutation: Calculated totalRating: ${totalRating}, currentRatingScore: ${currentRatingScore}`, "color: #FF00FF;");
        } else {
          console.log(`%c[MainLayout] addPostMutation: No reviews found or reviews array is empty for user ${user.uid}. Rating score remains 0.`, "color: #FF00FF;");
        }
      } catch (ratingError: any) {
        console.error("[MainLayout] addPostMutation: Error fetching reviews to calculate rating score:", ratingError.message, ratingError);
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
        ratingScore: currentRatingScore,
        requestType: newPostDataWithImage.requestType || 'post', // Default to 'post'
      };
      console.log(`%c[MainLayout] addPostMutation: Post data PREPARED. RatingScore: ${currentRatingScore}. RequestType: ${postDataForFirestore.requestType}. Data:`, "color: #FF00FF;", postDataForFirestore);
      return addPostToFirestore(postDataForFirestore);
    },
    onSuccess: (newlyCreatedPostId, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['allPostsForSectorPage']});
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
                textSnippet: variables.description ? variables.description.substring(0, 100) : "",
              });
               console.log(`%c[MainLayout] Mention notification CREATED for ${mentionedUid} for post ${newlyCreatedPostId}`, "color: green;");
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
        description: `Could not create post: ${error.message}.`,
      });
      setIsCreatePostOpen(false);
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
      console.log("[MainLayout] handleAddPost (for regular post) formData RECEIVED:", JSON.stringify(formData, null, 2));

      const mainSectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
      const subSectorDetails = mainSectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
      const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

      const newPostDataForService: NewPostData & { imageFile?: File | null; mentionedUserIds: string[] } = {
        question: formData.question,
        description: formData.description,
        tags: formData.tags || [],
        sector: mainSectorDetails?.name || formData.sector,
        subSector: subSectorDetails?.name || formData.subSector,
        industry: industryDetails?.name || formData.industry,
        naicsCode: formData.industry || formData.subSector || formData.sector,
        userId: user.uid,
        businessType: "Startup", // Example, should be derived or from form
        safetyIndicator: "Medium", // Example
        ratingScore: 0, // Will be updated by mutationFn
        imageFile: formData.imageFile,
        imageUrls: [],
        mentionedUserIds: formData.mentionedUserIds,
        requestType: 'post', // Explicitly set for regular posts
      };
      console.log("[MainLayout] handleAddPost newPostDataForService PREPARED:", JSON.stringify(newPostDataForService, null, 2));
      addPostMutation.mutate(newPostDataForService);
    },
    [user, toast, addPostMutation, queryClient] // Added queryClient
  );

  const addHelpRequestMutation = useMutation({
      mutationFn: async (newHelpRequestDataWithImage: NewPostData & { imageFile?: File | null; mentionedUserIds?: string[] }) => {
          if (!user) {
            throw new Error("User not authenticated to create help request.");
          }
          console.log('%c[MainLayout] addHelpRequestMutation: Initiated by user:', "color: #FFA500;", user.uid);

          let currentRatingScore = 0;
          try {
            console.log(`%c[MainLayout] addHelpRequestMutation: Fetching reviews for user ${user.uid} to calculate rating score.`, "color: #FF8C00;"); // Orange for visibility
            const reviews = await getReviewsForProfile(user.uid);
            console.log(`%c[MainLayout] addHelpRequestMutation: Fetched ${reviews.length} reviews for user ${user.uid}.`, "color: #FF8C00;");
            if (reviews && reviews.length > 0) {
              const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
              currentRatingScore = totalRating / reviews.length;
              console.log(`%c[MainLayout] addHelpRequestMutation: Calculated totalRating: ${totalRating}, currentRatingScore: ${currentRatingScore}`, "color: #FF8C00;");
            } else {
              console.log(`%c[MainLayout] addHelpRequestMutation: No reviews found or reviews array is empty for user ${user.uid}. Rating score remains 0.`, "color: #FF8C00;");
            }
          } catch (ratingError: any) {
            console.error("[MainLayout] addHelpRequestMutation: Error fetching reviews to calculate rating score:", ratingError.message, ratingError);
          }

          let uploadedImageUrls: string[] = [];
          if (newHelpRequestDataWithImage.imageFile) {
              try {
                  const singleUploadedUrl = await uploadPostImage(newHelpRequestDataWithImage.imageFile, user.uid);
                  if (!singleUploadedUrl) throw new Error("Image upload succeeded but returned no URL for help request.");
                  uploadedImageUrls.push(singleUploadedUrl);
              } catch (uploadError) {
                  console.error("[MainLayout] Help request image upload failed:", uploadError);
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
              ratingScore: currentRatingScore,
              requestType: 'help_request', // This is already set correctly in handleAddHelpRequest
          };
           console.log(`%c[MainLayout] addHelpRequestMutation: Post data PREPARED. RatingScore: ${currentRatingScore}. RequestType: ${postDataForFirestore.requestType}. Data:`, "color: #FF8C00;", postDataForFirestore);
          return addPostToFirestore(postDataForFirestore);
      },
      onSuccess: (newlyCreatedPostId, variables) => {
          queryClient.invalidateQueries({ queryKey: ['posts'] });
          queryClient.invalidateQueries({ queryKey: ['userPosts'] });
          queryClient.invalidateQueries({ queryKey: ['allPostsForSectorPage']});
          toast({
              title: "Help Request Submitted",
              description: "Your request for help has been posted.",
          });
          setIsRequestHelpDialogOpen(false);

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
                              textSnippet: variables.descriptionDetails ? variables.descriptionDetails.substring(0, 100) : "",
                          });
                           console.log(`%c[MainLayout] Mention notification CREATED for ${mentionedUid} for help request ${newlyCreatedPostId}`, "color: green;");
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
              title: "Help Request Failed",
              description: `Could not submit request: ${error.message}.`,
          });
          setIsRequestHelpDialogOpen(false);
      },
  });

 const handleAddHelpRequest = useCallback(
      (formData: RequestHelpFormData) => {
          if (!user) {
              toast({ variant: "destructive", title: "Authentication Required", description: "You must be logged in." });
              return;
          }
          console.log("[MainLayout] handleAddHelpRequest formData RECEIVED:", JSON.stringify(formData, null, 2));

          const mainSectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
          const subSectorDetails = mainSectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
          const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

          const newHelpRequestData: NewPostData & { imageFile?: File | null; mentionedUserIds?: string[] } = {
              question: formData.question,
              descriptionDetails: formData.descriptionDetails,
              descriptionTried: formData.descriptionTried,
              descriptionOutcome: formData.descriptionOutcome,
              tags: formData.tags || [],
              sector: mainSectorDetails?.name || formData.sector,
              subSector: subSectorDetails?.name || formData.subSector,
              industry: industryDetails?.name || formData.industry,
              naicsCode: formData.industry || formData.subSector || formData.sector,
              userId: user.uid,
              businessType: "Project", // Example, can be adjusted
              safetyIndicator: "Medium", // Example
              ratingScore: 0, // Will be updated by mutationFn
              imageFile: formData.imageFile,
              imageUrls: [],
              mentionedUserIds: formData.mentionedUserIds,
              requestType: 'help_request',
              maxBudget: formData.maxBudget,
              deadline: formData.deadline ? Timestamp.fromDate(formData.deadline) : null,
          };
          console.log("[MainLayout] handleAddHelpRequest newHelpRequestData PREPARED:", JSON.stringify(newHelpRequestData, null, 2));
          addHelpRequestMutation.mutate(newHelpRequestData);
      },
      [user, toast, addHelpRequestMutation, queryClient] // Added queryClient
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
                       <Button variant="secondary" size="sm" className="bg-amber-500 hover:bg-amber-600/90 text-white dark:bg-amber-600 dark:hover:bg-amber-700/90">
                        <HelpingHand className="mr-2 h-4 w-4" />
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
                            onSubmit={handleAddHelpRequest}
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
                          <p className="text-sm font-medium leading-none">{user.displayName || generateAnonymousName(user.uid)}</p>
                          {user.email && (
                             <p className="text-xs leading-none text-muted-foreground">
                               {user.email}
                             </p>
                          )}
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
        pathname === '/contracts' && isMobile ? "h-full" : "pb-14 md:pb-0" // Adjusted padding for mobile
      )}>
        {children}
      </main>

      {!(pathname === '/contracts' && isMobile) && ( // Hide bottom nav if on mobile contracts page
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border h-14 md:hidden">
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
    </div>
  );
}

    