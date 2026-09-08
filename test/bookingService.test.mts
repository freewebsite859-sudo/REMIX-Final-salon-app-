/**
 * Multi-service booking contract + service tests (pure Node — no React/DOM).
 *
 * Covers the full data-flow spine introduced for multi-service bookings:
 *
 *   1. bookingContract — null/undefined-safe mapping of catalog services into
 *      canonical metadata.services[] line items (ids, charged price, minutes).
 *   2. server/bookings  — validation, row building, store persistence with
 *      parent/child inserts and compensation on child failure.
 *
 * Run: npm run test:booking-service
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { Salon, SalonService } from '../src/types';
import {
  buildBookingMetadataServices,
  lineItemsSubtotal,
  lineItemsDurationMinutes,
  toBookingSalonSnapshot,
  toBookingStylistSnapshot,
  toSalonServices,
} from '../src/lib/bookingContract';
import {
  validateBookingRequest,
  buildBookingRows,
  createBooking,
  type BookingStore,
} from '../server/bookings';

const srvHaircut: SalonService = {
  id: 'svc-cut',
  name: 'Precision Cut & Blowdry',
  category: 'hair',
  duration: 45,
  price: 1200,
  discountPrice: 1000,
  description: 'Scissor precision cut.',
  popular: true,
};
const srvBalayage: SalonService = {
  id: 'svc-balayage',
  name: 'Balayage Highlights',
  category: 'hair',
  duration: 90,
  price: 2600,
  discountPrice: 2100,
  description: 'Hand-painted highlights.',
};
const srvNails: SalonService = {
  id: 'svc-nails',
  name: 'Gel-X Nails',
  category: 'nails',
  duration: 60,
  price: 999,
  description: 'Gel extension manicure.',
};

const FUTURE_DATE = '2030-01-15';

function validRequest() {
  return {
    salon: {
      id: 'salon-1',
      name: 'Scissors & Shears Salon',
      address: 'Mansarovar, Jaipur',
      image: 'https://img/x.jpg',
      rating: 4.9,
    },
    services: [
      { id: 'svc-cut', name: 'Precision Cut & Blowdry', durationMinutes: 45, price: 1200, discountPrice: 1000, unitPrice: 1000, category: 'hair' },
      { id: 'svc-nails', name: 'Gel-X Nails', durationMinutes: 60, price: 999, unitPrice: 999, category: 'nails' },
    ],
    stylist: { id: 'st-1', name: 'Aarav Sharma', role: 'Senior Stylist' },
    customer: { id: '11111111-2222-3333-4444-555555555555', name: 'Priya', phone: '+919999999999' },
    date: FUTURE_DATE,
    time: '5:30 PM',
    amount: 500,
    notes: 'Please use sulfate-free products',
  };
}

// ---------------------------------------------------------------------------
// Booking contract — metadata.services[] mapping
// ---------------------------------------------------------------------------

describe('buildBookingMetadataServices (null/undefined safety)', () => {
  it('returns [] for null/undefined/empty input', () => {
    assert.deepEqual(buildBookingMetadataServices(null), []);
    assert.deepEqual(buildBookingMetadataServices(undefined), []);
    assert.deepEqual(buildBookingMetadataServices([]), []);
  });

  it('drops invalid rows instead of coercing to NaN', () => {
    const bad = [
      { ...srvHaircut, id: '' },
      { ...srvBalayage, price: 'not-a-number' },
      { ...srvNails, duration: 0 },
    ] as unknown as SalonService[];
    const lines = buildBookingMetadataServices(bad);
    assert.equal(lines.length, 0);
  });

  it('maps multi-service selection with charged (discounted) price + minutes', () => {
    const lines = buildBookingMetadataServices([srvHaircut, srvBalayage, srvNails]);
    assert.deepEqual(
      lines.map((l) => [l.id, l.unitPrice, l.durationMinutes, l.discountPrice]),
      [
        ['svc-cut', 1000, 45, 1000],
        ['svc-balayage', 2100, 90, 2100],
        ['svc-nails', 999, 60, undefined],
      ]
    );
    assert.equal(lineItemsSubtotal(lines), 4099);
    assert.equal(lineItemsDurationMinutes(lines), 195);
  });

  it('de-duplicates by id keeping first occurrence', () => {
    const lines = buildBookingMetadataServices([srvHaircut, srvBalayage, srvHaircut]);
    assert.deepEqual(lines.map((l) => l.id), ['svc-cut', 'svc-balayage']);
  });

  it('handles a single service (legacy bookings stay single-line arrays)', () => {
    const lines = buildBookingMetadataServices([srvNails]);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].unitPrice, 999);
    assert.equal(lineItemsDurationMinutes(lines), 60);
  });
});

describe('booking snapshots', () => {
  it('salon snapshot keeps only known display fields', () => {
    const salon: Salon = {
      id: 'salon-1',
      name: 'Nexora',
      tagline: 'ignored',
      categories: [],
      rating: 4.9,
      reviewCount: 100,
      distance: '1 km',
      location: {
        area: 'Mansarovar',
        city: 'Jaipur',
        address: '42 Madhyam Marg',
        latitude: 26.85,
        longitude: 75.76,
        mapsUrl: 'https://maps',
      },
      image: 'https://img/a.jpg',
      gallery: [],
      isOpen: true,
      openingHours: '9-9',
      priceRange: '₹₹',
      services: [],
      stylists: [],
      reviews: [],
      amenities: [],
      gender: 'unisex',
    };
    const snap = toBookingSalonSnapshot(salon);
    assert.equal(snap.id, 'salon-1');
    assert.equal(snap.name, 'Nexora');
    assert.equal(snap.address, '42 Madhyam Marg');
    assert.equal('tagline' in snap, false);
    assert.equal(snap.latitude, 26.85);
  });

  it('salon snapshot handles a missing salon without throwing', () => {
    const snap = toBookingSalonSnapshot(null);
    assert.equal(snap.id, '');
    assert.equal(snap.name, '');
  });

  it('stylist snapshot null when no stylist chosen', () => {
    assert.equal(toBookingStylistSnapshot(null), null);
    assert.equal(toBookingStylistSnapshot(undefined), null);
  });
});

describe('toSalonServices (DB → display reconstruction)', () => {
  it('rebuilds SalonService rows from line items', () => {
    const services = toSalonServices([
      { id: 'svc-cut', name: 'Cut', durationMinutes: 45, price: 1200, discountPrice: 1000, unitPrice: 1000, category: 'hair' },
    ]);
    assert.equal(services.length, 1);
    assert.equal(services[0].price, 1200);
    assert.equal(services[0].discountPrice, 1000);
    assert.equal(services[0].duration, 45);
  });
});

// ---------------------------------------------------------------------------
// Server validation
// ---------------------------------------------------------------------------

describe('validateBookingRequest', () => {
  it('accepts a valid multi-service request', () => {
    const res = validateBookingRequest(validRequest());
    assert.equal(res.ok, true);
    if (res.ok && res.value) {
      assert.equal(res.value.services.length, 2);
      assert.equal(res.value.amount, 500);
    }
  });

  it('rejects empty / missing services', () => {
    const body = validRequest();
    body.services = [];
    const res = validateBookingRequest(body);
    assert.equal(res.ok, false);
  });

  it('rejects unitPrice that does not equal discountPrice ?? price', () => {
    const body = validRequest();
    body.services[0].unitPrice = 999999;
    const res = validateBookingRequest(body);
    assert.equal(res.ok, false);
  });

  it('rejects an amount that is not the 25% advance of the recomputed total', () => {
    const body = validRequest();
    body.services = [
      { id: 'svc-cut', name: 'Cut', durationMinutes: 45, price: 1000, unitPrice: 1000, category: 'hair' },
    ];
    body.amount = 1; // expected 25% of 1000 = 250
    const res = validateBookingRequest(body);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.fields?.join(' '), /25%/);
    }
  });

  it('rejects past dates and malformed times', () => {
    const past = validRequest();
    past.date = '2020-01-01';
    assert.equal(validateBookingRequest(past).ok, false);
    const badTime = validRequest();
    badTime.time = '25:99 PM';
    assert.equal(validateBookingRequest(badTime).ok, false);
  });

  it('accepts missing customer/stylist/notes (guest booking)', () => {
    const body = validRequest();
    body.customer = null;
    body.stylist = null;
    body.notes = undefined;
    const res = validateBookingRequest(body);
    assert.equal(res.ok, true);
  });
});

// ---------------------------------------------------------------------------
// Row building + persistence
// ---------------------------------------------------------------------------

describe('buildBookingRows', () => {
  it('metadata.services is a clean array and child rows carry every line', () => {
    const parsed = validateBookingRequest(validRequest());
    assert.equal(parsed.ok, true);
    const input = parsed.value!;
    const { booking, serviceRows } = buildBookingRows(input);

    assert.equal(booking.metadata.services.length, 2);
    assert.equal(booking.metadata.services[0].unitPrice, 1000);
    assert.equal(booking.metadata.services[1].unitPrice, 999);
    assert.equal(booking.subtotal, 1999);
    assert.equal(booking.total_amount, 1999);
    assert.equal(booking.advance_amount, 500); // round(1999*0.25) = round(499.75) = 500
    assert.equal(booking.user_id, '11111111-2222-3333-4444-555555555555');

    assert.equal(serviceRows.length, 2);
    assert.equal(serviceRows[0].booking_id, booking.id);
    assert.equal(serviceRows[0].position, 0);
    assert.equal(serviceRows[1].position, 1);
    assert.equal(serviceRows[1].unit_price, 999);
    assert.equal(serviceRows[0].duration_minutes, 45);
  });

  it('single-service bookings produce one metadata line and one child row', () => {
    const body = validRequest();
    body.services = [
      { id: 'svc-nails', name: 'Gel-X Nails', durationMinutes: 60, price: 999, unitPrice: 999, category: 'nails' },
    ];
    body.amount = 250; // 25% of 999 → round(249.75)=250
    const parsed = validateBookingRequest(body);
    assert.equal(parsed.ok, true);
    const { booking, serviceRows } = buildBookingRows(parsed.value!);
    assert.equal(booking.metadata.services.length, 1);
    assert.equal(serviceRows.length, 1);
  });
});

describe('createBooking with a fake store', () => {
  it('inserts parent + children and returns the canonical appointment', async () => {
    const calls: string[] = [];
    let deleted = 0;
    const store: BookingStore = {
      async insertBooking() {
        calls.push('insert-booking');
        return { ok: true };
      },
      async insertBookingServices(rows) {
        calls.push(`insert-services:${rows.length}`);
        return { ok: true };
      },
      async deleteBooking() {
        deleted += 1;
        return { ok: true };
      },
    };

    const parsed = validateBookingRequest(validRequest());
    const result = await createBooking(store, parsed.value!);

    assert.ok(result.appointment);
    assert.equal(calls.join(','), 'insert-booking,insert-services:2');
    assert.equal(deleted, 0);
    const apt = result.appointment!;
    assert.equal(apt.status, 'pending');
    assert.equal(apt.services.length, 2);
    assert.equal(apt.totalPrice, 1999);
    assert.equal(apt.advancePaid, 500);
    assert.equal(apt.remainingAmount, 1499);
    assert.match(apt.bookingRef, /^NX-/);
    assert.equal(apt.salonId, 'salon-1');
    assert.equal(apt.salonName, 'Scissors & Shears Salon');
    assert.ok(apt.stylist && apt.stylist.name === 'Aarav Sharma');
    assert.equal(apt.notes, 'Please use sulfate-free products');
  });

  it('compensates (deletes parent) when the child insert fails', async () => {
    let deletedId: string | null = null;
    const store: BookingStore = {
      async insertBooking() {
        return { ok: true };
      },
      async insertBookingServices() {
        return { ok: false, error: 'permission denied' };
      },
      async deleteBooking(id) {
        deletedId = id;
        return { ok: true };
      },
    };

    const parsed = validateBookingRequest(validRequest());
    const result = await createBooking(store, parsed.value!);
    assert.equal(result.appointment, null);
    assert.match(result.error ?? '', /line items/i);
    assert.ok(deletedId);
  });
});

// ---------------------------------------------------------------------------
// HTTP handler behavior (real express, injected store)
// ---------------------------------------------------------------------------

import express from 'express';
import type { AddressInfo } from 'node:net';
import { createBookingsHandler, type BookingServiceDbRow, type BookingDbRow } from '../server/bookings';

describe('POST /api/bookings handler', () => {
  let server: ReturnType<typeof listen>;
  let baseUrl = '';
  let savedRows: { booking: BookingDbRow; services: BookingServiceDbRow[] } | null = null;

  function listen(app: express.Express) {
    const srv = app.listen(0, '127.0.0.1');
    return srv;
  }

  async function start(store: BookingStore | null) {
    const app = express();
    app.use(express.json());
    app.post('/api/bookings', createBookingsHandler(store));
    server = listen(app);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  async function stop() {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  }

  it('answers 503 honestly when no service client is configured', async () => {
    await start(null);
    try {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 503);
      const payload = (await res.json()) as { error: string };
      assert.match(payload.error, /not configured/i);
    } finally {
      await stop();
    }
  });

  it('answers 400 with fields for an invalid multi-service body', async () => {
    const store: BookingStore = {
      async insertBooking(row) {
        savedRows = { booking: row, services: [] };
        return { ok: true };
      },
      async insertBookingServices(rows) {
        if (savedRows) savedRows.services = rows;
        return { ok: true };
      },
      async deleteBooking() {
        return { ok: true };
      },
    };
    await start(store);
    try {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salon: { id: 's1' } }), // missing name + services
      });
      assert.equal(res.status, 400);
      const payload = (await res.json()) as { error: string; fields?: string[] };
      assert.ok(payload.fields && payload.fields.length >= 2);
    } finally {
      await stop();
    }
  });

  it('persists a 2-service booking and returns the canonical appointment (201)', async () => {
    const store: BookingStore = {
      async insertBooking(row) {
        savedRows = { booking: row, services: [] };
        return { ok: true };
      },
      async insertBookingServices(rows) {
        if (savedRows) savedRows.services = rows;
        return { ok: true };
      },
      async deleteBooking() {
        return { ok: true };
      },
    };
    await start(store);
    try {
      const body = validRequest();
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(res.status, 201);
      const payload = (await res.json()) as { appointment: { bookingRef: string; services: unknown[] } };
      assert.match(payload.appointment.bookingRef, /^NX-/);
      assert.equal(payload.appointment.services.length, 2);
      assert.ok(savedRows);
      assert.equal(savedRows.booking.metadata.services.length, 2);
      assert.equal(savedRows.services.length, 2);
      assert.equal(savedRows.services[1].service_id, 'svc-nails');
    } finally {
      await stop();
    }
  });
});
