import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeriesSheet from '../components/study/SeriesSheet';

vi.mock('../services/api', () => ({
  studyAPI: { addSeriesPieces: vi.fn(), deleteSeries: vi.fn() },
}));

import { studyAPI } from '../services/api';

const series = { id: 4, number: 1, name: 'Cylinder', weight_grams: 500, count: 4, piece_count: 4 };

describe('SeriesSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lägger till fler alster och numrerar vidare', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    studyAPI.addSeriesPieces.mockResolvedValue({ session: { id: 3 } });
    render(<SeriesSheet series={series} sessionId={3} onOpenChange={vi.fn()} onChange={onChange} />);

    expect(screen.getByText('Cylinder 500 g · 4 alster')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fler' }));
    expect(screen.getByText(/Numreras S1-5 och S1-6/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lägg till 2 alster' }));
    expect(studyAPI.addSeriesPieces).toHaveBeenCalledWith(3, 4, 2);
    expect(onChange).toHaveBeenCalledWith({ id: 3 });
  });

  it('tar bort serien först efter bekräftelse', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    studyAPI.deleteSeries.mockResolvedValue({ id: 3, series: [] });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<SeriesSheet series={series} sessionId={3} onOpenChange={vi.fn()} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Ta bort serien/ }));
    expect(confirmSpy.mock.calls[0][0]).toContain('dess 4 alster');
    expect(studyAPI.deleteSeries).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Ta bort serien/ }));
    expect(studyAPI.deleteSeries).toHaveBeenCalledWith(3, 4);
    expect(onChange).toHaveBeenCalledWith({ id: 3, series: [] });
    confirmSpy.mockRestore();
  });
});
