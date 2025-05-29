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
} from '@/components/CreatePostForm';
import type {
  RequestHelpFormData
} from '@/components/RequestHelpForm';
import type {
  NewPostData,
  SectorWithSubSectors as SectorWithSubSectorsType,
  SubSector as SubSectorType,
  Industry as IndustryType
} from '@/types/post';
import {
  addPostToFirestore
} from '@/services/postService';
import {
  uploadPostImage
} from '@/services/storageService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createNotification } from '@/services/notificationService';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { Timestamp } from 'firebase/firestore';
import { useIsMobile } from "@/hooks/use-mobile";
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { getReviewsForProfile } from '@/services/reviewService';


// Re-exporting the types locally if they are used by forms imported here
export type { SectorWithSubSectors, SubSector, Industry } from '@/types/post';


export const detailedSectorsData: SectorWithSubSectorsType[] = [
  {
    name: "Agriculture, Forestry, Fishing and Hunting", code: "11",
    description: "Establishments primarily engaged in growing crops, raising animals, harvesting timber, and harvesting fish and other animals from a farm, ranch, or their natural habitats.",
    subSectors: [
      {
        name: "Crop Production", code: "111",
        industries: [
          { name: "Soybean Farming", code: "111110" },
          { name: "Oilseed (except Soybean) Farming", code: "111120" },
          { name: "Dry Pea and Bean Farming", code: "111130" },
          { name: "Wheat Farming", code: "111140" },
          { name: "Corn Farming", code: "111150" },
          { name: "Rice Farming", code: "111160" },
          { name: "Oilseed and Grain Combination Farming", code: "111191" },
          { name: "All Other Grain Farming", code: "111199" },
        ],
      },
      {
        name: "Animal Production and Aquaculture", code: "112",
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
        name: "Forestry and Logging", code: "113",
        industries: [
          { name: "Timber Tract Operations", code: "113110" },
          { name: "Forest Nurseries and Gathering of Forest Products", code: "113210" },
          { name: "Logging", code: "113310" },
        ],
      },
      {
        name: "Fishing, Hunting and Trapping", code: "114",
        industries: [
          { name: "Finfish Fishing", code: "114111" },
          { name: "Shellfish Fishing", code: "114112" },
          { name: "Other Marine Fishing", code: "114119" },
          { name: "Hunting and Trapping", code: "114210" },
        ],
      },
      {
        name: "Support Activities for Agriculture and Forestry", code: "115",
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
    ]
  },
  {
    name: "Mining, Quarrying, and Oil and Gas Extraction", code: "21",
    description: "Extracting naturally occurring mineral solids, liquids, and gases.",
    subSectors: [
      { name: "Oil and Gas Extraction", code: "211", industries: [{ name: "Crude Petroleum and Natural Gas Extraction", code: "2111" }] },
      { name: "Coal Mining", code: "2121", industries: [{ name: "Coal Mining", code: "21211" }] },
      { name: "Metal Ore Mining", code: "2122", industries: [{ name: "Iron Ore Mining", code: "21221" }, { name: "Gold and Silver Ore Mining", code: "21222" }] },
      { name: "Nonmetallic Mineral Mining and Quarrying", code: "2123", industries: [{ name: "Stone Mining and Quarrying", code: "21231" }] },
      { name: "Support Activities for Mining", code: "213", industries: [{ name: "Support Activities for Oil and Gas Operations", code: "213111" }] },
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
      { name: "Heavy and Civil Engineering Construction", code: "237", industries: [{ name: "Utility System Construction", code: "2371" }, { name: "Highway, Street, and Bridge Construction", code: "2373" }] },
      { name: "Specialty Trade Contractors", code: "238", industries: [{ name: "Foundation, Structure, and Building Exterior Contractors", code: "2381" }, { name: "Building Equipment Contractors", code: "2382" }] },
    ]
  },
  {
    name: "Manufacturing", code: "31-33",
    description: "Mechanical, physical, or chemical transformation of materials into new products.",
    subSectors: [
      { name: "Food Manufacturing", code: "311", industries: [ { name: "Animal Food Manufacturing", code: "3111" }, { name: "Grain and Oilseed Milling", code: "3112" }, { name: "Sugar and Confectionery Product Manufacturing", code: "3113" }] },
      { name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [ { name: "Beverage Manufacturing", code: "3121" }, { name: "Tobacco Manufacturing", code: "3122" } ] },
      { name: "Textile Mills", code: "313", industries: [ { name: "Fiber, Yarn, and Thread Mills", code: "3131" }, { name: "Fabric Mills", code: "3132" } ] },
      { name: "Textile Product Mills", code: "314", industries: [ { name: "Textile Furnishings Mills", code: "3141" }, { name: "Other Textile Product Mills", code: "3149" } ] },
      { name: "Apparel Manufacturing", code: "315", industries: [ { name: "Apparel Knitting Mills", code: "3151" }, { name: "Cut and Sew Apparel Manufacturing", code: "3152" } ] },
      { name: "Leather and Allied Product Manufacturing", code: "316", industries: [ { name: "Leather and Hide Tanning and Finishing", code: "3161" }, { name: "Footwear Manufacturing", code: "3162" } ] },
      { name: "Wood Product Manufacturing", code: "321", industries: [ { name: "Sawmills and Wood Preservation", code: "3211" }, { name: "Veneer, Plywood, and Engineered Wood Product Manufacturing", code: "3212" } ] },
      { name: "Paper Manufacturing", code: "322", industries: [ { name: "Pulp, Paper, and Paperboard Mills", code: "3221" }, { name: "Converted Paper Product Manufacturing", code: "3222" } ] },
      { name: "Printing and Related Support Activities", code: "323", industries: [ { name: "Printing and Related Support Activities", code: "3231" } ] },
      { name: "Petroleum and Coal Products Manufacturing", code: "324", industries: [ { name: "Petroleum Refineries", code: "324110" } ] },
      { name: "Chemical Manufacturing", code: "325", industries: [ { name: "Basic Chemical Manufacturing", code: "3251" }, { name: "Pharmaceutical and Medicine Manufacturing", code: "325412" } ] },
      { name: "Plastics and Rubber Products Manufacturing", code: "326", industries: [ { name: "Plastics Product Manufacturing", code: "3261" }, { name: "Rubber Product Manufacturing", code: "3262" } ] },
      { name: "Nonmetallic Mineral Product Manufacturing", code: "327", industries: [ { name: "Clay Product and Refractory Manufacturing", code: "3271" }, { name: "Glass and Glass Product Manufacturing", code: "3272" } ] },
      { name: "Primary Metal Manufacturing", code: "331", industries: [ { name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "331110" }, { name: "Alumina and Aluminum Production and Processing", code: "3313" } ] },
      { name: "Fabricated Metal Product Manufacturing", code: "332", industries: [ { name: "Forging and Stamping", code: "3321" }, { name: "Architectural and Structural Metals Manufacturing", code: "3323" } ] },
      { name: "Machinery Manufacturing", code: "333", industries: [ { name: "Agriculture, Construction, and Mining Machinery Manufacturing", code: "3331" }, { name: "Industrial Machinery Manufacturing", code: "33324" } ] },
      { name: "Computer and Electronic Product Manufacturing", code: "334", industries: [ { name: "Computer and Peripheral Equipment Manufacturing", code: "3341" }, { name: "Semiconductor and Other Electronic Component Manufacturing", code: "334413" } ] },
      { name: "Electrical Equipment, Appliance, and Component Manufacturing", code: "335", industries: [ { name: "Electric Lighting Equipment Manufacturing", code: "3351" }, { name: "Household Appliance Manufacturing", code: "3352" } ] },
      { name: "Transportation Equipment Manufacturing", code: "336", industries: [ { name: "Motor Vehicle Manufacturing", code: "3361" }, { name: "Aerospace Product and Parts Manufacturing", code: "3364" } ] },
      { name: "Furniture and Related Product Manufacturing", code: "337", industries: [ { name: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", code: "3371" } ] },
      { name: "Miscellaneous Manufacturing", code: "339", industries: [ { name: "Medical Equipment and Supplies Manufacturing", code: "3391" }, { name: "Other Miscellaneous Manufacturing", code: "3399" } ] },
    ]
  },
  {
    name: "Wholesale Trade", code: "42",
    description: "Wholesaling merchandise, generally without transformation.",
    subSectors: [
      { name: "Merchant Wholesalers, Durable Goods", code: "423", industries: [{ name: "Motor Vehicle and Parts", code: "4231" }, { name: "Commercial Equipment", code: "423440" }] },
      { name: "Merchant Wholesalers, Nondurable Goods", code: "424", industries: [{ name: "Grocery and Related Products", code: "4244" }, { name: "Petroleum and Petroleum Products", code: "4247" }] },
    ]
  },
  {
    name: "Retail Trade", code: "44-45",
    description: "Retailing merchandise, generally without transformation.",
    subSectors: [
      { name: "Motor Vehicle and Parts Dealers", code: "441", industries: [{ name: "Automobile Dealers", code: "4411" }, { name: "Automotive Parts, Accessories, and Tire Retailers", code: "4413" }] },
      { name: "Furniture, Home Furnishings, Electronics, and Appliance Retailers", code: "449", industries: [{ name: "Furniture Retailers", code: "449110" }, { name: "Electronics and Appliance Retailers", code: "449210" }] },
      { name: "Building Material and Garden Equipment and Supplies Dealers", code: "444", industries: [{ name: "Building Material and Supplies Dealers", code: "4441" }] },
      { name: "Food and Beverage Retailers", code: "445", industries: [{ name: "Grocery and Convenience Retailers", code: "4451" }] },
      { name: "General Merchandise Retailers", code: "455", industries: [{ name: "Department Stores", code: "455211" }] },
    ]
  },
  {
    name: "Transportation and Warehousing", code: "48-49",
    description: "Transportation of passengers and cargo, warehousing and storage.",
    subSectors: [
      { name: "Air Transportation", code: "481", industries: [{ name: "Scheduled Passenger Air Transportation", code: "481111" }] },
      { name: "Truck Transportation", code: "484", industries: [{ name: "General Freight Trucking", code: "4841" }] },
      { name: "Support Activities for Transportation", code: "488", industries: [{ name: "Support Activities for Air Transportation", code: "4881" }] },
      { name: "Couriers and Messengers", code: "492", industries: [{ name: "Couriers and Express Delivery Services", code: "4921" }] },
      { name: "Warehousing and Storage", code: "493", industries: [{ name: "General Warehousing and Storage", code: "493110" }] },
    ]
  },
  {
    name: "Information", code: "51",
    description: "Producing and distributing information and cultural products.",
    subSectors: [
      { name: "Publishing Industries (except Internet)", code: "513", industries: [{ name: "Newspaper Publishers", code: "513110" }, { name: "Software Publishers", code: "513210" }] },
      { name: "Telecommunications", code: "517", industries: [{ name: "Wired Telecommunications Carriers", code: "517111" }, { name: "Wireless Telecommunications Carriers (except Satellite)", code: "517112" }] },
      { name: "Data Processing, Hosting, and Related Services", code: "518", industries: [{ name: "Data Processing, Hosting, and Related Services", code: "5182" }] },
    ]
  },
  {
    name: "Finance and Insurance", code: "52",
    description: "Financial transactions and facilitating financial transactions.",
    subSectors: [
      { name: "Credit Intermediation and Related Activities", code: "522", industries: [{ name: "Commercial Banking", code: "522110" }, { name: "Credit Unions", code: "522130" }] },
      { name: "Securities, Commodity Contracts, and Other Financial Investments", code: "523", industries: [{ name: "Investment Banking and Securities Dealing", code: "523110" }] },
      { name: "Insurance Carriers and Related Activities", code: "524", industries: [{ name: "Direct Life Insurance Carriers", code: "524113" }, { name: "Insurance Agencies and Brokerages", code: "524210" }] },
    ]
  },
  {
    name: "Real Estate and Rental and Leasing", code: "53",
    description: "Renting, leasing, or otherwise allowing the use of assets.",
    subSectors: [
      { name: "Real Estate", code: "531", industries: [{ name: "Lessors of Residential Buildings and Dwellings", code: "531110" }, { name: "Offices of Real Estate Agents and Brokers", code: "5312" }] },
      { name: "Rental and Leasing Services", code: "532", industries: [{ name: "Automotive Equipment Rental and Leasing", code: "5321" }] },
    ]
  },
  {
    name: "Professional, Scientific, and Technical Services", code: "54",
    description: "Performing professional, scientific, and technical activities for others.",
    subSectors: [
      { name: "Legal Services", code: "5411", industries: [{ name: "Offices of Lawyers", code: "541110" }] },
      { name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "5412", industries: [{ name: "Offices of Certified Public Accountants", code: "541211" }] },
      { name: "Architectural, Engineering, and Related Services", code: "5413", industries: [{ name: "Architectural Services", code: "541310" }, { name: "Engineering Services", code: "541330" }] },
      { name: "Computer Systems Design and Related Services", code: "5415", industries: [{ name: "Custom Computer Programming Services", code: "541511" }] },
    ]
  },
  {
    name: "Management of Companies and Enterprises", code: "55",
    description: "Holding securities of companies for controlling interest or influencing management.",
    subSectors: [
      { name: "Management of Companies and Enterprises", code: "551", industries: [{ name: "Offices of Bank Holding Companies", code: "551111" }] },
    ]
  },
  {
    name: "Administrative and Support and Waste Management and Remediation Services", code: "56",
    description: "Routine support activities for other organizations or managing waste.",
    subSectors: [
      { name: "Administrative and Support Services", code: "561", industries: [{ name: "Office Administrative Services", code: "5611" }, { name: "Employment Services", code: "5613" }] },
      { name: "Waste Management and Remediation Services", code: "562", industries: [{ name: "Waste Collection", code: "5621" }] },
    ]
  },
  {
    name: "Educational Services", code: "61",
    description: "Providing instruction and training in a wide variety of subjects.",
    subSectors: [
      { name: "Educational Services", code: "611", industries: [{ name: "Elementary and Secondary Schools", code: "6111" }, { name: "Colleges, Universities, and Professional Schools", code: "6113" }] },
    ]
  },
  {
    name: "Health Care and Social Assistance", code: "62",
    description: "Providing health care and social assistance for individuals.",
    subSectors: [
      { name: "Ambulatory Health Care Services", code: "621", industries: [{ name: "Offices of Physicians", code: "6211" }, { name: "Offices of Dentists", code: "6212" }] },
      { name: "Hospitals", code: "622", industries: [{ name: "General Medical and Surgical Hospitals", code: "622110" }] },
      { name: "Nursing and Residential Care Facilities", code: "623", industries: [{ name: "Nursing Care Facilities (Skilled Nursing Facilities)", code: "6231" }] },
      { name: "Social Assistance", code: "624", industries: [{ name: "Individual and Family Services", code: "6241" }] },
    ]
  },
  {
    name: "Arts, Entertainment, and Recreation", code: "71",
    description: "Operating facilities or providing services for cultural, entertainment, and recreational interests.",
    subSectors: [
      { name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [{ name: "Performing Arts Companies", code: "7111" }, { name: "Spectator Sports", code: "7112" }] },
      { name: "Museums, Historical Sites, and Similar Institutions", code: "712", industries: [{ name: "Museums", code: "712110" }] },
      { name: "Amusement, Gambling, and Recreation Industries", code: "713", industries: [{ name: "Amusement Parks and Arcades", code: "7131" }, { name: "Fitness and Recreational Sports Centers", code: "713940" }] },
    ]
  },
  {
    name: "Accommodation and Food Services", code: "72",
    description: "Providing lodging and/or preparing meals, snacks, and beverages.",
    subSectors: [
      { name: "Accommodation", code: "721", industries: [{ name: "Hotels (except Casino Hotels) and Motels", code: "721110" }] },
      { name: "Food Services and Drinking Places", code: "722", industries: [{ name: "Full-Service Restaurants", code: "722511" }, { name: "Limited-Service Restaurants", code: "722513" }] },
    ]
  },
  {
    name: "Other Services (except Public Administration)", code: "81",
    description: "Providing services not elsewhere classified.",
    subSectors: [
      { name: "Repair and Maintenance", code: "811", industries: [{ name: "Automotive Repair and Maintenance", code: "8111" }] },
      { name: "Personal and Laundry Services", code: "812", industries: [{ name: "Personal Care Services (e.g., hair salons)", code: "8121" }] },
      { name: "Religious, Grantmaking, Civic, Professional, and Similar Organizations", code: "813", industries: [{ name: "Religious Organizations", code: "8131" }] },
    ]
  },
  {
    name: "Public Administration", code: "92",
    description: "Government agencies administering public programs.",
    subSectors: [
      { name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [{ name: "Executive Offices", code: "921110" }] },
      { name: "Justice, Public Order, and Safety Activities", code: "922", industries: [{ name: "Police Protection", code: "922120" }] },
      { name: "National Security and International Affairs", code: "928", industries: [{ name: "National Security", code: "928110" }] },
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

const DynamicCreatePostForm = dynamic(() =>
  import('@/components/CreatePostForm').then((mod) => mod.CreatePostForm),
  {
    loading: () => <div className="p-4 text-center"><p className="text-sm text-muted-foreground">Loading form...</p></div>,
    ssr: false
  }
);

const DynamicRequestHelpForm = dynamic(() => // Corrected: Should import RequestHelpForm
  import('@/components/RequestHelpForm').then((mod) => mod.RequestHelpForm),
  {
    loading: () => <div className="p-4 text-center"><p className="text-sm text-muted-foreground">Loading form...</p></div>,
    ssr: false
  }
);

const DynamicNotificationDropdown = dynamic(() =>
  import('@/components/notifications/NotificationDropdown').then((mod) => mod.NotificationDropdown),
  {
    loading: () => <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications (Loading)"><Bell className="h-5 w-5" /></Button>,
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
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
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
      // Explicitly add descriptionDetails etc. for type safety if they are always expected from CreatePostForm
      descriptionDetails?: string;
      descriptionTried?: string;
      descriptionOutcome?: string;
    }) => {
      if (!user) {
        throw new Error("User not authenticated to create post.");
      }
      console.log('%c[MainLayout] addPostMutation: Initiated by user:', "color: magenta;", user.uid, "Data:", newPostDataWithImage);

      let currentRatingScore = 0;
      try {
        console.log(`%c[MainLayout] addPostMutation: Fetching reviews for user ${user.uid} to calculate rating score.`, "color: #FF00FF;");
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
        requestType: 'post', // Explicitly 'post'
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
        description: formData.description, // Used for 'post' type
        tags: formData.tags || [],
        sector: mainSectorDetails?.name || formData.sector,
        subSector: subSectorDetails?.name || formData.subSector,
        industry: industryDetails?.name || formData.industry,
        naicsCode: formData.industry || formData.subSector || formData.sector,
        userId: user.uid,
        businessType: "Startup",
        safetyIndicator: "Medium",
        ratingScore: 0, // To be calculated in mutation
        imageFile: formData.imageFile,
        imageUrls: [],
        mentionedUserIds: formData.mentionedUserIds,
        requestType: 'post', // Explicitly 'post'
      };
      console.log("[MainLayout] handleAddPost newPostDataForService PREPARED:", JSON.stringify(newPostDataForService, null, 2));
      addPostMutation.mutate(newPostDataForService);
    },
    [user, toast, addPostMutation, queryClient]
  );

  const addHelpRequestMutation = useMutation({
      mutationFn: async (newHelpRequestDataWithImage: NewPostData & { imageFile?: File | null; mentionedUserIds?: string[] }) => {
          if (!user) {
            throw new Error("User not authenticated to create help request.");
          }
          console.log('%c[MainLayout] addHelpRequestMutation: Initiated by user:', "color: #FFA500;", user.uid, "Data:", newHelpRequestDataWithImage);

          let currentRatingScore = 0;
          try {
            console.log(`%c[MainLayout] addHelpRequestMutation: Fetching reviews for user ${user.uid} to calculate rating score.`, "color: #FF8C00;");
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
              requestType: 'help_request', // Explicitly 'help_request'
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

 const handleRequestHelpSubmit = useCallback(
      (formData: RequestHelpFormData) => {
          if (!user) {
              toast({ variant: "destructive", title: "Authentication Required", description: "You must be logged in." });
              return;
          }
          console.log("[MainLayout] handleRequestHelpSubmit formData RECEIVED:", JSON.stringify(formData, null, 2));

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
              businessType: "Project",
              safetyIndicator: "Medium",
              ratingScore: 0, // To be calculated in mutation
              imageFile: formData.imageFile,
              imageUrls: [],
              mentionedUserIds: formData.mentionedUserIds,
              requestType: 'help_request',
              maxBudget: formData.maxBudget,
              deadline: formData.deadline ? Timestamp.fromDate(formData.deadline) : null,
          };
          console.log("[MainLayout] handleRequestHelpSubmit newHelpRequestData PREPARED:", JSON.stringify(newHelpRequestData, null, 2));
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
              {user ? (
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
                        <HandHelping className="mr-2 h-4 w-4" />
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

                  {user.uid && <DynamicNotificationDropdown userId={user.uid} />}
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
                </>
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
        pathname === '/contracts' && isMobile ? "pb-0" : "pb-14 md:pb-0" // Adjusted for full height contracts on mobile
      )}>
        {children}
      </main>

      {!(pathname === '/contracts' && isMobile) && ( // Conditionally render bottom nav
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
