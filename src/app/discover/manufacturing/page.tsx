// src/app/discover/manufacturing/page.tsx
import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from 'next/link'; // Import Link
import { ArrowLeft } from 'lucide-react'; // Import icon

// Parse the provided text data into a structured format
// This is a simplified parsing, focusing on main subsectors and industries
const manufacturingData = [
    { code: "311", title: "Food Manufacturing", description: "Industries transform livestock and agricultural products into products for intermediate or final consumption.", industries: [
        { code: "3111", title: "Animal Food Manufacturing", description: "Manufacturing food and feed for animals." },
        { code: "3112", title: "Grain and Oilseed Milling", description: "Milling flour/meal, manufacturing malt, crushing oilseeds, etc." },
        { code: "3113", title: "Sugar and Confectionery Product Manufacturing", description: "Processing sugar, cacao, and making confectionery." },
        { code: "3114", title: "Fruit and Vegetable Preserving and Specialty Food Manufacturing", description: "Freezing, pickling, canning, dehydrating fruits/vegetables." },
        { code: "3115", title: "Dairy Product Manufacturing", description: "Manufacturing dairy products from milk and substitutes." },
        { code: "3116", title: "Animal Slaughtering and Processing", description: "Slaughtering animals and preparing processed meats." },
        { code: "3117", title: "Seafood Product Preparation and Packaging", description: "Canning, smoking, salting, drying, freezing seafood." },
        { code: "3118", title: "Bakeries and Tortilla Manufacturing", description: "Manufacturing bread, bakery products, pasta, tortillas." },
        { code: "3119", title: "Other Food Manufacturing", description: "Snack foods, coffee, tea, syrups, condiments, etc." },
    ]},
    { code: "312", title: "Beverage and Tobacco Product Manufacturing", description: "Manufacturing beverages and tobacco products.", industries: [
        { code: "3121", title: "Beverage Manufacturing", description: "Soft drinks, ice, water, brewery, winery, distillery products." },
        { code: "3122", title: "Tobacco Manufacturing", description: "Stemming, redrying, manufacturing cigarettes and tobacco products." },
    ]},
    { code: "313", title: "Textile Mills", description: "Transforming fibers into yarn or fabric.", industries: [
        { code: "3131", title: "Fiber, Yarn, and Thread Mills", description: "Spinning yarn, manufacturing thread, texturizing fibers." },
        { code: "3132", title: "Fabric Mills", description: "Weaving, braiding, knitting fabrics." },
        { code: "3133", title: "Textile and Fabric Finishing and Fabric Coating Mills", description: "Finishing, coating, laminating textiles." },
    ]},
    { code: "314", title: "Textile Product Mills", description: "Making textile products (except apparel) from purchased materials.", industries: [
        { code: "3141", title: "Textile Furnishings Mills", description: "Carpets, rugs, curtains, linens." },
        { code: "3149", title: "Other Textile Product Mills", description: "Bags, canvas, rope, twine, tire cord, embroidery, etc." },
    ]},
    { code: "315", title: "Apparel Manufacturing", description: "Manufacturing apparel by cutting and sewing fabric or knitting.", industries: [
        { code: "3151", title: "Apparel Knitting Mills", description: "Knitting apparel or knitting fabric and then manufacturing apparel." },
        { code: "3152", title: "Cut and Sew Apparel Manufacturing", description: "Manufacturing cut and sew apparel from woven or purchased knit fabric." },
        { code: "3159", title: "Apparel Accessories and Other Apparel Manufacturing", description: "Belts, caps, gloves, hats, neckties, etc." },
    ]},
    { code: "316", title: "Leather and Allied Product Manufacturing", description: "Tanning hides and fabricating leather or substitute products.", industries: [
        { code: "3161", title: "Leather and Hide Tanning and Finishing", description: "Tanning, currying, finishing hides; dyeing furs." },
        { code: "3162", title: "Footwear Manufacturing", description: "Manufacturing footwear (except orthopedic extension)." },
        { code: "3169", title: "Other Leather and Allied Product Manufacturing", description: "Luggage, handbags, wallets, belts (from purchased leather/substitutes)." },
    ]},
    { code: "321", title: "Wood Product Manufacturing", description: "Manufacturing lumber, plywood, veneers, containers, flooring, trusses, etc.", industries: [
        { code: "3211", title: "Sawmills and Wood Preservation", description: "Sawing lumber, treating wood." },
        { code: "3212", title: "Veneer, Plywood, and Engineered Wood Product Manufacturing", description: "Manufacturing veneer, plywood, engineered wood members." },
        { code: "3219", title: "Other Wood Product Manufacturing", description: "Millwork, containers, pallets, mobile homes, prefabricated buildings, etc." },
    ]},
    { code: "322", title: "Paper Manufacturing", description: "Making pulp, paper, or converted paper products.", industries: [
        { code: "3221", title: "Pulp, Paper, and Paperboard Mills", description: "Manufacturing pulp, paper, or paperboard." },
        { code: "3222", title: "Converted Paper Product Manufacturing", description: "Converting paper/paperboard into containers, bags, stationery, sanitary products, etc." },
    ]},
    { code: "323", title: "Printing and Related Support Activities", description: "Printing products and performing support activities like binding.", industries: [
        { code: "3231", title: "Printing and Related Support Activities", description: "Commercial printing, screen printing, book printing, prepress/postpress services." },
    ]},
    { code: "324", title: "Petroleum and Coal Products Manufacturing", description: "Transforming crude petroleum and coal into usable products.", industries: [
        { code: "3241", title: "Petroleum and Coal Products Manufacturing", description: "Refining petroleum, manufacturing asphalt, coke oven products, etc." },
    ]},
    { code: "325", title: "Chemical Manufacturing", description: "Transforming raw materials by chemical processes.", industries: [
        { code: "3251", title: "Basic Chemical Manufacturing", description: "Petrochemicals, industrial gases, dyes, pigments, inorganic/organic chemicals." },
        { code: "3252", title: "Resin, Synthetic Rubber, and Artificial Synthetic Fibers Manufacturing", description: "Manufacturing synthetic resins, rubber, fibers, filaments." },
        { code: "3253", title: "Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing", description: "Manufacturing fertilizers, pesticides, compost, agricultural chemicals." },
        { code: "3254", title: "Pharmaceutical and Medicine Manufacturing", description: "Manufacturing medicinal chemicals, pharmaceutical preparations, diagnostic substances." },
        { code: "3255", title: "Paint, Coating, and Adhesive Manufacturing", description: "Manufacturing paints, coatings, adhesives, glues, caulking." },
        { code: "3256", title: "Soap, Cleaning Compound, and Toilet Preparation Manufacturing", description: "Manufacturing soaps, detergents, polishes, cosmetics." },
        { code: "3259", title: "Other Chemical Product and Preparation Manufacturing", description: "Printing ink, explosives, photographic film, custom compounding, etc." },
    ]},
    { code: "326", title: "Plastics and Rubber Products Manufacturing", description: "Processing plastics materials and raw rubber.", industries: [
        { code: "3261", title: "Plastics Product Manufacturing", description: "Processing plastics resins into intermediate or final products." },
        { code: "3262", title: "Rubber Product Manufacturing", description: "Processing rubber into tires, hoses, belting, mechanical goods, etc." },
    ]},
    { code: "327", title: "Nonmetallic Mineral Product Manufacturing", description: "Transforming mined nonmetallic minerals.", industries: [
        { code: "3271", title: "Clay Product and Refractory Manufacturing", description: "Pottery, ceramics, plumbing fixtures, bricks, tiles, refractories." },
        { code: "3272", title: "Glass and Glass Product Manufacturing", description: "Manufacturing glass and glass products." },
        { code: "3273", title: "Cement and Concrete Product Manufacturing", description: "Cement, ready-mix concrete, concrete pipe, brick, block." },
        { code: "3274", title: "Lime and Gypsum Product Manufacturing", description: "Manufacturing lime and gypsum products." },
        { code: "3279", title: "Other Nonmetallic Mineral Product Manufacturing", description: "Abrasives, cut stone, mineral wool, insulation, etc." },
    ]},
    { code: "331", title: "Primary Metal Manufacturing", description: "Smelting and refining ferrous and nonferrous metals.", industries: [
        { code: "3311", title: "Iron and Steel Mills and Ferroalloy Manufacturing", description: "Manufacturing pig iron, steel, ferroalloys." },
        { code: "3312", title: "Steel Product Manufacturing from Purchased Steel", description: "Manufacturing pipe, tube, wire, shapes from purchased steel." },
        { code: "3313", title: "Alumina and Aluminum Production and Processing", description: "Refining alumina, producing/processing aluminum." },
        { code: "3314", title: "Nonferrous Metal (except Aluminum) Production and Processing", description: "Smelting, refining, rolling, drawing nonferrous metals (except aluminum)." },
        { code: "3315", title: "Foundries", description: "Pouring molten metal into molds to form castings." },
    ]},
    { code: "332", title: "Fabricated Metal Product Manufacturing", description: "Transforming metal into intermediate or end products.", industries: [
        { code: "3321", title: "Forging and Stamping", description: "Manufacturing forgings, stampings, custom roll forming, powder metallurgy parts." },
        { code: "3322", title: "Cutlery and Handtool Manufacturing", description: "Cookware, utensils, cutlery, flatware, saw blades, handtools." },
        { code: "3323", title: "Architectural and Structural Metals Manufacturing", description: "Prefabricated metal buildings, structural metal, plate work, windows, doors, sheet metal work." },
        { code: "3324", title: "Boiler, Tank, and Shipping Container Manufacturing", description: "Power boilers, heat exchangers, metal tanks, containers." },
        { code: "3325", title: "Hardware Manufacturing", description: "Manufacturing metal hardware (hinges, handles, keys, locks)." },
        { code: "3326", title: "Spring and Wire Product Manufacturing", description: "Manufacturing springs and fabricated wire products." },
        { code: "3327", title: "Machine Shops; Turned Product; and Screw, Nut, and Bolt Manufacturing", description: "Machine shops, precision turned products, fasteners." },
        { code: "3328", title: "Coating, Engraving, Heat Treating, and Allied Activities", description: "Heat treating, coating, engraving, plating metals." },
        { code: "3329", title: "Other Fabricated Metal Product Manufacturing", description: "Valves, bearings, ammunition, small arms, pipe fittings, safes, ladders, etc." },
    ]},
    { code: "333", title: "Machinery Manufacturing", description: "Creating end products that apply mechanical force.", industries: [
        { code: "3331", title: "Agriculture, Construction, and Mining Machinery Manufacturing", description: "Farm, construction, mining machinery." },
        { code: "3332", title: "Industrial Machinery Manufacturing", description: "Food, semiconductor, sawmill, paper, printing, textile machinery." },
        { code: "3333", title: "Commercial and Service Industry Machinery Manufacturing", description: "Optical instruments, photographic equipment, vending machines, office machinery." },
        { code: "3334", title: "Ventilation, Heating, Air-Conditioning, and Commercial Refrigeration Equipment Manufacturing", description: "HVAC and commercial refrigeration equipment." },
        { code: "3335", title: "Metalworking Machinery Manufacturing", description: "Machine tools, cutting tools, dies, jigs, fixtures, industrial molds." },
        { code: "3336", title: "Engine, Turbine, and Power Transmission Equipment Manufacturing", description: "Engines (except auto/aircraft), turbines, power transmission equipment." },
        { code: "3339", title: "Other General Purpose Machinery Manufacturing", description: "Pumps, compressors, material handling, packaging, welding equipment, etc." },
    ]},
    { code: "334", title: "Computer and Electronic Product Manufacturing", description: "Manufacturing computers, peripherals, communications equipment, components.", industries: [
        { code: "3341", title: "Computer and Peripheral Equipment Manufacturing", description: "Computers, storage devices, printers, monitors, terminals." },
        { code: "3342", title: "Communications Equipment Manufacturing", description: "Telephone apparatus, radio/TV broadcast, wireless equipment." },
        { code: "3343", title: "Audio and Video Equipment Manufacturing", description: "TVs, stereos, speakers, video cameras, jukeboxes." },
        { code: "3344", title: "Semiconductor and Other Electronic Component Manufacturing", description: "Semiconductors, capacitors, resistors, PCBs, connectors." },
        { code: "3345", title: "Navigational, Measuring, Electromedical, and Control Instruments Manufacturing", description: "Navigational, measuring, medical, control instruments." },
        { code: "3346", title: "Manufacturing and Reproducing Magnetic and Optical Media", description: "Blank tapes/disks, mass duplication." },
    ]},
    { code: "335", title: "Electrical Equipment, Appliance, and Component Manufacturing", description: "Manufacturing products that generate, distribute, and use electrical power.", industries: [
        { code: "3351", title: "Electric Lighting Equipment Manufacturing", description: "Lighting fixtures, bulbs, tubes, parts." },
        { code: "3352", title: "Household Appliance Manufacturing", description: "Small and major electrical appliances." },
        { code: "3353", title: "Electrical Equipment Manufacturing", description: "Transformers, motors, generators, switchgear, controls." },
        { code: "3359", title: "Other Electrical Equipment and Component Manufacturing", description: "Batteries, wire, cable, wiring devices, surge suppressors." },
    ]},
    { code: "336", title: "Transportation Equipment Manufacturing", description: "Producing equipment for transporting people and goods.", industries: [
        { code: "3361", title: "Motor Vehicle Manufacturing", description: "Automobiles, light/heavy duty trucks, chassis." },
        { code: "3362", title: "Motor Vehicle Body and Trailer Manufacturing", description: "Vehicle bodies, cabs, trailers, motor homes, campers." },
        { code: "3363", title: "Motor Vehicle Parts Manufacturing", description: "Engines, electrical, steering, suspension, brakes, transmission parts." },
        { code: "3364", title: "Aerospace Product and Parts Manufacturing", description: "Aircraft, missiles, space vehicles, engines, parts." },
        { code: "3365", title: "Railroad Rolling Stock Manufacturing", description: "Locomotives, rail cars, track maintenance equipment." },
        { code: "3366", title: "Ship and Boat Building", description: "Operating shipyards and boat yards." },
        { code: "3369", title: "Other Transportation Equipment Manufacturing", description: "Motorcycles, bicycles, military vehicles, tanks, snowmobiles, golf carts." },
    ]},
    { code: "337", title: "Furniture and Related Product Manufacturing", description: "Manufacturing furniture and related articles.", industries: [
        { code: "3371", title: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", description: "Household, institutional furniture, kitchen cabinets, countertops." },
        { code: "3372", title: "Office Furniture (including Fixtures) Manufacturing", description: "Office furniture, store fixtures, partitions, shelving, lockers." },
        { code: "3379", title: "Other Furniture Related Product Manufacturing", description: "Mattresses, blinds, shades." },
    ]},
    { code: "339", title: "Miscellaneous Manufacturing", description: "Manufacturing a wide range of products not classified elsewhere.", industries: [
        { code: "3391", title: "Medical Equipment and Supplies Manufacturing", description: "Surgical/medical instruments, appliances, dental/ophthalmic goods." },
        { code: "3399", title: "Other Miscellaneous Manufacturing", description: "Jewelry, sporting goods, toys, office supplies, signs, musical instruments, etc." },
    ]},
];


const ManufacturingPage = () => {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8">
        <Link href="/discover" className="inline-flex items-center text-primary hover:underline mb-4">
           <ArrowLeft className="h-4 w-4 mr-1" /> Back to Discover
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Manufacturing Sector (NAICS 31-33)
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Explore the diverse sub-sectors and industries within Manufacturing. Click on an item to expand and see more detail.
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full space-y-2">
        {manufacturingData.map((subsector) => (
          <AccordionItem key={subsector.code} value={`subsector-${subsector.code}`}>
            <AccordionTrigger className="text-xl font-semibold hover:no-underline bg-muted/40 px-4 py-3 rounded-md border border-border">
              {subsector.code}: {subsector.title}
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-2 pb-4 border border-t-0 rounded-b-md">
              <p className="text-muted-foreground mb-4">{subsector.description}</p>
              {subsector.industries && subsector.industries.length > 0 && (
                <Accordion type="single" collapsible className="w-full space-y-1">
                  {subsector.industries.map((industry) => (
                    <AccordionItem key={industry.code} value={`industry-${industry.code}`}>
                      <AccordionTrigger className="text-base font-medium hover:no-underline bg-muted/20 px-3 py-2 rounded-md border">
                        {industry.code}: {industry.title}
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pt-2 pb-1 text-sm text-muted-foreground">
                        {industry.description}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default ManufacturingPage;
```