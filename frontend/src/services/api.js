import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({ 
    baseURL: API_URL,
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

// Add response interceptor to handle 401 errors (expired/invalid token)
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Check if the error is a 401 Unauthorized
        if (error.response && error.response.status === 401) {
            console.log('401 Unauthorized - Token expired or invalid, redirecting to sign in');
            
            // Clear authentication data
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            delete api.defaults.headers.common['Authorization'];
            
            // Redirect to sign in page
            window.location.href = '/signin';
        }
        return Promise.reject(error);
    }
);

// Create a function to get a new axios instance with the current token
export function getAuthenticatedApi() {
    const token = localStorage.getItem('token');
    const authenticatedApi = axios.create({ 
        baseURL: API_URL,
        withCredentials: true // Ensure cookies are sent
    });
    
    if (token) {
        authenticatedApi.defaults.headers.common['Authorization'] = 'Bearer ' + token;
        console.log('Created authenticated API instance with token');
    }
    
    // Add 401 response interceptor to this instance too
    authenticatedApi.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response && error.response.status === 401) {
                console.log('401 Unauthorized - Token expired or invalid, redirecting to sign in');
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                window.location.href = '/signin';
            }
            return Promise.reject(error);
        }
    );
    
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
