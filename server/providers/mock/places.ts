import type { Place } from "../../../shared/types.ts";

export interface MockPlace extends Place {
  lat: number;
  lon: number;
  /** Relative cost of living, 1 = average. Scales hotel/food/activity prices. */
  costIndex: number;
  neighborhoods: string[];
  landmarks: string[];
}

export const PLACES: MockPlace[] = [
  { code: "JFK", city: "New York", country: "United States", airport: "John F. Kennedy Intl", lat: 40.64, lon: -73.78, costIndex: 1.5, neighborhoods: ["Midtown", "SoHo", "Lower Manhattan", "Williamsburg", "Upper West Side"], landmarks: ["Central Park", "the Met", "Brooklyn Bridge", "the High Line", "Statue of Liberty"] },
  { code: "LAX", city: "Los Angeles", country: "United States", airport: "Los Angeles Intl", lat: 33.94, lon: -118.41, costIndex: 1.35, neighborhoods: ["Santa Monica", "Hollywood", "Downtown", "Venice", "Silver Lake"], landmarks: ["Griffith Observatory", "the Getty", "Venice Beach", "Hollywood Sign", "Santa Monica Pier"] },
  { code: "SFO", city: "San Francisco", country: "United States", airport: "San Francisco Intl", lat: 37.62, lon: -122.38, costIndex: 1.5, neighborhoods: ["Union Square", "Mission", "North Beach", "Nob Hill", "Hayes Valley"], landmarks: ["Golden Gate Bridge", "Alcatraz", "Fisherman's Wharf", "Golden Gate Park", "Chinatown"] },
  { code: "ORD", city: "Chicago", country: "United States", airport: "O'Hare Intl", lat: 41.97, lon: -87.9, costIndex: 1.2, neighborhoods: ["The Loop", "River North", "Wicker Park", "Lincoln Park", "West Loop"], landmarks: ["Millennium Park", "the Art Institute", "Navy Pier", "Willis Tower", "the Riverwalk"] },
  { code: "MIA", city: "Miami", country: "United States", airport: "Miami Intl", lat: 25.79, lon: -80.29, costIndex: 1.25, neighborhoods: ["South Beach", "Brickell", "Wynwood", "Little Havana", "Coconut Grove"], landmarks: ["Wynwood Walls", "Ocean Drive", "Vizcaya", "Everglades", "Bayside"] },
  { code: "SEA", city: "Seattle", country: "United States", airport: "Seattle-Tacoma Intl", lat: 47.45, lon: -122.31, costIndex: 1.3, neighborhoods: ["Downtown", "Capitol Hill", "Belltown", "Ballard", "Fremont"], landmarks: ["Pike Place Market", "Space Needle", "Chihuly Garden", "Kerry Park", "Discovery Park"] },
  { code: "BOS", city: "Boston", country: "United States", airport: "Logan Intl", lat: 42.36, lon: -71.01, costIndex: 1.35, neighborhoods: ["Back Bay", "Beacon Hill", "North End", "Seaport", "Cambridge"], landmarks: ["Freedom Trail", "Fenway Park", "Boston Common", "Harvard Yard", "Quincy Market"] },
  { code: "DEN", city: "Denver", country: "United States", airport: "Denver Intl", lat: 39.86, lon: -104.67, costIndex: 1.1, neighborhoods: ["LoDo", "RiNo", "Capitol Hill", "Highlands", "Cherry Creek"], landmarks: ["Red Rocks", "Union Station", "Larimer Square", "Denver Art Museum", "Rocky Mountain foothills"] },
  { code: "YYZ", city: "Toronto", country: "Canada", airport: "Pearson Intl", lat: 43.68, lon: -79.63, costIndex: 1.15, neighborhoods: ["Downtown", "Yorkville", "Distillery District", "Kensington", "Queen West"], landmarks: ["CN Tower", "St. Lawrence Market", "the ROM", "Toronto Islands", "Casa Loma"] },
  { code: "YVR", city: "Vancouver", country: "Canada", airport: "Vancouver Intl", lat: 49.19, lon: -123.18, costIndex: 1.2, neighborhoods: ["Gastown", "Yaletown", "Kitsilano", "West End", "Mount Pleasant"], landmarks: ["Stanley Park", "Granville Island", "Capilano Bridge", "Grouse Mountain", "English Bay"] },
  { code: "MEX", city: "Mexico City", country: "Mexico", airport: "Benito Juárez Intl", lat: 19.44, lon: -99.07, costIndex: 0.6, neighborhoods: ["Roma Norte", "Condesa", "Polanco", "Centro Histórico", "Coyoacán"], landmarks: ["Zócalo", "Chapultepec", "Frida Kahlo Museum", "Teotihuacan", "Xochimilco"] },
  { code: "CUN", city: "Cancún", country: "Mexico", airport: "Cancún Intl", lat: 21.04, lon: -86.87, costIndex: 0.85, neighborhoods: ["Hotel Zone", "Downtown", "Puerto Juárez", "Playa del Carmen", "Isla Mujeres"], landmarks: ["Chichén Itzá", "cenotes", "Tulum ruins", "Isla Mujeres", "the MUSA underwater museum"] },
  { code: "LHR", city: "London", country: "United Kingdom", airport: "Heathrow", lat: 51.47, lon: -0.45, costIndex: 1.45, neighborhoods: ["Covent Garden", "Shoreditch", "South Kensington", "Soho", "Southbank"], landmarks: ["the British Museum", "Tower of London", "Westminster", "Borough Market", "Tate Modern"] },
  { code: "CDG", city: "Paris", country: "France", airport: "Charles de Gaulle", lat: 49.01, lon: 2.55, costIndex: 1.35, neighborhoods: ["Le Marais", "Saint-Germain", "Montmartre", "Latin Quarter", "Canal Saint-Martin"], landmarks: ["the Louvre", "Eiffel Tower", "Musée d'Orsay", "Sacré-Cœur", "Versailles"] },
  { code: "AMS", city: "Amsterdam", country: "Netherlands", airport: "Schiphol", lat: 52.31, lon: 4.76, costIndex: 1.3, neighborhoods: ["Jordaan", "De Pijp", "Canal Ring", "Oud-West", "Noord"], landmarks: ["the Rijksmuseum", "Anne Frank House", "Van Gogh Museum", "Vondelpark", "the canals"] },
  { code: "FCO", city: "Rome", country: "Italy", airport: "Fiumicino", lat: 41.8, lon: 12.25, costIndex: 1.1, neighborhoods: ["Trastevere", "Monti", "Centro Storico", "Prati", "Testaccio"], landmarks: ["the Colosseum", "Vatican Museums", "Pantheon", "Trevi Fountain", "Roman Forum"] },
  { code: "BCN", city: "Barcelona", country: "Spain", airport: "El Prat", lat: 41.3, lon: 2.08, costIndex: 1.05, neighborhoods: ["Gothic Quarter", "El Born", "Eixample", "Gràcia", "Barceloneta"], landmarks: ["Sagrada Família", "Park Güell", "La Rambla", "Casa Batlló", "Montjuïc"] },
  { code: "LIS", city: "Lisbon", country: "Portugal", airport: "Humberto Delgado", lat: 38.77, lon: -9.13, costIndex: 0.9, neighborhoods: ["Alfama", "Baixa", "Chiado", "Bairro Alto", "Belém"], landmarks: ["Belém Tower", "São Jorge Castle", "Tram 28", "Jerónimos Monastery", "Sintra"] },
  { code: "BER", city: "Berlin", country: "Germany", airport: "Brandenburg", lat: 52.37, lon: 13.5, costIndex: 1.05, neighborhoods: ["Mitte", "Kreuzberg", "Prenzlauer Berg", "Friedrichshain", "Neukölln"], landmarks: ["Brandenburg Gate", "Museum Island", "East Side Gallery", "the Reichstag", "Tempelhof Field"] },
  { code: "ATH", city: "Athens", country: "Greece", airport: "Athens Intl", lat: 37.94, lon: 23.94, costIndex: 0.85, neighborhoods: ["Plaka", "Monastiraki", "Koukaki", "Kolonaki", "Psyrri"], landmarks: ["the Acropolis", "the Parthenon", "Ancient Agora", "Lycabettus Hill", "Cape Sounion"] },
  { code: "IST", city: "Istanbul", country: "Türkiye", airport: "Istanbul Airport", lat: 41.26, lon: 28.74, costIndex: 0.7, neighborhoods: ["Sultanahmet", "Beyoğlu", "Karaköy", "Kadıköy", "Beşiktaş"], landmarks: ["Hagia Sophia", "the Blue Mosque", "Grand Bazaar", "Topkapı Palace", "the Bosphorus"] },
  { code: "KEF", city: "Reykjavík", country: "Iceland", airport: "Keflavík Intl", lat: 63.98, lon: -22.61, costIndex: 1.6, neighborhoods: ["Miðborg", "Vesturbær", "Laugardalur", "Hlíðar", "Old Harbour"], landmarks: ["the Golden Circle", "Blue Lagoon", "Hallgrímskirkja", "Harpa", "the northern lights"] },
  { code: "DXB", city: "Dubai", country: "United Arab Emirates", airport: "Dubai Intl", lat: 25.25, lon: 55.36, costIndex: 1.3, neighborhoods: ["Downtown", "Dubai Marina", "Deira", "Jumeirah", "Al Fahidi"], landmarks: ["Burj Khalifa", "the Dubai Mall", "the desert dunes", "Dubai Creek", "Palm Jumeirah"] },
  { code: "NRT", city: "Tokyo", country: "Japan", airport: "Narita Intl", lat: 35.77, lon: 140.39, costIndex: 1.15, neighborhoods: ["Shinjuku", "Shibuya", "Asakusa", "Ginza", "Roppongi"], landmarks: ["Senso-ji", "Meiji Shrine", "Tsukiji Outer Market", "teamLab", "Shibuya Crossing"] },
  { code: "KIX", city: "Osaka", country: "Japan", airport: "Kansai Intl", lat: 34.43, lon: 135.24, costIndex: 1.0, neighborhoods: ["Namba", "Umeda", "Shinsekai", "Tennoji", "Kita"], landmarks: ["Osaka Castle", "Dotonbori", "Kyoto day trip", "Nara deer park", "Kuromon Market"] },
  { code: "ICN", city: "Seoul", country: "South Korea", airport: "Incheon Intl", lat: 37.46, lon: 126.44, costIndex: 1.0, neighborhoods: ["Myeongdong", "Hongdae", "Gangnam", "Insadong", "Itaewon"], landmarks: ["Gyeongbokgung Palace", "Bukchon Hanok Village", "N Seoul Tower", "Gwangjang Market", "the DMZ"] },
  { code: "BKK", city: "Bangkok", country: "Thailand", airport: "Suvarnabhumi", lat: 13.69, lon: 100.75, costIndex: 0.55, neighborhoods: ["Sukhumvit", "Silom", "Old Town", "Riverside", "Ari"], landmarks: ["the Grand Palace", "Wat Arun", "Chatuchak Market", "the floating markets", "Chinatown"] },
  { code: "SIN", city: "Singapore", country: "Singapore", airport: "Changi", lat: 1.36, lon: 103.99, costIndex: 1.4, neighborhoods: ["Marina Bay", "Chinatown", "Kampong Glam", "Orchard", "Tiong Bahru"], landmarks: ["Gardens by the Bay", "Marina Bay Sands", "Sentosa", "hawker centres", "the Botanic Gardens"] },
  { code: "DPS", city: "Bali", country: "Indonesia", airport: "Ngurah Rai Intl", lat: -8.75, lon: 115.17, costIndex: 0.5, neighborhoods: ["Seminyak", "Ubud", "Canggu", "Uluwatu", "Sanur"], landmarks: ["Tegallalang rice terraces", "Uluwatu Temple", "Mount Batur", "the Sacred Monkey Forest", "Nusa Penida"] },
  { code: "SYD", city: "Sydney", country: "Australia", airport: "Kingsford Smith", lat: -33.95, lon: 151.18, costIndex: 1.35, neighborhoods: ["Circular Quay", "Surry Hills", "Bondi", "The Rocks", "Darling Harbour"], landmarks: ["the Opera House", "Harbour Bridge", "Bondi to Coogee walk", "the Blue Mountains", "Taronga Zoo"] },
  { code: "CPT", city: "Cape Town", country: "South Africa", airport: "Cape Town Intl", lat: -33.97, lon: 18.6, costIndex: 0.65, neighborhoods: ["City Bowl", "V&A Waterfront", "Camps Bay", "Bo-Kaap", "Woodstock"], landmarks: ["Table Mountain", "Cape of Good Hope", "Robben Island", "Boulders Beach", "the Winelands"] },
  { code: "GRU", city: "São Paulo", country: "Brazil", airport: "Guarulhos Intl", lat: -23.43, lon: -46.47, costIndex: 0.7, neighborhoods: ["Jardins", "Vila Madalena", "Pinheiros", "Centro", "Itaim Bibi"], landmarks: ["Avenida Paulista", "Ibirapuera Park", "Beco do Batman", "the Municipal Market", "MASP"] },
  { code: "EZE", city: "Buenos Aires", country: "Argentina", airport: "Ezeiza Intl", lat: -34.82, lon: -58.54, costIndex: 0.6, neighborhoods: ["Palermo", "Recoleta", "San Telmo", "La Boca", "Puerto Madero"], landmarks: ["Recoleta Cemetery", "Caminito", "Teatro Colón", "Plaza de Mayo", "a tango hall"] },
  { code: "LIM", city: "Lima", country: "Peru", airport: "Jorge Chávez Intl", lat: -12.02, lon: -77.11, costIndex: 0.6, neighborhoods: ["Miraflores", "Barranco", "San Isidro", "Centro", "Pueblo Libre"], landmarks: ["the Malecón", "Huaca Pucllana", "Plaza Mayor", "Larco Museum", "Machu Picchu (via Cusco)"] },
  { code: "HNL", city: "Honolulu", country: "United States", airport: "Daniel K. Inouye Intl", lat: 21.32, lon: -157.92, costIndex: 1.45, neighborhoods: ["Waikiki", "Kaka'ako", "Chinatown", "Kailua", "North Shore"], landmarks: ["Diamond Head", "Pearl Harbor", "Hanauma Bay", "the North Shore", "Waikiki Beach"] },
];

