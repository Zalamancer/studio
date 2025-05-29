import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Centralized Firebase UID Regex
// Firebase UIDs are typically 28 characters long and alphanumeric.
// This regex is slightly more general to catch common variations but should be specific enough.
export const IS_VALID_FIREBASE_UID_REGEX = /^[a-zA-Z0-9]{20,28}$/;