import type { Category, ExternalLink, SearchParamsMap } from "../../shared/types.ts";

// Deep links into real booking sites, pre-filled with the search. These work
// without any API keys: "Book" opens the first one, and the rest are offered
// so you can compare the same trip across sites.

const q = encodeURIComponent;

export const links = {
  flights: (origin: string, destination: string, depart: string, ret?: string) =>
    `https://www.google.com/travel/flights?q=${q(
      `Flights from ${origin} to ${destination} on ${depart}${ret ? ` returning ${ret}` : ""}`,
    )}`,
  hotels: (location: string, checkIn: string, checkOut: string, guests: number, rooms: number, name?: string) =>
    `https://www.booking.com/searchresults.html?ss=${q(name ? `${name}, ${location}` : location)}&checkin=${checkIn}&checkout=${checkOut}&group_adults=${guests}&no_rooms=${rooms}`,
  activities: (location: string, name?: string) =>
    `https://www.getyourguide.com/s/?q=${q(name ? `${name} ${location}` : location)}`,
  cars: (location: string, pickup: string, dropoff: string) =>
    `https://www.kayak.com/cars/${q(location)}/${pickup}/${dropoff}`,
  dining: (location: string, name?: string) =>
    `https://www.google.com/maps/search/${q(name ? `${name} ${location}` : `restaurants in ${location}`)}`,
};

export const altLinks = {
  flights: (origin: string, destination: string, depart: string, ret?: string): ExternalLink[] => [
    { label: "Google Flights", url: links.flights(origin, destination, depart, ret) },
    { label: "Kayak", url: `https://www.kayak.com/flights/${origin}-${destination}/${depart}${ret ? `/${ret}` : ""}` },
    { label: "Skyscanner", url: `https://www.skyscanner.com/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${depart.replaceAll("-", "").slice(2)}/${ret ? `${ret.replaceAll("-", "").slice(2)}/` : ""}` },
    { label: "Expedia", url: `https://www.expedia.com/Flights-Search?trip=${ret ? "roundtrip" : "oneway"}&leg1=from:${origin},to:${destination},departure:${depart}TANYT${ret ? `&leg2=from:${destination},to:${origin},departure:${ret}TANYT` : ""}` },
  ],
  hotels: (location: string, checkIn: string, checkOut: string, guests: number, rooms: number, name?: string): ExternalLink[] => {
    const where = name ? `${name}, ${location}` : location;
    return [
      { label: "Booking.com", url: links.hotels(location, checkIn, checkOut, guests, rooms, name) },
      { label: "Hotels.com", url: `https://www.hotels.com/Hotel-Search?destination=${q(where)}&startDate=${checkIn}&endDate=${checkOut}&adults=${guests}&rooms=${rooms}` },
      { label: "Expedia", url: `https://www.expedia.com/Hotel-Search?destination=${q(where)}&startDate=${checkIn}&endDate=${checkOut}&adults=${guests}&rooms=${rooms}` },
      { label: "Google Hotels", url: `https://www.google.com/travel/search?q=${q(`${where} hotel`)}&checkin=${checkIn}&checkout=${checkOut}` },
      { label: "Airbnb", url: `https://www.airbnb.com/s/${q(location)}/homes?checkin=${checkIn}&checkout=${checkOut}&adults=${guests}` },
    ];
  },
  cars: (location: string, pickup: string, dropoff: string): ExternalLink[] => [
    { label: "Kayak", url: links.cars(location, pickup, dropoff) },
    { label: "Expedia", url: `https://www.expedia.com/carsearch?locn=${q(location)}&date1=${pickup}&date2=${dropoff}` },
    { label: "Rentalcars", url: `https://www.rentalcars.com/search-results?location=${q(location)}&puDay=${pickup.slice(8)}&puMonth=${pickup.slice(5, 7)}&puYear=${pickup.slice(0, 4)}&doDay=${dropoff.slice(8)}&doMonth=${dropoff.slice(5, 7)}&doYear=${dropoff.slice(0, 4)}` },
  ],
};

/** The search on real sites, for categories with no live source connected yet. */
export function searchLinks<C extends Category>(category: C, params: SearchParamsMap[C]): ExternalLink[] {
  switch (category) {
    case "flights": {
      const f = params as SearchParamsMap["flights"];
      return altLinks.flights(f.origin, f.destination, f.departDate, f.returnDate);
    }
    case "hotels": {
      const h = params as SearchParamsMap["hotels"];
      return altLinks.hotels(h.location, h.checkIn, h.checkOut, h.guests, h.rooms);
    }
    case "cars": {
      const c = params as SearchParamsMap["cars"];
      return altLinks.cars(c.location, c.pickupDate, c.dropoffDate);
    }
    case "activities": {
      const { location } = params as SearchParamsMap["activities"];
      return [
        { label: "GetYourGuide", url: links.activities(location) },
        { label: "Viator", url: `https://www.viator.com/searchResults/all?text=${q(location)}` },
        { label: "Tripadvisor", url: `https://www.tripadvisor.com/Search?q=${q(`things to do ${location}`)}` },
      ];
    }
    case "dining": {
      const d = params as SearchParamsMap["dining"];
      const what = d.cuisine ? `${d.cuisine} restaurants` : "restaurants";
      return [
        { label: "Google Maps", url: `https://www.google.com/maps/search/${q(`${what} in ${d.location}`)}` },
        { label: "OpenTable", url: `https://www.opentable.com/s?term=${q(`${d.cuisine ?? ""} ${d.location}`.trim())}${d.date ? `&dateTime=${d.date}T19:00` : ""}` },
      ];
    }
  }
  return [];
}
