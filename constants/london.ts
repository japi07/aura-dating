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

/**
 * Thematic venue choices for a proposal.
 *
 * Deliberately a *type* of place rather than a specific restaurant: the sender
 * picks the vibe, and the actual booking is arranged separately. Far less
 * pressure than committing to one address up front, and it keeps the proposal
 * about the idea rather than the logistics.
 */
export interface VenueTheme {
  key: string;
  label: string;
  emoji: string;
  /** Which date type this belongs under */
  dateType: 'Dinner' | 'Coffee' | 'Drinks' | 'Nature' | 'Activity';
}

export const VENUE_THEMES: VenueTheme[] = [
  // Dinner
  { key: 'italian', label: 'Italian', emoji: '🍝', dateType: 'Dinner' },
  { key: 'japanese', label: 'Japanese', emoji: '🍣', dateType: 'Dinner' },
  { key: 'indian', label: 'Indian', emoji: '🍛', dateType: 'Dinner' },
  { key: 'spanish', label: 'Spanish / tapas', emoji: '🥘', dateType: 'Dinner' },
  { key: 'british', label: 'Modern British', emoji: '🍽️', dateType: 'Dinner' },
  { key: 'middle-eastern', label: 'Middle Eastern', emoji: '🫓', dateType: 'Dinner' },
  { key: 'asian', label: 'Thai / Vietnamese', emoji: '🍜', dateType: 'Dinner' },
  { key: 'steak', label: 'Steak & grill', emoji: '🥩', dateType: 'Dinner' },
  { key: 'seafood', label: 'Seafood', emoji: '🦞', dateType: 'Dinner' },
  { key: 'veggie', label: 'Vegetarian / vegan', emoji: '🥗', dateType: 'Dinner' },

  // Coffee
  { key: 'coffee-shop', label: 'Speciality coffee', emoji: '☕', dateType: 'Coffee' },
  { key: 'brunch', label: 'Brunch', emoji: '🥞', dateType: 'Coffee' },
  { key: 'bakery', label: 'Bakery & pastries', emoji: '🥐', dateType: 'Coffee' },
  { key: 'tea', label: 'Afternoon tea', emoji: '🫖', dateType: 'Coffee' },

  // Drinks
  { key: 'cocktails', label: 'Cocktail bar', emoji: '🍸', dateType: 'Drinks' },
  { key: 'wine-bar', label: 'Wine bar', emoji: '🍷', dateType: 'Drinks' },
  { key: 'pub', label: 'Proper pub', emoji: '🍺', dateType: 'Drinks' },
  { key: 'rooftop', label: 'Rooftop bar', emoji: '🌆', dateType: 'Drinks' },

  // Nature
  { key: 'park', label: 'Park walk', emoji: '🌳', dateType: 'Nature' },
  { key: 'riverside', label: 'Riverside walk', emoji: '🌉', dateType: 'Nature' },
  { key: 'canal', label: 'Canal walk', emoji: '🚤', dateType: 'Nature' },
  { key: 'garden', label: 'Botanical garden', emoji: '🌺', dateType: 'Nature' },
  { key: 'heath', label: 'Heath & woodland', emoji: '🌲', dateType: 'Nature' },
  { key: 'market', label: 'Market wander', emoji: '💐', dateType: 'Nature' },

  // Activity
  { key: 'gallery', label: 'Art gallery', emoji: '🖼️', dateType: 'Activity' },
  { key: 'museum', label: 'Museum', emoji: '🏛️', dateType: 'Activity' },
  { key: 'cooking', label: 'Cooking class', emoji: '👨‍🍳', dateType: 'Activity' },
  { key: 'pottery', label: 'Pottery / crafts', emoji: '🏺', dateType: 'Activity' },
  { key: 'comedy', label: 'Comedy night', emoji: '🎤', dateType: 'Activity' },
  { key: 'live-music', label: 'Live music', emoji: '🎷', dateType: 'Activity' },
  { key: 'cinema', label: 'Cinema', emoji: '🎬', dateType: 'Activity' },
];

