import { useEffect, useId, useRef } from 'react'
import styled from 'styled-components'

// Components
import { Button } from './ui/Button'

interface SubmitConfirmProps {
  openQuestions: number
  onCancel: () => void
  onConfirm: () => void
}

// Asked before submitting while questions still wait on the agent; the
// agent answers them in its summary instead.
export function SubmitConfirm({
  openQuestions,
  onCancel,
  onConfirm,
}: SubmitConfirmProps) {
  const messageId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const message =
    openQuestions === 1
      ? "1 question hasn't been answered. The agent will answer it in its summary."
      : `${openQuestions} questions haven't been answered. The agent will answer them in its summary.`

  return (
    <>
      <Backdrop onClick={onCancel} />
      <Dialog role="alertdialog" aria-modal="true" aria-describedby={messageId}>
        <Message id={messageId}>{message}</Message>
        <Actions>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button ref={confirmRef} variant="primary" onClick={onConfirm}>
            Submit anyway
          </Button>
        </Actions>
      </Dialog>
    </>
  )
}

// Style Overrides
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgb(31 35 40 / 0.45);
`

const Dialog = styled.div`
  position: fixed;
  top: 30%;
  left: 50%;
  z-index: 50;
  width: min(28rem, 90vw);
  transform: translateX(-50%);
  padding: ${({ theme }) => theme.spacing[4]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.tertiary};
  box-shadow: 0 16px 48px rgb(31 35 40 / 0.3);
`

const Message = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing[4]};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.secondary};
`

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing[2]};
`
