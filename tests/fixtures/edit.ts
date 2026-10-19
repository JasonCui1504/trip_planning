// A trimmed copy of the structure of edithotelsearch.com's page.
const HOTELS = [
  { name: "Andaz Tokyo Toranomon Hills", id: "438839", location: "Tokyo, Japan", brand: "Hyatt", region: "Asia Pacific" },
  { name: "InterContinental Tokyo Bay", id: "1", location: "Tokyo, Japan", brand: "IHG", region: "Asia Pacific" },
  { name: "1 Hotel San Francisco", id: "4482399", location: "San Francisco, California, US", brand: "1 Hotels", region: "North America" },
];

export const editPage = `<!DOCTYPE html><html><head><title>The Edit — Hotel Search</title></head><body>
<script>
const HOTELS_RAW = ${JSON.stringify(HOTELS)};

const SELECT_BRANDS = ['IHG','Omni','Virgin Hotels','Montage','Pendry','Minor Hotels','Pan Pacific'];
</script></body></html>`;
