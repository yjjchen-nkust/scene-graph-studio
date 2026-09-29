import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { ClipPlayer } from '../ClipPlayer';
import { CLIP_URL, FRAME_IDS, KEYFRAME_IDS } from '../data';

beforeEach(() => setLocale('en'));

const video = () => screen.getByTestId('demo-clip') as HTMLVideoElement;

describe('ClipPlayer', () => {
  it('plays the bundled clip muted, inline, with its own controls, loading only its metadata', () => {
    render(<ClipPlayer value="m0-demo-090" onPick={() => {}} maxVh={28} />);
    const clip = video();
    expect(clip.tagName).toBe('VIDEO');
    expect(clip.getAttribute('src')).toBe(CLIP_URL);
    expect(clip.controls).toBe(true);
    expect(clip.muted).toBe(true);
    expect(clip.hasAttribute('playsinline')).toBe(true);
    expect(clip.getAttribute('preload')).toBe('metadata');
    expect(clip.autoplay).toBe(false);
    expect(clip.style.maxHeight).toBe('28vh');
  });

  it('gives each of the ten frames a button labelled by its time, the keyframes t₁, t₂ and t₃', () => {
    render(<ClipPlayer value="m0-demo-090" onPick={() => {}} maxVh={28} />);
    const ticks = FRAME_IDS.map((id) => screen.getByTestId(`demo-tick-${id}`));
    expect(ticks.map((tick) => tick.tagName)).toEqual(FRAME_IDS.map(() => 'BUTTON'));
    expect(ticks.map((tick) => tick.textContent)).toEqual([
      '88 s', '90 s t₁', '92 s', '94 s', '96 s t₂', '98 s', '100 s', '102 s t₃', '104 s', '106 s',
    ]);
  });

  it('marks a keyframe by a solid border as well as by its subscript, and no other frame', () => {
    render(<ClipPlayer value="m0-demo-090" onPick={() => {}} maxVh={28} />);
    for (const id of FRAME_IDS) {
      const tick = screen.getByTestId(`demo-tick-${id}`);
      const key = KEYFRAME_IDS.includes(id);
      expect(tick.getAttribute('data-keyframe'), id).toBe(String(key));
      expect(tick.className.includes('border-solid'), id).toBe(key);
    }
  });

  it('marks the chosen frame as pressed, and only it', () => {
    render(<ClipPlayer value="m0-demo-096" onPick={() => {}} maxVh={28} />);
    const pressed = FRAME_IDS.filter(
      (id) => screen.getByTestId(`demo-tick-${id}`).getAttribute('aria-pressed') === 'true',
    );
    expect(pressed).toEqual(['m0-demo-096']);
  });

  it('seeks the clip to the frame\'s time within the segment and picks the frame', () => {
    const onPick = vi.fn();
    render(<ClipPlayer value="m0-demo-090" onPick={onPick} maxVh={28} />);
    fireEvent.click(screen.getByTestId('demo-tick-m0-demo-102'));
    expect(video().currentTime).toBe(14);
    expect(onPick).toHaveBeenCalledWith('m0-demo-102');
  });

  it('opens on the chosen frame\'s time, so the clip and the frame agree', () => {
    render(<ClipPlayer value="m0-demo-096" onPick={() => {}} maxVh={28} />);
    expect(video().currentTime).toBe(8);
  });
});
