/** Recovery metadata for an in-flight request, never authoritative economic state. */
export const QUOTATION_STORAGE_PREFIX='simulation.quotation.v1:';
export function readPendingQuotation(key:readonly unknown[]):unknown{
  try{return JSON.parse(sessionStorage.getItem(QUOTATION_STORAGE_PREFIX+JSON.stringify(key))??'null');}catch{return null;}
}
export function writePendingQuotation(key:readonly unknown[],value:unknown){try{sessionStorage.setItem(QUOTATION_STORAGE_PREFIX+JSON.stringify(key),JSON.stringify(value));}catch{/* In-memory recovery remains available if browser storage is unavailable. */}}
export function clearPendingQuotation(key:readonly unknown[]){try{sessionStorage.removeItem(QUOTATION_STORAGE_PREFIX+JSON.stringify(key));}catch{/* Storage can be unavailable. */}}
