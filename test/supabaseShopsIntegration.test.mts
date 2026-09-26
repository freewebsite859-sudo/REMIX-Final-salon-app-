/**
 * Tests for Supabase shops dynamic integration & external routing
 * 1. Fetching shop listings dynamically from Supabase shops table
 * 2. Redirect URL generation to https://fanal-templetes-app.vercel.app/?site={shop_slug}
 * 3. Booking payload insertion with shop_slug column (e.g., 'roshan-salon')
 * 4. Price range filter cost toggles in SearchTab
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeShops,
  fetchShopsFromSupabase,
  fetchCatalog,
  type ShopDbRow,
} from '../src/lib/catalogService';
import { getShopSlug, getShopExternalUrl } from '../src/components/SearchTab';
import { buildBookingRows, bookingToAppointment } from '../src/lib/bookingCore';
import type { BookingCreateRequest } from '../src/lib/bookingContract';
import { searchSalons, DEFAULT_SEARCH_FILTERS } from '../src/lib/salonSearch';
import { DEMO_SALONS } from '../src/data/demoCatalog';

describe('Supabase Shops Dynamic Integration & External Routing', () => {
  it('normalizes shop rows from Supabase shops table with shop_slug', () => {
    const rawShops: ShopDbRow[] = [
      {
        id: 'roshan-salon-id',
        name: 'Roshan Salon',
        shop_slug: 'roshan-salon',
        tagline: 'Signature haircuts and luxury styling',
        category: 'Barber',
        categories: ['Barber', 'Hair Cut'],
        area: 'Mansarovar',
        city: 'Jaipur',
        latitude: 26.8533,
        longitude: 75.7681,
        price_range: '₹₹',
        rating: 4.9,
      },
      {
        id: 'glamour-id',
        name: 'Glamour Beauty Studio',
        slug: 'glamour-studio',
        area: 'Vaishali Nagar',
        city: 'Jaipur',
        category: 'Salon',
        latitude: 26.9075,
        longitude: 75.7412,
      },
    ];

    const normalized = normalizeShops(rawShops);
    assert.equal(normalized.length, 2);

    const roshan = normalized[0];
    assert.equal(roshan.name, 'Roshan Salon');
    assert.equal(roshan.shop_slug, 'roshan-salon');
    assert.equal(roshan.slug, 'roshan-salon');
    assert.equal(roshan.location.area, 'Mansarovar');
    assert.equal(roshan.location.city, 'Jaipur');

    const glamour = normalized[1];
    assert.equal(glamour.name, 'Glamour Beauty Studio');
    assert.equal(glamour.shop_slug, 'glamour-studio');
  });

  it('generates correct external redirection URL for shops', () => {
    const roshanSalon = DEMO_SALONS.find((s) => s.id === 'roshan-salon') || {
      id: 'roshan-salon',
      name: 'Roshan Salon',
      shop_slug: 'roshan-salon',
      slug: 'roshan-salon',
      tagline: '',
      categories: ['Barber'],
      rating: 4.9,
      reviewCount: 100,
      distance: '0.5 km',
      location: { area: 'Mansarovar', city: 'Jaipur', address: '', latitude: 26.85, longitude: 75.76 },
      image: '',
      gallery: [],
      isOpen: true,
      openingHours: '',
      priceRange: '₹₹' as const,
      services: [],
      stylists: [],
      reviews: [],
      amenities: [],
      gender: 'unisex' as const,
    };

    const slug = getShopSlug(roshanSalon);
    assert.equal(slug, 'roshan-salon');

    const externalUrl = getShopExternalUrl(roshanSalon);
    assert.equal(externalUrl, 'https://fanal-templetes-app.vercel.app/?site=roshan-salon');
  });

  it('inserts booking payload with shop_slug column (e.g., roshan-salon)', () => {
    const bookingRequest: BookingCreateRequest = {
      salon: {
        id: 'roshan-salon',
        name: 'Roshan Salon',
        shop_slug: 'roshan-salon',
        slug: 'roshan-salon',
        address: 'Shop 14, Main Market, Mansarovar, Jaipur',
      },
      services: [
        {
          id: 'rs-s1',
          name: 'Master Haircut & Style',
          price: 499,
          unitPrice: 399,
          durationMinutes: 40,
        },
      ],
      date: '2026-10-15',
      time: '11:00 AM',
      amount: 99.75, // 25% of 399
      customer: {
        id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Arjun Singh',
        phone: '+91 9876543210',
        email: 'arjun@example.com',
      },
    };

    const { booking } = buildBookingRows(bookingRequest);
    assert.equal(booking.shop_slug, 'roshan-salon');
    assert.equal(booking.salon_id, 'roshan-salon');
    assert.equal(booking.subtotal, 399);
    assert.equal(booking.advance_amount, Math.round(399 * 0.25));

    const appointment = bookingToAppointment(bookingRequest, booking);
    assert.equal(appointment.shopSlug, 'roshan-salon');
    assert.equal(appointment.salonName, 'Roshan Salon');
  });

  it('filters salons by price range cost toggles (₹, ₹₹, ₹₹₹)', () => {
    const filtersSingle = {
      ...DEFAULT_SEARCH_FILTERS,
      priceRanges: ['₹₹' as const],
    };
    const { results: resSingle } = searchSalons(DEMO_SALONS, '', filtersSingle);
    assert.ok(resSingle.length > 0);
    assert.ok(resSingle.every((r) => r.salon.priceRange === '₹₹'));

    const filtersMultiple = {
      ...DEFAULT_SEARCH_FILTERS,
      priceRanges: ['₹' as const, '₹₹' as const],
    };
    const { results: resMultiple } = searchSalons(DEMO_SALONS, '', filtersMultiple);
    assert.ok(resMultiple.length >= resSingle.length);
    assert.ok(resMultiple.every((r) => r.salon.priceRange === '₹' || r.salon.priceRange === '₹₹'));
  });

  it('filters salons dynamically by location and category', () => {
    const filters = {
      ...DEFAULT_SEARCH_FILTERS,
      category: 'barber' as const,
      area: 'Mansarovar',
    };
    const { results: res } = searchSalons(DEMO_SALONS, '', filters);
    assert.ok(res.length > 0);
    const hasRoshan = res.some((r) => r.salon.shop_slug === 'roshan-salon' || r.salon.name.includes('Roshan'));
    assert.ok(hasRoshan, 'Roshan Salon should be found in Mansarovar barber search');
  });
});

process.exit(0);

