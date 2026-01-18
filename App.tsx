import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Chatbot } from './components/Chatbot';
import { Landing } from './pages/Landing';
import { Signup } from './pages/Signup';
import { RoomCard } from './components/RoomCard';
import { MissionVision } from './components/MissionVision';
import { BookingPage } from './pages/Booking';
import { ConfirmationPage } from './pages/Confirmation';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { ROOMS, getUser, logoutUser, saveBooking, User, Booking } from './lib/store';
import { ThemeProvider } from './lib/theme';
import { Toaster, toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('home');
  const [user, setUser] = useState<User | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [filteredRoomId, setFilteredRoomId] = useState<string | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    setCurrentPage('home');
    toast.success('Welcome back.');
  };

  const handleSignup = (newUser: User) => {
    setUser(newUser);
    setCurrentPage('home');
    toast.success('Account created successfully.');
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setCurrentPage('home');
    toast('Signed out.');
  };

  const handleBook = (roomId: string) => {
    if (!user) {
      toast.error('Please sign in to reserve.');
      setCurrentPage('login');
      return;
    }
    setSelectedRoomId(roomId);
    setCurrentPage('booking');
  };

  const handleBookingConfirm = (hash: string, date: string, total: number) => {
    if (!user || !selectedRoomId) return;

    const newBooking: Booking = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      roomId: selectedRoomId,
      userId: user.id,
      date,
      nights: Math.round(total / (ROOMS.find(r => r.id === selectedRoomId)?.price || 1)),
      totalPrice: total,
      status: 'confirmed',
      txHash: hash,
      timestamp: new Date().toISOString(),
    };

    saveBooking(newBooking);
    setCurrentBooking(newBooking);
    setCurrentPage('confirmation');
    toast.success('Reservation Confirmed');
  };

  const handleAiRecommend = (type: string) => {
    const recommendedRoom = ROOMS.find(r => r.type === type);
    if (recommendedRoom) {
      setFilteredRoomId(recommendedRoom.id);
      setCurrentPage('rooms');
      toast.success(`We recommend the ${recommendedRoom.name}`);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <Landing 
            rooms={ROOMS} 
            onBook={handleBook} 
            onViewAllRooms={() => setCurrentPage('rooms')} 
          />
        );
      case 'rooms':
        return (
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 pt-32">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-serif text-[#0A2342] dark:text-[#F9F7F2] mb-4">Accommodations</h2>
              <div className="w-12 h-0.5 bg-[#D4AF37] mx-auto"></div>
            </div>
            
            {filteredRoomId && (
              <div className="mb-12 p-6 bg-[#D4AF37]/10 border border-[#D4AF37] text-center">
                <p className="text-[#0A2342] dark:text-[#F9F7F2] font-medium mb-2">Recommended for you</p>
                <button onClick={() => setFilteredRoomId(null)} className="text-xs uppercase underline text-[#0A2342]/60 dark:text-[#F9F7F2]/60">Clear Filter</button>
              </div>
            )}
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
              {ROOMS.map(room => (
                <div key={room.id} className={`${filteredRoomId === room.id ? 'ring-2 ring-[#D4AF37] offset-4' : ''}`}>
                  <RoomCard room={room} onBook={handleBook} />
                </div>
              ))}
            </div>
          </div>
        );
      case 'login':
        return <Login onLogin={handleLogin} onNavigateToSignup={() => setCurrentPage('signup')} />;
      case 'signup':
        return <Signup onSignup={handleSignup} onNavigateToLogin={() => setCurrentPage('login')} />;
      case 'dashboard':
        return <div className="pt-24">{user && <Dashboard user={user} />}</div>;
      case 'booking':
        const room = ROOMS.find(r => r.id === selectedRoomId);
        return <div className="pt-24">{room && <BookingPage room={room} onConfirm={handleBookingConfirm} onCancel={() => setCurrentPage('rooms')} />}</div>;
      case 'confirmation':
        return <div className="pt-24">{currentBooking && <ConfirmationPage booking={currentBooking} onDashboard={() => setCurrentPage('dashboard')} />}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0A2342] text-[#0A2342] dark:text-[#F9F7F2] font-sans selection:bg-[#D4AF37] selection:text-[#0A2342] transition-colors duration-300">
      <Navbar user={user} onNavigate={setCurrentPage} currentPage={currentPage} onLogout={handleLogout} />
      {renderPage()}
      <Chatbot onRecommend={handleAiRecommend} />
      <Toaster 
        theme="system" 
        position="top-center"
        toastOptions={{
          style: {
            background: '#0A2342',
            color: '#F9F7F2',
            border: '1px solid #D4AF37',
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
