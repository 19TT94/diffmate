import { useEffect, useId, useRef, useState } from 'react'
import type { Ref } from 'react'
import styled, { useTheme } from 'styled-components'

// Hooks
import { useSettings } from '../hooks/useSettings'

// Utils
import { HIGHLIGHT_EDITOR_BG } from '../lib/cmTheme'
import { DEFAULT_DIFF_INTENSITY } from '../lib/settingsTheme'

// Types
import type { SettingsColors, SettingsPatch } from '../types'

const SWATCH_WIDTH = '2.5rem'
const SWATCH_HEIGHT = '1.5rem'

// The cog in the top bar and its popover of display settings. Inputs
// preview on every `input` event (live) and save on the native `change`
// event, which fires when a color picker closes or a slider is released,
// so a drag is one save rather than dozens.
export function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const cogRef = useRef<HTMLButtonElement>(null)
  const firstControlRef = useRef<HTMLInputElement>(null)
  const dialogId = useId()
  const fieldId = useId()
  const { colors } = useTheme()
  const { settings, previewSettings, updateSettings } = useSettings()

  useEffect(() => {
    if (!open) return
    firstControlRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      setOpen(false)
      cogRef.current?.focus()
    }
    function handleMouseDown(event: MouseEvent): void {
      // A mousedown target is always a DOM node.
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [open])

  function colorPatch(key: keyof SettingsColors, value: string | number) {
    return { colors: { [key]: value } } satisfies SettingsPatch
  }

  function intensityPercent(saved: number | undefined): number {
    return Math.round((saved ?? DEFAULT_DIFF_INTENSITY) * 100)
  }

  return (
    <Wrap ref={wrapRef}>
      <Cog
        ref={cogRef}
        type="button"
        aria-label="Settings"
        title="Display settings"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <CogIcon viewBox="0 0 16 16" aria-hidden="true">
          {/* A solid 8-tooth gear with a round hole (even-odd fill). */}
          <path
            fillRule="evenodd"
            d="M6.62 2.26 L6.75 0.5 L9.25 0.5 L9.38 2.26 L11.08 2.97 L12.42 1.82 L14.18 3.58 L13.03 4.92 L13.74 6.62 L15.5 6.75 L15.5 9.25 L13.74 9.38 L13.03 11.08 L14.18 12.42 L12.42 14.18 L11.08 13.03 L9.38 13.74 L9.25 15.5 L6.75 15.5 L6.62 13.74 L4.92 13.03 L3.58 14.18 L1.82 12.42 L2.97 11.08 L2.26 9.38 L0.5 9.25 L0.5 6.75 L2.26 6.62 L2.97 4.92 L1.82 3.58 L3.58 1.82 L4.92 2.97 Z M10.4 8 A2.4 2.4 0 1 0 5.6 8 A2.4 2.4 0 1 0 10.4 8 Z"
          />
        </CogIcon>
      </Cog>

      {open && (
        <Popover id={dialogId} role="dialog" aria-label="Display settings">
          <Heading>Display</Heading>

          <Field>
            <label htmlFor={`${fieldId}-agent`}>Agent card</label>
            <CommitInput
              ref={firstControlRef}
              id={`${fieldId}-agent`}
              type="color"
              value={colors.agent}
              onPreview={(value) => previewSettings(colorPatch('agent', value))}
              onCommit={(value) => updateSettings(colorPatch('agent', value))}
            />
          </Field>
          <Field>
            <label htmlFor={`${fieldId}-primary`}>Primary</label>
            <CommitInput
              id={`${fieldId}-primary`}
              type="color"
              value={colors.primary}
              onPreview={(value) =>
                previewSettings(colorPatch('primary', value))
              }
              onCommit={(value) => updateSettings(colorPatch('primary', value))}
            />
          </Field>

          <Field>
            <label htmlFor={`${fieldId}-add`}>
              <Sign $kind="add" aria-hidden="true">
                +
              </Sign>
            </label>
            <Slider
              id={`${fieldId}-add`}
              label="Added lines"
              tint={colors.diffAddBg}
              percent={intensityPercent(settings.colors?.diffAddIntensity)}
              onPreview={(value) =>
                previewSettings(colorPatch('diffAddIntensity', value))
              }
              onCommit={(value) =>
                updateSettings(colorPatch('diffAddIntensity', value))
              }
            />
          </Field>
          <Field>
            <label htmlFor={`${fieldId}-del`}>
              <Sign $kind="del" aria-hidden="true">
                −
              </Sign>
            </label>
            <Slider
              id={`${fieldId}-del`}
              label="Removed lines"
              tint={colors.diffDelBg}
              percent={intensityPercent(settings.colors?.diffDelIntensity)}
              onPreview={(value) =>
                previewSettings(colorPatch('diffDelIntensity', value))
              }
              onCommit={(value) =>
                updateSettings(colorPatch('diffDelIntensity', value))
              }
            />
          </Field>

          <Footer>
            <Note>Saved for every review on this computer.</Note>
            <ResetButton
              type="button"
              onClick={() => updateSettings({ colors: null })}
            >
              Reset to defaults
            </ResetButton>
          </Footer>
        </Popover>
      )}
    </Wrap>
  )
}

