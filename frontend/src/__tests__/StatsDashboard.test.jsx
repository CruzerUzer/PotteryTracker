import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StatsDashboard from '../components/StatsDashboard';

// Mock API modules
vi.mock('../services/api', () => ({
  piecesAPI: {
    getAll: vi.fn(),
  },
  phasesAPI: {
    getAll: vi.fn(),
  },
  locationsAPI: {
    getAll: vi.fn(),
  },
}));

import { piecesAPI, phasesAPI, locationsAPI } from '../services/api';

const mockPieces = [
  { id: 1, name: 'Mugg', done: 0, current_phase_id: 1, current_location_id: 1, created_at: '2026-06-01T10:00:00Z' },
  { id: 2, name: 'Skål', done: 1, current_phase_id: 2, current_location_id: null, created_at: '2026-06-15T10:00:00Z' },
  { id: 3, name: 'Vas', done: 0, current_phase_id: 1, current_location_id: 1, created_at: '2026-07-01T10:00:00Z' },
];

const mockPhases = [
  { id: 1, name: 'På tork', display_order: 1 },
  { id: 2, name: 'Glasyrbränd', display_order: 2 },
];

const mockLocations = [
  { id: 1, name: 'Atelje', display_order: 1 },
];

describe('StatsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    piecesAPI.getAll.mockResolvedValue(mockPieces);
    phasesAPI.getAll.mockResolvedValue(mockPhases);
    locationsAPI.getAll.mockResolvedValue(mockLocations);
  });

  it('visar laddningsskelett initialt', () => {
    render(
      <MemoryRouter>
        <StatsDashboard />
      </MemoryRouter>
    );
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('visar KPI-kort med korrekt data', async () => {
    render(
      <MemoryRouter>
        <StatsDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      // KPI labels
      expect(screen.getByText('Totalt')).toBeInTheDocument();
      expect(screen.getByText('Aktiva')).toBeInTheDocument();
      expect(screen.getByText('Färdiga')).toBeInTheDocument();
      // Unique values (numbers may appear in several places)
      expect(screen.getByText('33%')).toBeInTheDocument(); // Färdiggrad
      expect(screen.getAllByText('3').length).toBeGreaterThan(0); // Totalt
      expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Aktiva
      expect(screen.getAllByText('1').length).toBeGreaterThan(0); // Färdiga
    });
  });

  it('visar statistik-rubrik', async () => {
    render(
      <MemoryRouter>
        <StatsDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Statistik')).toBeInTheDocument();
    });
  });
});
