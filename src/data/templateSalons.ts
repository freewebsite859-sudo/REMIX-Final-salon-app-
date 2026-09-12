import { CATEGORY_TEMPLATES } from '../categoryTemplates';
import { Salon, SalonService, Stylist, Review } from '../types';
import { getReelsForSalon } from './salonVideoReels';

export function getTemplateSalons(): Salon[] {
  return Object.values(CATEGORY_TEMPLATES).map((tmpl, idx) => {
    const services: SalonService[] = (tmpl.services || []).map((s) => ({
      id: s.id,
      name: s.name,
      category: (s.category || 'hair').toLowerCase() as any,
      duration: s.durationMinutes || 45,
      price: s.price,
      discountPrice: s.price > 500 ? Math.round(s.price * 0.85) : undefined,
      description: s.description || '',
      popular: !!s.popular,
    }));

    const stylists: Stylist[] = tmpl.stylists && tmpl.stylists.length > 0
      ? tmpl.stylists.map((st) => ({
          id: st.id,
          name: st.name,
          role: st.role,
          avatar: st.avatarUrl,
          avatarUrl: st.avatarUrl,
          rating: st.rating || 4.9,
          experience: st.experience || '6+ years',
          specialty: st.specialties || tmpl.subCategories || ['Styling'],
        }))
      : [
          {
            id: `${tmpl.id}-owner`,
            name: tmpl.ownerName || 'Master Specialist',
            role: tmpl.ownerRole || 'Founder & Lead Specialist',
            avatar: tmpl.ownerPhotoUrl,
            avatarUrl: tmpl.ownerPhotoUrl,
            rating: 4.9,
            experience: '8+ years',
            specialty: tmpl.subCategories || ['Specialist'],
          },
        ];

    const reviews: Review[] = [
      {
        id: `${tmpl.id}-rev1`,
        userName: 'Priya Sharma',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        rating: 5,
        date: '3 days ago',
        comment: `Excellent service at ${tmpl.title}! High quality products, skilled staff, and great ambiance.`,
      },
      {
        id: `${tmpl.id}-rev2`,
        userName: 'Rohan Mehta',
        userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        rating: 5,
        date: '1 week ago',
        comment: `Booked online easily. ${tmpl.title} delivered amazing results. Highly recommended!`,
      },
    ];

    const id = tmpl.id;
    const isMen = id.includes('barber');
    const isWomen = id.includes('beauty') || id.includes('bridal') || id.includes('lash') || id.includes('nail');

    // Build rich category keywords for filter matching across Home, Search, and Category views
    const categoryTags: string[] = [tmpl.shortName];
    if (id.includes('barber')) categoryTags.push('Barber', 'Grooming', 'Men');
    if (id.includes('beauty') || id.includes('bridal') || id.includes('parlour') || id.includes('makeup')) {
      categoryTags.push('Beauty Parlour', 'Beauty', 'Bridal', 'Makeup');
    }
    if (id.includes('nail')) categoryTags.push('Nail Art', 'Nails', 'Manicure', 'Pedicure');
    if (id.includes('lash') || id.includes('brow')) categoryTags.push('Lash & Brow', 'Eyes');
    if (id.includes('spa') || id.includes('massage') || id.includes('ayurveda') || id.includes('wellness')) {
      categoryTags.push('Spa', 'Massage', 'Wellness', 'Aromatherapy');
    }
    if (id.includes('tattoo')) categoryTags.push('Tattoo', 'Ink', 'Piercing');
    if (id.includes('skincare') || id.includes('medispa') || id.includes('dermatology')) {
      categoryTags.push('Skincare', 'Facial', 'Medi-Spa');
    }
    if (id.includes('hair') || id.includes('salon')) categoryTags.push('Salon', 'Hair', 'Styling');

    const subCats = tmpl.subCategories || [];
    const allCategories = Array.from(new Set([...categoryTags, ...subCats]));

    const city = tmpl.defaultCity || 'Jaipur';
    const area = tmpl.defaultAddress ? tmpl.defaultAddress.split(',')[0] : 'Central Market';
    const address = `${tmpl.defaultAddress || 'Main Road'}, ${city}`;

    return {
      id: tmpl.id,
      name: tmpl.title,
      tagline: tmpl.tagline || `${tmpl.shortName} - Premium Salon & Spa`,
      about: tmpl.about || `${tmpl.title} offers top-rated beauty, wellness, and grooming services in ${city}.`,
      categories: allCategories,
      tags: allCategories.map((c) => c.toLowerCase()),
      keywords: [
        tmpl.title.toLowerCase(),
        tmpl.shortName.toLowerCase(),
        'salon',
        'spa',
        'booking',
        city.toLowerCase(),
        area.toLowerCase(),
        ...subCats.map((sc) => sc.toLowerCase()),
        ...services.map((s) => s.name.toLowerCase()),
      ],
      rating: Math.round((4.8 + (idx % 3) * 0.1) * 10) / 10,
      reviewCount: 95 + idx * 14,
      distance: `${(0.5 + (idx % 5) * 0.4).toFixed(1)} km`,
      location: {
        area,
        city,
        address,
        latitude: 26.8533 + idx * 0.003,
        longitude: 75.7681 + idx * 0.003,
      },
      image: tmpl.coverImageUrl,
      gallery: [tmpl.coverImageUrl, tmpl.ownerPhotoUrl].filter(Boolean),
      isOpen: true,
      openingHours: '9:00 AM - 9:00 PM',
      priceRange: services.some((s) => s.price > 2000) ? '₹₹₹' : '₹₹',
      featured: true,
      trending: true,
      services,
      stylists,
      reviews,
      amenities: ['AC', 'Free WiFi', 'Sanitized Tools', 'Beverages', 'Card / UPI Accepted', 'Instant WhatsApp Confirmation'],
      discountOffer: idx % 2 === 0 ? '15% OFF on first online booking' : undefined,
      phone: tmpl.phone,
      gender: isMen ? 'men' : isWomen ? 'women' : 'unisex',
      videoReels: getReelsForSalon(tmpl.id),
    };
  });
}