interface CommitInputProps {
  ref?: Ref<HTMLInputElement>
  id: string
  'aria-label'?: string
  type: 'color' | 'range'
  value: string
  min?: number
  max?: number
  onPreview: (value: string) => void
  onCommit: (value: string) => void
}

// React's onChange fires on every `input` event; the native `change` event
// (picker closed, slider released) is wired up separately for saving.
function CommitInput({ ref, onPreview, onCommit, ...rest }: CommitInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const onCommitRef = useRef(onCommit)

  useEffect(() => {
    onCommitRef.current = onCommit
  }, [onCommit])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const handleChange = (): void => onCommitRef.current(input.value)
    input.addEventListener('change', handleChange)
    return () => input.removeEventListener('change', handleChange)
  }, [])

  return (
    <input
      {...rest}
      ref={(node) => {
        inputRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      onChange={(event) => onPreview(event.target.value)}
    />
  )
}

interface SliderProps {
  id: string
  label: string
  // The current row tint, previewed over the code pane's background.
  tint: string
  percent: number
  onPreview: (intensity: number) => void
  onCommit: (intensity: number) => void
}

function Slider({
  id,
  label,
  tint,
  percent,
  onPreview,
  onCommit,
}: SliderProps) {
  return (
    <SliderRow>
      <CommitInput
        id={id}
        aria-label={label}
        type="range"
        min={0}
        max={100}
        value={String(percent)}
        onPreview={(value) => onPreview(Number(value) / 100)}
        onCommit={(value) => onCommit(Number(value) / 100)}
      />
      <Percent>{percent}%</Percent>
      <TintPreview aria-hidden="true" data-testid={`${label} preview`}>
        {/* Runtime tint; translucent, so it sits on the pane color. */}
        <span style={{ backgroundColor: tint }} />
      </TintPreview>
    </SliderRow>
  )
}

// Style Overrides
const Wrap = styled.div`
  position: relative;
  flex: none;
`

const Cog = styled.button`
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.tertiary};
  color: ${({ theme }) => theme.colors.muted};
  cursor: pointer;

  &:hover,
  &[aria-expanded='true'] {
    color: ${({ theme }) => theme.colors.secondary};
    background: ${({ theme }) => theme.colors.background};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 1px;
  }
`

// Solid like Font Awesome's gear; a thin same-color stroke with round joins
// softens the tooth corners.
const CogIcon = styled.svg`
  width: 16px;
  height: 16px;
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 0.8;
  stroke-linejoin: round;
`

const Popover = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing[2]});
  right: 0;
  z-index: 10;
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[4]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.tertiary};
  box-shadow: 0 8px 24px rgb(31 35 40 / 0.12);
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const Heading = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.muted};
`

const Field = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
  color: ${({ theme }) => theme.colors.secondary};
  white-space: nowrap;

  // The picked color fills the whole bordered button.
  input[type='color'] {
    appearance: none;
    width: ${SWATCH_WIDTH};
    height: ${SWATCH_HEIGHT};
    padding: 0;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.sm};
    background: none;
    cursor: pointer;

    &::-webkit-color-swatch-wrapper {
      padding: 0;
    }
    &::-webkit-color-swatch {
      border: none;
      border-radius: 1px;
    }
    &::-moz-color-swatch {
      border: none;
      border-radius: 1px;
    }
    &:hover {
      border-color: ${({ theme }) => theme.colors.muted};
    }
    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.primary};
      outline-offset: 1px;
    }
  }
`

const SliderRow = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};

  input[type='range'] {
    width: 5.5rem;
    accent-color: ${({ theme }) => theme.colors.primary};
  }
`

const Sign = styled.span<{ $kind: 'add' | 'del' }>`
  display: inline-block;
  width: 1.25rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ $kind, theme }) =>
    $kind === 'add' ? theme.colors.success : theme.colors.danger};
`

// Same box as the color swatches above, so the right column lines up; the
// pane color underneath shows the tint as it appears on diff rows.
const TintPreview = styled.span`
  flex: none;
  display: flex;
  width: ${SWATCH_WIDTH};
  height: ${SWATCH_HEIGHT};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${HIGHLIGHT_EDITOR_BG};

  span {
    flex: 1;
    border-radius: 1px;
  }
`

const Percent = styled.span`
  width: 2.5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.muted};
`

const Footer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  padding-top: ${({ theme }) => theme.spacing[3]};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`

const Note = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.muted};
`

const ResetButton = styled.button`
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`
