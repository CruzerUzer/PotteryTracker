import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import KanbanView from '../components/KanbanView';

vi.mock('../services/api', () => ({
  piecesAPI: { getAll: vi.fn(), updatePhase: vi.fn(), updateLocation: vi.fn() },
  phasesAPI: { getAll: vi.fn() },
  locationsAPI: { getAll: vi.fn() },
  materialsAPI: { getAll: vi.fn(() => Promise.resolve([])) },
  imagesAPI: { getByPiece: vi.fn(), getFileUrl: vi.fn((id) => `/api/images/${id}`), delete: vi.fn() },
}));

import { piecesAPI, phasesAPI, locationsAPI } from '../services/api';

const phases = [
  { id: 1, name: 'På tork', display_order: 1 },
  { id: 2, name: 'Skröjbränd', display_order: 2 },
];
const locations = [{ id: 1, name: 'Atelje', display_order: 1 }];
const pieces = [
  { id: 1, name: 'Testmugg', done: 0, current_phase_id: 1, current_location_id: 1, material_count: 1, image_count: 0 },
  { id: 2, name: 'Skål', done: 1, current_phase_id: 1, current_location_id: null, material_count: 0, image_count: 0 },
];

const originalMatchMedia = window.matchMedia;

describe('KanbanView på mobil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('max-width: 1023px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Element.prototype.scrollTo = vi.fn();
    window.scrollTo = vi.fn();
    piecesAPI.getAll.mockResolvedValue(pieces);
    phasesAPI.getAll.mockResolvedValue(phases);
    locationsAPI.getAll.mockResolvedValue(locations);
    piecesAPI.updatePhase.mockResolvedValue({});
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('visar fasflikar med antal pjäser', async () => {
    render(<MemoryRouter><KanbanView /></MemoryRouter>);
    const tab = await screen.findByRole('tab', { name: /På tork/ });
    expect(within(tab).getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Skröjbränd/ })).toHaveTextContent('0');
  });

  it('grupperar pjäser per plats inom fasen', async () => {
    render(<MemoryRouter><KanbanView /></MemoryRouter>);
    await screen.findByRole('tab', { name: /På tork/ });
    expect(screen.getByText('Atelje')).toBeInTheDocument();
    expect(screen.getByText('Ingen plats')).toBeInTheDocument();
  });

  it('öppnar snabbarket och flyttar pjäsen till vald fas', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><KanbanView /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: /Testmugg/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Skröjbränd' }));
    await waitFor(() => expect(piecesAPI.updatePhase).toHaveBeenCalledWith(1, 2));
    expect(within(dialog).getByRole('radio', { name: /Skröjbränd/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('rullar tillbaka fasen om servern vägrar flytten', async () => {
    piecesAPI.updatePhase.mockRejectedValueOnce(new Error('nätverksfel'));
    const user = userEvent.setup();
    render(<MemoryRouter><KanbanView /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: /Testmugg/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Skröjbränd' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('radio', { name: /På tork/ })).toHaveAttribute('aria-checked', 'true')
    );
    expect(screen.getByRole('tab', { name: /På tork/, hidden: true })).toHaveTextContent('2');
  });

  it('filtrerar på flera platser via filterarket', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><KanbanView /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: /^Filter/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Atelje' }));
    await user.click(within(dialog).getByRole('button', { name: 'Ingen plats' }));
    await waitFor(() =>
      expect(piecesAPI.getAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ location_id: '1,no-location', phase_id: null })
      )
    );
    expect(within(dialog).getByRole('button', { name: 'Atelje' })).toHaveAttribute('aria-pressed', 'true');
  });
});
