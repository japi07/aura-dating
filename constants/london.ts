/**
 * London-specific constants — neighbourhoods, venues, real coordinates.
 * Used across proposals, events, profile location autocomplete, etc.
 */

export const LONDON_AREAS = [
  // Central
  'Soho', 'Mayfair', 'Marylebone', 'Fitzrovia', 'Bloomsbury', 'Covent Garden',
  'Holborn', 'Westminster', 'Belgravia', 'Knightsbridge', 'Chelsea', 'Pimlico',
  // East
  'Shoreditch', 'Hoxton', 'Spitalfields', 'Hackney', 'Bethnal Green', 'Dalston',
  'London Fields', 'Stoke Newington', 'Whitechapel', 'Wapping', 'Canary Wharf',
  // North
  'Islington', 'King\'s Cross', 'Camden', 'Primrose Hill', 'Hampstead', 'Highgate',
  'Belsize Park', 'Angel', 'Stoke Newington',
  // West
  'Notting Hill', 'Kensington', 'South Kensington', 'Holland Park', 'Bayswater',
  'Hammersmith', 'Fulham', 'Maida Vale', 'Paddington', 'Earl\'s Court',
  // South
  'Brixton', 'Clapham', 'Battersea', 'Vauxhall', 'Borough', 'Bermondsey',
  'Greenwich', 'Peckham', 'Dulwich', 'Wimbledon', 'Putney',
] as const;

export const LONDON_CENTER = { lat: 51.5074, lng: -0.1278 };

/**
 * Curated, realistic date venues with full addresses, neighbourhoods, postcodes
 * and tube stations. These are real places — used for proposals.
 */
export interface Venue {
  id: string;
  name: string;
  category: 'dinner' | 'lunch' | 'coffee' | 'drinks' | 'walk' | 'gallery' | 'cooking' | 'concert' | 'workshop' | 'sport';
  emoji: string;
  area: string;
  address: string;
  postcode: string;
  tube: string;
  priceRange: '££' | '£££' | '££££';
  lat: number;
  lng: number;
  description?: string;
}