const byCode = new Map(PLACES.map((p) => [p.code, p]));

/**
 * Resolve free text ("tokyo", "NRT", "Tokyo, Japan") to a known place.
 * Unknown places get a synthetic entry so searches still return something.
 */
export function resolvePlace(query: string): MockPlace {
  const q = query.trim().toLowerCase();
  const exact = byCode.get(q.toUpperCase());
  if (exact) return exact;
  const match =
    PLACES.find((p) => p.city.toLowerCase() === q) ??
    PLACES.find((p) => q.startsWith(p.city.toLowerCase()) || p.city.toLowerCase().startsWith(q)) ??
    PLACES.find((p) => q.includes(p.city.toLowerCase()) || p.country.toLowerCase() === q);
  if (match) return match;

  const city = query.trim().replace(/\b\w/g, (c) => c.toUpperCase()) || "Somewhere";
  const code = city.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  return {
    code,
    city,
    country: "",
    airport: `${city} Airport`,
    lat: 0,
    lon: 0,
    costIndex: 1,
    neighborhoods: ["City Centre", "Old Town", "Riverside", "Arts District", "Harbour"],
    landmarks: ["the old town", "the main square", "the city museum", "the waterfront", "the local market"],
  };
}

export function searchPlaces(query: string, limit = 8): MockPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return PLACES.slice(0, limit);
  return PLACES.filter(
    (p) =>
      p.code.toLowerCase().startsWith(q) ||
      p.city.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q),
  ).slice(0, limit);
}

/** Great-circle distance in km. */
export function distanceKm(a: MockPlace, b: MockPlace): number {
  if ((a.lat === 0 && a.lon === 0) || (b.lat === 0 && b.lon === 0)) return 2500;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
