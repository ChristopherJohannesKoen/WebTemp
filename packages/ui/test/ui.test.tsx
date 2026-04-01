import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, EmptyState, buttonClassName } from '../src/index';

describe('ui package', () => {
  it('creates consistent button class names', () => {
    expect(buttonClassName({ variant: 'danger' })).toContain('bg-rose-600');
  });

  it('renders interactive UI primitives', () => {
    render(
      <div>
        <Button>Save</Button>
        <EmptyState
          action={<a href="/app/projects/new">Create project</a>}
          description="Use the empty state when a resource list is blank."
          title="No projects"
        />
      </div>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByText('Create project')).toBeTruthy();
  });
});
