import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { targetNameSlug } from './defaults.ts'

type Values = { name: string; slug: string; audience: string }

export const TargetNameFields = clientEntry(
  import.meta.url + '#TargetNameFields',
  function TargetNameFields(
    handle: Handle<Values & { editing: boolean; errors: Partial<Record<keyof Values, string>> }>,
  ) {
    let { name, slug, audience } = handle.props
    let values = { name, slug, audience }
    let initial = targetNameSlug(name)
    let overridden = {
      slug: handle.props.editing || (!!slug && slug !== initial),
      audience: handle.props.editing || (!!audience && audience !== initial),
    }

    return () => (
      <div class="target-name-fields">
        {(['name', 'slug', 'audience'] as const).map((key) => {
          let error = handle.props.errors[key]
          let description =
            key === 'slug'
              ? 'Defaults to the name in lowercase with dashes. Override if needed; it cannot change after registration.'
              : key === 'audience'
                ? 'Defaults to the name in lowercase with dashes. Override to match the aud claim your program checks. Clear to use the default.'
                : undefined
          return (
            <div class="form-field" key={key}>
              <label class="form-field__label" for={key}>
                {key === 'name' ? 'Name' : key === 'slug' ? 'Slug' : 'Audience'}
              </label>
              {description ? (
                <div class="form-field__description" id={`${key}-description`}>
                  {description}
                </div>
              ) : null}
              <input
                class="input"
                id={key}
                name={key}
                type="text"
                value={values[key]}
                required={key === 'name'}
                disabled={key === 'slug' && handle.props.editing}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={
                  [description && `${key}-description`, error && `${key}-error`]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                mix={on('input', (event) => {
                  values[key] = event.currentTarget.value
                  if (key === 'name') {
                    let inferred = targetNameSlug(values.name)
                    if (!overridden.slug) values.slug = inferred
                    if (!overridden.audience) values.audience = inferred
                  } else {
                    overridden[key] = values[key] !== ''
                  }
                  void handle.update()
                })}
              />
              {error ? (
                <div class="form-field__error" id={`${key}-error`}>
                  <span>{error}</span>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  },
)
