
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
import { Home, Compass, Network, FileText, LogOut, PlusCircle, UserCircle, CreditCard, Settings, User, Bell } from "lucide-react";
import { signOut } from '@/lib/firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { CreatePostForm, type CreatePostFormData, type SectorWithSubSectors, type SubSector, type Industry } from '@/components/CreatePostForm';
import type { NewPostData } from '@/types/post';
import { addPostToFirestore } from '@/services/postService';
import { uploadPostImage } from '@/services/storageService'; // Import storage service
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
// This should ideally be managed in a more scalable way if it becomes very large
export const detailedSectorsData: SectorWithSubSectors[] = [
  {
    name: "Agriculture, Forestry, Fishing and Hunting",
    code: "11",
    description: "Activities related to growing crops, raising animals, harvesting timber, and fishing.",
    subSectors: [
      {
        name: "Crop Production", code: "111", industries: [
          { name: "Oilseed and Grain Farming", code: "1111" },
          { name: "Vegetable and Melon Farming", code: "1112" },
          { name: "Fruit and Tree Nut Farming", code: "1113" },
          { name: "Greenhouse, Nursery, and Floriculture Production", code: "1114" },
          { name: "Other Crop Farming", code: "1119" },
        ]
      },
      {
        name: "Animal Production and Aquaculture", code: "112", industries: [
          { name: "Cattle Ranching and Farming", code: "1121" },
          { name: "Hog and Pig Farming", code: "1122" },
          { name: "Poultry and Egg Production", code: "1123" },
          { name: "Sheep and Goat Farming", code: "1124" },
          { name: "Aquaculture", code: "1125" },
          { name: "Other Animal Production", code: "1129" },
        ]
      },
      {
        name: "Forestry and Logging", code: "113", industries: [
          { name: "Timber Tract Operations", code: "1131" },
          { name: "Forest Nurseries and Gathering of Forest Products", code: "1132" },
          { name: "Logging", code: "1133" },
        ]
      },
      {
        name: "Fishing, Hunting and Trapping", code: "114", industries: [
          { name: "Finfish Fishing", code: "114111" }, // Example of more specific code
          { name: "Shellfish Fishing", code: "114112" },
          { name: "Hunting and Trapping", code: "114210" },
        ]
      },
      {
        name: "Support Activities for Agriculture and Forestry", code: "115", industries: [
          { name: "Support Activities for Crop Production", code: "1151" },
          { name: "Support Activities for Animal Production", code: "1152" },
          { name: "Support Activities for Forestry", code: "1153" },
        ]
      },
    ],
  },
  {
    name: "Mining, Quarrying, and Oil and Gas Extraction",
    code: "21",
    description: "Extracting naturally occurring mineral solids, liquid minerals, and gases.",
    subSectors: [
      { name: "Oil and Gas Extraction", code: "211", industries: [{ name: "Crude Petroleum and Natural Gas Extraction", code: "2111" }] },
      { name: "Mining (except Oil and Gas)", code: "212", industries: [{ name: "Coal Mining", code: "2121" }, { name: "Metal Ore Mining", code: "2122" }] },
      { name: "Support Activities for Mining", code: "213", industries: [{ name: "Support Activities for Oil and Gas Operations", code: "2131" }] },
    ],
  },
  {
    name: "Utilities",
    code: "22",
    description: "Generating, transmitting, or distributing electricity, gas, steam, water, and sewage removal.",
    subSectors: [
      { name: "Electric Power Generation, Transmission and Distribution", code: "221", industries: [{ name: "Electric Power Generation", code: "2211" }] },
    ],
  },
  {
    name: "Construction",
    code: "23",
    description: "Constructing, repairing, and renovating buildings and engineering works.",
    subSectors: [
      { name: "Construction of Buildings", code: "236", industries: [{ name: "Residential Building Construction", code: "2361" }] },
      { name: "Heavy and Civil Engineering Construction", code: "237", industries: [{ name: "Utility System Construction", code: "2371" }] },
    ],
  },
  {
    name: "Manufacturing",
    code: "31-33",
    description: "Mechanical, physical, or chemical transformation of materials, substances, or components into new products.",
    subSectors: [
      {
        name: "Food Manufacturing", code: "311", industries: [
          { name: "Animal Food Manufacturing", code: "3111" },
          { name: "Grain and Oilseed Milling", code: "3112" },
          { name: "Sugar and Confectionery Product Manufacturing", code: "3113" },
        ]
      },
      {
        name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [
          { name: "Beverage Manufacturing", code: "3121" },
        ]
      },
      {
        name: "Textile Mills", code: "313", industries: [
          { name: "Fabric Mills", code: "3132" },
        ]
      },
      { name: "Apparel Manufacturing", code: "315", industries: [{ name: "Cut and Sew Apparel Manufacturing", code: "3152"}] },
      { name: "Wood Product Manufacturing", code: "321", industries: [{ name: "Sawmills and Wood Preservation", code: "3211"}] },
      { name: "Paper Manufacturing", code: "322", industries: [{ name: "Pulp, Paper, and Paperboard Mills", code: "3221"}] },
      { name: "Chemical Manufacturing", code: "325", industries: [{ name: "Basic Chemical Manufacturing", code: "3251"}] },
      { name: "Plastics and Rubber Products Manufacturing", code: "326", industries: [{ name: "Plastics Product Manufacturing", code: "3261"}] },
      { name: "Primary Metal Manufacturing", code: "331", industries: [{ name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "3311"}] },
      { name: "Fabricated Metal Product Manufacturing", code: "332", industries: [{ name: "Forging and Stamping", code: "3321"}] },
      { name: "Machinery Manufacturing", code: "333", industries: [{ name: "Agriculture, Construction, and Mining Machinery Manufacturing", code: "3331"}] },
      { name: "Computer and Electronic Product Manufacturing", code: "334", industries: [{ name: "Computer and Peripheral Equipment Manufacturing", code: "3341"}] },
      { name: "Transportation Equipment Manufacturing", code: "336", industries: [{ name: "Motor Vehicle Manufacturing", code: "3361"}] },
    ],
  },
  { name: "Wholesale Trade", code: "42", description: "Wholesaling merchandise, generally without transformation, and rendering services incidental to the sale of merchandise.", subSectors: [{name: "Merchant Wholesalers, Durable Goods", code: "423", industries: [{name: "Machinery, Equipment, and Supplies Merchant Wholesalers", code: "4238"}] }] },
  { name: "Retail Trade", code: "44-45", description: "Retailing merchandise, generally without transformation, and rendering services incidental to the sale of merchandise.", subSectors: [{name: "Motor Vehicle and Parts Dealers", code: "441", industries: [{name: "Automobile Dealers", code: "4411"}] }] },
  { name: "Transportation and Warehousing", code: "48-49", description: "Providing transportation of passengers and cargo, warehousing and storing goods.", subSectors: [{name: "Air Transportation", code: "481", industries: [{name: "Scheduled Passenger Air Transportation", code: "4811"}] }] },
  { name: "Information", code: "51", description: "Producing and distributing information and cultural products, providing the means to transmit or distribute these products, and processing data.", subSectors: [{name: "Publishing Industries (except Internet)", code: "511", industries: [{name: "Newspaper, Periodical, Book, and Directory Publishers", code: "5111"}] }] },
  { name: "Finance and Insurance", code: "52", description: "Transactions involving the creation, liquidation, or change in ownership of financial assets.", subSectors: [{name: "Credit Intermediation and Related Activities", code: "522", industries: [{name: "Commercial Banking", code: "5221"}] }] },
  { name: "Real Estate and Rental and Leasing", code: "53", description: "Renting, leasing, or otherwise allowing the use of tangible or intangible assets, and related activities.", subSectors: [{name: "Real Estate", code: "531", industries: [{name: "Lessors of Real Estate", code: "5311"}] }] },
  { name: "Professional, Scientific, and Technical Services", code: "54", description: "Performing professional, scientific, and technical activities for others.", subSectors: [{name: "Legal Services", code: "541", industries: [{name: "Offices of Lawyers", code: "5411"}] }] }, // Note: NAICS for Legal Services subsector is 541, industry 5411
  { name: "Management of Companies and Enterprises", code: "55", description: "Holding the securities of companies and enterprises for the purpose of owning a controlling interest or influencing management decisions.", subSectors: [{name: "Management of Companies and Enterprises", code: "551", industries: [{name: "Offices of Holding Companies", code: "5511"}] }] },
  { name: "Administrative and Support and Waste Management and Remediation Services", code: "56", description: "Performing routine support activities for the day-to-day operations of other organizations, or managing waste.", subSectors: [{name: "Administrative and Support Services", code: "561", industries: [{name: "Office Administrative Services", code: "5611"}] }] },
  { name: "Educational Services", code: "61", description: "Providing instruction and training in a wide variety of subjects.", subSectors: [{name: "Colleges, Universities, and Professional Schools", code: "611", industries: [{name: "Colleges, Universities, and Professional Schools", code: "6113"}] }] }, // Note: NAICS for this subsector is 611, industry 6113
  { name: "Health Care and Social Assistance", code: "62", description: "Providing health care and social assistance for individuals.", subSectors: [{name: "Ambulatory Health Care Services", code: "621", industries: [{name: "Offices of Physicians", code: "6211"}] }] },
  { name: "Arts, Entertainment, and Recreation", code: "71", description: "Operating facilities or providing services to meet varied cultural, entertainment, and recreational interests of their patrons.", subSectors: [{name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [{name: "Performing Arts Companies", code: "7111"}] }] },
  { name: "Accommodation and Food Services", code: "72", description: "Providing customers with lodging and/or preparing meals, snacks, and beverages for immediate consumption.", subSectors: [{name: "Accommodation", code: "721", industries: [{name: "Traveler Accommodation", code: "7211"}] }] },
  { name: "Other Services (except Public Administration)", code: "81", description: "Providing services not elsewhere classified, such as equipment and machinery repairing, promoting or administering religious activities, grantmaking, advocacy, and providing drycleaning and laundry services, personal care services, death care services, pet care services, photofinishing services, temporary parking services, and dating services.", subSectors: [{name: "Repair and Maintenance", code: "811", industries: [{name: "Automotive Repair and Maintenance", code: "8111"}] }] },
  { name: "Public Administration", code: "92", description: "Activities of a governmental nature, i.e., the enactment and judicial interpretation of laws and their pursuant regulations, and the administration of programs based on them.", subSectors: [{name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [{name: "Executive Offices", code: "9211"}] }] }
];


