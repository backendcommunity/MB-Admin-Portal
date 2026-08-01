import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AddProjectModal from '../AddProjectModal';

vi.mock('@/lib/api/projects', () => ({ createProject: vi.fn().mockResolvedValue({}) }));
import { createProject } from '@/lib/api/projects';

describe('AddProjectModal — terminal mode fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides language/entrypoint fields until mode is Terminal', () => {
    render(<AddProjectModal open onClose={() => {}} />);
    expect(screen.queryByLabelText(/entrypoint/i)).not.toBeInTheDocument();
  });

  it('shows language + entrypoint fields once mode is Terminal, and submits them', async () => {
    const user = userEvent.setup();
    render(<AddProjectModal open onClose={() => {}} />);

    await user.click(screen.getByLabelText(/mode/i));
    await user.click(screen.getByRole('option', { name: 'Terminal' }));

    expect(screen.getByLabelText(/entrypoint/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/title/i), 'CLI Demo');
    await user.type(screen.getByLabelText(/entrypoint/i), 'src/index.js');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        playgroundConfig: expect.objectContaining({
          mode: 'terminal',
          language: 'node',
          entrypoint: 'src/index.js',
        }),
      }),
    );
  });

  it('requires entrypoint when mode is Terminal — does not submit without it', async () => {
    const user = userEvent.setup();
    render(<AddProjectModal open onClose={() => {}} />);
    await user.click(screen.getByLabelText(/mode/i));
    await user.click(screen.getByRole('option', { name: 'Terminal' }));
    await user.type(screen.getByLabelText(/title/i), 'CLI Demo');
    await user.click(screen.getByRole('button', { name: /create/i }));
    expect(createProject).not.toHaveBeenCalled();
  });
});
