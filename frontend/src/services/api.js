import axios from 'axios';

const api = axios.create({ 
    baseURL: 'https://justus-9hwt.onrender.com',
    withCredentials: true // Important: This ensures cookies are sent with requests
});

// Add request interceptor to ensure token is always included for backwards compatibility
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token && !config.headers.Authorization) {
            config.headers.Authorization = 'Bearer ' + token;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Create a function to get a new axios instance with the current token
export function getAuthenticatedApi() {
    const token = localStorage.getItem('token');
    const authenticatedApi = axios.create({ 
        baseURL: 'https://justus-9hwt.onrender.com',
        withCredentials: true // Ensure cookies are sent
    });
    
    if (token) {
        authenticatedApi.defaults.headers.common['Authorization'] = 'Bearer ' + token;
        console.log('Created authenticated API instance with token');
    }
    
    return authenticatedApi;
}

export function setAuthToken(token) {
    console.log('Setting auth token:', token ? 'present' : 'none');
    console.log('Current auth header:', api.defaults.headers.common['Authorization'] || 'none');

	if (token) {
        api.defaults.headers.common['Authorization'] = 'Bearer ' + token;
        // Also store in localStorage for the interceptor
        localStorage.setItem('token', token);
    } else {
        delete api.defaults.headers.common['Authorization'];
        localStorage.removeItem('token');
    }
	
	console.log('Auth header after setting:', api.defaults.headers.common['Authorization'] || 'none');
}

export default api;
