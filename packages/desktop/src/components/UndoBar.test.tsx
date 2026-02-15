import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UndoBar } from './UndoBar';
import { SplashScreen } from './SplashScreen';

// ---------------------------------------------------------------------------
// UndoBar
// ---------------------------------------------------------------------------
describe('UndoBar', () => {
  const defaultProps = {
    show: true,
    message: 'Habit deleted',
    onUndo: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when show is false', () => {
    const { container } = render(
      <UndoBar {...defaultProps} show={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders the message when show is true', () => {
    render(<UndoBar {...defaultProps} />);

    expect(screen.getByText('Habit deleted')).toBeInTheDocument();
  });

  it('calls onUndo when the Undo button is clicked', () => {
    render(<UndoBar {...defaultProps} />);

    fireEvent.click(screen.getByText('Undo'));

    expect(defaultProps.onUndo).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the dismiss button is clicked', () => {
    render(<UndoBar {...defaultProps} />);

    // The dismiss button is the second button (contains an SVG, no text label)
    const buttons = screen.getAllByRole('button');
    const dismissButton = buttons.find((btn) => btn.textContent !== 'Undo')!;
    fireEvent.click(dismissButton);

    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// SplashScreen
// ---------------------------------------------------------------------------
describe('SplashScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the title "CLAWKEEPER" and a "Get Started" button', () => {
    render(<SplashScreen onDismiss={vi.fn()} />);

    expect(screen.getByText('CLAWKEEPER')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });

  it('renders "Click anywhere to continue" text', () => {
    render(<SplashScreen onDismiss={vi.fn()} />);

    expect(screen.getByText('Click anywhere to continue')).toBeInTheDocument();
  });

  it('calls onDismiss after clicking with a 300ms animation delay', () => {
    const onDismiss = vi.fn();
    const { container } = render(<SplashScreen onDismiss={onDismiss} />);

    // Click the outer backdrop (avoids double-fire from button + parent both
    // having onClick={handleDismiss})
    fireEvent.click(container.firstChild!);

    // onDismiss should NOT be called immediately (300ms fade-out)
    expect(onDismiss).not.toHaveBeenCalled();

    // Advance past the 300ms animation delay
    vi.advanceTimersByTime(300);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when clicking anywhere on the backdrop', () => {
    const onDismiss = vi.fn();
    const { container } = render(<SplashScreen onDismiss={onDismiss} />);

    // Click the outer wrapping div (the backdrop)
    fireEvent.click(container.firstChild!);

    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
