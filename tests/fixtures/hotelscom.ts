// Trimmed responses in the shape the Hotels.com Provider API (RapidAPI)
// documents for /v2/regions and /v2/hotels/search.

export const hotelsComRegions = {
  query: "Tokyo",
  data: [
    { "@type": "gaiaRegionResult", gaiaId: "179900", type: "CITY", regionNames: { fullName: "Tokyo, Tokyo Prefecture, Japan", shortName: "Tokyo" } },
    { "@type": "gaiaRegionResult", gaiaId: "6054439", type: "NEIGHBORHOOD", regionNames: { fullName: "Shinjuku, Tokyo, Japan", shortName: "Shinjuku" } },
  ],
};

export const hotelsComHotelRegions = {
  query: "Andaz Tokyo, Tokyo",
  data: [
    { "@type": "gaiaHotelResult", type: "HOTEL", hotelId: "13304906", regionNames: { fullName: "Andaz Tokyo Toranomon Hills, Tokyo, Japan" } },
    { "@type": "gaiaRegionResult", gaiaId: "179900", type: "CITY", regionNames: { fullName: "Tokyo, Tokyo Prefecture, Japan" } },
  ],
};

export const hotelsComSearch = {
  properties: [
    {
      id: "1167834",
      name: "Hotel Gracery Shinjuku",
      star: 3,
      reviews: { score: 8.6, total: 4120 },
      neighborhood: { name: "Shinjuku" },
      mapMarker: { latLong: { latitude: 35.6948, longitude: 139.7016 } },
      propertyImage: { image: { url: "https://images.trvl-media.com/gracery.jpg" } },
      price: { lead: { amount: 140.2, formatted: "$140" }, displayMessages: [{ lineItems: [{ value: "$1,002 total" }] }] },
      offerSummary: { messages: [{ message: "Fully refundable" }] },
    },
    {
      id: "13304906",
      name: "Andaz Tokyo Toranomon Hills",
      star: 5,
      reviews: { score: 9.4, total: 980 },
      neighborhood: { name: "Toranomon" },
      mapMarker: { latLong: { latitude: 35.6672, longitude: 139.7497 } },
      price: { lead: { amount: 610, formatted: "$610" } },
      offerSummary: { messages: [{ message: "Free cancellation" }] },
    },
    // No rate for these dates: dropped.
    { id: "999", name: "Sold Out Inn", price: {} },
  ],
};
