export const openAppOrWeb = (deepLink: string, webLink: string) => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) {
    window.open(webLink, '_blank', 'noopener,noreferrer');
    return;
  }

  const start = Date.now();
  const onVisibilityChange = () => {
    if (document.hidden) {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.location.href = deepLink;

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (Date.now() - start < 1400 && !document.hidden) {
      window.location.href = webLink;
    }
  }, 800);
};
