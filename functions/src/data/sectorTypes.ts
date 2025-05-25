// functions/src/data/sectorTypes.ts

// Define the types for sector data, mirroring those in the main app
// to avoid complex relative imports between main app and functions.

export interface Industry {
  name: string;
  code: string;
  description?: string; // Optional description for industry
}

export interface SubSector {
  name: string;
  code: string;
  description?: string; // Optional description for sub-sector
  industries: Industry[];
}

export interface SectorWithSubSectors {
  name: string;
  code: string;
  description?: string; // Optional description for main sector
  subSectors: SubSector[];
}
