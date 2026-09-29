import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { ClipPlayer } from '../ClipPlayer';
import { CLIP_SECONDS, CLIP_URL, FRAME_IDS, KEYFRAME_IDS, clipTime } from '../data';

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

  it('names the file in the displayed locale when the video cannot be loaded, and the ticks keep working', () => {
    const onPick = vi.fn();
    for (const [locale, sentence] of [
      ['en', 'The clip could not be loaded ('],
      ['zh-TW', '無法載入影片（'],
    ] as const) {
      setLocale(locale);
      const { unmount } = render(<ClipPlayer value="m0-demo-090" onPick={onPick} maxVh={28} />);
      expect(screen.queryByTestId('demo-clip-error')).toBeNull();
      fireEvent.error(video());
      const message = screen.getByTestId('demo-clip-error').textContent ?? '';
      expect(message).toContain(sentence);
      expect(message).toMatch(/clip[^)）]*\.mp4[)）]/);
      expect(message).not.toContain('{file}');
      fireEvent.click(screen.getByTestId('demo-tick-m0-demo-102'));
      expect(onPick).toHaveBeenLastCalledWith('m0-demo-102');
      unmount();
    }
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

  it('seeks the last frame to just before the clip ends, never onto its end', () => {
    // 106 s is 18 s into the clip, which is its duration: a seek there leaves the clip at its end
    // rather than on a frame. jsdom knows no duration, so the manifest's 18 s is the end here.
    expect(CLIP_SECONDS).toBe(18);
    const onPick = vi.fn();
    render(<ClipPlayer value="m0-demo-090" onPick={onPick} maxVh={28} />);
    fireEvent.click(screen.getByTestId('demo-tick-m0-demo-106'));
    expect(video().currentTime).toBeLessThan(CLIP_SECONDS);
    expect(video().currentTime).toBeGreaterThanOrEqual(CLIP_SECONDS - 0.01);
    expect(onPick).toHaveBeenCalledWith('m0-demo-106');
  });

  it('opens on the last frame just before the clip ends as well', () => {
    render(<ClipPlayer value="m0-demo-106" onPick={() => {}} maxVh={28} />);
    expect(video().currentTime).toBeLessThan(CLIP_SECONDS);
    expect(video().currentTime).toBeGreaterThanOrEqual(CLIP_SECONDS - 0.01);
  });

  it('holds a seek below the duration the browser reports, when it reports one', () => {
    expect(clipTime(106)).toBeLessThan(CLIP_SECONDS);
    expect(clipTime(106, 17.5)).toBeLessThan(17.5);
    expect(clipTime(106, 17.5)).toBeGreaterThanOrEqual(17.49);
    expect(clipTime(96, 17.5)).toBe(8);
    expect(clipTime(96, Number.NaN)).toBe(8);
    expect(clipTime(88)).toBe(0);
  });
});
