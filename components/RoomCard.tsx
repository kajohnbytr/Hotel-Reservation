import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, Users } from 'lucide-react';
import { getApiBaseUrl } from '../lib/api';
import { Room } from '../lib/store';
import { getAuthItem } from '../lib/authSession';

const API_BASE = getApiBaseUrl();
const MAX_GUESTS_LIMIT = 20;
const MAX_PRICE_PER_NIGHT = 50000;

export function RoomCard({
  room,
  onBook,
  adminMode = false,
  detailsOnly = false,
  onRoomUpdated,
}: {
  room: Room;
  onBook: (id: string) => void;
  adminMode?: boolean;
  detailsOnly?: boolean;
  onRoomUpdated?: (updated: Room) => void;
}) {
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(room.name);
  const [editType, setEditType] = useState(room.type);
  const [editPrice, setEditPrice] = useState(String(room.price));
  const [editMaxGuests, setEditMaxGuests] = useState(String(room.maxGuests));
  const [editDescription, setEditDescription] = useState(room.description);
  const [editImage, setEditImage] = useState(room.image);
  const [editAmenities, setEditAmenities] = useState(room.amenities.join(', '));
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    const shouldLock = isImageOpen || isDetailsOpen;
    if (!shouldLock) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isImageOpen, isDetailsOpen]);

  return (
    <motion.div
      whileHover={isDetailsOpen || isImageOpen ? undefined : { y: -5 }}
      className="bg-[#0A2342] dark:bg-[#153a66] text-[#F9F7F2] rounded-2xl overflow-hidden shadow-xl flex flex-col h-full transition-colors duration-300"
    >
      <div className="relative h-64 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsImageOpen(true)}
          className="block w-full h-full cursor-pointer"
          aria-label={`View ${room.name} photo`}
        >
          <img
            src={room.image}
            alt={room.name}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105 opacity-90 hover:opacity-100"
          />
        </button>
        <div className="absolute top-4 right-4 z-10 bg-[#D4AF37] text-[#0A2342] px-3 py-1 text-sm font-bold tracking-wider uppercase">
          ₱{room.price} / Night
        </div>
      </div>
      
      <div className="p-8 flex flex-col flex-1">
        <h3 className="text-2xl font-serif mb-2 text-[#D4AF37]">{room.name}</h3>
        <p className="text-[#F9F7F2]/70 text-sm leading-relaxed mb-6">{room.description}</p>
        
        <div className="space-y-3 mb-8 flex-1">
          {room.amenities.slice(0, 4).map((amenity, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-[#F9F7F2]/90">
              <Check className="w-3 h-3 text-[#D4AF37]" />
              <span className="tracking-wide uppercase text-xs">{amenity}</span>
            </div>
          ))}
        </div>

        {adminMode ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                setEditName(room.name);
                setEditType(room.type);
                setEditPrice(String(room.price));
                setEditMaxGuests(String(room.maxGuests));
                setEditDescription(room.description);
                setEditImage(room.image);
                setEditAmenities(room.amenities.join(', '));
                setEditError('');
                setIsEditOpen(true);
              }}
              className="w-full py-4 bg-[#D4AF37] text-[#0A2342] hover:bg-[#e6c55b] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg"
            >
              Edit details
            </button>
          </div>
        ) : detailsOnly ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setIsDetailsOpen(true)}
              className="w-full py-4 border border-[#F9F7F2]/20 text-[#F9F7F2] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg"
            >
              Details
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setIsDetailsOpen(true)}
              className="py-4 border border-[#F9F7F2]/20 text-[#F9F7F2] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg"
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => onBook(room.id)}
              className="py-4 bg-[#D4AF37] text-[#0A2342] hover:bg-[#e6c55b] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg"
            >
              Reserve
            </button>
          </div>
        )}
      </div>

      {isImageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-10"
          onClick={() => setIsImageOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsImageOpen(false)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
              aria-label="Close image"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={room.image}
              alt={room.name}
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {isDetailsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A2342]/70 backdrop-blur-md px-6 py-10"
          onClick={() => setIsDetailsOpen(false)}
        >
          <div
            className="relative w-[900px] max-w-[90vw] h-[500px] bg-[#F9F7F2] dark:bg-[#0A2342] text-[#0A2342] dark:text-[#F9F7F2] rounded-xl shadow-2xl border border-[#D4AF37]/30 overflow-hidden"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute top-4 right-4">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="p-2 rounded-full border border-[#0A2342]/10 dark:border-[#F9F7F2]/20 text-[#0A2342]/60 dark:text-[#F9F7F2]/70 hover:text-[#0A2342] dark:hover:text-[#F9F7F2] hover:bg-[#0A2342]/5 dark:hover:bg-[#F9F7F2]/10 transition-colors"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-0">
              <div className="h-72 md:h-full">
                <img
                  src={room.image}
                  alt={room.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <div className="p-8 border-b border-[#0A2342]/10 dark:border-[#F9F7F2]/10">
                  <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                    {room.type} Collection
                  </p>
                  <h4 className="text-2xl font-serif mt-1">{room.name}</h4>
                </div>
                <div className="p-8 flex-1 space-y-6">
                  <div className="flex items-center gap-6 text-sm text-[#0A2342]/70 dark:text-[#F9F7F2]/70">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#D4AF37]" />
                      {room.maxGuests} Guests
                    </div>
                    <span className="text-[#0A2342]/30 dark:text-[#F9F7F2]/30">|</span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-[#D4AF37] text-[10px] text-[#D4AF37]">
                        ☐
                      </span>
                      450 sq ft
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#0A2342]/50 dark:text-[#F9F7F2]/60 font-semibold">
                      About this room
                    </p>
                    <p className="text-sm mt-3 text-[#0A2342]/80 dark:text-[#F9F7F2]/90 leading-relaxed">
                      {room.description}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#0A2342]/50 dark:text-[#F9F7F2]/60 font-semibold mb-3">
                      Amenities
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm text-[#0A2342]/80 dark:text-[#F9F7F2]/90">
                      {room.amenities.map((amenity, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
                          {amenity}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#0A2342]/10 dark:border-[#F9F7F2]/10 p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#0A2342]/50 dark:text-[#F9F7F2]/60 font-semibold">
                      Price per night
                    </p>
                    <p className="text-2xl font-semibold text-[#D4AF37]">₱{room.price}</p>
                  </div>
                  {adminMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditName(room.name);
                        setEditType(room.type);
                        setEditPrice(String(room.price));
                        setEditMaxGuests(String(room.maxGuests));
                        setEditDescription(room.description);
                        setEditImage(room.image);
                        setEditAmenities(room.amenities.join(', '));
                        setEditError('');
                        setIsEditOpen(true);
                      }}
                      className="px-6 py-3 bg-[#D4AF37] text-[#0A2342] hover:bg-[#e6c55b] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg"
                    >
                      Edit details
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onBook(room.id)}
                      className="px-6 py-3 bg-[#0A2342] dark:bg-[#D4AF37] text-[#F9F7F2] dark:text-[#0A2342] hover:bg-[#153a66] dark:hover:bg-[#C99E2E] transition-colors uppercase tracking-widest text-xs font-bold rounded-lg"
                    >
                      Reserve Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {adminMode && isEditOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => !editSaving && setIsEditOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[#F9F7F2] dark:bg-[#0A2342] border border-[#D4AF37]/40 rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif text-[#0A2342] dark:text-[#F9F7F2]">
                Edit room details
              </h3>
              <button
                type="button"
                onClick={() => !editSaving && setIsEditOpen(false)}
                className="text-[#0A2342]/60 dark:text-[#F9F7F2]/60 hover:text-[#D4AF37]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setEditError('');
                const token = getAuthItem('aurora_token');
                if (!token) {
                  setEditError('You are not authorized to edit rooms.');
                  return;
                }

                const parsedPricePerNight = Number(editPrice);
                const parsedMaxGuests = Number(editMaxGuests);

                if (!Number.isFinite(parsedPricePerNight) || parsedPricePerNight <= 0 || parsedPricePerNight > MAX_PRICE_PER_NIGHT) {
                  setEditError(`Price per night must be greater than 0 and not more than ${MAX_PRICE_PER_NIGHT}.`);
                  return;
                }

                if (!Number.isInteger(parsedMaxGuests) || parsedMaxGuests < 1 || parsedMaxGuests > MAX_GUESTS_LIMIT) {
                  setEditError(`Max guests must be a whole number between 1 and ${MAX_GUESTS_LIMIT}.`);
                  return;
                }

                setEditSaving(true);
                try {
                  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(room.id)}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      name: editName,
                      type: editType,
                      pricePerNight: parsedPricePerNight,
                      maxGuests: parsedMaxGuests,
                      description: editDescription,
                      imageUrl: editImage,
                      amenities: editAmenities
                        .split(',')
                        .map((a) => a.trim())
                        .filter(Boolean),
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setEditError(data.message || 'Failed to update room.');
                    setEditSaving(false);
                    return;
                  }

                  const updated: Room = {
                    ...room,
                    name: editName,
                    type: editType as Room['type'],
                    price: parsedPricePerNight,
                    maxGuests: parsedMaxGuests,
                    description: editDescription,
                    image: editImage,
                    amenities: editAmenities
                      .split(',')
                      .map((a) => a.trim())
                      .filter(Boolean),
                  };
                  onRoomUpdated?.(updated);
                  setIsEditOpen(false);
                  setEditSaving(false);
                } catch (err) {
                  console.error('Update room error:', err);
                  setEditError('Failed to update room. Please try again.');
                  setEditSaving(false);
                }
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest mb-1">
                    Name
                  </label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] px-3 py-2 text-sm text-[#0A2342] dark:text-[#F9F7F2]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest mb-1">
                    Type
                  </label>
                  <input
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as Room['type'])}
                    className="w-full rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] px-3 py-2 text-sm text-[#0A2342] dark:text-[#F9F7F2]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest mb-1">
                    Price per night (₱)
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    max={MAX_PRICE_PER_NIGHT}
                    step={0.01}
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] px-3 py-2 text-sm text-[#0A2342] dark:text-[#F9F7F2]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest mb-1">
                    Max guests
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_GUESTS_LIMIT}
                    step={1}
                    value={editMaxGuests}
                    onChange={(e) => setEditMaxGuests(e.target.value)}
                    className="w-full rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] px-3 py-2 text-sm text-[#0A2342] dark:text-[#F9F7F2]"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest mb-1">
                  Image URL
                </label>
                <input
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  className="w-full rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] px-3 py-2 text-sm text-[#0A2342] dark:text-[#F9F7F2]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] px-3 py-2 text-sm text-[#0A2342] dark:text-[#F9F7F2]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A2342] dark:text-[#F9F7F2] uppercase tracking-widest mb-1">
                  Amenities (comma separated)
                </label>
                <input
                  value={editAmenities}
                  onChange={(e) => setEditAmenities(e.target.value)}
                  className="w-full rounded-lg border border-[#0A2342]/20 dark:border-[#F9F7F2]/20 bg-white dark:bg-[#05152a] px-3 py-2 text-sm text-[#0A2342] dark:text-[#F9F7F2]"
                />
              </div>
              {editError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {editError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !editSaving && setIsEditOpen(false)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#0A2342]/30 dark:border-[#F9F7F2]/30 text-[#0A2342] dark:text-[#F9F7F2] hover:bg-[#0A2342]/5 dark:hover:bg-[#F9F7F2]/10"
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#0A2342] text-[#F9F7F2] hover:bg-[#153a66] disabled:opacity-70"
                >
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
