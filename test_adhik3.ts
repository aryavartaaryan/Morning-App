import { getVedicMonth } from './lib/cosmicData';
const d1 = new Date('2026-06-01T12:00:00Z');
console.log("June 1:", getVedicMonth(d1).name);
