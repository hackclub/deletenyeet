import type { Handle, RemixNode } from 'remix/component'

import { Icon } from './icon.tsx'
import { slot } from './slot.tsx'

export function FormField(
  handle: Handle<{
    label: string
    controlId: string
    description?: RemixNode
    constraintText?: RemixNode
    errorText?: string
    children: RemixNode
  }>,
) {
  return () => {
    let { label, controlId: id, description, constraintText, errorText, children } = handle.props
    return (
      <div class="form-field">
        <label class="form-field__label" for={id}>
          {label}
        </label>
        {description ? (
          <div class="form-field__description" id={`${id}-description`}>
            {description}
          </div>
        ) : null}
        {children}
        {errorText ? (
          <div class="form-field__error" id={`${id}-error`}>
            <Icon name="status-error" />
            <span>{errorText}</span>
          </div>
        ) : null}
        {slot('form-field__constraint', constraintText)}
      </div>
    )
  }
}

interface ControlProps {
  id: string
  name: string
  value?: string
  required?: boolean
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
  describedBy?: string
}

// Attributes every control shares
const attrs = ({ id, name, required, disabled, invalid, describedBy }: ControlProps) => ({
  class: 'input',
  id,
  name,
  required,
  disabled,
  'aria-invalid': invalid ? ('true' as const) : undefined,
  'aria-describedby': describedBy,
})

export function Input(
  handle: Handle<
    ControlProps & {
      type?: 'text' | 'email' | 'search' | 'number' | 'url' | 'date'
      autocomplete?: string
    }
  >,
) {
  return () => {
    let { type = 'text', value, placeholder, autocomplete } = handle.props
    return (
      <input
        {...attrs(handle.props)}
        type={type as 'text'}
        value={value}
        placeholder={placeholder}
        autocomplete={autocomplete}
      />
    )
  }
}

export function Textarea(handle: Handle<ControlProps & { rows?: number }>) {
  return () => {
    let { rows = 3, placeholder, value = '' } = handle.props
    return <textarea {...attrs(handle.props)} rows={rows} placeholder={placeholder} value={value} />
  }
}

export function Select(
  handle: Handle<ControlProps & { options: { value: string; label: string }[] }>,
) {
  return () => {
    let { value, options } = handle.props
    return (
      <select {...attrs(handle.props)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} selected={o.value === value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
}

export function Checkbox(
  handle: Handle<{
    id: string
    name: string
    checked?: boolean
    disabled?: boolean
    children: RemixNode
  }>,
) {
  return () => {
    let { id, name, checked, disabled, children } = handle.props
    return (
      <label class="checkbox" for={id}>
        <input
          type="checkbox"
          id={id}
          name={name}
          value="on"
          checked={checked}
          disabled={disabled}
        />
        <span>{children}</span>
      </label>
    )
  }
}
