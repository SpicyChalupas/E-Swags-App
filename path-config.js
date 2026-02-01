// Path configuration for local development vs production
// This script automatically adjusts paths based on environment

(function() {
  // Detect if running locally or in production
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.includes('.local');
  
  // Store the base path for use in other scripts
  window.APP_BASE_PATH = isLocalhost ? '/E-Swags-App/' : '/';
  
  // Optional: Log for debugging
  console.log('Running on:', isLocalhost ? 'LOCAL' : 'PRODUCTION');
  console.log('Base path:', window.APP_BASE_PATH);
})();
