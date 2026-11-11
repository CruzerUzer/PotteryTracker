import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogbookForm from '../components/study/LogbookForm';

vi.mock('../services/api', () => ({
  materialsAPI: { getAll: vi.fn(() => Promise.resolve([])) },
  studyAPI: { saveLog: vi.fn(), sessionImageUrl: vi.fn(), uploadSessionImage: vi.fn(), deleteSessionImage: vi.fn(), getSession: vi.fn() },
}));

import { studyAPI } from '../services/api';

const session = { id: 42, log: null, pieces: [], series: [], images: [] };

describe('LogbookForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('behåller osparad text om man lämnar sidan och kommer tillbaka', async () => {
    const user = userEvent.setup();
    const first = render(<LogbookForm session={session} />);
    await user.type(screen.getAllByRole('textbox')[1], 'Väggen blev tjock nertill');
    first.unmount();

    render(<LogbookForm session={session} />);
    expect(screen.getAllByRole('textbox')[1]).toHaveValue('Väggen blev tjock nertill');
    expect(screen.getByRole('status')).toHaveTextContent('Din osparade text är återställd');
  });

  it('slänger utkastet på begäran', async () => {
    const user = userEvent.setup();
    const first = render(<LogbookForm session={session} />);
    await user.type(screen.getAllByRole('textbox')[0], 'Sex klumpar');
    first.unmount();

    const second = render(<LogbookForm session={session} />);
    await user.click(screen.getByRole('button', { name: 'Släng den' }));
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
    second.unmount();

    render(<LogbookForm session={session} />);
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('tar bort utkastet när loggboken sparas', async () => {
    const user = userEvent.setup();
    studyAPI.saveLog.mockResolvedValue({ log: {} });
    const onSaved = vi.fn();
    render(<LogbookForm session={session} onSaved={onSaved} />);
    await user.type(screen.getAllByRole('textbox')[2], 'Kortare drag');
    expect(localStorage.getItem('study.logDraft.42')).toContain('Kortare drag');
    await user.click(screen.getByRole('button', { name: /Spara loggboken/ }));
    expect(onSaved).toHaveBeenCalled();
    expect(localStorage.getItem('study.logDraft.42')).toBeNull();
  });
});
