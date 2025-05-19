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
import { Home, Compass, Network, FileText, LogOut, PlusCircle, UserCircle, CreditCard, Settings, User, Bell } from "lucide-react";
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { CreatePostForm, type CreatePostFormData, type SectorWithSubSectors, type SubSector, type Industry } from '@/components/CreatePostForm';
import type { NewPostData } from '@/types/post';
import { addPostToFirestore } from '@/services/postService';
import { uploadPostImage } from '@/services/storageService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { createNotification } from '@/services/notificationService'; // Import createNotification

const navItems = [
  { title: "Board", href: "/", icon: Home },
  { title: "Discover", href: "/discover", icon: Compass },
  { title: "Connect", href: "/connect", icon: Network },
  { title: "Contracts", href: "/contracts", icon: FileText },
];

export const availableTags = [
    "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

// Export this detailed data structure
export const detailedSectorsData: SectorWithSubSectors[] = [
  {
    name: "Agriculture, Forestry, Fishing and Hunting",
    code: "11",
    description: "Activities related to growing crops, raising animals, harvesting timber, and fishing.",
    subSectors: [
      { name: "Crop Production", code: "111", industries: [
          { name: "Soybean Farming", code: "111110" },
          { name: "Oilseed (except Soybean) Farming", code: "111120" },
          { name: "Dry Pea and Bean Farming", code: "111130" },
          { name: "Wheat Farming", code: "111140" },
          { name: "Corn Farming", code: "111150" },
          { name: "Rice Farming", code: "111160" },
          { name: "Other Grain Farming", code: "111190" },
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
      { name: "Animal Production and Aquaculture", code: "112", industries: [
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
      { name: "Forestry and Logging", code: "113", industries: [
          { name: "Timber Tract Operations", code: "113110" },
          { name: "Forest Nurseries and Gathering of Forest Products", code: "113210" },
          { name: "Logging", code: "113310" },
        ]
      },
      { name: "Fishing, Hunting and Trapping", code: "114", industries: [
          { name: "Finfish Fishing", code: "114111" },
          { name: "Shellfish Fishing", code: "114112" },
          { name: "Other Marine Fishing", code: "114119" },
          { name: "Hunting and Trapping", code: "114210" },
        ]
      },
      { name: "Support Activities for Agriculture and Forestry", code: "115", industries: [
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
    ],
  },
  {
    name: "Mining, Quarrying, and Oil and Gas Extraction",
    code: "21",
    description: "Extracting naturally occurring mineral solids, liquid minerals, and gases.",
    subSectors: [
      { name: "Oil and Gas Extraction", code: "211", industries: [{ name: "Crude Petroleum and Natural Gas Extraction", code: "211121" }, { name: "Natural Gas Liquid Extraction", code: "211130"}] },
      { name: "Mining (except Oil and Gas)", code: "212", industries: [{ name: "Coal Mining", code: "212110" }, { name: "Metal Ore Mining", code: "212200" }, { name: "Nonmetallic Mineral Mining and Quarrying", code: "212300"}] },
      { name: "Support Activities for Mining", code: "213", industries: [{ name: "Support Activities for Oil and Gas Operations", code: "213111" }, { name: "Support Activities for Coal Mining", code: "213113"}] },
    ],
  },
  {
    name: "Utilities",
    code: "22",
    description: "Generating, transmitting, or distributing electricity, gas, steam, water, and sewage removal.",
    subSectors: [
      { name: "Electric Power Generation, Transmission and Distribution", code: "2211", industries: [{ name: "Electric Power Generation", code: "221110" }, { name: "Electric Power Transmission, Control, and Distribution", code: "221120"}] },
      { name: "Natural Gas Distribution", code: "2212", industries: [{ name: "Natural Gas Distribution", code: "221210"}] },
      { name: "Water, Sewage and Other Systems", code: "2213", industries: [{ name: "Water Supply and Irrigation Systems", code: "221310" }, { name: "Sewage Treatment Facilities", code: "221320"}]},
    ],
  },
  {
    name: "Construction",
    code: "23",
    description: "Constructing, repairing, and renovating buildings and engineering works.",
    subSectors: [
      { name: "Construction of Buildings", code: "236", industries: [{ name: "Residential Building Construction", code: "236100" }, { name: "Nonresidential Building Construction", code: "236200"}] },
      { name: "Heavy and Civil Engineering Construction", code: "237", industries: [{ name: "Utility System Construction", code: "237100" }, { name: "Highway, Street, and Bridge Construction", code: "237310"}] },
      { name: "Specialty Trade Contractors", code: "238", industries: [{ name: "Foundation, Structure, and Building Exterior Contractors", code: "238100" }, { name: "Building Equipment Contractors", code: "238200" }]}
    ],
  },
  {
    name: "Manufacturing",
    code: "31-33",
    description: "Mechanical, physical, or chemical transformation of materials, substances, or components into new products.",
    subSectors: [
      { name: "Food Manufacturing", code: "311", industries: [
          { name: "Animal Food Manufacturing", code: "311110" },
          { name: "Grain and Oilseed Milling", code: "311200" }, // Simplified from 3112 to show example
          { name: "Sugar and Confectionery Product Manufacturing", code: "311300" },
          { name: "Fruit and Vegetable Preserving and Specialty Food Manufacturing", code: "311400" },
          { name: "Dairy Product Manufacturing", code: "311500" },
          { name: "Animal Slaughtering and Processing", code: "311610" },
          { name: "Seafood Product Preparation and Packaging", code: "311710" },
          { name: "Bakeries and Tortilla Manufacturing", code: "311800" },
          { name: "Other Food Manufacturing", code: "311900" },
        ]
      },
      { name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [ { name: "Beverage Manufacturing", code: "312100" }, { name: "Tobacco Manufacturing", code: "312200" }, ] },
      { name: "Textile Mills", code: "313", industries: [ { name: "Fiber, Yarn, and Thread Mills", code: "313110" }, { name: "Fabric Mills", code: "313200" }, ] },
      { name: "Textile Product Mills", code: "314", industries: [ { name: "Textile Furnishings Mills", code: "314100" }, { name: "Other Textile Product Mills", code: "314900" }, ] },
      { name: "Apparel Manufacturing", code: "315", industries: [ { name: "Apparel Knitting Mills", code: "315100" }, { name: "Cut and Sew Apparel Manufacturing", code: "315200" }, ] },
      { name: "Leather and Allied Product Manufacturing", code: "316", industries: [ { name: "Leather and Hide Tanning and Finishing", code: "316110" }, { name: "Footwear Manufacturing", code: "316210" }, ] },
      { name: "Wood Product Manufacturing", code: "321", industries: [ { name: "Sawmills and Wood Preservation", code: "321110" }, { name: "Veneer, Plywood, and Engineered Wood Product Manufacturing", code: "321210" }, ] },
      { name: "Paper Manufacturing", code: "322", industries: [ { name: "Pulp, Paper, and Paperboard Mills", code: "322100" }, { name: "Converted Paper Product Manufacturing", code: "322200" }, ] },
      { name: "Printing and Related Support Activities", code: "323", industries: [ { name: "Printing", code: "323110" }, { name: "Support Activities for Printing", code: "323120" }, ] },
      { name: "Petroleum and Coal Products Manufacturing", code: "324", industries: [ { name: "Petroleum Refineries", code: "324110" }, { name: "Asphalt Paving, Roofing, and Saturated Materials Manufacturing", code: "324120" }, ] },
      { name: "Chemical Manufacturing", code: "325", industries: [ { name: "Basic Chemical Manufacturing", code: "325100" }, { name: "Pharmaceutical and Medicine Manufacturing", code: "325410" }, ] },
      { name: "Plastics and Rubber Products Manufacturing", code: "326", industries: [ { name: "Plastics Product Manufacturing", code: "326100" }, { name: "Rubber Product Manufacturing", code: "326200" }, ] },
      { name: "Nonmetallic Mineral Product Manufacturing", code: "327", industries: [ { name: "Clay Product and Refractory Manufacturing", code: "327100" }, { name: "Glass and Glass Product Manufacturing", code: "327210" }, ] },
      { name: "Primary Metal Manufacturing", code: "331", industries: [ { name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "331110" }, { name: "Alumina and Aluminum Production and Processing", code: "331310" }, ] },
      { name: "Fabricated Metal Product Manufacturing", code: "332", industries: [ { name: "Forging and Stamping", code: "332110" }, { name: "Cutlery and Handtool Manufacturing", code: "332210" }, ] },
      { name: "Machinery Manufacturing", code: "333", industries: [ { name: "Agriculture, Construction, and Mining Machinery Manufacturing", code: "333100" }, { name: "Industrial Machinery Manufacturing", code: "333240" }, ] },
      { name: "Computer and Electronic Product Manufacturing", code: "334", industries: [ { name: "Computer and Peripheral Equipment Manufacturing", code: "334110" }, { name: "Communications Equipment Manufacturing", code: "334200" }, ] },
      { name: "Electrical Equipment, Appliance, and Component Manufacturing", code: "335", industries: [ { name: "Electric Lighting Equipment Manufacturing", code: "335130" }, { name: "Household Appliance Manufacturing", code: "335200" }, ] },
      { name: "Transportation Equipment Manufacturing", code: "336", industries: [ { name: "Motor Vehicle Manufacturing", code: "336100" }, { name: "Aerospace Product and Parts Manufacturing", code: "336410" }, ] },
      { name: "Furniture and Related Product Manufacturing", code: "337", industries: [ { name: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", code: "337100" }, { name: "Office Furniture (including Fixtures) Manufacturing", code: "337210" }, ] },
      { name: "Miscellaneous Manufacturing", code: "339", industries: [ { name: "Medical Equipment and Supplies Manufacturing", code: "339110" }, { name: "Sporting and Athletic Goods Manufacturing", code: "339920" }, ] },
    ],
  },
  { name: "Wholesale Trade", code: "42", description: "Wholesaling merchandise, generally without transformation.", subSectors: [{name: "Merchant Wholesalers, Durable Goods", code: "423", industries: [{name: "Machinery, Equipment, and Supplies Merchant Wholesalers", code: "423800"}] }, {name: "Merchant Wholesalers, Nondurable Goods", code: "424", industries: [{ name: "Grocery and Related Product Merchant Wholesalers", code: "424400"}]}]},
  { name: "Retail Trade", code: "44-45", description: "Retailing merchandise, generally without transformation.", subSectors: [{name: "Motor Vehicle and Parts Dealers", code: "441", industries: [{name: "Automobile Dealers", code: "441100"}] }, {name: "Furniture and Home Furnishings Stores", code: "442", industries: [{name: "Furniture Stores", code: "442110"}]}]},
  { name: "Transportation and Warehousing", code: "48-49", description: "Providing transportation of passengers and cargo, warehousing and storing goods.", subSectors: [{name: "Air Transportation", code: "481", industries: [{name: "Scheduled Passenger Air Transportation", code: "481110"}] }, {name: "Truck Transportation", code: "484", industries: [{ name: "General Freight Trucking", code: "484100"}]}]},
  { name: "Information", code: "51", description: "Producing and distributing information and cultural products.", subSectors: [{name: "Publishing Industries (except Internet)", code: "511", industries: [{name: "Newspaper, Periodical, Book, and Directory Publishers", code: "511100"}] }, { name: "Telecommunications", code: "517", industries: [{name: "Wired Telecommunications Carriers", code: "517310"}]}]},
  { name: "Finance and Insurance", code: "52", description: "Transactions involving the creation, liquidation, or change in ownership of financial assets.", subSectors: [{name: "Credit Intermediation and Related Activities", code: "522", industries: [{name: "Commercial Banking", code: "522110"}] }, {name: "Insurance Carriers and Related Activities", code: "524", industries: [{ name: "Insurance Carriers", code: "524100"}]}]},
  { name: "Real Estate and Rental and Leasing", code: "53", description: "Renting, leasing, or otherwise allowing the use of tangible or intangible assets.", subSectors: [{name: "Real Estate", code: "531", industries: [{name: "Lessors of Real Estate", code: "531100"}] }, {name: "Rental and Leasing Services", code: "532", industries: [{ name: "Automotive Equipment Rental and Leasing", code: "532100"}]}]},
  { name: "Professional, Scientific, and Technical Services", code: "54", description: "Performing professional, scientific, and technical activities for others.", subSectors: [{name: "Legal Services", code: "5411", industries: [{name: "Offices of Lawyers", code: "541110"}] }, {name: "Computer Systems Design and Related Services", code: "5415", industries: [{ name: "Custom Computer Programming Services", code: "541511"}]}]},
  { name: "Management of Companies and Enterprises", code: "55", description: "Holding the securities of companies and enterprises.", subSectors: [{name: "Management of Companies and Enterprises", code: "551", industries: [{name: "Offices of Holding Companies", code: "551111"}] }]},
  { name: "Administrative and Support and Waste Management and Remediation Services", code: "56", description: "Performing routine support activities or managing waste.", subSectors: [{name: "Administrative and Support Services", code: "561", industries: [{name: "Office Administrative Services", code: "561110"}] }, { name: "Waste Management and Remediation Services", code: "562", industries: [{ name: "Waste Collection", code: "562110"}]}]},
  { name: "Educational Services", code: "61", description: "Providing instruction and training.", subSectors: [{name: "Colleges, Universities, and Professional Schools", code: "6113", industries: [{name: "Colleges, Universities, and Professional Schools", code: "611310"}] }, { name: "Elementary and Secondary Schools", code: "6111", industries: [{ name: "Elementary and Secondary Schools", code: "611110"}]}]},
  { name: "Health Care and Social Assistance", code: "62", description: "Providing health care and social assistance.", subSectors: [{name: "Ambulatory Health Care Services", code: "621", industries: [{name: "Offices of Physicians", code: "621110"}] }, {name: "Hospitals", code: "622", industries: [{ name: "General Medical and Surgical Hospitals", code: "622110"}]}]},
  { name: "Arts, Entertainment, and Recreation", code: "71", description: "Operating facilities or providing services to meet varied cultural, entertainment, and recreational interests.", subSectors: [{name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [{name: "Performing Arts Companies", code: "711100"}] }, {name: "Museums, Historical Sites, and Similar Institutions", code: "712", industries: [{ name: "Museums", code: "712110"}]}]},
  { name: "Accommodation and Food Services", code: "72", description: "Providing customers with lodging and/or preparing meals.", subSectors: [{name: "Accommodation", code: "721", industries: [{name: "Traveler Accommodation", code: "721100"}] }, {name: "Food Services and Drinking Places", code: "722", industries: [{ name: "Restaurants and Other Eating Places", code: "722510"}]}]},
  { name: "Other Services (except Public Administration)", code: "81", description: "Providing services not elsewhere classified.", subSectors: [{name: "Repair and Maintenance", code: "811", industries: [{name: "Automotive Repair and Maintenance", code: "811100"}] }, {name: "Personal and Laundry Services", code: "812", industries: [{ name: "Personal Care Services", code: "812100"}]}]},
  { name: "Public Administration", code: "92", description: "Activities of a governmental nature.", subSectors: [{name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [{name: "Executive Offices", code: "921110"}] }, {name: "Justice, Public Order, and Safety Activities", code: "922", industries: [{ name: "Police Protection", code: "922120"}]}]}
];


const getInitials = (displayNameOrEmail: string | null | undefined): string => {
    if (!displayNameOrEmail) return '?';
    const name = displayNameOrEmail.startsWith('@') ? displayNameOrEmail.substring(1) : displayNameOrEmail;

    // Check for ColorAnimalNumber format first
    const pseudonymRegex = /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{3}$/;
    if (pseudonymRegex.test(name)) {
        const match = name.match(/^([A-Z])[a-z]+([A-Z])/); // Get first letter of Color and Animal
        if (match && match[1] && match[2]) return match[1] + match[2];
        if (match && match[1]) return match[1]; // Fallback if only Color part found
    }

    // Fallback for other names (e.g., actual display names or company names)
    const parts = name.split(' ').filter(Boolean);
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

  // Effect to close dialog on route change if you want that behavior
  useEffect(() => {
    setIsCreatePostOpen(false); // Close dialog when route changes
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
      postDataForFirestore.imageUrls = uploadedImageUrls;
      postDataForFirestore.mentionedUserIds = newPostDataWithImage.mentionedUserIds || []; // Ensure it's an array

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
      setIsCreatePostOpen(false); // Close dialog on success

      // Trigger notifications for mentions
      if (user && newlyCreatedPostId && variables.mentionedUserIds && variables.mentionedUserIds.length > 0) {
        console.log(`[MainLayout] Post created, triggering notifications for ${variables.mentionedUserIds.length} mentions.`);
        variables.mentionedUserIds.forEach(async (mentionedUid) => {
          if (mentionedUid !== user.uid) { // Don't notify self for mentioning self in post
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
      // setIsCreatePostOpen(false); // Keep dialog open on error, or close if preferred
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
        imageUrls: [], // Will be populated by the mutation after upload
        mentionedUserIds: formData.mentionedUserIds || [], // Pass UIDs from form
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
