// Trimmed responses in the shape documented at serpapi.com/google-flights-api
// and serpapi.com/google-hotels-api.

export const googleFlights = {
  best_flights: [
    {
      flights: [
        {
          departure_airport: { name: "San Francisco International Airport", id: "SFO", time: "2027-04-01 11:05" },
          arrival_airport: { name: "Narita International Airport", id: "NRT", time: "2027-04-02 14:35" },
          duration: 690,
          airplane: "Boeing 787",
          airline: "United",
          flight_number: "UA 837",
          travel_class: "Economy",
          legroom: "31 in",
        },
      ],
      total_duration: 690,
      carbon_emissions: { this_flight: 600000, typical_for_this_route: 700000, difference_percent: -14 },
      price: 1840,
      type: "Round trip",
      departure_token: "tok-1",
    },
  ],
  other_flights: [
    {
      flights: [
        {
          departure_airport: { name: "San Francisco International Airport", id: "SFO", time: "2027-04-01 13:00" },
          arrival_airport: { name: "Seattle-Tacoma International Airport", id: "SEA", time: "2027-04-01 15:10" },
          duration: 130,
          airline: "Alaska",
          flight_number: "AS 1234",
        },
        {
          departure_airport: { name: "Seattle-Tacoma International Airport", id: "SEA", time: "2027-04-01 16:40" },
          arrival_airport: { name: "Narita International Airport", id: "NRT", time: "2027-04-02 19:20" },
          duration: 640,
          airline: "Japan Airlines",
          flight_number: "JL 67",
        },
      ],
      layovers: [{ duration: 90, name: "Seattle-Tacoma International Airport", id: "SEA" }],
      total_duration: 860,
      price: 1420,
      type: "Round trip",
    },
  ],
  price_insights: { lowest_price: 1420, price_level: "low", typical_price_range: [1500, 2300] },
};

export const googleHotels = {
  properties: [
    {
      type: "hotel",
      name: "Andaz Tokyo Toranomon Hills",
      property_token: "ChcIabc",
      link: "https://www.hyatt.com/andaz/tyoaz",
      gps_coordinates: { latitude: 35.6672, longitude: 139.7497 },
      check_in_time: "3:00 PM",
      check_out_time: "12:00 PM",
      rate_per_night: { lowest: "$610", extracted_lowest: 610 },
      total_rate: { lowest: "$4,270", extracted_lowest: 4270 },
      prices: [
        { source: "Hotels.com", rate_per_night: { extracted_lowest: 598 }, total_rate: { extracted_lowest: 4186 }, link: "https://www.hotels.com/ho123" },
        { source: "Hyatt", rate_per_night: { extracted_lowest: 610 }, free_cancellation: true },
        { source: "Expedia.com", rate_per_night: { extracted_lowest: 605 }, total_rate: { extracted_lowest: 4235 } },
      ],
      overall_rating: 4.7,
      reviews: 1830,
      extracted_hotel_class: 5,
      amenities: ["Free Wi-Fi", "Pool", "Spa"],
      images: [{ thumbnail: "https://example.com/andaz.jpg" }],
    },
    {
      type: "hotel",
      name: "Hotel Gracery Shinjuku",
      property_token: "ChcIdef",
      rate_per_night: { lowest: "$140", extracted_lowest: 140 },
      overall_rating: 4.2,
      reviews: 9000,
    },
    { type: "hotel", name: "Sold Out Inn" },
  ],
};
