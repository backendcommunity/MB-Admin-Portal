import React from 'react'
import { render, screen } from '@testing-library/react'
import CoursesTable from './CoursesTable'

vi.mock('@/lib/api/query', () => ({
  useApiQuery: () => ({
    data: { data: [{ id: 1, title: 'Course A', description: 'desc', published: false }], total: 1 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
}))

describe('CoursesTable', () => {
  it('renders a course row', () => {
    render(<CoursesTable />)
    expect(screen.getByText('Course A')).toBeInTheDocument()
  })
})
