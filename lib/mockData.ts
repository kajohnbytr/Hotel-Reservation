export interface Hotel {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  description: string;
  amenities: string[];
  aiTag?: string; // e.g. "Best for Couples", "Top Pick"
}

export const HOTELS: Hotel[] = [
  {
    id: "1",
    name: "Aurora Borealis Lodge",
    location: "Reykjavik, Iceland",
    price: 450,
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1715535384818-8e673eb3a620?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description: "Experience the magic of the Northern Lights from your private glass igloo. Features heated floors, premium bedding, and unobstructed views of the night sky.",
    amenities: ["Northern Lights View", "Spa", "Free WiFi", "Breakfast Included"],
    aiTag: "Top Rated for Views"
  },
  {
    id: "2",
    name: "Urban Zenith Hotel",
    location: "Tokyo, Japan",
    price: 320,
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1694595437436-2ccf5a95591f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description: "A sleek modern sanctuary in the heart of Shibuya. Enjoy cutting-edge technology, soundproof rooms, and a rooftop bar with panoramic city views.",
    amenities: ["Rooftop Bar", "Gym", "Smart Room Controls", "Concierge"],
    aiTag: "Best for Business"
  },
  {
    id: "3",
    name: "Serenity Coastal Resort",
    location: "Maldives",
    price: 850,
    rating: 5.0,
    image: "https://images.unsplash.com/photo-1765439178218-e54dcbb64bcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description: "Overwater bungalows with direct ocean access. The ultimate luxury escape with private infinity pools and personal butler service.",
    amenities: ["Private Pool", "Spa", "Water Sports", "All Inclusive"],
    aiTag: "Honeymoon Favorite"
  },
  {
    id: "4",
    name: "The Grand Historic",
    location: "Vienna, Austria",
    price: 280,
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1723465302725-ff46b3e165f9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description: "Step back in time with modern comforts. Located in a 19th-century palace, offering crystal chandeliers, velvet furnishings, and classic Austrian hospitality.",
    amenities: ["Restaurant", "Bar", "Museum Nearby", "Valet Parking"],
  },
  {
    id: "5",
    name: "Nordic Minimalist Stay",
    location: "Copenhagen, Denmark",
    price: 210,
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1766928210443-0be92ed5884a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description: "Clean lines, natural wood, and cozy hygge vibes. A perfect base for design lovers exploring the city.",
    amenities: ["Bike Rental", "Coffee Shop", "Co-working Space", "Pet Friendly"],
    aiTag: "Best Value"
  },
  {
    id: "6",
    name: "Alpine Heights Retreat",
    location: "Swiss Alps",
    price: 550,
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1765439178218-e54dcbb64bcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", // Reusing luxury exterior
    description: "Ski-in/ski-out luxury chalet with roaring fireplaces and gourmet dining. Perfect for winter sports enthusiasts.",
    amenities: ["Ski Access", "Sauna", "Fireplace", "Fine Dining"],
  }
];

export interface Booking {
  id: string;
  hotelId: string;
  date: string;
  guests: number;
  totalPrice: number;
  blockchainHash: string;
  timestamp: string;
}
