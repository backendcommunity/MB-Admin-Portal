import React from 'react'
import { render, screen } from '@testing-library/react'
import UsersTable from './UsersTable'

vi.mock('@/lib/api/query', () => ({
  useApiQuery: () => ({
    data: { data: [{ id: 1, name: 'Test User', email: 't@example.com', role: 'ADMIN', active: true }], total: 1 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
}))

describe('UsersTable', () => {
  it('renders a user row', () => {
    render(<UsersTable />)
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('t@example.com')).toBeInTheDocument()
  })
})
