/**
 * The academy API (already updated on its own branch) rejects an exercise
 * outright when its grader needs a field the drawer never let an author
 * type: FUNCTION_CALL without `entry` (and, on a static language, without a
 * typed `signature`), TEST_CASES without `testFile`. This is what lets an
 * author actually fill those in.
 *
 * Per this repo's own jsdom caveat (see BlockEditor.test.tsx), a Radix
 * Select popup is never opened here — no ResizeObserver polyfill, it hangs.
 * The TEST_CASES case only asserts the trigger's default selected value.
 */
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { GraderConfigEditor, pruneGraderConfig, type GraderConfig } from '../GraderConfigEditor';

function Harness({
  graderType,
  languages,
  initial = {},
}: {
  graderType: string;
  languages: string[];
  initial?: GraderConfig;
}) {
  const [value, setValue] = useState<GraderConfig>(initial);
  return (
    <GraderConfigEditor
      graderType={graderType}
      languages={languages}
      value={value}
      onChange={setValue}
    />
  );
}

describe('GraderConfigEditor', () => {
  it('renders an unknown grader as nothing', () => {
    const { container } = render(
      <GraderConfigEditor graderType="CUSTOM" languages={[]} value={{}} onChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  describe('OUTPUT_MATCH', () => {
    it('renders the optional driver program textarea and reports typing on it', () => {
      const onChange = vi.fn();
      render(
        <GraderConfigEditor
          graderType="OUTPUT_MATCH"
          languages={['java']}
          value={{}}
          onChange={onChange}
        />,
      );

      expect(screen.getByText('Driver program (optional)')).toBeInTheDocument();
      const driver = screen.getByLabelText('Driver program');
      fireEvent.change(driver, { target: { value: 'public class Main {}' } });

      expect(onChange).toHaveBeenCalledWith({ driver: 'public class Main {}' });
    });
  });

  describe('FUNCTION_CALL', () => {
    it('renders entry/params/returns fields', () => {
      render(<Harness graderType="FUNCTION_CALL" languages={['python']} initial={{}} />);
      expect(screen.getByLabelText('Function name')).toBeInTheDocument();
      expect(screen.getByLabelText('Parameter types')).toBeInTheDocument();
      expect(screen.getByLabelText('Return type')).toBeInTheDocument();
    });

    it('shows a typed-signature hint for a static language', () => {
      render(<Harness graderType="FUNCTION_CALL" languages={['java']} initial={{}} />);
      expect(screen.getByText(/Java needs a typed signature/)).toBeInTheDocument();
    });

    it('shows no hint for a non-static language', () => {
      render(<Harness graderType="FUNCTION_CALL" languages={['python']} initial={{}} />);
      expect(screen.queryByText(/needs a typed signature/)).not.toBeInTheDocument();
    });

    it('reports entry and a typed signature as the author fills them in', () => {
      render(<Harness graderType="FUNCTION_CALL" languages={['java']} initial={{}} />);

      fireEvent.change(screen.getByLabelText('Function name'), {
        target: { value: 'solve' },
      });
      fireEvent.change(screen.getByLabelText('Parameter types'), {
        target: { value: 'int, string[]' },
      });
      fireEvent.change(screen.getByLabelText('Return type'), {
        target: { value: 'bool' },
      });

      expect(screen.getByLabelText('Function name')).toHaveValue('solve');
      expect(screen.getByLabelText('Parameter types')).toHaveValue('int, string[]');
      expect(screen.getByLabelText('Return type')).toHaveValue('bool');
    });

    it('calls onChange with the built signature when both params and returns are set', () => {
      const onChange = vi.fn();
      render(
        <GraderConfigEditor
          graderType="FUNCTION_CALL"
          languages={['java']}
          value={{ entry: 'solve', signature: { params: ['int'], returns: '' } }}
          onChange={onChange}
        />,
      );

      fireEvent.change(screen.getByLabelText('Return type'), { target: { value: 'bool' } });

      expect(onChange).toHaveBeenCalledWith({
        entry: 'solve',
        signature: { params: ['int'], returns: 'bool' },
      });
    });

    it('parses a comma-separated params list into an array on the signature', () => {
      const onChange = vi.fn();
      render(
        <GraderConfigEditor
          graderType="FUNCTION_CALL"
          languages={['java']}
          value={{ entry: 'solve', signature: undefined }}
          onChange={onChange}
        />,
      );

      fireEvent.change(screen.getByLabelText('Parameter types'), {
        target: { value: 'int, string[]' },
      });

      expect(onChange).toHaveBeenCalledWith({
        entry: 'solve',
        signature: { params: ['int', 'string[]'], returns: '' },
      });
    });
  });

  describe('TEST_CASES', () => {
    it('renders a framework select defaulted from the language and a test file textarea', () => {
      render(<Harness graderType="TEST_CASES" languages={['java']} initial={{}} />);

      expect(screen.getByRole('combobox', { name: 'Test framework' })).toHaveTextContent(
        'java-tap',
      );
      expect(screen.getByLabelText('Test file')).toBeInTheDocument();
    });

    it('defaults the framework for node', () => {
      render(<Harness graderType="TEST_CASES" languages={['node']} initial={{}} />);
      expect(screen.getByRole('combobox', { name: 'Test framework' })).toHaveTextContent(
        'node-test',
      );
    });

    it('reports typing into the test file field', () => {
      const onChange = vi.fn();
      render(
        <GraderConfigEditor
          graderType="TEST_CASES"
          languages={['java']}
          value={{}}
          onChange={onChange}
        />,
      );

      fireEvent.change(screen.getByLabelText('Test file'), {
        target: { value: 'class MainTest {}' },
      });

      expect(onChange).toHaveBeenCalledWith({ testFile: 'class MainTest {}' });
    });
  });
});

/**
 * Fix round 1 (review): every branch above spreads `{...value}` onto its own
 * field's `onChange` — deliberately, so it never clobbers a sibling field
 * mid-edit — which also means a value carried over from a PREVIOUS grader
 * type would otherwise silently ride along (e.g. a stale `framework`/
 * `testFile` from TEST_CASES reaching a FUNCTION_CALL payload the API
 * doesn't expect it on). `pruneGraderConfig` is what `ItemDrawer` calls the
 * moment `graderType` itself changes, before this component ever sees the
 * new value.
 */
describe('pruneGraderConfig', () => {
  it('keeps only OUTPUT_MATCH keys when switching to OUTPUT_MATCH', () => {
    expect(
      pruneGraderConfig(
        { entry: 'solve', framework: 'java-tap', testFile: 'x', driver: 'public class Main {}' },
        'OUTPUT_MATCH',
      ),
    ).toEqual({ driver: 'public class Main {}' });
  });

  it('keeps only FUNCTION_CALL keys when switching to FUNCTION_CALL', () => {
    expect(
      pruneGraderConfig(
        {
          driver: 'public class Main {}',
          framework: 'java-tap',
          testFile: 'x',
          entry: 'solve',
          signature: { params: ['int'], returns: 'bool' },
        },
        'FUNCTION_CALL',
      ),
    ).toEqual({ entry: 'solve', signature: { params: ['int'], returns: 'bool' } });
  });

  it('keeps only TEST_CASES keys when switching to TEST_CASES', () => {
    expect(
      pruneGraderConfig(
        { entry: 'solve', driver: 'public class Main {}', framework: 'java-tap', testFile: 'x' },
        'TEST_CASES',
      ),
    ).toEqual({ framework: 'java-tap', testFile: 'x' });
  });

  it('drops everything for an unrecognised grader type', () => {
    expect(pruneGraderConfig({ entry: 'solve', driver: 'x' }, 'CUSTOM')).toEqual({});
  });

  it('never invents keys that were not already set', () => {
    expect(pruneGraderConfig({}, 'OUTPUT_MATCH')).toEqual({});
  });
});
