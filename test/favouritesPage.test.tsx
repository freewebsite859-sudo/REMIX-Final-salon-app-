/**
 * Favourites page (`/customer/favourites`) — favourite salons, favourite staff,
 * favourite services, remove favourite, book again, and view profile.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Salon, SalonService, Stylist, SavedServiceRef, SavedStaffRef } from '../src/types.ts';
import { SavedTab } from '../src/components/SavedTab.tsx';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    passed++;
  } else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

const mockStylistA: Stylist = {
  id: 'stylist-aarav',
  name: 'Aarav Sharma',
  role: 'Senior Hair Specialist & Art Director',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  rating: 4.95,
  experience: '7 years exp',
  specialty: ['Fade Cuts', 'Texture Layers', 'Keratin Treatment'],
};

const mockServiceA: SalonService = {
  id: 'srv-101',
  name: 'Signature Hair Cut & Styling',
  category: 'hair',
  duration: 45,
  price: 499,
  discountPrice: 399,
  description: 'Precision haircut with organic scalp massage and Dyson blow dry styling.',
};

const mockSalons: Salon[] = [
  {
    id: 'salon-1',
    name: 'Scissors & Shears Salon',
    tagline: 'Precision haircuts & contemporary styling',
    categories: ['Hair Cut', 'Styling', 'Unisex'],
    rating: 4.9,
    reviewCount: 310,
    distance: '0.8 km',
    location: {
      area: 'Mansarovar',
      city: 'Jaipur',
      address: 'Plot 42, Madhyam Marg, Mansarovar, Jaipur',
      latitude: 26.8533,
      longitude: 75.7681,
    },
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500',
    gallery: [],
    isOpen: true,
    openingHours: '9:00 AM - 9:00 PM',
    priceRange: '₹₹',
    services: [mockServiceA],
    stylists: [mockStylistA],
    reviews: [],
    amenities: ['AC', 'Free Wi-Fi'],
    gender: 'unisex',
  },
  {
    id: 'salon-2',
    name: 'Luxe Beauty Lounge',
    tagline: 'Hydra facials & premium dermatology care',
    categories: ['Skin Care', 'Facial', 'Bridal'],
    rating: 4.95,
    reviewCount: 195,
    distance: '1.6 km',
    location: {
      area: 'C-Scheme',
      city: 'Jaipur',
      address: 'Plot 18, Subhash Marg, C-Scheme, Jaipur',
      latitude: 26.9124,
      longitude: 75.8035,
    },
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500',
    gallery: [],
    isOpen: true,
    openingHours: '10:00 AM - 8:30 PM',
    priceRange: '₹₹₹',
    services: [
      {
        id: 'srv-201',
        name: 'Hydra Facial Deluxe',
        category: 'skin',
        duration: 60,
        price: 1800,
        discountPrice: 1499,
        description: 'Multi-step skin hydration treatment with ultrasonic exfoliation.',
      },
    ],
    stylists: [
      {
        id: 'stylist-ananya',
        name: 'Dr. Ananya Sen',
        role: 'Senior Aesthetician & Skin Expert',
        avatar: 'https://images.unsplash.com/photo-1594824813590-7988a2a4bdf6?auto=format&fit=crop&w=300&q=80',
        rating: 4.96,
        experience: '9 years exp',
        specialty: ['Hydra Facial', 'Anti-Pigmentation'],
      },
    ],
    reviews: [],
    amenities: ['Private Rooms'],
    gender: 'unisex',
  },
];

const mockSavedSalonIds = ['salon-1', 'salon-2'];
const mockSavedServices: SavedServiceRef[] = [
  { salonId: 'salon-1', serviceId: 'srv-101' },
  { salonId: 'salon-2', serviceId: 'srv-201' },
];
const mockSavedStaff: SavedStaffRef[] = [
  { salonId: 'salon-1', stylistId: 'stylist-aarav' },
  { salonId: 'salon-2', stylistId: 'stylist-ananya' },
];

const host = document.createElement('div');
document.body.appendChild(host);
let root: Root = createRoot(host);

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id) || host.querySelector(`[id="${id}"]`);
}

function text(): string {
  return host.textContent || '';
}

function click(el: Element | null) {
  if (!el) throw new Error('click target missing');
  const Ev = typeof MouseEvent !== 'undefined' ? MouseEvent : (Event as typeof Event);
  (el as HTMLElement).dispatchEvent(new Ev('click', { bubbles: true, cancelable: true }));
}

// ---------------------------------------------------------------------------
// Run Tests
// ---------------------------------------------------------------------------
async function run() {
  let openSalonDetailsCalledWith: Salon | null = null;
  let bookSalonCalledWith: { salon: Salon; service?: SalonService; stylist?: Stylist } | null = null;
  let toggleSaveSalonCalledWith: string | null = null;
  let toggleSaveServiceCalledWith: { salonId: string; serviceId: string } | null = null;
  let toggleSaveStaffCalledWith: { salonId: string; stylistId: string } | null = null;

  await render(
    <SavedTab
      salons={mockSalons}
      savedSalonIds={mockSavedSalonIds}
      savedServices={mockSavedServices}
      savedStaff={mockSavedStaff}
      onOpenSalonDetails={(salon) => {
        openSalonDetailsCalledWith = salon;
      }}
      onBookSalon={(salon, service, stylist) => {
        bookSalonCalledWith = { salon, service, stylist };
      }}
      onToggleSaveSalon={(id) => {
        toggleSaveSalonCalledWith = id;
      }}
      onToggleSaveService={(salonId, serviceId) => {
        toggleSaveServiceCalledWith = { salonId, serviceId };
      }}
      onToggleSaveStaff={(salonId, stylistId) => {
        toggleSaveStaffCalledWith = { salonId, stylistId };
      }}
    />
  );

  // 1. Page Root & Route
  const rootEl = byId('favourites-page');
  check('favourites page root rendered', Boolean(rootEl));
  check(
    'data-route matches /customer/favourites',
    rootEl?.getAttribute('data-route') === '/customer/favourites'
  );
  check('page title Favourites is present', text().includes('Favourites'));

  // 2. Navigation Tabs
  check('All tab present', Boolean(byId('tab-all-favourites')));
  check('Favourite Salons tab present', Boolean(byId('tab-favourite-salons')));
  check('Favourite Staff tab present', Boolean(byId('tab-favourite-staff')));
  check('Favourite Services tab present', Boolean(byId('tab-favourite-services')));

  // 3. Section: Favourite Salons
  const salonsSection = byId('section-favourite-salons');
  check('favourite salons section rendered', Boolean(salonsSection));
  const salonCard1 = byId('favourite-salon-card-salon-1');
  check('Scissors & Shears Salon card rendered', Boolean(salonCard1));
  check('salon card shows name', (salonCard1?.textContent || '').includes('Scissors & Shears Salon'));
  check('salon card shows area Mansarovar', (salonCard1?.textContent || '').includes('Mansarovar'));
  check('salon card shows rating 4.9', (salonCard1?.textContent || '').includes('4.9'));

  // Allow: Remove favourite salon
  const removeSalonBtn = byId('remove-favourite-salon-salon-1');
  check('remove favourite salon button exists', Boolean(removeSalonBtn));
  await act(async () => {
    click(removeSalonBtn);
  });
  check('remove favourite salon fired callback with salon-1', toggleSaveSalonCalledWith === 'salon-1');

  // Allow: Book again salon
  const bookSalonBtn = byId('book-favourite-salon-salon-1');
  check('book again salon button exists', Boolean(bookSalonBtn));
  await act(async () => {
    click(bookSalonBtn);
  });
  check('book again salon fired onBookSalon callback', bookSalonCalledWith?.salon.id === 'salon-1');

  // Allow: View profile salon
  const viewSalonProfileBtn = byId('view-profile-salon-salon-1');
  check('view profile salon button exists', Boolean(viewSalonProfileBtn));
  await act(async () => {
    click(viewSalonProfileBtn);
  });
  check('view profile salon fired onOpenSalonDetails callback', openSalonDetailsCalledWith?.id === 'salon-1');

  // 4. Section: Favourite Staff
  const staffSection = byId('section-favourite-staff');
  check('favourite staff section rendered', Boolean(staffSection));
  const staffCardA = byId('favourite-staff-card-stylist-aarav');
  check('Aarav Sharma staff card rendered', Boolean(staffCardA));
  check('staff card shows stylist name', (staffCardA?.textContent || '').includes('Aarav Sharma'));
  check('staff card shows role', (staffCardA?.textContent || '').includes('Senior Hair Specialist'));
  check('staff card shows rating 4.95', (staffCardA?.textContent || '').includes('4.95'));
  check('staff card shows salon name', (staffCardA?.textContent || '').includes('Scissors & Shears'));

  // Allow: Remove favourite staff
  const removeStaffBtn = byId('remove-favourite-staff-stylist-aarav');
  check('remove favourite staff button exists', Boolean(removeStaffBtn));
  await act(async () => {
    click(removeStaffBtn);
  });
  check(
    'remove favourite staff fired onToggleSaveStaff callback',
    toggleSaveStaffCalledWith?.stylistId === 'stylist-aarav'
  );

  // Allow: Book again staff
  const bookStaffBtn = byId('book-favourite-staff-stylist-aarav');
  check('book again staff button exists', Boolean(bookStaffBtn));
  await act(async () => {
    click(bookStaffBtn);
  });
  check(
    'book again staff fired onBookSalon with stylist',
    bookSalonCalledWith?.stylist?.id === 'stylist-aarav'
  );

  // Allow: View profile staff
  const viewStaffProfileBtn = byId('view-profile-staff-stylist-aarav');
  check('view profile staff button exists', Boolean(viewStaffProfileBtn));
  await act(async () => {
    click(viewStaffProfileBtn);
  });
  check('staff profile modal opened', text().includes('Stylist Profile') && text().includes('Signature Specialties'));

  // 5. Section: Favourite Services
  const servicesSection = byId('section-favourite-services');
  check('favourite services section rendered', Boolean(servicesSection));
  const serviceCard1 = byId('favourite-service-card-srv-101');
  check('Signature Hair Cut service card rendered', Boolean(serviceCard1));
  check('service card shows service name', (serviceCard1?.textContent || '').includes('Signature Hair Cut & Styling'));
  check('service card shows price ₹399', (serviceCard1?.textContent || '').includes('399'));
  check('service card shows duration 45 mins', (serviceCard1?.textContent || '').includes('45 mins'));

  // Allow: Remove favourite service
  const removeServiceBtn = byId('remove-favourite-service-srv-101');
  check('remove favourite service button exists', Boolean(removeServiceBtn));
  await act(async () => {
    click(removeServiceBtn);
  });
  check(
    'remove favourite service fired onToggleSaveService callback',
    toggleSaveServiceCalledWith?.serviceId === 'srv-101'
  );

  // Allow: Book again service
  const bookServiceBtn = byId('book-favourite-service-srv-101');
  check('book again service button exists', Boolean(bookServiceBtn));
  await act(async () => {
    click(bookServiceBtn);
  });
  check(
    'book again service fired onBookSalon with service',
    bookSalonCalledWith?.service?.id === 'srv-101'
  );

  // Allow: View profile service
  const viewServiceProfileBtn = byId('view-profile-service-srv-101');
  check('view profile service button exists', Boolean(viewServiceProfileBtn));
  await act(async () => {
    click(viewServiceProfileBtn);
  });
  check('service profile modal opened', text().includes('Treatment Details') && text().includes('Precision haircut'));

  // 6. Tab Filtering
  const staffTabBtn = byId('tab-favourite-staff');
  await act(async () => {
    click(staffTabBtn);
  });
  check('staff tab active', Boolean(byId('section-favourite-staff')) && !byId('section-favourite-salons'));

  const servicesTabBtn = byId('tab-favourite-services');
  await act(async () => {
    click(servicesTabBtn);
  });
  check('services tab active', Boolean(byId('section-favourite-services')) && !byId('section-favourite-staff'));

  // 7. Search Filter
  const searchInput = byId('favourites-search-input') as HTMLInputElement;
  check('search input exists', Boolean(searchInput));
  await act(async () => {
    if (searchInput) {
      searchInput.value = 'Hydra Facial';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Summary
  console.log(`\n${passed}/${passed + failed} favourites page UI checks passed`);
  if (failed > 0) {
    process.exit(1);
  }
}

void run();
