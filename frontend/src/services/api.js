const API_BASE = '/api';

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
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
  getAll: (phaseId = null) => {
    const query = phaseId ? `?phase_id=${phaseId}` : '';
    return apiCall(`/pieces${query}`);
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

    const response = await fetch(`${API_BASE}/pieces/${pieceId}/images`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  },
  getByPiece: (pieceId) => apiCall(`/pieces/${pieceId}/images`),
  getFileUrl: (imageId) => `${API_BASE}/images/${imageId}/file`,
  delete: (id) => apiCall(`/images/${id}`, { method: 'DELETE' }),
};


