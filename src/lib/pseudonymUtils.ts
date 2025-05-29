// src/lib/pseudonymUtils.ts

// Expanded lists for more variety
const COLORS = [
  "Aqua", "Azure", "Beige", "Black", "Blue", "Bronze", "Brown", "Coral",
  "Crimson", "Cyan", "Emerald", "Gold", "Golden", "Green", "Grey", "Indigo",
  "Ivory", "Jade", "Lavender", "Lime", "Magenta", "Maroon", "Mint", "Navy",
  "Olive", "Onyx", "Orange", "Orchid", "Pearl", "Pine", "Pink", "Plum",
  "Purple", "Red", "Rose", "Ruby", "Sable", "Salmon", "Sapphire", "Scarlet",
  "Silver", "Sky", "Slate", "Tan", "Teal", "Turquoise", "Verdant", "Violet",
  "White", "Yellow", "Amber", "Amethyst", "Apricot", "Ash", "Auburn", "Azure",
  "Berry", "Blush", "Brick", "Burgundy", "Celeste", "Cerulean", "Champagne",
  "Chartreuse", "Cherry", "Chestnut", "Chocolate", "Cinnabar", "Cobalt", "Coffee",
  "Copper", "Cornflower", "Cream", "Denim", "Desert", "Ebony", "Eggplant", "Electric",
  "Fawn", "Fern", "Forest", "Fuchsia", "Ginger", "Graphite", "Gunmetal", "Harlequin",
  "Heliotrope", "Honey", "HotPink", "Ice", "Imperial", "Iron", "Jet", "Khaki",
  "Lapis", "Leaf", "Lemon", "Lilac", "Linen", "Liver", "Lust", "Mahogany",
  "Maize", "Malachite", "Mango", "Mauve", "Midnight", "Moss", "Mulberry",
  "Mustard", "Myrtle", "Nickel", "Ocean", "Ochre", "OldGold", "Olivine",
  "Pacific", "Peach", "Pewter", "Picton", "Pistachio", "Platinum", "Prussian",
  "Pumpkin", "Quartz", "Raspberry", "Raven", "Reef", "Royal", "Russet", "Rust",
  "Saffron", "Sage", "Sand", "Sangria", "Sepia", "Shamrock", "Sienna", "Signal",
  "Smoke", "Steel", "Strawberry", "Sunflower", "Tangerine", "Taupe", "Thistle",
  "Tiger", "Titanium", "Tomato", "Topaz", "Tumbleweed", "Umber", "Vanilla",
  "Vermilion", "Viridian", "Wheat", "Wine", "Wisteria", "Zinc",
];

