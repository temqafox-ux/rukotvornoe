const defaultCdnBaseUrl = 'https://pub-46a91d1be05a49dabd282278daa1ee5f.r2.dev';

const normalizedBaseUrl = (process.env.REACT_APP_CDN_BASE_URL ?? defaultCdnBaseUrl).replace(/\/+$/, '');

export const homeMedia = {
  authorPhoto: `${normalizedBaseUrl}/images/photo.jpg`,
  quote1: `${normalizedBaseUrl}/images/6.jpg`,
  quote2: `${normalizedBaseUrl}/images/7.jpg`,
  quote3: `${normalizedBaseUrl}/images/8.jpg`
};
