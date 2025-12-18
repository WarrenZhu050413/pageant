import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  describe('tooltip positioning', () => {
    it('should position tooltip above button to avoid overflow in bottom-positioned overlays', () => {
      render(
        <IconButton tooltip="Test tooltip">
          <span>Icon</span>
        </IconButton>
      )

      // Find the tooltip container
      const tooltipContainer = screen.getByText('Test tooltip')

      // Tooltip should be positioned above the button (bottom-full)
      // This prevents overflow when buttons are at the bottom of image overlays
      expect(tooltipContainer.className).toContain('bottom-full')
      expect(tooltipContainer.className).toContain('mb-2')
    })

    it('should center tooltip horizontally under the button', () => {
      render(
        <IconButton tooltip="Centered tooltip">
          <span>Icon</span>
        </IconButton>
      )

      const tooltipContainer = screen.getByText('Centered tooltip')
      // Tooltip should be centered using transform
      expect(tooltipContainer.className).toContain('left-1/2')
      expect(tooltipContainer.className).toContain('-translate-x-1/2')
    })

    it('should have high z-index to escape overflow-hidden containers', () => {
      render(
        <IconButton tooltip="High z-index tooltip">
          <span>Icon</span>
        </IconButton>
      )

      const tooltipContainer = screen.getByText('High z-index tooltip')
      // z-[100] ensures tooltip appears above overflow-hidden parents
      expect(tooltipContainer.className).toContain('z-[100]')
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