const ANIMALS = [
  "Alpaca", "Ant", "Ape", "Badger", "Bat", "Bear", "Bee", "Bison", "Boar",
  "Bobcat", "Bug", "Camel", "Cat", "Clam", "Cobra", "Cod", "Comet", "Condor",
  "Cougar", "Cow", "Coyote", "Crab", "Crane", "Crow", "Deer", "Dingo", "Dog",
  "Dolphin", "Dove", "Dragon", "Duck", "Eagle", "Eel", "Elk", "Emu", "Falcon",
  "Ferret", "Finch", "Fish", "Fly", "Fox", "Frog", "Gecko", "Glitch", "Gnu",
  "Goat", "Goose", "Griffin", "Gull", "Hamster", "Hare", "Hawk", "Hedgehog",
  "Heron", "Hornet", "Horse", "Hound", "Hyena", "Impala", "Jaguar", "Jay",
  "Kitten", "Koala", "Koi", "Krill", "Lemur", "Leopard", "Lion", "Lizard",
  "Llama", "Lobster", "Lynx", "Macaw", "Matrix", "Mole", "Monkey", "Moose",
  "Mouse", "Mule", "Newt", "Octopus", "Opossum", "Orca", "Ostrich", "Otter",
  "Owl", "Ox", "Panda", "Panther", "Parrot", "Pelican", "Penguin", "Pigeon",
  "Pixel", "Puma", "Puppy", "Python", "Quail", "Rabbit", "Raccoon", "Ram",
  "Rat", "Raven", "Rhino", "Robin", "Salmon", "Scorpion", "Seal", "Shark",
  "Sheep", "Skunk", "Sloth", "Snail", "Snake", "Sparrow", "Spider", "Squid",
  "Squirrel", "Starfish", "Stingray", "Stork", "Swan", "Tarpon", "Termite",
  "Tiger", "Toad", "Trout", "Turtle", "Vector", "Viper", "Vulture", "Walrus",
  "Wasp", "Weasel", "Whale", "Wolf", "Wombat", "Wren", "Yak", "Zebra", "Antelope",
  "Armadillo", "Baboon", "Barracuda", "Bass", "Beaver", "Butterfly", "Buzzard",
  "Caribou", "Carp", "Caterpillar", "Cheetah", "Chicken", "Chimpanzee",
  "Chinchilla", "Chipmunk", "Cormorant", "Cougar", "Cuckoo", "Curlew", "Dodo",
  "Donkey", "Dragonfly", "Dunlin", "Elephant", "Ermine", "Flamingo", "Flea",
  "Flounder", "Gazelle", "Gerbil", "Giraffe", "Goldfinch", "Goldfish", "Gorilla",
  "Grasshopper", "Grouse", "Guanaco", "GuineaFowl", "Haddock", "Halibut",
  "Herring", "Hippopotamus", "Hummingbird", "Ibex", "Ibis", "Jackal", "Jellyfish",
  "Kangaroo", "Kingfisher", "Kookaburra", "Lapwing", "Lark", "Loris", "Louse",
  "Lyrebird", "Mackerel", "Magpie", "Mallard", "Manatee", "Mandrill", "Mantis",
  "Marten", "Meerkat", "Mink", "Moth", "Narwhal", "Nightingale", "Okapi",
  "Oryx", "Osprey", "Pangolin", "Partridge", "Peafowl", "Pelican", "Pheasant",
  "Piranha", "Platypus", "Porcupine", "Porpoise", "Possum", "PrairieDog",
  "Puffin", "Quetzal", "Rattlesnake", "RedPanda", "Reindeer", "Roadrunner",
  "Salamander", "Sandpiper", "Sardine", "Seahorse", "Serval", "Shrew", "SlothBear",
  "Sponge", "Starling", "Stilt", "Stingray", "Stoat", "Sunfish", "Tapir",
  "Tarsier", "Thrush", "Toucan", "Wallaby", "Warthog", "WaterBuffalo", "Wildcat",
  "Woodpecker", "Worm", "Yellowhammer",
];

const simpleHash = (str: string, max: number): number => {
  let hash = 0;
  if (!str || str.length === 0) {
    return Math.floor(Math.random() * max);
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % max;
};

export const generateAnonymousName = (userId: string | null | undefined): string => {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const randomAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const randomNumber = Math.floor(Math.random() * 900) + 100;
    return `${randomColor}${randomAnimal}${randomNumber}`;
  }

  const colorSeed = userId.substring(0, Math.min(5, userId.length)) + "c" + userId.length;
  const animalSeed = userId.substring(userId.length > 5 ? userId.length - 5 : 0) + "a" + userId.length;
  const numSeed = userId.substring(Math.floor(userId.length / 2), Math.min(userId.length, Math.floor(userId.length / 2) + 5)) + "n" + userId.length;

  const colorIndex = simpleHash(colorSeed, COLORS.length);
  const animalIndex = simpleHash(animalSeed, ANIMALS.length);
  const numericSuffix = (simpleHash(numSeed, 900) + 100).toString();

  return `${COLORS[colorIndex]}${ANIMALS[animalIndex]}${numericSuffix}`;
};


export const getInitials = (name: string | undefined | null): string => {
    if (!name || typeof name !== 'string' || name.trim() === '') return '?';
    
    const nameToProcess = name.startsWith('@') ? name.substring(1) : name;

    // Regex for ColorAnimalNumber format (e.g., BlueWhale123, RedFox45)
    // Adjusted to be less strict about exact word casing for the "Animal" part if needed,
    // but primarily looks for two capitalized segments followed by numbers.
    const pseudonymRegex = /^[A-Z][a-z]+([A-Z][a-zA-Z]*)[0-9]{3,}$/;
    const match = nameToProcess.match(pseudonymRegex);

    if (match) {
        const firstLetter = nameToProcess.charAt(0);
        // The second capital letter of the animal part
        const animalPart = match[1];
        const secondLetter = animalPart.charAt(0);
        return (firstLetter + secondLetter).toUpperCase();
    }

    // Fallback for regular names or company names
    const words = nameToProcess.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].substring(0, 1).toUpperCase();
    
    const firstInitial = words[0].substring(0, 1);
    const lastInitial = words[words.length - 1].substring(0, 1);
    return (firstInitial + lastInitial).toUpperCase();
};