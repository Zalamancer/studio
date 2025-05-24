// functions/src/utils/pseudonymUtils.ts

// Copied from the main app's src/lib/pseudonymUtils.ts
// Ensure this is kept in sync if the main app's version changes,
// or consider creating a shared local package if this becomes common.

const COLORS = ["Aqua", "Azure", "Beige", "Black", "Blue", "Bronze", "Brown", "Coral", "Crimson", "Cyan", "Emerald", "Gold", "Golden", "Green", "Grey", "Indigo", "Ivory", "Jade", "Lavender", "Lime", "Magenta", "Maroon", "Mint", "Navy", "Olive", "Onyx", "Orange", "Orchid", "Pearl", "Pine", "Pink", "Plum", "Purple", "Red", "Rose", "Ruby", "Sable", "Salmon", "Sapphire", "Scarlet", "Silver", "Sky", "Slate", "Tan", "Teal", "Turquoise", "Verdant", "Violet", "White", "Yellow"];
const ANIMALS = ["Alpaca", "Ant", "Ape", "Badger", "Bat", "Bear", "Bee", "Bison", "Boar", "Bobcat", "Bug", "Camel", "Cat", "Clam", "Cobra", "Cod", "Comet", "Condor", "Cougar", "Cow", "Coyote", "Crab", "Crane", "Crow", "Deer", "Dingo", "Dog", "Dolphin", "Dove", "Dragon", "Duck", "Eagle", "Eel", "Elk", "Emu", "Falcon", "Ferret", "Finch", "Fish", "Fly", "Fox", "Frog", "Gecko", "Glitch", "Gnu", "Goat", "Goose", "Griffin", "Gull", "Hamster", "Hare", "Hawk", "Hedgehog", "Heron", "Hornet", "Horse", "Hound", "Hyena", "Impala", "Jaguar", "Jay", "Kitten", "Koala", "Koi", "Krill", "Lemur", "Leopard", "Lion", "Lizard", "Llama", "Lobster", "Lynx", "Macaw", "Matrix", "Mole", "Monkey", "Moose", "Mouse", "Mule", "Newt", "Octopus", "Opossum", "Orca", "Ostrich", "Otter", "Owl", "Ox", "Panda", "Panther", "Parrot", "Pelican", "Penguin", "Pigeon", "Pixel", "Puma", "Puppy", "Python", "Quail", "Rabbit", "Raccoon", "Ram", "Rat", "Raven", "Rhino", "Robin", "Salmon", "Scorpion", "Seal", "Shark", "Sheep", "Skunk", "Sloth", "Snail", "Snake", "Sparrow", "Spider", "Squid", "Squirrel", "Starfish", "Stingray", "Stork", "Swan", "Tarpon", "Termite", "Tiger", "Toad", "Trout", "Turtle", "Vector", "Viper", "Vulture", "Walrus", "Wasp", "Weasel", "Whale", "Wolf", "Wombat", "Wren", "Yak", "Zebra"];

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
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const randomAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const randomNumber = Math.floor(Math.random() * 900) + 100;
    return `${randomColor}${randomAnimal}${randomNumber}`;
  }

  const colorSeed = userId.substring(0, 5) + "c";
  const animalSeed = userId.substring(5, 10) + "a";
  const numSeed = userId.substring(10, 15) + "n";

  const colorIndex = simpleHash(colorSeed, COLORS.length);
  const animalIndex = simpleHash(animalSeed, ANIMALS.length);
  const numericSuffix = (simpleHash(numSeed, 900) + 100).toString();

  return `${COLORS[colorIndex]}${ANIMALS[animalIndex]}${numericSuffix}`;
};

// Note: getInitials is not needed in the functions environment for now.
// If it were, it would be copied here too.
