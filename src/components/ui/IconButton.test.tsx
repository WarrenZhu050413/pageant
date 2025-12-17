import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  describe('tooltip positioning', () => {
    it('should have tooltip that stays within viewport bounds', () => {
      render(
        <IconButton tooltip="Test tooltip">
          <span>Icon</span>
        </IconButton>
      )

      // Find the tooltip container
      const tooltipContainer = screen.getByText('Test tooltip')

      // The tooltip should NOT have fixed left-1/2 -translate-x-1/2 positioning
      // which causes overflow. Instead it should use dynamic positioning.
      // Check that tooltip has classes for bounded positioning
      expect(tooltipContainer.className).toContain('left-0')
      expect(tooltipContainer.className).not.toContain('left-1/2')
      expect(tooltipContainer.className).not.toContain('-translate-x-1/2')
    })

    it('should position tooltip below button', () => {
      render(
        <IconButton tooltip="Below tooltip">
          <span>Icon</span>
        </IconButton>
      )

      const tooltipContainer = screen.getByText('Below tooltip')
      // Tooltip should be below the button to avoid top overflow
      expect(tooltipContainer.className).toContain('top-full')
    })
  })

  describe('basic rendering', () => {
    it('renders children correctly', () => {
      render(
        <IconButton>
          <span data-testid="child">Click me</span>
        </IconButton>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('renders without tooltip when not provided', () => {
      render(
        <IconButton>
          <span>No tooltip</span>
        </IconButton>
      )

      // Should not have a wrapper div with group class
      const button = screen.getByRole('button')
      expect(button.parentElement?.className).not.toContain('group')
    })
  })
})