export const LONDON_VENUES: Venue[] = [
  // Dinner
  { id: 'v_dishoom_sho', name: 'Dishoom Shoreditch', category: 'dinner', emoji: '🍛', area: 'Shoreditch', address: '7 Boundary St', postcode: 'E2 7JE', tube: 'Shoreditch High St', priceRange: '££', lat: 51.5253, lng: -0.0758, description: 'Bombay-style café — booking essential' },
  { id: 'v_padella', name: 'Padella', category: 'dinner', emoji: '🍝', area: 'Borough', address: '6 Southwark St', postcode: 'SE1 1TQ', tube: 'London Bridge', priceRange: '££', lat: 51.5051, lng: -0.0895, description: 'Hand-rolled pasta, walk-in only' },
  { id: 'v_sketch', name: 'Sketch', category: 'dinner', emoji: '🌸', area: 'Mayfair', address: '9 Conduit St', postcode: 'W1S 2XG', tube: 'Oxford Circus', priceRange: '££££', lat: 51.5132, lng: -0.1411, description: 'Iconic pink dining room' },
  { id: 'v_ivy_chelsea', name: 'The Ivy Chelsea Garden', category: 'dinner', emoji: '🌿', area: 'Chelsea', address: '195-197 King\'s Rd', postcode: 'SW3 5ED', tube: 'Sloane Square', priceRange: '£££', lat: 51.4868, lng: -0.1681 },
  { id: 'v_brat', name: 'Brat', category: 'dinner', emoji: '🔥', area: 'Shoreditch', address: '4 Redchurch St', postcode: 'E1 6JL', tube: 'Shoreditch High St', priceRange: '£££', lat: 51.5236, lng: -0.0743 },
  { id: 'v_kiln', name: 'Kiln', category: 'dinner', emoji: '🌶️', area: 'Soho', address: '58 Brewer St', postcode: 'W1F 9TL', tube: 'Piccadilly Circus', priceRange: '££', lat: 51.5117, lng: -0.1374 },

  // Coffee
  { id: 'v_monmouth', name: 'Monmouth Coffee', category: 'coffee', emoji: '☕', area: 'Borough', address: '2 Park St', postcode: 'SE1 9AB', tube: 'London Bridge', priceRange: '££', lat: 51.5049, lng: -0.0907, description: 'Cult-favourite specialty coffee' },
  { id: 'v_workshop', name: 'Workshop Coffee', category: 'coffee', emoji: '☕', area: 'Marylebone', address: '75 Wigmore St', postcode: 'W1U 1QD', tube: 'Bond Street', priceRange: '££', lat: 51.5180, lng: -0.1521 },
  { id: 'v_origin', name: 'Origin Coffee', category: 'coffee', emoji: '☕', area: 'Shoreditch', address: '65 Charlotte Rd', postcode: 'EC2A 3PE', tube: 'Old Street', priceRange: '££', lat: 51.5256, lng: -0.0820 },
  { id: 'v_kaffeine', name: 'Kaffeine', category: 'coffee', emoji: '☕', area: 'Fitzrovia', address: '66 Great Titchfield St', postcode: 'W1W 7QJ', tube: 'Oxford Circus', priceRange: '££', lat: 51.5187, lng: -0.1410 },

  // Drinks
  { id: 'v_lyaness', name: 'Lyaness', category: 'drinks', emoji: '🍸', area: 'South Bank', address: '20 Upper Ground', postcode: 'SE1 9PD', tube: 'Waterloo', priceRange: '£££', lat: 51.5076, lng: -0.1136, description: 'Cocktails by Mr Lyan' },
  { id: 'v_connaught', name: 'Connaught Bar', category: 'drinks', emoji: '🍸', area: 'Mayfair', address: 'Carlos Pl', postcode: 'W1K 2AL', tube: 'Bond Street', priceRange: '££££', lat: 51.5103, lng: -0.1488, description: 'World\'s best bar — book ahead' },
  { id: 'v_callooh', name: 'Callooh Callay', category: 'drinks', emoji: '🍹', area: 'Shoreditch', address: '65 Rivington St', postcode: 'EC2A 3AY', tube: 'Old Street', priceRange: '£££', lat: 51.5255, lng: -0.0795 },
  { id: 'v_tayer', name: 'Tayer + Elementary', category: 'drinks', emoji: '🍸', area: 'Old Street', address: '152 Old St', postcode: 'EC1V 9BW', tube: 'Old Street', priceRange: '£££', lat: 51.5260, lng: -0.0871 },

  // Galleries & culture
  { id: 'v_tate_modern', name: 'Tate Modern', category: 'gallery', emoji: '🎨', area: 'Bankside', address: 'Bankside', postcode: 'SE1 9TG', tube: 'Blackfriars', priceRange: '££', lat: 51.5076, lng: -0.0994 },
  { id: 'v_natgallery', name: 'National Gallery', category: 'gallery', emoji: '🖼️', area: 'Westminster', address: 'Trafalgar Sq', postcode: 'WC2N 5DN', tube: 'Charing Cross', priceRange: '££', lat: 51.5089, lng: -0.1283 },
  { id: 'v_courtauld', name: 'The Courtauld', category: 'gallery', emoji: '🖼️', area: 'Strand', address: 'Somerset House, Strand', postcode: 'WC2R 0RN', tube: 'Temple', priceRange: '££', lat: 51.5114, lng: -0.1175 },
  { id: 'v_saatchi', name: 'Saatchi Gallery', category: 'gallery', emoji: '🎨', area: 'Chelsea', address: 'Duke of York\'s HQ, King\'s Rd', postcode: 'SW3 4RY', tube: 'Sloane Square', priceRange: '££', lat: 51.4926, lng: -0.1583 },

  // Walks
  { id: 'v_hyde_park', name: 'Hyde Park', category: 'walk', emoji: '🌳', area: 'Hyde Park', address: 'Hyde Park', postcode: 'W2 2UH', tube: 'Lancaster Gate', priceRange: '££', lat: 51.5074, lng: -0.1657 },
  { id: 'v_regents_park', name: 'Regent\'s Park', category: 'walk', emoji: '🌷', area: 'Regent\'s Park', address: 'Regent\'s Park', postcode: 'NW1 4NR', tube: 'Regent\'s Park', priceRange: '££', lat: 51.5314, lng: -0.1570 },
  { id: 'v_hampstead', name: 'Hampstead Heath', category: 'walk', emoji: '🌲', area: 'Hampstead', address: 'Hampstead Heath', postcode: 'NW3 1TH', tube: 'Hampstead', priceRange: '££', lat: 51.5608, lng: -0.1640 },
  { id: 'v_columbia', name: 'Columbia Road Flower Market', category: 'walk', emoji: '💐', area: 'Bethnal Green', address: 'Columbia Rd', postcode: 'E2 7RG', tube: 'Hoxton', priceRange: '££', lat: 51.5295, lng: -0.0703, description: 'Sunday flower market' },

  // Cooking & workshops
  { id: 'v_la_cuisine', name: 'L\'atelier des Chefs', category: 'cooking', emoji: '👨‍🍳', area: 'Soho', address: '19 Wigmore St', postcode: 'W1U 1PH', tube: 'Bond Street', priceRange: '£££', lat: 51.5169, lng: -0.1492 },
  { id: 'v_pottery_west', name: 'Turning Earth', category: 'workshop', emoji: '🏺', area: 'Hoxton', address: '11-15 Argall Way', postcode: 'E10 7QF', tube: 'Leyton', priceRange: '£££', lat: 51.5654, lng: -0.0091 },
];

/** Group venues by category for proposal generation */
export function venuesByCategory(category: Venue['category']) {
  return LONDON_VENUES.filter(v => v.category === category);
}

/** Get a random venue from a category */
export function randomVenue(category: Venue['category']): Venue | undefined {
  const list = venuesByCategory(category);
  return list[Math.floor(Math.random() * list.length)];
}

/** Find venue by id */
export function venueById(id: string) {
  return LONDON_VENUES.find(v => v.id === id);
}
