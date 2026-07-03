import { getVedicMonth } from './lib/cosmicData';
const d1 = new Date('2026-05-15T12:00:00Z');
const d2 = new Date('2026-06-15T12:00:00Z');
const d3 = new Date('2026-07-01T12:00:00Z');
const d4 = new Date('2026-07-15T12:00:00Z');
const d5 = new Date('2026-08-15T12:00:00Z');

console.log("May 15:", getVedicMonth(d1).name);
console.log("Jun 15:", getVedicMonth(d2).name);
console.log("Jul 1:", getVedicMonth(d3).name);
console.log("Jul 15:", getVedicMonth(d4).name);
console.log("Aug 15:", getVedicMonth(d5).name);
