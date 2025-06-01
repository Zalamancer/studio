
// src/lib/pseudonymUtils.ts

// Expanded lists for more variety
const COLORS = [
  "Agate", "Alabaster", "Albescent", "Albugineous", "Almond", "Amaranth", "Amber", "Amethyst", "Apple", "Apricot",
  "Aqua", "Aquamarine", "Arctic", "Argent", "Arylide", "Ash", "Ashes", "Asphalt", "Aubergine", "Auburn",
  "Aura", "Aureate", "Aureolin", "Azure", "Bamboo", "Bark", "Basil", "Battleship", "Beige", "Berry",
  "Biscotti", "Biscuit", "Bisque", "Bistre", "Black", "Blaze", "Blond", "Blonde", "Blood", "Blue",
  "Bluebell", "Blush", "Bone", "Bordeaux", "Brass", "Brick", "Bronze", "Brown", "Brunette", "Bubblegum",
  "Buff", "Burgundy", "Butter", "Buttermilk", "Byzantium", "Cactus", "Canary", "Candy", "Canvas", "Caramel",
  "Cardinal", "Carmine", "Carnation", "Carrot", "Cashmere", "Cedar", "Celadon", "Celeste", "Cerise", "Cerulean",
  "Chalk", "Champagne", "Charcoal", "Chartreuse", "Cherry", "Chestnut", "Chiffon", "Chocolate", "Cider", "Cinabrese",
  "Cinereous", "Cinnabar", "Cinnamon", "Citrine", "Citron", "Claret", "Clay", "Cloud", "Clove", "Coal",
  "Cobalt", "Cocoa", "Coffee", "Comet", "Copper", "Coquelicot", "Coral", "Coraline", "Corbeau", "Cornflower",
  "Cornsilk", "Cosmos", "Cotton", "Cream", "Crimson", "Currant", "Cyan", "Daisy", "Dandelion", "Dawn",
  "Denim", "Desire", "Diamond", "Dove", "Drab", "Dragonfruit", "Dun", "Dune", "Dusk", "Dust",
  "Ebony", "Eburnean", "Ecru", "Eggshell", "Eldritch", "Ember", "Emerald", "Envy", "Espresso", "Fairy",
  "Fawn", "Feldgrau", "Fern", "Ferrari", "Field", "Fire", "Firebrick", "Flame", "Flamingo", "Flavescent",
  "Flaxen", "Flint", "Fog", "Frost", "Frostiness", "Fuchsia", "Fulvous", "Fuschia", "Galaxy", "Gamboge",
  "Garnet", "Ginger", "Glacier", "Glaucous", "Gold", "Golden", "Gossamer", "Granola", "Graphite", "Green",
  "Greige", "Grey", "Gunmetal", "Hazel", "Hazelnut", "Heliotrope", "Hibiscus", "Hickory", "Hoariness", "Honey",
  "Honeydew", "Icicle", "Indigo", "Ink", "Iris", "Iron", "Isabelline", "Ivory", "Jacinthe", "Jade",
  "Jam", "Jasper", "Jet", "Jonquil", "Jungle", "Kelly", "Khaki", "Kiwi", "Kombu", "Lagoon",
  "Lapis", "Latte", "Lavender", "Lead", "Leaf", "Leather", "Lemon", "Licorice", "Lilac", "Lime",
  "Lincoln", "Linen", "Lipstick", "Livid", "Lollipop", "Lovat", "Madder", "Magenta", "Magnolia", "Mahogany",
  "Maize", "Mango", "Maple", "Marigold", "Marmalade", "Maroon", "Marsh", "Mauve", "Mazarine", "Meadow",
  "Merlot", "Mermaid", "Metal", "Meteor", "Midnight", "Milk", "Mint", "Mist", "Mocha", "Moss",
  "Mulberry", "Mystic", "Nacarat", "Navy", "Nebula", "Nevada", "Nickel", "Niveous", "Nova", "Nutmeg",
  "Oat", "Obsidian", "Ocean", "Ocher", "Ochre", "Olive", "Onyx", "Opal", "Or", "Oracle",
  "Orange", "Orchid", "Oyster", "Papaya", "Parchment", "Paris green", "Peach", "Pearl", "Pebble", "Pecan",
  "Penny", "Peony", "Periwinkle", "Persimmon", "Petal", "Pewter", "Phoenix", "Phthalo", "Piceous", "Pine",
  "Pink", "Pixie", "Platinum", "Plum", "Porcelain", "Porpoise", "Puce", "Pumice", "Pumpkin", "Punch",
  "Purple", "Quartz", "Rain", "Raspberry", "Raven", "Red", "Root", "Rose", "Ruby", "Russet",
  "Rust", "Sable", "Saddle", "Saffron", "Sage", "Salmon", "Sand", "Sanguine", "Sapphire", "Sarcoline",
  "Satin", "Scarlet", "Sepia", "Shadow", "Sienna", "Silk", "Silver", "Sinopia", "Siren", "Skobeloff",
  "Sky", "Slate", "Smaragdine", "Smoke", "Snow", "Soot", "Sorrel", "Spice", "Spirit", "Squash",
  "Stammel", "Starlight", "Steel", "Stem", "Stone", "Storm", "Straw", "Suede", "Sunflower", "Sunset",
  "Swamp", "Syrup", "Taffy", "Tan", "Tangelo", "Tangerine", "Taupe", "Tawny", "Teal", "Thistle",
  "Thorn", "Tiger", "Tilleul", "Titanium", "Titian", "Toffee", "Topaz", "Turquoise", "Tyrian", "Ultramarine",
  "Ultraviolet", "Umber", "Vantablack", "Vermilion", "Verdant", "Violet", "Viridian", "Viridity", "Walnut", "Wheat",
  "White", "Wine", "Wisteria", "Yam", "Yellow", "Yinmn", "Zaffre", "Zinc",
];
const ANIMALS = [
    "Aardvark", "Aardwolf", "Addax", "Agouti", "Albatross", "Alpaca", "Amphibian", "Angelfish", "Anoa", "Anteater",
    "Antechinus", "Antelope", "Argali", "Argonaut", "Armadillo", "Axolotl", "Aye-Aye", "Badger", "Baiji", "Bandicoot",
    "Banteng", "Barnacle", "Barramundi", "Basilisk", "Bass", "Bear", "Beaver", "Beira", "Binturong", "Bird",
    "Bison", "Blackbird", "Blackbuck", "Bobcat", "Bobolink", "Booby", "Bovid", "Buck", "Budgie", "Buffalo",
    "Bull", "Butterfly", "Butterflyfish", "Buzzard", "Camel", "Canary", "Canid", "Canidae", "Capybara", "Caracal",
    "Cardinal", "Caribou", "Carp", "Cat", "Catfish", "Cattle", "Cephalopod", "Chameleon", "Cheetah", "Chevrotain",
    "Chickadee", "Chicken", "Chihuahua", "Chinchilla", "Chipmunk", "Chiru", "Chuditch", "Chupacabra", "Clam", "Clownfish",
    "Coati", "Cockatiel", "Cockatoo", "Cod", "Coelacanth", "Coho", "Colubus", "Colugo", "Condor", "Coral",
    "Cormorant", "Cougar", "Cow", "Coyote", "Coypu", "Crane", "Crawfish", "Crow", "Cuckoo", "Culpeo",
    "Cuscus", "Cuttlefish", "Dacshund", "Dalmation", "Damselfish", "Deer", "Degu", "Desman", "Dhole", "Dibatag",
    "Dibbler", "Dik-dik", "Dingo", "Dinosaur", "Dog", "Dolphin", "Donkey", "Dormouse", "Douc", "Dove",
    "Dragon", "Drake", "Drill", "Duck", "Dugong", "Duiker", "Dunnart", "Eagle", "Echidna", "Eclectus",
    "Egret", "Eland", "Elephant", "Elk", "Emu", "Ermine", "Erne", "Falcon", "Felidae", "Ferret",
    "Finch", "Firefly", "Firefox", "Fish", "Fisher", "Flamingo", "Flyingfish", "Fowl", "Fox", "Frog",
    "Galago", "Galliform", "Gamefowl", "Gaur", "Gayal", "Gazelle", "Gecko", "Genet", "Gerbil", "Gerenuk",
    "Giraffe", "Goat", "Goldfish", "Goose", "Goral", "Grasshopper", "Grivet", "Groundhog", "Grouse", "Guan",
    "Guanaco", "Guenon", "Guineafowl", "Gull", "Gundi", "Guppy", "Haddock", "Halibut", "Hamster", "Hare",
    "Harrier", "Hartebeest", "Hawk", "Hedgehog", "Heron", "Herring", "Hippopotamus", "Horse", "Huemul", "Hummingbird",
    "Hutia", "Hyrax", "Ibex", "Iguana", "Iguanodon", "Impala", "Jackal", "Jackrabbit", "Jaguar", "Jaguarundi",
    "Jay", "Jerboa", "Junglefowl", "Kangaroo", "Kha-nyou", "Kingfisher", "Kinkajou", "Kipunji", "Kite", "Kiwi",
    "Klipspringer", "Koala", "Kob", "Kodkod", "Koi", "Kookaburra", "Kouprey", "Kowari", "Krill", "Kudu",
    "Kultarr", "Ladybug", "Lama", "Lamb", "Lancelet", "Landfowl", "Langur", "Lark", "Lechwe", "Lemming",
    "Lemur", "Leopard", "Leopon", "Liger", "Limpet", "Lion", "Llama", "Lobster", "Loon", "Lungfish",
    "Lutung", "Lynx", "Macaw", "Mackerel", "Magpie", "Malbrouck", "Mallard", "Mammal", "Man-Of-War", "Manatee",
    "Mara", "Margay", "Markhor", "Marlin", "Marmoset", "Marmot", "Marsupial", "Marten", "Mastodon", "Meadowlark",
    "Meerkat", "Milu", "Mink", "Minnow", "Mockingbird", "Mole", "Mollusk", "Mongoose", "Moose", "Moth",
    "Mouflon", "Mule", "Mulgara", "Muntjac", "Muskox", "Narwhal", "Nautilus", "Newt", "Nightingale", "Nilgai",
    "Nudibranch", "Numbat", "Nyala", "Ocelot", "Octopus", "Okapi", "Olingo", "Onager", "Oncilla", "Orca",
    "Oribi", "Oryx", "Osprey", "Ostrich", "Otter", "Owl", "Ox", "Paca", "Pademelon", "Panda",
    "Pangolin", "Panther", "Parakeet", "Parrot", "Parrotfish", "Partridge", "Peacock", "Peafowl", "Peccary", "Pelican",
    "Penguin", "Perch", "Phascogale", "Pheasant", "Pigeon", "Pika", "Pinniped", "Platypus", "Plover", "Pony",
    "Porcupine", "Porpoise", "Potto", "Prawn", "Primate", "Pronghorn", "Ptarmigan", "Pudu", "Puffin", "Puku",
    "Puma", "Quail", "Quelea", "Quetzal", "Quokka", "Quoll", "Rabbit", "Raccoon", "Raven", "Reindeer",
    "Reptile", "Rhebok", "Rhino", "Rhinoceros", "Roadrunner", "Robin", "Rook", "Rooster", "Sable", "Saiga",
    "Salamander", "Salmon", "Sandpiper", "Saola", "Scallop", "Seahorse", "Seal", "Serow", "Serval", "Sheep",
    "Shrimp", "Siamang", "Sifaka", "Sitatunga", "Skink", "Sloth", "Smelt", "Snails", "Snipe", "Sole",
    "Solenodon", "Sparrow", "Sponge", "Spoonbill", "Springbok", "Springhaas", "Squid", "Squirrel", "Starfish", "Stoat",
    "Stork", "Suni", "Surili", "Swallow", "Swan", "Swift", "Swordtail", "Tadpole", "Tahr", "Takin",
    "Talapoin", "Tamandua", "Tapir", "Tarpan", "Tarsier", "Taruca", "Tayra", "Tenrec", "Tern", "Terrapin",
    "Thrush", "Tiger", "Tiglon", "Titi", "Topi", "Tortoise", "Toucan", "Trout", "Tuna", "Tur",
    "Turkey", "Turtle", "Tyrannosaurus", "Uakari", "Urchin", "Urial", "Velociraptor", "Vervet", "Vicuna", "Vole",
    "Wallaby", "Wallaroo", "Walrus", "Warbler", "Weasel", "Whale", "Whippet", "Whitefish", "Whooper", "Wildcat",
    "Wildebeest", "Wildfowl", "Wolf", "Wolverine", "Wombat", "Woodchuck", "Woodpecker", "Wren", "Xerinae", "Yak",
    "Yeti", "Zebra", "Zebu", "Zokor", "Zorilla", "Beisa", "Brocket", "Fossa", "Kea", "Uromastyx",
    "Vaquita", "Wisent", "Xenops", "Noolbenger"
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
    // Revert to 3 digits: 100-999
    const randomNumber = Math.floor(Math.random() * 900) + 100;
    return `${randomColor}${randomAnimal}${randomNumber}`;
  }

  const colorSeed = userId.substring(0, Math.min(5, userId.length)) + "c" + userId.length;
  const animalSeed = userId.substring(userId.length > 5 ? userId.length - 5 : 0) + "a" + userId.length;
  const numSeed = userId.substring(Math.floor(userId.length / 2), Math.min(userId.length, Math.floor(userId.length / 2) + 5)) + "n" + userId.length;

  const colorIndex = simpleHash(colorSeed, COLORS.length);
  const animalIndex = simpleHash(animalSeed, ANIMALS.length);
  // Revert to 3 digits: 100-999
  const numericSuffix = (simpleHash(numSeed, 900) + 100).toString();

  return `${COLORS[colorIndex]}${ANIMALS[animalIndex]}${numericSuffix}`;
};


export const getInitials = (name: string | undefined | null): string => {
    if (!name || typeof name !== 'string' || name.trim() === '') return '?';
    
    const nameToProcess = name.startsWith('@') ? name.substring(1) : name;

    // Regex for ColorAnimalNumber format (e.g., BlueWhale123, RedFox45)
    // Updated to expect exactly 3 digits.
    const pseudonymRegex = /^[A-Z][a-z]+([A-Z][a-zA-Z]*)[0-9]{3}$/;
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
