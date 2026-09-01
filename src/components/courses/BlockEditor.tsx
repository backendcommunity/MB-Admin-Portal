'use client';

import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RichTextField } from '@/components/shared/form/RichTextField';
import { CodeArea } from '@/components/shared/form/CodeArea';
import { moved } from '@/lib/courses/useDragReorder';
import { PLAYGROUND_LANGUAGES, type ArticleBlock } from '@/lib/courses/blocks';

/**
 * An article body is a sequence of blocks, not one field: prose interleaved with
 * runnable playgrounds and inline checkpoints. This is the authoring side of the
 * union the learner renderer reads.
 *
 * Prose blocks use the same rich-text control as everywhere else. Playground code
 * uses CodeArea, which turns off the browser's prose handling — it is source, not
 * markup, and must survive exactly as typed or pasted.
 */
export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: ArticleBlock[];
  onChange: (next: ArticleBlock[]) => void;
}) {
  const patch = (index: number, next: Partial<ArticleBlock>) =>
    onChange(
      blocks.map((block, i) => (i === index ? ({ ...block, ...next } as ArticleBlock) : block)),
    );

  const add = (block: ArticleBlock) => onChange([...blocks, block]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Body</Label>
        <span className="text-xs text-muted-foreground">
          {blocks.length} block{blocks.length === 1 ? '' : 's'}
        </span>
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No blocks yet. Add prose, a runnable playground, or an inline checkpoint.
        </p>
      ) : null}

      {blocks.map((block, index) => (
        <div key={index} className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {block.type}
            </span>
            <span className="flex-1" />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Move block up"
              disabled={index === 0}
              onClick={() => onChange(moved(blocks, index, index - 1))}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Move block down"
              disabled={index === blocks.length - 1}
              onClick={() => onChange(moved(blocks, index, index + 1))}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove block"
              onClick={() => onChange(blocks.filter((_, i) => i !== index))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {block.type === 'html' ? (
            <RichTextField
              label="Prose"
              value={block.html}
              onChange={(html) => patch(index, { html } as Partial<ArticleBlock>)}
              minHeight={120}
            />
          ) : null}

          {block.type === 'playground' ? (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`pg-lang-${index}`}>Language</Label>
                  <Select
                    value={block.language ?? undefined}
                    onValueChange={(language) =>
                      patch(index, { language } as Partial<ArticleBlock>)
                    }
                  >
                    <SelectTrigger id={`pg-lang-${index}`}>
                      <SelectValue placeholder="Select a language" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAYGROUND_LANGUAGES.map((language) => (
                        <SelectItem key={language.enumKey} value={language.value}>
                          {language.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`pg-title-${index}`}>File name</Label>
                  <Input
                    id={`pg-title-${index}`}
                    value={block.title ?? ''}
                    placeholder="main.py"
                    onChange={(event) =>
                      patch(index, { title: event.target.value } as Partial<ArticleBlock>)
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`pg-code-${index}`}>Starting code</Label>
                <CodeArea
                  id={`pg-code-${index}`}
                  value={block.code ?? ''}
                  minHeight={120}
                  onChange={(code) => patch(index, { code } as Partial<ArticleBlock>)}
                />
                <p className="text-xs text-muted-foreground">
                  Learners can run and edit this in place. Tab indents, Escape leaves the field.
                </p>
              </div>
            </div>
          ) : null}

          {block.type === 'quiz' ? (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor={`quiz-q-${index}`}>Question</Label>
                <Input
                  id={`quiz-q-${index}`}
                  value={block.question}
                  onChange={(event) =>
                    patch(index, { question: event.target.value } as Partial<ArticleBlock>)
                  }
                />
              </div>
              {block.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`quiz-${index}`}
                    checked={block.answer === optionIndex}
                    onChange={() => patch(index, { answer: optionIndex } as Partial<ArticleBlock>)}
                    aria-label={`Mark option ${optionIndex + 1} correct`}
                  />
                  <Input
                    value={option}
                    placeholder={`Option ${optionIndex + 1}`}
                    onChange={(event) =>
                      patch(index, {
                        options: block.options.map((existing, i) =>
                          i === optionIndex ? event.target.value : existing,
                        ),
                      } as Partial<ArticleBlock>)
                    }
                  />
                  {block.options.length > 2 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove option ${optionIndex + 1}`}
                      onClick={() =>
                        patch(index, {
                          options: block.options.filter((_, i) => i !== optionIndex),
                          answer: block.answer > optionIndex ? block.answer - 1 : block.answer,
                        } as Partial<ArticleBlock>)
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </label>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch(index, { options: [...block.options, ''] } as Partial<ArticleBlock>)
                  }
                >
                  + Option
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`quiz-exp-${index}`}>Explanation</Label>
                <Input
                  id={`quiz-exp-${index}`}
                  value={block.explanation ?? ''}
                  placeholder="Shown after answering"
                  onChange={(event) =>
                    patch(index, { explanation: event.target.value } as Partial<ArticleBlock>)
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => add({ type: 'html', html: '' })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Prose
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => add({ type: 'playground', language: '', title: '', code: '' })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Playground
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            add({ type: 'quiz', question: '', options: ['', ''], answer: 0, explanation: '' })
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Checkpoint
        </Button>
      </div>
    </div>
  );
}
