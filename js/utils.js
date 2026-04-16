// Utility functions for LicensedExchange

/**
 * Escapes HTML to prevent XSS attacks.
 * @param {string} unsafe - The string to escape.
 * @returns {string} - Escaped string.
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '\&amp;')
        .replace(/</g, '\&lt;')
        .replace(/>/g, '\&gt;')
        .replace(/'/g, '\&apos;')
        .replace(/"/g, '\&quot;');
}

/**
 * Escapes JavaScript single quotes.
 * @param {string} str - The string to escape.
 * @returns {string} - Escaped string.
 */
function escapeJsSingleQuoted(str) {
    return str.replace(/'/g, '\\' + "'");
}

/**
 * Normalizes a product list by removing duplicates and sorting.
 * @param {Array} productList - The list of products.
 * @returns {Array} - Normalized product list.
 */
function normalizeProductList(productList) {
    return Array.from(new Set(productList)).sort();
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The string to capitalize.
 * @returns {string} - Capitalized string.
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Maps state abbreviations to full state names.
 * @param {string} stateAbbreviation - The state abbreviation.
 * @returns {string} - Full state name.
 */
const stateMap = {
    AL: 'Alabama',
    AK: 'Alaska',
    AZ: 'Arizona',
    AR: 'Arkansas',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DE: 'Delaware',
    FL: 'Florida',
    GA: 'Georgia',
    HI: 'Hawaii',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    IA: 'Iowa',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiana',
    ME: 'Maine',
    MD: 'Maryland',
    MA: 'Massachusetts',
    MI: 'Michigan',
    MN: 'Minnesota',
    MS: 'Mississippi',
    MO: 'Missouri',
    MT: 'Montana',
    NE: 'Nebraska',
    NV: 'Nevada',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'New Mexico',
    NY: 'New York',
    NC: 'North Carolina',
    ND: 'North Dakota',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PA: 'Pennsylvania',
    RI: 'Rhode Island',
    SC: 'South Carolina',
    SD: 'South Dakota',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VT: 'Vermont',
    VA: 'Virginia',
    WA: 'Washington',
    WV: 'West Virginia',
    WI: 'Wisconsin',
    WY: 'Wyoming'
};

/**
 * Formats type labels to make them user-friendly.
 * @param {string} typeLabel - The type label.
 * @returns {string} - Formatted type label.
 */
function formatTypeLabel(typeLabel) {
    return typeLabel.split('_').map(capitalize).join(' ');
}

/**
 * Creates a location object from its parts.
 * @param {string} city - The city.
 * @param {string} state - The state.
 * @returns {Object} - Location object.
 */
function locationFromParts(city, state) {
    return { city: city, state: stateMap[state] || state };
}

/**
 * Parses a location string into its components.
 * @param {string} location - The location string.
 * @returns {Object} - Parsed location with city and state.
 */
function parseLocation(location) {
    const parts = location.split(', ');
    const city = parts[0];
    const state = parts[1];
    return locationFromParts(city, state);
}

// Other helper functions can be added below as needed.