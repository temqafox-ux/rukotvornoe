const normalizedBaseUrl = (process.env.REACT_APP_MEDIA_BASE_URL ?? '').replace(/\/+$/, '');

export const homeMedia = {
  authorPhoto: `${normalizedBaseUrl}/images/photo.jpg`,
  quote1: `${normalizedBaseUrl}/images/6.jpg`,
  quote2: `${normalizedBaseUrl}/images/7.jpg`,
  quote3: `${normalizedBaseUrl}/images/8.jpg`
};
