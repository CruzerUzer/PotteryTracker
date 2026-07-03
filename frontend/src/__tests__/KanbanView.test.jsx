import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import KanbanView from '../components/KanbanView';

vi.mock('../services/api', () => ({
  piecesAPI: {
    getAll: vi.fn(),
    updatePhase: vi.fn(),
    updateLocation: vi.fn(),
  },
  phasesAPI: {
    getAll: vi.fn(),
  },
  locationsAPI: {
    getAll: vi.fn(),
  },
  imagesAPI: {
    getByPiece: vi.fn(),
    getFileUrl: vi.fn((id, thumb) => `/api/images/${id}/file?thumbnail=${thumb}`),
    delete: vi.fn(),
  },
}));

import { piecesAPI, phasesAPI, locationsAPI, imagesAPI } from '../services/api';

const mockPieces = [
  { id: 1, name: 'Testmugg', done: 0, current_phase_id: 1, current_location_id: 1,
    display_image_id: null, material_count: 2, image_count: 0 },
];

const mockPhases = [
  { id: 1, name: 'På tork', display_order: 1 },
  { id: 2, name: 'Skröjbränd', display_order: 2 },
];

const mockLocations = [
  { id: 1, name: 'Atelje', display_order: 1 },
];

describe('KanbanView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    piecesAPI.getAll.mockResolvedValue(mockPieces);
    phasesAPI.getAll.mockResolvedValue(mockPhases);
    locationsAPI.getAll.mockResolvedValue(mockLocations);
    localStorage.getItem = vi.fn(() => null);
    localStorage.setItem = vi.fn();
  });

  it('visar laddningsskelett initialt', () => {
    render(<MemoryRouter><KanbanView /></MemoryRouter>);
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('visar fasnamn som kolumnrubriker', async () => {
    render(<MemoryRouter><KanbanView /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('På tork')).toBeInTheDocument();
      expect(screen.getByText('Skröjbränd')).toBeInTheDocument();
    });
  });

  it('visar pjäsnamn i rätt kolumn', async () => {
    render(<MemoryRouter><KanbanView /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Testmugg')).toBeInTheDocument();
    });
  });

  it('visar platsen som swim lane', async () => {
    render(<MemoryRouter><KanbanView /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Atelje')).toBeInTheDocument();
    });
  });

  it('visar "Ny pjäs"-knapp', async () => {
    render(<MemoryRouter><KanbanView /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Ny pjäs')).toBeInTheDocument();
    });
  });
});
