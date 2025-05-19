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
          { name: "Soybean Farming", code: "111110" },
          { name: "Oilseed (except Soybean) Farming", code: "111120" },
          { name: "Dry Pea and Bean Farming", code: "111130" },
          { name: "Wheat Farming", code: "111140" },
          { name: "Corn Farming", code: "111150" },
          { name: "Rice Farming", code: "111160" },
          { name: "Other Grain Farming", code: "111190" }, // Example: This covers 111191 and 111199 for simplicity in dropdown
          { name: "Vegetable and Melon Farming", code: "111210"}, // Example: Grouping 111211 and 111219
          { name: "Fruit and Tree Nut Farming", code: "111300"}, // Example: Grouping 111310 through 111339
          { name: "Greenhouse, Nursery, and Floriculture Production", code: "111400"}, // Example: Grouping 111411 through 111422
          { name: "Other Crop Farming", code: "111900" }, // Example: Grouping 111910 through 111998
        ]
      },
      { name: "Animal Production and Aquaculture", code: "112", industries: [
          { name: "Cattle Ranching and Farming", code: "112110" }, // Grouping 112111, 112112
          { name: "Dairy Cattle and Milk Production", code: "112120" },
          { name: "Dual-Purpose Cattle Ranching and Farming", code: "112130" },
          { name: "Hog and Pig Farming", code: "112210" },
          { name: "Poultry and Egg Production", code: "112300" }, // Grouping 112310 through 112390
          { name: "Sheep and Goat Farming", code: "112400" }, // Grouping 112410, 112420
          { name: "Aquaculture", code: "112510" }, // Grouping 112511 through 112519
          { name: "Other Animal Production", code: "112900" }, // Grouping 112910 through 112990
        ]
      },
      { name: "Forestry and Logging", code: "113", industries: [
          { name: "Timber Tract Operations", code: "113110" },
          { name: "Forest Nurseries and Gathering of Forest Products", code: "113210" },
          { name: "Logging", code: "113310" },
        ]
      },
      { name: "Fishing, Hunting and Trapping", code: "114", industries: [
          { name: "Fishing", code: "114110" }, // Grouping 114111, 114112, 114119
          { name: "Hunting and Trapping", code: "114210" },
        ]
      },
      { name: "Support Activities for Agriculture and Forestry", code: "115", industries: [
          { name: "Support Activities for Crop Production", code: "115110" }, // Grouping 115111 through 115116
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
      { name: "Oil and Gas Extraction", code: "211", industries: [
          { name: "Crude Petroleum Extraction", code: "211120"}, // Was 2111, now specific
          { name: "Natural Gas Extraction", code: "211130"} // Was 2111, now specific
        ]
      },
      { name: "Mining (except Oil and Gas)", code: "212", industries: [
          { name: "Coal Mining", code: "212110" },
          { name: "Iron Ore Mining", code: "212210" },
          { name: "Gold Ore and Silver Ore Mining", code: "212220" },
          { name: "Copper, Nickel, Lead, and Zinc Mining", code: "212230" }, // Corrected from 21223x to 212230
          { name: "Other Metal Ore Mining", code: "212290" },
          { name: "Stone Mining and Quarrying", code: "212310" },
          { name: "Sand, Gravel, Clay, and Ceramic and Refractory Minerals Mining and Quarrying", code: "212320" },
          { name: "Other Nonmetallic Mineral Mining and Quarrying", code: "212390" },
        ]
      },
      { name: "Support Activities for Mining", code: "213", industries: [
          { name: "Drilling Oil and Gas Wells", code: "213111"},
          { name: "Support Activities for Oil and Gas Operations", code: "213112" }, // Was part of 213111
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
          { name: "Residential Building Construction", code: "236100" }, // Covers 23611x
          { name: "Nonresidential Building Construction", code: "236200" } // Covers 236210, 236220
        ]
      },
      { name: "Heavy and Civil Engineering Construction", code: "237", industries: [
          { name: "Utility System Construction", code: "237100" }, // Covers 237110, 237120, 237130
          { name: "Land Subdivision", code: "237210" },
          { name: "Highway, Street, and Bridge Construction", code: "237310" },
          { name: "Other Heavy and Civil Engineering Construction", code: "237990" }
        ]
      },
      { name: "Specialty Trade Contractors", code: "238", industries: [
          { name: "Foundation, Structure, and Building Exterior Contractors", code: "238100" }, // Grouping
          { name: "Building Equipment Contractors", code: "238200" }, // Grouping
          { name: "Building Finishing Contractors", code: "238300" }, // Grouping
          { name: "Other Specialty Trade Contractors", code: "238900" } // Grouping
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
          { name: "Animal Food Manufacturing", code: "311110" },
          { name: "Grain and Oilseed Milling", code: "311210" }, // Grouping 311211-311213
          { name: "Starch and Vegetable Fats and Oils Manufacturing", code: "311220" }, // Grouping 311221-311225
          { name: "Breakfast Cereal Manufacturing", code: "311230" },
          { name: "Sugar and Confectionery Product Manufacturing", code: "311300" }, // Grouping
          { name: "Fruit and Vegetable Preserving and Specialty Food Manufacturing", code: "311400" }, // Grouping
          { name: "Dairy Product Manufacturing", code: "311500" }, // Grouping
          { name: "Animal Slaughtering and Processing", code: "311610" }, // Grouping
          { name: "Seafood Product Preparation and Packaging", code: "311710" },
          { name: "Bakeries and Tortilla Manufacturing", code: "311800" }, // Grouping
          { name: "Other Food Manufacturing", code: "311900" }, // Grouping
        ]
      },
      { name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [
          { name: "Beverage Manufacturing", code: "312100" }, // Grouping
          { name: "Tobacco Manufacturing", code: "312230" }, // Note: NAICS uses 312230 directly
        ]
      },
      { name: "Textile Mills", code: "313", industries: [
          { name: "Fiber, Yarn, and Thread Mills", code: "313110" },
          { name: "Fabric Mills", code: "313200" }, // Grouping
          { name: "Textile and Fabric Finishing and Fabric Coating Mills", code: "313300" } // Grouping
        ]
      },
      { name: "Textile Product Mills", code: "314", industries: [
          { name: "Textile Furnishings Mills", code: "314100" }, // Grouping
          { name: "Other Textile Product Mills", code: "314900" }, // Grouping
        ]
      },
      { name: "Apparel Manufacturing", code: "315", industries: [
          { name: "Apparel Knitting Mills", code: "315120" }, // Note: NAICS uses 315120 directly
          { name: "Cut and Sew Apparel Manufacturing", code: "315200" }, // Grouping
          { name: "Apparel Accessories and Other Apparel Manufacturing", code: "315990" }
        ]
      },
      { name: "Leather and Allied Product Manufacturing", code: "316", industries: [
          { name: "Leather and Hide Tanning and Finishing", code: "316110" },
          { name: "Footwear Manufacturing", code: "316210" },
          { name: "Other Leather and Allied Product Manufacturing", code: "316990" }
        ]
      },
      { name: "Wood Product Manufacturing", code: "321", industries: [
          { name: "Sawmills and Wood Preservation", code: "321110" }, // Grouping
          { name: "Veneer, Plywood, and Engineered Wood Product Manufacturing", code: "321210" }, // Grouping
          { name: "Other Wood Product Manufacturing", code: "321900" } // Grouping (Millwork, Containers, All Other)
        ]
      },
      { name: "Paper Manufacturing", code: "322", industries: [
          { name: "Pulp, Paper, and Paperboard Mills", code: "322100" }, // Grouping
          { name: "Converted Paper Product Manufacturing", code: "322200" } // Grouping
        ]
      },
      { name: "Printing and Related Support Activities", code: "323", industries: [
          { name: "Printing", code: "323110" }, // Grouping
          { name: "Support Activities for Printing", code: "323120" }
        ]
      },
      { name: "Petroleum and Coal Products Manufacturing", code: "324", industries: [
          { name: "Petroleum Refineries", code: "324110" },
          { name: "Asphalt Paving, Roofing, and Saturated Materials Manufacturing", code: "324120" }, // Grouping
          { name: "Other Petroleum and Coal Products Manufacturing", code: "324190" } // Grouping
        ]
      },
      { name: "Chemical Manufacturing", code: "325", industries: [
          { name: "Basic Chemical Manufacturing", code: "325100" }, // Grouping
          { name: "Resin, Synthetic Rubber, and Artificial and Synthetic Fibers and Filaments Manufacturing", code: "325200" }, // Grouping
          { name: "Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing", code: "325300" }, // Grouping
          { name: "Pharmaceutical and Medicine Manufacturing", code: "325410" }, // Grouping
          { name: "Paint, Coating, and Adhesive Manufacturing", code: "325500" }, // Grouping
          { name: "Soap, Cleaning Compound, and Toilet Preparation Manufacturing", code: "325600" }, // Grouping
          { name: "Other Chemical Product and Preparation Manufacturing", code: "325900" } // Grouping
        ]
      },
      { name: "Plastics and Rubber Products Manufacturing", code: "326", industries: [
          { name: "Plastics Product Manufacturing", code: "326100" }, // Grouping
          { name: "Rubber Product Manufacturing", code: "326200" } // Grouping
        ]
      },
      { name: "Nonmetallic Mineral Product Manufacturing", code: "327", industries: [
          { name: "Clay Product and Refractory Manufacturing", code: "327100" }, // Grouping
          { name: "Glass and Glass Product Manufacturing", code: "327210" }, // Grouping
          { name: "Cement and Concrete Product Manufacturing", code: "327300" }, // Grouping
          { name: "Lime and Gypsum Product Manufacturing", code: "327400" }, // Grouping
          { name: "Other Nonmetallic Mineral Product Manufacturing", code: "327900" } // Grouping
        ]
      },
      { name: "Primary Metal Manufacturing", code: "331", industries: [
          { name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "331110" },
          { name: "Steel Product Manufacturing from Purchased Steel", code: "331200" }, // Grouping
          { name: "Alumina and Aluminum Production and Processing", code: "331310" }, // Grouping
          { name: "Nonferrous Metal (except Aluminum) Production and Processing", code: "331400" }, // Grouping
          { name: "Foundries", code: "331500" } // Grouping
        ]
      },
      { name: "Fabricated Metal Product Manufacturing", code: "332", industries: [
          { name: "Forging and Stamping", code: "332110" }, // Grouping
          { name: "Cutlery and Handtool Manufacturing", code: "332210" }, // Grouping
          { name: "Architectural and Structural Metals Manufacturing", code: "332300" }, // Grouping
          { name: "Boiler, Tank, and Shipping Container Manufacturing", code: "332400" }, // Grouping
          { name: "Hardware Manufacturing", code: "332510" },
          { name: "Spring and Wire Product Manufacturing", code: "332610" }, // Grouping
          { name: "Machine Shops; Turned Product; and Screw, Nut, and Bolt Manufacturing", code: "332700" }, // Grouping
          { name: "Coating, Engraving, Heat Treating, and Allied Activities", code: "332810" }, // Grouping
          { name: "Other Fabricated Metal Product Manufacturing", code: "332900" } // Grouping (Valves, All Other)
        ]
      },
      { name: "Machinery Manufacturing", code: "333", industries: [
          { name: "Agriculture, Construction, and Mining Machinery Manufacturing", code: "333100" }, // Grouping
          { name: "Industrial Machinery Manufacturing", code: "333240" }, // Grouping
          { name: "Commercial and Service Industry Machinery Manufacturing", code: "333310" }, // Grouping
          { name: "Ventilation, Heating, Air-Conditioning, and Commercial Refrigeration Equipment Manufacturing", code: "333410" }, // Grouping
          { name: "Metalworking Machinery Manufacturing", code: "333510" }, // Grouping
          { name: "Engine, Turbine, and Power Transmission Equipment Manufacturing", code: "333610" }, // Grouping
          { name: "Other General Purpose Machinery Manufacturing", code: "333900" } // Grouping
        ]
      },
      { name: "Computer and Electronic Product Manufacturing", code: "334", industries: [
          { name: "Computer and Peripheral Equipment Manufacturing", code: "334110" }, // Grouping
          { name: "Communications Equipment Manufacturing", code: "334200" }, // Grouping
          { name: "Audio and Video Equipment Manufacturing", code: "334310" },
          { name: "Semiconductor and Other Electronic Component Manufacturing", code: "334410" }, // Grouping
          { name: "Navigational, Measuring, Electromedical, and Control Instruments Manufacturing", code: "334510" }, // Grouping
          { name: "Manufacturing and Reproducing Magnetic and Optical Media", code: "334610" }
        ]
      },
      { name: "Electrical Equipment, Appliance, and Component Manufacturing", code: "335", industries: [
          { name: "Electric Lighting Equipment Manufacturing", code: "335130" }, // Grouping
          { name: "Household Appliance Manufacturing", code: "335200" }, // Grouping
          { name: "Electrical Equipment Manufacturing", code: "335310" }, // Grouping
          { name: "Other Electrical Equipment and Component Manufacturing", code: "335900" } // Grouping
        ]
      },
      { name: "Transportation Equipment Manufacturing", code: "336", industries: [
          { name: "Motor Vehicle Manufacturing", code: "336100" }, // Grouping
          { name: "Motor Vehicle Body and Trailer Manufacturing", code: "336210" }, // Grouping
          { name: "Motor Vehicle Parts Manufacturing", code: "336300" }, // Grouping
          { name: "Aerospace Product and Parts Manufacturing", code: "336410" }, // Grouping
          { name: "Railroad Rolling Stock Manufacturing", code: "336510" },
          { name: "Ship and Boat Building", code: "336610" }, // Grouping
          { name: "Other Transportation Equipment Manufacturing", code: "336990" } // Grouping
        ]
      },
      { name: "Furniture and Related Product Manufacturing", code: "337", industries: [
          { name: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", code: "337100" }, // Grouping
          { name: "Office Furniture (including Fixtures) Manufacturing", code: "337210" }, // Grouping
          { name: "Other Furniture Related Product Manufacturing", code: "337900" } // Grouping
        ]
      },
      { name: "Miscellaneous Manufacturing", code: "339", industries: [
          { name: "Medical Equipment and Supplies Manufacturing", code: "339110" }, // Grouping
          { name: "Sporting and Athletic Goods Manufacturing", code: "339920" },
          { name: "Doll, Toy, and Game Manufacturing", code: "339930" },
          { name: "Office Supplies (except Paper) Manufacturing", code: "339940" },
          { name: "Sign Manufacturing", code: "339950" },
          { name: "All Other Miscellaneous Manufacturing", code: "339990" } // Grouping
        ]
      },
    ],
  },
  { name: "Wholesale Trade", code: "42", description: "Wholesaling merchandise, generally without transformation.",
    subSectors: [
        { name: "Merchant Wholesalers, Durable Goods", code: "423", industries: [
            { name: "Motor Vehicle and Motor Vehicle Parts and Supplies Merchant Wholesalers", code: "423100"},
            { name: "Furniture and Home Furnishing Merchant Wholesalers", code: "423200"},
          ]
        },
        { name: "Merchant Wholesalers, Nondurable Goods", code: "424", industries: [
            { name: "Paper and Paper Product Merchant Wholesalers", code: "424100"},
            { name: "Grocery and Related Product Merchant Wholesalers", code: "424400"},
          ]
        },
        { name: "Wholesale Electronic Markets and Agents and Brokers", code: "425", industries: [
            { name: "Wholesale Electronic Markets and Agents and Brokers", code: "425100"}
          ]
        }
      ]
  },
  { name: "Retail Trade", code: "44-45", description: "Retailing merchandise, generally without transformation.",
    subSectors: [
        { name: "Motor Vehicle and Parts Dealers", code: "441", industries: [
            { name: "Automobile Dealers", code: "441100"}, { name: "Other Motor Vehicle Dealers", code: "441200"}
          ]
        },
        { name: "Furniture and Home Furnishings Stores", code: "442", industries: [
            { name: "Furniture Stores", code: "442110"}, { name: "Home Furnishings Stores", code: "442200"}
          ]
        },
        { name: "Electronics and Appliance Stores", code: "443", industries: [{name: "Electronics and Appliance Stores", code: "443140"}]},
        { name: "Building Material and Garden Equipment and Supplies Dealers", code: "444", industries: [{name: "Building Material and Supplies Dealers", code: "444100"}]},
        { name: "Food and Beverage Stores", code: "445", industries: [{name: "Grocery Stores", code: "445100"}]},
        { name: "Health and Personal Care Stores", code: "446", industries: [{name: "Pharmacies and Drug Stores", code: "446110"}]},
        { name: "Gasoline Stations", code: "447", industries: [{name: "Gasoline Stations", code: "447100"}]},
        { name: "Clothing and Clothing Accessories Stores", code: "448", industries: [{name: "Clothing Stores", code: "448100"}]},
        { name: "Sporting Goods, Hobby, Musical Instrument, and Book Stores", code: "451", industries: [{name: "Sporting Goods Stores", code: "451110"}]}, // Renamed for NAICS 2022 (459 in 2017)
        { name: "General Merchandise Stores", code: "452", industries: [{name: "Department Stores", code: "452210"}]}, // Renamed for NAICS 2022 (455 in 2017)
        { name: "Miscellaneous Store Retailers", code: "453", industries: [{name: "Florists", code: "453110"}]}, // Renamed for NAICS 2022 (459 in 2017)
        { name: "Nonstore Retailers", code: "454", industries: [{name: "Electronic Shopping and Mail-Order Houses", code: "454110"}]}, // Renamed for NAICS 2022 (457 in 2017)
      ]
  },
  { name: "Transportation and Warehousing", code: "48-49", description: "Providing transportation of passengers and cargo, warehousing and storing goods.",
    subSectors: [
        { name: "Air Transportation", code: "481", industries: [{name: "Scheduled Passenger Air Transportation", code: "481111"}, {name: "Charter Air Transportation", code: "481211"}] },
        { name: "Rail Transportation", code: "482", industries: [{name: "Line-Haul Railroads", code: "482111"}] },
        { name: "Water Transportation", code: "483", industries: [{name: "Deep Sea, Coastal, and Great Lakes Water Transportation", code: "483111"}] },
        { name: "Truck Transportation", code: "484", industries: [{ name: "General Freight Trucking", code: "484100"}, { name: "Specialized Freight Trucking", code: "484200"}] },
        { name: "Transit and Ground Passenger Transportation", code: "485", industries: [{name: "Urban Transit Systems", code: "485110"}] },
        { name: "Pipeline Transportation", code: "486", industries: [{name: "Pipeline Transportation of Crude Oil", code: "486110"}] },
        { name: "Scenic and Sightseeing Transportation", code: "487", industries: [{name: "Scenic and Sightseeing Transportation, Land", code: "487110"}] },
        { name: "Support Activities for Transportation", code: "488", industries: [{name: "Support Activities for Air Transportation", code: "488100"}] },
        { name: "Couriers and Messengers", code: "492", industries: [{name: "Couriers and Express Delivery Services", code: "492110"}] },
        { name: "Warehousing and Storage", code: "493", industries: [{name: "General Warehousing and Storage", code: "493110"}] }
      ]
  },
  { name: "Information", code: "51", description: "Producing and distributing information and cultural products.",
    subSectors: [
        { name: "Publishing Industries (except Internet)", code: "511", industries: [ // In NAICS 2022, this is 513
            {name: "Newspaper, Periodical, Book, and Directory Publishers", code: "513100"} // Example for NAICS 2022
          ]
        },
        { name: "Motion Picture and Sound Recording Industries", code: "512", industries: [ // In NAICS 2022, this is 512
            {name: "Motion Picture and Video Industries", code: "512100"}, { name: "Sound Recording Industries", code: "512200"}
          ]
        },
        { name: "Broadcasting (except Internet)", code: "515", industries: [ // In NAICS 2022, this is 516
            {name: "Radio and Television Broadcasting", code: "516100"}
          ]
        },
        { name: "Telecommunications", code: "517", industries: [ // In NAICS 2022, this is 517
            {name: "Wired and Wireless Telecommunications Carriers (except Satellite)", code: "517110"}, // Simplified
            {name: "Satellite Telecommunications", code: "517410"}
          ]
        },
        { name: "Data Processing, Hosting, and Related Services", code: "518", industries: [ // In NAICS 2022, this is 518
            {name: "Data Processing, Hosting, and Related Services", code: "518210"}
          ]
        },
        { name: "Other Information Services", code: "519", industries: [ // In NAICS 2022, this is 519
             {name: "News Syndicates", code: "519210"}, {name: "Libraries and Archives", code: "519220"}, {name: "All Other Information Services", code: "519290"}
          ]
        }
      ]
  },
  { name: "Finance and Insurance", code: "52", description: "Transactions involving the creation, liquidation, or change in ownership of financial assets.",
    subSectors: [
        { name: "Monetary Authorities - Central Bank", code: "521", industries: [{name: "Monetary Authorities - Central Bank", code: "521110"}] },
        { name: "Credit Intermediation and Related Activities", code: "522", industries: [
            {name: "Depository Credit Intermediation (Commercial Banking, Savings Institutions, Credit Unions)", code: "522100"}, // Grouping
            {name: "Nondepository Credit Intermediation", code: "522200"},
            {name: "Activities Related to Credit Intermediation", code: "522300"}
          ]
        },
        { name: "Securities, Commodity Contracts, and Other Financial Investments and Related Activities", code: "523", industries: [
            {name: "Securities and Commodity Contracts Intermediation and Brokerage", code: "523100"},
            {name: "Securities and Commodity Exchanges", code: "523210"},
            {name: "Other Financial Investment Activities", code: "523900"}
          ]
        },
        { name: "Insurance Carriers and Related Activities", code: "524", industries: [
            { name: "Insurance Carriers", code: "524100"},
            { name: "Agencies, Brokerages, and Other Insurance Related Activities", code: "524200"}
          ]
        },
        { name: "Funds, Trusts, and Other Financial Vehicles", code: "525", industries: [{name: "Pension Funds", code: "525110"}]}
      ]
  },
  { name: "Real Estate and Rental and Leasing", code: "53", description: "Renting, leasing, or otherwise allowing the use of tangible or intangible assets.",
    subSectors: [
        { name: "Real Estate", code: "531", industries: [
            {name: "Lessors of Real Estate", code: "531100"},
            {name: "Offices of Real Estate Agents and Brokers", code: "531210"},
            {name: "Activities Related to Real Estate", code: "531300"}
          ]
        },
        { name: "Rental and Leasing Services", code: "532", industries: [
            { name: "Automotive Equipment Rental and Leasing", code: "532100"},
            { name: "Consumer Goods Rental", code: "532200"},
            { name: "General Rental Centers", code: "532310"},
            { name: "Commercial and Industrial Machinery and Equipment Rental and Leasing", code: "532400"}
          ]
        },
        { name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533", industries: [
            {name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533110"}
          ]
        }
      ]
  },
  { name: "Professional, Scientific, and Technical Services", code: "54", description: "Performing professional, scientific, and technical activities for others.",
    subSectors: [
        { name: "Legal Services", code: "5411", industries: [{name: "Offices of Lawyers", code: "541110"}] },
        { name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "5412", industries: [{name: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", code: "541210"}]},
        { name: "Architectural, Engineering, and Related Services", code: "5413", industries: [
            {name: "Architectural Services", code: "541310"}, {name: "Engineering Services", code: "541330"}
          ]
        },
        { name: "Specialized Design Services", code: "5414", industries: [{name: "Interior Design Services", code: "541410"}]},
        { name: "Computer Systems Design and Related Services", code: "5415", industries: [{ name: "Computer Systems Design and Related Services", code: "541510"}]},
        { name: "Management, Scientific, and Technical Consulting Services", code: "5416", industries: [{name: "Management Consulting Services", code: "541610"}]},
        { name: "Scientific Research and Development Services", code: "5417", industries: [{name: "Research and Development in the Physical, Engineering, and Life Sciences", code: "541710"}]},
        { name: "Advertising, Public Relations, and Related Services", code: "5418", industries: [{name: "Advertising Agencies", code: "541810"}]},
        { name: "Other Professional, Scientific, and Technical Services", code: "5419", industries: [
            {name: "Marketing Research and Public Opinion Polling", code: "541910"},
            {name: "Photography Services", code: "541920"}, // Grouping for Photographic Studios, Portrait and Commercial Photography
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
            {name: "Offices of Bank Holding Companies", code: "551111"}, // Specific example
            {name: "Offices of Other Holding Companies", code: "551112"}  // Specific example
          ]
        }
      ]
  },
  { name: "Administrative and Support and Waste Management and Remediation Services", code: "56", description: "Performing routine support activities or managing waste.",
    subSectors: [
        { name: "Administrative and Support Services", code: "561", industries: [
            {name: "Office Administrative Services", code: "561110"},
            {name: "Facilities Support Services", code: "561210"},
            {name: "Employment Services", code: "561300"},
            {name: "Business Support Services", code: "561400"},
            {name: "Travel Arrangement and Reservation Services", code: "561500"},
            {name: "Investigation and Security Services", code: "561600"},
            {name: "Services to Buildings and Dwellings", code: "561700"},
            {name: "Other Support Services", code: "561900"}
          ]
        },
        { name: "Waste Management and Remediation Services", code: "562", industries: [
            { name: "Waste Collection", code: "562110"},
            { name: "Waste Treatment and Disposal", code: "562210"},
            { name: "Remediation and Other Waste Management Services", code: "562900"}
          ]
        }
      ]
  },
  { name: "Educational Services", code: "61", description: "Providing instruction and training.",
    subSectors: [
        { name: "Elementary and Secondary Schools", code: "6111", industries: [{name: "Elementary and Secondary Schools", code: "611110"}] },
        { name: "Junior Colleges", code: "6112", industries: [{name: "Junior Colleges", code: "611210"}] },
        { name: "Colleges, Universities, and Professional Schools", code: "6113", industries: [{name: "Colleges, Universities, and Professional Schools", code: "611310"}] },
        { name: "Business Schools and Computer and Management Training", code: "6114", industries: [{name: "Business and Secretarial Schools", code: "611410"}]},
        { name: "Technical and Trade Schools", code: "6115", industries: [{name: "Cosmetology and Barber Schools", code: "611511"}]},
        { name: "Other Schools and Instruction", code: "6116", industries: [{name: "Fine Arts Schools", code: "611610"}]},
        { name: "Educational Support Services", code: "6117", industries: [{name: "Educational Support Services", code: "611710"}]}
      ]
  },
  { name: "Health Care and Social Assistance", code: "62", description: "Providing health care and social assistance.",
    subSectors: [
        { name: "Ambulatory Health Care Services", code: "621", industries: [
            {name: "Offices of Physicians", code: "621110"}, // Grouping
            {name: "Offices of Dentists", code: "621210"},
            {name: "Offices of Other Health Practitioners", code: "621300"},
            {name: "Outpatient Care Centers", code: "621400"},
            {name: "Medical and Diagnostic Laboratories", code: "621510"},
            {name: "Home Health Care Services", code: "621610"},
            {name: "Other Ambulatory Health Care Services", code: "621900"}
          ]
        },
        { name: "Hospitals", code: "622", industries: [
            {name: "General Medical and Surgical Hospitals", code: "622110"},
            {name: "Psychiatric and Substance Abuse Hospitals", code: "622210"},
            {name: "Specialty (except Psychiatric and Substance Abuse) Hospitals", code: "622310"}
          ]
        },
        { name: "Nursing and Residential Care Facilities", code: "623", industries: [
            {name: "Nursing Care Facilities (Skilled Nursing Facilities)", code: "623110"},
            {name: "Residential Intellectual and Developmental Disability, Mental Health, and Substance Abuse Facilities", code: "623200"}, // Grouping
            {name: "Continuing Care Retirement Communities and Assisted Living Facilities for the Elderly", code: "623310"}, // Grouping
            {name: "Other Residential Care Facilities", code: "623990"}
          ]
        },
        { name: "Social Assistance", code: "624", industries: [
            {name: "Individual and Family Services", code: "624100"},
            {name: "Community Food and Housing, and Emergency and Other Relief Services", code: "624200"},
            {name: "Vocational Rehabilitation Services", code: "624310"},
            {name: "Child Care Services", code: "624410"} // Renamed from Child Day Care Services
          ]
        }
      ]
  },
  { name: "Arts, Entertainment, and Recreation", code: "71", description: "Operating facilities or providing services to meet varied cultural, entertainment, and recreational interests.",
    subSectors: [
        { name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [
            {name: "Performing Arts Companies", code: "711100"},
            {name: "Spectator Sports", code: "711210"}, // Grouping
            {name: "Promoters of Performing Arts, Sports, and Similar Events", code: "711300"},
            {name: "Agents and Managers for Artists, Athletes, Entertainers, and Other Public Figures", code: "711410"},
            {name: "Independent Artists, Writers, and Performers", code: "711510"}
          ]
        },
        { name: "Museums, Historical Sites, and Similar Institutions", code: "712", industries: [
            {name: "Museums, Historical Sites, and Similar Institutions", code: "712100"} // Grouping
          ]
        },
        { name: "Amusement, Gambling, and Recreation Industries", code: "713", industries: [
            {name: "Amusement Parks and Arcades", code: "713100"},
            {name: "Gambling Industries", code: "713200"},
            {name: "Other Amusement and Recreation Industries (Golf Courses, Skiing Facilities, Marinas, Fitness Centers, Bowling Centers, etc.)", code: "713900"} // Grouping
          ]
        }
      ]
  },
  { name: "Accommodation and Food Services", code: "72", description: "Providing customers with lodging and/or preparing meals.",
    subSectors: [
        { name: "Accommodation", code: "721", industries: [
            {name: "Traveler Accommodation (Hotels, Motels, Casino Hotels, Bed-and-Breakfast Inns)", code: "721100"}, // Grouping
            {name: "RV (Recreational Vehicle) Parks and Recreational Camps", code: "721210"},
            {name: "Rooming and Boarding Houses, Dormitories, and Workers' Camps", code: "721310"}
          ]
        },
        { name: "Food Services and Drinking Places", code: "722", industries: [
            {name: "Full-Service Restaurants", code: "722511"},
            {name: "Limited-Service Restaurants", code: "722513"}, // Grouping for Limited-Service Eating Places
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
            {name: "Automotive Repair and Maintenance", code: "811100"}, // Grouping
            {name: "Electronic and Precision Equipment Repair and Maintenance", code: "811210"},
            {name: "Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance", code: "811310"},
            {name: "Personal and Household Goods Repair and Maintenance", code: "811400"}
          ]
        },
        { name: "Personal and Laundry Services", code: "812", industries: [
            {name: "Personal Care Services (Hair, Nail, Skin Care Services)", code: "812110"}, // Grouping
            {name: "Death Care Services (Funeral Homes, Cemeteries)", code: "812200"}, // Grouping
            {name: "Drycleaning and Laundry Services", code: "812300"}, // Grouping
            {name: "Other Personal Services (Pet Care, Photofinishing, Parking Lots)", code: "812900"} // Grouping
          ]
        },
        { name: "Religious, Grantmaking, Civic, Professional, and Similar Organizations", code: "813", industries: [
            {name: "Religious Organizations", code: "813110"},
            {name: "Grantmaking and Giving Services", code: "813210"}, // Grouping
            {name: "Social Advocacy Organizations", code: "813310"}, // Grouping
            {name: "Civic and Social Organizations", code: "813410"},
            {name: "Business, Professional, Labor, Political, and Similar Organizations", code: "813900"} // Grouping
          ]
        },
        { name: "Private Households", code: "814", industries: [{name: "Private Households", code: "814110"}] }
      ]
  },
  { name: "Public Administration", code: "92", description: "Activities of a governmental nature.",
    subSectors: [
        { name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [
            {name: "Executive Offices", code: "921110"}, {name: "Legislative Bodies", code: "921120"}
          ]
        },
        { name: "Justice, Public Order, and Safety Activities", code: "922", industries: [
            {name: "Courts", code: "922110"}, {name: "Police Protection", code: "922120"}
          ]
        },
        { name: "Administration of Human Resource Programs", code: "923", industries: [
            {name: "Administration of Education Programs", code: "923110"}
          ]
        },
        { name: "Administration of Environmental Quality Programs", code: "924", industries: [
            {name: "Administration of Air and Water Resource and Solid Waste Management Programs", code: "924110"}
          ]
        },
        { name: "Administration of Housing Programs, Urban Planning, and Community Development", code: "925", industries: [
            {name: "Administration of Housing Programs", code: "925110"}
          ]
        },
        { name: "Administration of Economic Programs", code: "926", industries: [
            {name: "Administration of General Economic Programs", code: "926110"}
          ]
        },
        { name: "Space Research and Technology", code: "927", industries: [{name: "Space Research and Technology", code: "927110"}] }, // Kept for consistency
        { name: "National Security and International Affairs", code: "928", industries: [
            {name: "National Security", code: "928110"}, {name: "International Affairs", code: "928120"}
          ]
        }
      ]
  }
];


const getInitials = (displayNameOrEmail: string | null | undefined): string => {
    if (!displayNameOrEmail) return '?';
    const name = displayNameOrEmail.startsWith('@') ? displayNameOrEmail.substring(1) : displayNameOrEmail;

    const pseudonymRegex = /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{3}$/;
    if (pseudonymRegex.test(name)) {
        const match = name.match(/^([A-Z])[a-z]+([A-Z])/); 
        if (match && match[1] && match[2]) return match[1] + match[2];
        if (match && match[1]) return match[1];
    }

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
      postDataForFirestore.imageUrls = uploadedImageUrls;
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
