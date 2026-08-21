import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import './localization/i18n';

describe('App', () => {
  it('renders the localized product name', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Whistzilla' })).toBeVisible();
  });
});