export const LONDON_VENUES: Venue[] = [
  // Dinner
  { id: 'v_dishoom_sho', name: 'Dishoom Shoreditch', category: 'dinner', emoji: '🍛', area: 'Shoreditch', address: '7 Boundary St', postcode: 'E2 7JE', tube: 'Shoreditch High St', priceRange: '££', lat: 51.5253, lng: -0.0758, description: 'Bombay-style café — booking essential' },
  { id: 'v_padella', name: 'Padella', category: 'dinner', emoji: '🍝', area: 'Borough', address: '6 Southwark St', postcode: 'SE1 1TQ', tube: 'London Bridge', priceRange: '££', lat: 51.5051, lng: -0.0895, description: 'Hand-rolled pasta, walk-in only' },
  { id: 'v_sketch', name: 'Sketch', category: 'dinner', emoji: '🌸', area: 'Mayfair', address: '9 Conduit St', postcode: 'W1S 2XG', tube: 'Oxford Circus', priceRange: '££££', lat: 51.5132, lng: -0.1411, description: 'Iconic pink dining room' },
  { id: 'v_ivy_chelsea', name: 'The Ivy Chelsea Garden', category: 'dinner', emoji: '🌿', area: 'Chelsea', address: '195-197 King\'s Rd', postcode: 'SW3 5ED', tube: 'Sloane Square', priceRange: '£££', lat: 51.4868, lng: -0.1681 },
  { id: 'v_brat', name: 'Brat', category: 'dinner', emoji: '🔥', area: 'Shoreditch', address: '4 Redchurch St', postcode: 'E1 6JL', tube: 'Shoreditch High St', priceRange: '£££', lat: 51.5236, lng: -0.0743 },
  { id: 'v_kiln', name: 'Kiln', category: 'dinner', emoji: '🌶️', area: 'Soho', address: '58 Brewer St', postcode: 'W1F 9TL', tube: 'Piccadilly Circus', priceRange: '££', lat: 51.5117, lng: -0.1374 },
  { id: 'v_bancone', name: 'Bancone', category: 'dinner', emoji: '🍝', area: 'Covent Garden', address: '39 William IV St', postcode: 'WC2N 4DD', tube: 'Charing Cross', priceRange: '££', lat: 51.5090, lng: -0.1256, description: 'Silk handkerchief pasta — a proper crowd-pleaser' },
  { id: 'v_barrafina', name: 'Barrafina', category: 'dinner', emoji: '🦐', area: 'Soho', address: '26-27 Dean St', postcode: 'W1D 3LL', tube: 'Tottenham Court Rd', priceRange: '£££', lat: 51.5142, lng: -0.1327, description: 'Counter-seat Spanish — great for talking' },
  { id: 'v_flat_iron', name: 'Flat Iron', category: 'dinner', emoji: '🥩', area: 'Covent Garden', address: '17-18 Henrietta St', postcode: 'WC2E 8QH', tube: 'Covent Garden', priceRange: '££', lat: 51.5110, lng: -0.1229, description: 'Great steak, gentle prices' },
  { id: 'v_hoppers', name: 'Hoppers', category: 'dinner', emoji: '🥘', area: 'Soho', address: '49 Frith St', postcode: 'W1D 4SG', tube: 'Leicester Square', priceRange: '££', lat: 51.5136, lng: -0.1315, description: 'Sri Lankan small plates' },
  { id: 'v_gloria', name: 'Gloria', category: 'dinner', emoji: '🍋', area: 'Shoreditch', address: '54-56 Great Eastern St', postcode: 'EC2A 3QR', tube: 'Old Street', priceRange: '£££', lat: 51.5245, lng: -0.0810, description: 'Theatrical Italian — order the lemon meringue' },
  { id: 'v_smoking_goat', name: 'Smoking Goat', category: 'dinner', emoji: '🔥', area: 'Shoreditch', address: '64 Shoreditch High St', postcode: 'E1 6JJ', tube: 'Shoreditch High St', priceRange: '££', lat: 51.5240, lng: -0.0770, description: 'Thai barbecue, loud and fun' },
  { id: 'v_berenjak', name: 'Berenjak', category: 'dinner', emoji: '🫓', area: 'Soho', address: '27 Romilly St', postcode: 'W1D 5AL', tube: 'Leicester Square', priceRange: '££', lat: 51.5130, lng: -0.1315, description: 'Persian kebab house' },

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
  { id: 'v_vagabond_shore', name: 'Vagabond Wines, Shoreditch', category: 'drinks', emoji: '🍷', area: 'Shoreditch', address: '7-9 Bethnal Green Rd', postcode: 'E1 6LA', tube: 'Shoreditch High St', priceRange: '££', lat: 51.5241, lng: -0.0733, description: 'Self-pour wine taps — taste your way round, no pressure' },
  { id: 'v_vagabond_ftgn', name: 'Vagabond Wines, Fitzrovia', category: 'drinks', emoji: '🍷', area: 'Fitzrovia', address: '19 Charlotte St', postcode: 'W1T 1RL', tube: 'Goodge Street', priceRange: '££', lat: 51.5188, lng: -0.1354, description: 'Self-pour wine by the taste, glass or bottle' },
  { id: 'v_vagabond_battersea', name: 'Vagabond Wines, Battersea', category: 'drinks', emoji: '🍷', area: 'Battersea', address: '18-20 Battersea Rise', postcode: 'SW11 1ED', tube: 'Clapham Junction', priceRange: '££', lat: 51.4614, lng: -0.1670, description: 'The original Vagabond — relaxed and local' },
  { id: 'v_sager_wilde', name: 'Sager + Wilde', category: 'drinks', emoji: '🍇', area: 'Bethnal Green', address: '193 Hackney Rd', postcode: 'E2 8JL', tube: 'Hoxton', priceRange: '££', lat: 51.5302, lng: -0.0707, description: 'Natural wine bar, friendly staff' },
  { id: 'v_gordons', name: 'Gordon\'s Wine Bar', category: 'drinks', emoji: '🕯️', area: 'Embankment', address: '47 Villiers St', postcode: 'WC2N 6NE', tube: 'Embankment', priceRange: '££', lat: 51.5081, lng: -0.1240, description: 'Candlelit cellar, London\'s oldest wine bar' },
  { id: 'v_swift_soho', name: 'Swift', category: 'drinks', emoji: '🍸', area: 'Soho', address: '12 Old Compton St', postcode: 'W1D 4TQ', tube: 'Leicester Square', priceRange: '£££', lat: 51.5133, lng: -0.1310, description: 'Quick upstairs cocktail, jazz downstairs' },
  { id: 'v_coupette', name: 'Coupette', category: 'drinks', emoji: '🍏', area: 'Bethnal Green', address: '423 Bethnal Green Rd', postcode: 'E2 0AN', tube: 'Bethnal Green', priceRange: '£££', lat: 51.5266, lng: -0.0592, description: 'Calvados and apple cocktails' },
  { id: 'v_vagabond_charlotte', name: 'Vagabond Charlotte Street', category: 'drinks', emoji: '🍷', area: 'Fitzrovia', address: '74-77 Charlotte St', postcode: 'W1T 4QH', tube: 'Goodge Street', priceRange: '££', lat: 51.5212, lng: -0.1356, description: 'Self-pour wine bar — try 100+ wines by the glass' },
  { id: 'v_vagabond_battersea', name: 'Vagabond Battersea Power Station', category: 'drinks', emoji: '🍷', area: 'Battersea', address: 'Circus Rd West, Battersea Power Station', postcode: 'SW11 8DD', tube: 'Battersea Power Station', priceRange: '££', lat: 51.4810, lng: -0.1450, description: 'Self-pour wines with a Power Station view' },
  { id: 'v_vagabond_holland_park', name: 'Vagabond Holland Park', category: 'drinks', emoji: '🍷', area: 'Holland Park', address: '18-22 Holland Park Ave', postcode: 'W11 3RB', tube: 'Holland Park', priceRange: '££', lat: 51.5081, lng: -0.2052, description: 'Cosy west London branch of the self-pour wine bar' },

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
  { id: 'v_richmond_park', name: 'Richmond Park', category: 'walk', emoji: '🦌', area: 'Richmond', address: 'Richmond Park, Richmond Gate', postcode: 'TW10 5HS', tube: 'Richmond', priceRange: '££', lat: 51.4425, lng: -0.2731, description: 'Wild deer and big skies — the best long walk in London' },
  { id: 'v_kew', name: 'Kew Gardens', category: 'walk', emoji: '🌺', area: 'Kew', address: 'Kew Rd', postcode: 'TW9 3AE', tube: 'Kew Gardens', priceRange: '£££', lat: 51.4787, lng: -0.2956, description: 'Glasshouses and the treetop walkway (ticketed)' },
  { id: 'v_greenwich_park', name: 'Greenwich Park', category: 'walk', emoji: '🔭', area: 'Greenwich', address: 'Blackheath Ave', postcode: 'SE10 8QY', tube: 'Cutty Sark (DLR)', priceRange: '££', lat: 51.4769, lng: 0.0005, description: 'Uphill to the Observatory, then the whole city below you' },
  { id: 'v_primrose_hill', name: 'Primrose Hill', category: 'walk', emoji: '🌇', area: 'Primrose Hill', address: 'Primrose Hill Rd', postcode: 'NW3 3NA', tube: 'Chalk Farm', priceRange: '££', lat: 51.5387, lng: -0.1595, description: 'Short climb, unbeatable skyline — lovely at sunset' },
  { id: 'v_victoria_park', name: 'Victoria Park', category: 'walk', emoji: '🦢', area: 'Hackney', address: 'Grove Rd', postcode: 'E3 5TB', tube: 'Mile End', priceRange: '££', lat: 51.5362, lng: -0.0409, description: 'Lakes, cafés and the East End\'s favourite green space' },
  { id: 'v_battersea_park', name: 'Battersea Park', category: 'walk', emoji: '🌸', area: 'Battersea', address: 'Battersea Park', postcode: 'SW11 4NJ', tube: 'Battersea Power Station', priceRange: '££', lat: 51.4791, lng: -0.1567, description: 'Riverside paths, a pagoda and a proper café' },
  { id: 'v_little_venice', name: 'Little Venice to Camden canal walk', category: 'walk', emoji: '🚤', area: 'Little Venice', address: 'Blomfield Rd', postcode: 'W9 2PF', tube: 'Warwick Avenue', priceRange: '££', lat: 51.5225, lng: -0.1830, description: 'Narrowboats, the zoo aviary, then Camden — about an hour' },
  { id: 'v_south_bank', name: 'South Bank riverside walk', category: 'walk', emoji: '🌉', area: 'South Bank', address: 'Queen\'s Walk', postcode: 'SE1 7PB', tube: 'Waterloo', priceRange: '££', lat: 51.5058, lng: -0.1176, description: 'Book stalls, street food and the river all the way to Tower Bridge' },
  { id: 'v_st_james_park', name: 'St James\'s Park', category: 'walk', emoji: '🦆', area: 'Westminster', address: 'St James\'s Park', postcode: 'SW1A 2BJ', tube: 'St James\'s Park', priceRange: '££', lat: 51.5027, lng: -0.1341, description: 'Pelicans, the lake bridge and the palace view' },
  { id: 'v_epping', name: 'Epping Forest', category: 'walk', emoji: '🌲', area: 'Epping', address: 'Rangers Rd, Chingford', postcode: 'E4 7QH', tube: 'Chingford (rail)', priceRange: '££', lat: 51.6357, lng: 0.0176, description: 'Ancient woodland — the wildest walk on the tube map' },
  { id: 'v_walthamstow', name: 'Walthamstow Wetlands', category: 'walk', emoji: '🦉', area: 'Walthamstow', address: '2 Forest Rd', postcode: 'N17 9NH', tube: 'Tottenham Hale', priceRange: '££', lat: 51.5876, lng: -0.0574, description: 'Reservoirs, herons and kingfishers, minutes from the tube' },
  { id: 'v_holland_park', name: 'Holland Park & Kyoto Garden', category: 'walk', emoji: '🍁', area: 'Holland Park', address: 'Ilchester Pl', postcode: 'W8 6LU', tube: 'Holland Park', priceRange: '££', lat: 51.5020, lng: -0.2050, description: 'Peacocks and a Japanese garden with a waterfall' },

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
