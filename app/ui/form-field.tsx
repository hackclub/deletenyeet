import type { Handle, RemixNode } from 'remix/component'

import { Icon } from './icon.tsx'

export interface FormFieldProps {
  label: string
  controlId: string
  description?: RemixNode
  constraintText?: RemixNode
  errorText?: string
  children: RemixNode
}

export function FormField(handle: Handle<FormFieldProps>) {
  return () => {
    let { label, controlId, description, constraintText, errorText, children } = handle.props
    return (
      <div class="form-field">
        <label class="form-field__label" for={controlId}>
          {label}
        </label>
        {description ? (
          <div class="form-field__description" id={`${controlId}-description`}>
            {description}
          </div>
        ) : null}
        {children}
        {errorText ? (
          <div class="form-field__error" id={`${controlId}-error`}>
            <Icon name="status-error" />
            <span>{errorText}</span>
          </div>
        ) : null}
        {constraintText ? <div class="form-field__constraint">{constraintText}</div> : null}
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

export function Input(
  handle: Handle<
    ControlProps & {
      type?: 'text' | 'email' | 'search' | 'number' | 'url' | 'date'
      autocomplete?: string
    }
  >,
) {
  return () => {
    let {
      id,
      name,
      value,
      required,
      disabled,
      invalid,
      placeholder,
      describedBy,
      type,
      autocomplete,
    } = handle.props
    return (
      <input
        class="input"
        id={id}
        name={name}
        type={(type ?? 'text') as 'text'}
        value={value}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        autocomplete={autocomplete}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
      />
    )
  }
}

export function Textarea(handle: Handle<ControlProps & { rows?: number }>) {
  return () => {
    let { id, name, value, required, disabled, invalid, placeholder, describedBy, rows } =
      handle.props
    return (
      <textarea
        class="input"
        id={id}
        name={name}
        rows={rows ?? 3}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        value={value ?? ''}
      />
    )
  }
}

export function Select(
  handle: Handle<ControlProps & { options: { value: string; label: string }[] }>,
) {
  return () => {
    let { id, name, value, required, disabled, invalid, describedBy, options } = handle.props
    return (
      <select
        class="input"
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} selected={option.value === value}>
            {option.label}
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
