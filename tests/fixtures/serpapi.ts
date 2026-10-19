// Trimmed response in the shape documented at serpapi.com/google-flights-api.

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
