import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App';
import './localization/i18n';

afterEach(cleanup);
beforeEach(() => {
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
});

describe('App', () => {
  it('renders the localized product name', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Whistzilla' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Training/ })).toBeVisible();
    expect(screen.getByText('Multiplayer')).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Points calculator/ }),
    ).toBeVisible();
  });

  it('offers every legal bid type through separate type and level controls', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /Training/ }));

    const type = await screen.findByRole(
      'combobox',
      { name: 'Meldingstype' },
      { timeout: 3_000 },
    );
    expect(type).toHaveTextContent('almindelige');
    expect(type).toHaveTextContent('halve');
    expect(type).toHaveTextContent('gode');
    expect(type).toHaveTextContent('vip');
    expect(type).toHaveTextContent('Sol');
    expect(type).toHaveTextContent('Ren sol');
    expect(type).toHaveTextContent('Bordlægger');
    expect(type).toHaveTextContent('Super bordlægger');

    const level = screen.getByRole('combobox', { name: 'Meldingsniveau' });
    expect(level).toHaveValue('7');
    expect(level).not.toBeDisabled();
    fireEvent.change(type, { target: { value: 'sol' } });
    expect(level).toBeDisabled();
  });

  it('keeps the current bid and bidder visible while bidding continues', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /Training/ }));
    await screen.findByRole('combobox', { name: 'Meldingstype' });

    const currentBid = screen.getByRole('region', { name: 'Aktuel melding' });
    expect(currentBid).toHaveTextContent('Ingen melding endnu');
    fireEvent.click(screen.getByRole('button', { name: 'Meld' }));

    expect(currentBid).toHaveTextContent('7 almindelige');
    expect(currentBid).toHaveTextContent('meldt af Dig');
    expect(currentBid).toHaveTextContent('Tur:');
  });

  it('calculates numerical contract points from the shared core', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /Points calculator/ }));

    expect(screen.getByRole('region', { name: 'Pointberegner' })).toBeVisible();
    expect(screen.getByText('Kontrakten vundet')).toBeVisible();
    expect(screen.getAllByText('+1')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Meldingstype'), {
      target: { value: 'super-laydown' },
    });
    expect(screen.getByLabelText('Niveau')).toBeDisabled();
    expect(screen.getByText('Kontrakten tabt')).toBeVisible();
    expect(screen.getByText('128 point pr. stikværdi')).toBeVisible();
    expect(screen.getByText('-384')).toBeVisible();
  });

  it('persists the selected assistance mode', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /Training/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Indstillinger' }));
    fireEvent.click(screen.getByRole('radio', { name: /Træning/ }));

    expect(window.localStorage.getItem('whistzilla-assistance')).toBe(
      'training',
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Spillyde/ }));
    expect(window.localStorage.getItem('whistzilla-sound')).toBe('on');
  });
});
