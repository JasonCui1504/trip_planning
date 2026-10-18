// Deep links into real booking sites, pre-filled with the search. These work
// without any API keys and are what the "Book" buttons open in mock mode.

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
