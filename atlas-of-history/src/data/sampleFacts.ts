export interface Fact {
  id: string;
  country_code: string;
  country_name: string;
  title: string;
  body: string;
  year: number | null;
  lat: number;
  lng: number;
  image_url: string | null;
  reference_url: string | null;
  reference_label: string | null;
}

export const sampleFacts: Fact[] = [
  {
    id: '1',
    country_code: 'EGY',
    country_name: 'Egypt',
    title: 'Great Pyramid of Giza completed',
    body: 'The Great Pyramid of Giza, built as a tomb for Pharaoh Khufu, was completed around 2560 BCE. It stood as the tallest man-made structure in the world for over 3,800 years.',
    year: -2560,
    lat: 29.9792,
    lng: 31.1342,
    image_url: null,
    reference_url: 'https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza',
    reference_label: 'Wikipedia',
  },
  {
    id: '2',
    country_code: 'GRC',
    country_name: 'Greece',
    title: 'First Olympic Games held',
    body: 'The ancient Olympic Games were first held in Olympia, Greece in 776 BCE. Athletes from across the Greek world competed in events like running, discus, and wrestling to honour Zeus.',
    year: -776,
    lat: 37.6379,
    lng: 21.6300,
    image_url: null,
    reference_url: 'https://en.wikipedia.org/wiki/Ancient_Olympic_Games',
    reference_label: 'Wikipedia',
  },
  {
    id: '3',
    country_code: 'CHN',
    country_name: 'China',
    title: 'Great Wall construction begins',
    body: 'Large-scale construction of the Great Wall of China began under the Qin dynasty around 221 BCE when Emperor Qin Shi Huang unified China and ordered the walls to be connected and extended to defend against northern invasions.',
    year: -221,
    lat: 40.4319,
    lng: 116.5704,
    image_url: null,
    reference_url: 'https://en.wikipedia.org/wiki/Great_Wall_of_China',
    reference_label: 'Wikipedia',
  },
  {
    id: '4',
    country_code: 'ITA',
    country_name: 'Italy',
    title: 'The Colosseum opens',
    body: 'The Flavian Amphitheatre, known today as the Colosseum, was inaugurated in Rome in 80 CE under Emperor Titus. It could seat up to 80,000 spectators and hosted gladiatorial contests, animal hunts, and public spectacles.',
    year: 80,
    lat: 41.8902,
    lng: 12.4922,
    image_url: null,
    reference_url: 'https://en.wikipedia.org/wiki/Colosseum',
    reference_label: 'Wikipedia',
  },
];
