import { Zone } from "@/lib/api";

/**
 * Convert zone type to readable name
 */
export function formatZoneName(zone: Zone): string {
  const typeName = zone.type.charAt(0).toUpperCase() + zone.type.slice(1);
  return `${typeName} (${zone.id})`;
}

/**
 * Format peak hours tuple to readable time range
 */
export function formatPeakHour(start: number, end: number): string {
  const formatMinutes = (m: number) => {
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, "0")}${period}`;
  };
  return `${formatMinutes(start)}-${formatMinutes(end)}`;
}
