
// src/lib/pseudonymUtils.ts

const COLORS = ["Aqua", "Azure", "Beige", "Black", "Blue", "Bronze", "Brown", "Coral", "Crimson", "Cyan", "Emerald", "Gold", "Golden", "Green", "Grey", "Indigo", "Ivory", "Jade", "Lavender", "Lime", "Magenta", "Maroon", "Mint", "Navy", "Olive", "Onyx", "Orange", "Orchid", "Pearl", "Pine", "Pink", "Plum", "Purple", "Red", "Rose", "Ruby", "Sable", "Salmon", "Sapphire", "Scarlet", "Silver", "Sky", "Slate", "Tan", "Teal", "Turquoise", "Verdant", "Violet", "White", "Yellow"];
const ANIMALS = ["Alpaca", "Ant", "Ape", "Badger", "Bat", "Bear", "Bee", "Bison", "Boar", "Bobcat", "Bug", "Camel", "Cat", "Clam", "Cobra", "Cod", "Comet", "Condor", "Cougar", "Cow", "Coyote", "Crab", "Crane", "Crow", "Deer", "Dingo", "Dog", "Dolphin", "Dove", "Dragon", "Duck", "Eagle", "Eel", "Elk", "Emu", "Falcon", "Ferret", "Finch", "Fish", "Fly", "Fox", "Frog", "Gecko", "Glitch", "Gnu", "Goat", "Goose", "Griffin", "Gull", "Hamster", "Hare", "Hawk", "Hedgehog", "Heron", "Hornet", "Horse", "Hound", "Hyena", "Impala", "Jaguar", "Jay", "Kitten", "Koala", "Koi", "Krill", "Lemur", "Leopard", "Lion", "Lizard", "Llama", "Lobster", "Lynx", "Macaw", "Matrix", "Mole", "Monkey", "Moose", "Mouse", "Mule", "Newt", "Octopus", "Opossum", "Orca", "Ostrich", "Otter", "Owl", "Ox", "Panda", "Panther", "Parrot", "Pelican", "Penguin", "Pigeon", "Pixel", "Puma", "Puppy", "Python", "Quail", "Rabbit", "Raccoon", "Ram", "Rat", "Raven", "Rhino", "Robin", "Salmon", "Scorpion", "Seal", "Shark", "Sheep", "Skunk", "Sloth", "Snail", "Snake", "Sparrow", "Spider", "Squid", "Squirrel", "Starfish", "Stingray", "Stork", "Swan", "Tarpon", "Termite", "Tiger", "Toad", "Trout", "Turtle", "Vector", "Viper", "Vulture", "Walrus", "Wasp", "Weasel", "Whale", "Wolf", "Wombat", "Wren", "Yak", "Zebra"];

// Simple hash function to get a somewhat consistent number from a string
const simpleHash = (str: string, max: number): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % max;
};

export const generateAnonymousName = (userId: string | null | undefined): string => {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    // Fallback for invalid userId input
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const randomAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const randomNumber = Math.floor(Math.random() * 900) + 100; // 100-999
    return `${randomColor}${randomAnimal}${randomNumber}`;
  }

  const colorSeed = userId + "c"; // Slightly shorter seeds can also work
  const animalSeed = userId + "a";
  const numSeed = userId.substring(0, Math.min(userId.length, 8)) + "n"; // Use a few chars

  const colorIndex = simpleHash(colorSeed, COLORS.length);
  const animalIndex = simpleHash(animalSeed, ANIMALS.length);
  const numericSuffix = (simpleHash(numSeed, 900) + 100).toString(); // 3-digit number (100-999)

  return `${COLORS[colorIndex]}${ANIMALS[animalIndex]}${numericSuffix}`;
};

export const getInitials = (displayNameOrUid: string | undefined | null): string => {
    if (!displayNameOrUid) return '?';
    const nameToProcess = displayNameOrUid.startsWith('@') ? displayNameOrUid.substring(1) : displayNameOrUid;

    const pseudonymRegex = /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}$/; // Matches ColorAnimalNumber format
    if (pseudonymRegex.test(nameToProcess)) {
        const match = nameToProcess.match(/^([A-Z])[a-z]+([A-Z])/); // First letter of Color + First letter of Animal
        if (match && match[1] && match[2]) return match[1] + match[2];
        if (match && match[1]) return match[1]; // Fallback if only one capital found (should not happen with current regex)
    }
    // Fallback for regular names (e.g., "John Doe" -> "JD", "Company Inc" -> "CI")
    const names = nameToProcess.split(' ').filter(Boolean);
    if (names.length === 0) return '?';
    if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
    return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};
