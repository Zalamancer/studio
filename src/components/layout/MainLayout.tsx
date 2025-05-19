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
import { CreatePostForm, type CreatePostFormData, type SectorWithSubSectors, type SubSector, type Industry } from '@/components/CreatePostForm';
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

// Export this detailed data structure
export const detailedSectorsData: SectorWithSubSectors[] = [
  {
    name: "Agriculture, Forestry, Fishing and Hunting",
    code: "11",
    description: "Activities related to growing crops, raising animals, harvesting timber, and fishing.",
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
    ],
  },
  {
    name: "Mining, Quarrying, and Oil and Gas Extraction",
    code: "21",
    description: "Extracting naturally occurring mineral solids, liquid minerals, and gases.",
    subSectors: [
      { name: "Oil and Gas Extraction", code: "211", industries: [
          { name: "Crude Petroleum Extraction", code: "211120"},
          { name: "Natural Gas Extraction", code: "211130"}
        ]
      },
      { name: "Mining (except Oil and Gas)", code: "212", industries: [
          { name: "Coal Mining", code: "2121" },
          { name: "Metal Ore Mining", code: "2122" },
          { name: "Nonmetallic Mineral Mining and Quarrying", code: "2123" },
        ]
      },
      { name: "Support Activities for Mining", code: "213", industries: [
          { name: "Drilling Oil and Gas Wells", code: "213111"},
          { name: "Support Activities for Oil and Gas Operations", code: "213112" },
          { name: "Support Activities for Coal Mining", code: "213113" },
          { name: "Support Activities for Metal Mining", code: "213114" },
          { name: "Support Activities for Nonmetallic Minerals (except Fuels) Mining", code: "213115" },
        ]
      },
    ],
  },
  {
    name: "Utilities",
    code: "22",
    description: "Generating, transmitting, or distributing electricity, gas, steam, water, and sewage removal.",
    subSectors: [
      { name: "Electric Power Generation, Transmission and Distribution", code: "2211", industries: [
          { name: "Hydroelectric Power Generation", code: "221111" },
          { name: "Fossil Fuel Electric Power Generation", code: "221112" },
          { name: "Nuclear Electric Power Generation", code: "221113" },
          { name: "Solar Electric Power Generation", code: "221114" },
          { name: "Wind Electric Power Generation", code: "221115" },
          { name: "Geothermal Electric Power Generation", code: "221116" },
          { name: "Biomass Electric Power Generation", code: "221117" },
          { name: "Other Electric Power Generation", code: "221118" },
          { name: "Electric Bulk Power Transmission and Control", code: "221121" },
          { name: "Electric Power Distribution", code: "221122" }
        ]
      },
      { name: "Natural Gas Distribution", code: "2212", industries: [
          { name: "Natural Gas Distribution", code: "221210"}
        ]
      },
      { name: "Water, Sewage and Other Systems", code: "2213", industries: [
          { name: "Water Supply and Irrigation Systems", code: "221310" },
          { name: "Sewage Treatment Facilities", code: "221320"},
          { name: "Steam and Air-Conditioning Supply", code: "221330"}
        ]
      },
    ],
  },
  {
    name: "Construction",
    code: "23",
    description: "Constructing, repairing, and renovating buildings and engineering works.",
    subSectors: [
      { name: "Construction of Buildings", code: "236", industries: [
          { name: "Residential Building Construction", code: "2361" },
          { name: "Nonresidential Building Construction", code: "2362" }
        ]
      },
      { name: "Heavy and Civil Engineering Construction", code: "237", industries: [
          { name: "Utility System Construction", code: "2371" },
          { name: "Land Subdivision", code: "2372" },
          { name: "Highway, Street, and Bridge Construction", code: "2373" },
          { name: "Other Heavy and Civil Engineering Construction", code: "2379" }
        ]
      },
      { name: "Specialty Trade Contractors", code: "238", industries: [
          { name: "Foundation, Structure, and Building Exterior Contractors", code: "2381" },
          { name: "Building Equipment Contractors", code: "2382" },
          { name: "Building Finishing Contractors", code: "2383" },
          { name: "Other Specialty Trade Contractors", code: "2389" }
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
          { name: "Printing", code: "32311" }, // More specific for example
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
  { name: "Wholesale Trade", code: "42", description: "Wholesaling merchandise, generally without transformation.",
    subSectors: [
        { name: "Merchant Wholesalers, Durable Goods", code: "423", industries: [
            { name: "Motor Vehicle and Motor Vehicle Parts and Supplies Merchant Wholesalers", code: "4231"},
            { name: "Furniture and Home Furnishing Merchant Wholesalers", code: "4232"},
            { name: "Lumber and Other Construction Materials Merchant Wholesalers", code: "4233"},
            { name: "Professional and Commercial Equipment and Supplies Merchant Wholesalers", code: "4234"},
            { name: "Metal and Mineral (except Petroleum) Merchant Wholesalers", code: "4235"},
          ]
        },
        { name: "Merchant Wholesalers, Nondurable Goods", code: "424", industries: [
            { name: "Paper and Paper Product Merchant Wholesalers", code: "4241"},
            { name: "Drugs and Druggists' Sundries Merchant Wholesalers", code: "4242"},
            { name: "Apparel, Piece Goods, and Notions Merchant Wholesalers", code: "4243"},
            { name: "Grocery and Related Product Merchant Wholesalers", code: "4244"},
            { name: "Farm Product Raw Material Merchant Wholesalers", code: "4245"},
          ]
        },
        { name: "Wholesale Electronic Markets and Agents and Brokers", code: "425", industries: [
            { name: "Wholesale Electronic Markets and Agents and Brokers", code: "4251"}
          ]
        }
      ]
  },
  { name: "Retail Trade", code: "44-45", description: "Retailing merchandise, generally without transformation.",
    subSectors: [
        { name: "Motor Vehicle and Parts Dealers", code: "441", industries: [
            { name: "Automobile Dealers", code: "4411"},
            { name: "Other Motor Vehicle Dealers", code: "4412"},
            { name: "Automotive Parts, Accessories, and Tire Stores", code: "4413"}
          ]
        },
        { name: "Furniture and Home Furnishings Stores", code: "442", industries: [ // In NAICS 2022, this becomes 449
            { name: "Furniture Stores", code: "449110"}, // Updated for 2022
            { name: "Home Furnishings Stores", code: "449120"} // Updated for 2022
          ]
        },
        { name: "Electronics and Appliance Stores", code: "443", industries: [ // In NAICS 2022, this becomes 449
            {name: "Electronics and Appliance Stores", code: "449210"} // Updated for 2022
        ]},
        { name: "Building Material and Garden Equipment and Supplies Dealers", code: "444", industries: [
            {name: "Building Material and Supplies Dealers", code: "4441"},
            {name: "Lawn and Garden Equipment and Supplies Stores", code: "4442"}
        ]},
        { name: "Food and Beverage Stores", code: "445", industries: [
            {name: "Grocery Stores", code: "4451"},
            {name: "Specialty Food Stores", code: "4452"},
            {name: "Beer, Wine, and Liquor Stores", code: "4453"}
        ]},
        { name: "Health and Personal Care Stores", code: "446", industries: [
            {name: "Pharmacies and Drug Stores", code: "446110"},
            {name: "Cosmetics, Beauty Supplies, and Perfume Stores", code: "446120"},
            {name: "Optical Goods Stores", code: "446130"}
        ]},
        { name: "Gasoline Stations", code: "447", industries: [ // In NAICS 2022, this becomes 457
            {name: "Gasoline Stations with Convenience Stores", code: "457110"}, // Updated for 2022
            {name: "Other Gasoline Stations", code: "457120"} // Updated for 2022
        ]},
        { name: "Clothing and Clothing Accessories Stores", code: "448", industries: [ // In NAICS 2022, this becomes 458
            {name: "Clothing Stores", code: "458110"}, // Updated for 2022
            {name: "Shoe Stores", code: "458210"}, // Updated for 2022
            {name: "Jewelry, Luggage, and Leather Goods Stores", code: "4583"} // Updated for 2022
        ]},
        { name: "Sporting Goods, Hobby, Book, and Music Stores", code: "459", industries: [ // Combines old 451 and parts of 453 for 2022
            {name: "Sporting Goods Stores", code: "459110"},
            {name: "Hobby, Toy, and Game Stores", code: "459120"},
            {name: "Book Stores", code: "459210"},
            {name: "Music Stores (Instruments and Supplies)", code: "459140"} // Example of a more specific split
          ]
        },
        { name: "General Merchandise Stores", code: "455", industries: [ // Renamed for NAICS 2022 (was 452)
            {name: "Department Stores", code: "455211"}, // Was 452210
            {name: "Warehouse Clubs and Supercenters", code: "455212"}, // Was 452311
            {name: "All Other General Merchandise Stores", code: "455219"} // Was 452319
          ]
        },
        { name: "Miscellaneous Store Retailers", code: "459", industries: [ // This NAICS code is re-used, check context if 453 was meant for more specific old ones
            {name: "Florists", code: "459410"}, // Was 453110
            {name: "Office Supplies, Stationery, and Gift Stores", code: "459420"}, // Combines old Office Supplies and Gift Stores
            {name: "Used Merchandise Stores", code: "459510"}, // Was 453310
            {name: "Other Miscellaneous Store Retailers", code: "4599"} // Catch-all
          ]
        },
        { name: "Nonstore Retailers", code: "457", industries: [ // Re-uses 457, focus on electronic and direct selling
            {name: "Electronic Shopping", code: "457210"}, // Was part of 454110
            {name: "Mail-Order Houses", code: "457220"}, // Was part of 454110
            {name: "Vending Machine Operators", code: "457310"}, // Was 454210
            {name: "Direct Selling Establishments", code: "457320"} // Was 4543
          ]
        }
      ]
  },
  { name: "Transportation and Warehousing", code: "48-49", description: "Providing transportation of passengers and cargo, warehousing and storing goods.",
    subSectors: [
        { name: "Air Transportation", code: "481", industries: [{name: "Scheduled Passenger Air Transportation", code: "481111"}, {name: "Charter Air Transportation", code: "481211"}] },
        { name: "Rail Transportation", code: "482", industries: [{name: "Line-Haul Railroads", code: "482111"}] },
        { name: "Water Transportation", code: "483", industries: [{name: "Deep Sea, Coastal, and Great Lakes Water Transportation", code: "483111"}] },
        { name: "Truck Transportation", code: "484", industries: [{ name: "General Freight Trucking", code: "4841"}, { name: "Specialized Freight Trucking", code: "4842"}] },
        { name: "Transit and Ground Passenger Transportation", code: "485", industries: [{name: "Urban Transit Systems", code: "4851"}, {name: "Taxi and Limousine Service", code: "4853"}] },
        { name: "Pipeline Transportation", code: "486", industries: [{name: "Pipeline Transportation of Crude Oil", code: "4861"}] },
        { name: "Scenic and Sightseeing Transportation", code: "487", industries: [{name: "Scenic and Sightseeing Transportation, Land", code: "4871"}] },
        { name: "Support Activities for Transportation", code: "488", industries: [{name: "Support Activities for Air Transportation", code: "4881"}] },
        { name: "Couriers and Messengers", code: "492", industries: [{name: "Couriers and Express Delivery Services", code: "4921"}] },
        { name: "Warehousing and Storage", code: "493", industries: [{name: "General Warehousing and Storage", code: "4931"}] }
      ]
  },
  { name: "Information", code: "51", description: "Producing and distributing information and cultural products.",
    subSectors: [ // NAICS 2022 combines old 511 and 515 into 513 and 516, and 517, 518, 519 remain mostly similar but with some renumbering for 6-digit
        { name: "Publishing Industries", code: "513", industries: [ // New for 2022, combines old 511 and 515 elements
            {name: "Newspaper, Periodical, Book, and Directory Publishers", code: "5131"},
            {name: "Software Publishers", code: "5132"} // Was 5112
          ]
        },
        { name: "Motion Picture and Sound Recording Industries", code: "512", industries: [
            {name: "Motion Picture and Video Industries", code: "5121"},
            { name: "Sound Recording Industries", code: "5122"}
          ]
        },
        { name: "Broadcasting and Content Providers", code: "516", industries: [ // New for 2022
            {name: "Radio and Television Broadcasting", code: "5161"},
            {name: "Content Providers, Web Search Portals, and Data Processing Services", code: "5162"} // Groups old 518, 519 elements
          ]
        },
        { name: "Telecommunications", code: "517", industries: [
            {name: "Wired and Wireless Telecommunications Carriers (except Satellite)", code: "5171"},
            {name: "Satellite Telecommunications", code: "5174"},
            {name: "Other Telecommunications", code: "5179"}
          ]
        }
      ]
  },
  { name: "Finance and Insurance", code: "52", description: "Transactions involving the creation, liquidation, or change in ownership of financial assets.",
    subSectors: [
        { name: "Monetary Authorities - Central Bank", code: "521", industries: [{name: "Monetary Authorities - Central Bank", code: "5211"}] },
        { name: "Credit Intermediation and Related Activities", code: "522", industries: [
            {name: "Depository Credit Intermediation", code: "5221"},
            {name: "Nondepository Credit Intermediation", code: "5222"},
            {name: "Activities Related to Credit Intermediation", code: "5223"}
          ]
        },
        { name: "Securities, Commodity Contracts, and Other Financial Investments", code: "523", industries: [
            {name: "Securities and Commodity Contracts Intermediation and Brokerage", code: "5231"},
            {name: "Securities and Commodity Exchanges", code: "5232"},
            {name: "Other Financial Investment Activities", code: "5239"}
          ]
        },
        { name: "Insurance Carriers and Related Activities", code: "524", industries: [
            { name: "Insurance Carriers", code: "5241"},
            { name: "Agencies, Brokerages, and Other Insurance Related Activities", code: "5242"}
          ]
        },
        { name: "Funds, Trusts, and Other Financial Vehicles", code: "525", industries: [
            {name: "Pension Funds", code: "525110"},
            {name: "Health and Welfare Funds", code: "525120"},
            {name: "Other Investment Pools and Funds", code: "5259"}
        ]}
      ]
  },
  { name: "Real Estate and Rental and Leasing", code: "53", description: "Renting, leasing, or otherwise allowing the use of tangible or intangible assets.",
    subSectors: [
        { name: "Real Estate", code: "531", industries: [
            {name: "Lessors of Real Estate", code: "5311"},
            {name: "Offices of Real Estate Agents and Brokers", code: "5312"},
            {name: "Activities Related to Real Estate", code: "5313"}
          ]
        },
        { name: "Rental and Leasing Services", code: "532", industries: [
            { name: "Automotive Equipment Rental and Leasing", code: "5321"},
            { name: "Consumer Goods Rental", code: "5322"},
            { name: "General Rental Centers", code: "5323"},
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
            {name: "Landscape Architectural Services", code: "541320"},
            {name: "Engineering Services", code: "541330"},
            {name: "Drafting Services", code: "541340"},
            {name: "Building Inspection Services", code: "541350"},
            {name: "Geophysical Surveying and Mapping Services", code: "541360"},
            {name: "Surveying and Mapping (except Geophysical) Services", code: "541370"},
            {name: "Testing Laboratories and Services", code: "541380"},
          ]
        },
        { name: "Specialized Design Services", code: "5414", industries: [
            {name: "Interior Design Services", code: "541410"},
            {name: "Industrial Design Services", code: "541420"},
            {name: "Graphic Design Services", code: "541430"},
            {name: "Other Specialized Design Services", code: "541490"}
        ]},
        { name: "Computer Systems Design and Related Services", code: "5415", industries: [{ name: "Computer Systems Design and Related Services", code: "541510"}]},
        { name: "Management, Scientific, and Technical Consulting Services", code: "5416", industries: [
            {name: "Management Consulting Services", code: "541610"}, // Broad, could be broken down more
            {name: "Environmental Consulting Services", code: "541620"},
            {name: "Scientific and Technical Consulting Services", code: "541690"}
        ]},
        { name: "Scientific Research and Development Services", code: "5417", industries: [
            {name: "Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology)", code: "541710"}, // Adjusted for 2022
            {name: "Research and Development in Nanotechnology", code: "541713"},
            {name: "Research and Development in Biotechnology (except Nanobiotechnology)", code: "541714"},
            {name: "Research and Development in the Social Sciences and Humanities", code: "541720"}
        ]},
        { name: "Advertising, Public Relations, and Related Services", code: "5418", industries: [
            {name: "Advertising Agencies", code: "541810"},
            {name: "Public Relations Agencies", code: "541820"},
            {name: "Media Buying Agencies", code: "541830"},
            {name: "Display Advertising", code: "541850"},
            {name: "Direct Mail Advertising", code: "541860"},
            {name: "Advertising Material Distribution Services", code: "541870"},
            {name: "Other Services Related to Advertising", code: "541890"}
        ]},
        { name: "Other Professional, Scientific, and Technical Services", code: "5419", industries: [
            {name: "Marketing Research and Public Opinion Polling", code: "541910"},
            {name: "Photography Services", code: "541920"},
            {name: "Translation and Interpretation Services", code: "541930"},
            {name: "Veterinary Services", code: "541940"},
            {name: "All Other Professional, Scientific, and Technical Services", code: "541990"}
          ]
        }
      ]
  },
  { name: "Management of Companies and Enterprises", code: "55", description: "Holding the securities of companies and enterprises.",
    subSectors: [
        { name: "Management of Companies and Enterprises", code: "551", industries: [
            {name: "Offices of Bank Holding Companies", code: "551111"},
            {name: "Offices of Other Holding Companies", code: "551112"},
            {name: "Corporate, Subsidiary, and Regional Managing Offices", code: "551114"}
          ]
        }
      ]
  },
  { name: "Administrative and Support and Waste Management and Remediation Services", code: "56", description: "Performing routine support activities or managing waste.",
    subSectors: [
        { name: "Administrative and Support Services", code: "561", industries: [
            {name: "Office Administrative Services", code: "5611"},
            {name: "Facilities Support Services", code: "5612"},
            {name: "Employment Services", code: "5613"},
            {name: "Business Support Services", code: "5614"},
            {name: "Travel Arrangement and Reservation Services", code: "5615"},
            {name: "Investigation and Security Services", code: "5616"},
            {name: "Services to Buildings and Dwellings", code: "5617"},
            {name: "Other Support Services", code: "5619"}
          ]
        },
        { name: "Waste Management and Remediation Services", code: "562", industries: [
            { name: "Waste Collection", code: "5621"},
            { name: "Waste Treatment and Disposal", code: "5622"},
            { name: "Remediation and Other Waste Management Services", code: "5629"}
          ]
        }
      ]
  },
  { name: "Educational Services", code: "61", description: "Providing instruction and training.",
    subSectors: [
        { name: "Elementary and Secondary Schools", code: "6111", industries: [{name: "Elementary and Secondary Schools", code: "611110"}] },
        { name: "Junior Colleges", code: "6112", industries: [{name: "Junior Colleges", code: "611210"}] },
        { name: "Colleges, Universities, and Professional Schools", code: "6113", industries: [{name: "Colleges, Universities, and Professional Schools", code: "611310"}] },
        { name: "Business Schools and Computer and Management Training", code: "6114", industries: [
            {name: "Business and Secretarial Schools", code: "611410"},
            {name: "Computer Training", code: "611420"},
            {name: "Professional and Management Development Training", code: "611430"}
        ]},
        { name: "Technical and Trade Schools", code: "6115", industries: [{name: "Technical and Trade Schools", code: "611510"}]},
        { name: "Other Schools and Instruction", code: "6116", industries: [
            {name: "Fine Arts Schools", code: "611610"},
            {name: "Sports and Recreation Instruction", code: "611620"},
            {name: "Language Schools", code: "611630"},
            {name: "Exam Preparation and Tutoring", code: "611691"},
            {name: "All Other Schools and Instruction", code: "611699"}
        ]},
        { name: "Educational Support Services", code: "6117", industries: [{name: "Educational Support Services", code: "611710"}]}
      ]
  },
  { name: "Health Care and Social Assistance", code: "62", description: "Providing health care and social assistance.",
    subSectors: [
        { name: "Ambulatory Health Care Services", code: "621", industries: [
            {name: "Offices of Physicians", code: "6211"},
            {name: "Offices of Dentists", code: "6212"},
            {name: "Offices of Other Health Practitioners", code: "6213"},
            {name: "Outpatient Care Centers", code: "6214"},
            {name: "Medical and Diagnostic Laboratories", code: "6215"},
            {name: "Home Health Care Services", code: "6216"},
            {name: "Other Ambulatory Health Care Services (including Ambulance Services)", code: "6219"}
          ]
        },
        { name: "Hospitals", code: "622", industries: [
            {name: "General Medical and Surgical Hospitals", code: "6221"},
            {name: "Psychiatric and Substance Abuse Hospitals", code: "6222"},
            {name: "Specialty (except Psychiatric and Substance Abuse) Hospitals", code: "6223"}
          ]
        },
        { name: "Nursing and Residential Care Facilities", code: "623", industries: [
            {name: "Nursing Care Facilities (Skilled Nursing Facilities)", code: "6231"},
            {name: "Residential Intellectual and Developmental Disability, Mental Health, and Substance Abuse Facilities", code: "6232"},
            {name: "Continuing Care Retirement Communities and Assisted Living Facilities for the Elderly", code: "6233"},
            {name: "Other Residential Care Facilities", code: "6239"}
          ]
        },
        { name: "Social Assistance", code: "624", industries: [
            {name: "Individual and Family Services", code: "6241"},
            {name: "Community Food and Housing, and Emergency and Other Relief Services", code: "6242"},
            {name: "Vocational Rehabilitation Services", code: "6243"},
            {name: "Child Care Services", code: "6244"}
          ]
        }
      ]
  },
  { name: "Arts, Entertainment, and Recreation", code: "71", description: "Operating facilities or providing services to meet varied cultural, entertainment, and recreational interests.",
    subSectors: [
        { name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [
            {name: "Performing Arts Companies", code: "7111"},
            {name: "Spectator Sports", code: "7112"},
            {name: "Promoters of Performing Arts, Sports, and Similar Events", code: "7113"},
            {name: "Agents and Managers for Artists, Athletes, Entertainers, and Other Public Figures", code: "7114"},
            {name: "Independent Artists, Writers, and Performers", code: "7115"}
          ]
        },
        { name: "Museums, Historical Sites, and Similar Institutions", code: "712", industries: [
            {name: "Museums", code: "712110"},
            {name: "Historical Sites", code: "712120"},
            {name: "Zoos and Botanical Gardens", code: "712130"},
            {name: "Nature Parks and Other Similar Institutions", code: "712190"}
          ]
        },
        { name: "Amusement, Gambling, and Recreation Industries", code: "713", industries: [
            {name: "Amusement Parks and Arcades", code: "7131"},
            {name: "Gambling Industries", code: "7132"},
            {name: "Other Amusement and Recreation Industries", code: "7139"}
          ]
        }
      ]
  },
  { name: "Accommodation and Food Services", code: "72", description: "Providing customers with lodging and/or preparing meals.",
    subSectors: [
        { name: "Accommodation", code: "721", industries: [
            {name: "Traveler Accommodation (Hotels, Motels, etc.)", code: "7211"},
            {name: "RV (Recreational Vehicle) Parks and Recreational Camps", code: "7212"},
            {name: "Rooming and Boarding Houses, Dormitories, and Workers' Camps", code: "7213"}
          ]
        },
        { name: "Food Services and Drinking Places", code: "722", industries: [
            {name: "Full-Service Restaurants", code: "722511"},
            {name: "Limited-Service Restaurants", code: "722513"},
            {name: "Cafeterias, Grill Buffets, and Buffets", code: "722514"},
            {name: "Snack and Nonalcoholic Beverage Bars", code: "722515"},
            {name: "Food Service Contractors", code: "722310"},
            {name: "Caterers", code: "722320"},
            {name: "Mobile Food Services", code: "722330"},
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
            {name: "Personal and Household Goods Repair and Maintenance", code: "8114"}
          ]
        },
        { name: "Personal and Laundry Services", code: "812", industries: [
            {name: "Personal Care Services", code: "8121"},
            {name: "Death Care Services", code: "8122"},
            {name: "Drycleaning and Laundry Services", code: "8123"},
            {name: "Other Personal Services", code: "8129"}
          ]
        },
        { name: "Religious, Grantmaking, Civic, Professional, and Similar Organizations", code: "813", industries: [
            {name: "Religious Organizations", code: "8131"},
            {name: "Grantmaking and Giving Services", code: "8132"},
            {name: "Social Advocacy Organizations", code: "8133"},
            {name: "Civic and Social Organizations", code: "8134"},
            {name: "Business, Professional, Labor, Political, and Similar Organizations", code: "8139"}
          ]
        },
        { name: "Private Households", code: "814", industries: [{name: "Private Households", code: "8141"}] }
      ]
  },
  { name: "Public Administration", code: "92", description: "Activities of a governmental nature.",
    subSectors: [ // NAICS 2022 restructured Sector 92 significantly. These are broader categories.
        { name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [
            {name: "Executive Offices", code: "921110"},
            {name: "Legislative Bodies", code: "921120"},
            {name: "Public Finance Activities", code: "921130"},
            {name: "Other General Government Support", code: "921190"}
          ]
        },
        { name: "Justice, Public Order, and Safety Activities", code: "922", industries: [
            {name: "Courts", code: "922110"},
            {name: "Police Protection", code: "922120"},
            {name: "Legal Counsel and Prosecution", code: "922130"},
            {name: "Correctional Institutions", code: "922140"},
            {name: "Parole Offices and Probation Offices", code: "922150"},
            {name: "Fire Protection", code: "922160"},
            {name: "Other Justice, Public Order, and Safety Activities", code: "922190"}
          ]
        },
        { name: "Administration of Human Resource Programs", code: "923", industries: [
            {name: "Administration of Education Programs", code: "923110"},
            {name: "Administration of Public Health Programs", code: "923120"},
            {name: "Administration of Other Human Resource Programs", code: "923130"}
          ]
        },
        { name: "Administration of Environmental Quality Programs", code: "924", industries: [
            {name: "Administration of Air and Water Resource and Solid Waste Management Programs", code: "924110"},
            {name: "Administration of Conservation Programs", code: "924120"}
          ]
        },
        { name: "Administration of Housing Programs, Urban Planning, and Community Development", code: "925", industries: [
            {name: "Administration of Housing Programs", code: "925110"},
            {name: "Administration of Urban Planning and Community and Rural Development", code: "925120"}
          ]
        },
        { name: "Administration of Economic Programs", code: "926", industries: [
            {name: "Administration of General Economic Programs", code: "926110"},
            {name: "Regulation and Administration of Transportation Programs", code: "926120"},
            {name: "Regulation and Administration of Communications, Electric, Gas, and Other Utilities", code: "926130"},
            {name: "Regulation of Agricultural Marketing and Commodities", code: "926140"},
            {name: "Regulation, Licensing, and Inspection of Miscellaneous Commercial Sectors", code: "926150"}
          ]
        },
        // NAICS 2022 removed Sector 927 (Space Research and Technology) as a standalone and integrated it elsewhere.
        { name: "National Security and International Affairs", code: "928", industries: [
            {name: "National Security", code: "928110"},
            {name: "International Affairs", code: "928120"}
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
      postDataForFirestore.imageUrls = uploadedImageUrls; // Assign the array of URLs
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
        sector: mainSectorDetails?.name || formData.sector, // Use name if available
        subSector: subSectorDetails?.name || formData.subSector, // Use name if available
        industry: industryDetails?.name || formData.industry, // Use name if available
        naicsCode: formData.industry || formData.subSector || formData.sector, // Most specific code
        userId: user.uid,
        businessType: "Startup", // Placeholder
        safetyIndicator: "Medium", // Placeholder
        ratingScore: Math.floor(Math.random() * 3) + 3, // Placeholder
        imageFile: formData.imageFile,
        imageUrls: [], // Will be populated by mutationFn
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
                               detailedSectorsData={detailedSectorsData} // Pass the detailed data
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