const getInitials = (displayNameOrEmail: string | null | undefined): string => {
    if (!displayNameOrEmail) return '?';
    const name = displayNameOrEmail;
    if (name.includes('@') && !name.includes(' ')) {
        return name.charAt(0).toUpperCase();
    }
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }
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
    mutationFn: async (newPostData: NewPostData & { imageFile?: File | null }) => {
      let imageUrl: string | undefined = undefined;
      if (newPostData.imageFile && user) {
        imageUrl = await uploadPostImage(newPostData.imageFile, user.uid);
      }
      // Remove imageFile before sending to Firestore
      const { imageFile, ...postDataForFirestore } = newPostData;
      return addPostToFirestore({ ...postDataForFirestore, imageUrl });
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['posts'] }).then(() => {
            toast({
                title: "Post Created",
                description: "Your post has been added to the board.",
            });
            setIsCreatePostOpen(false);
        }).catch(err => {
            console.error("Error during post-success operations (invalidate/toast/close):", err);
             setIsCreatePostOpen(false); // Still close dialog on error after mutation
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
        businessType: "Startup", // Example, make this configurable if needed
        safetyIndicator: "Medium", // Example
        ratingScore: Math.floor(Math.random() * 3) + 3, // Example
        imageFile: formData.imageFile, // Pass the File object
        // imageUrl will be set by the mutation after upload
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
                  <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl"> {/* Make dialog wider */}
                     <DialogHeader>
                       <DialogTitle>Create a New Post</DialogTitle>
                       <DialogDescription>
                         Share your question or need with the community. Keep it anonymous.
                       </DialogDescription>
                     </DialogHeader>
                     {isCreatePostOpen && ( // Conditionally render to re-mount and reset form state on open
                        <CreatePostForm
                           onSubmit={handleAddPost}
                           availableTags={availableTags}
                           detailedSectorsData={detailedSectorsData}
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
