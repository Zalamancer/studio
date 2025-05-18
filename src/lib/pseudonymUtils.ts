
// src/lib/pseudonymUtils.ts

const ADJECTIVES = ["Agile", "Aqua", "Azure", "Blue", "Bold", "Bright", "Bronze", "Calm", "Cloud", "Coral", "Crimson", "Cyan", "Desert", "Diamond", "Dusty", "Eager", "Ebony", "Emerald", "Forest", "Frost", "Ghost", "Giant", "Golden", "Green", "Grey", "Hidden", "Indigo", "Island", "Ivory", "Jade", "Keen", "Laser", "Lava", "Lazy", "Leafy", "Light", "Lime", "Lunar", "Magenta", "Maple", "Metal", "Mint", "Mirage", "Mossy", "Mystic", "Navy", "Noble", "Ocean", "Olive", "Onyx", "Orange", "Orchid", "Pearl", "Pine", "Pink", "Pixel", "Plum", "Prairie", "Purple", "Pyro", "Quiet", "Quick", "Radiant", "Rainy", "Rapid", "Red", "River", "Rocky", "Rose", "Royal", "Ruby", "Rusty", "Sable", "Sandy", "Sapphire", "Scarlet", "Shadow", "Silent", "Silver", "Sky", "Slate", "Solar", "Solid", "Spicy", "Steel", "Stone", "Storm", "Sunny", "Swift", "Terra", "Teal", "Titan", "Topaz", "Urban", "Velvet", "Verdant", "Violet", "Vivid", "Void", "Warm", "White", "Wild", "Windy", "Winter", "Wise", "Xenon", "Xeric", "Yellow", "Zenith", "Zephyr"];
const NOUNS = ["Alpaca", "Ant", "Ape", "Badger", "Bat", "Bear", "Bee", "Bison", "Boar", "Bobcat", "Bug", "Camel", "Cat", "Clam", "Cobra", "Cod", "Comet", "Condor", "Cougar", "Cow", "Coyote", "Crab", "Crane", "Crow", "Deer", "Dingo", "Dog", "Dolphin", "Dove", "Dragon", "Duck", "Eagle", "Eel", "Elk", "Emu", "Falcon", "Ferret", "Finch", "Fish", "Fly", "Fox", "Frog", "Gecko", "Glitch", "Gnu", "Goat", "Goose", "Griffin", "Gull", "Hamster", "Hare", "Hawk", "Hedgehog", "Heron", "Hornet", "Horse", "Hound", "Hyena", "Impala", "Jaguar", "Jay", "Kitten", "Koala", "Koi", "Krill", "Lemur", "Leopard", "Lion", "Lizard", "Llama", "Lobster", "Lynx", "Macaw", "Matrix", "Mole", "Monkey", "Moose", "Mouse", "Mule", "Newt", "Octopus", "Opossum", "Orca", "Ostrich", "Otter", "Owl", "Ox", "Panda", "Panther", "Parrot", "Pelican", "Penguin", "Pigeon", "Pixel", "Puma", "Puppy", "Python", "Quail", "Rabbit", "Raccoon", "Ram", "Rat", "Raven", "Rhino", "Robin", "Salmon", "Scorpion", "Seal", "Shark", "Sheep", "Skunk", "Sloth", "Snail", "Snake", "Sparrow", "Spider", "Squid", "Squirrel", "Starfish", "Stingray", "Stork", "Swan", "Tarpon", "Termite", "Tiger", "Toad", "Trout", "Turtle", "Vector", "Viper", "Vulture", "Walrus", "Wasp", "Weasel", "Whale", "Wolf", "Wombat", "Wren", "Yak", "Zebra"];

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

export const generateAnonymousName = (userId: string): string => {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    // Fallback for invalid userId input
    const randomAdj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const randomNoun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const randomNumber = Math.floor(Math.random() * 900) + 100; // 100-999
    return `${randomAdj}${randomNoun}${randomNumber}`;
  }

  // Use different parts of the userId or manipulate it for different hashes
  // to reduce likelihood of same adjective/noun pairs for similar UIDs
  const adjSeed = userId + "adj";
  const nounSeed = userId + "noun";
  const numSeed = userId.substring(0, Math.min(userId.length, 5)); // First 5 chars for number part

  const adjIndex = simpleHash(adjSeed, ADJECTIVES.length);
  const nounIndex = simpleHash(nounSeed, NOUNS.length);
  const numericSuffix = (simpleHash(numSeed, 900) + 100).toString(); // 3-digit number (100-999)

  return `${ADJECTIVES[adjIndex]}${NOUNS[nounIndex]}${numericSuffix}`;
};
