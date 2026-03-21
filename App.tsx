import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Navbar } from './components/Navbar';
import { Chatbot } from './components/Chatbot';
import { Landing } from './pages/Landing';
import { Signup } from './pages/Signup';
import { VerifyEmail } from './pages/VerifyEmail';
import StaffLogin from './pages/StaffLoginPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ReceptionDesk from './pages/ReceptionDesk';
import { RoomCard } from './components/RoomCard';
import { MissionVision } from './components/MissionVision';
import { BookingPage } from './pages/Booking';
import { ConfirmationPage } from './pages/Confirmation';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { ROOMS, getUser, logoutUser, User, Booking, mapApiRoomToRoom, Room, ApiRoom, isSessionExpired } from './lib/store';
import { getApiBaseUrl } from './lib/api';
import { getAuthItem, setAuthItem } from './lib/authSession';
import { ThemeProvider } from './lib/theme';
import { Toaster, toast } from 'sonner';
import { ArrowRight } from 'lucide-react';

const API_BASE = getApiBaseUrl();

// import StaffDashboard from "./pages/StaffDashboard"; // This line is being removed

function AppContent() {
  const [currentPage, setCurrentPage] = useState('home');
  const [user, setUser] = useState<User | null>(null);
  const [adminSetupRequired, setAdminSetupRequired] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [filteredRoomId, setFilteredRoomId] = useState<string | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>(ROOMS);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');
  const [pendingVerifyToken, setPendingVerifyToken] = useState('');
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const INACTIVITY_MINUTES = 5;
  const INACTIVITY_MS = INACTIVITY_MINUTES * 60 * 1000;

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const startInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    if (!user) return;
    inactivityTimerRef.current = setTimeout(async () => {
      inactivityTimerRef.current = null;
      await logoutUser();
      setUser(null);
      setCurrentPage('home');
      toast('Logged out due to inactivity.');
    }, INACTIVITY_MS);
  }, [user, clearInactivityTimer]);

  useEffect(() => {
    if (!user) {
      clearInactivityTimer();
      return;
    }
    startInactivityTimer();
    const resetTimer = () => startInactivityTimer();
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      clearInactivityTimer();
    };
  }, [user, startInactivityTimer, clearInactivityTimer]);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rooms`);
      if (res.ok) {
        const data: ApiRoom[] = await res.json();
        const mapped = (Array.isArray(data) ? data : []).map(mapApiRoomToRoom);
        // Use DB rooms whenever available so room IDs match backend expectations.
        if (mapped.length > 0) {
          setRooms(mapped);
        } else {
          setRooms(ROOMS);
        }
      }
    } catch {
      // keep current rooms (ROOMS or previously fetched)
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // If user is staff/admin, validate session with API; on 401 clear session so they must re-login
  useEffect(() => {
    if (!user || (user.role !== 'staff' && user.role !== 'admin')) return;
    const token = getAuthItem('aurora_token');
    if (!token) return;
    const controller = new AbortController();
    fetch(`${API_BASE}/api/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).then(async (res) => {
      if (res.status === 401) {
        await logoutUser();
        setUser(null);
        setCurrentPage('home');
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    // Deep link support: /login/admin and /login/staff open the correct login screen
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/login/admin') {
        setCurrentPage('admin-login');
      } else if (path === '/login/staff') {
        setCurrentPage('staff-login');
      } else if (path === '/verify-email') {
        const urlToken = new URLSearchParams(window.location.search).get('token');
        setPendingVerifyToken(urlToken || '');
        setCurrentPage('verify-email');
      } else {
        setPendingVerifyToken('');
      }
    }

    const storedUser = getUser();
    if (storedUser && isSessionExpired()) {
      (async () => {
        await logoutUser();
      })();
      return;
    }
    if (storedUser) {
      setUser(storedUser);
      if (storedUser.role === 'staff') {
        setCurrentPage('reception');
      } else if (storedUser.role === 'admin') {
        setCurrentPage('admin-dashboard');
      }
    }
  }, []);

  // If no admin exists, force-logout anyone and block normal auth flows.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/admin-exists`);
        const data = await res.json().catch(() => ({}));
        const adminExists = !!data.adminExists;
        if (cancelled) return;
        setAdminSetupRequired(!adminExists);
        if (!adminExists) {
          const hasSession = !!getAuthItem('aurora_user') || !!getAuthItem('aurora_token');
          if (hasSession) {
            await logoutUser();
            if (cancelled) return;
            setUser(null);
            setCurrentPage('login');
            toast.error('System setup required: no admin account exists yet.');
          } else if (currentPage !== 'login') {
            setCurrentPage('login');
          }
        }
      } catch {
        // If the check fails, don't block usage.
        if (!cancelled) setAdminSetupRequired(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep URL in sync: /login/staff and /login/admin only when on those pages; otherwise reset to /
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentPage === 'staff-login') {
      if (window.location.pathname !== '/login/staff') window.history.replaceState(null, '', '/login/staff');
    } else if (currentPage === 'admin-login') {
      if (window.location.pathname !== '/login/admin') window.history.replaceState(null, '', '/login/admin');
    } else if (currentPage === 'verify-email') {
      // keep token in URL — do not reset
    } else if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  }, [currentPage]);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    if (newUser.role === 'staff') {
      setCurrentPage('reception');
      toast.success('Welcome back, staff.');
    } else if (newUser.role === 'admin') {
      setCurrentPage('admin-dashboard');
      toast.success('Welcome back, admin.');
    } else {
      setCurrentPage('home');
      toast.success('Welcome back.');
    }
  };

  const handleSignup = (email: string) => {
    setPendingVerifyEmail(email);
    setPendingVerifyToken('');
    setCurrentPage('verify-email');
  };

  const handleLogoutConfirm = async () => {
    await logoutUser();
    setUser(null);
    setCurrentPage('home');
    toast('Signed out.');
    setIsLogoutConfirmOpen(false);
  };

  const handleLogoutRequest = () => {
    setIsLogoutConfirmOpen(true);
  };

  const handleLogoutCancel = () => {
    setIsLogoutConfirmOpen(false);
  };

  const handleBook = (roomId: string) => {
    if (!user) {
      toast.error('Please sign in to reserve.');
      setCurrentPage('login');
      return;
    }

    if (user.role === 'staff' || user.role === 'admin') {
      toast.error('Only guest accounts can create reservations.');
      setCurrentPage(user.role === 'staff' ? 'reception' : 'admin-dashboard');
      return;
    }

    const room = rooms.find((r) => r.id === roomId);
    const isMongoId = /^[a-fA-F0-9]{24}$/.test(roomId);
    if (!room || !isMongoId) {
      toast.error('Selected room is not available for booking yet. Please refresh and choose an available room.');
      fetchRooms();
      setCurrentPage('rooms');
      return;
    }

    setSelectedRoomId(roomId);
    setCurrentPage('booking');
  };

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = getAuthItem('aurora_refresh_token');
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE}/api/users/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      const newToken = typeof data.token === 'string' ? data.token : null;
      if (newToken) {
        setAuthItem('aurora_token', newToken);
        return newToken;
      }
    } catch {
      return null;
    }

    return null;
  }, []);

  const handleBookingConfirm = async (
    _hash: string,
    checkIn: string,
    checkOut: string,
    nights: number,
    guests: number,
    total: number
  ) => {
    if (!user || !selectedRoomId) return false;

    let token = getAuthItem('aurora_token');
    const room = rooms.find((r) => r.id === selectedRoomId);

    if (!token) {
      token = await refreshAccessToken();
      if (!token) {
        toast.error('You are not logged in. Please sign in again.');
        return false;
      }
    }

    if (!room) {
      toast.error('Selected room was not found. Please choose a room again.');
      setCurrentPage('rooms');
      return false;
    }

    try {
      const submitBooking = async (accessToken: string) =>
        fetch(`${API_BASE}/api/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            guestName: user.name,
            roomId: selectedRoomId,
            roomName: room.name,
            checkIn,
            checkOut,
            nights,
            guests: guests || 1,
            total,
          }),
        });

      let res = await submitBooking(token);

      // Access token expired during booking flow; refresh and retry once.
      if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          token = refreshed;
          res = await submitBooking(token);
        }
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || 'Could not save reservation to server.');
        return false;
      }

      const newBooking: Booking = {
        id: data.id,
        roomId: data.roomId,
        userId: user.id,
        date: data.checkIn,
        nights: data.nights,
        totalPrice: data.total,
        status: data.status === 'confirmed' ? 'confirmed' : 'pending',
        txHash: data.txHash || '',
        timestamp: new Date().toISOString(),
      };

      setCurrentBooking(newBooking);
      setCurrentPage('confirmation');
      toast.success(newBooking.status === 'pending' ? 'Reservation submitted for staff approval' : 'Reservation confirmed');
      return true;
    } catch {
      toast.error('Could not save reservation to server.');
      return false;
    }
  };

  const handleRoomUpdated = (updated: Room) => {
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleAiRecommend = (type: string) => {
    const recommendedRoom = rooms.find(r => r.type === type);
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
            rooms={rooms} 
            onBook={handleBook} 
            onViewAllRooms={() => setCurrentPage('rooms')}
            viewerRole={user?.role}
            onNavigateToStaffLogin={() => setCurrentPage('staff-login')}
            onNavigateToReception={() => setCurrentPage('reception')}
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
              {rooms.map(room => (
                <div key={room.id} className={`${filteredRoomId === room.id ? 'ring-2 ring-[#D4AF37] offset-4' : ''}`}>
                  <RoomCard
                    room={room}
                    onBook={handleBook}
                    adminMode={user?.role === 'admin' || user?.role === 'staff'}
                    onRoomUpdated={handleRoomUpdated}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      case 'login':
        return (
          <Login
            onLogin={handleLogin}
            onNavigateToSignup={() => setCurrentPage('signup')}
            onNavigateToVerify={(email) => {
              setPendingVerifyEmail(email);
              setPendingVerifyToken('');
              setCurrentPage('verify-email');
            }}
          />
        );
      case 'signup':
        return <Signup onSignup={handleSignup} onNavigateToLogin={() => setCurrentPage('login')} />;
      case 'verify-email':
        return (
          <VerifyEmail
            pendingEmail={pendingVerifyEmail}
            verifyToken={pendingVerifyToken}
            onNavigateToLogin={() => {
              setPendingVerifyToken('');
              setCurrentPage('login');
            }}
          />
        );
      case 'staff-login':
        return (
          <StaffLogin
            onLogin={handleLogin}
            onNavigateToHome={() => setCurrentPage('home')}
            onNavigate={setCurrentPage}
          />
        );
      case 'admin-login':
        return (
          <AdminLogin
            onLogin={handleLogin}
            onNavigateToHome={() => setCurrentPage('home')}
            onNavigate={setCurrentPage}
          />
        );
      case 'reception':
        return user && user.role === 'staff'
          ? <ReceptionDesk rooms={rooms} />
          : <div className="pt-24"><Dashboard user={user} rooms={rooms} /></div>;
      case 'admin-dashboard':
        return <div className="pt-24"><AdminDashboard rooms={rooms} onRoomsUpdated={fetchRooms} /></div>;
      case 'dashboard':
        return <div className="pt-24"><Dashboard user={user} rooms={rooms} /></div>;
      case 'booking':
        const room = rooms.find(r => r.id === selectedRoomId);
        return <div className="pt-24">{room && <BookingPage room={room} onConfirm={handleBookingConfirm} onCancel={() => setCurrentPage('rooms')} />}</div>;
      case 'confirmation':
        return <div className="pt-24">{currentBooking && <ConfirmationPage booking={currentBooking} rooms={rooms} onDashboard={() => setCurrentPage('dashboard')} />}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#0A2342] text-[#0A2342] dark:text-[#F9F7F2] font-sans selection:bg-[#D4AF37] selection:text-[#0A2342] transition-colors duration-300">
      <Navbar user={user} onNavigate={setCurrentPage} currentPage={currentPage} onLogout={handleLogoutRequest} />
      {isLogoutConfirmOpen &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center px-4"
            style={{
              zIndex: 2147483647,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            onClick={handleLogoutCancel}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#D4AF37]/40 p-6 text-center shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-[#0A2342] dark:text-[#F9F7F2]">
                Confirm logout
              </h3>
              <p className="mt-2 text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70">
                Are you sure you want to log out of your account?
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleLogoutCancel}
                  className="px-5 py-2 text-xs font-bold text-[#0A2342] dark:text-[#F9F7F2] border border-[#0A2342]/60 dark:border-[#F9F7F2]/60 hover:bg-[#0A2342] hover:text-[#F9F7F2] dark:hover:bg-[#F9F7F2] dark:hover:text-[#0A2342] transition-colors uppercase tracking-widest rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogoutConfirm}
                  className="px-5 py-2 text-xs font-bold text-[#F9F7F2] bg-[#0A2342] hover:bg-[#D4AF37] hover:text-[#0A2342] dark:bg-[#F9F7F2] dark:text-[#0A2342] dark:hover:bg-[#D4AF37] transition-colors uppercase tracking-widest rounded-lg"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {renderPage()}
      {(!user || user.role === 'guest') && currentPage !== 'staff-login' && currentPage !== 'admin-login' && (
        <Chatbot onRecommend={handleAiRecommend} />
      )}
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
