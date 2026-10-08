import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

function Input({ label, className = '', ...props }: InputProps): React.JSX.Element {
  return (
    <label className="flex w-full flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-gray-300">{label}</span>}
      <input className={`glass-input ${className}`} {...props} />
    </label>
  )
}

export default Input
