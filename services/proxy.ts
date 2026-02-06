/**
 * Handles fetching resources through a CORS proxy.
 * Public proxies are used for demonstration.
 * In a production environment, this should point to a self-hosted server.
 */

// List of public proxies to try in order
const PROXIES = [
    // AllOrigins is reliable for text, sometimes slow for binary
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    // CorsProxy.io is fast but sometimes has strict rate limits
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    // CodeTabs is good for binary
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

export const fetchWithProxy = async (url: string, isBinary: boolean = false): Promise<Response> => {
    let lastError: any;

    for (const proxyGen of PROXIES) {
        try {
            const proxyUrl = proxyGen(url);
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`Status ${response.status}`);
            }

            // If we just need the response, return it.
            // Note: We might want to clone it if we were doing more checks, 
            // but we'll return the raw response to let the caller handle .text() or .blob()
            return response;
        } catch (err) {
            console.warn(`Proxy failed for ${url}:`, err);
            lastError = err;
            // Continue to next proxy
        }
    }

    throw new Error(`All proxies failed to fetch ${url}. Last error: ${lastError}`);
};
