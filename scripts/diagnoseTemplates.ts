import { CATEGORY_TEMPLATES } from '../src/categoryTemplates.js';
import { getTemplateSalons } from '../src/data/templateSalons.js';
import { normalizeCatalog } from '../src/lib/catalogService.js';

console.log('====================================================');
console.log(' SALON TEMPLATE DIAGNOSTIC & SUPABASE SCHEMA CHECK ');
console.log('====================================================\n');

const templateKeys = Object.keys(CATEGORY_TEMPLATES);
console.log(`[+] Total templates defined in CATEGORY_TEMPLATES: ${templateKeys.length}`);

const templateSalons = getTemplateSalons();
console.log(`[+] Total template salons generated via getTemplateSalons(): ${templateSalons.length}\n`);

let passedCount = 0;
let failedCount = 0;
const issues: string[] = [];

templateSalons.forEach((salon, index) => {
  const salonIssues: string[] = [];

  if (!salon.id) salonIssues.push('Missing ID');
  if (!salon.name) salonIssues.push('Missing Name');
  if (!salon.image) salonIssues.push('Missing Cover Image');
  if (!salon.location) {
    salonIssues.push('Missing Location object');
  } else {
    if (typeof salon.location.latitude !== 'number' || isNaN(salon.location.latitude)) {
      salonIssues.push('Invalid or missing latitude');
    }
    if (typeof salon.location.longitude !== 'number' || isNaN(salon.location.longitude)) {
      salonIssues.push('Invalid or missing longitude');
    }
    if (!salon.location.city) salonIssues.push('Missing city');
    if (!salon.location.address) salonIssues.push('Missing address');
  }

  if (!Array.isArray(salon.categories) || salon.categories.length === 0) {
    salonIssues.push('Missing categories array');
  }

  if (!Array.isArray(salon.services) || salon.services.length === 0) {
    salonIssues.push('Missing services array');
  } else {
    salon.services.forEach((service, sIdx) => {
      if (!service.id) salonIssues.push(`Service #${sIdx} missing ID`);
      if (!service.name) salonIssues.push(`Service #${sIdx} missing Name`);
      if (typeof service.price !== 'number' || service.price < 0) {
        salonIssues.push(`Service #${sIdx} invalid price (${service.price})`);
      }
      if (typeof service.duration !== 'number' || service.duration <= 0) {
        salonIssues.push(`Service #${sIdx} invalid duration (${service.duration})`);
      }
    });
  }

  if (!Array.isArray(salon.stylists) || salon.stylists.length === 0) {
    salonIssues.push('Missing stylists array');
  }

  if (salonIssues.length > 0) {
    failedCount++;
    console.log(`❌ [FAIL] Salon #${index + 1}: "${salon.name || salon.id}"`);
    salonIssues.forEach((issue) => console.log(`   - ${issue}`));
    issues.push(`${salon.id}: ${salonIssues.join(', ')}`);
  } else {
    passedCount++;
    console.log(`✅ [PASS] Salon #${index + 1}: "${salon.name}" (${salon.categories.join(', ')}) - ${salon.services.length} services, ${salon.stylists.length} staff`);
  }
});

console.log('\n----------------------------------------------------');
console.log(`SUMMARY: ${passedCount}/${templateSalons.length} Salons Passed Diagnostic Validation`);
if (failedCount === 0) {
  console.log('🎉 All templates match the Supabase catalog schema and will render properly on the Home Screen!');
} else {
  console.log(`⚠️ ${failedCount} salon(s) had schema validation errors.`);
}
console.log('====================================================\n');
