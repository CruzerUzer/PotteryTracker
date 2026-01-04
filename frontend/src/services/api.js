const API_BASE = '/api';

// Auth API
export const authAPI = {
  login: async (username, password) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Login failed');
    }

    return response.json();
  },

  register: async (username, password) => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(error.error || 'Registration failed');
    }

    return response.json();
  },

  logout: async () => {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Logout failed');
    }

    return response.json();
  },

  getCurrentUser: async () => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  },
};

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include', // Include cookies for session
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Phases API
export const phasesAPI = {
  getAll: () => apiCall('/phases'),
  create: (data) => apiCall('/phases', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiCall(`/phases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiCall(`/phases/${id}`, { method: 'DELETE' }),
};

// Materials API
export const materialsAPI = {
  getAll: () => apiCall('/materials'),
  create: (data) => apiCall('/materials', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiCall(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiCall(`/materials/${id}`, { method: 'DELETE' }),
};

// Pieces API
export const piecesAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.phase_id) params.append('phase_id', filters.phase_id);
    if (filters.material_id) params.append('material_id', filters.material_id);
    if (filters.search) params.append('search', filters.search);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.done !== undefined) params.append('done', filters.done);
    
    const query = params.toString();
    return apiCall(`/pieces${query ? '?' + query : ''}`);
  },
  getById: (id) => apiCall(`/pieces/${id}`),
  create: (data) => apiCall('/pieces', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiCall(`/pieces/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiCall(`/pieces/${id}`, { method: 'DELETE' }),
  updatePhase: (id, phaseId) => apiCall(`/pieces/${id}/phase`, {
    method: 'PATCH',
    body: JSON.stringify({ phase_id: phaseId }),
  }),
};

// Images API
export const imagesAPI = {
  upload: async (pieceId, file, phaseId) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('phase_id', phaseId.toString());

    const url = `${API_BASE}/pieces/${pieceId}/images`;
    console.log('Uploading to:', url, 'File:', file.name, 'Size:', file.size, 'Type:', file.type);

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      console.log('Upload response status:', response.status, response.statusText);
      console.log('Upload response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          console.error('Upload error response:', errorData);
        } catch (e) {
          console.error('Failed to parse error response as JSON. Response text:', await response.text().catch(() => 'Could not read response'));
          errorData = { error: 'Upload failed' };
        }
        throw new Error(errorData.error || `Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      return result;
    } catch (error) {
      console.error('Upload fetch error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Could not connect to server');
      }
      throw error;
    }
  },
  getByPiece: (pieceId) => apiCall(`/pieces/${pieceId}/images`),
  getFileUrl: (imageId, thumbnail = false) => {
    const url = `${API_BASE}/images/${imageId}/file`;
    return thumbnail ? `${url}?thumbnail=true` : url;
  },
  delete: (id) => apiCall(`/images/${id}`, { method: 'DELETE' }),
};

// Export API
export const exportAPI = {
  exportPieces: (format = 'json') => {
    // This will be handled by the component for file download
    return fetch(`${API_BASE}/export/pieces?format=${format}`, {
      credentials: 'include',
    });
  },
  getStats: () => apiCall('/export/stats'),
};

// Version API
export const versionAPI = {
  getVersion: () => apiCall('/version'),
};



