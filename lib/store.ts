export interface Room {
  id: string;
  name: string;
  type: 'standard' | 'deluxe' | 'suite' | 'villa' | 'cabin';
  price: number;
  image: string;
  description: string;
  amenities: string[];
  maxGuests: number;
}

export const ROOMS: Room[] = [
  {
    id: '1',
    name: 'Serenity Standard',
    type: 'standard',
    price: 150,
    image: 'https://images.unsplash.com/photo-1763419161907-1e00b2f883c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'A minimalist retreat designed for peace of mind. Features natural light and organic textures.',
    amenities: ['Queen Bed', 'Rain Shower', 'Garden View', 'Wi-Fi'],
    maxGuests: 2,
  },
  {
    id: '2',
    name: 'Horizon Deluxe',
    type: 'deluxe',
    price: 280,
    image: 'https://images.unsplash.com/photo-1758448511255-ac2a24a135d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'Spacious elegance with panoramic windows overlooking the landscape. Includes a private workspace.',
    amenities: ['King Bed', 'Soaking Tub', 'Work Desk', 'Balcony', 'Minibar'],
    maxGuests: 2,
  },
  {
    id: '3',
    name: 'Aurora Royal Suite',
    type: 'suite',
    price: 550,
    image: 'https://images.unsplash.com/photo-1653151248308-14baf1a224eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'The pinnacle of luxury. Private terrace, dedicated lounge area, and premium concierge service.',
    amenities: ['Private Terrace', 'Lounge', 'Butler Service', 'Jacuzzi', 'Welcome Gift'],
    maxGuests: 4,
  },
  {
    id: '4',
    name: 'Lakeside Villa',
    type: 'villa',
    price: 850,
    image: 'https://images.unsplash.com/photo-1761240960690-4d2cd3c93911?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsYWtlc2lkZSUyMHZpbGxhJTIwYXJjaGl0ZWN0dXJlfGVufDF8fHx8MTc2ODc2MTk3M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Exclusive villa on the water’s edge. Features a private dock and floor-to-ceiling glass walls.',
    amenities: ['Private Dock', 'Infinity Edge', 'Full Kitchen', 'Master Suite', 'Fireplace'],
    maxGuests: 6,
  },
  {
    id: '5',
    name: 'Forest Cabin',
    type: 'cabin',
    price: 320,
    image: 'https://images.unsplash.com/photo-1736796310381-d5c82ce99826?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmb3Jlc3QlMjBjYWJpbiUyMGludGVyaW9yJTIwbWluaW1hbGlzdHxlbnwxfHx8fDE3Njg3NjE5NzN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Secluded luxury amidst the trees. Sustainable design with a wood-burning stove and skylights.',
    amenities: ['Wood Stove', 'Skylights', 'Forest View', 'Outdoor Deck', 'Rain Shower'],
    maxGuests: 2,
  },
  {
    id: '6',
    name: 'Aurora Penthouse',
    type: 'suite',
    price: 1200,
    image: 'https://images.unsplash.com/photo-1682662046610-fbdb3db4bd74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBwZW50aG91c2UlMjBzdWl0ZSUyMGxpdmluZyUyMHJvb218ZW58MXx8fHwxNzY4NzYxOTczfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'The ultimate urban sanctuary atop the hotel. 360-degree views, private elevator, and chef’s kitchen.',
    amenities: ['Private Elevator', 'Chef Kitchen', '360 Views', 'Grand Piano', 'Personal Spa'],
    maxGuests: 4,
  },
];

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  date: string;
  nights: number;
  totalPrice: number;
  status: 'confirmed';
  txHash: string;
  timestamp: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

// In-memory simulated storage
export const getBookings = (): Booking[] => {
  try {
    const stored = localStorage.getItem('aurora_bookings');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveBooking = (booking: Booking) => {
  const bookings = getBookings();
  bookings.push(booking);
  localStorage.setItem('aurora_bookings', JSON.stringify(bookings));
};

export const getUser = (): User | null => {
  try {
    const stored = localStorage.getItem('aurora_user');
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

export const loginUser = (email: string, name: string) => {
  const user = { id: 'u_' + Math.random().toString(36).substr(2, 9), email, name };
  localStorage.setItem('aurora_user', JSON.stringify(user));
  return user;
};

export const registerUser = (email: string, name: string) => {
  return loginUser(email, name);
};

export const logoutUser = () => {
  localStorage.removeItem('aurora_user');
};
