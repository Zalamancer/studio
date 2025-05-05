
// src/app/discover/page.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link'; // Import Link
import { cn } from '@/lib/utils'; // Import cn for conditional classes

const sectors = [
  { code: "11", title: "Agriculture, Forestry, Fishing and Hunting", hint: "farming crops" },
  { code: "21", title: "Mining, Quarrying, and Oil and Gas Extraction", hint: "mining equipment" },
  { code: "22", title: "Utilities", hint: "power lines" },
  { code: "23", title: "Construction", hint: "construction site" },
  { code: "31-33", title: "Manufacturing", hint: "factory assembly line", link: "/discover/manufacturing" }, // Add link prop
  { code: "42", title: "Wholesale Trade", hint: "warehouse pallets" },
  { code: "44-45", title: "Retail Trade", hint: "shopping mall" },
  { code: "48-49", title: "Transportation and Warehousing", hint: "trucks highway" },
  { code: "51", title: "Information", hint: "data center servers" },
  { code: "52", title: "Finance and Insurance", hint: "stock market graph" },
  { code: "53", title: "Real Estate and Rental and Leasing", hint: "modern house" },
  { code: "54", title: "Professional, Scientific, and Technical Services", hint: "scientist laboratory" },
  { code: "55", title: "Management of Companies and Enterprises", hint: "office building boardroom" },
  { code: "56", title: "Administrative and Support and Waste Management and Remediation Services", hint: "office workers support" },
  { code: "61", title: "Educational Services", hint: "classroom students" },
  { code: "62", title: "Health Care and Social Assistance", hint: "doctor patient" },
  { code: "71", title: "Arts, Entertainment, and Recreation", hint: "concert stage" },
  { code: "72", title: "Accommodation and Food Services", hint: "restaurant chef" },
  { code: "81", title: "Other Services (except Public Administration)", hint: "mechanic workshop" },
  { code: "92", title: "Public Administration", hint: "government building" },
];

const DiscoverPage = () => {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Discover Sectors
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Explore different business sectors within the AnonyCollab community. Click on Manufacturing for more details.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {sectors.map((sector) => {
          const CardContentWrapper = sector.link ? Link : 'div'; // Use Link if link exists, otherwise div
          const cardContentProps = sector.link ? { href: sector.link, passHref: true } : {};

          return (
            <CardContentWrapper key={sector.code} {...cardContentProps}>
              <Card
                className={cn(
                  "overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col h-full group", // Add group class
                  sector.link && "cursor-pointer" // Add cursor pointer if it's a link
                )}
              >
                <CardHeader className="p-4 border-b bg-muted/30">
                  <CardTitle className="text-lg font-semibold text-foreground truncate">
                    {sector.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">NAICS: {sector.code}</p>
                </CardHeader>
                <CardContent className="p-0 flex-grow">
                  <div className="aspect-video relative w-full">
                    <Image
                      src={`https://picsum.photos/seed/${sector.code}/400/225`} // Placeholder image based on code
                      alt={sector.title}
                      fill // Use fill instead of layout="fill" objectFit="cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw" // Add sizes prop
                      className="object-cover transition-transform duration-300 group-hover:scale-105" // Use object-cover
                      data-ai-hint={sector.hint} // Add hint for image generation
                    />
                  </div>
                   {/* Optional: Add a short description or link here */}
                   {/* <p className="p-4 text-sm text-muted-foreground">
                     Find collaborators and resources in the {sector.title} sector.
                   </p> */}
                </CardContent>
                 {/* Optional Footer for actions */}
                 {/* <CardFooter className="p-4">
                   <Button variant="link" className="p-0 h-auto text-primary">View Posts</Button>
                 </CardFooter> */}
              </Card>
            </CardContentWrapper>
          );
        })}
      </div>
    </div>
  );
};

export default DiscoverPage;
